import activities from '../data/gear/activities.json';
import categories from '../data/gear/categories.json';
import subcategories from '../data/gear/subcategories.json';
import brands from '../data/gear/brands.json';
import mappings from '../data/gear/activityGearMappings.json';
import type {
  GearActivity,
  GearCategory,
  GearSubcategory,
  GearBrand,
  ActivityGearMapping,
  UserGearItem,
  DuplicateCheckResult,
  NormalizeGearInputRequest,
  NormalizeGearInputResponse,
} from '../data/gearTypes';

/**
 * Get all activities
 */
export function getAllActivities(): GearActivity[] {
  return activities.filter((a) => a.enabled);
}

/**
 * Get activity by ID
 */
export function getActivityById(id: string): GearActivity | undefined {
  return activities.find((a) => a.id === id);
}

/**
 * Get all categories
 */
export function getAllCategories(): GearCategory[] {
  return categories.filter((c) => c.enabled);
}

/**
 * Get category by ID
 */
export function getCategoryById(id: string): GearCategory | undefined {
  return categories.find((c) => c.id === id);
}

/**
 * Get all subcategories
 */
export function getAllSubcategories(): GearSubcategory[] {
  return subcategories.filter((s) => s.enabled);
}

/**
 * Get subcategories for a specific category
 */
export function getSubcategoriesByCategory(categoryId: string): GearSubcategory[] {
  return subcategories.filter((s) => s.categoryId === categoryId && s.enabled);
}

/**
 * Get subcategory by ID
 */
export function getSubcategoryById(id: string): GearSubcategory | undefined {
  return subcategories.find((s) => s.id === id);
}

/**
 * Get all brands
 */
export function getAllBrands(): GearBrand[] {
  return brands.filter((b) => b.enabled);
}

/**
 * Get brand by ID
 */
export function getBrandById(id: string): GearBrand | undefined {
  return brands.find((b) => b.id === id);
}

/**
 * Get brands for a specific category
 */
export function getBrandsByCategory(categoryId: string): GearBrand[] {
  return brands.filter((b) => b.categories.includes(categoryId) && b.enabled);
}

/**
 * Get mapping for an activity
 */
export function getActivityMapping(activityId: string): ActivityGearMapping | undefined {
  return mappings.find((m) => m.activityId === activityId);
}

/**
 * Get suggested categories for an activity (sorted by priority)
 */
export function getSuggestedCategoriesForActivity(activityId: string): GearCategory[] {
  const mapping = getActivityMapping(activityId);
  if (!mapping) return [];

  return mapping.suggestedCategories
    .map((sc) => ({
      category: getCategoryById(sc.categoryId),
      priority: sc.priority,
    }))
    .filter((item) => item.category)
    .sort((a, b) => a.priority - b.priority)
    .map((item) => item.category as GearCategory);
}

/**
 * Normalize search text for comparison
 * Removes spaces, dashes, accents, converts to lowercase
 */
export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s\-_.]/g, '') // Remove spaces, dashes, dots, underscores
    .normalize('NFD') // Decompose accents
    .replace(/[\u0300-\u036f]/g, ''); // Remove accent marks
}

/**
 * Search for a brand by query
 * Supports fuzzy matching with normalized text
 */
export function searchBrands(query: string, categoryId?: string): GearBrand[] {
  if (!query || query.length < 1) {
    // If no query, return all brands for category (or all brands if no category)
    if (categoryId) {
      return getBrandsByCategory(categoryId);
    }
    return getAllBrands();
  }

  const normalizedQuery = normalizeSearchText(query);
  const allBrands = categoryId ? getBrandsByCategory(categoryId) : getAllBrands();

  return allBrands
    .filter((brand) => normalizeSearchText(brand.label).includes(normalizedQuery))
    .sort((a, b) => {
      // Sort by exactness of match (brands that start with query come first)
      const aStarts = normalizeSearchText(a.label).startsWith(normalizedQuery);
      const bStarts = normalizeSearchText(b.label).startsWith(normalizedQuery);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.label.localeCompare(b.label);
    });
}

/**
 * Search for a subcategory by query
 */
export function searchSubcategories(query: string, categoryId?: string): GearSubcategory[] {
  if (!query || query.length < 1) {
    if (categoryId) {
      return getSubcategoriesByCategory(categoryId);
    }
    return getAllSubcategories();
  }

  const normalizedQuery = normalizeSearchText(query);
  const allSubs = categoryId ? getSubcategoriesByCategory(categoryId) : getAllSubcategories();

  return allSubs
    .filter((sub) => normalizeSearchText(sub.label).includes(normalizedQuery))
    .sort((a, b) => {
      const aStarts = normalizeSearchText(a.label).startsWith(normalizedQuery);
      const bStarts = normalizeSearchText(b.label).startsWith(normalizedQuery);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.label.localeCompare(b.label);
    });
}

/**
 * Search for an activity by query
 */
export function searchActivities(query: string): GearActivity[] {
  if (!query || query.length < 1) {
    return getAllActivities();
  }

  const normalizedQuery = normalizeSearchText(query);

  return getAllActivities()
    .filter((activity) => normalizeSearchText(activity.label).includes(normalizedQuery))
    .sort((a, b) => {
      const aStarts = normalizeSearchText(a.label).startsWith(normalizedQuery);
      const bStarts = normalizeSearchText(b.label).startsWith(normalizedQuery);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.label.localeCompare(b.label);
    });
}

/**
 * Detect duplicate gear items
 * Compares brand, model, and category
 */
export function checkForDuplicate(
  userItems: UserGearItem[],
  newItem: Omit<UserGearItem, 'id' | 'createdAt' | 'updatedAt'>
): DuplicateCheckResult {
  for (const item of userItems) {
    // Same category and activity
    if (
      item.activityId !== newItem.activityId ||
      item.categoryId !== newItem.categoryId
    ) {
      continue;
    }

    // Check if brand and model match
    const newBrandName = newItem.brandName || getBrandById(newItem.brandId || '')?.label || '';
    const existingBrandName = item.brandName || getBrandById(item.brandId || '')?.label || '';

    if (
      normalizeSearchText(newBrandName) === normalizeSearchText(existingBrandName) &&
      normalizeSearchText(newItem.modelName || '') === normalizeSearchText(item.modelName || '')
    ) {
      return {
        isDuplicate: true,
        existingItem: item,
        similarity: 1.0,
      };
    }
  }

  return { isDuplicate: false };
}

/**
 * Mock function for future AI-based normalization
 * This will eventually call a backend API that uses Claude or OpenAI
 */
export async function normalizeGearInput(
  request: NormalizeGearInputRequest
): Promise<NormalizeGearInputResponse> {
  // For now, this is a mock implementation
  // TODO: Connect to backend function that calls Claude API
  // The backend function should never expose API keys to the frontend

  console.warn(
    'normalizeGearInput() is not yet implemented. Please use manual entry or a pre-defined brand.'
  );

  return {
    brandId: undefined,
    normalizedBrand: undefined,
    normalizedModel: undefined,
    confidence: 0,
    needsConfirmation: true,
  };
}

/**
 * Get popular brands for a category (for UI suggestions)
 * Returns top 8 brands, sorted by common usage
 */
export function getPopularBrands(categoryId: string, limit = 8): GearBrand[] {
  const categoryBrands = getBrandsByCategory(categoryId);

  // For now, return all brands (could be sorted by usage stats later)
  return categoryBrands.slice(0, limit);
}

/**
 * Format a gear item for display
 */
export function formatGearItem(item: UserGearItem): string {
  if (item.customName) {
    return item.customName;
  }

  const parts = [];

  if (item.brandName || item.brandId) {
    parts.push(item.brandName || getBrandById(item.brandId || '')?.label || '');
  }

  if (item.modelName) {
    parts.push(item.modelName);
  }

  return parts.filter(Boolean).join(' ') || 'Unnamed Gear';
}

/**
 * Validate a gear item before saving
 */
export function validateGearItem(
  item: Omit<UserGearItem, 'id' | 'createdAt' | 'updatedAt'>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!item.activityId) errors.push('Activity is required');
  if (!item.categoryId) errors.push('Category is required');
  if (!item.brandId && !item.brandName) errors.push('Brand is required');
  if (!item.modelName) errors.push('Model name is required');

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create a new user gear item
 */
export function createUserGearItem(
  userId: string,
  item: Omit<UserGearItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): UserGearItem {
  const now = new Date().toISOString();

  return {
    ...item,
    id: `gear-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    userId,
    createdAt: now,
    updatedAt: now,
  };
}

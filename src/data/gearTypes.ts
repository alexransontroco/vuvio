export type GearSource = 'catalog' | 'manual' | 'ai-normalized';
export type VerificationStatus = 'unverified' | 'recognized' | 'verified';

export interface UserGearItem {
  id: string;
  userId: string;

  activityId: string;
  categoryId: string;
  subcategoryId?: string | null;

  brandId?: string | null;
  brandName?: string | null;

  modelName?: string | null;
  customName?: string | null;

  year?: number | null;
  imageUrl?: string | null;
  productUrl?: string | null;
  notes?: string | null;

  source: GearSource;
  verificationStatus: VerificationStatus;

  // Future monetization fields
  isVerified?: boolean;
  isSponsored?: boolean;
  affiliateEnabled?: boolean;
  affiliateUrl?: string | null;
  suggestionBoost?: number;

  createdAt: string;
  updatedAt: string;
}

export interface GearActivity {
  id: string;
  label: string;
  environment: 'land' | 'water' | 'indoor' | 'outdoor' | 'all';
  icon: string;
  enabled: boolean;
}

export interface GearCategory {
  id: string;
  label: string;
  icon: string;
  enabled: boolean;
}

export interface GearSubcategory {
  id: string;
  categoryId: string;
  label: string;
  enabled: boolean;
}

export interface GearBrand {
  id: string;
  label: string;
  categories: string[];
  enabled: boolean;
}

export interface ActivityGearMapping {
  activityId: string;
  suggestedCategories: Array<{
    categoryId: string;
    priority: number;
    required: boolean;
  }>;
}

export interface NormalizeGearInputRequest {
  activityId: string;
  categoryId: string;
  userInput: string;
}

export interface NormalizeGearInputResponse {
  brandId?: string | null;
  normalizedBrand?: string | null;
  normalizedModel?: string | null;
  confidence?: number;
  needsConfirmation?: boolean;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingItem?: UserGearItem;
  similarity?: number;
}

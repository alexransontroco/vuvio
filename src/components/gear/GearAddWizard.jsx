import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import GearActivityPicker from './GearActivityPicker';
import { GearCategoryPicker } from './GearCategoryPicker';
import { GearSubcategoryPicker } from './GearSubcategoryPicker';
import { GearBrandPicker } from './GearBrandPicker';
import { GearModelInput } from './GearModelInput';
import { GearDetailsForm } from './GearDetailsForm';
import { checkForDuplicate, createUserGearItem } from '../../services/gearService';
import './gear-picker.css';

/**
 * Complete wizard for adding gear
 * Manages all steps: activity → category → subcategory → brand → model → details
 */
export function GearAddWizard({
  userId,
  userGearItems = [],
  onSave,
  onCancel,
}) {
  const [step, setStep] = useState('activity');
  const [formData, setFormData] = useState({
    activityId: null,
    activity: null,
    categoryId: null,
    category: null,
    subcategoryId: null,
    subcategory: null,
    brandId: null,
    brandName: null,
    modelName: null,
    customName: null,
    year: null,
    imageUrl: null,
    productUrl: null,
    notes: null,
  });
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  const handleActivitySelect = (activity) => {
    setFormData((prev) => ({
      ...prev,
      activityId: activity.id,
      activity,
    }));
    setStep('category');
  };

  const handleCategorySelect = (category) => {
    setFormData((prev) => ({
      ...prev,
      categoryId: category.id,
      category,
    }));

    // Check if this category has subcategories
    // If not, skip to brand selection
    // For now, just go to subcategory (which will skip itself if no subs)
    setStep('subcategory');
  };

  const handleSubcategorySelect = (subcategory) => {
    setFormData((prev) => ({
      ...prev,
      subcategoryId: subcategory.id,
      subcategory,
    }));
    setStep('brand');
  };

  const handleSubcategorySkip = () => {
    setStep('brand');
  };

  const handleBrandSelect = (brand) => {
    setFormData((prev) => ({
      ...prev,
      brandId: brand.id,
      brandName: brand.label,
    }));
    setStep('model');
  };

  const handleBrandManual = (customBrand) => {
    setFormData((prev) => ({
      ...prev,
      brandId: null,
      brandName: customBrand || 'Other',
    }));
    setStep('model');
  };

  const handleModelInput = (data) => {
    setFormData((prev) => ({
      ...prev,
      ...data,
    }));

    // Check for duplicates
    const duplicate = checkForDuplicate(userGearItems, {
      activityId: prev.activityId,
      categoryId: prev.categoryId,
      subcategoryId: prev.subcategoryId,
      brandId: data.brandId,
      brandName: data.brandName,
      modelName: data.modelName,
      customName: data.customName,
      year: null,
      imageUrl: null,
      productUrl: null,
      notes: null,
      source: 'catalog',
      verificationStatus: 'unverified',
    });

    if (duplicate.isDuplicate) {
      setDuplicateWarning(duplicate.existingItem);
      setStep('duplicate-warning');
    } else {
      setStep('details');
    }
  };

  const handleDetailsSubmit = (details) => {
    const newItem = createUserGearItem(userId, {
      activityId: formData.activityId,
      categoryId: formData.categoryId,
      subcategoryId: formData.subcategoryId || null,
      brandId: formData.brandId || null,
      brandName: formData.brandName,
      modelName: formData.modelName,
      customName: formData.customName,
      year: details.year,
      imageUrl: details.imageUrl,
      productUrl: details.productUrl,
      notes: details.notes,
      source: formData.brandId ? 'catalog' : 'manual',
      verificationStatus: formData.brandId ? 'recognized' : 'unverified',
    });

    onSave(newItem);
  };

  const handleDetailsSkip = () => {
    const newItem = createUserGearItem(userId, {
      activityId: formData.activityId,
      categoryId: formData.categoryId,
      subcategoryId: formData.subcategoryId || null,
      brandId: formData.brandId || null,
      brandName: formData.brandName,
      modelName: formData.modelName,
      customName: formData.customName,
      year: null,
      imageUrl: null,
      productUrl: null,
      notes: null,
      source: formData.brandId ? 'catalog' : 'manual',
      verificationStatus: formData.brandId ? 'recognized' : 'unverified',
    });

    onSave(newItem);
  };

  const handleBack = () => {
    const steps = ['activity', 'category', 'subcategory', 'brand', 'model', 'details'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  // Step-based rendering
  if (step === 'activity') {
    return (
      <GearActivityPicker
        onSelect={handleActivitySelect}
        onCancel={onCancel}
      />
    );
  }

  if (step === 'category') {
    return (
      <GearCategoryPicker
        activityId={formData.activityId}
        activity={formData.activity}
        onSelect={handleCategorySelect}
        onBack={handleBack}
        onCancel={onCancel}
      />
    );
  }

  if (step === 'subcategory') {
    return (
      <GearSubcategoryPicker
        categoryId={formData.categoryId}
        category={formData.category}
        onSelect={handleSubcategorySelect}
        onSkip={handleSubcategorySkip}
        onBack={handleBack}
        onCancel={onCancel}
      />
    );
  }

  if (step === 'brand') {
    return (
      <GearBrandPicker
        categoryId={formData.categoryId}
        category={formData.category}
        onSelect={handleBrandSelect}
        onManual={handleBrandManual}
        onBack={handleBack}
        onCancel={onCancel}
      />
    );
  }

  if (step === 'model') {
    return (
      <GearModelInput
        brand={formData.brandName}
        brandId={formData.brandId}
        category={formData.category}
        onContinue={handleModelInput}
        onBack={handleBack}
        onCancel={onCancel}
      />
    );
  }

  if (step === 'details') {
    return (
      <GearDetailsForm
        initialData={formData}
        category={formData.category}
        onSave={handleDetailsSubmit}
        onSkip={handleDetailsSkip}
        onCancel={onCancel}
      />
    );
  }

  if (step === 'duplicate-warning') {
    return (
      <DuplicateWarningScreen
        existingItem={duplicateWarning}
        onContinue={() => setStep('details')}
        onUse={() => onSave(duplicateWarning)}
        onBack={handleBack}
        onCancel={onCancel}
      />
    );
  }

  return null;
}

/**
 * Warning screen when a duplicate is detected
 */
function DuplicateWarningScreen({
  existingItem,
  onContinue,
  onUse,
  onBack,
  onCancel,
}) {
  return (
    <section className="gear-picker gear-duplicate-warning" aria-label="Duplicate detected">
      <header className="gear-picker__header">
        <button type="button" className="gear-picker__back" onClick={onBack} aria-label="Back">
          <ChevronLeft size={20} strokeWidth={1.8} />
        </button>
        <div>
          <h2>This item already exists</h2>
          <p>We found a similar item in your gear collection</p>
        </div>
        <button type="button" className="gear-picker__close" onClick={onCancel} aria-label="Cancel">
          ×
        </button>
      </header>

      <section className="gear-picker__section gear-duplicate-content">
        <div className="gear-duplicate-item">
          <strong>{existingItem.brandName} {existingItem.modelName}</strong>
          <small>Added {new Date(existingItem.createdAt).toLocaleDateString()}</small>
        </div>

        <p className="gear-duplicate-message">
          You already have this equipment in your collection. Would you like to:
        </p>

        <div className="gear-duplicate-actions">
          <button
            type="button"
            className="gear-picker__continue"
            onClick={() => onUse(existingItem)}
          >
            Use this existing item
          </button>
          <button
            type="button"
            className="gear-picker__add-new"
            onClick={onContinue}
          >
            Add anyway (different unit)
          </button>
        </div>
      </section>
    </section>
  );
}

export default GearAddWizard;

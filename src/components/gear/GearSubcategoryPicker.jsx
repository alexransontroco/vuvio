import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getSubcategoriesByCategory } from '../../services/gearService';
import './gear-picker.css';

/**
 * Optional step: only shown if the category has subcategories
 */
export function GearSubcategoryPicker({
  categoryId,
  category,
  onSelect,
  onSkip,
  onBack,
  onCancel,
}) {
  const subcategories = getSubcategoriesByCategory(categoryId);

  // If no subcategories, skip this step
  if (subcategories.length === 0) {
    onSkip();
    return null;
  }

  return (
    <section className="gear-picker gear-subcategory-picker" aria-label="Select subcategory">
      <header className="gear-picker__header">
        <button type="button" className="gear-picker__back" onClick={onBack} aria-label="Back">
          <ChevronLeft size={20} strokeWidth={1.8} />
        </button>
        <div>
          <h2>Narrow it down</h2>
          <p>Select a type of {category.label}</p>
        </div>
        <button type="button" className="gear-picker__close" onClick={onCancel} aria-label="Cancel">
          ×
        </button>
      </header>

      <section className="gear-picker__section">
        <div className="gear-subcategory-list">
          {subcategories.map((subcategory) => (
            <button
              key={subcategory.id}
              type="button"
              className="gear-subcategory-row"
              onClick={() => onSelect(subcategory)}
            >
              <span className="gear-subcategory-row__label">{subcategory.label}</span>
              <ChevronRight size={16} strokeWidth={1.8} />
            </button>
          ))}
        </div>
      </section>

      <footer className="gear-picker__footer">
        <button type="button" className="gear-picker__skip" onClick={onSkip}>
          Skip this step
        </button>
      </footer>
    </section>
  );
}

export default GearSubcategoryPicker;

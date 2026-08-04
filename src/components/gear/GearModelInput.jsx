import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import './gear-picker.css';

export function GearModelInput({
  brand,
  brandId,
  category,
  onContinue,
  onBack,
  onCancel,
}) {
  const [modelName, setModelName] = useState('');
  const [customName, setCustomName] = useState('');

  const handleContinue = () => {
    // Model name is required
    if (!modelName.trim()) {
      alert('Please enter a model name');
      return;
    }

    onContinue({
      brandName: brand,
      brandId: brandId || null,
      modelName: modelName.trim(),
      customName: customName.trim() || null,
    });
  };

  return (
    <section className="gear-picker gear-model-input" aria-label="Enter model name">
      <header className="gear-picker__header">
        <button type="button" className="gear-picker__back" onClick={onBack} aria-label="Back">
          <ChevronLeft size={20} strokeWidth={1.8} />
        </button>
        <div>
          <h2>Model name</h2>
          <p>What's the model of your {brand} {category.label}?</p>
        </div>
        <button type="button" className="gear-picker__close" onClick={onCancel} aria-label="Cancel">
          ×
        </button>
      </header>

      <section className="gear-picker__section gear-model-form">
        <label>
          <span className="gear-model-form__label">Model name *</span>
          <input
            type="text"
            placeholder={`Example: HERO13 Black, Aeroad CF SLX, Stumpjumper Evo`}
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            autoFocus
          />
          <small>The exact model or version name</small>
        </label>

        <label>
          <span className="gear-model-form__label">Custom name (optional)</span>
          <input
            type="text"
            placeholder={`Example: My favorite camera, Main bike`}
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
          />
          <small>A personal name for this gear (for your use only)</small>
        </label>

        <div className="gear-model-form__actions">
          <button
            type="button"
            className="gear-picker__continue"
            disabled={!modelName.trim()}
            onClick={handleContinue}
          >
            Continue
          </button>
        </div>
      </section>

      <footer className="gear-picker__footer">
        <p className="gear-picker__hint">
          You can add more details like photo, year, and notes after this.
        </p>
      </footer>
    </section>
  );
}

export default GearModelInput;

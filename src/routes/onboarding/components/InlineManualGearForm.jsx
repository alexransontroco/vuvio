import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import { EQUIPMENT_VISUAL_CATEGORIES, getEquipmentVisual, inferEquipmentVisualCategory } from '../data/equipmentIcons.js';

const DATA_CATEGORY_FOR_VISUAL = { cameras: 'recording', audio: 'audio', computing: 'streaming', energy: 'power_accessories' };

export default function InlineManualGearForm({
  open,
  onToggle,
  onSubmit,
  activities = [],
  defaultActivity = '',
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [category, setCategory] = useState('auto');
  const [associatedActivity, setAssociatedActivity] = useState(defaultActivity || '');

  const reset = () => {
    setName('');
    setBrand('');
    setModel('');
    setCategory('auto');
    setAssociatedActivity(defaultActivity || '');
  };

  const submit = (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedBrand = brand.trim();
    const trimmedModel = model.trim();
    if (!trimmedName) return;

    const displayName = trimmedName;
    const visualCategory = category === 'auto'
      ? inferEquipmentVisualCategory({ displayName, brand: trimmedBrand, model: trimmedModel })
      : category;
    const finalCategory = DATA_CATEGORY_FOR_VISUAL[visualCategory] || 'activity';
    const payload = {
      brand: trimmedBrand,
      model: trimmedModel || (trimmedBrand ? '' : trimmedName),
      displayName,
      category: finalCategory,
      visualCategory,
      equipmentType: visualCategory === 'other' ? 'Equipment' : visualCategory.charAt(0).toUpperCase() + visualCategory.slice(1),
      provider: 'user',
      identificationStatus: 'manual',
      associatedActivity: associatedActivity || null,
    };
    onSubmit(payload);
    reset();
  };

  const IconPreview = getEquipmentVisual({
    displayName: name,
    brand,
    model,
    visualCategory: category === 'auto' ? undefined : category,
  }).icon;

  if (!open) {
    return (
      <div className="ob-eq-cta-manual">
        <p className="ob-eq-cta-manual__hint">{t('onboarding.equipment.notFoundHint')}</p>
        <button type="button" className="ob-eq-manual-toggle" onClick={onToggle}>
          <Plus size={16} strokeWidth={2.5} />
          {t('onboarding.equipment.addMyEquipment')}
        </button>
      </div>
    );
  }

  return (
    <motion.form
      className="ob-eq-manual"
      onSubmit={submit}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div className="ob-eq-manual__head">
        <div className="ob-eq-manual__preview" aria-hidden="true">
          <IconPreview size={22} strokeWidth={1.6} />
        </div>
        <p className="ob-eq-manual__title">{t('onboarding.equipment.manualForm.title')}</p>
        <button
          type="button"
          className="ob-eq-manual__close"
          onClick={onToggle}
          aria-label={t('common.cancel')}
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>

      <label className="ob-eq-manual__field">
        <span className="ob-eq-manual__label">{t('onboarding.equipment.manualForm.name')}</span>
        <input
          type="text"
          className="ob-eq-manual__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('onboarding.equipment.manualForm.namePlaceholder')}
          autoFocus
          required
        />
      </label>

      <div className="ob-eq-manual__row">
        <label className="ob-eq-manual__field">
          <span className="ob-eq-manual__label">
            {t('onboarding.equipment.manualForm.brand')} <span className="ob-eq-manual__opt">{t('onboarding.equipment.manualForm.optional')}</span>
          </span>
          <input
            type="text"
            className="ob-eq-manual__input"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
          />
        </label>
        <label className="ob-eq-manual__field">
          <span className="ob-eq-manual__label">
            {t('onboarding.equipment.manualForm.model')} <span className="ob-eq-manual__opt">{t('onboarding.equipment.manualForm.optional')}</span>
          </span>
          <input
            type="text"
            className="ob-eq-manual__input"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
        </label>
      </div>

      <label className="ob-eq-manual__field">
        <span className="ob-eq-manual__label">
          {t('onboarding.equipment.manualForm.category')} <span className="ob-eq-manual__opt">{t('onboarding.equipment.manualForm.optional')}</span>
        </span>
        <select className="ob-eq-manual__input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="auto">{t('onboarding.equipment.manualForm.categoryAuto')}</option>
          {EQUIPMENT_VISUAL_CATEGORIES.map((id) => (
            <option key={id} value={id}>{id.charAt(0).toUpperCase() + id.slice(1)}</option>
          ))}
        </select>
      </label>

      {activities.length > 0 && (
        <label className="ob-eq-manual__field">
          <span className="ob-eq-manual__label">
            {t('onboarding.equipment.manualForm.activity')} <span className="ob-eq-manual__opt">{t('onboarding.equipment.manualForm.optional')}</span>
          </span>
          <select
            className="ob-eq-manual__input"
            value={associatedActivity}
            onChange={(e) => setAssociatedActivity(e.target.value)}
          >
            <option value="">—</option>
            {activities.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
      )}

      <div className="ob-eq-manual__actions">
        <button type="button" className="ob-eq-manual__cancel" onClick={onToggle}>
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          className="ob-eq-manual__submit"
          disabled={!name.trim()}
        >
          {t('onboarding.equipment.manualForm.submit')}
        </button>
      </div>
    </motion.form>
  );
}

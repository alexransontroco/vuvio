import { useTranslation } from 'react-i18next';
import { ACTIVITY_CATEGORIES } from '../../../data/activityCategories.js';
import CategoryCard from '../components/CategoryCard.jsx';

export default function StepInterests({ draft, toggleCategory }) {
  const { t } = useTranslation();
  const selectedCount = draft.selectedCategories.length;
  return (
    <div className="ob-step">
      <header className="ob-step__header">
        <p className="ob-step__eyebrow">{t('onboarding.stepLabel', { n: 1 })}</p>
        <h2 className="ob-step__title">{t('onboarding.interests.title')}</h2>
        <p className="ob-step__sub">{t('onboarding.interests.subtitle')}</p>
      </header>

      <div className="ob-cat-grid">
        {ACTIVITY_CATEGORIES.map((cat) => (
          <CategoryCard
            key={cat.id}
            category={cat}
            label={cat.label}
            selected={draft.selectedCategories.includes(cat.id)}
            onToggle={toggleCategory}
          />
        ))}
      </div>

      {selectedCount > 0 && (
        <p className="ob-step__footnote" aria-live="polite">
          {t('onboarding.interests.selectedCount', { count: selectedCount })}
        </p>
      )}
    </div>
  );
}

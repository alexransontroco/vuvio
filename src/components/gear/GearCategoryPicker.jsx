import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getSuggestedCategoriesForActivity, getAllCategories } from '../../services/gearService';
import './gear-picker.css';

export function GearCategoryPicker({
  activityId,
  activity,
  onSelect,
  onBack,
  onCancel,
}) {
  const { t } = useTranslation();
  const suggestedCategories = getSuggestedCategoriesForActivity(activityId);
  const allCategories = getAllCategories();

  // Suggested first, then others
  const categoriesInOrder = [
    ...suggestedCategories,
    ...allCategories.filter((c) => !suggestedCategories.find((s) => s.id === c.id)),
  ];

  return (
    <section className="gear-picker gear-category-picker" aria-label={t('gearManager.selectCategory')}>
      <header className="gear-picker__header">
        <button type="button" className="gear-picker__back" onClick={onBack} aria-label={t('gearManager.back')}>
          <ChevronLeft size={20} strokeWidth={1.8} />
        </button>
        <div>
          <h2>{t('gearManager.categoryTitle')}</h2>
          <p>{t('gearManager.categorySubtitle', { activity: t(`gearManager.activities.${activity.id}`, { defaultValue: activity.label }) })}</p>
        </div>
        <button type="button" className="gear-picker__close" onClick={onCancel} aria-label={t('gearManager.cancel')}>
          ×
        </button>
      </header>

      <section className="gear-picker__section">
        <h3>{t('gearManager.suggestedFor', { activity: t(`gearManager.activities.${activity.id}`, { defaultValue: activity.label }) })}</h3>
        <div className="gear-category-grid">
          {suggestedCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              className="gear-category-card"
              onClick={() => onSelect(category)}
            >
              <span className="gear-category-card__icon">{getCategoryIcon(category.icon)}</span>
              <span className="gear-category-card__label">{t(`gearManager.categories.${category.id}`, { defaultValue: category.label })}</span>
              <ChevronRight size={16} strokeWidth={1.8} />
            </button>
          ))}
        </div>
      </section>

      {allCategories.length > suggestedCategories.length && (
        <section className="gear-picker__section">
          <h3>{t('gearManager.otherEquipment')}</h3>
          <div className="gear-category-grid">
            {allCategories
              .filter((c) => !suggestedCategories.find((s) => s.id === c.id))
              .map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className="gear-category-card"
                  onClick={() => onSelect(category)}
                >
                  <span className="gear-category-card__icon">
                    {getCategoryIcon(category.icon)}
                  </span>
                  <span className="gear-category-card__label">{t(`gearManager.categories.${category.id}`, { defaultValue: category.label })}</span>
                  <ChevronRight size={16} strokeWidth={1.8} />
                </button>
              ))}
          </div>
        </section>
      )}
    </section>
  );
}

function getCategoryIcon(iconName) {
  const icons = {
    bike: '🚲',
    shield: '🛡️',
    circle: '⭕',
    shoe: '👟',
    shirt: '👕',
    map: '🗺️',
    lightbulb: '💡',
    camera: '📷',
    wrench: '🔧',
    droplet: '💧',
    backpack: '🎒',
    waves: '🌊',
    link: '🔗',
    package: '📦',
    watch: '⌚',
    box: '📦',
    settings: '⚙️',
    cut: '✂️',
    balance: '⚖️',
    thermometer: '🌡️',
    mic: '🎤',
    headphones: '🎧',
    coffee: '☕',
    'fishing-rod': '🎣',
    canoe: '🛶',
    rowing: '🚣',
    sailboat: '⛵',
    scuba: '🤿',
    cylinder: '🗜️',
    lens: '🔍',
    tripod: '📷',
    speaker: '🔊',
    car: '🚗',
    motorcycle: '🏍️',
    motor: '⚡',
  };

  return icons[iconName] || '📦';
}

export default GearCategoryPicker;

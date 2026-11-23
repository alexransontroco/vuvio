import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ChevronRight } from 'lucide-react';
import { getAllActivities, searchActivities } from '../../services/gearService';
import './gear-picker.css';

export function GearActivityPicker({ onSelect, onCancel }) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const allActivities = getAllActivities();
  const activities = searchQuery ? searchActivities(searchQuery) : allActivities;

  const recentActivities = allActivities.slice(0, 6); // Show first 6 as "recent"

  return (
    <section className="gear-picker gear-activity-picker" aria-label={t('gearManager.selectActivity')}>
      <header className="gear-picker__header">
        <div>
          <h2>{t('gearManager.activityTitle')}</h2>
          <p>{t('gearManager.activitySubtitle')}</p>
        </div>
        <button type="button" className="gear-picker__close" onClick={onCancel} aria-label={t('gearManager.cancel')}>
          ×
        </button>
      </header>

      <div className="gear-picker__search">
        <Search size={16} />
        <input
          type="text"
          placeholder={t('gearManager.searchActivities')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
        />
      </div>

      {!searchQuery && recentActivities.length > 0 && (
        <section className="gear-picker__section">
          <h3>{t('gearManager.popularActivities')}</h3>
          <div className="gear-activity-grid">
            {recentActivities.map((activity) => (
              <button
                key={activity.id}
                type="button"
                className="gear-activity-card"
                onClick={() => onSelect(activity)}
              >
                <span className="gear-activity-card__icon">{getActivityIcon(activity.icon)}</span>
                <span className="gear-activity-card__label">{t(`gearManager.activities.${activity.id}`, { defaultValue: activity.label })}</span>
                <ChevronRight size={16} strokeWidth={1.8} />
              </button>
            ))}
          </div>
        </section>
      )}

      {(searchQuery || activities.length > 0) && (
        <section className="gear-picker__section">
        <h3>{searchQuery ? t('gearManager.results') : t('gearManager.allActivities')}</h3>
          <div className="gear-activity-list">
            {activities.length > 0 ? (
              activities.map((activity) => (
                <button
                  key={activity.id}
                  type="button"
                  className="gear-activity-row"
                  onClick={() => onSelect(activity)}
                >
                  <span className="gear-activity-row__icon">
                    {getActivityIcon(activity.icon)}
                  </span>
                  <span className="gear-activity-row__label">{t(`gearManager.activities.${activity.id}`, { defaultValue: activity.label })}</span>
                  <ChevronRight size={16} strokeWidth={1.8} />
                </button>
              ))
            ) : (
              <p className="gear-picker__empty">{t('gearManager.noActivities')}</p>
            )}
          </div>
        </section>
      )}
    </section>
  );
}

function getActivityIcon(iconName) {
  const icons = {
    bike: '🚴',
    mountains: '⛰️',
    run: '🏃',
    waves: '🌊',
    canoe: '🛶',
    fish: '🎣',
    sailboat: '⛵',
    scuba: '🤿',
    utensils: '🍴',
    cake: '🍰',
    coffee: '☕',
    camera: '📷',
    video: '🎥',
    music: '🎵',
    car: '🚗',
    motorcycle: '🏍️',
    wrench: '🔧',
    leaf: '🌿',
    map: '🗺️',
  };

  return icons[iconName] || '📍';
}

export default GearActivityPicker;

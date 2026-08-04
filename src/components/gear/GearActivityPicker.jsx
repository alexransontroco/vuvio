import { useState } from 'react';
import { Search, ChevronRight } from 'lucide-react';
import { getAllActivities, searchActivities } from '../../services/gearService';
import './gear-picker.css';

export function GearActivityPicker({ onSelect, onCancel }) {
  const [searchQuery, setSearchQuery] = useState('');
  const allActivities = getAllActivities();
  const activities = searchQuery ? searchActivities(searchQuery) : allActivities;

  const recentActivities = allActivities.slice(0, 6); // Show first 6 as "recent"

  return (
    <section className="gear-picker gear-activity-picker" aria-label="Select activity">
      <header className="gear-picker__header">
        <div>
          <h2>What are you doing?</h2>
          <p>Select an activity to find relevant gear</p>
        </div>
        <button type="button" className="gear-picker__close" onClick={onCancel} aria-label="Cancel">
          ×
        </button>
      </header>

      <div className="gear-picker__search">
        <Search size={16} />
        <input
          type="text"
          placeholder="Search activities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
        />
      </div>

      {!searchQuery && recentActivities.length > 0 && (
        <section className="gear-picker__section">
          <h3>Popular activities</h3>
          <div className="gear-activity-grid">
            {recentActivities.map((activity) => (
              <button
                key={activity.id}
                type="button"
                className="gear-activity-card"
                onClick={() => onSelect(activity)}
              >
                <span className="gear-activity-card__icon">{getActivityIcon(activity.icon)}</span>
                <span className="gear-activity-card__label">{activity.label}</span>
                <ChevronRight size={16} strokeWidth={1.8} />
              </button>
            ))}
          </div>
        </section>
      )}

      {(searchQuery || activities.length > 0) && (
        <section className="gear-picker__section">
          <h3>{searchQuery ? 'Results' : 'All activities'}</h3>
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
                  <span className="gear-activity-row__label">{activity.label}</span>
                  <ChevronRight size={16} strokeWidth={1.8} />
                </button>
              ))
            ) : (
              <p className="gear-picker__empty">No activities found</p>
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

import { useState } from 'react';
import { ChevronLeft, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import GearAddWizard from '../components/gear/GearAddWizard';
import GearItemCard from '../components/gear/GearItemCard';
import {
  getActivityById,
  getAllActivities,
} from '../services/gearService';
import '../styles/profile-gear-page.css';

/**
 * Profile page for managing user's gear collection
 * Displays gear grouped by activity with ability to add, edit, remove items
 */
export default function ProfileGearPage() {
  const navigate = useNavigate();

  // TODO: Connect to user auth and fetch from localStorage/Firestore
  const userId = 'current-user';
  const [gearItems, setGearItems] = useState([]);
  const [showWizard, setShowWizard] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);

  // Group items by activity
  const groupedByActivity = getAllActivities().map((activity) => ({
    activity,
    items: gearItems.filter((item) => item.activityId === activity.id),
  }));

  const activeGroups = groupedByActivity.filter((group) => group.items.length > 0);

  const handleAddGear = () => {
    setEditingItemId(null);
    setShowWizard(true);
  };

  const handleSaveGear = (newItem) => {
    // TODO: Save to localStorage or Firestore
    setGearItems((prev) => {
      if (editingItemId) {
        return prev.map((item) => (item.id === editingItemId ? newItem : item));
      }
      return [newItem, ...prev];
    });
    setShowWizard(false);
  };

  const handleEditGear = (item) => {
    setEditingItemId(item.id);
    setShowWizard(true);
  };

  const handleRemoveGear = (itemId) => {
    if (
      window.confirm(
        'Remove this gear from your collection? This action cannot be undone.'
      )
    ) {
      setGearItems((prev) => prev.filter((item) => item.id !== itemId));
    }
  };

  if (showWizard) {
    return (
      <div className="profile-gear-wizard-container">
        <GearAddWizard
          userId={userId}
          userGearItems={gearItems}
          onSave={handleSaveGear}
          onCancel={() => setShowWizard(false)}
        />
      </div>
    );
  }

  return (
    <section className="screen-scroll profile-gear-page" aria-label="My Gear">
      <header className="profile-gear-header">
        <button
          type="button"
          onClick={() => navigate('/profile')}
          aria-label="Back to profile"
          className="profile-gear-header__back"
        >
          <ChevronLeft size={20} strokeWidth={1.8} />
        </button>
        <div className="profile-gear-header__title">
          <h1>My Gear</h1>
          <p>Manage your equipment collection</p>
        </div>
        <button
          type="button"
          onClick={handleAddGear}
          className="profile-gear-header__add"
          aria-label="Add gear"
        >
          <Plus size={20} strokeWidth={1.8} />
        </button>
      </header>

      {activeGroups.length === 0 ? (
        <section className="profile-gear-empty">
          <h2>No gear yet</h2>
          <p>Start building your gear collection by adding equipment for your activities.</p>
          <button
            type="button"
            onClick={handleAddGear}
            className="profile-gear-empty__button"
          >
            Add your first gear
          </button>
        </section>
      ) : (
        <section className="profile-gear-list">
          {activeGroups.map(({ activity, items }) => (
            <section
              key={activity.id}
              className="profile-gear-group"
            >
              <header className="profile-gear-group__header">
                <div>
                  <h2>{activity.label}</h2>
                  <p>
                    {items.length}
                    {' '}
                    {items.length === 1 ? 'item' : 'items'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddGear}
                  className="profile-gear-group__add"
                  aria-label={`Add ${activity.label} gear`}
                >
                  <Plus size={16} strokeWidth={1.8} />
                </button>
              </header>

              <div className="profile-gear-group__items">
                {items.map((item) => (
                  <GearItemCard
                    key={item.id}
                    item={item}
                    onEdit={() => handleEditGear(item)}
                    onRemove={() => handleRemoveGear(item.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </section>
      )}

      <section className="profile-gear-info">
        <h3>About your gear collection</h3>
        <ul className="profile-gear-info__list">
          <li>Your gear is private and only visible to you</li>
          <li>You can optionally show gear on your public profile</li>
          <li>When you go live, you can select which gear you're using</li>
          <li>Add photos and links to product pages for reference</li>
        </ul>
      </section>
    </section>
  );
}

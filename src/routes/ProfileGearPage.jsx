import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import GearAddWizard from '../components/gear/GearAddWizard';
import GearItemCard from '../components/gear/GearItemCard';
import {
  getAllActivities,
  getCreatorGearItems,
  saveCreatorGearItem,
  deleteCreatorGearItem,
} from '../services/gearService';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles/profile-gear-page.css';

/**
 * Profile page for managing user's gear collection
 * Displays gear grouped by activity with ability to add, edit, remove items
 */
export default function ProfileGearPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.uid;
  const [gearItems, setGearItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showWizard, setShowWizard] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);

  useEffect(() => {
    let active = true;
    if (!userId) return () => { active = false; };
    getCreatorGearItems(userId)
      .then((items) => { if (active) setGearItems(items); })
      .catch(() => { if (active) setError(t('gearManager.loadError')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, t]);

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

  const handleSaveGear = async (newItem) => {
    const existing = editingItemId ? gearItems.find((item) => item.id === editingItemId) : null;
    const item = {
      ...newItem,
      id: existing?.id ?? newItem.id,
      userId,
      createdAt: existing?.createdAt ?? newItem.createdAt,
    };
    try {
      setError('');
      await saveCreatorGearItem(item);
      setGearItems((previous) => existing
        ? previous.map((current) => current.id === existing.id ? item : current)
        : [item, ...previous]);
      setShowWizard(false);
    } catch {
      setError(t('gearManager.saveError'));
    }
  };

  const handleEditGear = (item) => {
    setEditingItemId(item.id);
    setShowWizard(true);
  };

  const handleRemoveGear = async (itemId) => {
    if (!window.confirm(t('gearManager.removeConfirm'))) return;
    try {
      await deleteCreatorGearItem(itemId);
      setGearItems((previous) => previous.filter((item) => item.id !== itemId));
    } catch {
      setError(t('gearManager.removeError'));
    }
  };

  if (showWizard) {
    return createPortal((
      <div className="profile-gear-wizard-container">
        {error ? <p className="profile-gear-error" role="alert">{error}</p> : null}
        <GearAddWizard
          userId={userId}
          userGearItems={gearItems}
          onSave={handleSaveGear}
          onCancel={() => setShowWizard(false)}
          initialItem={gearItems.find((item) => item.id === editingItemId) ?? null}
        />
      </div>
    ), document.body);
  }

  return (
    <section className="screen-scroll profile-gear-page" aria-label={t('gearManager.title')}>
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
          <h1>{t('gearManager.title')}</h1>
          <p>{t('gearManager.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={handleAddGear}
          className="profile-gear-header__add"
          aria-label={t('gearManager.addGear')}
        >
          <Plus size={20} strokeWidth={1.8} />
        </button>
      </header>

      {error ? <p className="profile-gear-error" role="alert">{error}</p> : null}
      {loading ? (
        <section className="profile-gear-empty"><p>{t('gearManager.loading')}</p></section>
      ) : activeGroups.length === 0 ? (
        <section className="profile-gear-empty">
          <h2>{t('gearManager.emptyTitle')}</h2>
          <p>{t('gearManager.emptyBody')}</p>
          <button
            type="button"
            onClick={handleAddGear}
            className="profile-gear-empty__button"
          >
            {t('gearManager.addFirst')}
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
                  <h2>{t(`gearManager.activities.${activity.id}`, { defaultValue: activity.label })}</h2>
                  <p>
                    {t('gearManager.itemCount', { count: items.length })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddGear}
                  className="profile-gear-group__add"
                  aria-label={t('gearManager.addActivityGear', { activity: t(`gearManager.activities.${activity.id}`, { defaultValue: activity.label }) })}
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
        <h3>{t('gearManager.aboutTitle')}</h3>
        <ul className="profile-gear-info__list">
          <li>{t('gearManager.aboutPrivate')}</li>
          <li>{t('gearManager.aboutPublic')}</li>
          <li>{t('gearManager.aboutLive')}</li>
          <li>{t('gearManager.aboutLinks')}</li>
        </ul>
      </section>
    </section>
  );
}

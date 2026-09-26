import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIVITY_CATEGORIES } from '../data/activityCategories.js';
import { scheduleStream } from '../services/streamApi.ts';

function minDateTimeLocal() {
  const d = new Date(Date.now() + 10 * 60 * 1000);
  return d.toISOString().slice(0, 16);
}

export default function ScheduleLiveSheet({ existingLive, onClose, onScheduled, onCancel }) {
  const { t } = useTranslation();
  const ENVIRONMENTS = [
    { id: 'land', label: t('scheduleLive.environments.land') },
    { id: 'water', label: t('scheduleLive.environments.water') },
    { id: 'air', label: t('scheduleLive.environments.air') },
    { id: 'urban', label: t('scheduleLive.environments.urban') },
    { id: 'other', label: t('scheduleLive.environments.other') },
  ];
  const VISIBILITIES = [
    { id: 'public', label: t('scheduleLive.visibilities.public') },
    { id: 'followers', label: t('scheduleLive.visibilities.followers') },
    { id: 'private', label: t('scheduleLive.visibilities.private') },
  ];
  const [title, setTitle] = useState('');
  const [datetime, setDatetime] = useState('');
  const [category, setCategory] = useState('outdoor');
  const [environment, setEnvironment] = useState('land');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { setError(t('scheduleLive.errors.titleRequired')); return; }
    if (!datetime) { setError(t('scheduleLive.errors.datetimeRequired')); return; }

    const scheduledDate = new Date(datetime);
    if (scheduledDate.getTime() < Date.now() + 5 * 60 * 1000) {
      setError(t('scheduleLive.errors.tooSoon'));
      return;
    }

    setError('');
    setLoading(true);
    try {
      await scheduleStream({
        title: title.trim(),
        scheduledStartAt: scheduledDate.toISOString(),
        category,
        environment,
        description: description.trim() || undefined,
        city: city.trim() || undefined,
        visibility,
      });
      onScheduled?.();
      onClose();
    } catch (err) {
      setError(err.message || t('scheduleLive.errors.scheduleFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-sheet" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="create-sheet__panel schedule-sheet">
        <div className="create-sheet__header">
          <strong>{existingLive ? t('scheduleLive.editTitle') : t('scheduleLive.title')}</strong>
          <button type="button" onClick={onClose} aria-label={t('common.close')}>
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <form className="schedule-sheet__form" onSubmit={handleSubmit}>
          <div className="schedule-sheet__field">
            <label className="schedule-sheet__label">{t('scheduleLive.fields.title')}</label>
            <input
              className="schedule-sheet__input"
              type="text"
              placeholder={t('scheduleLive.fields.titlePlaceholder')}
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="schedule-sheet__field">
            <label className="schedule-sheet__label">{t('scheduleLive.fields.datetime')}</label>
            <input
              className="schedule-sheet__input"
              type="datetime-local"
              min={minDateTimeLocal()}
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
            />
          </div>

          <div className="schedule-sheet__field">
            <label className="schedule-sheet__label">{t('scheduleLive.fields.category')}</label>
            <div className="schedule-sheet__chips">
              {ACTIVITY_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`schedule-sheet__chip${category === cat.id ? ' is-active' : ''}`}
                  onClick={() => setCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="schedule-sheet__field">
            <label className="schedule-sheet__label">{t('scheduleLive.fields.environment')}</label>
            <div className="schedule-sheet__chips">
              {ENVIRONMENTS.map((env) => (
                <button
                  key={env.id}
                  type="button"
                  className={`schedule-sheet__chip${environment === env.id ? ' is-active' : ''}`}
                  onClick={() => setEnvironment(env.id)}
                >
                  {env.label}
                </button>
              ))}
            </div>
          </div>

          <div className="schedule-sheet__field">
            <label className="schedule-sheet__label">{t('scheduleLive.fields.city')} <span className="schedule-sheet__optional">{t('scheduleLive.optional')}</span></label>
            <input
              className="schedule-sheet__input"
              type="text"
              placeholder={t('scheduleLive.fields.cityPlaceholder')}
              maxLength={80}
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>

          <div className="schedule-sheet__field">
            <label className="schedule-sheet__label">{t('scheduleLive.fields.description')} <span className="schedule-sheet__optional">{t('scheduleLive.optional')}</span></label>
            <textarea
              className="schedule-sheet__input schedule-sheet__textarea"
              placeholder={t('scheduleLive.fields.descriptionPlaceholder')}
              maxLength={500}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="schedule-sheet__field">
            <label className="schedule-sheet__label">{t('scheduleLive.fields.visibility')}</label>
            <div className="schedule-sheet__chips">
              {VISIBILITIES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={`schedule-sheet__chip${visibility === v.id ? ' is-active' : ''}`}
                  onClick={() => setVisibility(v.id)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {error ? <p className="schedule-sheet__error">{error}</p> : null}

          <button
            type="submit"
            className="schedule-sheet__submit"
            disabled={loading || cancelling}
          >
            {loading ? t('scheduleLive.scheduling') : existingLive ? t('scheduleLive.saveChanges') : t('scheduleLive.scheduleLive')}
          </button>

          {existingLive && onCancel && (
            <button
              type="button"
              className="schedule-sheet__cancel-live"
              disabled={cancelling || loading}
              onClick={async () => {
                setCancelling(true);
                try { await onCancel(existingLive.id); } finally { setCancelling(false); }
              }}
            >
              <Trash2 size={15} strokeWidth={2} />
              {cancelling ? t('scheduleLive.cancelling') : t('scheduleLive.cancelLive')}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

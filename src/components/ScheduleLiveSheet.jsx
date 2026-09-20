import { useState } from 'react';
import { X } from 'lucide-react';
import { ACTIVITY_CATEGORIES } from '../data/activityCategories.js';
import { scheduleStream } from '../services/streamApi.ts';

const ENVIRONMENTS = [
  { id: 'land', label: 'Land' },
  { id: 'water', label: 'Water' },
  { id: 'air', label: 'Air' },
  { id: 'urban', label: 'Urban' },
  { id: 'other', label: 'Other' },
];

const VISIBILITIES = [
  { id: 'public', label: 'Public' },
  { id: 'followers', label: 'Followers' },
  { id: 'private', label: 'Private' },
];

function minDateTimeLocal() {
  const d = new Date(Date.now() + 10 * 60 * 1000);
  return d.toISOString().slice(0, 16);
}

export default function ScheduleLiveSheet({ onClose, onScheduled }) {
  const [title, setTitle] = useState('');
  const [datetime, setDatetime] = useState('');
  const [category, setCategory] = useState('outdoor');
  const [environment, setEnvironment] = useState('land');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required'); return; }
    if (!datetime) { setError('Date and time are required'); return; }

    const scheduledDate = new Date(datetime);
    if (scheduledDate.getTime() < Date.now() + 5 * 60 * 1000) {
      setError('Must be at least 5 minutes from now');
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
      setError(err.message || 'Failed to schedule live');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-sheet" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="create-sheet__panel schedule-sheet">
        <div className="create-sheet__header">
          <strong>Schedule a live</strong>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <form className="schedule-sheet__form" onSubmit={handleSubmit}>
          <div className="schedule-sheet__field">
            <label className="schedule-sheet__label">Title</label>
            <input
              className="schedule-sheet__input"
              type="text"
              placeholder="What are you doing?"
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="schedule-sheet__field">
            <label className="schedule-sheet__label">Date & time</label>
            <input
              className="schedule-sheet__input"
              type="datetime-local"
              min={minDateTimeLocal()}
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
            />
          </div>

          <div className="schedule-sheet__field">
            <label className="schedule-sheet__label">Category</label>
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
            <label className="schedule-sheet__label">Environment</label>
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
            <label className="schedule-sheet__label">City <span className="schedule-sheet__optional">optional</span></label>
            <input
              className="schedule-sheet__input"
              type="text"
              placeholder="Paris, Tokyo…"
              maxLength={80}
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>

          <div className="schedule-sheet__field">
            <label className="schedule-sheet__label">Description <span className="schedule-sheet__optional">optional</span></label>
            <textarea
              className="schedule-sheet__input schedule-sheet__textarea"
              placeholder="Tell viewers what to expect…"
              maxLength={500}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="schedule-sheet__field">
            <label className="schedule-sheet__label">Visibility</label>
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
            disabled={loading}
          >
            {loading ? 'Scheduling…' : 'Schedule live'}
          </button>
        </form>
      </div>
    </div>
  );
}

import { Bell, BellOff, CalendarClock, ChevronLeft, MapPin, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { upcomingStreams } from '../data/mockStreams.js';
import { getCountdownState, makeCountdownLabels } from '../utils/countdown.js';
import { getUpcomingReminders, removeUpcomingReminder, saveUpcomingReminder } from '../services/upcomingReminderService.js';

const fallbackImage = '/assets/icons/icon-512.png';

function matchesSearch(item, query) {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  return [item.title, item.creatorName, item.locationLabel, item.category, item.description]
    .some((f) => String(f ?? '').toLowerCase().includes(q));
}

function UpcomingCard({ item, onOpen, onRemind, reminded }) {
  const { t } = useTranslation();
  const cLabels = makeCountdownLabels(t);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const countdown = item.startsAt ? getCountdownState(item.startsAt, now, cLabels) : null;
  const dateLabel = item.day === 'TODAY'
    ? t('explore.dateToday', { time: item.time })
    : t('explore.dateTomorrow', { time: item.time });

  return (
    <article
      className="ep-upcoming-card"
      onClick={() => onOpen(item)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(item);
        }
      }}
      role="button"
      tabIndex={0}
      style={{ cursor: 'pointer' }}
    >
      <div className="ep-upcoming-card__media">
        <img
          src={item.image ?? fallbackImage}
          alt={item.title}
          loading="lazy"
          onError={(e) => { e.currentTarget.src = fallbackImage; }}
        />
        <span className="ep-upcoming-card__badge">{t('explore.upcomingBadge')}</span>
      </div>
      <div className="ep-upcoming-card__info">
        <p className="ep-upcoming-card__title">{item.title}</p>
        {countdown ? (
          <div style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: 'rgba(242,247,246,0.6)', textTransform: 'uppercase', fontWeight: 600 }}>
              {countdown.label}
            </span>
            {countdown.value && (
              <strong style={{ display: 'block', fontSize: 16, color: 'var(--color-accent)', fontWeight: 700 }}>
                {countdown.value}
              </strong>
            )}
          </div>
        ) : (
          <span className="ep-upcoming-card__time">{dateLabel}</span>
        )}
        {item.locationLabel ? (
          <span className="ep-upcoming-card__loc">
            <MapPin size={10} strokeWidth={1.8} />
            {item.locationLabel}
          </span>
        ) : null}
        <button
          type="button"
          className={reminded ? 'ep-upcoming-card__notify is-set' : 'ep-upcoming-card__notify'}
          onClick={(e) => {
            e.stopPropagation();
            onRemind(item);
          }}
          aria-label={reminded ? t('explore.reminderSet') : t('explore.setReminder')}
        >
          {reminded ? t('explore.reminderOn') : t('explore.remindMe')}
        </button>
      </div>
    </article>
  );
}

function DetailSheet({ item, onClose, onRemind, reminded }) {
  const { t } = useTranslation();
  const cLabels = makeCountdownLabels(t);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const countdown = item.startsAt ? getCountdownState(item.startsAt, now, cLabels) : null;
  const startsAt = item.startsAt ? new Date(item.startsAt) : null;
  const isLive = startsAt ? startsAt <= now : false;
  const dateLabel = startsAt
    ? startsAt.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    : item.day === 'TODAY'
      ? t('explore.dateToday', { time: item.time })
      : t('explore.dateTomorrow', { time: item.time });
  const place = item.locationLabel ?? t('explore.locationTbc');
  const interested = typeof item.interestedCount === 'number'
    ? (item.interestedCount + (reminded ? 1 : 0)).toLocaleString()
    : '';

  return (
    <div className="home-upcoming-sheet" role="dialog" aria-modal="true" aria-label={t('explore.detailsFor', { title: item.title })}>
      <button type="button" className="home-upcoming-sheet__backdrop" onClick={onClose} aria-label={t('explore.close')} />
      <section className="home-upcoming-sheet__panel">
        <header>
          <div>
            <span className={isLive ? 'home-upcoming-badge home-upcoming-badge--live' : 'home-upcoming-badge'}>
              {isLive ? t('explore.liveNow') : t('explore.upcomingBadge')}
            </span>
            <h2>{item.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t('explore.close')}>
            <X size={18} strokeWidth={1.9} />
          </button>
        </header>
        <img src={item.image ?? fallbackImage} alt={item.title} loading="lazy" decoding="async" />
        <div className="home-upcoming-sheet__meta">
          <p><MapPin size={15} strokeWidth={1.9} /> {place}</p>
          <p><CalendarClock size={15} strokeWidth={1.9} /> {dateLabel}</p>
          {interested ? (
            <p style={{ fontSize: 13, color: 'rgba(242,247,246,0.6)' }}>
              {t('explore.interestedCount', { count: interested })}
            </p>
          ) : null}
        </div>
        {countdown ? (
          <div className="home-countdown home-countdown--sheet" aria-label={countdown.ariaLabel}>
            <span>{countdown.label}</span>
            {countdown.value ? <strong>{countdown.value}</strong> : null}
          </div>
        ) : null}
        <p className="home-upcoming-sheet__description">{item.description ?? t('explore.detailsBeforeLive')}</p>
        <div className="home-upcoming-sheet__actions">
          <button
            type="button"
            className={reminded ? 'is-active' : ''}
            onClick={() => onRemind(item)}
          >
            {reminded ? <BellOff size={15} strokeWidth={1.8} /> : <Bell size={15} strokeWidth={1.9} />}
            {reminded ? t('explore.reminderOn') : t('common.notifyMe')}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function AllUpcomingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const searchRef = useRef(null);
  const [search, setSearch] = useState('');
  const [openItem, setOpenItem] = useState(() => upcomingStreams.find((item) => item.id === searchParams.get('live')) ?? null);
  const [remindedIds, setRemindedIds] = useState(() => new Set(Object.keys(getUpcomingReminders())));

  const filtered = useMemo(() => {
    return upcomingStreams.filter((s) => matchesSearch(s, search));
  }, [search]);

  const hasSearch = search.trim().length > 0;

  const handleRemind = (item) => {
    const next = !remindedIds.has(item.id);
    if (next) {
      saveUpcomingReminder(item).catch(() => {
        setRemindedIds((current) => {
          const updated = new Set(current);
          updated.delete(item.id);
          return updated;
        });
      });
    } else {
      removeUpcomingReminder(item.id);
    }
    setRemindedIds((prev) => {
      const s = new Set(prev);
      if (next) s.add(item.id); else s.delete(item.id);
      return s;
    });
  };

  return (
    <section className="screen-scroll alp-screen" aria-label={t('explore.sectionUpcoming')}>
      <header className="alp-header">
        <button type="button" className="alp-header__back" onClick={() => navigate(-1)} aria-label={t('common.back')}>
          <ChevronLeft size={20} strokeWidth={2} />
        </button>
        <h1 className="alp-header__title">{t('explore.sectionUpcoming')}</h1>
      </header>

      <div className="alp-search-wrap">
        <div className="alp-search">
          <Search size={15} strokeWidth={1.9} />
          <input
            ref={searchRef}
            type="search"
            placeholder={t('allLives.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {hasSearch ? (
            <button type="button" onClick={() => setSearch('')} aria-label={t('allLives.clearSearch')}>
              <X size={14} strokeWidth={2} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="alp-count">
        {filtered.length === 1
          ? t('allLives.perspectiveCount_one', { count: filtered.length })
          : t('allLives.perspectiveCount_other', { count: filtered.length })}
      </div>

      {filtered.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, padding: '0 16px 80px' }}>
          {filtered.map((item) => (
            <UpcomingCard
              key={item.id}
              item={item}
              onOpen={setOpenItem}
              onRemind={handleRemind}
              reminded={remindedIds.has(item.id)}
            />
          ))}
        </div>
      ) : (
        <div className="alp-empty">
          <strong>{t('allLives.empty.title')}</strong>
          <p>{t('allLives.empty.body')}</p>
          <button type="button" onClick={() => setSearch('')}>{t('allLives.empty.reset')}</button>
        </div>
      )}

      {openItem ? (
        <DetailSheet
          item={openItem}
          onClose={() => setOpenItem(null)}
          onRemind={handleRemind}
          reminded={remindedIds.has(openItem.id)}
        />
      ) : null}
    </section>
  );
}

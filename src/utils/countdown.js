const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function pad(value) {
  return String(value).padStart(2, '0');
}

export function makeCountdownLabels(t) {
  return {
    dateUnavailable: t('countdown.dateUnavailable'),
    startDateUnavailable: t('countdown.startDateUnavailable'),
    liveNow: t('countdown.liveNow'),
    startingSoon: t('countdown.startingSoon'),
    startingIn: t('countdown.startingIn'),
    startsIn: t('countdown.startsIn'),
    day: t('countdown.day'),
    days: t('countdown.days'),
    today: t('countdown.today'),
    tomorrow: t('countdown.tomorrow'),
  };
}

export function toValidDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const DEFAULT_LABELS = {
  dateUnavailable: 'Date unavailable',
  startDateUnavailable: 'Start date unavailable',
  liveNow: 'Live now',
  startingSoon: 'Starting soon',
  startingIn: 'Starting in',
  startsIn: 'Starts in',
  day: 'day',
  days: 'days',
  today: 'Today',
  tomorrow: 'Tomorrow',
};

export function getCountdownState(startsAt, now = new Date(), labels = {}) {
  const L = { ...DEFAULT_LABELS, ...labels };
  const start = toValidDate(startsAt);

  if (!start) {
    return {
      phase: 'invalid',
      label: L.dateUnavailable,
      value: '',
      ariaLabel: L.startDateUnavailable,
      isLive: false,
      isStartingSoon: false,
    };
  }

  const remaining = start.getTime() - now.getTime();

  if (remaining <= 0) {
    return {
      phase: 'live',
      label: L.liveNow,
      value: '',
      ariaLabel: L.liveNow,
      isLive: true,
      isStartingSoon: false,
    };
  }

  if (remaining < MINUTE) {
    return {
      phase: 'soon',
      label: L.startingSoon,
      value: '',
      ariaLabel: L.startingSoon,
      isLive: false,
      isStartingSoon: true,
    };
  }

  const totalSeconds = Math.floor(remaining / SECOND);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);

  if (remaining < 10 * MINUTE) {
    const value = `${pad(totalMinutes)}:${pad(seconds)}`;
    return {
      phase: 'soon',
      label: L.startingIn,
      value,
      ariaLabel: `${L.startingIn} ${totalMinutes} ${totalMinutes === 1 ? L.day : L.days}`,
      isLive: false,
      isStartingSoon: true,
    };
  }

  if (remaining < HOUR) {
    const value = `${pad(totalMinutes)}:${pad(seconds)}`;
    return {
      phase: 'hour',
      label: L.startsIn,
      value,
      ariaLabel: `${L.startsIn} ${totalMinutes} min`,
      isLive: false,
      isStartingSoon: false,
    };
  }

  if (remaining < DAY) {
    const value = `${pad(totalHours)}:${pad(minutes)}:${pad(seconds)}`;
    return {
      phase: 'today',
      label: L.startsIn,
      value,
      ariaLabel: `${L.startsIn} ${totalHours}h${pad(minutes)}`,
      isLive: false,
      isStartingSoon: false,
    };
  }

  const days = Math.ceil(remaining / DAY);
  return {
    phase: 'days',
    label: L.startsIn,
    value: `${days} ${days === 1 ? L.day : L.days}`,
    ariaLabel: `${L.startsIn} ${days} ${days === 1 ? L.day : L.days}`,
    isLive: false,
    isStartingSoon: false,
  };
}

export function formatLocalSchedule(startsAt, language = 'en', labels = {}) {
  const L = { ...DEFAULT_LABELS, ...labels };
  const start = toValidDate(startsAt);
  if (!start) return L.dateUnavailable;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const dayDifference = Math.round((startDay.getTime() - today.getTime()) / DAY);
  const time = new Intl.DateTimeFormat(language, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(start);

  if (dayDifference === 0) return `${L.today} · ${time}`;
  if (dayDifference === 1) return `${L.tomorrow} · ${time}`;

  const weekday = new Intl.DateTimeFormat(language, { weekday: 'short' }).format(start);
  return `${weekday} · ${time}`;
}

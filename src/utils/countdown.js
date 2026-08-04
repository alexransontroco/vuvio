const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function pad(value) {
  return String(value).padStart(2, '0');
}

export function toValidDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getCountdownState(startsAt, now = new Date()) {
  const start = toValidDate(startsAt);

  if (!start) {
    return {
      phase: 'invalid',
      label: 'Date unavailable',
      value: '',
      ariaLabel: 'Start date unavailable',
      isLive: false,
      isStartingSoon: false,
    };
  }

  const remaining = start.getTime() - now.getTime();

  if (remaining <= 0) {
    return {
      phase: 'live',
      label: 'Live now',
      value: '',
      ariaLabel: 'Live now',
      isLive: true,
      isStartingSoon: false,
    };
  }

  if (remaining < MINUTE) {
    return {
      phase: 'soon',
      label: 'Starting soon',
      value: '',
      ariaLabel: 'Starting soon',
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
      label: 'Starting in',
      value,
      ariaLabel: `Starting in ${totalMinutes} minutes`,
      isLive: false,
      isStartingSoon: true,
    };
  }

  if (remaining < HOUR) {
    const value = `${pad(totalMinutes)}:${pad(seconds)}`;
    return {
      phase: 'hour',
      label: 'Starts in',
      value,
      ariaLabel: `Starts in ${totalMinutes} minutes`,
      isLive: false,
      isStartingSoon: false,
    };
  }

  if (remaining < DAY) {
    const value = `${pad(totalHours)}:${pad(minutes)}:${pad(seconds)}`;
    return {
      phase: 'today',
      label: 'Starts in',
      value,
      ariaLabel: `Starts in ${totalHours} hours and ${minutes} minutes`,
      isLive: false,
      isStartingSoon: false,
    };
  }

  const days = Math.ceil(remaining / DAY);
  return {
    phase: 'days',
    label: 'Starts in',
    value: `${days} ${days === 1 ? 'day' : 'days'}`,
    ariaLabel: `Starts in ${days} ${days === 1 ? 'day' : 'days'}`,
    isLive: false,
    isStartingSoon: false,
  };
}

export function formatLocalSchedule(startsAt, language = 'en') {
  const start = toValidDate(startsAt);
  if (!start) return 'Date unavailable';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const dayDifference = Math.round((startDay.getTime() - today.getTime()) / DAY);
  const time = new Intl.DateTimeFormat(language, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(start);

  if (dayDifference === 0) return `Today · ${time}`;
  if (dayDifference === 1) return `Tomorrow · ${time}`;

  const weekday = new Intl.DateTimeFormat(language, { weekday: 'short' }).format(start);
  return `${weekday} · ${time}`;
}

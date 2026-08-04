const STORAGE_KEY = 'vuvio-upcoming-reminders';

function safeWindow() {
  return typeof window === 'undefined' ? null : window;
}

function readReminderMap() {
  const win = safeWindow();
  if (!win) return {};

  try {
    return JSON.parse(win.localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function writeReminderMap(reminders) {
  const win = safeWindow();
  if (!win) return;
  win.localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
}

export function getUpcomingReminders() {
  return readReminderMap();
}

export function hasUpcomingReminder(liveId) {
  return Boolean(readReminderMap()[liveId]);
}

export function saveUpcomingReminder(live) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const reminders = readReminderMap();
        reminders[live.id] = {
          liveId: live.id,
          startsAt: live.startsAt,
          createdAt: new Date().toISOString(),
          status: 'active',
        };
        writeReminderMap(reminders);
        resolve(reminders[live.id]);
      } catch (error) {
        reject(error);
      }
    }, 260);
  });
}

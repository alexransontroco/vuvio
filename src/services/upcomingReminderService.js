const STORAGE_KEY = 'vuvio-upcoming-reminders';

function safeWindow() {
  return typeof window === 'undefined' ? null : window;
}

function readReminderMap() {
  const win = safeWindow();
  if (!win) return {};

  try {
    const reminders = JSON.parse(win.localStorage.getItem(STORAGE_KEY) ?? '{}');
    return reminders && typeof reminders === 'object' && !Array.isArray(reminders) ? reminders : {};
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

export function removeUpcomingReminder(liveId) {
  const reminders = readReminderMap();
  delete reminders[liveId];
  writeReminderMap(reminders);
}

export function hasUpcomingReminder(liveId) {
  return Boolean(readReminderMap()[liveId]);
}

export function saveUpcomingReminder(live) {
  return new Promise((resolve, reject) => {
    try {
      const reminders = readReminderMap();
      reminders[live.id] = {
        liveId: live.id,
        startsAt: live.startsAt,
        createdAt: new Date().toISOString(),
        status: 'active',
      };
      writeReminderMap(reminders);
      setTimeout(() => resolve(reminders[live.id]), 260);
    } catch (error) {
      reject(error);
    }
  });
}

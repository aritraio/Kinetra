export interface ReminderItem {
  id: string;
  title: string;
  time: string; // HH:mm in 24h format
  enabled: boolean;
  action: string;
}

export interface ReminderPreferences {
  reminders: ReminderItem[];
  timezone: string;
  lastCheckedAt: string; // ISO string
}

export const REMINDERS_STORAGE_KEY = 'kinetra_reminders_preferences';

export const DEFAULT_REMINDERS: ReminderItem[] = [
  {
    id: 'weigh_in',
    title: 'Morning Weigh-in',
    time: '08:00',
    enabled: true,
    action: "Record today's morning weight",
  },
  {
    id: 'workout',
    title: 'Workout Session',
    time: '17:30',
    enabled: true,
    action: 'Begin scheduled training workout',
  },
  {
    id: 'evening_nutrition',
    title: 'Evening Nutrition Check',
    time: '20:30',
    enabled: true,
    action: 'Record remaining daily calories & review macros',
  },
];

let inMemoryPrefs: ReminderPreferences | null = null;

export function getReminderPreferences(): ReminderPreferences {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(REMINDERS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.reminders)) {
          return parsed as ReminderPreferences;
        }
      }
    }
  } catch {
    // Fallback
  }

  if (inMemoryPrefs) return inMemoryPrefs;

  const defaultTz =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
      : 'Asia/Kolkata';

  return {
    reminders: DEFAULT_REMINDERS,
    timezone: defaultTz,
    lastCheckedAt: new Date().toISOString(),
  };
}

export function saveReminderPreferences(prefs: ReminderPreferences): void {
  inMemoryPrefs = prefs;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(prefs));
    }
  } catch {
    // Ignore storage errors
  }
}

export interface MissedReminder {
  id: string;
  title: string;
  scheduledTime: string;
  action: string;
  missedAt: string;
}

/**
 * Checks whether any enabled scheduled reminders were missed between lastCheckedAt and current time.
 */
export function checkMissedReminders(now: Date = new Date()): {
  missed: MissedReminder[];
  nextPreferences: ReminderPreferences;
} {
  const prefs = getReminderPreferences();
  const lastChecked = new Date(prefs.lastCheckedAt);
  const missed: MissedReminder[] = [];

  // Parse current local time in timezone
  const tf = new Intl.DateTimeFormat('en-GB', {
    timeZone: prefs.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const nowTimeParts = tf.format(now).split(':');
  const nowMinutes =
    parseInt(nowTimeParts[0] || '0', 10) * 60 + parseInt(nowTimeParts[1] || '0', 10);

  const lastTimeParts = tf.format(lastChecked).split(':');
  const lastMinutes =
    parseInt(lastTimeParts[0] || '0', 10) * 60 + parseInt(lastTimeParts[1] || '0', 10);

  // Check window if checked on the same day, or if substantial time passed
  const isSameDay = now.toDateString() === lastChecked.toDateString();

  for (const reminder of prefs.reminders) {
    if (!reminder.enabled) continue;

    const [rHour, rMin] = reminder.time.split(':').map((n) => parseInt(n, 10));
    const reminderMinutes = (rHour || 0) * 60 + (rMin || 0);

    // If same day: reminder was scheduled after lastChecked and before/at now
    if (isSameDay) {
      if (lastMinutes < reminderMinutes && reminderMinutes <= nowMinutes) {
        missed.push({
          id: reminder.id,
          title: reminder.title,
          scheduledTime: reminder.time,
          action: reminder.action,
          missedAt: now.toISOString(),
        });
      }
    } else {
      // Day transition: if reminder has passed today
      if (reminderMinutes <= nowMinutes) {
        missed.push({
          id: reminder.id,
          title: reminder.title,
          scheduledTime: reminder.time,
          action: reminder.action,
          missedAt: now.toISOString(),
        });
      }
    }
  }

  const nextPreferences: ReminderPreferences = {
    ...prefs,
    lastCheckedAt: now.toISOString(),
  };
  saveReminderPreferences(nextPreferences);

  return { missed, nextPreferences };
}

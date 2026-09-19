// Small shared live-query hooks built on Dexie's liveQuery (via
// dexie-react-hooks), which re-run automatically whenever a table read
// inside the callback changes. Keeps screens free of manual refresh logic.
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/index.js';
import { buildQueue } from '../actions/reminders.js';
import { getSettingsMap } from '../actions/settings.js';

export function usePendingReminderCount() {
  return useLiveQuery(async () => {
    const { rows } = await buildQueue();
    return rows.length;
  }, [], 0);
}

export function useOperator() {
  return useLiveQuery(() => db.operator.get('self'), [], null);
}

export function useSettingsMap() {
  return useLiveQuery(() => getSettingsMap(), [], null);
}

export function usePickupPoints() {
  return useLiveQuery(() => db.pickup_points.toArray(), [], []);
}

export function useStudents() {
  return useLiveQuery(() => db.students.toArray(), [], []);
}

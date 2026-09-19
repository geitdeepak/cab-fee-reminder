// Section 9: the single highest-risk area of the design. All data lives on
// one device, so backup/restore correctness matters more than almost
// anything else in this codebase.
import { SCHEMA_VERSION } from '../db/db.js';

const TABLES = [
  'operator',
  'pickup_points',
  'students',
  'fee_plans',
  'enrolments',
  'invoices',
  'payments',
  'reminder_log',
  'templates',
  'settings',
  'meta'
];

const PRE_RESTORE_KEY = 'cabfee_pre_restore_snapshot';

export async function getRecordCounts(db) {
  const counts = {};
  for (const t of TABLES) counts[t] = await db[t].count();
  return counts;
}

export async function buildBackupPayload(db) {
  const data = {};
  for (const t of TABLES) data[t] = await db[t].toArray();
  return {
    schema_version: SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    data
  };
}

export function backupFileName(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `cabfee-backup-${y}-${m}-${d}-${hh}${mm}.json`;
}

export async function exportBackup(db) {
  const payload = await buildBackupPayload(db);
  const json = JSON.stringify(payload, null, 0);
  const blob = new Blob([json], { type: 'application/json' });
  const filename = backupFileName();

  if (navigator.share && navigator.canShare) {
    const file = new File([blob], filename, { type: 'application/json' });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Cab Fee backup' });
      return { method: 'share', filename };
    }
  }
  // Fallback: direct download (9.3).
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { method: 'download', filename };
}

export function parseBackupFile(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || !parsed.data) {
    throw new Error('This file is not a Cab Fee Reminder backup.');
  }
  if (typeof parsed.schema_version !== 'number' || parsed.schema_version > SCHEMA_VERSION) {
    throw new Error('This backup was made by a newer version of the app and cannot be restored here.');
  }
  return parsed;
}

export function incomingCounts(parsed) {
  const counts = {};
  for (const t of TABLES) counts[t] = Array.isArray(parsed.data[t]) ? parsed.data[t].length : 0;
  return counts;
}

/** Snapshot the current database into localStorage before a restore, kept
 * for 24 hours, so a bad restore can be undone (9.4, point 20). */
export async function savePreRestoreSnapshot(db) {
  try {
    const payload = await buildBackupPayload(db);
    localStorage.setItem(PRE_RESTORE_KEY, JSON.stringify({ savedAt: Date.now(), payload }));
  } catch {
    // Snapshot is best-effort; a quota failure must never block the restore itself.
  }
}

export function getPreRestoreSnapshot() {
  try {
    const raw = localStorage.getItem(PRE_RESTORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPreRestoreSnapshot() {
  try {
    localStorage.removeItem(PRE_RESTORE_KEY);
  } catch {
    // Ignore.
  }
}

/** Transactional restore: on any failure, Dexie rolls the whole transaction
 * back and the original database is left intact (9.4, point 19). */
export async function restoreFromPayload(db, parsed) {
  await db.transaction('rw', TABLES.map((t) => db[t]), async () => {
    for (const t of TABLES) {
      await db[t].clear();
      const rows = parsed.data[t];
      if (Array.isArray(rows) && rows.length) await db[t].bulkPut(rows);
    }
  });
}

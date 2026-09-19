// FR-11 / Section 9.
import { db } from '../db/index.js';
import {
  exportBackup as libExportBackup,
  parseBackupFile,
  incomingCounts,
  getRecordCounts as libGetRecordCounts,
  savePreRestoreSnapshot,
  restoreFromPayload,
  getPreRestoreSnapshot as libGetPreRestoreSnapshot,
  clearPreRestoreSnapshot
} from '../lib/backup.js';

export async function backupNow() {
  const result = await libExportBackup(db);
  await db.meta.put({ key: 'last_backup_at', value: new Date().toISOString() });
  return result;
}

export async function getBackupStatus() {
  const [lastBackup, settingsRow] = await Promise.all([
    db.meta.get('last_backup_at'),
    db.settings.get('backup_interval_days')
  ]);
  const lastAt = lastBackup?.value || null;
  const intervalDays = settingsRow?.value ?? 7;
  let daysSince = null;
  if (lastAt) {
    daysSince = Math.floor((Date.now() - new Date(lastAt).getTime()) / 86400000);
  }
  return { lastAt, daysSince, intervalDays };
}

export async function getCurrentCounts() {
  return libGetRecordCounts(db);
}

export async function prepareRestore(file) {
  const text = await file.text();
  const parsed = parseBackupFile(text);
  const [incoming, current] = await Promise.all([Promise.resolve(incomingCounts(parsed)), libGetRecordCounts(db)]);
  return { parsed, incoming, current };
}

export async function confirmRestore(parsed) {
  await savePreRestoreSnapshot(db);
  await restoreFromPayload(db, parsed);
}

export function getPreRestoreSnapshot() {
  return libGetPreRestoreSnapshot();
}

export async function undoRestore() {
  const snap = libGetPreRestoreSnapshot();
  if (!snap) throw new Error('Nothing to undo — the previous state is no longer available.');
  await restoreFromPayload(db, snap.payload);
  clearPreRestoreSnapshot();
}

export async function exportCsv(rows, headers, filename) {
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map((h) => escape(h.label)).join(',')];
  for (const row of rows) lines.push(headers.map((h) => escape(row[h.key])).join(','));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });

  if (navigator.share && navigator.canShare) {
    const file = new File([blob], filename, { type: 'text/csv' });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

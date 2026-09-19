import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'preact/hooks';
import { db } from '../../db/index.js';
import { useUi } from '../../state/ui.jsx';
import { backupNow, getBackupStatus } from '../../actions/backup.js';
import { needsBackupInterstitial } from '../../domain/reminders.js';

const SNOOZE_KEY = 'cabfee_backup_snooze_until';

function readSnooze() {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY)) || 0;
  } catch {
    return 0;
  }
}

/** Full-screen prompt after 30 days without a backup (SRS 9.6). */
export function BackupInterstitial() {
  const { state, toast, t } = useUi();
  const [snoozedUntil, setSnoozedUntil] = useState(readSnooze);
  const [busy, setBusy] = useState(false);

  const info = useLiveQuery(async () => {
    const [status, studentCount, operator] = await Promise.all([getBackupStatus(), db.students.count(), db.operator.get('self')]);
    const setupAt = operator?.created_at ? new Date(operator.created_at).getTime() : Date.now();
    return { status, studentCount, daysSinceSetup: Math.floor((Date.now() - setupAt) / 86400000) };
  }, [], null);

  const unlocked = !['boot', 'lock', 'setup'].includes(state.screen);
  if (!unlocked || !info) return null;
  const show = needsBackupInterstitial({
    daysSinceBackup: info.status.daysSince,
    studentCount: info.studentCount,
    daysSinceSetup: info.daysSinceSetup,
    snoozedUntil,
    now: Date.now()
  });
  if (!show) return null;

  async function onBackup() {
    setBusy(true);
    try {
      const result = await backupNow();
      if (result.method === 'download') toast(t('backupSavedDownload'));
      else if (result.method !== 'cancelled') toast('✓');
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  }

  function onSnooze() {
    const until = Date.now() + 24 * 60 * 60 * 1000;
    try {
      localStorage.setItem(SNOOZE_KEY, String(until));
    } catch {
      // Snooze then only lasts for this session.
    }
    setSnoozedUntil(until);
  }

  return (
    <div style="position:fixed;inset:0;z-index:90;background:var(--color-accent);color:#fff;display:flex;flex-direction:column;justify-content:center;gap:18px;padding:32px 26px">
      <div style="font-size:42px;line-height:1">&#9888;</div>
      <div style="font-weight:800;font-size:26px;line-height:1.15">{t('backupDueTitle')}</div>
      <div style="font-size:15px;line-height:1.55">{t('backupDueBody')}</div>
      <button class="btn btn-block" style="background:#fff;color:var(--color-text);border-color:#fff" disabled={busy} onClick={onBackup}>{t('backupNow')}</button>
      <button class="btn btn-block" style="background:transparent;color:#fff;border-color:#fff" onClick={onSnooze}>{t('remindTomorrow')}</button>
    </div>
  );
}

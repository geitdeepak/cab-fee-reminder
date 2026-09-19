import { useState, useRef } from 'preact/hooks';
import { useLiveQuery } from 'dexie-react-hooks';
import { useUi } from '../../state/ui.jsx';
import { backupNow, getBackupStatus, prepareRestore, confirmRestore } from '../../actions/backup.js';
import { backupBanner } from '../../domain/reminders.js';
import { TopBar } from '../components/TopBar.jsx';

export function Backup() {
  const { toast, showDialog, t, tf } = useUi();
  const status = useLiveQuery(() => getBackupStatus(), [], null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  async function onBackup() {
    setBusy(true);
    try {
      const result = await backupNow();
      if (result.method === 'download') toast(t('backupSavedDownload'));
      else if (result.method === 'share') toast(`${result.filename} ✓`);
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    try {
      const { parsed, incoming, current } = await prepareRestore(file);
      showDialog({
        title: t('restoreTitle'),
        body: tf('restoreBody', { cs: current.students, ci: current.invoices, ns: incoming.students, ni: incoming.invoices }),
        confirmLabel: t('yesRestore'),
        danger: true,
        onConfirm: async () => {
          await confirmRestore(parsed);
          toast(t('restored'));
        }
      });
    } catch (e) {
      toast(e.message);
    }
  }

  if (!status) return <div style="min-height:100vh" />;
  const banner = backupBanner(status.daysSince, status.intervalDays);
  const cardStyle = banner === 'red' || banner === 'interstitial' ? 'background:var(--color-accent);color:#fff;border-color:var(--color-accent)' : 'background:var(--color-neutral-100);color:var(--color-text)';

  return (
    <div style="min-height:100vh;display:flex;flex-direction:column">
      <TopBar title={t('backup')} />
      <div class="main-scroll scr">
        <div class="screen-pad">
          <div style={`border:2px solid var(--color-text);padding:14px;${cardStyle}`}>
            <div class="section-title">{t('lastBackup')}</div>
            <div style="font-weight:800;font-size:32px;margin-top:7px">
              {status.daysSince == null ? t('backupNever') : status.daysSince === 0 ? t('backupToday') : tf('backupDaysAgo', { n: status.daysSince })}
            </div>
          </div>
          <button class="btn btn-primary btn-block" disabled={busy} onClick={onBackup}>{t('backupNow')}</button>
          <div style="font-size:12px;line-height:1.55;color:var(--color-neutral-800)">{t('backupExplain')}</div>

          <div style="border-top:2px solid var(--color-text);padding-top:14px;display:flex;flex-direction:column;gap:9px">
            <div class="section-title">{t('restore')}</div>
            <div style="font-size:12px;line-height:1.5;color:var(--color-neutral-800)">{t('restoreExplain')}</div>
            <input ref={fileRef} type="file" accept=".json,.txt,application/json,text/plain" style="display:none" onChange={onFile} />
            <button class="btn btn-secondary btn-block" onClick={() => fileRef.current?.click()}>{t('chooseFile')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

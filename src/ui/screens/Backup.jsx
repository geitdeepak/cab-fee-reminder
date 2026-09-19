import { useState, useRef } from 'preact/hooks';
import { useLiveQuery } from 'dexie-react-hooks';
import { useUi } from '../../state/ui.jsx';
import { backupNow, getBackupStatus, prepareRestore, confirmRestore } from '../../actions/backup.js';
import { backupBanner } from '../../domain/reminders.js';
import { TopBar } from '../components/TopBar.jsx';

export function Backup() {
  const { toast, showDialog, t } = useUi();
  const status = useLiveQuery(() => getBackupStatus(), [], null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  async function onBackup() {
    setBusy(true);
    try {
      const result = await backupNow();
      toast(`${result.filename} ✓`);
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
        title: 'Restore this backup?',
        body:
          `Current: ${current.students} students, ${current.invoices} invoices.\n` +
          `Incoming: ${incoming.students} students, ${incoming.invoices} invoices.\n\n` +
          'Everything on the phone now will be replaced by this file. This cannot be undone.',
        confirmLabel: 'Yes, restore',
        danger: true,
        onConfirm: async () => {
          await confirmRestore(parsed);
          toast('Restored ✓');
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
      <TopBar title={t('backup')} eyebrow="S-12" />
      <div class="main-scroll scr">
        <div class="screen-pad">
          <div style={`border:2px solid var(--color-text);padding:14px;${cardStyle}`}>
            <div class="section-title">{t('lastBackup')}</div>
            <div style="font-weight:800;font-size:32px;margin-top:7px">
              {status.daysSince == null ? 'Never' : status.daysSince === 0 ? 'Today' : `${status.daysSince}d ago`}
            </div>
          </div>
          <button class="btn btn-primary btn-block" disabled={busy} onClick={onBackup}>{t('backupNow')}</button>
          <div style="font-size:12px;line-height:1.55;color:var(--color-neutral-800)">{t('backupExplain')}</div>

          <div style="border-top:2px solid var(--color-text);padding-top:14px;display:flex;flex-direction:column;gap:9px">
            <div class="section-title">{t('restore')}</div>
            <div style="font-size:12px;line-height:1.5;color:var(--color-neutral-800)">{t('restoreExplain')}</div>
            <input ref={fileRef} type="file" accept="application/json" style="display:none" onChange={onFile} />
            <button class="btn btn-secondary btn-block" onClick={() => fileRef.current?.click()}>{t('chooseFile')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

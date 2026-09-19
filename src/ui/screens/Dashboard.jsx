import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'preact/hooks';
import { useUi } from '../../state/ui.jsx';
import { dashboardSnapshot } from '../../actions/dashboard.js';
import { getBackupStatus } from '../../actions/backup.js';
import { runInvoiceEngine } from '../../actions/billing.js';
import { backupBanner } from '../../domain/reminders.js';
import { formatCurrency } from '../../lib/format.js';
import { TopBar } from '../components/TopBar.jsx';
import { BottomNav } from '../components/BottomNav.jsx';

export function Dashboard() {
  const { go, toast, t } = useUi();
  const [running, setRunning] = useState(false);
  const snap = useLiveQuery(() => dashboardSnapshot(), [], null);
  const backupStatus = useLiveQuery(() => getBackupStatus(), [], null);

  async function onGenerate() {
    setRunning(true);
    try {
      const { generated } = await runInvoiceEngine();
      toast(generated > 0 ? `${generated} new invoice${generated === 1 ? '' : 's'} created.` : 'Everything is already up to date.');
    } finally {
      setRunning(false);
    }
  }

  if (!snap || !backupStatus) {
    return (
      <div style="min-height:100vh;display:flex;flex-direction:column">
        <TopBar title={t('dashboard')} />
        <div class="main-scroll" />
        <BottomNav />
      </div>
    );
  }

  const banner = backupBanner(backupStatus.daysSince, backupStatus.intervalDays);

  return (
    <div style="min-height:100vh;display:flex;flex-direction:column">
      <TopBar title={t('dashboard')} />
      <div class="main-scroll scr">
        <div class="screen-pad">
          {banner !== 'none' && (
            <button
              class={`banner ${banner === 'red' || banner === 'interstitial' ? 'banner-red' : 'banner-amber'}`}
              style="width:100%;text-align:left;cursor:pointer"
              onClick={() => go('backup')}
            >
              <span style="font-size:18px">&#9888;</span>
              <span style="flex:1">
                {backupStatus.daysSince == null
                  ? t('backupNagFirst')
                  : `${backupStatus.daysSince} ${banner === 'amber' ? t('backupNagAmber') : t('backupNagRed')}`}
              </span>
              <span>&rarr;</span>
            </button>
          )}

          <div class="grid-2">
            <button class="stat-tile" style="grid-column:span 2;text-align:left;background:var(--color-text);color:#fff;border-color:var(--color-text)" onClick={() => go('queue')}>
              <div class="stat-label" style="color:var(--color-accent-200)">{t('remindersPending')}</div>
              <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-top:6px">
                <span class="stat-value" style="font-size:40px">{snap.pendingReminderCount}</span>
                <span style="font-size:12px;color:var(--color-neutral-300)">{t('tapToSend')}</span>
              </div>
            </button>

            <button class="stat-tile" style="text-align:left" onClick={() => go('invoices')}>
              <div class="stat-label">{t('outstanding')}</div>
              <div class="stat-value" style="font-size:22px">{formatCurrency(snap.outstanding)}</div>
              {snap.overdue > 0 && (
                <div style="font-size:12px;font-weight:700;color:var(--color-accent-700);margin-top:6px">
                  {formatCurrency(snap.overdue)} {t('overduePart')}
                </div>
              )}
            </button>

            <button class="stat-tile" style="text-align:left" onClick={() => go('reports')}>
              <div class="stat-label">{t('collected')}</div>
              <div class="stat-value" style="font-size:22px">{formatCurrency(snap.collectedThisMonth)}</div>
              <div style="font-size:12px;color:var(--color-neutral-700);margin-top:6px">{t('thisMonth')}</div>
            </button>

            <button class="stat-tile" style="text-align:left;grid-column:span 2" onClick={() => go('students')}>
              <div class="stat-label">{t('activeStudents')}</div>
              <div class="stat-value" style="font-size:22px">{snap.activeStudents}</div>
            </button>
          </div>

          <div class="card">
            <div style="padding:11px 14px;border-bottom:2px solid var(--color-text);display:flex;justify-content:space-between;align-items:center">
              <span class="section-title">{t('dueThisWeek')}</span>
              <span style="font-size:11px;font-weight:700;color:var(--color-neutral-700)">{formatCurrency(snap.dueThisWeekTotal)}</span>
            </div>
            {snap.dueThisWeek.length === 0 && <div class="empty-state">—</div>}
            {snap.dueThisWeek.map((row) => (
              <button key={row.student_id + row.due_date} class="list-row" onClick={() => go('student', { studentId: row.student_id, tab: 'ledger' })}>
                <span style="flex:1;min-width:0">
                  <span style="display:block;font-weight:700;font-size:14px">{row.name}</span>
                  <span style="display:block;font-size:11px;color:var(--color-neutral-700);margin-top:1px">
                    {row.class_name} · {row.due_date_human}
                  </span>
                </span>
                <span style="font-weight:800;font-size:15px">{formatCurrency(row.amount)}</span>
              </button>
            ))}
          </div>

          <button class="btn btn-secondary btn-block" disabled={running} onClick={onGenerate}>
            {running ? '…' : t('generateInvoices')}
          </button>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

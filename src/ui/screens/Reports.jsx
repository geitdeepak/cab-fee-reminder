import { useLiveQuery } from 'dexie-react-hooks';
import { useUi } from '../../state/ui.jsx';
import { monthlyReport, defaulters } from '../../actions/reports.js';
import { exportCsv } from '../../actions/backup.js';
import { formatCurrency } from '../../lib/format.js';
import { todayISO } from '../../domain/dates.js';
import { TopBar } from '../components/TopBar.jsx';
import { BottomNav } from '../components/BottomNav.jsx';

export function Reports() {
  const { go, toast, t } = useUi();
  const report = useLiveQuery(() => monthlyReport(), [], null);
  const defaulterRows = useLiveQuery(() => defaulters(), [], []);

  async function onExport() {
    await exportCsv(
      defaulterRows,
      [
        { key: 'name', label: 'Student' },
        { key: 'class_name', label: 'Class' },
        { key: 'amount', label: 'Outstanding' },
        { key: 'days', label: 'Days overdue' }
      ],
      `cabfee-defaulters-${todayISO()}.csv`
    );
    toast('CSV exported ✓');
  }

  if (!report) return <div style="min-height:100vh" />;

  return (
    <div style="min-height:100vh;display:flex;flex-direction:column">
      <TopBar title={t('reports')} />
      <div class="main-scroll scr">
        <div style="padding:14px;background:var(--color-text);color:#fff">
          <div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;color:var(--color-accent-200)">{report.monthPrefix}</div>
          <div style="display:flex;gap:16px;margin-top:10px">
            <div>
              <div style="font-size:10px;color:var(--color-neutral-400);font-weight:700">{t('billed')}</div>
              <div style="font-weight:800;font-size:19px;margin-top:3px">{formatCurrency(report.billed)}</div>
            </div>
            <div>
              <div style="font-size:10px;color:var(--color-neutral-400);font-weight:700">{t('collected')}</div>
              <div style="font-weight:800;font-size:19px;margin-top:3px">{formatCurrency(report.collected)}</div>
            </div>
            <div>
              <div style="font-size:10px;color:var(--color-accent-200);font-weight:700">{t('outstanding')}</div>
              <div style="font-weight:800;font-size:19px;margin-top:3px">{formatCurrency(report.outstanding)}</div>
            </div>
          </div>
          <div style="height:10px;display:flex;margin-top:14px;border:2px solid #fff">
            <div style={`width:${report.collectionRatePct}%;background:#fff`} />
            <div style={`width:${100 - report.collectionRatePct}%;background:var(--color-accent)`} />
          </div>
          <div style="font-size:11px;color:var(--color-neutral-400);margin-top:6px">{report.collectionRatePct}% {t('collectionRate')}</div>
        </div>

        <div style="padding:13px 14px;border-bottom:2px solid var(--color-text)" class="section-title">{t('byPickupPoint')}</div>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="border-bottom:2px solid var(--color-text)">
              <th style="text-align:left;padding:8px 14px;font-size:11px">{t('point')}</th>
              <th style="text-align:right;padding:8px 14px;font-size:11px">{t('billed')}</th>
              <th style="text-align:right;padding:8px 14px;font-size:11px">{t('due')}</th>
            </tr>
          </thead>
          <tbody>
            {report.byPoint.map((r) => (
              <tr key={r.point} style="border-bottom:1px solid var(--color-neutral-300)">
                <td style="padding:8px 14px;font-weight:700;font-size:13px">{r.point}</td>
                <td style="padding:8px 14px;text-align:right;font-size:13px">{formatCurrency(r.billed)}</td>
                <td style="padding:8px 14px;text-align:right;font-weight:700;color:var(--color-accent-700);font-size:13px">{formatCurrency(r.due)}</td>
              </tr>
            ))}
            {report.byPoint.length === 0 && (
              <tr><td colSpan={3} style="padding:16px 14px;color:var(--color-neutral-700);font-size:13px">—</td></tr>
            )}
          </tbody>
        </table>

        <div style="padding:13px 14px;border-top:2px solid var(--color-text);border-bottom:2px solid var(--color-text)" class="section-title">{t('defaulters')}</div>
        {defaulterRows.map((d) => (
          <button key={d.student_id} class="list-row" onClick={() => go('student', { studentId: d.student_id, tab: 'ledger' })}>
            <span style="flex:1;min-width:0">
              <span style="display:block;font-weight:700;font-size:14px">{d.name}</span>
              <span style="display:block;font-size:11.5px;color:var(--color-neutral-700);margin-top:1px">{d.class_name} · {d.days} {t('days')}</span>
            </span>
            <span style="font-weight:800;font-size:15px;color:var(--color-accent-700)">{formatCurrency(d.amount)}</span>
          </button>
        ))}
        {defaulterRows.length === 0 && <div class="empty-state">None right now.</div>}
        <div style="padding:14px">
          <button class="btn btn-secondary btn-block" onClick={onExport}>{t('exportCsv')}</button>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

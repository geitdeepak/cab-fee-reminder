import { useState, useMemo } from 'preact/hooks';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/index.js';
import { useUi } from '../../state/ui.jsx';
import { outstandingBalance, isSettled } from '../../domain/invoices.js';
import { formatCurrency } from '../../lib/format.js';
import { formatDateHuman } from '../../domain/dates.js';
import { TopBar } from '../components/TopBar.jsx';
import { BottomNav } from '../components/BottomNav.jsx';
import { EmptyState } from '../components/EmptyState.jsx';

export function Invoices() {
  const { go, t, tf } = useUi();
  const [tab, setTab] = useState('outstanding');
  const invoices = useLiveQuery(() => db.invoices.toArray(), [], []);
  const students = useLiveQuery(() => db.students.toArray(), [], []);
  const studentsById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  const rows = invoices
    .filter((i) => {
      if (tab === 'outstanding') return !isSettled(i);
      if (tab === 'overdue') return i.status === 'overdue';
      return i.status === 'paid';
    })
    .sort((a, b) => (a.due_date < b.due_date ? 1 : -1));

  const tabs = [
    { key: 'outstanding', label: t('outstandingTab') },
    { key: 'overdue', label: t('overdueTab') },
    { key: 'paid', label: t('paidTab') }
  ];

  return (
    <div style="min-height:100vh;display:flex;flex-direction:column">
      <TopBar title={t('invoices')} />
      <div class="main-scroll scr">
        <div style="display:flex;border-bottom:2px solid var(--color-text)">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              style={`flex:1;padding:12px 6px;border:0;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;min-height:44px;${tab === tb.key ? 'background:var(--color-text);color:#fff' : 'background:var(--color-neutral-100);color:var(--color-neutral-800)'}`}
            >
              {tb.label}
            </button>
          ))}
        </div>
        {rows.map((inv) => {
          const s = studentsById.get(inv.student_id);
          return (
            <button key={inv.id} class="list-row" onClick={() => go('pay', { invoiceId: inv.id, studentId: inv.student_id })}>
              <span style="flex:1;min-width:0">
                <span style="display:block;font-weight:700;font-size:14px">{s?.name || '—'}</span>
                <span style="display:block;font-size:11.5px;color:var(--color-neutral-700);margin-top:1px">
                  {tf('dueOn', { date: formatDateHuman(inv.due_date) })}
                </span>
              </span>
              <span style="text-align:right">
                <span style="display:block;font-weight:800;font-size:15px">{formatCurrency(outstandingBalance(inv) || inv.amount)}</span>
                <span style={`display:block;font-size:10px;font-weight:700;margin-top:2px;text-transform:uppercase;${inv.status === 'paid' ? 'color:var(--color-neutral-600)' : 'color:var(--color-accent-700)'}`}>
                  {t(inv.status) || inv.status}
                </span>
              </span>
            </button>
          );
        })}
        {rows.length === 0 && <EmptyState>{t('noResults')}</EmptyState>}
      </div>
      <BottomNav />
    </div>
  );
}

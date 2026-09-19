import { useState, useEffect } from 'preact/hooks';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/index.js';
import { useUi } from '../../state/ui.jsx';
import { getStudent } from '../../actions/students.js';
import { getActiveEnrolment, invoicesForStudent } from '../../actions/billing.js';
import { studentLedgerText } from '../../actions/reports.js';
import { useOperator } from '../../state/hooks.js';
import { formatCurrency } from '../../lib/format.js';
import { formatDateHuman } from '../../domain/dates.js';
import { SafetyCard } from '../components/SafetyCard.jsx';
import { TopBar } from '../components/TopBar.jsx';

const STATUS_COLOR = { overdue: 'color:var(--color-accent-700)', partial: 'color:var(--color-accent-700)', paid: 'color:var(--color-neutral-600)', pending: 'color:var(--color-neutral-800)', cancelled: 'color:var(--color-neutral-500)' };

export function StudentDetail() {
  const { state, go, toast, t } = useUi();
  const studentId = state.params?.studentId;
  const [tab, setTab] = useState(state.params?.tab || 'record');
  const student = useLiveQuery(() => getStudent(studentId), [studentId], null);
  const pickup = useLiveQuery(() => (student ? db.pickup_points.get(student.pickup_point_id) : null), [student?.pickup_point_id], null);
  const enrolment = useLiveQuery(() => getActiveEnrolment(studentId), [studentId], null);
  const plan = useLiveQuery(() => (enrolment ? db.fee_plans.get(enrolment.fee_plan_id) : null), [enrolment?.fee_plan_id], null);
  const invoices = useLiveQuery(() => invoicesForStudent(studentId), [studentId], []);
  const operator = useOperator();

  if (!student) return <div style="min-height:100vh" />;

  const tabs = [
    { key: 'record', label: t('record') },
    { key: 'ledger', label: t('ledger') },
    { key: 'notes', label: t('notes') }
  ];

  async function onShareLedger() {
    const text = await studentLedgerText(studentId, operator?.name);
    if (navigator.share) {
      try { await navigator.share({ text, title: `${student.name} – Ledger` }); return; } catch { /* user cancelled */ }
    }
    await navigator.clipboard?.writeText(text).catch(() => {});
    toast('Ledger copied.');
  }

  return (
    <div style="min-height:100vh;display:flex;flex-direction:column">
      <TopBar title={student.name} eyebrow="S-05" />
      <div class="main-scroll scr">
        <SafetyCard student={student} />

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

        {tab === 'record' && (
          <div>
            {[
              [t('classLabel'), student.class_name],
              [t('school'), student.school_name],
              [t('pickupPoint'), pickup ? `${pickup.name} · ${formatCurrency(pickup.monthly_fare)}` : '—'],
              [t('feePlan'), plan ? `${plan.label} · ${formatCurrency(enrolment?.cycle_amount)}` : 'Not enrolled'],
              [t('fatherName'), `${student.father_name} · ${student.father_phone || '—'}`],
              [t('motherName'), `${student.mother_name} · ${student.mother_phone || '—'}`],
              ['Joined', formatDateHuman(student.joined_on)],
              ['Status', student.status === 'active' ? t('active') : t('inactive')]
            ].map(([label, value]) => (
              <div key={label} style="display:flex;gap:12px;padding:10px 14px;border-bottom:1px solid var(--color-neutral-300);align-items:baseline">
                <div style="flex:0 0 120px;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:var(--color-neutral-700)">{label}</div>
                <div style="flex:1;font-size:13.5px;font-weight:600">{value}</div>
              </div>
            ))}
            <div style="display:flex;gap:8px;padding:14px">
              <button class="btn btn-secondary" style="flex:1;justify-content:flex-start" onClick={() => go('form', { studentId })}>{t('edit')}</button>
              <button class="btn btn-secondary" style="flex:1;justify-content:flex-start" onClick={() => go('enrol', { studentId })}>{t('enrolment')}</button>
            </div>
          </div>
        )}

        {tab === 'ledger' && (
          <div>
            {invoices.map((inv) => (
              <button key={inv.id} class="list-row" onClick={() => go('pay', { invoiceId: inv.id, studentId })}>
                <div style="flex:1;min-width:0">
                  <div style="font-weight:700;font-size:13.5px">{formatDateHuman(inv.period_start)} – {formatDateHuman(inv.period_end)}</div>
                  <div style="font-size:11.5px;color:var(--color-neutral-700);margin-top:1px">due {formatDateHuman(inv.due_date)}</div>
                </div>
                <div style="text-align:right">
                  <div style="font-weight:800;font-size:14.5px">{formatCurrency(inv.amount)}</div>
                  <div style={`font-size:10px;font-weight:700;margin-top:2px;text-transform:uppercase;${STATUS_COLOR[inv.status]}`}>{t(inv.status) || inv.status}</div>
                </div>
              </button>
            ))}
            {invoices.length === 0 && <div class="empty-state">No invoices yet.</div>}
            <div style="display:flex;gap:8px;padding:14px">
              <button class="btn btn-secondary" onClick={onShareLedger}>{t('share')}</button>
            </div>
          </div>
        )}

        {tab === 'notes' && (
          <div style="padding:14px">
            <div class="card card-tight" style="white-space:pre-wrap">{student.notes || 'No notes yet.'}</div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'preact/hooks';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/index.js';
import { useUi } from '../../state/ui.jsx';
import { usePickupPoints } from '../../state/hooks.js';
import { getStudent } from '../../actions/students.js';
import { getActiveEnrolment, saveEnrolmentWithOpening } from '../../actions/billing.js';
import { feeBreakdown } from '../../domain/fees.js';
import { formatCurrency } from '../../lib/format.js';
import { formatDateHuman, dueDate } from '../../domain/dates.js';
import { TopBar } from '../components/TopBar.jsx';
import { FeeFields, DEFAULT_FEE, startDateFor } from '../components/FeeFields.jsx';

export function EnrolmentForm() {
  const { state, back, toast, root, t } = useUi();
  const studentId = state.params?.studentId;
  const pickups = usePickupPoints().filter((p) => p.active);
  const feePlans = useLiveQuery(() => db.fee_plans.toArray(), [], []);
  const [student, setStudent] = useState(null);
  const [pickupPointId, setPickupPointId] = useState('');
  const [fee, setFee] = useState(DEFAULT_FEE);

  useEffect(() => {
    if (!studentId) return;
    getStudent(studentId).then((s) => {
      setStudent(s);
      if (s) setPickupPointId(s.pickup_point_id);
    });
    getActiveEnrolment(studentId).then((e) => {
      if (e) {
        setPickupPointId(e.pickup_point_id);
        setFee((f) => ({ ...f, planId: e.fee_plan_id, dueDay: e.due_day }));
      }
    });
  }, [studentId]);

  const pickup = pickups.find((p) => p.id === pickupPointId) || pickups[0];
  const plan = feePlans.find((p) => p.id === fee.planId);
  const breakdown = pickup && plan ? feeBreakdown(pickup.monthly_fare, plan.months, plan.discount_pct) : null;
  const startDate = startDateFor(fee.startChoice);
  const firstDue = pickup && plan ? dueDate(startDate, fee.dueDay) : null;

  async function onSave() {
    try {
      await saveEnrolmentWithOpening({
        student_id: studentId,
        pickup_point_id: pickupPointId,
        fee_plan_id: fee.planId,
        due_day: fee.dueDay,
        start_date: startDate,
        thisMonthPaid: fee.paid,
        oldDues: fee.oldDues
      });
      toast(`${t('saveEnrolment')} · ${formatCurrency(pickup.monthly_fare)} locked ✓`);
      root('student', { studentId, tab: 'ledger' });
    } catch (e) {
      toast(e.message);
    }
  }

  if (!student) return <div style="min-height:100vh" />;

  return (
    <div style="min-height:100vh;display:flex;flex-direction:column">
      <TopBar title={t('enrolment')} />
      <div class="main-scroll scr">
        <div class="screen-pad">
          <div class="card card-tight">
            <div class="stat-label">{t('student')}</div>
            <div style="font-weight:800;font-size:19px;margin-top:3px">{student.name}</div>
            <div style="font-size:12px;color:var(--color-neutral-700);margin-top:2px">{student.class_name} · {student.school_name}</div>
          </div>

          <div class="field">
            <label>{t('pickupPoint')}</label>
            <div style="display:flex;flex-direction:column;gap:6px">
              {pickups.map((p) => (
                <button key={p.id} class={`opt-row${pickupPointId === p.id ? ' active' : ''}`} onClick={() => setPickupPointId(p.id)}>
                  <span style="flex:1;min-width:0;text-align:left">
                    <span style="display:block;font-weight:700;font-size:13.5px">{p.name}</span>
                    <span style="display:block;font-size:11.5px;opacity:.75">{p.area}</span>
                  </span>
                  <span style="font-weight:800;font-size:14px">{formatCurrency(p.monthly_fare)}</span>
                </button>
              ))}
            </div>
          </div>

          <FeeFields value={fee} onChange={(patch) => setFee((f) => ({ ...f, ...patch }))} />

          {breakdown && (
            <div style="border:2px solid var(--color-text);background:var(--color-text);color:#fff;padding:14px">
              <div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;color:var(--color-accent-200)">{t('farePreview')}</div>
              <div style="font-weight:800;font-size:34px;margin-top:8px">{formatCurrency(breakdown.cycleAmount)}</div>
              <div style="font-size:12.5px;color:var(--color-neutral-300);margin-top:8px">
                {formatCurrency(pickup.monthly_fare)} × {plan.months}{plan.discount_pct ? ` − ${plan.discount_pct}%` : ''} = {formatCurrency(breakdown.cycleAmount)}
              </div>
              <div style="display:grid;grid-template-columns:auto 1fr;gap:5px 14px;margin-top:12px;padding-top:11px;border-top:2px solid var(--color-neutral-700);font-size:12px">
                <div style="color:var(--color-neutral-400)">{t('lockedFare')}</div>
                <div style="font-weight:700">{formatCurrency(pickup.monthly_fare)}</div>
                <div style="color:var(--color-neutral-400)">{t('firstInvoice')}</div>
                <div style="font-weight:700">{formatDateHuman(firstDue)}</div>
              </div>
            </div>
          )}

          <div style="font-size:11.5px;line-height:1.5;color:var(--color-neutral-700)">{t('lockExplain')}</div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secondary" onClick={back}>{t('cancel')}</button>
            <button class="btn btn-primary" style="flex:1;justify-content:flex-start" onClick={onSave} disabled={!pickup}>{t('saveEnrolment')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

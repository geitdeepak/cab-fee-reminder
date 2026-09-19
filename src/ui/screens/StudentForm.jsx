import { useState, useEffect } from 'preact/hooks';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/index.js';
import { useUi } from '../../state/ui.jsx';
import { usePickupPoints } from '../../state/hooks.js';
import { saveStudent, getStudent } from '../../actions/students.js';
import { saveEnrolmentWithOpening } from '../../actions/billing.js';
import { feeBreakdown } from '../../domain/fees.js';
import { formatCurrency } from '../../lib/format.js';
import { TopBar } from '../components/TopBar.jsx';
import { FeeFields, DEFAULT_FEE, startDateFor } from '../components/FeeFields.jsx';
import { todayISO } from '../../domain/dates.js';

const BLOOD_OPTIONS = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−', 'Unknown'];

const EMPTY = {
  name: '', class_name: '', school_name: '', father_name: '', father_phone: '',
  mother_name: '', mother_phone: '', emergency_phone: '', pickup_point_id: '',
  blood_group: 'Unknown', allergies: '', notes: '', joined_on: todayISO(), status: 'active',
  message_language: '' // '' = follow the default set in Settings
};

export function StudentForm() {
  const { state, back, root, toast, t } = useUi();
  const studentId = state.params?.studentId;
  const isEdit = !!studentId;
  const pickups = usePickupPoints().filter((p) => p.active);
  const plans = useLiveQuery(() => db.fee_plans.toArray(), [], []);

  const [form, setForm] = useState(EMPTY);
  const [fee, setFee] = useState(DEFAULT_FEE);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [addedCount, setAddedCount] = useState(0);

  useEffect(() => {
    if (studentId) getStudent(studentId).then((s) => s && setForm(s));
  }, [studentId]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setFeePatch = (patch) => setFee((f) => ({ ...f, ...patch }));

  const pickup = pickups.find((p) => p.id === form.pickup_point_id);
  const plan = plans.find((p) => p.id === fee.planId);
  const preview = pickup && plan ? feeBreakdown(pickup.monthly_fare, plan.months, plan.discount_pct) : null;

  async function save(addNext) {
    if (busy) return;
    setBusy(true);
    try {
      const id = await saveStudent({ ...form, id: studentId });
      setErrors({});
      if (isEdit) {
        toast(`${form.name} ✓`);
        back();
        return;
      }
      await saveEnrolmentWithOpening({
        student_id: id,
        pickup_point_id: form.pickup_point_id,
        fee_plan_id: fee.planId,
        due_day: fee.dueDay,
        start_date: startDateFor(fee.startChoice),
        thisMonthPaid: fee.paid,
        oldDues: fee.oldDues
      });
      if (addNext) {
        setAddedCount((n) => n + 1);
        toast(`${form.name} ✓`);
        // Keep what is usually the same for the next child on the route.
        setForm({ ...EMPTY, pickup_point_id: form.pickup_point_id, school_name: form.school_name, message_language: form.message_language });
        setFee((f) => ({ ...f, paid: false, oldDues: '' }));
        document.querySelector('.main-scroll')?.scrollTo(0, 0);
      } else {
        toast(`${form.name} ✓`);
        root('student', { studentId: id, tab: 'ledger' });
      }
    } catch (e) {
      if (e.fieldErrors) setErrors(e.fieldErrors);
      else toast(e.message);
    } finally {
      setBusy(false);
    }
  }

  const phoneInput = (key, label) => (
    <div class="field">
      <label>{label}</label>
      <input
        class="input"
        inputMode="numeric"
        value={form[key] || ''}
        onInput={(e) => set(key, e.currentTarget.value.replace(/\D/g, '').slice(0, 10))}
      />
      {errors[key] && <div class="field-error">{errors[key]}</div>}
    </div>
  );

  const textInput = (key, label) => (
    <div class="field">
      <label>{label}</label>
      <input class="input" value={form[key] || ''} onInput={(e) => set(key, e.currentTarget.value)} />
      {errors[key] && <div class="field-error">{errors[key]}</div>}
    </div>
  );

  return (
    <div style="min-height:100vh;display:flex;flex-direction:column">
      <TopBar title={isEdit ? t('edit') : t('addStudent')} eyebrow="S-06" />
      <div class="main-scroll scr">
        <div class="screen-pad">
          {!isEdit && (
            <div style="font-size:12px;line-height:1.5;color:var(--color-neutral-700)">
              {t('quickHint')}
              {addedCount > 0 && <b> {addedCount} {t('importDone')}.</b>}
            </div>
          )}

          {textInput('name', `${t('studentName')} *`)}
          {textInput('class_name', `${t('classLabel')} *`)}

          <div class="field">
            <label>{t('pickupPoint')} *</label>
            <div style="display:flex;flex-direction:column;gap:6px">
              {pickups.map((p) => (
                <button key={p.id} class={`opt-row${form.pickup_point_id === p.id ? ' active' : ''}`} onClick={() => set('pickup_point_id', p.id)}>
                  <span style="flex:1;min-width:0;text-align:left">
                    <span style="display:block;font-weight:700;font-size:13.5px">{p.name}</span>
                    <span style="display:block;font-size:11.5px;opacity:.75">{p.area}</span>
                  </span>
                  <span style="font-weight:800;font-size:14px">{formatCurrency(p.monthly_fare)}</span>
                </button>
              ))}
              {pickups.length === 0 && <div style="font-size:12.5px;color:var(--color-neutral-700)">Add a pickup point first (More → Pickup points).</div>}
            </div>
            {errors.pickup_point_id && <div class="field-error">{errors.pickup_point_id}</div>}
          </div>

          {phoneInput('father_phone', t('fatherPhone'))}
          {phoneInput('mother_phone', t('motherPhone'))}

          <div class="field">
            <label>{t('messageLanguage')}</label>
            <div class="chip-row">
              {[['', t('defaultOption')], ['hinglish', 'Hinglish'], ['english', 'English']].map(([key, label]) => (
                <button key={key || 'default'} class={`chip${(form.message_language || '') === key ? ' active' : ''}`} onClick={() => set('message_language', key)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {!isEdit && (
            <div style="display:flex;flex-direction:column;gap:14px;border-top:2px solid var(--color-text);padding-top:14px">
              <div class="section-title">{t('feeDetails')}</div>
              <FeeFields value={fee} onChange={setFeePatch} />
              {preview && (
                <div style="border:2px solid var(--color-text);background:var(--color-text);color:#fff;padding:12px;font-size:13px;font-weight:700">
                  {formatCurrency(pickup.monthly_fare)} × {plan.months}{plan.discount_pct ? ` − ${plan.discount_pct}%` : ''} = {formatCurrency(preview.cycleAmount)}
                </div>
              )}
            </div>
          )}

          <details style="border-top:2px solid var(--color-text);padding-top:12px" open={isEdit}>
            <summary style="font-weight:700;font-size:13px;cursor:pointer;min-height:36px">{t('moreDetails')}</summary>
            <div style="display:flex;flex-direction:column;gap:14px;margin-top:12px">
              {textInput('school_name', t('school'))}
              {textInput('father_name', t('fatherName'))}
              {textInput('mother_name', t('motherName'))}
              {phoneInput('emergency_phone', t('emergencyNumber'))}
              <div class="field">
                <label>{t('bloodGroup')}</label>
                <div class="chip-row">
                  {BLOOD_OPTIONS.map((b) => (
                    <button key={b} class={`chip${form.blood_group === b ? ' active' : ''}`} onClick={() => set('blood_group', b)}>{b}</button>
                  ))}
                </div>
              </div>
              <div class="field">
                <label>{t('allergies')}</label>
                <input class="input" value={form.allergies} placeholder={t('allergyPlaceholder')} onInput={(e) => set('allergies', e.currentTarget.value)} />
              </div>
              <div class="field">
                <label>{t('notes')}</label>
                <textarea class="input" rows={3} value={form.notes} onInput={(e) => set('notes', e.currentTarget.value)} />
              </div>
            </div>
          </details>

          <div style="display:flex;gap:8px;border-top:2px solid var(--color-text);padding-top:14px;flex-wrap:wrap">
            <button class="btn btn-secondary" onClick={back}>{t('cancel')}</button>
            {!isEdit && <button class="btn btn-secondary" disabled={busy} onClick={() => save(false)}>{t('save')}</button>}
            <button class="btn btn-primary" style="flex:1;justify-content:flex-start" disabled={busy} onClick={() => save(!isEdit)}>
              {isEdit ? t('saveStudent') : t('saveAndNext')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

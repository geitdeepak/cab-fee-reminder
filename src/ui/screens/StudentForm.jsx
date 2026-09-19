import { useState, useEffect } from 'preact/hooks';
import { useUi } from '../../state/ui.jsx';
import { usePickupPoints } from '../../state/hooks.js';
import { saveStudent, getStudent } from '../../actions/students.js';
import { TopBar } from '../components/TopBar.jsx';
import { todayISO } from '../../domain/dates.js';

const BLOOD_OPTIONS = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−', 'Unknown'];

export function StudentForm() {
  const { state, back, go, toast, t } = useUi();
  const studentId = state.params?.studentId;
  const pickups = usePickupPoints().filter((p) => p.active);

  const [form, setForm] = useState({
    name: '', class_name: '', school_name: '', father_name: '', father_phone: '',
    mother_name: '', mother_phone: '', emergency_phone: '', pickup_point_id: '',
    blood_group: 'Unknown', allergies: '', notes: '', joined_on: todayISO(), status: 'active'
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (studentId) getStudent(studentId).then((s) => s && setForm(s));
  }, [studentId]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSave() {
    try {
      const id = await saveStudent({ ...form, id: studentId });
      toast(`${form.name} – ${t('saveStudent')} ✓`);
      go('enrol', { studentId: id });
    } catch (e) {
      if (e.fieldErrors) setErrors(e.fieldErrors);
      else toast(e.message);
    }
  }

  const fields = [
    ['name', t('studentName'), 'text'],
    ['class_name', t('classLabel'), 'text'],
    ['school_name', t('school'), 'text'],
    ['father_name', t('fatherName'), 'text'],
    ['father_phone', t('fatherPhone'), 'numeric'],
    ['mother_name', t('motherName'), 'text'],
    ['mother_phone', t('motherPhone'), 'numeric'],
    ['emergency_phone', t('emergencyNumber'), 'numeric']
  ];

  return (
    <div style="min-height:100vh;display:flex;flex-direction:column">
      <TopBar title={t('addStudent')} eyebrow="S-06" />
      <div class="main-scroll scr">
        <div class="screen-pad">
          {fields.map(([key, label, mode]) => (
            <div class="field" key={key}>
              <label>{label} *</label>
              <input
                class="input"
                inputMode={mode}
                value={form[key] || ''}
                onInput={(e) => {
                  const v = mode === 'numeric' ? e.currentTarget.value.replace(/\D/g, '').slice(0, 10) : e.currentTarget.value;
                  set(key, v);
                }}
              />
              {errors[key] && <div class="field-error">{errors[key]}</div>}
            </div>
          ))}

          <div class="field">
            <label>{t('bloodGroup')}</label>
            <div class="chip-row">
              {BLOOD_OPTIONS.map((b) => (
                <button key={b} class={`chip${form.blood_group === b ? ' active' : ''}`} onClick={() => set('blood_group', b)}>{b}</button>
              ))}
            </div>
          </div>

          <div class="field">
            <label>{t('pickupPoint')} *</label>
            <div style="display:flex;flex-direction:column;gap:6px">
              {pickups.map((p) => (
                <button key={p.id} class={`opt-row${form.pickup_point_id === p.id ? ' active' : ''}`} onClick={() => set('pickup_point_id', p.id)}>
                  <span style="flex:1;min-width:0;text-align:left">
                    <span style="display:block;font-weight:700;font-size:13.5px">{p.name}</span>
                    <span style="display:block;font-size:11.5px;opacity:.75">{p.area}</span>
                  </span>
                  <span style="font-weight:800;font-size:14px">₹{p.monthly_fare.toLocaleString('en-IN')}</span>
                </button>
              ))}
              {pickups.length === 0 && <div style="font-size:12.5px;color:var(--color-neutral-700)">Add a pickup point first (More → Pickup points).</div>}
            </div>
            {errors.pickup_point_id && <div class="field-error">{errors.pickup_point_id}</div>}
          </div>

          <div class="field">
            <label>{t('allergies')}</label>
            <input class="input" value={form.allergies} placeholder={t('allergyPlaceholder')} onInput={(e) => set('allergies', e.currentTarget.value)} />
          </div>

          <div class="field">
            <label>{t('notes')}</label>
            <textarea class="input" rows={3} value={form.notes} onInput={(e) => set('notes', e.currentTarget.value)} />
          </div>

          <div style="display:flex;gap:8px;border-top:2px solid var(--color-text);padding-top:14px">
            <button class="btn btn-secondary" onClick={back}>{t('cancel')}</button>
            <button class="btn btn-primary" style="flex:1;justify-content:flex-start" onClick={onSave}>{t('saveStudent')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

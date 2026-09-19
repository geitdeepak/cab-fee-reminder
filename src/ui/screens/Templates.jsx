import { useState, useEffect } from 'preact/hooks';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/index.js';
import { useUi } from '../../state/ui.jsx';
import { saveTemplate } from '../../actions/reminders.js';
import { validateTemplate, composeMessage, KNOWN_PLACEHOLDERS } from '../../domain/reminders.js';
import { TopBar } from '../components/TopBar.jsx';

const SAMPLE_DATA = {
  parent_name: 'Rajesh', student_name: 'Aarav Sharma', class: 'IV', school: 'DPS',
  pickup_point: 'Alpha-1 Main Gate', amount: '1,600', period: 'Aug 2026', due_date: '05 Aug 2026',
  days_overdue: '12', operator_name: 'Ramesh Kumar', operator_phone: '9812345678', upi_id: 'ramesh@upi',
  pay_link: 'https://your-site/pay?pa=ramesh%40upi&am=1600',
  qr_note: 'QR code is message ke saath attached hai.',
  receipt_no: 'RCP-2026-0143', mode: 'UPI', paid_on: '18 Aug 2026'
};

export function Templates() {
  const { toast, t } = useUi();
  const templates = useLiveQuery(() => db.templates.toArray(), [], []);
  const [activeId, setActiveId] = useState('advance');
  const [body, setBody] = useState('');

  const current = templates.find((tp) => tp.id === activeId);

  useEffect(() => {
    if (current) setBody(current.body);
  }, [current?.id, current?.body]);

  const { valid, unknown } = validateTemplate(body);

  async function onChange(value) {
    setBody(value);
  }

  async function onSave() {
    try {
      await saveTemplate(activeId, body);
      toast('Saved ✓');
    } catch (e) {
      toast(e.message);
    }
  }

  return (
    <div style="min-height:100vh;display:flex;flex-direction:column">
      <TopBar title={t('templates')} eyebrow="S-11" />
      <div class="main-scroll scr">
        <div style="display:flex;overflow-x:auto;border-bottom:2px solid var(--color-text);background:var(--color-neutral-100)">
          {templates.map((tp) => (
            <button
              key={tp.id}
              onClick={() => setActiveId(tp.id)}
              style={`flex:1 0 auto;padding:12px 13px;border:0;font-size:12px;font-weight:700;white-space:nowrap;min-height:44px;${activeId === tp.id ? 'background:var(--color-text);color:#fff' : 'background:transparent;color:var(--color-neutral-800)'}`}
            >
              {tp.label}
            </button>
          ))}
        </div>
        <div class="screen-pad">
          <textarea class="input" rows={11} value={body} onInput={(e) => onChange(e.currentTarget.value)} style="font-size:13px;line-height:1.5" />
          {!valid && (
            <div style="border:2px solid var(--color-accent);background:var(--color-accent-100);color:var(--color-accent-900);padding:10px;font-size:12.5px;font-weight:700">
              Unrecognised placeholder {`{${unknown[0]}}`} — this will not save.
            </div>
          )}
          <div>
            <div class="section-title" style="margin-bottom:6px">{t('placeholders')}</div>
            <div class="chip-row">
              {KNOWN_PLACEHOLDERS.map((p) => (
                <button key={p} class="chip" onClick={() => setBody((b) => b + `{${p}}`)}>{`{${p}}`}</button>
              ))}
            </div>
          </div>
          <div class="card">
            <div style="padding:9px 12px;border-bottom:2px solid var(--color-text);font-size:10px;font-weight:700;text-transform:uppercase">{t('livePreview')}</div>
            <div style="padding:12px;white-space:pre-wrap;font-size:12.5px;line-height:1.5">{composeMessage(body, SAMPLE_DATA)}</div>
          </div>
          <button class="btn btn-primary btn-block" disabled={!valid} onClick={onSave}>{t('save')}</button>
        </div>
      </div>
    </div>
  );
}

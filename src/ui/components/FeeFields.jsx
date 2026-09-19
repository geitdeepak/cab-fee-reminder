import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/index.js';
import { useUi } from '../../state/ui.jsx';
import { billingStartDate } from '../../domain/dates.js';

export const DEFAULT_FEE = { planId: 'monthly', dueDay: 5, startChoice: 'month', paid: false, oldDues: '' };

export const startDateFor = billingStartDate;

export function FeeFields({ value, onChange }) {
  const { t } = useUi();
  const plans = useLiveQuery(() => db.fee_plans.toArray(), [], []);

  return (
    <>
      <div class="field">
        <label>{t('feePlan')}</label>
        <div style="display:flex;border:2px solid var(--color-text)">
          {plans.map((p) => (
            <button
              key={p.id}
              onClick={() => onChange({ planId: p.id })}
              style={`flex:1;padding:10px 8px;border:0;text-align:left;min-height:52px;${value.planId === p.id ? 'background:var(--color-text);color:#fff' : 'background:var(--color-neutral-100);color:var(--color-text)'}`}
            >
              <span style="display:block;font-size:13px;font-weight:700">{p.label}</span>
              <span style="display:block;font-size:10.5px;margin-top:2px;opacity:.8">{p.months} mo{p.discount_pct ? ` · −${p.discount_pct}%` : ''}</span>
            </button>
          ))}
        </div>
      </div>

      <div class="field">
        <label>{t('dueDay')}</label>
        <div class="chip-row">
          {[1, 5, 7, 10, 15, 20, 25, 28].map((d) => (
            <button key={d} class={`chip${value.dueDay === d ? ' active' : ''}`} onClick={() => onChange({ dueDay: d })}>{d}</button>
          ))}
        </div>
      </div>

      <div class="field">
        <label>{t('billFrom')}</label>
        <div class="chip-row">
          {[['today', t('startToday')], ['month', t('startMonth')], ['next', t('startNext')]].map(([key, label]) => (
            <button key={key} class={`chip${value.startChoice === key ? ' active' : ''}`} onClick={() => onChange({ startChoice: key })}>{label}</button>
          ))}
        </div>
      </div>

      <div class="field">
        <label>{t('thisMonthFee')}</label>
        <div class="chip-row">
          <button class={`chip${!value.paid ? ' active' : ''}`} onClick={() => onChange({ paid: false })}>{t('unpaid')}</button>
          <button class={`chip${value.paid ? ' active' : ''}`} onClick={() => onChange({ paid: true })}>{t('alreadyPaid')}</button>
        </div>
      </div>

      <div class="field">
        <label>{t('oldDues')}</label>
        <input class="input" inputMode="numeric" value={value.oldDues} onInput={(e) => onChange({ oldDues: e.currentTarget.value.replace(/\D/g, '') })} />
        <div style="font-size:11.5px;color:var(--color-neutral-700)">{t('oldDuesHelp')}</div>
      </div>
    </>
  );
}

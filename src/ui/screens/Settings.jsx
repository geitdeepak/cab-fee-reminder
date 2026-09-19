import { useState, useEffect } from 'preact/hooks';
import { useUi } from '../../state/ui.jsx';
import { useOperator, useSettingsMap } from '../../state/hooks.js';
import { saveOperatorProfile } from '../../actions/auth.js';
import { setSetting } from '../../actions/settings.js';
import { TopBar } from '../components/TopBar.jsx';
import { LangToggle } from '../components/LangToggle.jsx';

const STAGE_ROWS = [
  { key: 'advance', offset: 'D − 3' },
  { key: 'due', offset: 'D + 0' },
  { key: 'overdue', offset: 'D + 5' },
  { key: 'final', offset: 'D + 15' }
];

export function Settings() {
  const { lock, toast, t } = useUi();
  const operator = useOperator();
  const settingsMap = useSettingsMap();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (operator) {
      setName(operator.name || '');
      setPhone(operator.phone || '');
    }
  }, [operator?.id, operator?.name, operator?.phone]);

  async function saveProfile() {
    await saveOperatorProfile({ name, phone, business_name: operator?.business_name || '', upi_id: operator?.upi_id || '' });
    toast('Saved ✓');
  }

  if (!operator || !settingsMap) return <div style="min-height:100vh" />;

  return (
    <div style="min-height:100vh;display:flex;flex-direction:column">
      <TopBar title={t('settings')} eyebrow="S-14" />
      <div class="main-scroll scr">
        <div class="screen-pad">
          <div style="display:flex;flex-direction:column;gap:10px">
            <div class="section-title" style="border-bottom:2px solid var(--color-text);padding-bottom:7px">Language / Bhasha</div>
            <div><LangToggle /></div>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px">
            <div class="section-title" style="border-bottom:2px solid var(--color-text);padding-bottom:7px">{t('operatorProfile')}</div>
            <div class="field">
              <label>{t('yourName')}</label>
              <input class="input" value={name} onInput={(e) => setName(e.currentTarget.value)} onBlur={saveProfile} />
            </div>
            <div class="field">
              <label>{t('yourPhone')}</label>
              <input class="input" inputMode="numeric" value={phone} onInput={(e) => setPhone(e.currentTarget.value.replace(/\D/g, '').slice(0, 10))} onBlur={saveProfile} />
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px">
            <div class="section-title" style="border-bottom:2px solid var(--color-text);padding-bottom:7px">Billing</div>
            <div class="field">
              <label>{t('defaultDueDay')}</label>
              <div class="chip-row">
                {[1, 5, 7, 10, 15, 20, 25, 28].map((d) => (
                  <button
                    key={d}
                    class={`chip${settingsMap.default_due_day === d ? ' active' : ''}`}
                    onClick={() => setSetting('default_due_day', d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:2px">
            <div class="section-title" style="border-bottom:2px solid var(--color-text);padding-bottom:7px;margin-bottom:8px">{t('escalation')}</div>
            {STAGE_ROWS.map((s) => {
              const enabledKey = `stage_${s.key}_enabled`;
              const on = !!settingsMap[enabledKey];
              return (
                <button
                  key={s.key}
                  onClick={() => setSetting(enabledKey, !on)}
                  style="width:100%;text-align:left;display:flex;gap:11px;align-items:center;padding:11px 0;border:0;border-bottom:1px solid var(--color-neutral-300);background:transparent"
                >
                  <span style="flex:1;min-width:0">
                    <span style="display:block;font-weight:700;font-size:14px">{t(s.key === 'due' ? 'dueTodayStage' : s.key === 'final' ? 'finalNotice' : s.key)}</span>
                    <span style="display:block;font-size:11.5px;color:var(--color-neutral-700);margin-top:1px">{s.offset}</span>
                  </span>
                  <Switch on={on} />
                </button>
              );
            })}
            <button
              onClick={() => setSetting('quiet_hours_enabled', !settingsMap.quiet_hours_enabled)}
              style="width:100%;text-align:left;display:flex;gap:11px;align-items:center;padding:11px 0;border:0;border-bottom:1px solid var(--color-neutral-300);background:transparent"
            >
              <span style="flex:1;min-width:0">
                <span style="display:block;font-weight:700;font-size:14px">{t('quietHours')}</span>
                <span style="display:block;font-size:11.5px;color:var(--color-neutral-700);margin-top:1px">{t('quietNote')}</span>
              </span>
              <Switch on={!!settingsMap.quiet_hours_enabled} />
            </button>
          </div>

          <div style="display:flex;flex-direction:column;gap:9px">
            <div class="section-title" style="border-bottom:2px solid var(--color-text);padding-bottom:7px">{t('security')}</div>
            <button class="btn btn-secondary btn-block" onClick={lock}>{t('lockNow')}</button>
            <div style="font-size:11.5px;line-height:1.5;color:var(--color-neutral-700)">{t('mpinNote')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Switch({ on }) {
  return (
    <span style={`flex:0 0 46px;width:46px;height:26px;border:2px solid var(--color-text);display:flex;align-items:center;padding:2px;${on ? 'background:var(--color-accent);justify-content:flex-end' : 'background:var(--color-neutral-300);justify-content:flex-start'}`}>
      <span style={`display:block;width:18px;height:18px;background:${on ? '#fff' : 'var(--color-neutral-600)'}`} />
    </span>
  );
}

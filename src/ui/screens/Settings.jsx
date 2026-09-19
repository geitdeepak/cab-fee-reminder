import { useState, useEffect, useRef } from 'preact/hooks';
import { imageFileToDataUrl } from '../../lib/image.js';
import { isValidUpiId, buildPayLink } from '../../lib/payLink.js';
import { useUi } from '../../state/ui.jsx';
import { LANGUAGE_LABEL, normalizeLanguage } from '../../lib/languages.js';
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
  const [upi, setUpi] = useState('');
  const qrRef = useRef(null);

  useEffect(() => {
    if (operator) {
      setName(operator.name || '');
      setPhone(operator.phone || '');
      setUpi(operator.upi_id || '');
    }
  }, [operator?.id, operator?.name, operator?.phone, operator?.upi_id]);

  async function saveProfile() {
    const upiOk = !upi || isValidUpiId(upi);
    await saveOperatorProfile({ name, phone, business_name: operator?.business_name || '', upi_id: upiOk ? upi : operator?.upi_id || '' });
    toast(upiOk ? t('saved') : t('upiInvalid'));
  }

  async function onQrFile(e) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    try {
      await setSetting('payment_qr', await imageFileToDataUrl(file));
      toast(t('qrSaved'));
    } catch (err) {
      toast(err.message);
    }
  }

  async function removeQr() {
    await setSetting('payment_qr', null);
  }

  if (!operator || !settingsMap) return <div style="min-height:100vh" />;

  return (
    <div style="min-height:100vh;display:flex;flex-direction:column">
      <TopBar title={t('settings')} />
      <div class="main-scroll scr">
        <div class="screen-pad">
          <div style="display:flex;flex-direction:column;gap:10px">
            <div class="section-title" style="border-bottom:2px solid var(--color-text);padding-bottom:7px">{t('languageSection')}</div>
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
              <div style="font-size:11.5px;color:var(--color-neutral-700)">{t('phoneHelp')}</div>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px">
            <div class="section-title" style="border-bottom:2px solid var(--color-text);padding-bottom:7px">{t('paymentDetails')}</div>
            <div class="field">
              <label>{t('upiId')}</label>
              <input class="input" value={upi} placeholder="name@bank" autocapitalize="off" onInput={(e) => setUpi(e.currentTarget.value.trim())} onBlur={saveProfile} />
              <div style="font-size:11.5px;color:var(--color-neutral-700)">{t('upiHelp')}</div>
              {isValidUpiId(upi) && (
                <a
                  class="btn btn-secondary"
                  style="align-self:flex-start;text-decoration:none"
                  target="_blank"
                  rel="noopener"
                  href={buildPayLink({ baseUrl: window.location.origin, upiId: upi, amount: 1 })}
                >
                  {t('testPayLink')}
                </a>
              )}
            </div>
            <div class="field">
              <label>{t('paymentQr')}</label>
              {settingsMap.payment_qr && (
                <img src={settingsMap.payment_qr} alt="Payment QR" style="width:160px;height:160px;object-fit:contain;border:2px solid var(--color-text);background:#fff" />
              )}
              <input ref={qrRef} type="file" accept="image/*" style="display:none" onChange={onQrFile} />
              <div style="display:flex;gap:8px">
                <button class="btn btn-secondary" onClick={() => qrRef.current?.click()}>{settingsMap.payment_qr ? t('changeQr') : t('uploadQr')}</button>
                {settingsMap.payment_qr && <button class="btn btn-danger" onClick={removeQr}>{t('remove')}</button>}
              </div>
              {settingsMap.payment_qr && (
                <button
                  onClick={() => setSetting('attach_qr', settingsMap.attach_qr === false)}
                  style="width:100%;text-align:left;display:flex;gap:11px;align-items:center;padding:11px 0;border:0;border-top:1px solid var(--color-neutral-300);border-bottom:1px solid var(--color-neutral-300);background:transparent"
                >
                  <span style="flex:1;font-size:13px;font-weight:700">{t('attachQr')}</span>
                  <Switch on={settingsMap.attach_qr !== false} />
                </button>
              )}
              <div style="font-size:11.5px;line-height:1.5;color:var(--color-neutral-700)">{t('qrHelp')}</div>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px">
            <div class="section-title" style="border-bottom:2px solid var(--color-text);padding-bottom:7px">{t('reminderTo')}</div>
            <div class="chip-row">
              {[['father', t('father')], ['mother', t('mother')], ['both', t('both')]].map(([key, label]) => (
                <button key={key} class={`chip${(settingsMap.reminder_recipients || 'father') === key ? ' active' : ''}`} onClick={() => setSetting('reminder_recipients', key)}>
                  {label}
                </button>
              ))}
            </div>
            <div style="font-size:11.5px;line-height:1.5;color:var(--color-neutral-700)">{t('reminderToHelp')}</div>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px">
            <div class="section-title" style="border-bottom:2px solid var(--color-text);padding-bottom:7px">{t('messageLanguage')}</div>
            <div class="chip-row">
              {[['hindi', LANGUAGE_LABEL.hindi], ['english', LANGUAGE_LABEL.english]].map(([key, label]) => (
                <button key={key} class={`chip${normalizeLanguage(settingsMap.message_language) === key ? ' active' : ''}`} onClick={() => setSetting('message_language', key)}>
                  {label}
                </button>
              ))}
            </div>
            <div style="font-size:11.5px;line-height:1.5;color:var(--color-neutral-700)">{t('messageLanguageHelp')}</div>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px">
            <div class="section-title" style="border-bottom:2px solid var(--color-text);padding-bottom:7px">{t('billing')}</div>
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

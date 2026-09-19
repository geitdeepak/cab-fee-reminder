import { useEffect, useState } from 'preact/hooks';
import { useUi } from '../../state/ui.jsx';
import { setupMpin, verifyMpin, saveOperatorProfile, requestPersistence, lockoutSecondsLeft, recordMpinFailure, clearMpinFailures } from '../../actions/auth.js';
import { runInvoiceEngine } from '../../actions/billing.js';
import { LangToggle } from '../components/LangToggle.jsx';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];

export function Lock() {
  const { state, unlock, root, toast, t } = useUi();
  const isSetup = state.screen === 'setup';

  const [step, setStep] = useState('profile'); // setup: 'profile' -> 'mpin' -> 'confirm'
  const [name, setName] = useState('');
  const [business, setBusiness] = useState('');
  const [phone, setPhone] = useState('');
  const [firstMpin, setFirstMpin] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lockLeft, setLockLeft] = useState(() => lockoutSecondsLeft());

  useEffect(() => {
    if (lockLeft <= 0) return undefined;
    const timer = setInterval(() => setLockLeft(lockoutSecondsLeft()), 500);
    return () => clearInterval(timer);
  }, [lockLeft > 0]);

  useEffect(() => {
    setPin('');
    setError('');
  }, [step, isSetup]);

  async function finishProfile() {
    if (!name.trim()) {
      setError(t('required'));
      return;
    }
    setError('');
    setStep('mpin');
  }

  function tapDigit(d) {
    if (busy || lockLeft > 0) return;
    if (d === 'del') return setPin((p) => p.slice(0, -1));
    if (d === 'ok') return submit();
    setPin((p) => {
      const next = (p + d).slice(0, 4);
      if (next.length === 4) setTimeout(submit, 150, next);
      return next;
    });
  }

  async function submit(currentPin) {
    const value = currentPin ?? pin;
    if (value.length < 4) return;
    setBusy(true);

    if (isSetup) {
      if (step === 'mpin') {
        setFirstMpin(value);
        setStep('confirm');
        setPin('');
        setBusy(false);
        return;
      }
      if (step === 'confirm') {
        if (value !== firstMpin) {
          setError(t('mpinMismatch'));
          setShake(true);
          setTimeout(() => setShake(false), 400);
          setPin('');
          setBusy(false);
          return;
        }
        await saveOperatorProfile({ name: name.trim(), business_name: business.trim(), phone: phone.trim(), upi_id: '' });
        await setupMpin(value);
        await requestPersistence();
        toast(t('finishSetup'));
        unlock();
        setBusy(false);
        return;
      }
    } else {
      const ok = await verifyMpin(value);
      if (ok) {
        clearMpinFailures();
        runInvoiceEngine().catch(() => {}); // FR-05: engine runs on every launch
        unlock();
        setBusy(false);
        return;
      }
      recordMpinFailure();
      setLockLeft(lockoutSecondsLeft());
      setError(t('wrongMpin'));
      setShake(true);
      setTimeout(() => setShake(false), 400);
      setPin('');
    }
    setBusy(false);
  }

  if (isSetup && step === 'profile') {
    return (
      <div style="position:relative;min-height:100vh;min-height:100dvh;display:flex;flex-direction:column;justify-content:center;padding:32px 24px;background:var(--color-text);color:#fff;gap:16px">
        <div style="position:absolute;top:14px;right:14px"><LangToggle dark /></div>
        <div>
          <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;font-weight:700;color:var(--color-accent-200)">Cab Fee Reminder</div>
          <div style="font-weight:800;font-size:28px;line-height:1.1;margin-top:8px">{t('setupTitle')}</div>
          <div style="font-size:14px;line-height:1.5;color:var(--color-neutral-300);margin-top:10px">{t('setupHint')}</div>
        </div>
        <div class="field">
          <label style="color:#fff">{t('yourName')} *</label>
          <input class="input" value={name} onInput={(e) => setName(e.currentTarget.value)} />
        </div>
        <div class="field">
          <label style="color:#fff">{t('businessName')}</label>
          <input class="input" value={business} onInput={(e) => setBusiness(e.currentTarget.value)} />
        </div>
        <div class="field">
          <label style="color:#fff">{t('yourPhone')}</label>
          <input class="input" inputMode="numeric" value={phone} onInput={(e) => setPhone(e.currentTarget.value.replace(/\D/g, '').slice(0, 10))} />
        </div>
        {error && <div style="color:var(--color-accent-200);font-weight:700;font-size:13px">{error}</div>}
        <button class="btn btn-accent btn-block" onClick={finishProfile}>{t('finishSetup')} &rarr;</button>
      </div>
    );
  }

  const dots = [0, 1, 2, 3];
  const hint = isSetup ? (step === 'mpin' ? t('setMpin') : t('confirmMpin')) : t('lockHint');

  return (
    <div style="position:relative;min-height:100vh;min-height:100dvh;display:flex;flex-direction:column;justify-content:space-between;padding:48px 26px 30px;background:var(--color-text);color:var(--color-neutral-100)">
      <div style="position:absolute;top:14px;right:14px"><LangToggle dark /></div>
      <div>
        <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;font-weight:700;color:var(--color-accent-200)">
          {isSetup ? t('setupTitle') : t('lock')}
        </div>
        <div style="font-weight:800;font-size:30px;line-height:1.1;margin-top:10px">Cab Fee<br />Reminder</div>
        <div style="height:2px;background:var(--color-accent);margin:18px 0 14px;width:64px" />
        <div style="font-size:14px;line-height:1.5;color:var(--color-neutral-300);max-width:280px">{hint}</div>
      </div>
      <div>
        <div class={`pin-dots${shake ? ' shake' : ''}`} style="margin-bottom:14px">
          {dots.map((i) => (
            <div key={i} class={`pin-dot${pin.length > i ? ' filled' : ''}`} />
          ))}
        </div>
        {(lockLeft > 0 || error) && (
          <div style="font-size:13px;font-weight:700;color:var(--color-accent-200);margin-bottom:12px">
            {lockLeft > 0 ? `${t('lockedWait')} ${lockLeft}s` : error}
          </div>
        )}
        <div class="keypad" style={lockLeft > 0 ? 'opacity:.35;pointer-events:none' : ''}>
          {KEYS.map((k) => (
            <button key={k} onClick={() => tapDigit(k)}>
              {k === 'del' ? '⌫' : k === 'ok' ? '→' : k}
            </button>
          ))}
        </div>
        {!isSetup && <div style="font-size:11px;color:var(--color-neutral-400);margin-top:14px;line-height:1.5">{t('lockFoot')}</div>}
      </div>
    </div>
  );
}

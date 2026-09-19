import { useState, useRef } from 'preact/hooks';
import { useUi } from '../../state/ui.jsx';
import { previewImport, runImport } from '../../actions/importStudents.js';
import { TEMPLATE_CSV } from '../../lib/csv.js';
import { downloadDataUrl } from '../../lib/whatsapp.js';
import { TopBar } from '../components/TopBar.jsx';

const FIELD_LABEL = { name: 'name', class_name: 'class', pickup: 'pickup', father_phone: 'father_phone (or mother_phone)' };

export function ImportStudents() {
  const { root, toast, t, tf, te } = useUi();
  const [text, setText] = useState('');
  const [plan, setPlan] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  async function onFile(e) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    setText(await file.text());
    setPlan(null);
    setResult(null);
  }

  async function onCheck() {
    setBusy(true);
    try {
      setPlan(await previewImport(text));
      setResult(null);
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function onImport() {
    setBusy(true);
    try {
      const res = await runImport(plan);
      setResult(res);
      setPlan(null);
      setText('');
      toast(`${res.created} ${t('importDone')} ✓`);
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  }

  function onTemplate() {
    const url = 'data:text/csv;charset=utf-8,' + encodeURIComponent(TEMPLATE_CSV);
    downloadDataUrl(url, 'students-sample.csv');
  }

  return (
    <div style="min-height:100vh;display:flex;flex-direction:column">
      <TopBar title={t('importStudents')} />
      <div class="main-scroll scr">
        <div class="screen-pad">
          <div style="font-size:12.5px;line-height:1.55;color:var(--color-neutral-800)">{t('importIntro')}</div>

          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" style="display:none" onChange={onFile} />
            <button class="btn btn-secondary" onClick={() => fileRef.current?.click()}>{t('chooseCsv')}</button>
            <button class="btn btn-ghost" onClick={onTemplate}>{t('downloadTemplate')}</button>
          </div>

          <div class="field">
            <label>{t('orPaste')}</label>
            <textarea
              class="input"
              rows={7}
              value={text}
              placeholder={'name,class,father_phone,pickup,fare,paid,old_dues'}
              onInput={(e) => { setText(e.currentTarget.value); setPlan(null); }}
              style="font-size:12.5px"
            />
          </div>

          <button class="btn btn-primary btn-block" disabled={busy || !text.trim()} onClick={onCheck}>{t('checkFile')}</button>

          {plan && (
            <div style="display:flex;flex-direction:column;gap:12px">
              {plan.missing.length > 0 && (
                <div class="banner banner-amber">
                  {t('missingColumns')} {plan.missing.map((m) => FIELD_LABEL[m] || m).join(', ')}
                </div>
              )}
              {plan.unknownHeaders.length > 0 && (
                <div style="font-size:12px;color:var(--color-neutral-700)">{t('ignoredColumns')} {plan.unknownHeaders.join(', ')}</div>
              )}

              <div class="card card-tight" style="display:flex;flex-direction:column;gap:6px;font-size:13.5px">
                <div>{tf('readyToAdd', { n: plan.ready.length })}</div>
                {plan.duplicates.length > 0 && <div>{tf('alreadyInApp', { n: plan.duplicates.length })}</div>}
                {plan.invalid.length > 0 && <div style="color:var(--color-accent-700)">{tf('haveProblems', { n: plan.invalid.length })}</div>}
                {plan.newPickups.length > 0 && (
                  <div style="font-size:12px;color:var(--color-neutral-700)">
                    {t('newPickupsCreated')} {plan.newPickups.map((p) => `${p.name} (₹${p.fare})`).join(', ')}
                  </div>
                )}
              </div>

              {plan.invalid.slice(0, 25).map((i) => (
                <div key={i.line} style="border:2px solid var(--color-accent);background:var(--color-accent-100);padding:9px 11px;font-size:12.5px">
                  <b>{tf('rowN', { n: i.line })}{i.student.name ? ` · ${i.student.name}` : ''}</b>
                  <div>{i.errors.map(te).join('; ')}</div>
                </div>
              ))}
              {plan.invalid.length > 25 && <div style="font-size:12px">{tf('andMore', { n: plan.invalid.length - 25 })}</div>}

              <button class="btn btn-accent btn-block" disabled={busy || plan.ready.length === 0} onClick={onImport}>
                {t('importNow')} ({plan.ready.length})
              </button>
            </div>
          )}

          {result && (
            <div class="card card-tight" style="display:flex;flex-direction:column;gap:8px">
              <div style="font-weight:800;font-size:16px">{result.created} {t('importDone')}</div>
              {result.failures.map((f) => (
                <div key={f.line} style="font-size:12.5px;color:var(--color-accent-700)">{tf('rowN', { n: f.line })}: {te(f.message)}</div>
              ))}
              <button class="btn btn-primary" onClick={() => root('students')}>{t('students')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

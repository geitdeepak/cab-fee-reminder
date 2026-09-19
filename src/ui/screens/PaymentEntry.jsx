import { useState, useEffect } from 'preact/hooks';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/index.js';
import { useUi } from '../../state/ui.jsx';
import { getInvoice, recordPayment, balanceOf } from '../../actions/billing.js';
import { useOperator } from '../../state/hooks.js';
import { formatCurrency } from '../../lib/format.js';
import { todayISO, formatDateHuman, formatPeriodHuman } from '../../domain/dates.js';
import { composeMessage } from '../../domain/reminders.js';
import { getTemplateBody, manualRowsForInvoice, dispatchReminder } from '../../actions/reminders.js';
import { getSettingsMap } from '../../actions/settings.js';
import { openWhatsApp } from '../../lib/whatsapp.js';
import { TopBar } from '../components/TopBar.jsx';

const MODES = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];

export function PaymentEntry() {
  const { state, root, toast, t } = useUi();
  const invoiceId = state.params?.invoiceId;
  const invoice = useLiveQuery(() => getInvoice(invoiceId), [invoiceId], null);
  const student = useLiveQuery(() => (invoice ? db.students.get(invoice.student_id) : null), [invoice?.student_id], null);
  const operator = useOperator();
  const reminderRows = useLiveQuery(() => manualRowsForInvoice(invoiceId), [invoiceId, invoice?.status], []);

  async function onRemind(row) {
    await dispatchReminder(row);
    toast(t('openWhatsApp') + ' ✓');
  }

  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('UPI');
  const [reference, setReference] = useState('');
  const [done, setDone] = useState(null); // { receipt_no, paid_amount }

  useEffect(() => {
    if (invoice) setAmount(String(balanceOf(invoice)));
  }, [invoice?.id]);

  if (!invoice || !student) return <div style="min-height:100vh" />;

  const balance = balanceOf(invoice);
  const amountNum = Number(amount) || 0;

  async function onSave() {
    try {
      const result = await recordPayment({ invoice_id: invoiceId, amount: amountNum, mode, reference, paid_on: todayISO() });
      setDone(result);
    } catch (e) {
      toast(e.message);
    }
  }

  async function onShareReceipt() {
    const body = await getTemplateBody('receipt');
    const message = composeMessage(body, {
      parent_name: (student.father_name || student.mother_name || '').split(' ')[0],
      receipt_no: done.receipt_no,
      student_name: student.name,
      class: student.class_name,
      period: formatPeriodHuman(invoice.period_start, invoice.period_end),
      amount: amountNum.toLocaleString('en-IN'),
      mode,
      paid_on: formatDateHuman(todayISO()),
      operator_name: operator?.name || ''
    });
    const settingsMap = await getSettingsMap();
    openWhatsApp(student.father_phone || student.mother_phone, message, settingsMap.country_code || '91');
  }

  if (done) {
    return (
      <div style="min-height:100vh;display:flex;flex-direction:column">
        <TopBar title={t('payment')} eyebrow="S-10" />
        <div class="main-scroll scr">
          <div class="screen-pad">
            <div style="border:2px solid var(--color-text);background:var(--color-success);color:#fff;padding:14px">
              <div class="section-title">{t('paymentSaved')}</div>
              <div style="font-weight:800;font-size:30px;margin-top:7px">{formatCurrency(amountNum)}</div>
              <div style="font-size:13px;margin-top:6px">{done.status === 'paid' ? 'Invoice settled and out of the queue.' : `Balance remaining: ${formatCurrency(invoice.amount - done.paid_amount)}`}</div>
            </div>
            <div class="card card-tight">
              <div class="stat-label" style="margin-bottom:8px">{t('receiptPreview')}</div>
              <div style="font-size:12.5px;line-height:1.6">
                Receipt: {done.receipt_no}<br />
                {student.name} ({student.class_name})<br />
                {formatPeriodHuman(invoice.period_start, invoice.period_end)}<br />
                {formatCurrency(amountNum)} · {mode}
              </div>
            </div>
            <button class="btn btn-accent btn-block" onClick={onShareReceipt}>{t('shareReceipt')}</button>
            <button class="btn btn-secondary btn-block" onClick={() => root('student', { studentId: student.id, tab: 'ledger' })}>{t('done')}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style="min-height:100vh;display:flex;flex-direction:column">
      <TopBar title={t('payment')} eyebrow="S-10" />
      <div class="main-scroll scr">
        <div class="screen-pad">
          <div class="card card-tight">
            <div class="stat-label">{t('settling')}</div>
            <div style="font-weight:800;font-size:18px;margin-top:3px">{student.name}</div>
            <div style="font-size:12px;color:var(--color-neutral-700);margin-top:2px">
              {formatPeriodHuman(invoice.period_start, invoice.period_end)} · due {formatDateHuman(invoice.due_date)} · {formatCurrency(balance)}
            </div>
          </div>

          <div class="field">
            <label>{t('amountReceived')}</label>
            <input class="input" inputMode="numeric" style="font-weight:800;font-size:22px" value={amount} onInput={(e) => setAmount(e.currentTarget.value.replace(/\D/g, ''))} />
            <div style="font-size:11.5px;color:var(--color-neutral-700)">
              {amountNum < balance
                ? `Part payment — balance ${formatCurrency(balance - amountNum)} stays in the queue.`
                : 'Full amount — the invoice will be settled.'}
            </div>
          </div>

          <div class="field">
            <label>{t('mode')}</label>
            <div class="chip-row">
              {MODES.map((m) => (
                <button key={m} class={`chip${mode === m ? ' active' : ''}`} onClick={() => setMode(m)}>{m}</button>
              ))}
            </div>
          </div>

          <div class="field">
            <label>{t('reference')}</label>
            <input class="input" value={reference} placeholder={t('refPlaceholder')} onInput={(e) => setReference(e.currentTarget.value)} />
          </div>

          <button class="btn btn-primary btn-block" disabled={!(amountNum > 0)} onClick={onSave}>{t('savePayment')}</button>

          {reminderRows.length > 0 && (
            <div class="card card-tight" style="display:flex;flex-direction:column;gap:8px">
              <div class="section-title">{t('sendReminderNow')}</div>
              <div style="font-size:11.5px;color:var(--color-neutral-700)">{t('sendReminderNowHelp')}</div>
              {reminderRows.map((row) => (
                <button key={row.key} class="btn btn-accent btn-block" onClick={() => onRemind(row)}>
                  {t('send')} → {row.recipient_name} · {row.recipient_phone}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

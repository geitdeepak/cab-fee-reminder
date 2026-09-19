// FR-04 (enrolment/fare locking), FR-05 (invoice engine), FR-06 (payments).
import { db } from '../db/index.js';
import { uuid } from '../lib/id.js';
import { computeCycleAmount } from '../domain/fees.js';
import { planInvoiceGeneration, planAgeing, outstandingBalance } from '../domain/invoices.js';
import { todayISO, compareISO, addMonths, addDays } from '../domain/dates.js';

// ---------- Enrolment (FR-04) ----------

export async function getActiveEnrolment(studentId) {
  return db.enrolments.where({ student_id: studentId, status: 'active' }).first();
}

export async function listEnrolmentsForStudent(studentId) {
  return db.enrolments.where('student_id').equals(studentId).reverse().sortBy('created_at');
}

/** Creates a fresh, fare-locked enrolment. If the student already has an
 * active enrolment it is ended first (FR-04: "the operator explicitly uses
 * Re-price Enrolment, which records the change with a date") — past
 * invoices keep referencing the old enrolment_id and its locked fare. */
export async function saveEnrolment({ student_id, pickup_point_id, fee_plan_id, due_day, start_date }) {
  const pickup = await db.pickup_points.get(pickup_point_id);
  if (!pickup) throw new Error('Pickup point not found.');
  const plan = await db.fee_plans.get(fee_plan_id);
  if (!plan) throw new Error('Fee plan not found.');

  const locked_fare = pickup.monthly_fare;
  const cycle_amount = computeCycleAmount(locked_fare, plan.months, plan.discount_pct);
  const now = new Date().toISOString();

  const prior = await getActiveEnrolment(student_id);
  if (prior) {
    await db.enrolments.update(prior.id, { status: 'ended', ended_on: todayISO() });
    // Re-enrolling must not leave a second, overlapping bill behind: cancel the old
    // enrolment's untouched invoices that start on/after the new start date.
    // Earlier unpaid invoices stay — those are genuine dues.
    const stale = await db.invoices
      .where('enrolment_id')
      .equals(prior.id)
      .filter((i) => (i.status === 'pending' || i.status === 'overdue') && !i.paid_amount && compareISO(i.period_start, start_date) >= 0)
      .toArray();
    for (const inv of stale) {
      await db.invoices.update(inv.id, { status: 'cancelled', cancel_reason: 'Replaced by a new enrolment' });
    }
  }

  const id = uuid();
  await db.enrolments.add({
    id,
    student_id,
    pickup_point_id,
    fee_plan_id,
    locked_fare,
    cycle_amount,
    start_date,
    due_day: Math.min(28, Math.max(1, Number(due_day) || 5)),
    next_period_start: start_date,
    status: 'active',
    ended_on: null,
    created_at: now
  });
  return id;
}

/**
 * Enrolment for a student who is already travelling: the driver says whether
 * the current cycle is already paid and whether older money is still owed,
 * instead of the app back-filling months of history.
 * - thisMonthPaid: the first invoice is created already settled (no payment
 *   row, so it does not inflate this month's "collected").
 * - oldDues: one extra "previous dues" invoice, due today, so the normal
 *   reminder ladder starts from now rather than from an unknown old date.
 */
export async function saveEnrolmentWithOpening({ thisMonthPaid = false, oldDues = 0, ...enrolment }) {
  const enrolmentId = await saveEnrolment(enrolment);
  await runInvoiceEngine();

  const enr = await db.enrolments.get(enrolmentId);
  const plan = await db.fee_plans.get(enr.fee_plan_id);

  if (thisMonthPaid) {
    const first = await db.invoices.where('[enrolment_id+period_start]').equals([enrolmentId, enr.start_date]).first();
    if (first) await db.invoices.update(first.id, { paid_amount: first.amount, status: 'paid', opening: true });
  }

  const dues = Math.round(Number(oldDues) || 0);
  if (dues > 0) {
    await db.invoices.add({
      id: uuid(),
      enrolment_id: enrolmentId,
      student_id: enr.student_id,
      period_start: addMonths(enr.start_date, -plan.months),
      period_end: addDays(enr.start_date, -1),
      amount: dues,
      paid_amount: 0,
      due_date: todayISO(),
      status: 'pending',
      cancel_reason: null,
      opening: true,
      created_at: new Date().toISOString()
    });
  }
  return enrolmentId;
}

export async function endEnrolment(id) {
  await db.enrolments.update(id, { status: 'ended', ended_on: todayISO() });
}

// ---------- Invoice engine (FR-05, Section 7) ----------

export async function runInvoiceEngine() {
  const today = todayISO();
  return db.transaction('rw', db.enrolments, db.invoices, db.fee_plans, db.meta, async () => {
    const enrolments = await db.enrolments.where('status').equals('active').toArray();
    const feePlanRows = await db.fee_plans.toArray();
    const feePlansById = new Map(feePlanRows.map((p) => [p.id, p]));
    const allInvoices = await db.invoices.toArray();

    const existingPeriodStartsByEnrolment = new Map();
    for (const inv of allInvoices) {
      const set = existingPeriodStartsByEnrolment.get(inv.enrolment_id) || new Set();
      set.add(inv.period_start);
      existingPeriodStartsByEnrolment.set(inv.enrolment_id, set);
    }

    const { newInvoices, enrolmentUpdates } = planInvoiceGeneration({
      enrolments,
      existingPeriodStartsByEnrolment,
      feePlansById,
      today,
      horizonDays: 15
    });

    const now = new Date().toISOString();
    const rowsToAdd = newInvoices.map((inv) => ({ id: uuid(), created_at: now, ...inv }));
    if (rowsToAdd.length) {
      try {
        await db.invoices.bulkAdd(rowsToAdd);
      } catch (e) {
        // A constraint violation here means the unique [enrolment_id+period_start]
        // index caught a would-be duplicate — the safety net the engine relies on.
        if (e.name !== 'BulkError') throw e;
      }
    }
    for (const upd of enrolmentUpdates) {
      await db.enrolments.update(upd.id, { next_period_start: upd.next_period_start });
    }

    const combined = allInvoices.concat(rowsToAdd);
    const agedIds = planAgeing(combined, today);
    for (const id of agedIds) {
      await db.invoices.update(id, { status: 'overdue' });
    }

    await db.meta.put({ key: 'last_invoice_run', value: now });
    return { generated: rowsToAdd.length, aged: agedIds.length };
  });
}

// ---------- Invoices ----------

export async function listInvoices() {
  return db.invoices.toArray();
}

export async function invoicesForStudent(studentId) {
  return db.invoices.where('student_id').equals(studentId).reverse().sortBy('period_start');
}

export async function getInvoice(id) {
  return db.invoices.get(id);
}

export async function cancelInvoice(id, reason) {
  await db.invoices.update(id, { status: 'cancelled', cancel_reason: reason || '' });
}

// ---------- Payments (FR-06) ----------

async function nextReceiptNo(year) {
  const prefix = `RCP-${year}-`;
  const rows = await db.payments.where('receipt_no').startsWith(prefix).toArray();
  let max = 0;
  for (const r of rows) {
    const n = Number(r.receipt_no.slice(prefix.length));
    if (n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

export async function recordPayment({ invoice_id, amount, mode, reference, paid_on, remarks }) {
  const amt = Math.round(Number(amount));
  if (!(amt > 0)) throw new Error('Enter an amount greater than zero.');

  return db.transaction('rw', db.invoices, db.payments, async () => {
    const invoice = await db.invoices.get(invoice_id);
    if (!invoice) throw new Error('Invoice not found.');

    const year = (paid_on || todayISO()).slice(0, 4);
    const receipt_no = await nextReceiptNo(year);
    const id = uuid();
    const now = new Date().toISOString();

    await db.payments.add({
      id,
      invoice_id,
      amount: amt,
      mode: mode || 'Cash',
      reference: (reference || '').trim(),
      paid_on: paid_on || todayISO(),
      receipt_no,
      remarks: (remarks || '').trim(),
      reversed: false,
      created_at: now
    });

    const paidTotal = (invoice.paid_amount || 0) + amt;
    const status = paidTotal >= invoice.amount ? 'paid' : 'partial';
    await db.invoices.update(invoice_id, { paid_amount: paidTotal, status });

    return { receipt_no, paid_amount: paidTotal, status, payment_id: id };
  });
}

export async function listPayments(invoiceId) {
  return db.payments.where('invoice_id').equals(invoiceId).reverse().sortBy('created_at');
}

export async function reversePayment(paymentId) {
  return db.transaction('rw', db.invoices, db.payments, async () => {
    const payment = await db.payments.get(paymentId);
    if (!payment) throw new Error('Payment not found.');
    const ageDays = (Date.now() - new Date(payment.created_at).getTime()) / 86400000;
    if (ageDays > 30) throw new Error('Payments older than 30 days cannot be reversed here.');

    await db.payments.update(paymentId, { reversed: true });
    const remaining = await db.payments.where('invoice_id').equals(payment.invoice_id).toArray();
    const paidTotal = remaining.filter((p) => !p.reversed).reduce((s, p) => s + p.amount, 0);

    const invoice = await db.invoices.get(payment.invoice_id);
    const today = todayISO();
    let status = 'pending';
    if (paidTotal > 0 && paidTotal < invoice.amount) status = 'partial';
    else if (paidTotal >= invoice.amount) status = 'paid';
    else status = compareISO(invoice.due_date, today) < 0 ? 'overdue' : 'pending';

    await db.invoices.update(payment.invoice_id, { paid_amount: paidTotal, status });
  });
}

export function balanceOf(invoice) {
  return outstandingBalance(invoice);
}

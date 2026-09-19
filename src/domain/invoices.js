// FR-05 / Section 7: the invoice engine. Pure functions only — no IndexedDB
// calls here (12.5) — so they can run in a unit test 100 times in a row and
// prove idempotency (12.6).
import { addMonths, addDays, periodEnd, dueDate, compareISO, daysBetween } from './dates.js';

/**
 * Plan every invoice that should exist for a set of active enrolments, given
 * what already exists. Never proposes a period_start already present in
 * existingPeriodStartsByEnrolment (the real backstop is the DB's unique
 * index on [enrolment_id + period_start], but the engine must not even try).
 *
 * @param {object} args
 * @param {Array} args.enrolments - active enrolments with {id, student_id, fee_plan_id, cycle_amount, due_day, start_date, next_period_start, status}
 * @param {Map<string, Set<string>>} args.existingPeriodStartsByEnrolment
 * @param {Map<string, {months:number}>} args.feePlansById
 * @param {string} args.today - ISO date
 * @param {number} [args.horizonDays=15]
 */
export function planInvoiceGeneration({
  enrolments,
  existingPeriodStartsByEnrolment,
  feePlansById,
  today,
  horizonDays = 15
}) {
  const horizon = addDays(today, horizonDays);
  const newInvoices = [];
  const enrolmentUpdates = [];

  for (const enr of enrolments) {
    if (enr.status !== 'active') continue;
    const plan = feePlansById.get(enr.fee_plan_id);
    if (!plan) continue;
    const already = existingPeriodStartsByEnrolment.get(enr.id) || new Set();
    let cursor = enr.next_period_start || enr.start_date;
    let advanced = false;

    while (compareISO(cursor, horizon) <= 0) {
      if (!already.has(cursor)) {
        const pEnd = periodEnd(cursor, plan.months);
        const due = dueDate(cursor, enr.due_day);
        newInvoices.push({
          enrolment_id: enr.id,
          student_id: enr.student_id,
          period_start: cursor,
          period_end: pEnd,
          amount: enr.cycle_amount,
          paid_amount: 0,
          due_date: due,
          status: 'pending',
          cancel_reason: null
        });
      }
      cursor = addMonths(cursor, plan.months);
      advanced = true;
    }

    if (advanced) {
      enrolmentUpdates.push({ id: enr.id, next_period_start: cursor });
    }
  }

  return { newInvoices, enrolmentUpdates };
}

/** Pending invoices whose due date has passed become Overdue (7.1 Pass 2). */
export function planAgeing(invoices, today) {
  return invoices
    .filter((inv) => inv.status === 'pending' && compareISO(inv.due_date, today) < 0)
    .map((inv) => inv.id);
}

export function isSettled(invoice) {
  return invoice.status === 'paid' || invoice.status === 'cancelled';
}

export function outstandingBalance(invoice) {
  return Math.max(0, invoice.amount - (invoice.paid_amount || 0));
}

export function daysOverdue(invoice, today) {
  if (isSettled(invoice)) return 0;
  const d = daysBetween(invoice.due_date, today);
  return d > 0 ? d : 0;
}

// FR-13.
import { db } from '../db/index.js';
import { outstandingBalance, daysOverdue, isSettled } from '../domain/invoices.js';
import { todayISO, formatDateHuman } from '../domain/dates.js';
import { formatCurrency } from '../lib/format.js';

/** Monthly collection summary: billed = invoices due this month, collected
 * = payments recorded this month, outstanding = balance on invoices due
 * this month. Grouped by each student's current pickup point (FR-13). */
export async function monthlyReport(monthPrefix = todayISO().slice(0, 7)) {
  const [invoices, payments, students, pickupPoints] = await Promise.all([
    db.invoices.toArray(),
    db.payments.toArray(),
    db.students.toArray(),
    db.pickup_points.toArray()
  ]);
  const studentsById = new Map(students.map((s) => [s.id, s]));
  const pickupNameById = new Map(pickupPoints.map((p) => [p.id, p.name]));

  const dueThisMonth = invoices.filter((i) => i.status !== 'cancelled' && i.due_date.startsWith(monthPrefix));
  const billed = dueThisMonth.reduce((s, i) => s + i.amount, 0);
  const outstanding = dueThisMonth.reduce((s, i) => s + outstandingBalance(i), 0);
  const collected = payments
    .filter((p) => !p.reversed && p.paid_on.startsWith(monthPrefix))
    .reduce((s, p) => s + p.amount, 0);

  const byPoint = new Map();
  for (const inv of dueThisMonth) {
    const student = studentsById.get(inv.student_id);
    const pointId = student?.pickup_point_id;
    const name = pickupNameById.get(pointId) || 'Unassigned';
    const row = byPoint.get(name) || { point: name, billed: 0, due: 0 };
    row.billed += inv.amount;
    row.due += outstandingBalance(inv);
    byPoint.set(name, row);
  }

  return {
    monthPrefix,
    billed,
    collected,
    outstanding,
    collectionRatePct: billed > 0 ? Math.round((collected / billed) * 100) : 0,
    byPoint: [...byPoint.values()].sort((a, b) => b.billed - a.billed)
  };
}

/** Defaulter list: students with any invoice more than 30 days overdue. */
export async function defaulters() {
  const [invoices, students] = await Promise.all([db.invoices.toArray(), db.students.toArray()]);
  const studentsById = new Map(students.map((s) => [s.id, s]));
  const today = todayISO();
  const worstByStudent = new Map();

  for (const inv of invoices) {
    if (isSettled(inv)) continue;
    const d = daysOverdue(inv, today);
    if (d <= 30) continue;
    const cur = worstByStudent.get(inv.student_id);
    if (!cur || d > cur.days) worstByStudent.set(inv.student_id, { invoice: inv, days: d });
  }

  return [...worstByStudent.entries()]
    .map(([studentId, { invoice, days }]) => {
      const s = studentsById.get(studentId);
      return {
        student_id: studentId,
        name: s?.name || '—',
        class_name: s?.class_name || '',
        amount: outstandingBalance(invoice),
        days,
        period_start: invoice.period_start
      };
    })
    .sort((a, b) => b.days - a.days);
}

export async function studentLedgerText(studentId, operatorName = '') {
  const [student, invoices, payments] = await Promise.all([
    db.students.get(studentId),
    db.invoices.where('student_id').equals(studentId).sortBy('period_start'),
    db.payments.toArray()
  ]);
  if (!student) return '';
  const paymentsByInvoice = new Map();
  for (const p of payments) {
    if (p.reversed) continue;
    const arr = paymentsByInvoice.get(p.invoice_id) || [];
    arr.push(p);
    paymentsByInvoice.set(p.invoice_id, arr);
  }

  const lines = [`${student.name} (${student.class_name}) — Ledger`, ''];
  for (const inv of invoices.reverse()) {
    lines.push(`${formatDateHuman(inv.period_start)} – ${formatDateHuman(inv.period_end)}  ${formatCurrency(inv.amount)}  [${inv.status}]`);
    for (const p of paymentsByInvoice.get(inv.id) || []) {
      lines.push(`   paid ${formatCurrency(p.amount)} · ${p.mode} · ${formatDateHuman(p.paid_on)} · ${p.receipt_no}`);
    }
  }
  if (operatorName) lines.push('', operatorName);
  return lines.join('\n');
}

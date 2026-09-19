// FR-09.
import { db } from '../db/index.js';
import { outstandingBalance, isSettled } from '../domain/invoices.js';
import { todayISO, addDays, compareISO, formatDateHuman } from '../domain/dates.js';
import { buildQueue } from './reminders.js';

export async function dashboardSnapshot() {
  const today = todayISO();
  const monthPrefix = today.slice(0, 7);
  const horizon = addDays(today, 7);

  const [invoices, students, payments, { rows: queueRows }] = await Promise.all([
    db.invoices.toArray(),
    db.students.toArray(),
    db.payments.toArray(),
    buildQueue()
  ]);
  const studentsById = new Map(students.map((s) => [s.id, s]));

  let outstanding = 0;
  let overdue = 0;
  for (const inv of invoices) {
    if (isSettled(inv)) continue;
    const bal = outstandingBalance(inv);
    outstanding += bal;
    if (compareISO(inv.due_date, today) < 0) overdue += bal;
  }

  const collectedThisMonth = payments
    .filter((p) => !p.reversed && p.paid_on.startsWith(monthPrefix))
    .reduce((s, p) => s + p.amount, 0);

  const activeStudents = students.filter((s) => s.status === 'active').length;

  const dueThisWeek = invoices
    .filter((inv) => !isSettled(inv) && compareISO(inv.due_date, today) >= 0 && compareISO(inv.due_date, horizon) <= 0)
    .map((inv) => {
      const s = studentsById.get(inv.student_id);
      return {
        student_id: inv.student_id,
        name: s?.name || '—',
        class_name: s?.class_name || '',
        amount: outstandingBalance(inv),
        due_date: inv.due_date,
        due_date_human: formatDateHuman(inv.due_date)
      };
    })
    .sort((a, b) => (a.due_date < b.due_date ? -1 : 1));

  const pendingReminderCount = new Set(queueRows.map((r) => r.key)).size;

  return {
    pendingReminderCount,
    outstanding,
    overdue,
    collectedThisMonth,
    activeStudents,
    dueThisWeek,
    dueThisWeekTotal: dueThisWeek.reduce((s, r) => s + r.amount, 0)
  };
}

// Integration test: real actions layer + real Dexie (fake-indexeddb).
// Covers what pure-domain tests can't: Dexie query shapes, unique indexes,
// transactions, and the pickup -> student -> enrolment -> invoice ->
// reminder -> payment lifecycle end to end.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeAll } from 'vitest';
import { ready, db } from '../src/db/index.js';
import { savePickupPoint, removePickupPoint, countEnrolledAt } from '../src/actions/pickups.js';
import { saveStudent } from '../src/actions/students.js';
import { saveEnrolment, saveEnrolmentWithOpening, runInvoiceEngine, recordPayment, getActiveEnrolment } from '../src/actions/billing.js';
import { buildQueue, dispatchReminder, skipReminder, manualRowsForInvoice } from '../src/actions/reminders.js';
import { previewImport, runImport } from '../src/actions/importStudents.js';
import { setSetting } from '../src/actions/settings.js';
import { addDays, todayISO, billingStartDate } from '../src/domain/dates.js';

// window.open is called by dispatchReminder
globalThis.window = globalThis.window || {};
globalThis.window.open = () => {};

let pickupId;
let studentId;

beforeAll(async () => {
  await ready();
  await setSetting('quiet_hours_enabled', false); // don't let wall-clock time affect the test
  await setSetting('reminder_recipients', 'both');
  await db.operator.update('self', { name: 'Ramesh', phone: '9812345678' });
});

describe('billing + reminder lifecycle', () => {
  it('creates a pickup point and rejects a duplicate name (case-insensitive)', async () => {
    pickupId = await savePickupPoint({ name: 'Alpha-1 Main Gate', monthly_fare: 1600, active: true });
    await expect(savePickupPoint({ name: 'alpha-1 main gate', monthly_fare: 1500 })).rejects.toThrow(/already exists/);
  });

  it('rejects a student with no valid parent number, accepts a valid one', async () => {
    const base = {
      name: 'Aarav Sharma', class_name: 'IV', school_name: 'DPS',
      father_name: 'Rajesh Sharma', mother_name: 'Sunita Sharma',
      emergency_phone: '9876543210', pickup_point_id: pickupId
    };
    await expect(saveStudent({ ...base, father_phone: '12345', mother_phone: '' })).rejects.toMatchObject({
      fieldErrors: expect.objectContaining({ father_phone: expect.any(String) })
    });
    studentId = await saveStudent({ ...base, father_phone: '9876543210', mother_phone: '9811223344' });
    expect(studentId).toBeTruthy();
  });

  it('locks the fare at enrolment (quarterly, 5% => 4560)', async () => {
    await saveEnrolment({
      student_id: studentId, pickup_point_id: pickupId, fee_plan_id: 'quarterly',
      due_day: 5, start_date: addDays(todayISO(), -20)
    });
    const enr = await getActiveEnrolment(studentId);
    expect(enr.locked_fare).toBe(1600);
    expect(enr.cycle_amount).toBe(4560);

    // Raising the pickup fare later must not change the locked enrolment.
    await savePickupPoint({ id: pickupId, name: 'Alpha-1 Main Gate', monthly_fare: 1750, active: true });
    expect((await getActiveEnrolment(studentId)).cycle_amount).toBe(4560);
  });

  it('invoice engine is idempotent across repeated runs (unique index backstop)', async () => {
    for (let i = 0; i < 5; i++) await runInvoiceEngine();
    const invoices = await db.invoices.toArray();
    const periodStarts = invoices.map((i) => i.period_start);
    expect(new Set(periodStarts).size).toBe(periodStarts.length);
    expect(invoices.length).toBeGreaterThanOrEqual(1);
    expect(invoices[0].amount).toBe(4560);
  });

  it('queues reminders once the stage is reached, and never duplicates a dispatched/skipped one', async () => {
    let { rows } = await buildQueue();
    expect(rows.length).toBeGreaterThan(0);

    const fatherRow = rows.find((r) => r.recipient_type === 'father');
    await dispatchReminder(fatherRow);
    const motherRow = rows.find((r) => r.recipient_type === 'mother' && r.stage === fatherRow.stage);
    await skipReminder(motherRow, 'spoke on phone');

    ({ rows } = await buildQueue());
    expect(rows.some((r) => r.key === fatherRow.key)).toBe(false);
    expect(rows.some((r) => r.key === motherRow.key)).toBe(false);

    const log = await db.reminder_log.toArray();
    expect(log.find((l) => l.status === 'dispatched').message_text).toContain('Aarav Sharma');
  });

  it('part payment keeps the invoice open; full payment settles it and clears the queue', async () => {
    const invoice = (await db.invoices.toArray())[0];

    const part = await recordPayment({ invoice_id: invoice.id, amount: 1000, mode: 'UPI' });
    expect(part.status).toBe('partial');
    expect(part.receipt_no).toMatch(/^RCP-\d{4}-0001$/);

    const full = await recordPayment({ invoice_id: invoice.id, amount: 3560, mode: 'Cash' });
    expect(full.status).toBe('paid');
    expect(full.receipt_no).toMatch(/^RCP-\d{4}-0002$/);

    const { rows } = await buildQueue();
    expect(rows.filter((r) => r.invoice_id === invoice.id)).toHaveLength(0);
  });

  it('a pickup point with active students is made inactive rather than deleted', async () => {
    expect(await countEnrolledAt(pickupId)).toBe(1);
    const res = await removePickupPoint(pickupId);
    expect(res).toEqual({ removed: false, madeInactive: true });
    expect((await db.pickup_points.get(pickupId)).active).toBe(false);
  });
});

describe('existing students: opening status, re-enrolment, import, send-now', () => {
  let beta;
  const quick = (name, phone) => ({
    name, class_name: 'V', father_phone: phone, mother_phone: '', pickup_point_id: beta
  });

  beforeAll(async () => {
    beta = await savePickupPoint({ name: 'Beta-2 Market', monthly_fare: 1800, active: true });
  });

  it('a quick-entry student needs only name, class, pickup and one parent number', async () => {
    const id = await saveStudent(quick('Diya Verma', '9900112233'));
    const s = await db.students.get(id);
    expect(s.emergency_phone).toBe('9900112233'); // defaulted from the parent number
    expect(s.father_name).toBe('');
  });

  it('"already paid" settles the current cycle without a payment row; old dues become one due-today bill', async () => {
    const student = await db.students.where('name').equals('Diya Verma').first();
    await saveEnrolmentWithOpening({
      student_id: student.id, pickup_point_id: beta, fee_plan_id: 'monthly', due_day: 5,
      start_date: billingStartDate('month'), thisMonthPaid: true, oldDues: 800
    });
    const invoices = await db.invoices.where('student_id').equals(student.id).toArray();
    // (the engine's 15-day look-ahead may also have created next month's bill)
    const current = invoices.find((i) => i.period_start === billingStartDate('month'));
    const dues = invoices.find((i) => i.amount === 800);
    expect(current).toMatchObject({ status: 'paid', paid_amount: 1800, opening: true });
    expect(dues).toMatchObject({ status: 'pending', due_date: todayISO(), opening: true });
    expect(await db.payments.where('invoice_id').equals(current.id).count()).toBe(0);

    const { rows } = await buildQueue();
    const mine = rows.filter((r) => r.student_id === student.id);
    expect(mine.map((r) => [r.stage, r.amount])).toEqual([['due', 800]]); // paid cycle stays out of the queue
    expect(mine.some((r) => r.invoice_id === current.id)).toBe(false);
  });

  it('re-enrolling replaces the untouched bill instead of leaving a duplicate', async () => {
    const id = await saveStudent(quick('Kabir Nair', '9745012345'));
    const args = { student_id: id, pickup_point_id: beta, fee_plan_id: 'monthly', start_date: billingStartDate('month') };
    await saveEnrolmentWithOpening({ ...args, due_day: 5 });
    await saveEnrolmentWithOpening({ ...args, due_day: 10 });
    const thisCycle = (await db.invoices.where('student_id').equals(id).toArray()).filter((i) => i.period_start === billingStartDate('month'));
    const live = thisCycle.filter((i) => i.status !== 'cancelled');
    expect(thisCycle.length).toBeGreaterThanOrEqual(2); // the original (cancelled) and its replacement
    expect(live).toHaveLength(1);
    expect(live[0].due_date.slice(8)).toBe('10');
  });

  it('imports a sheet: creates new pickup points, skips bad rows and duplicates', async () => {
    const text =
      'name,class,father_phone,pickup,fare,paid,old_dues\n' +
      'Anaya Singh,VI,9440556677,Gamma Park,2000,no,0\n' +
      'Reyansh Yadav,XI,9388220011,Beta-2 Market,,yes,0\n' +
      'Bad Row,IX,123,Beta-2 Market,,no,0\n' +
      'Diya Verma,V,9900112233,Beta-2 Market,,no,0\n';
    const plan = await previewImport(text);
    expect(plan.ready).toHaveLength(2);
    expect(plan.invalid).toHaveLength(1);
    expect(plan.duplicates).toHaveLength(1);

    const res = await runImport(plan);
    expect(res).toEqual({ created: 2, failures: [] });
    expect((await db.pickup_points.where('name').equals('Gamma Park').first()).monthly_fare).toBe(2000);
    const reyansh = await db.students.where('name').equals('Reyansh Yadav').first();
    const inv = (await db.invoices.where('student_id').equals(reyansh.id).toArray()).filter((i) => i.period_start === billingStartDate('month'));
    expect(inv).toHaveLength(1);
    expect(inv[0].status).toBe('paid');
  });

  it('"send reminder now" builds the right message today and can be sent twice safely', async () => {
    const anaya = await db.students.where('name').equals('Anaya Singh').first();
    const invoice = (await db.invoices.where('student_id').equals(anaya.id).toArray())[0];
    const rows = await manualRowsForInvoice(invoice.id);
    expect(rows.length).toBeGreaterThan(0);
    expect(['advance', 'due', 'overdue', 'final']).toContain(rows[0].stage);

    await dispatchReminder(rows[0]);
    await dispatchReminder(rows[0]); // second tap must reuse the log row, not hit the unique index
    const logs = await db.reminder_log.where('invoice_id').equals(invoice.id).toArray();
    expect(logs.filter((l) => l.recipient_type === rows[0].recipient_type && l.stage === rows[0].stage)).toHaveLength(1);
  });

  it('ships the polished parent template with every way to pay', async () => {
    const t = await db.templates.get('overdue');
    expect(t.body).toContain('UPI ID: {upi_id}');
    expect(t.body).toContain('मोबाइल नंबर: {operator_phone}');
    expect(t.body).toContain('{qr_note}');
    expect(t.body).toContain('स्क्रीनशॉट');
  });
});

describe('cancelling a bill', () => {
  it('cancels an untouched bill but refuses one that already has a payment', async () => {
    const { cancelInvoice } = await import('../src/actions/billing.js');
    const untouched = (await db.invoices.toArray()).find((i) => i.status === 'pending' && !i.paid_amount);
    await cancelInvoice(untouched.id, 'made by mistake');
    expect((await db.invoices.get(untouched.id)).status).toBe('cancelled');

    const paid = (await db.invoices.toArray()).find((i) => i.paid_amount > 0);
    await expect(cancelInvoice(paid.id)).rejects.toThrow(/already has a payment/);

    const { rows } = await buildQueue();
    expect(rows.some((r) => r.invoice_id === untouched.id)).toBe(false); // its reminders stop
  });
});

describe('upgrading an existing phone', () => {
  it('moves a phone still on Hinglish over to Hindi: untouched templates upgrade, edits and choices carry over', async () => {
    const { seedIfEmpty, SEEDED_TEMPLATES } = await import('../src/db/seed.js');
    const { LEGACY_HINGLISH_CURRENT, LEGACY_HINGLISH_FIRST_RELEASE } = await import('../src/db/legacyHinglish.js');
    const hindi = (id) => SEEDED_TEMPLATES.find((t) => t.id === id).body;
    const block = '{qr_note}\nUPI ID: {upi_id}\nMobile number: {operator_phone}\nPayment link: {pay_link}\n';

    // as an older phone would look
    await db.templates.update('advance', { body: LEGACY_HINGLISH_CURRENT.advance, language: 'hinglish' }); // untouched, latest Hinglish
    await db.templates.update('due', { body: LEGACY_HINGLISH_FIRST_RELEASE.due, language: 'hinglish' }); // the very first wording
    await db.templates.update('overdue', {
      body: LEGACY_HINGLISH_CURRENT.overdue.replace(block, 'Payment link: {pay_link}\nUPI: {upi_id}\n'),
      language: 'hinglish'
    }); // an in-between release
    await db.templates.update('final', { body: 'My own wording {student_name}', language: 'hinglish' }); // the driver's edit
    await db.settings.put({ key: 'message_language', value: 'hinglish' });
    await db.students.update(studentId, { message_language: 'hinglish' });

    await seedIfEmpty(db);

    for (const id of ['advance', 'due', 'overdue']) {
      const t = await db.templates.get(id);
      expect(t.body).toBe(hindi(id));
      expect(t.language).toBe('hindi');
    }
    const own = await db.templates.get('final');
    expect(own.body).toBe('My own wording {student_name}'); // never overwritten
    expect(own.language).toBe('hindi'); // but now filed with the Hindi set
    expect((await db.settings.get('message_language')).value).toBe('hindi');
    expect((await db.students.get(studentId)).message_language).toBe('hindi');
    await db.templates.update('final', { body: hindi('final') });
  });

  it('turns QR attachment off once for phones that had it on, and leaves later choices alone', async () => {
    const { seedIfEmpty } = await import('../src/db/seed.js');
    await db.settings.put({ key: 'attach_qr', value: true });
    await db.meta.delete('attach_qr_default_off');
    await seedIfEmpty(db);
    expect((await db.settings.get('attach_qr')).value).toBe(false);

    await db.settings.put({ key: 'attach_qr', value: true }); // driver turns it back on
    await seedIfEmpty(db);
    expect((await db.settings.get('attach_qr')).value).toBe(true);
    await db.settings.put({ key: 'attach_qr', value: false });
  });
});

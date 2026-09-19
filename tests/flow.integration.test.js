// Integration test: real actions layer + real Dexie (fake-indexeddb).
// Covers what pure-domain tests can't: Dexie query shapes, unique indexes,
// transactions, and the pickup -> student -> enrolment -> invoice ->
// reminder -> payment lifecycle end to end.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeAll } from 'vitest';
import { ready, db } from '../src/db/index.js';
import { savePickupPoint, removePickupPoint, countEnrolledAt } from '../src/actions/pickups.js';
import { saveStudent } from '../src/actions/students.js';
import { saveEnrolment, runInvoiceEngine, recordPayment, getActiveEnrolment } from '../src/actions/billing.js';
import { buildQueue, dispatchReminder, skipReminder } from '../src/actions/reminders.js';
import { setSetting } from '../src/actions/settings.js';
import { addDays, todayISO } from '../src/domain/dates.js';

// window.open is called by dispatchReminder
globalThis.window = globalThis.window || {};
globalThis.window.open = () => {};

let pickupId;
let studentId;

beforeAll(async () => {
  await ready();
  await setSetting('quiet_hours_enabled', false); // don't let wall-clock time affect the test
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

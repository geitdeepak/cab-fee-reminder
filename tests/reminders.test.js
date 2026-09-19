import { describe, it, expect } from 'vitest';
import { validateTemplate, composeMessage, buildReminderQueue } from '../src/domain/reminders.js';

describe('validateTemplate', () => {
  it('accepts known placeholders', () => {
    expect(validateTemplate('Hi {parent_name}, amount {amount}').valid).toBe(true);
  });
  it('flags an unrecognised placeholder', () => {
    const r = validateTemplate('Hi {parent_name}, gps {vehicle_location}');
    expect(r.valid).toBe(false);
    expect(r.unknown).toEqual(['vehicle_location']);
  });
});

describe('composeMessage', () => {
  it('resolves placeholders from the data map', () => {
    expect(composeMessage('Hi {parent_name}, Rs {amount}', { parent_name: 'Rajesh', amount: '1,600' })).toBe(
      'Hi Rajesh, Rs 1,600'
    );
  });
});

function student(overrides = {}) {
  return {
    id: 'stu-1',
    name: 'Aarav Sharma',
    class_name: 'IV',
    school_name: 'DPS',
    status: 'active',
    pickup_point_id: 'pp-1',
    father_name: 'Rajesh Sharma',
    father_phone: '9876543210',
    mother_name: 'Sunita Sharma',
    mother_phone: '9811223344',
    ...overrides
  };
}

const stageSettings = {
  advance: { enabled: true, offset: -3 },
  due: { enabled: true, offset: 0 },
  overdue: { enabled: true, offset: 5 },
  final: { enabled: true, offset: 15 }
};

const pickupPointsById = new Map([['pp-1', { id: 'pp-1', name: 'Alpha-1 Main Gate' }]]);

describe('buildReminderQueue', () => {
  const invoice = { id: 'inv-1', student_id: 'stu-1', amount: 1600, paid_amount: 0, status: 'pending', due_date: '2026-05-05', period_start: '2026-04-12', period_end: '2026-07-11' };

  it('does not fire a stage before its scheduled date', () => {
    const rows = buildReminderQueue({
      invoices: [invoice],
      studentsById: new Map([['stu-1', student()]]),
      pickupPointsById,
      loggedKeys: new Set(),
      stageSettings,
      today: '2026-04-20' // before advance (D-3 = 02-May)
    });
    expect(rows).toHaveLength(0);
  });

  it('fires the due-today stage for both parents on the due date', () => {
    const rows = buildReminderQueue({
      invoices: [invoice],
      studentsById: new Map([['stu-1', student()]]),
      pickupPointsById,
      loggedKeys: new Set(),
      stageSettings,
      today: '2026-05-05'
    });
    // advance (D-3, already past on 05-May) + due (D+0) both eligible => 2 stages x 2 parents = 4
    const dueRows = rows.filter((r) => r.stage === 'due');
    expect(dueRows).toHaveLength(2);
    expect(dueRows.map((r) => r.recipient_type).sort()).toEqual(['father', 'mother']);
  });

  it('does not re-queue a recipient/stage already in reminder_log (7.4 guard)', () => {
    const rows = buildReminderQueue({
      invoices: [invoice],
      studentsById: new Map([['stu-1', student()]]),
      pickupPointsById,
      loggedKeys: new Set(['inv-1|father|due']),
      stageSettings,
      today: '2026-05-05'
    });
    const dueRows = rows.filter((r) => r.stage === 'due');
    expect(dueRows).toHaveLength(1);
    expect(dueRows[0].recipient_type).toBe('mother');
  });

  it('collapses identical father/mother numbers into one row (7.4 guard)', () => {
    const rows = buildReminderQueue({
      invoices: [invoice],
      studentsById: new Map([['stu-1', student({ mother_phone: '9876543210' })]]),
      pickupPointsById,
      loggedKeys: new Set(),
      stageSettings,
      today: '2026-05-05'
    });
    const dueRows = rows.filter((r) => r.stage === 'due');
    expect(dueRows).toHaveLength(1);
    expect(dueRows[0].recipient_name).toContain('&');
  });

  it('never generates a reminder for a paid or cancelled invoice', () => {
    const rows = buildReminderQueue({
      invoices: [{ ...invoice, status: 'paid', paid_amount: 1600 }],
      studentsById: new Map([['stu-1', student()]]),
      pickupPointsById,
      loggedKeys: new Set(),
      stageSettings,
      today: '2026-06-01'
    });
    expect(rows).toHaveLength(0);
  });

  it('queues only the latest reached stage, not every stage at once', () => {
    const rows = buildReminderQueue({
      invoices: [invoice],
      studentsById: new Map([['stu-1', student()]]),
      pickupPointsById,
      loggedKeys: new Set(),
      stageSettings,
      today: '2026-05-25' // 20 days late: advance, due, overdue and final are all "reached"
    });
    expect(rows.map((r) => r.stage)).toEqual(['final', 'final']); // one per parent
  });

  it('moves on to the next stage once the earlier one was sent', () => {
    const rows = buildReminderQueue({
      invoices: [invoice],
      studentsById: new Map([['stu-1', student()]]),
      pickupPointsById,
      loggedKeys: new Set(['inv-1|father|due', 'inv-1|mother|due']),
      stageSettings,
      today: '2026-05-11' // D+6: overdue reached
    });
    expect(rows.map((r) => r.stage)).toEqual(['overdue', 'overdue']);
  });

  it('father-only mode sends one row, falling back to the mother when there is no father number', () => {
    const args = {
      invoices: [invoice],
      pickupPointsById,
      loggedKeys: new Set(),
      stageSettings,
      today: '2026-05-05',
      recipientMode: 'father'
    };
    const both = buildReminderQueue({ ...args, studentsById: new Map([['stu-1', student()]]) });
    expect(both.map((r) => r.recipient_type)).toEqual(['father']);

    const noFather = buildReminderQueue({
      ...args,
      studentsById: new Map([['stu-1', student({ father_phone: '', father_name: '' })]])
    });
    expect(noFather.map((r) => r.recipient_type)).toEqual(['mother']);
  });

  it('copes with blank parent names (quick-entry students)', () => {
    const rows = buildReminderQueue({
      invoices: [invoice],
      studentsById: new Map([['stu-1', student({ father_name: '', mother_name: '' })]]),
      pickupPointsById,
      loggedKeys: new Set(),
      stageSettings,
      today: '2026-05-05'
    });
    expect(rows[0].data_map.parent_name).toBe('Aarav ke parent');
    expect(rows[0].recipient_name).toBe('Aarav ke Papa');
  });

  it('respects a disabled stage', () => {
    const rows = buildReminderQueue({
      invoices: [invoice],
      studentsById: new Map([['stu-1', student()]]),
      pickupPointsById,
      loggedKeys: new Set(),
      stageSettings: { ...stageSettings, final: { enabled: false, offset: 15 } },
      today: '2026-06-01' // well past D+15
    });
    expect(rows.some((r) => r.stage === 'final')).toBe(false);
  });
});

import { needsBackupInterstitial } from '../src/domain/reminders.js';

describe('needsBackupInterstitial (SRS 9.6)', () => {
  const base = { daysSinceBackup: 45, studentCount: 20, daysSinceSetup: 60, snoozedUntil: 0, now: 1000 };
  it('fires after 30 days without a backup', () => {
    expect(needsBackupInterstitial(base)).toBe(true);
    expect(needsBackupInterstitial({ ...base, daysSinceBackup: 29 })).toBe(false);
  });
  it('stays quiet for an empty register and while snoozed', () => {
    expect(needsBackupInterstitial({ ...base, studentCount: 0 })).toBe(false);
    expect(needsBackupInterstitial({ ...base, snoozedUntil: 5000 })).toBe(false);
  });
  it('counts from setup when a backup was never taken', () => {
    expect(needsBackupInterstitial({ ...base, daysSinceBackup: null, daysSinceSetup: 40 })).toBe(true);
    expect(needsBackupInterstitial({ ...base, daysSinceBackup: null, daysSinceSetup: 3 })).toBe(false);
  });
});

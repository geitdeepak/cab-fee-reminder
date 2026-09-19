import { describe, it, expect } from 'vitest';
import { planInvoiceGeneration, planAgeing } from '../src/domain/invoices.js';

const feePlansById = new Map([
  ['monthly', { months: 1 }],
  ['quarterly', { months: 3 }]
]);

function baseEnrolment(overrides = {}) {
  return {
    id: 'enr-1',
    student_id: 'stu-1',
    fee_plan_id: 'quarterly',
    cycle_amount: 4560,
    due_day: 5,
    start_date: '2026-04-12',
    next_period_start: null,
    status: 'active',
    ...overrides
  };
}

describe('planInvoiceGeneration (5.4 worked example)', () => {
  it('generates the first invoice when its period falls within the horizon', () => {
    const { newInvoices, enrolmentUpdates } = planInvoiceGeneration({
      enrolments: [baseEnrolment()],
      existingPeriodStartsByEnrolment: new Map(),
      feePlansById,
      today: '2026-04-01',
      horizonDays: 15
    });
    expect(newInvoices).toHaveLength(1);
    expect(newInvoices[0]).toMatchObject({
      enrolment_id: 'enr-1',
      period_start: '2026-04-12',
      period_end: '2026-07-11',
      due_date: '2026-05-05',
      amount: 4560,
      status: 'pending'
    });
    expect(enrolmentUpdates).toEqual([{ id: 'enr-1', next_period_start: '2026-07-12' }]);
  });

  it('does not generate a period whose start is beyond the horizon', () => {
    const { newInvoices } = planInvoiceGeneration({
      enrolments: [baseEnrolment({ next_period_start: '2026-07-12' })],
      existingPeriodStartsByEnrolment: new Map(),
      feePlansById,
      today: '2026-05-01',
      horizonDays: 15
    });
    expect(newInvoices).toHaveLength(0);
  });

  it('skips periods that already have an invoice', () => {
    const existing = new Map([['enr-1', new Set(['2026-04-12'])]]);
    const { newInvoices } = planInvoiceGeneration({
      enrolments: [baseEnrolment()],
      existingPeriodStartsByEnrolment: existing,
      feePlansById,
      today: '2026-04-01',
      horizonDays: 15
    });
    expect(newInvoices).toHaveLength(0);
  });

  it('ignores paused/ended enrolments', () => {
    const { newInvoices } = planInvoiceGeneration({
      enrolments: [baseEnrolment({ status: 'ended' })],
      existingPeriodStartsByEnrolment: new Map(),
      feePlansById,
      today: '2026-04-01',
      horizonDays: 15
    });
    expect(newInvoices).toHaveLength(0);
  });

  it('is idempotent across 100 re-runs (12.6 mandatory area)', () => {
    let existing = new Map();
    let totalGenerated = 0;
    const enrolments = [baseEnrolment()];

    for (let i = 0; i < 100; i++) {
      const { newInvoices, enrolmentUpdates } = planInvoiceGeneration({
        enrolments,
        existingPeriodStartsByEnrolment: existing,
        feePlansById,
        today: '2026-04-01',
        horizonDays: 15
      });
      totalGenerated += newInvoices.length;
      for (const inv of newInvoices) {
        const set = existing.get(inv.enrolment_id) || new Set();
        set.add(inv.period_start);
        existing.set(inv.enrolment_id, set);
      }
      for (const upd of enrolmentUpdates) {
        enrolments[0].next_period_start = upd.next_period_start;
      }
    }

    expect(totalGenerated).toBe(1); // exactly one invoice for the one period in range
  });
});

describe('planAgeing', () => {
  it('flags only pending invoices past their due date', () => {
    const ids = planAgeing(
      [
        { id: 'a', status: 'pending', due_date: '2026-01-01' },
        { id: 'b', status: 'pending', due_date: '2099-01-01' },
        { id: 'c', status: 'paid', due_date: '2026-01-01' },
        { id: 'd', status: 'partial', due_date: '2026-01-01' }
      ],
      '2026-06-01'
    );
    expect(ids).toEqual(['a']);
  });
});

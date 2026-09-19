import { describe, it, expect } from 'vitest';
import { addMonths, addDays, periodEnd, dueDate, daysBetween, compareISO } from '../src/domain/dates.js';

describe('addMonths', () => {
  it('advances calendar months', () => {
    expect(addMonths('2026-04-12', 3)).toBe('2026-07-12');
  });

  it('crosses a year boundary', () => {
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
  });

  it('clamps to the last day of a shorter target month (Jan 31 -> Feb)', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28'); // 2026 is not a leap year
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29'); // 2028 is a leap year
  });

  it('handles February itself as a source month', () => {
    expect(addMonths('2026-02-28', 12)).toBe('2027-02-28');
  });
});

describe('periodEnd', () => {
  it('is one day before the next period start (5.4 worked example)', () => {
    expect(periodEnd('2026-04-12', 3)).toBe('2026-07-11');
    expect(periodEnd('2026-07-12', 3)).toBe('2026-10-11');
  });
});

describe('dueDate', () => {
  it('rolls forward one month when the period starts after the due day (7.2)', () => {
    // "a family joining on the 12th with a due day of 5 is not immediately in arrears"
    expect(dueDate('2026-04-12', 5)).toBe('2026-05-05');
  });

  it('uses the same month when the period starts on or before the due day', () => {
    expect(dueDate('2026-04-03', 5)).toBe('2026-04-05');
    expect(dueDate('2026-04-05', 5)).toBe('2026-04-05');
  });
});

describe('daysBetween / compareISO', () => {
  it('computes whole-day differences across a year boundary', () => {
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3);
  });
  it('compares ISO strings correctly', () => {
    expect(compareISO('2026-01-01', '2026-01-02')).toBe(-1);
    expect(compareISO('2026-02-01', '2026-01-31')).toBe(1);
    expect(compareISO('2026-01-01', '2026-01-01')).toBe(0);
  });
  it('addDays handles negative offsets across a month boundary', () => {
    expect(addDays('2026-08-01', -1)).toBe('2026-07-31');
  });
});

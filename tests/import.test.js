import { describe, it, expect } from 'vitest';
import { parseRows, toRecords } from '../src/lib/csv.js';
import { planImport } from '../src/domain/importPlan.js';
import { composeMessage } from '../src/domain/reminders.js';

describe('CSV reader', () => {
  it('reads quoted cells, embedded commas and CRLF line endings', () => {
    const rows = parseRows('name,class\r\n"Sharma, Aarav",IV\r\nDiya,VII\r\n');
    expect(rows).toEqual([['name', 'class'], ['Sharma, Aarav', 'IV'], ['Diya', 'VII']]);
  });

  it('accepts text pasted from Excel (tab separated)', () => {
    const rows = parseRows('name\tclass\tfather phone\nAarav\tIV\t9876543210');
    expect(rows[1]).toEqual(['Aarav', 'IV', '9876543210']);
  });

  it('maps loose header names to canonical fields', () => {
    const { records, missing } = toRecords(
      parseRows('Student Name,Std,Father Mobile,Pickup Point,Old Dues\nAarav,IV,9876543210,Alpha,500')
    );
    expect(records[0]).toMatchObject({ name: 'Aarav', class_name: 'IV', father_phone: '9876543210', pickup: 'Alpha', old_dues: '500' });
    expect(missing).toEqual([]);
  });

  it('reports required columns that are missing', () => {
    const { missing } = toRecords(parseRows('name,class\nAarav,IV'));
    expect(missing).toEqual(expect.arrayContaining(['pickup', 'father_phone']));
  });
});

const pickupPoints = [{ id: 'pp-1', name: 'Alpha-1 Main Gate', monthly_fare: 1600 }];

describe('planImport', () => {
  const base = { name: 'Aarav Sharma', class_name: 'IV', father_phone: '9876543210', pickup: 'alpha-1 main gate', _line: 2 };

  it('accepts a valid row and matches the pickup point case-insensitively', () => {
    const plan = planImport([base], { pickupPoints, students: [] });
    expect(plan.ready).toHaveLength(1);
    expect(plan.ready[0]).toMatchObject({ pickupId: 'pp-1', plan: 'monthly', dueDay: 5, thisMonthPaid: false, oldDues: 0 });
  });

  it('reads paid / old dues / plan columns', () => {
    const plan = planImport([{ ...base, paid: 'Yes', old_dues: '₹1,200', plan: 'quarterly', due_day: '10' }], { pickupPoints, students: [] });
    expect(plan.ready[0]).toMatchObject({ thisMonthPaid: true, oldDues: 1200, plan: 'quarterly', dueDay: 10 });
  });

  it('flags rows with problems instead of guessing', () => {
    const plan = planImport(
      [
        { ...base, father_phone: '12345', _line: 2 },
        { ...base, class_name: '', _line: 3 },
        { ...base, pickup: 'Nowhere Chowk', _line: 4 },
        { ...base, due_day: '31', _line: 5 }
      ],
      { pickupPoints, students: [] }
    );
    expect(plan.ready).toHaveLength(0);
    expect(plan.invalid.map((i) => i.line)).toEqual([2, 3, 4, 5]);
    expect(plan.invalid[2].errors[0]).toMatch(/does not exist/);
  });

  it('creates an unknown pickup point when the file gives a fare', () => {
    const plan = planImport([{ ...base, pickup: 'Gamma Park', fare: '1800' }], { pickupPoints, students: [] });
    expect(plan.ready).toHaveLength(1);
    expect(plan.newPickups).toEqual([{ name: 'Gamma Park', fare: 1800 }]);
  });

  it('skips students already in the app and repeats inside the file', () => {
    const existing = [{ name: 'Aarav Sharma', father_phone: '9876543210', mother_phone: '' }];
    const plan = planImport([base, { ...base, name: 'Diya Verma', father_phone: '9900112233', _line: 3 }, { ...base, name: 'Diya Verma', father_phone: '9900112233', _line: 4 }], {
      pickupPoints,
      students: existing
    });
    expect(plan.duplicates.map((i) => i.line)).toEqual([2, 4]);
    expect(plan.ready.map((i) => i.line)).toEqual([3]);
  });
});

describe('composeMessage optional UPI line', () => {
  const body = 'Pay now.\nUPI: {upi_id}\n\nThanks {operator_name}';
  it('keeps the UPI line when an id is set', () => {
    expect(composeMessage(body, { upi_id: 'ramesh@upi', operator_name: 'Ramesh' })).toBe('Pay now.\nUPI: ramesh@upi\n\nThanks Ramesh');
  });
  it('drops the whole line when there is no UPI id', () => {
    expect(composeMessage(body, { upi_id: '', operator_name: 'Ramesh' })).toBe('Pay now.\n\nThanks Ramesh');
  });
});

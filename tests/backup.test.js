import { describe, it, expect } from 'vitest';
import { buildBackupPayload, restoreFromPayload, parseBackupFile, incomingCounts } from '../src/lib/backup.js';

// A minimal in-memory stand-in for the Dexie table/db API that backup.js
// actually touches (toArray/count/clear/bulkPut/transaction), so the
// export -> parse -> restore round trip can be verified without a real
// IndexedDB environment.
class FakeTable {
  constructor(rows = []) {
    this.rows = rows.map((r) => ({ ...r }));
  }
  async toArray() {
    return this.rows.map((r) => ({ ...r }));
  }
  async count() {
    return this.rows.length;
  }
  async clear() {
    this.rows = [];
  }
  async bulkPut(items) {
    this.rows.push(...items.map((r) => ({ ...r })));
  }
}

const TABLE_NAMES = [
  'operator',
  'pickup_points',
  'students',
  'fee_plans',
  'enrolments',
  'invoices',
  'payments',
  'reminder_log',
  'templates',
  'settings',
  'meta'
];

function makeFakeDb(seed = {}) {
  const db = {};
  for (const t of TABLE_NAMES) db[t] = new FakeTable(seed[t] || []);
  db.transaction = async (_mode, _tables, fn) => fn();
  return db;
}

describe('backup export -> restore round trip', () => {
  it('produces a byte-identical database state (12.6 mandatory area)', async () => {
    const source = makeFakeDb({
      students: [{ id: 's1', name: 'Aarav Sharma', class_name: 'IV' }],
      pickup_points: [{ id: 'p1', name: 'Alpha-1', monthly_fare: 1600 }],
      settings: [{ key: 'default_due_day', value: 5 }]
    });

    const payload = await buildBackupPayload(source);
    const json = JSON.stringify(payload);
    const parsed = parseBackupFile(json);

    expect(incomingCounts(parsed)).toEqual({
      operator: 0,
      pickup_points: 1,
      students: 1,
      fee_plans: 0,
      enrolments: 0,
      invoices: 0,
      payments: 0,
      reminder_log: 0,
      templates: 0,
      settings: 1,
      meta: 0
    });

    const target = makeFakeDb({
      students: [{ id: 'stale', name: 'Old Record' }] // should be wiped, not merged
    });
    await restoreFromPayload(target, parsed);

    expect(await target.students.toArray()).toEqual([{ id: 's1', name: 'Aarav Sharma', class_name: 'IV' }]);
    expect(await target.pickup_points.toArray()).toEqual([{ id: 'p1', name: 'Alpha-1', monthly_fare: 1600 }]);
    expect(await target.settings.toArray()).toEqual([{ key: 'default_due_day', value: 5 }]);
  });

  it('refuses a backup from a newer schema version', () => {
    const future = JSON.stringify({ schema_version: 999, exported_at: 'x', data: {} });
    expect(() => parseBackupFile(future)).toThrow(/newer version/);
  });

  it('refuses a file that is not a recognisable backup', () => {
    expect(() => parseBackupFile(JSON.stringify({ hello: 'world' }))).toThrow(/not a Cab Fee Reminder backup/);
  });
});

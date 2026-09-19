// @vitest-environment happy-dom
//
// "Permission denied" when taking a backup: browsers raise NotAllowedError from the
// share sheet when they refuse the file type or the tap is too old. The backup must
// then be saved as a normal download instead of failing.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportBackup } from '../src/lib/backup.js';

class FakeTable {
  async toArray() { return []; }
  async count() { return 0; }
}
const TABLES = ['operator', 'pickup_points', 'students', 'fee_plans', 'enrolments', 'invoices', 'payments', 'reminder_log', 'templates', 'settings', 'meta'];
const fakeDb = Object.fromEntries(TABLES.map((t) => [t, new FakeTable()]));

function setNavigator(share, canShare = () => true) {
  Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true });
  Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true, writable: true });
}

const domError = (name, message) => Object.assign(new Error(message), { name });

let clicked;
beforeEach(() => {
  clicked = [];
  HTMLAnchorElement.prototype.click = function () { clicked.push(this.download); };
  URL.createObjectURL = () => 'blob:fake';
  URL.revokeObjectURL = () => {};
});

describe('exportBackup', () => {
  it('shares the file when the phone allows it', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigator(share);
    const res = await exportBackup(fakeDb);
    expect(res.method).toBe('share');
    expect(share).toHaveBeenCalledOnce();
    expect(clicked).toHaveLength(0);
  });

  it('falls back to a download when sharing is refused with "Permission denied"', async () => {
    setNavigator(vi.fn().mockRejectedValue(domError('NotAllowedError', 'Permission denied')));
    const res = await exportBackup(fakeDb);
    expect(res.method).toBe('download');
    expect(clicked).toEqual([res.filename]); // the file really was handed to the browser to save
    expect(res.filename).toMatch(/^cabfee-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
  });

  it('also falls back for any other sharing failure', async () => {
    setNavigator(vi.fn().mockRejectedValue(new TypeError('files not supported')));
    expect((await exportBackup(fakeDb)).method).toBe('download');
  });

  it('downloads when the browser cannot share files at all', async () => {
    setNavigator(vi.fn(), () => false);
    expect((await exportBackup(fakeDb)).method).toBe('download');
  });

  it('does not download or count a backup when the driver just closes the share sheet', async () => {
    setNavigator(vi.fn().mockRejectedValue(domError('AbortError', 'Share canceled')));
    const res = await exportBackup(fakeDb);
    expect(res.method).toBe('cancelled');
    expect(clicked).toHaveLength(0);
  });
});

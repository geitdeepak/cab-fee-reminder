import { describe, it, expect } from 'vitest';
import { buildPayLink, parsePayParams, upiDeepLink, isValidUpiId } from '../src/lib/payLink.js';
import { makeReminderRow, composeMessage } from '../src/domain/reminders.js';
import { SEEDED_TEMPLATES } from '../src/db/seed.js';

describe('UPI id check', () => {
  it('accepts normal ids and rejects junk', () => {
    expect(isValidUpiId('ramesh@upi')).toBe(true);
    expect(isValidUpiId('ramesh.kumar-9@okhdfcbank')).toBe(true);
    for (const bad of ['', 'ramesh', '@upi', 'a@b', 'ram esh@upi', 'ramesh@upi/../x', '<script>@x.y']) {
      expect(isValidUpiId(bad)).toBe(false);
    }
  });
});

describe('pay link', () => {
  const args = { baseUrl: 'https://cabfee.example.dev', upiId: 'ramesh@upi', name: 'Ramesh Cab & Co', amount: 1600, note: 'Cab fee Aarav Sharma' };

  it('carries payee and amount, and round-trips through the /pay page parser', () => {
    const link = buildPayLink(args);
    expect(link.startsWith('https://cabfee.example.dev/pay?')).toBe(true);
    const parsed = parsePayParams(new URL(link).search);
    expect(parsed).toMatchObject({ ok: true, upiId: 'ramesh@upi', name: 'Ramesh Cab & Co', amount: 1600, note: 'Cab fee Aarav Sharma' });
  });

  it('builds nothing without a valid UPI id or a base URL', () => {
    expect(buildPayLink({ ...args, upiId: '' })).toBe('');
    expect(buildPayLink({ ...args, upiId: 'nope' })).toBe('');
    expect(buildPayLink({ ...args, baseUrl: '' })).toBe('');
  });

  it('the /pay page rejects a link without a valid UPI id', () => {
    expect(parsePayParams('?pa=javascript:alert(1)').ok).toBe(false);
    expect(parsePayParams('').ok).toBe(false);
  });

  it('ignores a silly amount instead of pre-filling it', () => {
    expect(parsePayParams('?pa=ramesh@upi&am=-5').amount).toBe(0);
    expect(parsePayParams('?pa=ramesh@upi&am=99999999').amount).toBe(0);
    expect(parsePayParams('?pa=ramesh@upi&am=abc').amount).toBe(0);
  });

  it('builds a deep link with two-decimal amount and INR', () => {
    const uri = upiDeepLink('any', { upiId: 'ramesh@upi', name: 'Ramesh', amount: 1600, note: 'Fee' });
    expect(uri).toBe('upi://pay?pa=ramesh%40upi&pn=Ramesh&am=1600.00&cu=INR&tn=Fee');
    expect(upiDeepLink('phonepe', { upiId: 'a@b.c', amount: 0 })).toMatch(/^phonepe:\/\/pay\?pa=/);
  });
});

describe('the link inside a reminder message', () => {
  const student = { id: 's1', name: 'Aarav Sharma', class_name: 'IV', school_name: '', father_name: 'Rajesh', father_phone: '9876543210', mother_phone: '' };
  const invoice = { id: 'i1', amount: 1600, paid_amount: 600, due_date: '2026-05-05', period_start: '2026-05-01', period_end: '2026-05-31' };
  const row = (operator) =>
    makeReminderRow({
      invoice, student, pickup: null, recipient: { type: 'father', name: 'Rajesh', phone: '9876543210' },
      stage: 'overdue', today: '2026-05-12', operator, payBaseUrl: 'https://cabfee.example.dev'
    });
  const body = SEEDED_TEMPLATES.find((t) => t.id === 'overdue').body;

  it('pre-fills the amount still owed and puts a tappable link in the text', () => {
    const r = row({ name: 'Ramesh', phone: '9812345678', upi_id: 'ramesh@upi' });
    expect(new URL(r.data_map.pay_link).searchParams.get('am')).toBe('1000'); // 1600 - 600 already paid
    const text = composeMessage(body, r.data_map);
    expect(text).toContain('Payment link: https://cabfee.example.dev/pay?pa=ramesh%40upi');
    expect(text).toContain('UPI: ramesh@upi');
  });

  it('leaves out the link and UPI lines when the driver has not set a UPI id', () => {
    const text = composeMessage(body, row({ name: 'Ramesh', phone: '9812345678' }).data_map);
    expect(text).not.toContain('Payment link');
    expect(text).not.toContain('UPI:');
    expect(text).not.toMatch(/\n{3,}/);
  });
});

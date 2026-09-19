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

  it('is short, carries only the UPI id and amount, and round-trips through the /p page parser', () => {
    const link = buildPayLink(args);
    expect(link).toBe('https://cabfee.example.dev/p?u=ramesh%40upi&a=1600');
    expect(link.length - args.baseUrl.length).toBeLessThan(30); // everything after the host
    expect(parsePayParams(new URL(link).search)).toMatchObject({ ok: true, upiId: 'ramesh@upi', amount: 1600 });
  });

  it('still understands the longer links sent by the first release (/pay?pa=&pn=&am=&tn=)', () => {
    const old = '?pa=ramesh%40upi&pn=Ramesh%20Kumar&am=1600&tn=Cab%20fee%20Aarav';
    expect(parsePayParams(old)).toMatchObject({ ok: true, upiId: 'ramesh@upi', name: 'Ramesh Kumar', amount: 1600, note: 'Cab fee Aarav' });
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
    expect(new URL(r.data_map.pay_link).searchParams.get('a')).toBe('1000'); // 1600 - 600 already paid
    const text = composeMessage(body, r.data_map);
    expect(text).toContain('पेमेंट लिंक: https://cabfee.example.dev/p?u=ramesh%40upi&a=1000');
    expect(text).toContain('UPI ID: ramesh@upi');
    expect(text).toContain('मोबाइल नंबर: 9812345678');
  });

  it('leaves out the link and UPI lines when the driver has not set a UPI id', () => {
    const text = composeMessage(body, row({ name: 'Ramesh', phone: '9812345678' }).data_map);
    expect(text).not.toContain('पेमेंट लिंक');
    expect(text).not.toContain('UPI ID');
    expect(text).not.toMatch(/\n{3,}/);
  });
});

import { qrPath } from '../src/lib/qr.js';

describe('QR drawing', () => {
  it('draws a square grid with a quiet zone, and different text gives a different code', () => {
    const a = qrPath('upi://pay?pa=ramesh%40upi&am=1600.00&cu=INR');
    const b = qrPath('upi://pay?pa=someone%40upi&am=900.00&cu=INR');
    expect(a.size).toBeGreaterThan(21);
    expect(a.path.startsWith('M3 3') || a.path.includes('M3 3')).toBe(true); // finder pattern sits after the 3-module margin
    expect(a.path).not.toBe(b.path);
  });
});

describe('the payment block: QR note and mobile number', () => {
  const body = SEEDED_TEMPLATES.find((t) => t.id === 'due').body;
  const data = { parent_name: 'Rajesh', student_name: 'Aarav', class: 'IV', period: 'May 2026', amount: '1,600',
    operator_name: 'Ramesh', operator_phone: '9812345678', upi_id: 'ramesh@upi', pay_link: 'https://x.dev/pay?pa=ramesh%40upi' };

  it('says a QR is attached only when one really is', () => {
    expect(composeMessage(body, { ...data, qr_note: 'QR code is message ke saath attached hai.' })).toContain('attached hai');
    expect(composeMessage(body, { ...data, qr_note: '' })).not.toContain('attached');
  });

  it('offers every way to pay in one tidy block', () => {
    const text = composeMessage(body, { ...data, qr_note: '' });
    const block = text.slice(text.indexOf('UPI ID'), text.indexOf('अगर पेमेंट'));
    expect(block).toBe('UPI ID: ramesh@upi\nमोबाइल नंबर: 9812345678\nपेमेंट लिंक: https://x.dev/pay?pa=ramesh%40upi\n\n');
  });

  it('drops the mobile-number line, and the signature line, when the driver has no phone saved', () => {
    const text = composeMessage(body, { ...data, operator_phone: '', qr_note: '' });
    expect(text).not.toContain('मोबाइल नंबर');
    expect(text.trim().endsWith('Ramesh')).toBe(true);
  });
});

describe('the payment block in English', () => {
  const body = SEEDED_TEMPLATES.find((t) => t.id === 'due_en').body;
  const data = { parent_name: 'Rajesh', student_name: 'Aarav', class: 'IV', period: 'May 2026', amount: '1,600',
    operator_name: 'Ramesh', operator_phone: '9812345678', upi_id: 'ramesh@upi', pay_link: 'https://x.dev/p?u=ramesh%40upi&a=1600' };

  it('carries every way to pay with English labels, and the QR note only when attached', () => {
    const text = composeMessage(body, { ...data, qr_note: 'A QR code is attached to this message.' });
    expect(text).toContain('A QR code is attached to this message.');
    expect(text).toContain('UPI ID: ramesh@upi');
    expect(text).toContain('Mobile number: 9812345678');
    expect(text).toContain('Payment link: https://x.dev/p?u=ramesh%40upi&a=1600');
    expect(composeMessage(body, { ...data, qr_note: '' })).not.toContain('attached');
  });

  it('drops lines with nothing to show', () => {
    const text = composeMessage(body, { ...data, upi_id: '', pay_link: '', qr_note: '' });
    expect(text).not.toMatch(/UPI ID|Payment link/);
    expect(text).toContain('Mobile number: 9812345678');
  });
});

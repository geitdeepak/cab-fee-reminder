// English / Hindi reminders: the driver's default, a per-student override, the
// receipt, import, and phones that only have the older Hinglish templates.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeAll } from 'vitest';
import { ready, db } from '../src/db/index.js';
import { seedIfEmpty, SEEDED_TEMPLATES } from '../src/db/seed.js';
import { savePickupPoint } from '../src/actions/pickups.js';
import { saveStudent } from '../src/actions/students.js';
import { saveEnrolmentWithOpening } from '../src/actions/billing.js';
import { manualRowsForInvoice, composeForRow, getTemplateBody } from '../src/actions/reminders.js';
import { previewImport } from '../src/actions/importStudents.js';
import { setSetting } from '../src/actions/settings.js';
import { billingStartDate } from '../src/domain/dates.js';
import { languageFor, templateIdFor, parentNameFor } from '../src/domain/reminders.js';

// A real browser has a site address to build the payment link from; plain Node does not.
globalThis.window = { location: { origin: 'https://cabfee.example.dev' } };

let pickupId;

async function studentWithBill(name, phone, message_language) {
  const id = await saveStudent({
    name, class_name: 'V', father_name: 'Rajesh Sharma', father_phone: phone, pickup_point_id: pickupId, message_language
  });
  await saveEnrolmentWithOpening({
    student_id: id, pickup_point_id: pickupId, fee_plan_id: 'monthly', due_day: 5, start_date: billingStartDate('month')
  });
  const invoice = (await db.invoices.where('student_id').equals(id).toArray()).find((i) => i.period_start === billingStartDate('month'));
  return { id, invoice };
}

beforeAll(async () => {
  await ready();
  await setSetting('quiet_hours_enabled', false);
  await setSetting('reminder_recipients', 'father');
  await db.operator.update('self', { name: 'Ramesh', phone: '9812345678', upi_id: 'ramesh@upi' });
  pickupId = await savePickupPoint({ name: 'Alpha-1', monthly_fare: 1600, active: true });
});

describe('language rules', () => {
  it('a student\'s own choice wins over the default; unknown values (and the old "hinglish") mean Hindi', () => {
    expect(languageFor({ message_language: '' }, 'english')).toBe('english');
    expect(languageFor({ message_language: 'hindi' }, 'english')).toBe('hindi');
    expect(languageFor({ message_language: 'english' }, 'hindi')).toBe('english');
    expect(languageFor({}, undefined)).toBe('hindi');
    expect(languageFor({ message_language: 'hinglish' }, 'hinglish')).toBe('hindi');
    expect(languageFor({ message_language: 'klingon' }, 'klingon')).toBe('hindi');
  });

  it('English templates are the ids ending in _en', () => {
    expect(templateIdFor('overdue', 'english')).toBe('overdue_en');
    expect(templateIdFor('overdue', 'hindi')).toBe('overdue');
  });

  it('greets a parent with no saved name naturally in each language', () => {
    expect(parentNameFor('', { name: 'Aarav Sharma' }, 'english')).toBe('Parent of Aarav');
    expect(parentNameFor('', { name: 'Aarav Sharma' }, 'hindi')).toBe('Aarav के अभिभावक');
    expect(parentNameFor('Rajesh Kumar', { name: 'Aarav' }, 'english')).toBe('Rajesh');
  });
});

describe('stored templates', () => {
  it('ships a complete English set alongside the Hindi one', async () => {
    for (const base of ['advance', 'due', 'overdue', 'final', 'receipt']) {
      const hi = await db.templates.get(base);
      expect(hi.language).toBe('hindi');
      expect(hi.body).toContain('नमस्ते {parent_name} जी');
      expect(hi.body).not.toMatch(/Namaste|dijiye|kijiye|hai\b/); // no Latin-script Hindi left
      const en = await db.templates.get(`${base}_en`);
      expect(en.language).toBe('english');
      expect(en.body).toContain('Dear {parent_name}');
      expect(en.body).not.toMatch(/Namaste|dijiye|kijiye/); // no Hinglish left behind
    }
    expect(SEEDED_TEMPLATES).toHaveLength(10);
  });

  it('adds the English set to a phone that only has the older templates, without touching edits', async () => {
    await db.templates.bulkDelete(['due_en', 'final_en']);
    await db.templates.update('overdue', { body: 'my own wording' });
    await seedIfEmpty(db);
    expect(await db.templates.get('due_en')).toBeTruthy();
    expect(await db.templates.get('final_en')).toBeTruthy();
    expect((await db.templates.get('overdue')).body).toBe('my own wording');
    await db.templates.update('overdue', { body: SEEDED_TEMPLATES.find((t) => t.id === 'overdue').body });
  });

  it('never sends an empty message if an English template is missing (e.g. after restoring an old backup)', async () => {
    const saved = await db.templates.get('due_en');
    await db.templates.delete('due_en');
    expect(await getTemplateBody('due_en')).toBe((await db.templates.get('due')).body);
    await db.templates.put(saved);
  });
});

describe('sending in each language', () => {
  it('follows the driver\'s default, and a student\'s override beats it', async () => {
    const plain = await studentWithBill('Tara Jain', '9440556677', '');
    const eng = await studentWithBill('Sara Khan', '9212334455', 'english');
    const hing = await studentWithBill('Vivaan Gupta', '9555001122', 'hindi');

    await setSetting('message_language', 'hindi');
    let rows = {
      plain: (await manualRowsForInvoice(plain.invoice.id))[0],
      eng: (await manualRowsForInvoice(eng.invoice.id))[0],
      hing: (await manualRowsForInvoice(hing.invoice.id))[0]
    };
    expect([rows.plain.language, rows.eng.language, rows.hing.language]).toEqual(['hindi', 'english', 'hindi']);
    expect(rows.eng.template_id.endsWith('_en')).toBe(true);
    expect(rows.plain.template_id.endsWith('_en')).toBe(false);

    await setSetting('message_language', 'english');
    rows = {
      plain: (await manualRowsForInvoice(plain.invoice.id))[0],
      hing: (await manualRowsForInvoice(hing.invoice.id))[0]
    };
    expect(rows.plain.language).toBe('english'); // default changed
    expect(rows.hing.language).toBe('hindi'); // explicit choice kept
    await setSetting('message_language', 'hindi');
  });

  it('builds a full English message, and only mentions the QR when one is attached', async () => {
    const eng = await studentWithBill('Zoya Ali', '9388220011', 'english');
    const [row] = await manualRowsForInvoice(eng.invoice.id);

    const plain = await composeForRow(row, { attachQr: false });
    expect(plain).toContain('Dear Rajesh');
    expect(plain).toContain('Zoya Ali');
    expect(plain).toContain('UPI ID: ramesh@upi');
    expect(plain).toContain('Mobile number: 9812345678');
    expect(plain).toContain('https://cabfee.example.dev/p?u=ramesh%40upi');
    expect(plain).not.toMatch(/नमस्ते|attached/);

    const withQr = await composeForRow(row, { attachQr: true });
    expect(withQr).toContain('A QR code is attached to this message.');
  });

  it('sends the Hindi message, with a Hindi QR note, to Hindi students', async () => {
    const h = await studentWithBill('Ishaan Rao', '9663311220', 'hindi');
    const [row] = await manualRowsForInvoice(h.invoice.id);
    const text = await composeForRow(row, { attachQr: true });
    expect(text).toContain('नमस्ते Rajesh जी');
    expect(text).toContain('QR कोड इस मैसेज के साथ लगा है।');
    expect(text).toContain('रु.');
    expect(text).not.toMatch(/Namaste|dijiye/);
  });
});

describe('saving and importing the choice', () => {
  it('stores English/Hinglish and treats anything else as "follow the default"', async () => {
    const base = { name: 'Neha Roy', class_name: 'II', father_phone: '9745012345', pickup_point_id: pickupId };
    for (const [given, stored] of [['english', 'english'], ['hindi', 'hindi'], ['hinglish', 'hindi'], ['', ''], ['french', ''], [undefined, '']]) {
      const id = await saveStudent({ ...base, name: `Neha ${given}`, message_language: given });
      expect((await db.students.get(id)).message_language).toBe(stored);
    }
  });

  it('reads a language column from a sheet, and flags one it does not know', async () => {
    const plan = await previewImport(
      'name,class,father_phone,pickup,language\n' +
      'Aman A,V,9800000001,Alpha-1,English\n' +
      'Bina B,V,9800000002,Alpha-1,hindi\n' +
      'Chirag C,V,9800000003,Alpha-1,\n' +
      'Dev D,V,9800000004,Alpha-1,klingon\n'
    );
    expect(plan.ready.map((i) => i.student.message_language)).toEqual(['english', 'hindi', '']);
    expect(plan.invalid).toHaveLength(1);
    expect(plan.invalid[0].errors[0]).toMatch(/not English or Hindi/);
  });
});

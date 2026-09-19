// First-run seed data. Only system defaults are seeded (fee plans, message
// templates, settings, meta) — never fake students or pickup points. Per the
// SRS (14.3 Client Responsibilities) the operator supplies their own pickup
// points and fares; the app starts as a genuinely empty register.
import { SCHEMA_VERSION } from './db.js';
import { HINDI_TEMPLATES } from './templatesHi.js';
import { ENGLISH_TEMPLATES } from './templatesEn.js';
import { LEGACY_HINGLISH_CURRENT, LEGACY_HINGLISH_FIRST_RELEASE } from './legacyHinglish.js';

// Parent-facing wording, in Hindi (Devanagari) and English. A line containing {upi_id},
// {pay_link}, {qr_note} or {operator_phone} is dropped automatically when its value is empty.
export const SEEDED_TEMPLATES = [...HINDI_TEMPLATES, ...ENGLISH_TEMPLATES];

// Every earlier Latin-script (Hinglish) wording of a template. If a stored template still matches one
// of these exactly, the driver never edited it, so it is safe to replace with the Hindi text. Their own
// wording is never overwritten.
const HINGLISH_PAY_BLOCK =
  '{qr_note}\nUPI ID: {upi_id}\nMobile number: {operator_phone}\nPayment link: {pay_link}\n';

function hinglishForms(id) {
  const current = LEGACY_HINGLISH_CURRENT[id];
  const forms = [LEGACY_HINGLISH_FIRST_RELEASE[id], current];
  if (current && current.includes(HINGLISH_PAY_BLOCK)) {
    forms.push(current.replace(HINGLISH_PAY_BLOCK, 'Payment link: {pay_link}\nUPI: {upi_id}\n')); // earlier release
    forms.push(current.replace(HINGLISH_PAY_BLOCK, 'UPI: {upi_id}\n')); // the release before that
  }
  return forms.filter(Boolean);
}

export const SEEDED_FEE_PLANS = [
  { id: 'monthly', label: 'Monthly', months: 1, discount_pct: 0, active: true },
  { id: 'quarterly', label: 'Quarterly', months: 3, discount_pct: 5, active: true },
  { id: 'yearly', label: 'Yearly', months: 12, discount_pct: 10, active: true }
];

// Escalation offsets are relative to the invoice due date (7.3 defaults).
export const DEFAULT_SETTINGS = {
  default_due_day: 5,
  country_code: '91',
  currency_symbol: '₹',
  language: 'hi',
  stage_advance_enabled: true,
  stage_due_enabled: true,
  stage_overdue_enabled: true,
  stage_final_enabled: true,
  stage_advance_offset: -3,
  stage_due_offset: 0,
  stage_overdue_offset: 5,
  stage_final_offset: 15,
  // 'father' | 'mother' | 'both'. One parent by default halves the taps for a
  // driver with many students; falls back to the other parent if no number.
  reminder_recipients: 'father',
  // 'hindi' | 'english'. A student can override it (students.message_language).
  message_language: 'hindi',
  payment_qr: null, // data URL of the driver's own UPI QR image
  attach_qr: false, // off by default: the share sheet cannot pre-fill the parent's chat; the Pay link covers payment
  quiet_hours_enabled: true,
  quiet_hours_start: 8,
  quiet_hours_end: 20,
  backup_interval_days: 7,
  persistent_storage: null // set on first run by requestPersistence()
};

export async function seedIfEmpty(db) {
  await db.transaction(
    'rw',
    db.fee_plans,
    db.templates,
    db.settings,
    db.meta,
    db.operator,
    db.students,
    async () => {
      if ((await db.fee_plans.count()) === 0) {
        await db.fee_plans.bulkAdd(SEEDED_FEE_PLANS);
      }

      if ((await db.templates.count()) === 0) {
        await db.templates.bulkAdd(SEEDED_TEMPLATES);
      } else {
        // Add any template this phone does not have yet (e.g. the English set), and replace
        // earlier Hinglish wording that the driver never touched with the Hindi version.
        for (const seeded of SEEDED_TEMPLATES) {
          const stored = await db.templates.get(seeded.id);
          if (!stored) {
            await db.templates.add(seeded);
            continue;
          }
          if (seeded.language !== 'hindi') continue;
          if (hinglishForms(seeded.id).includes(stored.body)) {
            await db.templates.update(seeded.id, { body: seeded.body, label: seeded.label, language: 'hindi' });
          } else if (stored.language === 'hinglish') {
            // The driver's own wording: keep the text, just relabel it as the non-English set.
            await db.templates.update(seeded.id, { language: 'hindi', label: seeded.label });
          }
        }
      }

      const existingKeys = new Set((await db.settings.toCollection().primaryKeys()));
      const rows = Object.entries(DEFAULT_SETTINGS)
        .filter(([key]) => !existingKeys.has(key))
        .map(([key, value]) => ({ key, value }));
      if (rows.length) await db.settings.bulkAdd(rows);

      // "Hinglish" became "Hindi": carry over the chosen sending language and each student's own choice.
      const sending = await db.settings.get('message_language');
      if (sending && sending.value === 'hinglish') await db.settings.put({ key: 'message_language', value: 'hindi' });
      await db.students.toCollection().filter((s) => s.message_language === 'hinglish').modify({ message_language: 'hindi' });

      const metaKeys = new Set(await db.meta.toCollection().primaryKeys());
      // One-time: earlier builds defaulted QR attachment to on. Switch it off once so the
      // faster pre-filled chat is the default; a driver can turn it back on in Settings.
      if (!metaKeys.has('attach_qr_default_off')) {
        await db.settings.put({ key: 'attach_qr', value: false });
        await db.meta.put({ key: 'attach_qr_default_off', value: true });
        metaKeys.add('attach_qr_default_off');
      }
      const metaDefaults = [
        { key: 'schema_version', value: SCHEMA_VERSION },
        { key: 'last_backup_at', value: null },
        { key: 'last_invoice_run', value: null }
      ].filter((r) => !metaKeys.has(r.key));
      if (metaDefaults.length) await db.meta.bulkAdd(metaDefaults);

      const operator = await db.operator.get('self');
      if (!operator) {
        await db.operator.put({
          id: 'self',
          name: '',
          business_name: '',
          phone: '',
          upi_id: '',
          mpin_hash: null,
          mpin_salt: null,
          created_at: new Date().toISOString()
        });
      }
    }
  );
}

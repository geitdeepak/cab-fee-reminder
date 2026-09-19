// First-run seed data. Only system defaults are seeded (fee plans, message
// templates, settings, meta) — never fake students or pickup points. Per the
// SRS (14.3 Client Responsibilities) the operator supplies their own pickup
// points and fares; the app starts as a genuinely empty register.
import { SCHEMA_VERSION } from './db.js';

export const SEEDED_TEMPLATES = [
  {
    id: 'advance',
    label: 'Advance Notice (D − 3)',
    language: 'hinglish',
    active: true,
    body:
      'Namaste {parent_name} ji,\n\n' +
      '{student_name} ({class}) ki cab fee ki due date *{due_date}* hai.\n\n' +
      'Period : {period}\n' +
      'Amount : *Rs. {amount}*\n' +
      'Pickup : {pickup_point}\n\n' +
      'Time par payment kar dijiyega. Dhanyavaad.\n\n' +
      '{operator_name}\n{operator_phone}'
  },
  {
    id: 'due',
    label: 'Due Today (D + 0)',
    language: 'hinglish',
    active: true,
    body:
      'Namaste {parent_name} ji,\n\n' +
      '{student_name} ({class}) ki cab fee *aaj due* hai.\n\n' +
      'Period : {period}\n' +
      'Amount : *Rs. {amount}*\n\n' +
      'Aaj hi payment kar dijiye to badi meherbani hogi.\n\n' +
      '{operator_name}\n{operator_phone}'
  },
  {
    id: 'overdue',
    label: 'Overdue (D + 5)',
    language: 'hinglish',
    active: true,
    body:
      'Namaste {parent_name} ji,\n\n' +
      '{student_name} ({class}) ki cab fee *{days_overdue} din* se pending hai.\n\n' +
      'Period : {period}\n' +
      'Amount : *Rs. {amount}*\n' +
      'Due    : {due_date}\n\n' +
      'Kripya jaldi clear kar dijiye. Koi problem ho to mujhe call kar lijiye.\n\n' +
      '{operator_name}\n{operator_phone}'
  },
  {
    id: 'final',
    label: 'Final Notice (D + 15)',
    language: 'hinglish',
    active: true,
    body:
      'Namaste {parent_name} ji,\n\n' +
      '{student_name} ki cab fee *{days_overdue} din* se pending hai.\n\n' +
      'Amount : *Rs. {amount}*\n' +
      'Due    : {due_date}\n\n' +
      'Payment clear na hone par cab service temporarily rokni pad sakti hai. ' +
      'Kripya aaj hi baat kar lijiye.\n\n' +
      '{operator_name}\n{operator_phone}'
  },
  {
    id: 'receipt',
    label: 'Payment Receipt',
    language: 'hinglish',
    active: true,
    body:
      'Namaste {parent_name} ji,\n\n' +
      'Payment mil gaya hai. Dhanyavaad.\n\n' +
      'Receipt : {receipt_no}\n' +
      'Student : {student_name} ({class})\n' +
      'Period  : {period}\n' +
      'Amount  : *Rs. {amount}*\n' +
      'Mode    : {mode}\n' +
      'Date    : {paid_on}\n\n' +
      '{operator_name}'
  }
];

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
    async () => {
      if ((await db.fee_plans.count()) === 0) {
        await db.fee_plans.bulkAdd(SEEDED_FEE_PLANS);
      }
      if ((await db.templates.count()) === 0) {
        await db.templates.bulkAdd(SEEDED_TEMPLATES);
      }
      const existingKeys = new Set((await db.settings.toCollection().primaryKeys()));
      const rows = Object.entries(DEFAULT_SETTINGS)
        .filter(([key]) => !existingKeys.has(key))
        .map(([key, value]) => ({ key, value }));
      if (rows.length) await db.settings.bulkAdd(rows);

      const metaKeys = new Set(await db.meta.toCollection().primaryKeys());
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

// First-run seed data. Only system defaults are seeded (fee plans, message
// templates, settings, meta) — never fake students or pickup points. Per the
// SRS (14.3 Client Responsibilities) the operator supplies their own pickup
// points and fares; the app starts as a genuinely empty register.
import { SCHEMA_VERSION } from './db.js';

// Parent-facing wording. Plain "Rs." (not the rupee sign) because some older
// Android fonts draw a box for it (SRS 8.3). A line containing {upi_id} is
// dropped automatically when the driver has not entered a UPI id.
export const SEEDED_TEMPLATES = [
  {
    id: 'advance',
    label: 'Advance Notice (D − 3)',
    language: 'hinglish',
    active: true,
    body:
      'Namaste {parent_name} ji 🙏\n\n' +
      '{student_name} ({class}) ki cab fee ka ek chhota sa reminder.\n\n' +
      'Period   : {period}\n' +
      'Amount   : *Rs. {amount}*\n' +
      'Due date : *{due_date}*\n' +
      'Pickup   : {pickup_point}\n\n' +
      'Kripya due date tak payment kar dijiyega.\n' +
      '{qr_note}\n' +
      'UPI ID: {upi_id}\n' +
      'Mobile number: {operator_phone}\n' +
      'Payment link: {pay_link}\n\n' +
      'Payment hone par receipt bhej diya jayega. Agar payment ho chuka hai to please bata dijiye.\n\n' +
      'Dhanyavaad 🙏\n{operator_name}\n{operator_phone}'
  },
  {
    id: 'due',
    label: 'Due Today (D + 0)',
    language: 'hinglish',
    active: true,
    body:
      'Namaste {parent_name} ji 🙏\n\n' +
      '{student_name} ({class}) ki cab fee *aaj due* hai.\n\n' +
      'Period : {period}\n' +
      'Amount : *Rs. {amount}*\n\n' +
      'Kripya aaj hi payment kar dijiye.\n' +
      '{qr_note}\n' +
      'UPI ID: {upi_id}\n' +
      'Mobile number: {operator_phone}\n' +
      'Payment link: {pay_link}\n\n' +
      'Agar payment ho chuka hai to please mujhe bata dijiye, main record update kar lunga.\n\n' +
      'Dhanyavaad 🙏\n{operator_name}\n{operator_phone}'
  },
  {
    id: 'overdue',
    label: 'Overdue (D + 5)',
    language: 'hinglish',
    active: true,
    body:
      'Namaste {parent_name} ji 🙏\n\n' +
      '{student_name} ({class}) ki cab fee *{days_overdue} din* se pending hai.\n\n' +
      'Period   : {period}\n' +
      'Amount   : *Rs. {amount}*\n' +
      'Due date : {due_date}\n\n' +
      'Kripya jaldi payment kar dijiye.\n' +
      '{qr_note}\n' +
      'UPI ID: {upi_id}\n' +
      'Mobile number: {operator_phone}\n' +
      'Payment link: {pay_link}\n\n' +
      'Agar aap payment kar chuke hain to screenshot bhej dijiye, main record theek kar dunga. ' +
      'Koi dikkat ho to mujhe call kar lijiye, hum baat karke hal nikal lenge.\n\n' +
      'Dhanyavaad 🙏\n{operator_name}\n{operator_phone}'
  },
  {
    id: 'final',
    label: 'Final Notice (D + 15)',
    language: 'hinglish',
    active: true,
    body:
      'Namaste {parent_name} ji,\n\n' +
      '{student_name} ({class}) ki cab fee *{days_overdue} din* se pending hai. ' +
      'Pehle bhi reminder bheja tha.\n\n' +
      'Amount   : *Rs. {amount}*\n' +
      'Due date : {due_date}\n\n' +
      'Payment clear na hone par mujhe cab service temporarily rokni pad sakti hai, jo hum nahi chahte. ' +
      'Kripya aaj hi payment kar dijiye ya mujhe call karke bata dijiye.\n' +
      '{qr_note}\n' +
      'UPI ID: {upi_id}\n' +
      'Mobile number: {operator_phone}\n' +
      'Payment link: {pay_link}\n\n' +
      'Agar payment ho chuka hai to please mujhe turant bata dijiye.\n\n' +
      'Dhanyavaad 🙏\n{operator_name}\n{operator_phone}'
  },
  {
    id: 'receipt',
    label: 'Payment Receipt',
    language: 'hinglish',
    active: true,
    body:
      'Namaste {parent_name} ji 🙏\n\n' +
      'Aapka payment mil gaya hai. Bahut dhanyavaad.\n\n' +
      'Receipt : {receipt_no}\n' +
      'Student : {student_name} ({class})\n' +
      'Period  : {period}\n' +
      'Amount  : *Rs. {amount}*\n' +
      'Mode    : {mode}\n' +
      'Date    : {paid_on}\n\n' +
      '{operator_name}\n{operator_phone}'
  }
];

// The first-release wording. A stored template that still matches this exactly
// was never edited by the driver, so it is safe to upgrade to the text above.
const LEGACY_V1 = {
  advance:
    'Namaste {parent_name} ji,\n\n{student_name} ({class}) ki cab fee ki due date *{due_date}* hai.\n\nPeriod : {period}\nAmount : *Rs. {amount}*\nPickup : {pickup_point}\n\nTime par payment kar dijiyega. Dhanyavaad.\n\n{operator_name}\n{operator_phone}',
  due:
    'Namaste {parent_name} ji,\n\n{student_name} ({class}) ki cab fee *aaj due* hai.\n\nPeriod : {period}\nAmount : *Rs. {amount}*\n\nAaj hi payment kar dijiye to badi meherbani hogi.\n\n{operator_name}\n{operator_phone}',
  overdue:
    'Namaste {parent_name} ji,\n\n{student_name} ({class}) ki cab fee *{days_overdue} din* se pending hai.\n\nPeriod : {period}\nAmount : *Rs. {amount}*\nDue    : {due_date}\n\nKripya jaldi clear kar dijiye. Koi problem ho to mujhe call kar lijiye.\n\n{operator_name}\n{operator_phone}',
  final:
    'Namaste {parent_name} ji,\n\n{student_name} ki cab fee *{days_overdue} din* se pending hai.\n\nAmount : *Rs. {amount}*\nDue    : {due_date}\n\nPayment clear na hone par cab service temporarily rokni pad sakti hai. Kripya aaj hi baat kar lijiye.\n\n{operator_name}\n{operator_phone}',
  receipt:
    'Namaste {parent_name} ji,\n\nPayment mil gaya hai. Dhanyavaad.\n\nReceipt : {receipt_no}\nStudent : {student_name} ({class})\nPeriod  : {period}\nAmount  : *Rs. {amount}*\nMode    : {mode}\nDate    : {paid_on}\n\n{operator_name}'
};

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
    async () => {
      if ((await db.fee_plans.count()) === 0) {
        await db.fee_plans.bulkAdd(SEEDED_FEE_PLANS);
      }
      if ((await db.templates.count()) === 0) {
        await db.templates.bulkAdd(SEEDED_TEMPLATES);
      } else {
        // Upgrade only templates the driver never touched.
        for (const seeded of SEEDED_TEMPLATES) {
          const stored = await db.templates.get(seeded.id);
          // Wordings an untouched template may still have: v1 first release, v2 UPI line only, v3 link + UPI line.
          const block = '{qr_note}\nUPI ID: {upi_id}\nMobile number: {operator_phone}\nPayment link: {pay_link}\n';
          const v3 = seeded.body.replace(block, 'Payment link: {pay_link}\nUPI: {upi_id}\n'); // previous release
          const v2 = seeded.body.replace(block, 'UPI: {upi_id}\n'); // release before that
          if (stored && [LEGACY_V1[seeded.id], v2, v3].includes(stored.body)) {
            await db.templates.update(seeded.id, { body: seeded.body });
          }
        }
      }
      const existingKeys = new Set((await db.settings.toCollection().primaryKeys()));
      const rows = Object.entries(DEFAULT_SETTINGS)
        .filter(([key]) => !existingKeys.has(key))
        .map(([key, value]) => ({ key, value }));
      if (rows.length) await db.settings.bulkAdd(rows);

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

// FR-07 / FR-08 / Section 7.3-7.4: escalation ladder, message composition and
// the duplicate-prevention guards. Pure functions — no IndexedDB calls.
import { addDays, formatDateHuman, formatPeriodHuman, daysBetween, compareISO } from './dates.js';
import { isSettled, outstandingBalance } from './invoices.js';
import { buildPayLink } from '../lib/payLink.js';

export const STAGES = ['advance', 'due', 'overdue', 'final'];

export const KNOWN_PLACEHOLDERS = [
  'parent_name',
  'student_name',
  'class',
  'school',
  'pickup_point',
  'amount',
  'period',
  'due_date',
  'days_overdue',
  'operator_name',
  'operator_phone',
  'upi_id',
  'pay_link',
  'qr_note',
  // receipt-only
  'receipt_no',
  'mode',
  'paid_on'
];

export function validateTemplate(body) {
  const found = [...body.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  const unknown = [...new Set(found.filter((p) => !KNOWN_PLACEHOLDERS.includes(p)))];
  return { valid: unknown.length === 0, unknown };
}

// A line that mentions one of these is dropped entirely when the value is empty,
// so a driver with no UPI id (or no phone, or no QR attached) never sends a dangling label.
const OPTIONAL_LINE_KEYS = ['upi_id', 'pay_link', 'qr_note', 'operator_phone'];

export function composeMessage(body, dataMap) {
  const value = (key) => (dataMap[key] !== undefined && dataMap[key] !== null ? String(dataMap[key]) : '');
  const lines = body.split('\n').filter((line) => {
    return !OPTIONAL_LINE_KEYS.some((key) => line.includes(`{${key}}`) && value(key).trim() === '');
  });
  return lines
    .join('\n')
    .replace(/\{(\w+)\}/g, (m, key) => value(key))
    .replace(/\n{3,}/g, '\n\n') // no stacked blank lines left behind by dropped lines
    .trim();
}

function stageDate(dueDateIso, offsetDays) {
  return addDays(dueDateIso, offsetDays);
}

function firstName(student) {
  return (student.name || '').split(' ')[0];
}

export const LANGUAGES = ['hindi', 'english'];

/** A student's own choice wins; otherwise the driver's default. Anything unknown (including the old 'hinglish') is Hindi. */
export function languageFor(student, defaultLanguage) {
  const pick = student.message_language || defaultLanguage;
  return pick === 'english' ? 'english' : 'hindi';
}

/** English messages live in templates whose id ends with "_en". */
export function templateIdFor(base, language) {
  return language === 'english' ? `${base}_en` : base;
}

/** How the message greets the parent: their first name, or a fallback that reads naturally. */
export function parentNameFor(recipientName, student, language) {
  if (recipientName) return recipientName.split(' ')[0];
  const first = firstName(student);
  return language === 'english' ? `Parent of ${first}` : `${first} के अभिभावक`;
}

/**
 * Who a reminder goes to. `mode` is 'father', 'mother' or 'both'. A single
 * -parent mode falls back to the other parent when the preferred one has no
 * number, so a family is never silently skipped. If both numbers are the
 * same, only one row is produced (7.4 guard #3).
 */
export function buildRecipients(student, mode = 'both') {
  const father = student.father_phone
    ? { type: 'father', name: student.father_name || '', phone: student.father_phone }
    : null;
  const mother = student.mother_phone
    ? { type: 'mother', name: student.mother_name || '', phone: student.mother_phone }
    : null;

  let list;
  if (mode === 'father') list = [father || mother];
  else if (mode === 'mother') list = [mother || father];
  else if (father && mother && father.phone === mother.phone) {
    list = [{ ...father, name: [father.name, mother.name].filter(Boolean).join(' & ') }];
  } else list = [father, mother];

  return list.filter(Boolean);
}

/** Which template a hand-triggered reminder should use for an invoice today. */
export function stageForManual(invoice, today) {
  const late = daysBetween(invoice.due_date, today);
  if (late >= 15) return 'final';
  if (late >= 1) return 'overdue';
  if (late === 0) return 'due';
  return 'advance';
}

export function makeReminderRow({ invoice, student, pickup, recipient, stage, today, operator = {}, payBaseUrl = '', defaultLanguage = 'hindi' }) {
  const balance = outstandingBalance(invoice);
  const late = Math.max(0, daysBetween(invoice.due_date, today));
  const first = firstName(student);
  const language = languageFor(student, defaultLanguage);
  const parentLabel =
    recipient.name ||
    (language === 'english'
      ? `${recipient.type === 'father' ? 'Father' : 'Mother'} of ${first}`
      : `${first} के ${recipient.type === 'father' ? 'पापा' : 'मम्मी'}`);

  return {
    key: `${invoice.id}|${recipient.type}|${stage}`,
    invoice_id: invoice.id,
    student_id: student.id,
    student_name: student.name,
    class_name: student.class_name,
    pickup_point_name: pickup ? pickup.name : '',
    amount: balance,
    due_date: invoice.due_date,
    days_overdue: late,
    stage,
    language,
    template_id: templateIdFor(stage, language),
    recipient_type: recipient.type,
    recipient_name: parentLabel,
    recipient_phone: recipient.phone,
    data_map: {
      parent_name: parentNameFor(recipient.name, student, language),
      student_name: student.name,
      class: student.class_name,
      school: student.school_name || '',
      pickup_point: pickup ? pickup.name : '',
      amount: balance.toLocaleString('en-IN'),
      period: formatPeriodHuman(invoice.period_start, invoice.period_end),
      due_date: formatDateHuman(invoice.due_date),
      days_overdue: String(late),
      operator_name: operator.name || '',
      operator_phone: operator.phone || '',
      upi_id: operator.upi_id || '',
      // Short link to this site's /p page with the amount owed; '' when no valid UPI id is set.
      pay_link: buildPayLink({
        baseUrl: payBaseUrl,
        upiId: operator.upi_id,
        amount: balance
      })
    }
  };
}

/**
 * The reminders that should be visible in the queue right now: for each
 * unpaid invoice and recipient, ONLY the latest escalation stage reached.
 * An invoice that is 20 days late queues one Final Notice, not four
 * messages (advance + due + overdue + final) at once. A recipient whose
 * latest stage is already in reminder_log gets nothing (7.4 guard #2).
 */
export function buildReminderQueue({
  invoices,
  studentsById,
  pickupPointsById,
  loggedKeys,
  stageSettings,
  today,
  operator = {},
  recipientMode = 'both',
  payBaseUrl = '',
  defaultLanguage = 'hindi'
}) {
  const rows = [];

  for (const inv of invoices) {
    if (isSettled(inv)) continue;
    const student = studentsById.get(inv.student_id);
    if (!student || student.status !== 'active') continue;
    if (outstandingBalance(inv) <= 0) continue;

    const reached = STAGES.filter((stage) => {
      const cfg = stageSettings[stage];
      return cfg && cfg.enabled && compareISO(stageDate(inv.due_date, cfg.offset), today) <= 0;
    });
    if (!reached.length) continue;
    const stage = reached[reached.length - 1];

    const pickup = pickupPointsById.get(student.pickup_point_id);
    for (const recipient of buildRecipients(student, recipientMode)) {
      const key = `${inv.id}|${recipient.type}|${stage}`;
      if (loggedKeys.has(key)) continue;
      rows.push(makeReminderRow({ invoice: inv, student, pickup, recipient, stage, today, operator, payBaseUrl, defaultLanguage }));
    }
  }

  return rows;
}

/** 9.6 backup nag escalation. `intervalDays` (7, or 3 if persistence was
 * denied per 9.2) sets where the green band ends; the amber/red/interstitial
 * bands above that follow the spec's fixed 14/30-day table. */
export function backupBanner(daysSinceBackup, intervalDays = 7) {
  if (daysSinceBackup == null) return 'interstitial';
  if (daysSinceBackup < intervalDays) return 'none';
  if (daysSinceBackup < 14) return 'amber';
  if (daysSinceBackup < 30) return 'red';
  return 'interstitial';
}

export function isWithinQuietHours(date, startHour, endHour) {
  const h = date.getHours();
  return h >= startHour && h < endHour;
}

/**
 * SRS 9.6: from 30 days without a backup, a full-screen prompt on launch that
 * can only be put off with "Remind me tomorrow". It never fires for an empty
 * register, and for a register that was never backed up it counts from the day
 * the app was set up rather than blocking a brand-new driver.
 */
export function needsBackupInterstitial({ daysSinceBackup, studentCount, daysSinceSetup, snoozedUntil = 0, now }) {
  if (!studentCount) return false;
  if (snoozedUntil > now) return false;
  const days = daysSinceBackup != null ? daysSinceBackup : daysSinceSetup;
  return days >= 30;
}

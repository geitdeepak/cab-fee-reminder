// FR-07 / FR-08 / Section 7.3-7.4: escalation ladder, message composition and
// the three duplicate-prevention guards. Pure functions — no IndexedDB calls.
import { addDays, formatDateHuman, formatPeriodHuman, daysBetween, compareISO } from './dates.js';
import { isSettled, outstandingBalance } from './invoices.js';

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

export function composeMessage(body, dataMap) {
  return body.replace(/\{(\w+)\}/g, (m, key) => (dataMap[key] !== undefined && dataMap[key] !== null ? String(dataMap[key]) : ''));
}

function stageDate(dueDateIso, offsetDays) {
  return addDays(dueDateIso, offsetDays);
}

/**
 * Build the set of reminders that should be visible in the queue right now:
 * one row per (invoice, recipient) where the escalation stage has been
 * reached and no reminder_log row already exists for
 * [invoice_id + recipient_type + stage] (7.4 guard #2). Identical parent
 * numbers collapse into a single "father_mother" row (7.4 guard #3).
 *
 * @param {object} args
 * @param {Array} args.invoices
 * @param {Map<string,object>} args.studentsById
 * @param {Map<string,object>} args.pickupPointsById
 * @param {Set<string>} args.loggedKeys - `${invoice_id}|${recipient_type}|${stage}` already in reminder_log
 * @param {object} args.stageSettings - { advance:{enabled,offset}, due:{...}, overdue:{...}, final:{...} }
 * @param {string} args.today - ISO date
 * @param {object} [args.operator]
 */
export function buildReminderQueue({
  invoices,
  studentsById,
  pickupPointsById,
  loggedKeys,
  stageSettings,
  today,
  operator = {}
}) {
  const rows = [];

  for (const inv of invoices) {
    if (isSettled(inv)) continue;
    const student = studentsById.get(inv.student_id);
    if (!student || student.status !== 'active') continue;

    const balance = outstandingBalance(inv);
    if (balance <= 0) continue;

    for (const stage of STAGES) {
      const cfg = stageSettings[stage];
      if (!cfg || !cfg.enabled) continue;
      const fireDate = stageDate(inv.due_date, cfg.offset);
      if (compareISO(fireDate, today) > 0) continue; // stage not reached yet

      const recipients = buildRecipients(student);
      for (const recipient of recipients) {
        const key = `${inv.id}|${recipient.type}|${stage}`;
        if (loggedKeys.has(key)) continue;

        const pickup = pickupPointsById.get(student.pickup_point_id);
        const dataMap = {
          parent_name: recipient.name.split(' ')[0],
          student_name: student.name,
          class: student.class_name,
          school: student.school_name,
          pickup_point: pickup ? pickup.name : '',
          amount: balance.toLocaleString('en-IN'),
          period: formatPeriodHuman(inv.period_start, inv.period_end),
          due_date: formatDateHuman(inv.due_date),
          days_overdue: String(Math.max(0, daysBetween(inv.due_date, today))),
          operator_name: operator.name || '',
          operator_phone: operator.phone || '',
          upi_id: operator.upi_id || ''
        };

        rows.push({
          key,
          invoice_id: inv.id,
          student_id: student.id,
          student_name: student.name,
          class_name: student.class_name,
          pickup_point_name: pickup ? pickup.name : '',
          amount: balance,
          due_date: inv.due_date,
          days_overdue: Math.max(0, daysBetween(inv.due_date, today)),
          stage,
          template_id: stage,
          recipient_type: recipient.type,
          recipient_name: recipient.name,
          recipient_phone: recipient.phone,
          data_map: dataMap
        });
      }
    }
  }

  return rows;
}

/** Guard #3: if both parent numbers are identical, only one row is produced. */
function buildRecipients(student) {
  const father = student.father_phone ? { type: 'father', name: student.father_name, phone: student.father_phone } : null;
  const mother = student.mother_phone ? { type: 'mother', name: student.mother_name, phone: student.mother_phone } : null;

  if (father && mother && father.phone === mother.phone) {
    return [{ type: 'father', name: `${father.name} & ${mother.name}`, phone: father.phone }];
  }
  return [father, mother].filter(Boolean);
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

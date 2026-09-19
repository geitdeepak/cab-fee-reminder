// FR-07 (queue/dispatch), FR-08 (templates), Section 8 (WhatsApp dispatch).
import { db } from '../db/index.js';
import { uuid } from '../lib/id.js';
import {
  buildReminderQueue,
  composeMessage,
  validateTemplate,
  isWithinQuietHours,
  buildRecipients,
  makeReminderRow,
  stageForManual,
  STAGES
} from '../domain/reminders.js';
import { todayISO } from '../domain/dates.js';
import { getSettingsMap, stageSettingsFromMap } from './settings.js';
import { openWhatsApp, buildWaLink, sharePaymentQr, downloadDataUrl } from '../lib/whatsapp.js';
import { getOperator } from './auth.js';

// The link in a message must point at the site the driver is actually using.
const siteOrigin = () => (typeof window !== 'undefined' && window.location ? window.location.origin : '');

const STAGE_ORDER = { final: 0, overdue: 1, due: 2, advance: 3 };

export async function buildQueue() {
  const settingsMap = await getSettingsMap();
  const today = todayISO();

  if (settingsMap.quiet_hours_enabled && !isWithinQuietHours(new Date(), settingsMap.quiet_hours_start, settingsMap.quiet_hours_end)) {
    return { rows: [], quiet: true };
  }

  const [invoices, students, pickupPoints, log, operator] = await Promise.all([
    db.invoices.where('status').anyOf('pending', 'partial', 'overdue').toArray(),
    db.students.toArray(),
    db.pickup_points.toArray(),
    db.reminder_log.toArray(),
    getOperator()
  ]);

  const studentsById = new Map(students.map((s) => [s.id, s]));
  const pickupPointsById = new Map(pickupPoints.map((p) => [p.id, p]));
  const loggedKeys = new Set(log.map((r) => `${r.invoice_id}|${r.recipient_type}|${r.stage}`));

  const rows = buildReminderQueue({
    invoices,
    studentsById,
    pickupPointsById,
    loggedKeys,
    stageSettings: stageSettingsFromMap(settingsMap),
    today,
    operator: operator || {},
    recipientMode: settingsMap.reminder_recipients || 'father',
    payBaseUrl: siteOrigin()
  });

  rows.sort((a, b) => (STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage]) || (b.days_overdue - a.days_overdue));
  return { rows, quiet: false };
}

export async function getTemplateBody(templateId) {
  const t = await db.templates.get(templateId);
  return t ? t.body : '';
}

export async function composeForRow(row) {
  const body = await getTemplateBody(row.template_id);
  return composeMessage(body, row.data_map);
}

/** Writes the reminder_log row BEFORE opening WhatsApp (8.4, step 2) so the
 * intent survives the app being backgrounded, then hands off to wa.me. */
export async function dispatchReminder(row, { withQr } = {}) {
  const settingsMap = await getSettingsMap();
  // Attach the driver's QR automatically whenever one is saved (unless switched off).
  const attachQr = !!settingsMap.payment_qr && (withQr ?? settingsMap.attach_qr !== false);
  const message = await composeForRow(row);
  const now = new Date().toISOString();

  // A hand-sent reminder may hit a stage that already has a log row (e.g. the
  // driver skipped it earlier); reuse that row instead of violating the unique index.
  const existing = await db.reminder_log
    .where('[invoice_id+recipient_type+stage]')
    .equals([row.invoice_id, row.recipient_type, row.stage])
    .first();
  const fields = {
    phone: row.recipient_phone,
    template_id: row.template_id,
    status: 'dispatched',
    skip_reason: null,
    message_text: message,
    dispatched_at: now
  };
  let id;
  if (existing) {
    id = existing.id;
    await db.reminder_log.update(id, fields);
  } else {
    id = uuid();
    await db.reminder_log.add({
      id,
      invoice_id: row.invoice_id,
      student_id: row.student_id,
      recipient_type: row.recipient_type,
      stage: row.stage,
      ...fields
    });
  }

  if (attachQr) {
    const result = await sharePaymentQr(settingsMap.payment_qr, message);
    if (result === 'cancelled') {
      // Nothing was sent: put the reminder back in the queue.
      if (existing) await db.reminder_log.put(existing);
      else await db.reminder_log.delete(id);
      return { logId: id, message, outcome: 'cancelled' };
    }
    if (result === 'unsupported') {
      // Desktop browsers cannot share files: save the QR and open the text chat.
      downloadDataUrl(settingsMap.payment_qr, 'payment-qr.png');
      openWhatsApp(row.recipient_phone, message, settingsMap.country_code);
      return { logId: id, message, outcome: 'downloaded' };
    }
    return { logId: id, message, outcome: 'shared' };
  }

  openWhatsApp(row.recipient_phone, message, settingsMap.country_code);
  return { logId: id, message, outcome: 'opened' };
}

/** "Send reminder now": rows for one unpaid invoice using whichever template
 * fits today, regardless of the automatic schedule. */
export async function manualRowsForInvoice(invoiceId) {
  const [invoice, settingsMap, operator] = await Promise.all([db.invoices.get(invoiceId), getSettingsMap(), getOperator()]);
  if (!invoice || invoice.status === 'paid' || invoice.status === 'cancelled') return [];
  const student = await db.students.get(invoice.student_id);
  if (!student) return [];
  const pickup = await db.pickup_points.get(student.pickup_point_id);
  const today = todayISO();
  const stage = stageForManual(invoice, today);
  return buildRecipients(student, settingsMap.reminder_recipients || 'father').map((recipient) =>
    makeReminderRow({ invoice, student, pickup, recipient, stage, today, operator: operator || {}, payBaseUrl: siteOrigin() })
  );
}

export async function previewLink(row) {
  const settingsMap = await getSettingsMap();
  const message = await composeForRow(row);
  return buildWaLink(row.recipient_phone, message, settingsMap.country_code);
}

export async function skipReminder(row, reason) {
  await db.reminder_log.add({
    id: uuid(),
    invoice_id: row.invoice_id,
    student_id: row.student_id,
    recipient_type: row.recipient_type,
    phone: row.recipient_phone,
    template_id: row.template_id,
    stage: row.stage,
    status: 'skipped',
    skip_reason: reason || '',
    message_text: null,
    dispatched_at: null
  });
}

/** "Undo send" (6.4 honest limitation): pushes a just-dispatched row back
 * into the pending queue by deleting its log entry. */
export async function undoDispatch(logId) {
  await db.reminder_log.delete(logId);
}

export async function getSentToday() {
  const todayPrefix = todayISO();
  const [log, students] = await Promise.all([db.reminder_log.toArray(), db.students.toArray()]);
  const studentsById = new Map(students.map((s) => [s.id, s]));
  return log
    .filter((r) => r.status === 'dispatched' && r.dispatched_at && r.dispatched_at.slice(0, 10) === todayPrefix)
    .sort((a, b) => (a.dispatched_at < b.dispatched_at ? 1 : -1))
    .map((r) => ({
      ...r,
      student_name: studentsById.get(r.student_id)?.name || '—',
      time: r.dispatched_at.slice(11, 16)
    }));
}

// ---------- Templates (FR-08) ----------

export async function listTemplates() {
  return db.templates.toArray();
}

export async function saveTemplate(id, body) {
  const { valid, unknown } = validateTemplate(body);
  if (!valid) {
    const err = new Error(`Unrecognised placeholder {${unknown[0]}} — this will not save.`);
    err.unknown = unknown;
    throw err;
  }
  await db.templates.update(id, { body });
}

export { STAGES };

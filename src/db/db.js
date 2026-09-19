// Dexie (IndexedDB) schema — mirrors SRS Section 5.2 object stores exactly,
// including the two uniqueness rules that make the invoice/reminder engine
// safe to re-run on every launch (5.2.6, 5.2.8).
import Dexie from 'dexie';

export const SCHEMA_VERSION = 1;

export const db = new Dexie('cab_fee_reminder');

db.version(1).stores({
  operator: 'id',
  pickup_points: 'id, &name, active',
  students: 'id, name, class_name, school_name, father_phone, mother_phone, pickup_point_id, status',
  fee_plans: 'id',
  enrolments: 'id, student_id, pickup_point_id, next_period_start, status',
  invoices: 'id, enrolment_id, student_id, &[enrolment_id+period_start], due_date, status',
  payments: 'id, invoice_id, paid_on, &receipt_no',
  reminder_log: 'id, invoice_id, student_id, &[invoice_id+recipient_type+stage], status',
  templates: 'id',
  settings: 'key',
  meta: 'key'
});

export default db;

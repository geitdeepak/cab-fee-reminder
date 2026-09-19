// Bulk import of an existing student register (CSV file or text pasted from a sheet).
import { db } from '../db/index.js';
import { parseRows, toRecords } from '../lib/csv.js';
import { planImport } from '../domain/importPlan.js';
import { billingStartDate } from '../domain/dates.js';
import { savePickupPoint } from './pickups.js';
import { saveStudent } from './students.js';
import { saveEnrolmentWithOpening } from './billing.js';
import { getSettingsMap } from './settings.js';

/** Validates everything and reports what would happen. Writes nothing. */
export async function previewImport(text) {
  const { records, unknownHeaders, missing } = toRecords(parseRows(text));
  const settings = await getSettingsMap();
  const [pickupPoints, students] = await Promise.all([db.pickup_points.toArray(), db.students.toArray()]);
  const plan = planImport(records, {
    pickupPoints,
    students,
    defaults: { plan: 'monthly', dueDay: settings.default_due_day || 5 }
  });
  return { ...plan, unknownHeaders, missing, total: records.length };
}

/** Saves the rows that passed validation. One bad row never blocks the rest. */
export async function runImport(plan) {
  const idByName = new Map((await db.pickup_points.toArray()).map((p) => [p.name.trim().toLowerCase(), p.id]));
  for (const np of plan.newPickups) {
    const key = np.name.trim().toLowerCase();
    if (!idByName.has(key)) {
      idByName.set(key, await savePickupPoint({ name: np.name, monthly_fare: np.fare, active: true }));
    }
  }

  const start = billingStartDate('month');
  let created = 0;
  const failures = [];
  for (const item of plan.ready) {
    try {
      const pickupId = item.pickupId || idByName.get(item.pickupName.trim().toLowerCase());
      const id = await saveStudent({ ...item.student, pickup_point_id: pickupId });
      await saveEnrolmentWithOpening({
        student_id: id,
        pickup_point_id: pickupId,
        fee_plan_id: item.plan,
        due_day: item.dueDay,
        start_date: start,
        thisMonthPaid: item.thisMonthPaid,
        oldDues: item.oldDues
      });
      created++;
    } catch (e) {
      const detail = e.fieldErrors ? Object.values(e.fieldErrors)[0] : e.message;
      failures.push({ line: item.line, message: detail });
    }
  }
  return { created, failures };
}

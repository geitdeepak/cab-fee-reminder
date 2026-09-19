// FR-02: pickup point and fare master.
import { db } from '../db/index.js';
import { uuid } from '../lib/id.js';

export async function listPickupPoints() {
  return db.pickup_points.toArray();
}

export async function countEnrolledAt(pickupPointId) {
  return db.students.where({ pickup_point_id: pickupPointId, status: 'active' }).count();
}

export async function savePickupPoint(data) {
  const name = (data.name || '').trim();
  if (!name) throw new Error('A point name is required.');
  const fare = Number(data.monthly_fare);
  if (!(fare > 0)) throw new Error('Enter a fare in rupees.');

  const existing = await db.pickup_points.where('name').equalsIgnoreCase(name).first();
  if (existing && existing.id !== data.id) throw new Error('That name already exists.');

  const now = new Date().toISOString();
  if (data.id) {
    await db.pickup_points.update(data.id, {
      name,
      area: (data.area || '').trim(),
      monthly_fare: fare,
      distance_km: Number(data.distance_km) || 0,
      active: !!data.active,
      updated_at: now
    });
    return data.id;
  }
  const id = uuid();
  await db.pickup_points.add({
    id,
    name,
    area: (data.area || '').trim(),
    monthly_fare: fare,
    distance_km: Number(data.distance_km) || 0,
    active: data.active !== false,
    created_at: now,
    updated_at: now
  });
  return id;
}

export async function setPickupPointActive(id, active) {
  await db.pickup_points.update(id, { active, updated_at: new Date().toISOString() });
}

/** FR-02: a point with an active enrolment cannot be deleted, only marked inactive. */
export async function removePickupPoint(id) {
  const count = await countEnrolledAt(id);
  if (count > 0) {
    await setPickupPointActive(id, false);
    return { removed: false, madeInactive: true };
  }
  await db.pickup_points.delete(id);
  return { removed: true, madeInactive: false };
}

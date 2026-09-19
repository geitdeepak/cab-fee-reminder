// FR-01: student registration.
import { db } from '../db/index.js';
import { uuid } from '../lib/id.js';
import { isValidMobile, cleanPhone } from '../lib/whatsapp.js';

export function validateStudent(data) {
  const errors = {};
  if (!data.name || data.name.trim().length < 2) errors.name = 'Name is required (2–60 characters).';
  if (!data.class_name || !data.class_name.trim()) errors.class_name = 'Class is required.';
  // School, parent names and the emergency number are optional so a driver
  // can enter a large existing register quickly and complete details later.

  const father = cleanPhone(data.father_phone);
  const mother = cleanPhone(data.mother_phone);
  const fatherOk = father && isValidMobile(father);
  const motherOk = mother && isValidMobile(mother);
  if (!fatherOk && !motherOk) {
    errors.father_phone = '10 digits starting 6–9. At least one parent number is required.';
  } else {
    if (data.father_phone && !fatherOk) errors.father_phone = '10 digits starting 6–9.';
    if (data.mother_phone && !motherOk) errors.mother_phone = '10 digits starting 6–9.';
  }
  const emergency = cleanPhone(data.emergency_phone);
  if (emergency && !isValidMobile(emergency)) errors.emergency_phone = '10 digits starting 6–9.';
  if (!data.pickup_point_id) errors.pickup_point_id = 'Choose a pickup point.';

  return errors;
}

export async function saveStudent(data) {
  const errors = validateStudent(data);
  if (Object.keys(errors).length) {
    const err = new Error('Validation failed');
    err.fieldErrors = errors;
    throw err;
  }
  const now = new Date().toISOString();
  const record = {
    name: data.name.trim(),
    contact: cleanPhone(data.contact) || '',
    class_name: data.class_name.trim(),
    school_name: (data.school_name || '').trim(),
    father_name: (data.father_name || '').trim(),
    father_phone: cleanPhone(data.father_phone),
    mother_name: (data.mother_name || '').trim(),
    mother_phone: cleanPhone(data.mother_phone),
    pickup_point_id: data.pickup_point_id,
    // Falls back to a parent number so the safety card always has someone to call.
    emergency_phone: cleanPhone(data.emergency_phone) || cleanPhone(data.father_phone) || cleanPhone(data.mother_phone),
    blood_group: data.blood_group || 'Unknown',
    allergies: (data.allergies || '').trim(),
    joined_on: data.joined_on || now.slice(0, 10),
    status: data.status || 'active',
    notes: (data.notes || '').trim(),
    // '' = follow the driver's default message language
    // (an old 'hinglish' value from before the switch to Hindi is carried over as 'hindi')
    message_language: data.message_language === 'hinglish' ? 'hindi' : ['hindi', 'english'].includes(data.message_language) ? data.message_language : '',
    updated_at: now
  };
  if (data.id) {
    await db.students.update(data.id, record);
    return data.id;
  }
  const id = uuid();
  await db.students.add({ id, ...record, created_at: now });
  return id;
}

export async function setStudentStatus(id, status) {
  await db.students.update(id, { status, updated_at: new Date().toISOString() });
}

export async function listStudents() {
  return db.students.toArray();
}

export async function getStudent(id) {
  return db.students.get(id);
}

export async function knownSchools() {
  const rows = await db.students.orderBy('school_name').uniqueKeys();
  return rows.filter(Boolean);
}

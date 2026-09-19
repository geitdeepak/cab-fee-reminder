// FR-12: MPIN setup/verification and 9.2 storage-durability request.
import { db } from '../db/index.js';
import { generateSalt, hashMpin } from '../lib/crypto.js';

export async function getOperator() {
  return db.operator.get('self');
}

export async function isMpinSet() {
  const op = await getOperator();
  return !!(op && op.mpin_hash);
}

export async function setupMpin(mpin) {
  const salt = generateSalt();
  const hash = await hashMpin(mpin, salt);
  await db.operator.update('self', { mpin_hash: hash, mpin_salt: salt });
}

export async function verifyMpin(mpin) {
  const op = await getOperator();
  if (!op || !op.mpin_hash) return false;
  const hash = await hashMpin(mpin, op.mpin_salt);
  return hash === op.mpin_hash;
}

export async function saveOperatorProfile({ name, business_name, phone, upi_id }) {
  await db.operator.update('self', { name, business_name, phone, upi_id });
}

/** 9.2: request durable storage; if denied, tighten the backup nag interval. */
export async function requestPersistence() {
  let granted = null;
  try {
    if (navigator.storage && navigator.storage.persist) {
      granted = await navigator.storage.persist();
    }
  } catch {
    granted = null;
  }
  await db.settings.put({ key: 'persistent_storage', value: granted });
  if (granted === false) {
    await db.settings.put({ key: 'backup_interval_days', value: 3 });
  }
  return granted;
}

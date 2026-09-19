import { db } from '../db/index.js';
import { DEFAULT_SETTINGS } from '../db/seed.js';

export async function getSettingsMap() {
  const rows = await db.settings.toArray();
  const map = { ...DEFAULT_SETTINGS };
  for (const r of rows) map[r.key] = r.value;
  return map;
}

export async function setSetting(key, value) {
  await db.settings.put({ key, value });
}

export async function setSettings(entries) {
  await db.settings.bulkPut(Object.entries(entries).map(([key, value]) => ({ key, value })));
}

export function stageSettingsFromMap(map) {
  return {
    advance: { enabled: !!map.stage_advance_enabled, offset: Number(map.stage_advance_offset) },
    due: { enabled: !!map.stage_due_enabled, offset: Number(map.stage_due_offset) },
    overdue: { enabled: !!map.stage_overdue_enabled, offset: Number(map.stage_overdue_offset) },
    final: { enabled: !!map.stage_final_enabled, offset: Number(map.stage_final_offset) }
  };
}

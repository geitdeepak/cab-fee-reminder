// Pure validation for the student import: decides, row by row, what would be
// created, what is wrong, and what is skipped as a duplicate — before anything
// is written. No IndexedDB here (SRS 12.5).
import { cleanPhone, isValidMobile } from '../lib/whatsapp.js';

const PLAN_ALIASES = {
  monthly: 'monthly', month: 'monthly', '1': 'monthly', m: 'monthly',
  quarterly: 'quarterly', quarter: 'quarterly', '3': 'quarterly', q: 'quarterly',
  yearly: 'yearly', year: 'yearly', annual: 'yearly', '12': 'yearly', y: 'yearly'
};

const LANGUAGE_ALIASES = { hindi: 'hindi', hinglish: 'hindi', hi: 'hindi', english: 'english', en: 'english', eng: 'english' };

const YES = new Set(['y', 'yes', 'true', '1', 'paid', 'haan', 'ha', 'han', 'done', 'x']);

function num(v) {
  const n = Number(String(v || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function dupKey(name, phone) {
  return `${(name || '').trim().toLowerCase()}|${phone}`;
}

/**
 * @param {Array} records rows keyed by canonical field (see lib/csv.js)
 * @param {object} ctx { pickupPoints, students, defaults: {plan, dueDay} }
 */
export function planImport(records, { pickupPoints, students, defaults = { plan: 'monthly', dueDay: 5 } }) {
  const pickupByName = new Map(pickupPoints.map((p) => [p.name.trim().toLowerCase(), p]));
  const seen = new Set();
  for (const s of students) {
    for (const ph of [s.father_phone, s.mother_phone]) if (ph) seen.add(dupKey(s.name, ph));
  }

  const newPickups = new Map(); // lower-case name -> { name, fare }

  const items = records.map((r) => {
    const errors = [];
    const father = cleanPhone(r.father_phone);
    const mother = cleanPhone(r.mother_phone);
    const fatherOk = father && isValidMobile(father);
    const motherOk = mother && isValidMobile(mother);

    if (!r.name || r.name.trim().length < 2) errors.push('Name is missing');
    if (!r.class_name) errors.push('Class is missing');
    if (!fatherOk && !motherOk) errors.push('Needs a valid 10-digit parent number');
    else if ((father && !fatherOk) || (mother && !motherOk)) errors.push('A parent number is not a valid 10-digit mobile');

    const pickupName = (r.pickup || '').trim();
    let pickup = null;
    let createPickup = null;
    if (!pickupName) errors.push('Pickup point is missing');
    else {
      pickup = pickupByName.get(pickupName.toLowerCase()) || null;
      if (!pickup) {
        const known = newPickups.get(pickupName.toLowerCase());
        const fare = num(r.fare) || (known ? known.fare : 0);
        if (fare > 0) {
          createPickup = { name: pickupName, fare };
          if (!known) newPickups.set(pickupName.toLowerCase(), createPickup);
        } else errors.push(`Pickup point "${pickupName}" does not exist — add it, or give a fare in the file`);
      }
    }

    const planRaw = String(r.plan || '').trim().toLowerCase();
    const plan = planRaw ? PLAN_ALIASES[planRaw] : defaults.plan;
    if (!plan) errors.push(`Plan "${r.plan}" is not monthly, quarterly or yearly`);

    // Blank = follow the driver's default message language.
    const langRaw = String(r.message_language || '').trim().toLowerCase();
    const messageLanguage = langRaw ? LANGUAGE_ALIASES[langRaw] : '';
    if (langRaw && !messageLanguage) errors.push(`Language "${r.message_language}" is not English or Hindi`);

    let dueDay = defaults.dueDay;
    if (r.due_day) {
      dueDay = Math.round(num(r.due_day));
      if (dueDay < 1 || dueDay > 28) errors.push('Due day must be 1 to 28');
    }

    const item = {
      line: r._line,
      student: {
        name: (r.name || '').trim(),
        class_name: (r.class_name || '').trim(),
        school_name: r.school_name || '',
        father_name: r.father_name || '',
        father_phone: father,
        mother_name: r.mother_name || '',
        mother_phone: mother,
        blood_group: r.blood_group || 'Unknown',
        allergies: r.allergies || '',
        notes: r.notes || '',
        message_language: messageLanguage || ''
      },
      pickupName,
      pickupId: pickup ? pickup.id : null,
      createPickup,
      plan,
      dueDay,
      thisMonthPaid: YES.has(String(r.paid || '').trim().toLowerCase()),
      oldDues: num(r.old_dues),
      errors,
      duplicate: false
    };

    if (!errors.length) {
      const keys = [fatherOk && dupKey(item.student.name, father), motherOk && dupKey(item.student.name, mother)].filter(Boolean);
      if (keys.some((k) => seen.has(k))) item.duplicate = true;
      else keys.forEach((k) => seen.add(k));
    }
    return item;
  });

  return {
    items,
    ready: items.filter((i) => !i.errors.length && !i.duplicate),
    invalid: items.filter((i) => i.errors.length),
    duplicates: items.filter((i) => !i.errors.length && i.duplicate),
    newPickups: [...newPickups.values()]
  };
}

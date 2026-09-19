// Pure date arithmetic over plain 'YYYY-MM-DD' strings (SRS 5.1 fields are
// "ISO date", no time component). No Date-object month-rollover bugs: month
// addition clamps to the last real day of the target month.
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function todayISO(d = new Date()) {
  return toISODate(d);
}

export function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parts(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

function daysInMonth(y, m /* 1-12 */) {
  return new Date(y, m, 0).getDate();
}

function pad(iso) {
  const { y, m, d } = parts(iso);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Add `n` calendar months to an ISO date, clamping the day to the target
 * month's last day when it doesn't exist there (e.g. 31 Jan + 1mo = 28/29 Feb). */
export function addMonths(iso, n) {
  const { y, m, d } = parts(iso);
  const total = (m - 1) + n;
  const ny = y + Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12 + 1;
  const nd = Math.min(d, daysInMonth(ny, nm));
  return `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

/** Add whole days to an ISO date. */
export function addDays(iso, n) {
  const { y, m, d } = parts(iso);
  const dt = new Date(y, m - 1, d + n);
  return toISODate(dt);
}

export function compareISO(a, b) {
  return a === b ? 0 : a < b ? -1 : 1;
}

/** period_end = one day before the next period start (5.4 worked example). */
export function periodEnd(periodStart, months) {
  return addDays(addMonths(periodStart, months), -1);
}

/** due_date = due_day of the period-start month, rolled forward one month if
 * the period starts after that day (7.2 pseudocode). due_day is 1-28. */
export function dueDate(periodStart, dueDay) {
  const { y, m } = parts(periodStart);
  let candidate = `${y}-${String(m).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
  if (compareISO(candidate, periodStart) < 0) {
    candidate = addMonths(candidate, 1);
  }
  return candidate;
}

export function daysBetween(fromISO, toIso) {
  const { y: y1, m: m1, d: d1 } = parts(fromISO);
  const { y: y2, m: m2, d: d2 } = parts(toIso);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86400000);
}

export function formatDateHuman(iso) {
  if (!iso) return '';
  const { y, m, d } = parts(iso);
  return `${String(d).padStart(2, '0')} ${MONTH_NAMES[m - 1]} ${y}`;
}

export function formatPeriodHuman(periodStart, periodEndIso) {
  const { m: m1, y: y1 } = parts(periodStart);
  const { m: m2, y: y2 } = parts(periodEndIso);
  if (m1 === m2 && y1 === y2) return `${MONTH_NAMES[m1 - 1]} ${y1}`;
  if (y1 === y2) return `${MONTH_NAMES[m1 - 1]}–${MONTH_NAMES[m2 - 1]} ${y1}`;
  return `${MONTH_NAMES[m1 - 1]} ${y1} – ${MONTH_NAMES[m2 - 1]} ${y2}`;
}

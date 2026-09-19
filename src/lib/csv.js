// Minimal CSV/TSV reader for the student import. Accepts a file, or text pasted
// straight from Excel / Google Sheets (tab-separated). Handles quoted cells,
// embedded commas/newlines, CRLF and a UTF-8 BOM. No dependencies.

function detectDelimiter(firstLine) {
  const tabs = (firstLine.match(/\t/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  if (tabs >= commas && tabs >= semis && tabs > 0) return '\t';
  if (semis > commas) return ';';
  return ',';
}

export function parseRows(text) {
  const src = text.replace(/^﻿/, '');
  const delimiter = detectDelimiter(src.split(/\r?\n/, 1)[0] || '');
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delimiter) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

// Header aliases -> canonical field. Comparison ignores case, spaces and punctuation.
const ALIASES = {
  name: ['name', 'student', 'studentname', 'naam', 'bachchekanaam'],
  class_name: ['class', 'std', 'standard', 'grade', 'cls'],
  school_name: ['school', 'schoolname'],
  father_name: ['fathername', 'father', 'papa', 'papakanaam'],
  father_phone: ['fatherphone', 'fathermobile', 'fathernumber', 'fathercontact', 'papaphone', 'papanumber', 'phone', 'mobile', 'contact', 'parentphone', 'parentmobile'],
  mother_name: ['mothername', 'mother', 'mummy', 'mummykanaam'],
  mother_phone: ['motherphone', 'mothermobile', 'mothernumber', 'mothercontact', 'mummyphone', 'mummynumber'],
  pickup: ['pickup', 'pickuppoint', 'point', 'stop', 'route', 'area', 'pickupname'],
  fare: ['fare', 'monthlyfare', 'fee', 'monthlyfee', 'amount'],
  plan: ['plan', 'feeplan', 'billing'],
  due_day: ['dueday', 'due', 'duedate'],
  paid: ['paid', 'paidthismonth', 'thismonthpaid', 'paidstatus'],
  old_dues: ['olddues', 'pending', 'balance', 'dues', 'previousdues', 'arrears', 'pendingamount'],
  blood_group: ['bloodgroup', 'blood'],
  allergies: ['allergy', 'allergies'],
  notes: ['notes', 'note', 'remarks'],
  message_language: ['language', 'lang', 'messagelanguage', 'bhasha']
};

function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const ALIAS_LOOKUP = new Map();
for (const [field, list] of Object.entries(ALIASES)) for (const a of list) ALIAS_LOOKUP.set(a, field);

/** Turns raw rows (first row = headers) into records keyed by canonical field. */
export function toRecords(rows) {
  if (!rows.length) return { records: [], unknownHeaders: [], missing: ['name'] };
  const headers = rows[0].map((h) => ALIAS_LOOKUP.get(norm(h)) || null);
  const unknownHeaders = rows[0].filter((h, i) => !headers[i] && String(h).trim() !== '');
  const records = rows.slice(1).map((cells, idx) => {
    const rec = { _line: idx + 2 };
    headers.forEach((field, i) => {
      // First column mapped to a field wins, so a later duplicate header can't overwrite it.
      if (field && rec[field] === undefined) rec[field] = (cells[i] ?? '').trim();
    });
    return rec;
  });
  const present = new Set(headers.filter(Boolean));
  const missing = ['name', 'class_name', 'pickup'].filter((f) => !present.has(f));
  if (!present.has('father_phone') && !present.has('mother_phone')) missing.push('father_phone');
  return { records, unknownHeaders, missing };
}

export const TEMPLATE_CSV =
  'name,class,father_name,father_phone,mother_name,mother_phone,pickup,fare,plan,due_day,paid,old_dues,school,language\n' +
  'Aarav Sharma,IV,Rajesh Sharma,9876543210,Sunita Sharma,9811223344,Alpha-1 Main Gate,1600,monthly,5,yes,0,DPS,hinglish\n' +
  'Diya Verma,VII,Manoj Verma,9900112233,,,Beta-2 Market,1800,quarterly,5,no,1800,St Xavier,english\n';

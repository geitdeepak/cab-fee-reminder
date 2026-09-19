// Payment link that goes inside the reminder text. WhatsApp turns a plain
// https link into a tappable one (a bare upi:// link is not made tappable), so
// the message links to a tiny static page on this same site (/pay) which
// carries the driver's UPI id and the exact amount in the URL and hands them
// to the parent's UPI app. No server, no stored data, works for every driver.

const UPI_ID_RE = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9.-]{1,32}$/;
const MAX_AMOUNT = 100000; // UPI per-payment ceiling for most apps

export function isValidUpiId(value) {
  return UPI_ID_RE.test((value || '').trim());
}

function query(params) {
  return Object.entries(params)
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
}

/**
 * The https link put in the WhatsApp message, kept as short as possible because it sits
 * inside a chat message: /p?u=<upi id>&a=<amount>. The UPI id keeps its "@" encoded (%40)
 * so no chat app mistakes it for an email address and cuts the link. The driver's name is
 * left out (the message already ends with it). Empty string when it cannot be built.
 */
export function buildPayLink({ baseUrl, upiId, amount }) {
  if (!baseUrl || !isValidUpiId(upiId)) return '';
  const am = Math.round(Number(amount) || 0);
  const q = query({ u: upiId.trim(), a: am > 0 && am <= MAX_AMOUNT ? String(am) : '' });
  return `${baseUrl.replace(/\/+$/, '')}/p?${q}`;
}

/**
 * Reads and validates the link parameters on the /p page. Also understands the
 * longer first-release format (/pay?pa=&pn=&am=&tn=) so links already sent keep working.
 */
export function parsePayParams(search) {
  const q = new URLSearchParams(search);
  const get = (...keys) => keys.map((k) => q.get(k)).find((v) => v) || '';
  const upiId = get('u', 'pa').trim();
  if (!isValidUpiId(upiId)) return { ok: false, error: 'invalid' };
  const am = Number(get('a', 'am'));
  return {
    ok: true,
    upiId,
    name: get('n', 'pn').trim().slice(0, 40),
    amount: Number.isFinite(am) && am > 0 && am <= MAX_AMOUNT ? am : 0,
    note: get('tn').trim().slice(0, 50)
  };
}

const SCHEMES = {
  any: 'upi://pay',
  gpay: 'tez://upi/pay',
  phonepe: 'phonepe://pay',
  paytm: 'paytmmp://pay'
};

/** The deep link that opens a UPI app with payee and amount already filled in. */
export function upiDeepLink(kind, { upiId, name, amount, note }) {
  const base = SCHEMES[kind] || SCHEMES.any;
  return `${base}?${query({
    pa: upiId,
    pn: name,
    am: amount > 0 ? amount.toFixed(2) : '',
    cu: 'INR',
    tn: note
  })}`;
}

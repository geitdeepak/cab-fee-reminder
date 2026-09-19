// Section 8: Meta's public click-to-chat URL scheme only. No Cloud API, no
// unofficial automation library — see 8.6 for why that line is not crossed.
export function cleanPhone(raw) {
  if (!raw) return '';
  let s = String(raw).replace(/[\s\-()]/g, '');
  s = s.replace(/^\+/, '');
  if (s.length === 11 && s.startsWith('0')) s = s.slice(1);
  if (s.length === 12 && s.startsWith('91')) s = s.slice(2);
  return s;
}

export function isValidMobile(cleaned) {
  return /^[6-9]\d{9}$/.test(cleaned);
}

export function buildWaLink(phone10, message, countryCode = '91') {
  const clean = cleanPhone(phone10);
  const text = encodeURIComponent(message);
  return `https://wa.me/${countryCode}${clean}?text=${text}`;
}

export function openWhatsApp(phone10, message, countryCode = '91') {
  const url = buildWaLink(phone10, message, countryCode);
  window.open(url, '_blank', 'noopener');
}

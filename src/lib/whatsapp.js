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

/**
 * wa.me links can only pre-fill text, never attach a file. To send the driver's
 * payment QR with a message we use the phone's share sheet (Web Share API), which
 * can carry an image plus a caption. The trade-off: the driver picks the chat in
 * the share sheet, because the recipient cannot be pre-filled that way.
 * Returns 'shared', 'cancelled' or 'unsupported' (e.g. desktop browsers).
 */
export async function sharePaymentQr(dataUrl, message) {
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], 'payment-qr.png', { type: blob.type || 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: message });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
      throw e;
    }
  }
  return 'unsupported';
}

export function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function openWhatsApp(phone10, message, countryCode = '91') {
  const url = buildWaLink(phone10, message, countryCode);
  window.open(url, '_blank', 'noopener');
}

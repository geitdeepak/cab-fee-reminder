// FR-12 / SEC-01: MPIN is never stored in clear text. SHA-256 with a random
// per-install salt via the browser's native Web Crypto API — no library.
function bufToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return bufToHex(bytes);
}

export async function hashMpin(mpin, salt) {
  const enc = new TextEncoder().encode(`${salt}:${mpin}`);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return bufToHex(digest);
}

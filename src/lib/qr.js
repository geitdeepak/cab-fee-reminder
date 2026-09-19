import qrcode from 'qrcode-generator';

/**
 * Draws a QR code as a single SVG path (dark modules only), so it can be
 * rendered as plain markup without innerHTML. Returns { size, path } where
 * `size` is the grid size including the quiet zone.
 */
export function qrPath(text, { margin = 3 } = {}) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let path = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) path += `M${c + margin} ${r + margin}h1v1h-1z`;
    }
  }
  return { size: n + margin * 2, path };
}

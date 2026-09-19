import { useState } from 'preact/hooks';
import { parsePayParams, upiDeepLink } from '../lib/payLink.js';

// The page a parent lands on from the "Payment link" in a reminder. It is public,
// has no login and touches no database — everything comes from the link itself.
// Because anyone could craft such a link, the payee name and UPI id are always
// shown so the parent can check them before paying.
export function PayPage() {
  const details = parsePayParams(window.location.search);
  const [copied, setCopied] = useState(false);

  if (!details.ok) {
    return (
      <div class="app-shell" style="padding:32px 20px">
        <div style="font-weight:800;font-size:22px">Ye payment link sahi nahi hai</div>
        <div style="margin-top:10px;line-height:1.55;color:var(--color-neutral-800)">
          This payment link is not valid. Please ask the driver to send the message again.
        </div>
      </div>
    );
  }

  const link = (kind) => upiDeepLink(kind, details);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(details.upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the id is on screen to copy by hand.
    }
  }

  return (
    <div class="app-shell" style="background:var(--color-bg)">
      <div style="background:var(--color-text);color:#fff;padding:26px 20px">
        <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:700;color:var(--color-accent-200)">Cab fee payment</div>
        <div style="font-weight:800;font-size:22px;margin-top:8px;line-height:1.2">
          {details.name ? `${details.name} ko payment` : 'Payment'}
        </div>
        {details.amount > 0 && (
          <div style="font-weight:800;font-size:44px;margin-top:10px;line-height:1">
            {'₹'}{details.amount.toLocaleString('en-IN')}
          </div>
        )}
        {details.note && <div style="margin-top:8px;font-size:13px;color:var(--color-neutral-300)">{details.note}</div>}
      </div>

      <div style="padding:20px;display:flex;flex-direction:column;gap:12px">
        <a class="btn btn-accent btn-block" style="justify-content:center;text-decoration:none;font-size:16px" href={link('any')}>
          UPI app se pay kijiye
        </a>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
          <a class="btn btn-secondary" style="justify-content:center;text-decoration:none;padding:12px 6px" href={link('gpay')}>Google Pay</a>
          <a class="btn btn-secondary" style="justify-content:center;text-decoration:none;padding:12px 6px" href={link('phonepe')}>PhonePe</a>
          <a class="btn btn-secondary" style="justify-content:center;text-decoration:none;padding:12px 6px" href={link('paytm')}>Paytm</a>
        </div>

        <div class="card card-tight" style="display:flex;flex-direction:column;gap:6px">
          <div class="stat-label">UPI ID</div>
          <div style="font-weight:800;font-size:17px;word-break:break-all">{details.upiId}</div>
          <button class="btn btn-secondary" style="align-self:flex-start" onClick={copyId}>{copied ? 'Copy ho gaya ✓' : 'UPI ID copy kijiye'}</button>
        </div>

        <div style="font-size:12.5px;line-height:1.6;color:var(--color-neutral-800)">
          Pay karne se pehle naam aur UPI ID ek baar check kar lijiye. Payment ke baad driver ko screenshot bhej dijiye.
          <br />
          Check the name and UPI ID before paying, and send the driver a screenshot afterwards. If no app opens, open this link on your phone or pay to the UPI ID above.
        </div>
      </div>
    </div>
  );
}

import { useState, useMemo } from 'preact/hooks';
import { parsePayParams, upiDeepLink } from '../lib/payLink.js';
import { qrPath } from '../lib/qr.js';

// The page a parent lands on from the "Payment link" in a reminder. It is public,
// has no login and touches no database — everything comes from the link itself.
//
// UPI apps decline payments started from a web link to a personal UPI id
// ("declined for security reasons" — seen on both PhonePe and Google Pay in real
// testing), so there is deliberately no "open my UPI app" button. The parent copies
// the UPI id and pays it from inside their own app, or uses the QR.
//
// Anyone could craft such a link, so the payee name and UPI id are always shown.
export function PayPage() {
  const details = parsePayParams(window.location.search);
  const [copied, setCopied] = useState('');

  // Same payload a normal UPI QR carries, so PhonePe/GPay/Paytm can read it.
  const qr = useMemo(() => (details.ok ? qrPath(upiDeepLink('any', { ...details, note: details.note || 'Cab fee' })) : null), [window.location.search]);

  if (!details.ok) {
    return (
      <div class="app-shell" style="padding:32px 20px">
        <div style="font-weight:800;font-size:22px">यह पेमेंट लिंक सही नहीं है</div>
        <div style="margin-top:10px;line-height:1.55;color:var(--color-neutral-800)">
          This payment link is not valid. Please ask the driver to send the message again.
        </div>
      </div>
    );
  }

  const amountText = details.amount > 0 ? details.amount.toLocaleString('en-IN') : '';

  async function copy(what, value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(''), 2200);
    } catch {
      // Clipboard blocked: the value is on screen to copy by hand.
    }
  }

  return (
    <div class="app-shell" style="background:var(--color-bg)">
      <div style="background:var(--color-text);color:#fff;padding:26px 20px">
        <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:700;color:var(--color-accent-200)">कैब फ़ीस पेमेंट · Cab fee payment</div>
        <div style="font-weight:800;font-size:22px;margin-top:8px;line-height:1.2">
          {details.name ? `${details.name} को पेमेंट` : 'पेमेंट'}
        </div>
        {amountText && (
          <div style="font-weight:800;font-size:44px;margin-top:10px;line-height:1">{'₹'}{amountText}</div>
        )}
        {details.note && <div style="margin-top:8px;font-size:13px;color:var(--color-neutral-300)">{details.note}</div>}
      </div>

      <div style="padding:20px;display:flex;flex-direction:column;gap:14px">
        <div class="card card-tight" style="display:flex;flex-direction:column;gap:8px">
          <div class="stat-label">UPI ID</div>
          <div style="font-weight:800;font-size:19px;word-break:break-all">{details.upiId}</div>
          <button class="btn btn-accent" style="align-self:flex-start;font-size:15px" onClick={() => copy('id', details.upiId)}>
            {copied === 'id' ? 'कॉपी हो गया ✓' : 'UPI ID कॉपी कीजिए'}
          </button>
        </div>

        <div>
          <div style="font-weight:800;font-size:15px">पेमेंट कैसे करें / How to pay</div>
          <ol style="margin:8px 0 0;padding-left:20px;line-height:1.7;font-size:14px">
            <li>PhonePe / Google Pay / Paytm खोलिए</li>
            <li>"UPI ID पर भेजें" ("Pay to UPI ID") चुनिए और कॉपी किया हुआ ID पेस्ट कीजिए</li>
            {amountText ? <li>रकम <b>{'₹'}{amountText}</b> डालिए और पेमेंट कीजिए</li> : <li>रकम डालिए और पेमेंट कीजिए</li>}
            <li>पेमेंट के बाद स्क्रीनशॉट ड्राइवर को भेज दीजिए</li>
          </ol>
          <div style="margin-top:6px;font-size:12.5px;color:var(--color-neutral-700);line-height:1.55">
            Open your UPI app, choose "Pay to UPI ID", paste the ID above, enter the amount, and send the driver a screenshot.
          </div>
        </div>

        {qr && (
          <div class="card card-tight" style="display:flex;flex-direction:column;align-items:center;gap:8px">
            <div class="stat-label" style="align-self:flex-start">या QR से पेमेंट कीजिए / Or pay by QR</div>
            <svg
              viewBox={`0 0 ${qr.size} ${qr.size}`}
              width="220"
              height="220"
              role="img"
              aria-label="UPI payment QR code"
              shape-rendering="crispEdges"
              style="background:#fff;border:2px solid var(--color-text)"
            >
              <path d={qr.path} fill="#000" />
            </svg>
            <div style="font-size:12px;line-height:1.5;color:var(--color-neutral-700);text-align:center">
              इस QR का स्क्रीनशॉट लेकर UPI ऐप में "QR स्कैन / अपलोड" से चुनिए, या किसी दूसरे फ़ोन से स्कैन कीजिए।
              <br />
              Take a screenshot and pick it with your UPI app's "Scan / Upload QR", or scan it from another phone.
            </div>
          </div>
        )}

        <div style="font-size:12.5px;line-height:1.6;color:var(--color-neutral-800)">
          पेमेंट करने से पहले नाम और UPI ID एक बार जाँच लीजिए।
          <br />
          Check the name and UPI ID before paying.
        </div>
      </div>
    </div>
  );
}

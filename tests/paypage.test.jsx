// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from 'preact';
import { PayPage } from '../src/ui/PayPage.jsx';

function mount(url) {
  window.happyDOM.setURL(url);
  const el = document.createElement('div');
  document.body.appendChild(el);
  render(<PayPage />, el);
  return el;
}

describe('/pay page', () => {
  it('leads with the UPI id, the amount, the steps and a QR — not with a payment button', () => {
    const el = mount('https://cabfee.dev/pay?pa=ramesh%40upi&pn=Ramesh%20Kumar&am=1600&tn=Cab%20fee%20Aarav');
    expect(el.textContent).toContain('Ramesh Kumar');
    expect(el.textContent).toContain('1,600');
    expect(el.textContent).toContain('ramesh@upi'); // always visible so the parent can check it
    expect(el.textContent).toContain('UPI ID कॉपी कीजिए');
    expect(el.textContent).toContain('Pay to UPI ID');
    const svg = el.querySelector('svg[aria-label="UPI payment QR code"]');
    expect(svg).not.toBeNull();
    expect(svg.querySelector('path').getAttribute('d').length).toBeGreaterThan(200); // a real QR, not an empty box
  });

  it('has no "open my UPI app" buttons — PhonePe and Google Pay both decline payments started from a link', () => {
    const el = mount('https://cabfee.dev/pay?pa=ramesh%40upi&pn=Ramesh%20Kumar&am=1600&tn=Cab%20fee%20Aarav');
    expect(el.querySelectorAll('a').length).toBe(0);
    expect(el.querySelector('details')).toBeNull();
    expect(el.innerHTML).not.toMatch(/upi:\/\/|tez:\/\/|phonepe:\/\//);
  });

  it('refuses a link with a missing or malformed UPI id and offers no pay buttons', () => {
    const el = mount('https://cabfee.dev/pay?pa=not-a-upi-id&am=500');
    expect(el.textContent).toContain('सही नहीं');
    expect(el.querySelectorAll('a').length).toBe(0);
  });

  it('cannot be made to inject markup through the name parameter', () => {
    const el = mount('https://cabfee.dev/pay?pa=ramesh%40upi&pn=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E');
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('<img');
  });
});

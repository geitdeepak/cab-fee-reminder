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
  it('shows payee, exact amount and working deep links for a good link', () => {
    const el = mount('https://cabfee.dev/pay?pa=ramesh%40upi&pn=Ramesh%20Kumar&am=1600&tn=Cab%20fee%20Aarav');
    expect(el.textContent).toContain('Ramesh Kumar');
    expect(el.textContent).toContain('1,600');
    expect(el.textContent).toContain('ramesh@upi'); // always visible so the parent can check it
    const hrefs = [...el.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs[0]).toBe('upi://pay?pa=ramesh%40upi&pn=Ramesh%20Kumar&am=1600.00&cu=INR&tn=Cab%20fee%20Aarav');
    expect(hrefs.some((h) => h.startsWith('tez://'))).toBe(true);
    expect(hrefs.some((h) => h.startsWith('phonepe://'))).toBe(true);
  });

  it('refuses a link with a missing or malformed UPI id and offers no pay buttons', () => {
    const el = mount('https://cabfee.dev/pay?pa=not-a-upi-id&am=500');
    expect(el.textContent).toContain('sahi nahi');
    expect(el.querySelectorAll('a').length).toBe(0);
  });

  it('cannot be made to inject markup through the name parameter', () => {
    const el = mount('https://cabfee.dev/pay?pa=ramesh%40upi&pn=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E');
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('<img');
  });
});

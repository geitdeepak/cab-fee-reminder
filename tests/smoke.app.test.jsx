// @vitest-environment happy-dom
//
// A mount-time smoke test: renders the real <App/> tree against an
// in-memory IndexedDB (fake-indexeddb) inside a DOM shim (happy-dom),
// drives the actual first-run flow through real DOM events, and lands on
// the Dashboard — the most query-heavy screen (five parallel useLiveQuery
// calls against an otherwise-empty database). This catches the class of
// bug `vite build` and the pure-domain unit tests cannot: hooks misuse, a
// screen throwing on first render, state wiring bugs like a reducer action
// silently clobbering the selected language.
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { render } from 'preact';
import { App } from '../src/app.jsx';
import { db } from '../src/db/index.js';

function flush(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(check, { timeout = 10000, interval = 15 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = check();
    if (result) return result;
    await flush(interval);
  }
  throw new Error('waitFor: condition never became true: ' + check.toString().replace(/\s+/g, ' ').slice(0, 160));
}

function clickByText(container, selector, text) {
  const el = [...container.querySelectorAll(selector)].find((n) => n.textContent.trim() === text);
  if (!el) throw new Error(`No "${selector}" with text "${text}" found`);
  el.click();
  return el;
}

async function tapKeypad(container, digits) {
  for (const d of digits) {
    clickByText(container, '.keypad button', d);
    await flush(20);
  }
}

describe('App mount smoke test', () => {
  it('walks first-run setup through to an unlocked Dashboard', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    render(<App needRefresh={false} onRefresh={() => {}} />, container);

    // --- Boot: seeds the DB, finds no MPIN, lands on the setup screen ---
    await waitFor(() => container.querySelector('input'));
    expect(container.innerHTML).toContain('शुरू करते हैं'); // default Hindi copy
    expect(document.documentElement.lang).toBe('hi'); // page language drives Devanagari spacing/fonts

    // The language switch is present on the very first screen and works both ways.
    clickByText(container, '.lang-toggle button', 'English');
    await waitFor(() => container.innerHTML.includes('set up'));
    expect(document.documentElement.lang).toBe('en');
    clickByText(container, '.lang-toggle button', 'हिंदी');
    await waitFor(() => container.innerHTML.includes('शुरू करते हैं'));
    expect(document.documentElement.lang).toBe('hi');

    const nameInput = container.querySelector('input');
    nameInput.value = 'Test Operator';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    await flush(20);

    clickByText(container, 'button', 'शुरू कीजिए →');
    await waitFor(() => container.querySelector('.keypad'));

    // --- Set MPIN 1234, confirm it, and unlock into the app ---
    await tapKeypad(container, ['1', '2', '3', '4']);
    // Wait for the "confirm" step to actually show (the PIN clears and the hint changes)
    // instead of guessing a delay — keys tapped while the first PIN is still submitting are ignored.
    await waitFor(() => container.textContent.includes('MPIN दोबारा डालिए') && container.querySelectorAll('.pin-dot.filled').length === 0);
    await tapKeypad(container, ['1', '2', '3', '4']);

    await waitFor(() => container.querySelector('.bottom-nav'));
    await waitFor(() => container.querySelector('.stat-tile')); // live queries resolved

    // --- Dashboard renders cleanly against an empty, freshly-seeded database ---
    const html = container.innerHTML;
    expect(html).toContain('आज का हिसाब'); // t('dashboard') in Hindi
    expect(html).toContain('₹0'); // outstanding/collected tiles render ₹0, not "NaN" or a thrown error
    expect(container.querySelectorAll('.nav-btn').length).toBe(5);

    // --- The Students tab has a Back button, and it returns to Home.
    [...container.querySelectorAll('.nav-btn')].find((b) => b.textContent.includes('बच्चे')).click();
    await waitFor(() => container.querySelector('.topbar-title')?.textContent === 'बच्चे');
    const backButton = container.querySelector('.topbar button[aria-label="Back"]');
    expect(backButton).not.toBeNull();
    backButton.click();
    await waitFor(() => container.querySelector('.topbar-title')?.textContent === 'आज का हिसाब');
    expect(container.querySelector('.topbar button[aria-label="Back"]')).toBeNull(); // Home itself has none

    // --- The phone's own back button / swipe does the same instead of closing the app.
    const phoneBack = () => window.dispatchEvent(new PopStateEvent('popstate'));
    [...container.querySelectorAll('.nav-btn')].find((b) => b.textContent.includes('बच्चे')).click();
    await waitFor(() => container.querySelector('.topbar-title')?.textContent === 'बच्चे');
    phoneBack();
    await waitFor(() => container.querySelector('.topbar-title')?.textContent === 'आज का हिसाब');

    // --- Viewing the English messages must not silently change what is sent (the bug a
    // driver hit): the Message screen says which language is being sent and lets them change it.
    [...container.querySelectorAll('.nav-btn')].find((b) => b.textContent.includes('और')).click(); // glyph + label
    await waitFor(() => container.querySelector('.list-row'));
    const messageRow = [...container.querySelectorAll('.list-row')].find((r) => r.textContent.includes('मैसेज'));
    messageRow.click();
    await waitFor(() => container.querySelector('.main-scroll .lang-toggle'));
    const inScreen = (text) => [...container.querySelectorAll('.main-scroll .lang-toggle button')].find((b) => b.textContent === text);

    expect(container.querySelector('.main-scroll').textContent).toContain('हिंदी'); // still being sent
    inScreen('English').click();
    await waitFor(() => [...container.querySelectorAll('.main-scroll button')].some((b) => b.textContent === 'रिमाइंडर English में भेजिए'));
    expect((await db.settings.get('message_language')).value).toBe('hindi'); // viewing alone changed nothing

    clickByText(container, '.main-scroll button', 'रिमाइंडर English में भेजिए');
    await waitFor(() => ![...container.querySelectorAll('.main-scroll button')].some((b) => b.textContent === 'रिमाइंडर English में भेजिए'));
    expect((await db.settings.get('message_language')).value).toBe('english');

    phoneBack(); // Message was opened from More, so back lands on More
    await waitFor(() => container.querySelector('.topbar-title')?.textContent === 'और');
  }, 30000);
});

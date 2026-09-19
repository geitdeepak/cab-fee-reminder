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
  throw new Error('waitFor: condition never became true');
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
    expect(container.innerHTML).toContain('Shuru karte haiं'); // default Hinglish copy

    // The language switch is present on the very first screen and works both ways.
    clickByText(container, '.lang-toggle button', 'English');
    await waitFor(() => container.innerHTML.includes('set up'));
    clickByText(container, '.lang-toggle button', 'Hinglish');
    await waitFor(() => container.innerHTML.includes('Shuru karte haiं'));

    const nameInput = container.querySelector('input');
    nameInput.value = 'Test Operator';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    await flush(20);

    clickByText(container, 'button', 'Shuru kijiye →');
    await waitFor(() => container.querySelector('.keypad'));

    // --- Set MPIN 1234, confirm it, and unlock into the app ---
    await tapKeypad(container, ['1', '2', '3', '4']);
    await flush(700); // 150ms auto-submit delay + step transition to "confirm"
    await tapKeypad(container, ['1', '2', '3', '4']);

    await waitFor(() => container.querySelector('.bottom-nav'));
    await waitFor(() => container.querySelector('.stat-tile')); // live queries resolved

    // --- Dashboard renders cleanly against an empty, freshly-seeded database ---
    const html = container.innerHTML;
    expect(html).toContain('Aaj ka hisaab'); // t('dashboard') in Hinglish
    expect(html).toContain('₹0'); // outstanding/collected tiles render ₹0, not "NaN" or a thrown error
    expect(container.querySelectorAll('.nav-btn').length).toBe(5);
  }, 30000);
});

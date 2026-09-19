import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { strings, t, tf, localizeError } from '../src/state/strings.js';

const hi = strings.hi;
const en = strings.en;
const DEVANAGARI = /[ऀ-ॿ]/;
const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

// Technical / brand text that is legitimately Latin script in the Hindi UI.
const LATIN_OK = new Set(['appName', 'modeUPI', 'moreSubImport']);

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? sourceFiles(p) : /\.(jsx?|js)$/.test(name) ? [p] : [];
  });
}

describe('language files', () => {
  it('have exactly the same keys in Hindi and English', () => {
    expect(Object.keys(hi).sort()).toEqual(Object.keys(en).sort());
  });

  it('fill in the same {placeholders} in both languages', () => {
    for (const key of Object.keys(en)) expect(placeholders(hi[key]), key).toEqual(placeholders(en[key]));
  });

  it('are real Hindi (Devanagari), not Latin-script Hindi, apart from a few technical labels', () => {
    for (const [key, value] of Object.entries(hi)) {
      if (LATIN_OK.has(key)) continue;
      expect(DEVANAGARI.test(value), `hi.${key} = ${value}`).toBe(true);
      expect(value, `hi.${key}`).not.toMatch(/\b(kijiye|dijiye|karein|hai|nahi|bhejiye|chuniye|jodiye|daaliye|mahine)\b/i);
    }
  });

  it('are never used with a key that does not exist (a screen would show the raw key)', () => {
    const used = new Set();
    for (const file of sourceFiles('src')) {
      if (file.endsWith('strings.js')) continue; // its doc comment contains an example call
      const text = readFileSync(file, 'utf-8');
      for (const m of text.matchAll(/\b(?:t|tf)\('([A-Za-z0-9_]+)'/g)) used.add(m[1]);
    }
    expect(used.size).toBeGreaterThan(100);
    const missing = [...used].filter((k) => !(k in en) || !(k in hi));
    expect(missing).toEqual([]);
  });

  it('look up and fill in text', () => {
    expect(t('hi', 'home')).toBe('होम');
    expect(t('en', 'home')).toBe('Home');
    expect(tf('hi', 'nPending', { n: 4 })).toBe('4 बाकी');
    expect(tf('en', 'restoreBody', { cs: 1, ci: 2, ns: 3, ni: 4 })).toContain('Current: 1 students, 2 invoices.');
  });
});

describe('translated error messages', () => {
  it('translate exact messages and patterns in Hindi, and leave English alone', () => {
    expect(localizeError('hi', 'Class is required.')).toBe('कक्षा ज़रूरी है।');
    expect(localizeError('hi', '10 digits starting 6–9.')).toBe('6–9 से शुरू होने वाले 10 अंक।');
    expect(localizeError('hi', 'Unrecognised placeholder {foo} — this will not save.')).toBe('यह प्लेसहोल्डर पहचाना नहीं गया: {foo} — सेव नहीं होगा।');
    expect(localizeError('hi', 'Pickup point "Gamma" does not exist — add it, or give a fare in the file')).toContain('"Gamma"');
    expect(localizeError('hi', 'Language "klingon" is not English or Hindi')).toBe('भाषा "klingon" हिंदी या English नहीं है');
    expect(localizeError('en', 'Class is required.')).toBe('Class is required.');
  });

  it('pass an unknown message through unchanged rather than hiding it', () => {
    expect(localizeError('hi', 'Something unexpected')).toBe('Something unexpected');
    expect(localizeError('hi', undefined)).toBeUndefined();
  });

  it('cover every validation message the actions can raise', () => {
    const raised = [];
    for (const file of ['src/actions/students.js', 'src/actions/pickups.js', 'src/actions/billing.js', 'src/lib/backup.js']) {
      const text = readFileSync(file, 'utf-8');
      for (const m of text.matchAll(/(?:new Error|errors\.\w+ =)\(?'([^']+)'/g)) raised.push(m[1]);
    }
    expect(raised.length).toBeGreaterThan(10);
    const untranslated = raised.filter((msg) => localizeError('hi', msg) === msg && msg !== 'Validation failed');
    expect(untranslated).toEqual([]);
  });
});

describe('Devanagari layout rules and icons', () => {
  it('turn off letter-spacing for Hindi, which would tear Devanagari letters apart', () => {
    const css = readFileSync('src/styles/global.css', 'utf-8');
    expect(css).toMatch(/html\[lang="hi"\] \* \{ letter-spacing: normal !important; \}/);
  });

  it('ship the taxi icon set at the sizes the manifest promises', () => {
    const size = (file) => {
      const buf = readFileSync(join('public', file));
      expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
      return [buf.readUInt32BE(16), buf.readUInt32BE(20), buf.length];
    };
    expect(size('icon-192.png').slice(0, 2)).toEqual([192, 192]);
    expect(size('icon-512.png').slice(0, 2)).toEqual([512, 512]);
    expect(size('icon-maskable-512.png').slice(0, 2)).toEqual([512, 512]);
    expect(size('apple-touch-icon.png').slice(0, 2)).toEqual([180, 180]);
    expect(size('favicon.png').slice(0, 2)).toEqual([64, 64]);
    // a drawn taxi compresses to a few KB; the old single-letter icon was under 1 KB at 192px
    expect(size('icon-192.png')[2]).toBeGreaterThan(1500);
  });
});

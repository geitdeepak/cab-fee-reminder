# Cab Fee Reminder

Offline PWA for a school-cab operator (SRS v1.0, Option B). Student register, pickup-point fares,
invoices, payments, and WhatsApp click-to-chat reminders. All data lives in IndexedDB on the
operator's phone. No backend, no paid services, no third-party requests.

## Run

```bash
npm install
npm run dev        # local development (service worker disabled in dev)
npm test           # unit + integration + DOM smoke tests
npm run build      # production bundle in dist/
npm run preview    # serve dist/ locally to test install + offline
```

Regenerate the PWA icons with `npm run icons` (no dependencies; replace with real branding later).

## Deploy (free)

Push to Git and connect the repo to Cloudflare Pages (build command `npm run build`, output
directory `dist`). HTTPS is automatic. The app must be opened over HTTPS and installed to the home
screen (required on iOS so storage is not evicted, SRS 9.2).

## Layout

| Path | Role |
|---|---|
| `src/domain/` | Pure functions: dates, fees, invoice engine, reminder ladder. No UI, no IndexedDB (SRS 12.5). |
| `src/db/` | Dexie schema (SRS 5.2 incl. both unique indexes) and first-run seed. |
| `src/actions/` | Bridges domain logic to Dexie: enrolment, engine, payments, queue, backup, reports. |
| `src/lib/` | WhatsApp link builder, backup/restore, MPIN hashing, formatting. |
| `src/ui/` | Screens S-01 to S-14 and shared components. |
| `tests/` | Domain, integration (real Dexie via fake-indexeddb), and app-mount smoke tests. |

## Decisions taken on SRS Appendix B (open items)

Defaults follow the SRS's own recommendations. Confirm with the operator before real use:
OD-1 full cycle charged (no pro-rating), OD-2 quarterly 5% / yearly 10% (editable in data),
OD-3 due day 5, OD-4 all four escalation stages on, OD-5 reminders to both parents,
OD-8 UPI id stored but not yet in the seeded templates, OD-9 unpaid invoice stays payable,
OD-10 Hinglish default with English toggle.

## Not implemented yet

- Pause enrolment / re-price UI beyond re-saving an enrolment; fee-plan discount editor.
- Backup 30-day full-screen interstitial and weekly launch prompt (banner escalation is done).
- Biometric unlock, 60-second lockout after 10 wrong MPIN attempts.
- Install-required onboarding gate (SRS 12.4), delete-permanently action, payment reversal UI.
- Consent capture field (SEC-04), Hindi/Devanagari strings (UI is Hinglish + English).
- Not yet exercised on a real phone: install, offline reload, WhatsApp hand-off, share sheet.

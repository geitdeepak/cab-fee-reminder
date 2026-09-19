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

## Driver guide

A plain-language guide in Hindi and English for drivers: [docs/driver-guide.md](docs/driver-guide.md).

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

## Entering an existing register

- **Quick add** (Bachche → Naya bachcha): only name, class, pickup point and one parent number are
  required. The fee section asks for plan, due day, bill-from date, whether this month is already
  paid, and any old amount pending. "Save & add next" keeps the pickup point and fee choices.
- **Import** (Aur → Excel/CSV, or the Students screen): choose a CSV or paste rows copied from Excel
  or Google Sheets. Every row is checked first; bad rows and duplicates are skipped, the rest are added.
  A sample file can be downloaded from the import screen.

## Reminders

- Only the latest reached stage is queued per bill and parent (no four messages at once).
- Reminders go to one parent by default (Settings → Reminder kisko), falling back to the other parent.
- "Send reminder now" on any unpaid bill sends today's message without waiting for the schedule.
- Message wording lives in `src/db/seed.js`; templates the driver never edited are upgraded
  automatically. A line containing `{upi_id}` is dropped when no UPI id is set.
- **Payment link:** with a UPI id saved in Settings, every reminder carries a tappable link to this
  site's public `/pay` page (`src/ui/PayPage.jsx`) with the driver's UPI id and the exact amount owed in
  the URL. The parent's phone opens GPay/PhonePe/Paytm pre-filled. No server, nothing stored, works for
  every driver from the one deployment. The page always shows the payee name and UPI id so a parent can
  check them. Not yet tested on real phones (UPI deep links vary by phone and app).
- Payment QR (optional, off by default): upload once in Settings and switch on "send the QR with every
  reminder". WhatsApp cannot pre-fill a recipient when an image is attached, so the driver picks the
  chat from the share sheet, which is slower than the pre-filled chat.

## Not implemented yet

- Pause enrolment; fee-plan discount editor; undoing a cancelled bill.
- Weekly launch prompt for backups (the banner and the 30-day full-screen reminder are done).
- Biometric unlock.
- Install-required onboarding gate (SRS 12.4), delete-permanently action, payment reversal screen.
- Consent capture field (SEC-04), Hindi/Devanagari strings (UI is Hinglish + English).
- Not yet exercised on a real phone: install, offline reload, WhatsApp hand-off, share sheet.

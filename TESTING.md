# Testing

This is the record of a full function pass over the copy users get: `docs/` filled the way the
publish step fills it (`https://wjwhitmire.github.io/errata/`, `wjwhitmire`, `https://github.com/wjwhitmire/errata`), served over https at
OWNER.github.io/errata/, in headless Chromium at 1280 px and at 400 px with touch, light and dark.
The single-file `web/app.html` was also opened from disk (file://).

## How to rerun

```
pip install -e .[dev]
python web/build_pages.py              # rebuild web/app.html and docs/
pytest -q                              # Python core, the built page, and the browser tests
python tests/make_vectors.py && node web/parity.test.mjs
node web/net.test.mjs && node web/ai.test.mjs && node web/pdfjs.test.mjs
python tools/check.py                  # contrast and color-vision checks of the design tokens
python tools/shoot.py                  # every view at 400 and 1280 px, light and dark, into shots/
```

The browser tests skip when Playwright's Chromium is not installed. `tests/test_build.py` serves the
filled copy at `https://example-owner.github.io/errata/` through request routing, so it needs no
network and no certificate.

## Results

Counts: 87 inventory rows (below), exercised by 184 scripted browser checks on the published copy
plus the automated suite; all pass after the fixes below. Six of the 184 browser checks first reported
a failure that came from the check itself (a case-sensitive label, an older
toast's Undo clicked by mistake, a hand-computed $489.05 where the right figure is $489.04, a
four-character SSN box that truncates a fifth digit, the on-device helper's allowed download host);
each was rerun or recomputed and passes.

Tests: 129 Python tests before the pass, 177 after; the browser core parity replay grew from 37,082
checks over 293 cases to 37,161 over 294 cases.

### Bugs found and fixed

| # | Severity | What happened | Fix |
|---|---|---|---|
| 1 | High | The published page's policy refused its own service worker, so the installed app never worked offline. Found here and fixed first by the parallel publish audit (5299e5a). | `worker-src 'self' blob:`; `tests/test_build.py` checks the shell is cached and the page opens offline |
| 2 | High | PDF import failed with "This PDF could not be read" after 25 s whenever the reader's worker reported an error instead of throwing (the single-file copy opened from disk always did this) | Fall back to reading on the page when the worker fires an error, at once (1bcbb46) |
| 3 | Medium | A charged-off or late account entered by hand or by CSV was never marked adverse, so the 7-year, re-aging and missing-date rules skipped it | Hand-entered status sets the adverse flag, Python and browser core (ce24426) |
| 4 | Medium | With one bureau's report (the common case) the account list, the 24-month payment grid and "Correct a field" were unreachable | One report still gets its account list (1bcbb46) |
| 5 | Medium | Every toast kept its Undo; undoing an older one silently threw away every later change | Undo is one step: a new change retires older Undo buttons (1bcbb46) |
| 6 | Medium | Answering a question renumbered the findings, so the page jumped to a different finding | Labels no longer depend on confidence (1bcbb46) |
| 7 | Low | After "I did get a notice", round compare still said no reinsertion notice was logged | The warning shows only for items without a logged notice (1bcbb46) |
| 8 | Low | A damaged or hand-edited backup with wrong field types restored and then broke every screen; a backup that is not JSON showed a raw parser message | Records are normalized field by field on restore and unlock; a plain message for unreadable files (1bcbb46) |
| 9 | Low | Opened from a plain http address, "Try the example" hung at "Opening the example..." (the browser disables encryption there) | The welcome screen says why and how to open it safely (1bcbb46) |
| 10 | Low | On phones the six findings filters ran off the screen; toasts could be wider than the screen | Filters wrap; toasts are capped to the screen width |

The owner's review also asked for a rebuild of the letter flow and the reading experience; that is
recorded under "Automation" and "Readability" below (d8d88d6).

### Function inventory

P = passed in the browser on the published copy; T = covered by an automated test (file named).

| Area | Function | How it was exercised | Result |
|---|---|---|---|
| Welcome | Welcome screen: three actions, no outside request | open | P |
| Welcome | Start with your own reports: empty name, short passphrase, mismatched passphrases | each refused with a message | P |
| Welcome | Restore a backup from the welcome screen | backup of 3 people restored, lock screen | P, T test_browser |
| Welcome | Restore hostile files: wrong format, foreign id, not JSON, damaged fields | refused or restored safely | P, T test_build |
| Welcome | Try the example: memory only, every view one key answer | 19 routes | P, T test_browser |
| Welcome | Leave the example from the lock screen | back to welcome | P |
| Welcome | Plain http copy | explains instead of hanging | P, T test_build |
| Family | Add a person (encrypted, own passphrase) | switcher shows family mode | P |
| Family | Add a person without encryption | top bar says Not encrypted | P |
| Family | Switch person locks the one you leave | lock screen with that person | P |
| Family | Family view with unlock card | unlock another person | P |
| Encryption | Create: AES-GCM, PBKDF2 600,000 rounds, no plain data | storage dump | P, T test_browser |
| Encryption | Lock now clears the screen | content emptied | P, T test_browser |
| Encryption | Unlock (button and Enter) | opens | P |
| Encryption | Wrong passphrase | "does not open" message | P |
| Encryption | Auto-lock 1, 5, 15 min | fake clock: open at 30 s, locked at 65 s | P |
| Encryption | Change passphrase | old refused, new opens | P |
| Encryption | Turn encryption off | warning dialog, Not encrypted | P |
| Imports | TransUnion PDF | 0.8 s, findings | P, T test_browser, test_build |
| Imports | Experian and Equifax PDFs (templates) | flagged "check this report" | P, T |
| Imports | Saved web pages (TU, EX) | imported, nothing runs | P, T test_browser |
| Imports | Hostile saved page (img, iframe, script) | no request, no script | P |
| Imports | Not a report (HTML) | plain error | P |
| Imports | Not a PDF, empty file, truncated PDF, password PDF | plain errors | P |
| Imports | Scanned PDF with the text reader off | dialog points to Settings | P |
| Imports | CSV with unicode names | 2 accounts | P |
| Imports | CSV bad header, CSV over 10 MB | plain errors | P |
| Imports | CSV negative money and impossible dates | fields to check | P |
| Imports | Enter by hand (bad date and amount) | added, listed to check | P |
| Imports | Drag and drop a PDF | new round | P |
| Imports | Worker throws; worker never answers (25 s); worker reports an error | imports on the page | P, T test_browser, test_build |
| Imports | Single-file copy from disk | imports a PDF | P, T test_build |
| Reports | Fields to check: count and confirm | count drops | P |
| Reports | Correct a field, undo | correction kept beside the report | P, T test_browser |
| Reports | Three-bureau compare (real vs timing differences) | example | P, T test_browser |
| Reports | Payment grid and month popover | click a month | P, T test_build |
| Reports | Remove a report | example | P |
| Findings | All 33 rules, each with a positive and a negative fixture | synthetic reports | T test_rule_matrix |
| Findings | Rules that need an answer (CARES, not mine, identity theft, dispute notation, a "no" answer) | synthetic | T test_rule_matrix |
| Findings | Hand-entered charge-off checked for age | regression | T test_rule_matrix |
| Findings | Status filters | each | P |
| Findings | Detail: what's wrong, what we'll do, evidence table, how sure, law collapsed | example and TU | P, T test_build |
| Findings | Yes, no, not sure questions; answer kept and changeable | collector question | P, T test_build |
| Findings | Is this account yours (no opens not mine and identity theft) | example | P |
| Findings | Not now, Reopen | example | P |
| Findings | Honest panel for accurate items | example | P |
| Findings | Every bureau that reports the account | example | P |
| Letters | Build my letters: grouping, recipients, addresses, order, identity card, packet PDF, Word ZIP, mailing log drafts | TU, EX, EQ | P, T test_build |
| Letters | Missing lender address asked inline | EX, EQ | P, T test_build |
| Letters | Missing SSN last four asked inline | EX, EQ | P, T test_build |
| Letters | Follow-ups written when a deadline passes; method of verification after a verified result | example | P |
| Letters | Type tracking numbers (Mailed) | moves to the mailing log | P, T test_build |
| Letters | Six-step wizard ("Write a letter yourself") | 6 steps, every one of 27 letter types renders | P, T test_browser |
| Letters | Every letter type: honesty audit, DOCX opens, PDF reads back | 28 types | T test_all_outputs, test_honesty, test_letters |
| Letters | Preview: facts traced n of n; PDF, DOCX, text, envelope downloads open | example | P |
| Letters | Batch print (three freeze letters, one PDF) | 3 cover sheets | P |
| Letters | I mailed it; log a delivery; receipt scan to the vault | example | P |
| Tracking | Business days, holidays (observed), 30/45-day conservative and earliest readings, 605(c), SOL | hand-checked: 5 business days over Veterans Day and Thanksgiving, 4 over Christmas, 3 over New Year; 30 days from 10/13 is 11/12 with 11/11 the earliest; DOFD 03/2019 ends 09/27/2026; TX 4-year SOL from 03/15/2021 ends 03/15/2025 and is barred from the next day | P, T test_deadlines_strategy |
| Tracking | Deadline bars and the dashboard's overdue follow-up | example | P, T test_browser |
| Tracking | Escalation ladder (plain words, law small), complaint packet when the ladder reaches it | example | P |
| Tracking | .ics export: alarms 2 days before, lines of 75 octets or fewer | parsed | P |
| Tracking | Reply-letter intake by text and by PDF: outcomes read and preset | example | P |
| Rounds | Round compare: deleted, updated, verified, reinserted, new | example | P, T test_rounds |
| Rounds | Reinsertion notice check and "I did get a notice" | regression | P, T test_build |
| Planning | Playbook, step done and undo | TU | P |
| Planning | Auto loan mode reorders the plan and Build | TU | P |
| Planning | Score plan: statement days asked once per card | TU | P |
| Planning | Scores: range check, two scores with what changed, calibration | TU | P, T test_additions |
| Planning | Score ranges per family, scenario switches | TU | P |
| Planning | Two clocks (SOL and reporting limit) | TX | P |
| Planning | Rate savings ($25,000, 60 months, 11.99% vs 6.49%: $555.98 and $489.04 a month) | hand-checked | P |
| Planning | Negotiate: suggested offer (30% to 50%, labeled typical), checklist, ready to pay, offer letter | TU | P, T test_browser |
| Vault | Add files, delete, complaint packet and attorney packet ZIPs | contents read | P |
| Dashboard | Next action (Build my letters, mail them, follow up), progress report PDF | TU and example | P, T test_build |
| Settings | Five network switches off by default; counter of requests | read | P, T test_browser |
| Settings | Mail: off hides it, on without a key refuses, exact request shown, sent with own key (mocked) | mocked api.lob.com | P |
| Settings | Writing helper with own key: preview, explanation, reworded facts refused (mocked) | mocked local server | P, T web/ai.test.mjs |
| Settings | On-device helper: pinned download fails plainly | mocked 503 | P |
| Settings | Text reader: wrong download refused by size and fingerprint | mocked | P |
| Settings | Check for a newer version: address from where it is served, once a day | mocked api.github.com | P, T test_build |
| Settings | Keys stay in the encrypted record | storage dump | P, T test_browser |
| Settings | Theme, lock time, your details (SSN last four only) | each | P |
| Settings | Export encrypted backup (warns about unencrypted people), restore, Delete everything | each | P, T test_browser |
| Shell | Service worker caches the shell; opens offline | https copy | P, T test_build |
| Shell | Framing guard | iframe | T test_browser |
| Shell | Phone layouts: no sideways scroll, controls of 44 px or more, 400 px touch, light and dark | every view | P, tools/shoot.py |
| Shell | No outside request with every switch off; no policy violation | every area | P, T test_browser, web/net.test.mjs |

### Automation: every decision the user made, before and after

| Decision | Before | After |
|---|---|---|
| Which letter to write | Picked from 25 legal letter types | Picked from the finding and the plan; "Customize" keeps the choice with plain names |
| Who receives it | Picked per letter | One per bureau and one per lender or collector, from the plan |
| Recipient address | Bureau from tables; lender often "(address)" | Bureau from tables; lender and collector from the report, flagged to check; asked inline when the report has none |
| Which items go together | Checkboxes in step 1 | Grouped by recipient, five accounts per letter |
| Enclosures | Listed per type | Listed per type, plus the earlier letter and its receipt for a follow-up |
| Reason text | Typed | Not needed; letters use findings and confirmed facts; an optional paragraph stays in Customize |
| Sender name and address | Typed under Settings, or the letter was refused | Read from the report, confirmed once on one card |
| Birth date and SSN last four | Typed under Settings | Read from the report, or asked on the same card |
| Facts only the person knows | Checkbox beside a legal sentence | Yes, no or not sure question; the sentence is shown under it |
| Order of letters | The person followed the plan by hand | Packet in plan order (auto loan plan when on) |
| Printing | One letter at a time | One PDF packet with cover sheets and envelopes, Word files as one ZIP |
| Mailing log | Logged per letter by hand | Created on print; the person types tracking numbers |
| Next-round letters | Drafted from the tracker by hand | Written when a deadline passes or a result is "verified" |
| Reply letters | Outcomes picked | Read from the text or PDF and preset; the person checks them |
| Round compare | Ran on import | Unchanged (automatic) |
| Card payments | Statement day assumed to be the 1st | Asked once per card, then every amount and date is computed |
| Offer amounts | Typed | Suggested from the balance (30% to 50%, labeled typical), one click to use |
| Complaint packet | Built from the vault by hand | Offered on the tracker when the ladder reaches the complaint step |

What remains for the person: confirm who they are once, answer yes or no questions only they can
answer, print and mail, and type tracking numbers (or add the receipt scan).

### Readability

- Interface text is Atkinson Hyperlegible Next at 18 px, secondary text 15 px or more, line height
  about 1.5, paragraphs capped at 70 characters. Literata is used only on the letter paper; Sono only
  for account and tracking numbers in tables. Atkinson Hyperlegible Next is also Wellpath's body face,
  which keeps it within the suite's two-tools-per-family rule; no banned family is used.
- Findings lead with what is wrong and what Errata will do in plain words, then one button; evidence
  is a two-column table with clashing values tinted and tagged "doesn't match"; the law is collapsed.
- A plain-language check of every interface string of 40 characters or more: 331 strings, median
  grade 5.2 (Flesch-Kincaid); the few above grade 12 are code fragments, not text. Letters stay formal.
- `tools/check.py` passes in both themes, including the new pairs (warning text on the evidence
  background and on fields).

## Known limits

- The Experian and Equifax readers and the saved-page reader are tested only on synthetic reports.
- The text reader for scanned pages and the on-device writing helper were exercised only up to their
  pinned downloads (mocked here); recognition and the model itself were not run.
- Online certified mail and the writing helper were tested against mocked services, not the real ones.
- The service worker test routes the worker's own requests through Playwright's experimental switch
  (`PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS`).
- Loan savings use payments rounded to the cent, so total interest can differ from an exact
  amortization by a few cents.

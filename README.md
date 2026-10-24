# Errata

Field Tools No. 19. A free, open-source, local-first tool for checking your own credit reports and correcting what is wrong in them. It reads the report you download for free (the PDF or the saved web page), finds what is inaccurate, incomplete, outdated or not yours, explains each finding with its legal basis, plans the order to act in, writes letters whose every claim traces to evidence or to a fact you confirmed, and tracks the legal deadlines round by round.

Live tool: https://wjwhitmire.github.io/errata/

It is not legal advice, it does not promise results, and it cannot remove accurate, current, verifiable information. Nobody can. For a lawsuit, talk to a consumer attorney (the NACA directory lists them) or a legal aid office.

## Why it exists

Paid credit repair software costs about $50 to $140 a month, plus a monitoring subscription, for work the law lets you do yourself for free. Most of those tools ship letter templates and leave the analysis to you. Errata parses the report, finds the contradictions, explains them, orders the work, writes specific letters, and keeps the clock. It is free with no paid tier, no affiliate links, no lead sales and no telemetry, which keeps the project from being a credit repair organization under the Credit Repair Organizations Act. The Act's ban on untrue or misleading statements (15 U.S.C. 1679b(a)) applies to everyone, and every letter is held to it (see "Free means free" below).

## Quick start

```
pip install -e .[pdf]          # pdfminer.six reads PDF text; nothing else is needed
errata parse my-report.pdf --out local/report.json     # or a saved page: my-report.html
errata findings local/report.json
errata plan local/report.json --goal auto_soon
errata letter bureau_611 local/report.json --profile local/me.json --finding f1a2b3c4d --out local/letter.docx
errata deadline bureau_dispute 2026-11-02
errata sol TX open --last-payment 2021-03-15 --dofd 2021-01
errata diff local/round1.json local/round2.json
errata compare local/tu.json local/ex.json local/eq.json
```

Keep your own reports and letters in `local/` (ignored by git).

## The app

The browser app is one page that runs entirely on your device: `docs/index.html` (the GitHub Pages build, an installable app that works offline) or `web/app.html` (a single file you can save and open from disk; `python web/build_pages.py` rebuilds both). "Try the example" opens an invented family (Jordan Example and two relatives, invented lenders and collectors) labeled EXAMPLE DATA on every screen and kept in memory only.

- **Dashboard**: the next action (a missed legal deadline first, then questions only you can answer, then the plan), open deadlines, items removed, card utilization and the scores you entered.
- **Playbook**: the 90-day plan (baseline, fastest wins, round 1 by legal strength, parallel tracks, results, round 2, escalation, decision point) with today's place on it. "Auto loan or mortgage soon" reorders it toward levers that can move a score in 30 to 60 days and adds the rate-shopping window, which bureau each lender type usually pulls and an honest "what to expect at this score" panel with ranges, not promises.
- **Reports**: import a TransUnion, Experian or Equifax PDF (read with pdf.js; scanned pages with the optional text reader) or a saved web page of the report (read as text; nothing on the page runs or loads), by choosing it or dropping it on the page; enter accounts by hand or as CSV; check every field the reader was unsure of against the text on the page, and correct any field on any account (corrections sit beside the report as read and can be undone). The three-bureau compare marks real differences (not-equal sign, tint and a wave under the odd value) apart from timing differences (one copy is about a month older and matches the newer copy's own history), which are shown and not counted. Each account has its 24-month payment grid for all three bureaus.
- **Findings**: what is wrong in plain words, what Errata will do about it and one button to write those letters; the evidence as a two-column table with the values that contradict each other tinted and tagged; how sure the finding is, in words; and, collapsed, the exact sentences the letter will use and why it works (the law). A fact only you know is a yes, no or not sure question, with the exact sentence the letter will use shown under it. Accurate items get an honest panel instead of a dispute. "Is this account yours?" opens the "not mine" and identity theft statements only when you answer no, with their warnings; your answer about an account applies to its copy at every bureau that reports it. **Every bureau that reports it**: each finding shows which bureaus report the same account, where the problem was found and where the account is reported without it, and each bureau gets its own letter with its own evidence. A Texas child support card links to the administrative review request and the payment record request.
- **Build my letters**: one click turns every finding that is ready into letters. They are grouped by who receives them (one letter per bureau, at most five accounts each, plus a direct letter to each lender or collector where the plan calls for one), the letter type and recipient address are picked for you (bureau addresses from the law tables, lender and collector addresses from the report, flagged "check it before mailing", or asked for right there when the report has none), and they are ordered by the plan (the auto loan plan when it is on). Your name and current address come from the report and are confirmed once on a single card, with your birth date and the last four of your SSN asked inline when a bureau letter needs them. Facts only you know are short yes or no questions; each answer updates the letters, and unanswered questions never hold back the letters that are ready. Print makes one PDF packet (an index, then each letter with its cover sheet, enclosure checklist, certified mail worksheet and an envelope page) and a mailing log entry per letter waiting for its tracking number; Word files come as one ZIP. When a deadline passes, or a result keeps an item as verified, the follow-up is already written and waiting here.
- **Letters**: the letter on legal pad paper with every factual claim footnoted to its source, what the letter keeps private, and print, PDF (with a certified mail cover sheet), DOCX, text and envelope. "Write a letter yourself" is the advanced six-step path for overrides, with plain names for each letter type and the legal name beside it. An optional paragraph in your own words is held to the same honesty rules. The mailing log records tracking numbers, delivery dates and receipt scans; deadlines run from delivery.
- **Tracker**: deadline bars with the conservative due date and the earliest reading, a calendar file, results-letter intake (paste the text or pick the PDF; you confirm each outcome), the escalation ladder and next-round drafting. Round compare shows deleted, updated, verified, reinserted (with the 5-business-day notice check and its letter) and new items.
- **Negotiate**: goodwill requests, pay-for-delete and settlement offers with amounts, dates and replies, and the written-agreement checklist (letterhead, authorized signature, exact amount, how it will report at every bureau, a deadline, a traceable payment method) that must pass before it says you can pay. It warns about restarting the statute of limitations and about taxes on forgiven debt.
- **Score plan**: card paydown by statement date (pay for 30%, for 10%, all but one at $0), score ranges per score family with their sources, never one number, the scores you enter with what changed since the last one (the ranges narrow, or honestly widen, to what your own scores show), what a better rate is worth at rates a lender actually quoted you, and the two clocks for an old debt (your state's statute of limitations, to verify, and the reporting limit of 7 years plus 180 days from the delinquency).
- **Dashboard**: also a one-page progress report (PDF): removed, in dispute with due dates, waiting for you, scores.
- **Vault**: every letter, receipt, reply and proof file, inside the person's encrypted record, with complaint and attorney packets as ZIP files.
- **Settings**: lock and passphrase, the network switches, your details for letters, free help, export, restore and Delete everything.

Family mode keeps one record per person, each with its own passphrase; switching people locks the one you leave. Names, initials and relationships stay readable on the device so the switcher can show who is who; everything else is encrypted.

### Network switches

All off by default, all through one gate function (`web/src/ui/05_net.js`), and the Settings screen counts the requests this session has sent. Keys you give the optional services are kept in that person's encrypted record, not in the device's settings.

| Switch | What it sends, only when used |
|---|---|
| Text reader for scanned pages | One download of the English language data (cdn.jsdelivr.net, pinned by SHA-384) and the text engine from this same site |
| Online certified mail | The letter to the mail service's API (api.lob.com) with your own key, after you see the exact request |
| On-device writing helper | One download of a small open model and its library, every file pinned by hash; it runs on your graphics chip |
| Writing helper with your own key | Each request to the one service address you set, shown in full before it is sent |
| Check for a newer version | At most once a day when the app opens, one request to api.github.com for this project's latest release (the address is written in when the project is published) |

The writing helper explains a finding in plain words and rewords the letter's requests. It never writes a fact: reworded text is refused if it adds a number, date, amount or company name, or a claim such as "not mine", identity theft or a promise. Before anything is sent, Social Security numbers in any form and dates of birth are removed, a date of birth or SSN finding goes out with no values at all, and the preview you approve is exactly the request. There are no analytics.

## What it finds

Every rule is deterministic, shows the evidence it read, names its legal basis, and carries a confidence label. A finding that depends on something only you know (did you apply for that credit, did the collector contact you first, did you live at that address) waits for your answer; nothing is disputed until you check the exact sentence the letter will use.

| Rule | What it looks for | Basis |
|---|---|---|
| Paid, then late | Late ratings after the account's Date Paid (or after a $0, paid and closed status) | FCRA 611(a)(1), 607(b), 623(a)(1) |
| Maximum delinquency note | The note's days, months or amounts disagree with the payment grid, or the grid shows the worst rating in months the note leaves out | FCRA 611, 607(b), 623(a)(1) |
| Skipped step | A 60, 90 or worse rating straight after a current month with $0 past due | FCRA 611, 607(b), 623(a)(1); Metro 2 status and rating consistency (public summary) |
| $0 terms with amounts due | Terms of "$0 per month" while the grid lists amounts due | FCRA 611, 607(b), 623(a)(1) |
| Closed, then activity | Balance or lates after a paid, closed month | FCRA 611, 607(b), 623(a)(1) |
| Status and past due | Current status with an amount past due, a late status with $0 past due, or a status that contradicts the last month | FCRA 611, 607(b); Metro 2 (public summary) |
| Obsolete | Past the report's own removal estimate, past 7 years plus 180 days from the first late in the grid, or late entries older than 7 years; inquiries older than 2 years | FCRA 605(a), 605(c) |
| Re-aging | A removal date that implies a delinquency date months after the first late in the grid (strong when it is past 7 years plus 180 days), or a collection set to come off later than the original creditor's account | FCRA 623(a)(5), 605(c) |
| Missing delinquency date | A charge-off or collection with no delinquency or removal date | FCRA 623(a)(5) |
| Duplicate debt | The original creditor and a collector both report a balance on the same debt | FCRA 611, 607(b), 623(a)(1) |
| Sold with a balance | An account marked transferred or sold that still shows a balance | FCRA 611, 607(b); Metro 2 status 05 (public summary) |
| Collection without the original creditor | | FCRA 611, 607(b); Metro 2 K1 (public summary) |
| Collector reported first | A collection reported within the last year; asks whether the collector contacted you before reporting | 12 CFR 1006.30(a)(1) and its official interpretation (14 days) |
| Medical collections | Paid, an initial balance under $500, or reported less than a year after the delinquency | Equifax, Experian and TransUnion voluntary policy (the 2025 CFPB rule is vacated) |
| Bankruptcy | Balance, past due or later lates on an account included in bankruptcy, once the case was discharged (from the report's words or your answer; during an open case a balance can be accurate) | FCRA 611, 607(b); White v. Experian |
| Texas child support | Child support reported as delinquent when a court order set payments on the arrears and you say you made each one on time | 1 Tex. Admin. Code 55.102(b); Tex. Fam. Code 231.114 |
| Personal information | Misspelled names, wrong middle initials (compared with your own list of names, or waiting for your answer), malformed or duplicate addresses, area codes not in service in the North American Numbering Plan, numbers that differ only by area code, and (with your profile) addresses, phones and employers that are not yours, and a wrong date of birth or SSN | FCRA 611, 607(b) |
| Inquiries | A hard inquiry with no account opened near its date; asks whether you applied | FCRA 604(f), 611 |
| CARES Act | Lates during an accommodation you confirm that was made inside the covered period (January 31, 2020 to about August 8, 2023), for the accommodation's own term | FCRA 623(a)(1)(F) |
| Dispute not shown | An account you disputed directly that is not marked disputed 30 days later | FCRA 623(a)(3); Saunders v. BB&T |
| Cross-bureau | The same account reported differently by two bureaus, with reporting lag shown apart and not counted | FCRA 607(b), 611 |
| Reinserted | A deleted item that came back with no notice on record | FCRA 611(a)(5)(B) |
| Not yours, identity theft | Only when you say so; a 605B block also needs your FTC identity theft report number | FCRA 611; 605B |

Accurate items get an honest answer instead of a dispute: a goodwill request for an isolated late, a written pay-for-delete or settlement offer, or time, with the report's own removal date.

## Deadlines

Clocks start on delivery, the date on the return receipt or the portal's confirmation, because FCRA 611(a)(1)(A) runs from the bureau's receipt.

- **Counting.** The statute gives "the 30-day period beginning on the date on which the agency receives the notice". Read literally, the delivery day is day 1, so day 30 is delivery + 29 days. Errata uses delivery + 30 calendar days as the deadline (the later, conservative date: it never tells you a deadline was missed when it was not) and shows delivery + 29 as the earliest possible reading. The same applies to the 45-day extension and to a furnisher's direct dispute (12 CFR 1022.43(e)). Periods written "not later than N days after" start the next day, so their earliest and conservative dates match.
- 30 days to reinvestigate (611(a)(1)(A)); 45 when you add information (611(a)(1)(B)) or the dispute follows a free annual report (612(a)(3)); 5 business days for the furnisher notice (611(a)(2)(A)), the results notice (611(a)(6)), a frivolous notice (611(a)(3)) and a reinsertion notice (611(a)(5)(B)); 15 days for the method of verification (611(a)(7)); 4 business days for a 605B block; 3 business days for a security freeze requested by mail (605A(i)); the Reg F validation period ends 30 days after you receive the notice (1006.34(b)(5)), and a collector may assume receipt 5 business days after mailing. A Reg F dispute letter asks the collector to stop collecting only when it is written inside that period. Business days skip Saturdays, Sundays and legal public holidays (observed dates).
- Your own deadlines are shown the safe way, the earlier date: a Texas administrative review request must be postmarked by the earlier of 30 days after you received the notice and 45 days after the date on it (1 Tex. Admin. Code 55.103(c), 55.104); the rule's weekend roll-over is shown but not counted on.
- Statute of limitations: on the anniversary itself the period may still be running, so a debt is called likely time-barred only from the next day. The reporting limit is 7 years after the 180 days from the delinquency (605(c)); with only a month known, the month's last day is used, so the date is never early.
- Calendar export as .ics with a reminder two days before.

## The plan

The default order is the research's 90-day playbook: baseline, fastest score wins, round 1 by legal strength, parallel tracks, results, round 2, escalation and the decision point. The escalation ladder is bureau dispute, then the furnisher's direct dispute and the method of verification, then a second dispute with new information and a CFPB complaint, then the state attorney general, then a consumer attorney or small claims.

**Auto loan or mortgage soon** reorders the plan toward what can move a score within 30 to 60 days: card payments timed to each statement close, document-backed contradictions first, pay-for-delete on small collections, no new accounts and no closed cards, rate shopping inside 14 days (safe across score versions), which scores lenders commonly use, and a pre-application checklist (proof of income, down payment, a credit union preapproval first). Its "what to expect" panel shows your own scores and ranges, never a promised number.

**Score estimates** are ranges per score family (FICO 8-like, FICO 9 and 10-like, VantageScore 4.0-like), each with its basis and a label (published by the scorer, tool estimate, community-observed). No scoring company publishes its model; the ranges are this tool's own estimates from public weights and facts, stated as such.

## Letters

Bureau dispute (611), file disclosure (609, as a disclosure request only: "609 letters" do not force deletion), security freeze (605A(i)), initial fraud alert (605A(a), only with your good-faith statement), method of verification (611(a)(7)), direct furnisher dispute (623 and 12 CFR 1022.43), dispute notation (623(a)(3)), debt validation and original creditor request (Reg F), stop communication (FDCPA 805(c), with its warning), written communication only, pay-for-delete and settlement offers (with statute of limitations and tax warnings), goodwill, identity theft block (605B), personal information correction, inquiry permissible purpose, reinsertion notice demand, obsolete item removal, CARES Act, bankruptcy correction, consumer statement (100 words), CFPB and state attorney general complaint text, a notice of dispute and potential claim (only after you check that you intend to pursue it), a small claims outline, and for Texas child support: an administrative review request, a request to report court-ordered arrears paid on time as zero months delinquent, and a payment record request. DOCX and PDF output (with a mailing cover sheet, enclosure checklist and certified mail worksheet), plain text, and an envelope block.

Honesty rules the code enforces: every sentence that states a fact cites a finding, a mail log entry, a value on the report, a sentence you checked, or text you typed; letters never say "not mine" or mention identity theft unless you said so; a 605B block needs your confirmation and an FTC report number; letters to lenders, collectors and agencies never carry your date of birth or SSN digits in any form, and no letter carries a full SSN; no letter claims that 609 or "Metro 2" forces deletion, demands an original signed contract, promises a result, or mentions a credit privacy number or a new identity; no letter threatens a lawsuit you have not confirmed you intend; offers say they are not an acknowledgment of the debt; no two letters in a plan are identical. There are no CPN, file segregation or false identity theft paths. `tests/test_honesty.py` tries each of these and checks it is refused.

## Type

The interface is set in Atkinson Hyperlegible Next (body text 18 px, secondary text no smaller than 15 px, lines under about 70 characters). Literata is used only on the letter paper. Sono is used only for account and tracking numbers in tables. All three are self-hosted with their licenses in `docs/fonts/`.

## Method and limits

- **Experian and Equifax: built without real samples.** No real Experian or Equifax report was available while this was built, so their readers are templates (`src/errata/generic.py`, data, not code paths) written from the bureaus' general description of their consumer reports: sections of labeled fields (label beside its value, or a row of labels over a row of values), a monthly payment history grid by year and month, personal information and inquiries. They are tested only on synthetic reports drawn to that general shape (`tests/fixtures/make_template_fixtures.py`). Expect them to miss fields on a real report: every field keeps its raw text, anything the reader cannot place lowers the confidence and is listed, the app flags the report as "check against the PDF", and every account has a correction form. Until a real layout is checked, entering accounts by hand or by CSV is the dependable path for those two bureaus. Corrections to the templates are welcome as data changes.
- **Parsing.** The TransUnion consumer report PDF (annualcreditreport.com and transunion.com, 2026 layout) is read from its text layer: label rows with values aligned below them, the payment history grid by month columns, inquiries, specialty data. Every field keeps its raw text and the parse confidence is shown. A changed layout lowers the confidence and raises warnings rather than guessing.
- **Findings are signals from the report alone.** A contradiction in the report is strong evidence the furnisher cannot verify it as reported; it is not proof of what the right value is. Check each against your records before you send anything.
- **Dates of first delinquency.** TransUnion prints an estimated removal date, not the date of first delinquency. The re-aging and obsolescence rules use the first late entry in the account's own grid as the latest possible start of the delinquency, or a date you enter.
- **Saved web pages: built without real samples.** The page reader turns tables and definition lists into the same lines of cells the PDF readers use and reads them with templates (including a TransUnion template used only for pages). It was tested only on synthetic pages (`tests/fixtures/make_html_fixtures.py`); every report it reads says so and every field can be corrected.
- **Area codes** are checked by structure and against the list of area codes in service in the North American Numbering Plan. NANPA's own site does not allow automated downloads, so the list (`src/errata/nanp.py`, 440 geographic codes plus toll-free, personal communications and premium codes) is derived from Google libphonenumber's data through its Python release phonenumbers 9.0.40, pinned by the archive's SHA-256, with the table's own SHA-256 checked by the tests. `tools/nanp.py` rebuilds it. A newly opened overlay may be missing until the list is rebuilt, so an unlisted code is a medium-confidence finding.
- **Texas only** for the child support rules; other states' agencies get the general accuracy rules.
- **Score calibration** uses the changes you record between two scores of the same model; a few observations are not proof, and the ranges say how many they rest on.
- **Statute of limitations table** comes from a secondary source (SuperMoney, updated 07/23/2026) and three rows are flagged for review; it is shown as an estimate to verify with your state's statute.
- **Score ranges** are estimates, not predictions.

## Validation

- `pytest -q`: parser, findings, deadlines, planner, letters, DOCX and PDF output, rounds, repository rules, CLI.
- Synthetic TransUnion-layout reports and synthetic Experian-style and Equifax-style reports in `tests/fixtures/` (made by `tests/fixtures/make_fixtures.py` and `make_template_fixtures.py` with reportlab; every person, address and account invented, no real report of any bureau copied) carry planted errors; the tests check each is found by the right rule with the right legal basis and that clean accounts and a clean report produce no findings.
- `python tests/make_vectors.py && node web/parity.test.mjs`: the browser core replays every case from the Python library, byte for byte, including the SHA-256 of the DOCX and PDF output.
- `node web/net.test.mjs`: fetch appears only in the one network gate, and nothing else in the page can reach the network.
- `node web/ai.test.mjs`: no SSN or date of birth in any outgoing writing helper request, and only replaceable sentences are sent.
- `pytest tests/test_honesty.py tests/test_html.py tests/test_additions.py`: adversarial letter audits, saved pages, the 605(c) date, the Texas window, calibration, savings, the negotiation checklist and the every-bureau helper.
- `pytest tests/test_web.py tests/test_browser.py`: the built page's policy, framing guard, tokens, fonts and manifest; then, in headless Chromium, every view of the example renders its one key answer with no outside request and no policy violation, a person's record is stored encrypted and opens only with the passphrase, service keys stay inside the encrypted record, a fixture PDF and a saved page import and produce their findings (the browser's page walk matches the Python one line for line), locking clears the screen, the Texas review letter drafts with its deadline, the framing guard holds and Delete everything empties storage.
- `pytest tests/test_build.py`: the published copy (links filled as the ship step fills them, served over https at OWNER.github.io/errata/) in headless Chromium: a new person imports each synthetic report, builds every letter with one click, confirms the identity card, answers the yes or no questions and prints one packet whose recipients, addresses and identifiers are checked; answers add and remove letters; the update check finds its address from where the page is served; the service worker caches the shell and the page opens offline.
- `pytest tests/test_rule_matrix.py tests/test_all_outputs.py`: every findings rule with a report that triggers it and a near twin that does not, and every letter type opened as a Word file and a PDF.
- `python tools/shoot.py`: screenshots of every view at 400 and 1280 px in light and dark (into `shots/`, not tracked), checking for sideways scrolling, missing fonts, more or less than one key answer, and controls under 44 px on phones.
- `node web/pdfjs.test.mjs`: the pinned pdf.js reads the fixture PDFs and the browser core gives the same parse and findings as the Python reader.

## Sources

Legal rules, deadlines, addresses and the statute of limitations table come from the project's legal research (compiled 2026-10-22). Statute and regulation text is from Cornell LII. Secondary sources are labeled.

| Key | Citation | Source |
|---|---|---|
| fcra604, fcra604f | FCRA 604, 15 U.S.C. 1681b | https://www.law.cornell.edu/uscode/text/15/1681b |
| fcra605, fcra605c, fcra605a7 | FCRA 605, 15 U.S.C. 1681c | https://www.law.cornell.edu/uscode/text/15/1681c |
| fcra605b | FCRA 605B, 15 U.S.C. 1681c-2 | https://www.law.cornell.edu/uscode/text/15/1681c-2 |
| fcra607b | FCRA 607(b), 15 U.S.C. 1681e(b) | https://www.law.cornell.edu/uscode/text/15/1681e |
| fcra609 | FCRA 609, 15 U.S.C. 1681g | https://www.law.cornell.edu/uscode/text/15/1681g |
| fcra611 and subsections | FCRA 611, 15 U.S.C. 1681i | https://www.law.cornell.edu/uscode/text/15/1681i |
| fcra612 | FCRA 612, 15 U.S.C. 1681j | https://www.law.cornell.edu/uscode/text/15/1681j |
| fcra616, fcra617, fcra618 | FCRA 616 to 618, 15 U.S.C. 1681n, 1681o, 1681p | https://www.law.cornell.edu/uscode/text/15/1681n |
| fcra623 and subsections | FCRA 623, 15 U.S.C. 1681s-2 | https://www.law.cornell.edu/uscode/text/15/1681s-2 |
| regv1022_43 | 12 CFR 1022.43 | https://www.law.cornell.edu/cfr/text/12/1022.43 |
| fdcpa1692c | FDCPA 805(c), 15 U.S.C. 1692c | https://www.law.cornell.edu/uscode/text/15/1692c |
| fdcpa1692g, fdcpa1692e8 | FDCPA 809(b) and 807(8), 15 U.S.C. 1692g, 1692e | https://www.law.cornell.edu/uscode/text/15/1692g |
| fcra605a_alert, fcra605a_freeze | FCRA 605A(a) and (i), 15 U.S.C. 1681c-1 | https://www.law.cornell.edu/uscode/text/15/1681c-1 |
| ssa666a7 | 42 U.S.C. 666(a)(7) | https://www.law.cornell.edu/uscode/text/42/666 |
| tfc231_114 | Tex. Fam. Code 231.114 | https://statutes.capitol.texas.gov/Docs/FA/htm/FA.231.htm#231.114 |
| tac55_102, tac55_103, tac55_104 | 1 Tex. Admin. Code 55.102 to 55.104 | https://law.cornell.edu/regulations/texas/1-Tex-Admin-Code-SS-55-102 |
| nanp | North American Numbering Plan area codes (via libphonenumber 9.0.40) | https://www.nationalnanpa.com/reports/reports_npa.html |
| regf1006_26 | 12 CFR 1006.26 | https://www.law.cornell.edu/cfr/text/12/1006.26 |
| regf1006_30a, regf1006_30b | 12 CFR 1006.30 | https://www.law.cornell.edu/cfr/text/12/1006.30 |
| regf1006_30a_c | Official interpretation 30(a)(1)-2 | https://www.consumerfinance.gov/rules-policy/regulations/1006/2021-11-30/interp-30/ |
| regf1006_34 | 12 CFR 1006.34 | https://www.law.cornell.edu/cfr/text/12/1006.34 |
| regf1006_38 | 12 CFR 1006.38 | https://www.law.cornell.edu/cfr/text/12/1006.38 |
| croa1679b, croa1679c | CROA, 15 U.S.C. 1679b, 1679c | https://www.law.cornell.edu/uscode/text/15/1679b |
| tsr310_4 | 16 CFR 310.4(a)(2) | https://www.law.cornell.edu/cfr/text/16/310.4 |
| medical_policy | Bureaus' medical collection policy (industry) | https://newsroom.transunion.com/equifax-experian-and-transunion-remove-medical-collections-debt-under-500-from-us-credit-reports/ |
| medical_rule_vacated | CFPB medical rule vacated (secondary) | https://www.checkbook.org/national/consumers-notebook/articles/Federal-Judge-Kills-CFPB-Rule-that-Banned-Medical-Debt-in-Credit-Reports-7678 |
| white_v_experian | White v. Experian (secondary) | https://www.lieffcabraser.com/?p=3703 |
| saunders | Saunders v. BB&T (court, via secondary) | https://www.bclplaw.com/a/web/101932/Use-of-Compliance-Condition-Codes.pdf |
| metro2_status, metro2_ccc, metro2_k1 | Metro 2 public summaries (industry) | https://bureaurelay.com/metro2/field/account-status |
| metro2_k2 | Debt purchaser reporting (industry) | https://docs.interprose.com/docs/debt-purchaser-credit-reporting |
| cares_period | End of the national emergency (secondary) | https://www.hsfkramer.com/insights/2023-05/implications-for-benefit-plans-of-the-end-of-the-covid-19-national-emergency-and-public-health-emergency |
| sol_table | State statutes of limitations (secondary, verify) | https://www.supermoney.com/statute-of-limitations-on-debt |
| nclc_timebarred | Time-barred debt (secondary) | https://library.nclc.org/article/limits-collection-time-barred-debt-and-new-fdcpa-rules |
| experian_609, experian_goodwill | Experian guidance (industry) | https://experian.com/blogs/ask-experian/what-is-a-609-dispute-letter |
| fico_weights, fico_versions, rate_shop | myFICO (industry) | https://www.myfico.com/credit-education/whats-in-your-credit-score |
| fico8, fico9, vantage4 | Score model summaries (secondary) | https://www.creditkarma.com/credit/i/what-fico-score-8 |
| freddie_models | Freddie Mac credit score models (agency) | https://sf.freddiemac.com/general/credit-score-models |
| usps_2026, certified_err | USPS prices effective July 12, 2026 (secondary) | https://www.unlv.edu/news/unlvtoday/usps-postal-rate-increases-effective-july-12 |
| bureau addresses | TransUnion, Experian, Equifax dispute pages | https://www.transunion.com/credit-disputes/dispute-your-credit/mail-or-phone |
| cfpb_complaint, naag, naca | CFPB complaint portal, NAAG, NACA | https://www.consumerfinance.gov/complaint/ |

The complete list with every URL is in `src/errata/law.py` (and the generated `web/src/core/90_tables.js`); each finding names the keys it relies on.

## Free means free

The Credit Repair Organizations Act covers anyone who provides credit repair help "in return for the payment of money or other valuable consideration". Errata takes none: no paid tier, no affiliate links, no lead capture, no data sales, no telemetry. A free family helper mode is for people you know, who sign and send their own letters. A paid agency mode is not part of this version. Two parts of the Act apply to everyone, paid or not: no one may make or advise untrue or misleading statements to a bureau or creditor, and no one may advise changing an identity to hide accurate information (15 U.S.C. 1679b(a)). That is why the letters say only what the evidence or your confirmed answers support, and why there is no CPN or file segregation path.

## License

MIT. Copyright 2026 Will Whitmire.

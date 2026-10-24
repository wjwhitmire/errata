// ---------------------------------------------------------------- reports: import, fields to check, compare, account detail
// PDFs are read here with pdf.js (pinned, embedded): the text layer goes to the core's parser. PDF
// scripts, XFA forms and font evaluation are off. Scanned pages need the text reader (a switch).
const MAX_PDF_BYTES = 80 * 1024 * 1024, MAX_CSV_BYTES = 10 * 1024 * 1024;
// A saved web page, read as text: DOMParser makes an inert document (no script runs, nothing loads),
// and the core's walker turns it into lines of cells for the template reader.
function htmlLines(text) {
  if (text.length > C.HTML_MAX_BYTES) throw new Error("This page is larger than 20 MB, which is far more than a credit report.");
  return C.html_dom_lines(new DOMParser().parseFromString(text, "text/html"));
}
let workerSrcUrl = null, pdfMode = "worker", workerBroke = null;
const PDF_OPEN_MS = 25000;
function pdfWorkerUrl() {
  if (!workerSrcUrl) workerSrcUrl = URL.createObjectURL(new Blob([$("vendor-pdfjs-worker").textContent], { type: "text/javascript" }));
  return workerSrcUrl;
}
// pdf.js reads in a worker. If the worker cannot start in this browser (an error, or no answer in
// 25 seconds), the same pinned reader runs on this page instead: slower, but it finishes or says why.
async function pdfjs() {
  const lib = window.pdfjsLib;
  if (!lib || !lib.getDocument) throw new Error("The PDF reader did not load. Reload the page and try again.");
  if (pdfMode === "worker" && !lib.GlobalWorkerOptions.workerPort) {
    try {
      const w = new Worker(pdfWorkerUrl(), { type: "module" });
      // a worker that fails to start says so with an error event, often after the first request is sent
      workerBroke = new Promise((resolve) => w.addEventListener("error", () => { pdfMode = "failed"; resolve(); }));
      lib.GlobalWorkerOptions.workerPort = w;
    } catch (e) { pdfMode = "failed"; }
  }
  if (pdfMode === "failed") await usePageReader(lib);
  return lib;
}
async function usePageReader(lib) {
  if (!globalThis.pdfjsWorker) globalThis.pdfjsWorker = await import(pdfWorkerUrl());
  try { if (lib.GlobalWorkerOptions.workerPort) lib.GlobalWorkerOptions.workerPort.terminate(); } catch (e) { /* gone */ }
  lib.GlobalWorkerOptions.workerPort = null;
  pdfMode = "page";
}
function withTimeout(promise, ms) {
  let t;
  return Promise.race([promise, new Promise((_, rej) => { t = setTimeout(() => rej(Object.assign(new Error("timeout"), { name: "TimeoutError" })), ms); })]).finally(() => clearTimeout(t));
}
async function openPdf(bytes) {
  if (bytes.length > MAX_PDF_BYTES) throw new Error("This PDF is larger than 80 MB, which is far more than a credit report.");
  if (String.fromCharCode.apply(null, bytes.subarray(0, Math.min(1024, bytes.length))).indexOf("%PDF") < 0) throw new Error("This file is not a PDF.");
  const opts = () => ({ data: bytes.slice(), isEvalSupported: false, enableXfa: false, disableAutoFetch: true, disableStream: true, stopAtErrors: false, verbosity: 0 });
  let lib = await pdfjs();
  let task = lib.getDocument(opts());
  const broke = pdfMode === "worker" && workerBroke ? workerBroke.then(() => { throw Object.assign(new Error("worker"), { name: "WorkerError" }); }) : new Promise(() => {});
  try { return await withTimeout(Promise.race([task.promise, broke]), PDF_OPEN_MS); } catch (e) {
    if (e && e.name === "PasswordException") throw new Error("This PDF is password protected. Save it again without a password and import that copy.");
    // fall back to reading on the page when the worker failed to start, timed out or reported itself
    if (pdfMode === "page" || !(e && (e.name === "TimeoutError" || e.name === "WorkerError" || /worker/i.test(String(e.message || ""))))) throw new Error("This PDF could not be read.");
    try { task.destroy(); } catch (x) { /* gone */ }
    await usePageReader(lib);
    task = lib.getDocument(opts());
    try { return await withTimeout(task.promise, PDF_OPEN_MS * 2); } catch (e2) {
      throw new Error(e2 && e2.name === "TimeoutError" ? "The PDF reader did not answer in this browser. Update the browser, or open the report and use Print, Save as PDF, then import that copy." : "This PDF could not be read.");
    }
  }
}
async function pdfItems(pdf, progress) {
  let items = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    items = items.concat(C.items_from_pdfjs(p - 1, vp.height, tc.items));
    if (progress) progress(p / pdf.numPages);
  }
  return items;
}
function parseItems(items, name) {
  const b = C.detect_bureau(items);
  if (!b) throw new Error((name || "This file") + " does not look like a TransUnion, Experian or Equifax credit report.");
  const r = C.parse_items(items);
  if (b !== "transunion") r.messages.unshift("Read with the " + bname(b) + " template, which was built without a real " + bname(b) + " report to test against. Check every account against the PDF before you use it.");
  return r;
}
function addReports(reps, how) {
  change(how, (P) => {
    for (const r of reps) {
      const date = r.source.report_date || today();
      let round = P.rounds.length ? P.rounds[P.rounds.length - 1] : null;
      if (!round || round.reports.some((x) => x.bureau === r.bureau && x.source.kind !== "manual")) {
        round = { id: "r" + (P.rounds.length + 1), label: "Round " + (P.rounds.length + 1), date, reports: [] };
        P.rounds.push(round);
      }
      const same = round.reports.find((x) => x.bureau === r.bureau);
      if (same && same.source.kind === "manual" && r.source.kind === "manual") { same.accounts = same.accounts.concat(r.accounts); }
      else round.reports = round.reports.filter((x) => x.bureau !== r.bureau).concat([r]);
      if (!P.start || date < P.start) P.start = date;
    }
  });
}
async function importPdf() {
  const files = await pickFile("application/pdf,.pdf,text/html,.html,.htm");
  if (files.length) await importFile(files[0]);
}
function isHtmlFile(f) { return /\.html?$/i.test(f.name || "") || f.type === "text/html"; }
async function importFile(f) {
  if (/\.(csv|tsv)$/i.test(f.name || "")) return importCsvFile(f);
  if (isHtmlFile(f)) return importHtml(f);
  if (f.size > MAX_PDF_BYTES) { openDialog({ title: "That file is too large", icon: "alert", body: [el("p", { text: "This file is larger than 80 MB, which is far more than a credit report." })] }); return; }
  const status = el("p", { cls: "muted", "aria-live": "polite", text: "Reading " + f.name + " on this device..." });
  openDialog({ title: "Import a report", icon: "upload", body: [status], actions: [{ label: "Close" }] });
  try {
    const bytes = await readFile(f);
    const pdf = await openPdf(bytes);
    const items = await pdfItems(pdf, (p) => { status.textContent = "Reading page text: " + Math.round(p * 100) + "%"; });
    if (items.length < 20) {
      closeDialog();
      if (!switchOn("ocr")) { openDialog({ title: "This PDF has no text layer", icon: "alert", body: [el("p", { text: "It looks scanned. Reading a scan needs the text reader for scanned pages, which is off. Turn it on in Settings (it downloads its language data once), or enter the accounts by hand." })], actions: [{ label: "Close" }, { label: "Open Settings", primary: true, onClick: () => go("#/settings") }] }); return; }
      openDialog({ title: "Reading the scanned pages", icon: "upload", body: [status], actions: [{ label: "Close" }] });
      const ocrItemsAll = await ocrPdf(pdf, (t) => { status.textContent = t; });
      const r = parseItems(ocrItemsAll, f.name);
      r.source.name = f.name; r.source.pages = pdf.numPages; r.source.kind = "ocr";
      closeDialog();
      addReports([r], "Imported " + bname(r.bureau) + " (read from scanned pages)");
      return;
    }
    const r = parseItems(items, f.name);
    r.source.name = cleanName(f.name, 80); r.source.pages = pdf.numPages;
    closeDialog();
    addReports([r], "Imported the " + bname(r.bureau) + " report of " + mdy(r.source.report_date));
    go("#/reports");
  } catch (e) {
    status.textContent = e.message || String(e);
  }
}
async function importHtml(f) {
  try {
    if (f.size > C.HTML_MAX_BYTES) throw new Error("This page is larger than 20 MB, which is far more than a credit report.");
    const text = dec.decode(await readFile(f));
    const r = C.parse_html_lines(htmlLines(text), "", "");
    r.source.name = cleanName(f.name, 80);
    addReports([r], "Imported the " + bname(r.bureau) + " page of " + mdy(r.source.report_date || today()));
    go("#/reports");
  } catch (e) {
    openDialog({ title: "That page could not be read", icon: "alert", body: [el("p", { text: e.message || String(e) }),
      el("p", { cls: "muted small", text: "Save the report page itself (in the browser: Save page as, Webpage, HTML only), or print it to PDF and import the PDF." })] });
  }
}
async function importCsv() {
  const files = await pickFile(".csv,.tsv,text/csv,text/plain");
  if (files.length) await importCsvFile(files[0]);
}
async function importCsvFile(file) {
  const files = [file];
  try {
    if (file.size > MAX_CSV_BYTES) throw new Error("This file is larger than 10 MB, which is far more than a list of accounts.");
    const text = dec.decode(await readFile(files[0]));
    const reps = C.parse_csv(text, "", today());
    addReports(reps, "Imported " + plural(reps.reduce((n, r) => n + r.accounts.length, 0), "account") + " from " + cleanName(files[0].name, 60));
  } catch (e) { openDialog({ title: "That file could not be imported", icon: "alert", body: [el("p", { text: e.message || String(e) }),
    el("p", { cls: "muted small", text: "The first row names the columns: bureau, name, number, type, opened, balance, limit, past due, status, history (like 2025-03:30; 2025-04:OK), remarks." })] }); }
}
function manualDialog() {
  const b = select([["transunion", "TransUnion"], ["experian", "Experian"], ["equifax", "Equifax"]], "transunion", { id: "m-bureau" });
  const date = input({ id: "m-date", type: "date", value: today() });
  const f = {};
  const mk = (k, label, o) => { f[k] = input(Object.assign({ id: "m-" + k }, o || {})); return field(label, f[k]); };
  const type = select([["Revolving", "Credit card or line"], ["Installment", "Installment loan"], ["Mortgage", "Mortgage"], ["Collection", "Collection"], ["Open", "Open account"]], "Revolving", { id: "m-type" });
  const msg = el("p", { cls: "muted small", "aria-live": "polite" });
  openDialog({ title: "Enter an account by hand", icon: "edit", wide: true, body: [el("div", { cls: "grid2" }, [field("Bureau", b), field("Report date", date), mk("name", "Creditor name"), mk("number", "Account number as shown", { mono: true }),
    field("Type", type), mk("opened", "Date opened", { placeholder: "mm/dd/yyyy", mono: true }), mk("balance", "Balance", { placeholder: "$0", mono: true }), mk("limit", "Credit limit", { mono: true }),
    mk("past_due", "Past due", { mono: true }), mk("status", "Pay status"), mk("original_creditor", "Original creditor (collections)"), mk("dofd", "Date of first delinquency", { placeholder: "mm/yyyy", mono: true })]),
  field("Payment history", f.history = input({ id: "m-history", mono: true, placeholder: "2025-03:30; 2025-04:OK" }), "Month and code pairs, separated by semicolons."), msg],
  actions: [{ label: "Cancel" }, { label: "Add the account", primary: true, keep: true, onClick: () => {
    try {
      const rec = { name: f.name.value, number: f.number.value, account_type: type.value + " Account", loan_type: type.value === "Collection" ? "Collection" : type.value === "Revolving" ? "Credit Card" : "",
        opened: f.opened.value, balance: f.balance.value, credit_limit: f.limit.value, past_due: f.past_due.value, pay_status: f.status.value || (type.value === "Collection" ? "Collection Account" : "Current"),
        original_creditor: f.original_creditor.value, dofd: f.dofd.value, history: f.history.value };
      const r = C.manual_report(b.value, [rec], date.value || today());
      closeDialog();
      addReports([r], "Added " + titleCase(rec.name) + " to the " + bname(b.value) + " report");
    } catch (e) { msg.textContent = e.message || String(e); }
    return false;
  } }] });
}
const CMP_LABEL = { balance: "Balance", status: "Status", past_due: "Past due", opened: "Opened", closed: "Closed", credit_limit: "Credit limit", high_balance: "High balance", removal: "Est. removal", history: "Payment history" };
function cmpValue(field, v) {
  if (v === null || v === undefined || v === "") return null;
  if (["balance", "past_due", "credit_limit", "high_balance"].includes(field)) return money(v);
  if (["opened", "closed", "removal"].includes(field)) return C.us_date(String(v).slice(0, 7));
  return titleCase(String(v));
}
VIEWS.reports = (d, r) => {
  if (r.parts[1] === "compare") return compareView(d, r);
  if (r.parts[1] === "account") return accountView(d, r);
  const P = d.P;
  const n = d.toCheck;
  const where = d.checks.filter((c) => c.items.some((x) => !x.fixed)).map((c) => bname(c.report.bureau));
  const k = keyAnswer("Fields to check", String(n), n ? "On the " + where.join(" and ") + " report" + (where.length > 1 ? "s" : "") + ". Every other field was read cleanly. Nothing is used in a letter until it is confirmed." : d.round ? "Every field was read cleanly or confirmed." : "Import a report to start.");
  const drop = el("div", { cls: "card drop", id: "dropzone" }, [el("h3", { cls: "ch" }, [icon("upload"), "Add a report"]),
    el("p", { text: "Choose the PDF or the saved web page from AnnualCreditReport.com or a bureau site, or drop it here. It is read here, in this browser; nothing is uploaded." }),
    el("div", { cls: "row" }, [btn("Choose a file", importPdf, { cls: "primary", icon: "file", id: "import-pdf" }), btn("Enter by hand", manualDialog, { icon: "edit", id: "import-manual" }), btn("Import CSV", importCsv, { icon: "grid", id: "import-csv" })]),
    el("p", { cls: "muted small", text: switchOn("ocr") ? "Scanned reports are read with the text reader, on this device." : "Scanned paper reports need the text reader for scanned pages, which is off. Turn it on in Settings. A saved web page is read as text; nothing on it runs." })]);
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) importFile(f); });
  const body = [el("div", { cls: "cols" }, [k, drop])];
  if (d.round) {
    const rows = d.round.reports.slice().sort((a, b2) => BUREAU_ORDER.indexOf(a.bureau) - BUREAU_ORDER.indexOf(b2.bureau)).map((rep) => {
      const c = d.checks.find((x) => x.report === rep);
      const open = c ? c.items.filter((x) => !x.fixed).length : 0;
      return { cells: [[bu(rep.bureau), " ", el("b", { text: bname(rep.bureau) }), el("br"), el("span", { cls: "muted", text: rep.source.kind === "manual" ? "Entered by hand" : rep.source.kind === "example" ? "Example report" : cleanName(rep.source.name || "Imported PDF", 60) })],
        num(mdy(rep.source.report_date)), num(String(rep.source.pages || "")), conf(rep.source.confidence || 0), open ? el("span", { cls: "chip warn" }, [icon("edit"), open + " to check"]) : chip("All read"),
        btn("Remove", () => change("Removed the " + bname(rep.bureau) + " report", (Q) => { const rd = Q.rounds[Q.rounds.length - 1]; rd.reports = rd.reports.filter((x) => x.bureau !== rep.bureau); if (!rd.reports.length) Q.rounds.pop(); }), { cls: "sm quiet", aria: "Remove the " + bname(rep.bureau) + " report" })] };
    });
    body.push(card(d.round.label + " reports", "reports", [table(["Bureau", "Pulled", ["Pages", "n"], "Parse confidence", "Status", ""], rows),
      el("div", { cls: "row" }, [d.reports.length > 1 ? link("Compare the three bureaus", "#/reports/compare", { icon: "compare" }) : null, d.compare.groups.length ? link("Accounts and payment history", "#/reports/account/0", { icon: "grid" }) : null,
        P.rounds.length > 1 ? link("Round compare", "#/tracker/rounds", { icon: "diff" }) : null])], P.rounds.length > 1 ? plural(P.rounds.length, "round") : ""));
    for (const c of d.checks) {
      const open = c.items;
      if (!open.length) continue;
      const rows2 = open.map((it) => {
        const inp = input({ value: it.fixed ? it.fixedValue : it.value, mono: /\d/.test(it.value || ""), "aria-label": FIELD_LABEL[it.field] || it.field });
        return { attrs: { "aria-selected": it.fixed ? null : "true" }, cells: [[el("b", { text: FIELD_LABEL[it.field] || it.field }), el("br"), el("span", { cls: "muted", text: titleCase(it.account) })], el("code", { cls: "mono", text: it.raw || it.message }), inp,
          conf(it.conf || 60), it.fixed ? chip("All read", "Confirmed") : btn("Confirm", () => change("Confirmed " + (FIELD_LABEL[it.field] || it.field) + " for " + titleCase(it.account), (Q) => {
            const key = reportKey(d.round, c.report);
            Q.corrections = Q.corrections || {};
            Q.corrections[key] = Q.corrections[key] || {};
            Q.corrections[key][it.key] = inp.value;
          }), { cls: "sm", icon: "check", icoCls: "ico sm" })] };
      });
      body.push(card(bname(c.report.bureau) + ": check these fields", "correct", [table(["Field", "Text on the page", "Read as", "Confidence", ""], rows2),
        why("A misread figure would change a finding or a utilization figure, so each one waits for you. Correct the value if it is wrong, then confirm it. " + (open[0] && open[0].message ? open[0].message : ""))], "raw text beside what was read"));
    }
    for (const rep of d.round.reports) if ((rep.messages || []).some((m) => /template|not recognized/.test(m))) body.push(note("warn", "alert", [el("b", { text: bname(rep.bureau) + ": check this report against the PDF" })].concat(rep.messages.filter((m) => /template|not recognized/.test(m)).map((m) => el("p", { text: m })))));
    if (d.round.reports.some((x) => x.specialty && x.specialty.length)) body.push(card("Specialty reports", "file", d.round.reports.flatMap((x) => (x.specialty || []).map((s) => el("p", { text: s.requested_by + " requested a specialty report on " + mdy(s.requested_on) + "." })))));
  } else body.push(el("p", { cls: "empty", text: "No reports yet. The free weekly reports from AnnualCreditReport.com work best." }));
  return { title: "Reports", crumb: crumbOf(d.round ? d.round.label + " imports" : "Imports"), body };
};
function compareView(d, r) {
  const groups = d.compare.groups;
  const sel = Math.min(Number(r.parts[2] || 0) || 0, Math.max(0, groups.length - 1));
  const g = groups[sel];
  const list = el("div", { cls: "acctlist" }, groups.map((x, i) => {
    const kind = (() => { const a = x.ids ? d.reports.flatMap((rp) => rp.accounts).find((y) => y.id === Object.values(x.ids)[0]) : null; return a ? titleCase(a.kind) : x.only ? "One bureau only" : ""; })();
    return el("button", { type: "button", "aria-current": i === sel ? "true" : null, on: { click: () => go("#/reports/compare/" + i) } }, [el("b", { text: titleCase(x.name) }),
      el("span", null, [x.differ ? el("span", { cls: "chip warn" }, [icon("mismatch"), x.differ + " to check"]) : x.only ? el("span", { cls: "chip plain", text: BUREAU_AB[x.only] + " only" }) : chip("Match")]), el("span", { cls: "k", text: kind })]);
  }));
  const bs = BUREAU_ORDER.filter((b) => d.reports.some((x) => x.bureau === b));
  const body = [];
  if (g && g.rows.length) {
    const head = el("div", { cls: "cmp-row hd" }, [el("span", { cls: "f", text: "Field" })].concat(bs.map((b) => el("span", { cls: "v" }, [bu(b), " " + bname(b)]))));
    const rows = [head];
    const accts = {};
    for (const b of bs) accts[b] = g.ids && g.ids[b] ? d.reports.find((x) => x.bureau === b).accounts.find((a) => a.id === g.ids[b]) : null;
    for (const row of g.rows) {
      const cls = row.state === "differ" ? " mm" : row.state === "timing" ? " tm" : "";
      const odd = new Set(row.odd || []);
      let cells;
      if (row.field === "history") {
        cells = bs.map((b) => { const t = row.months.map((m) => C.us_date(m.month) + " " + (m.values[b] || "none")).join(", "); return el("span", { cls: "v" + (odd.has(b) ? " odd" : "") }, [t]); });
      } else cells = bs.map((b) => { const v = cmpValue(row.field, row.values[b]); return el("span", { cls: "v" + (row.state === "differ" && odd.has(b) ? " odd" : "") }, [v === null ? el("span", { cls: "none", text: accts[b] ? "Not reported" : "No account" }) : v]); });
      rows.push(el("div", { cls: "cmp-row" + cls, title: row.state === "timing" ? "Timing: one copy is older; its value matches the newer copy's own history for that month. Not counted." : row.state === "differ" ? "A real difference" : null }, [el("span", { cls: "f", text: CMP_LABEL[row.field] || row.field })].concat(cells)));
    }
    rows.push(el("div", { cls: "cmp-row" }, [el("span", { cls: "f", text: "Last reported" })].concat(bs.map((b) => el("span", { cls: "v", text: accts[b] && accts[b].updated ? mdy(accts[b].updated) : "" })))));
    const anyNum = Object.values(accts).find(Boolean);
    body.push(card(titleCase(g.name), "compare", [el("div", { cls: "cmp" }, rows),
      el("p", { cls: "muted small", text: "A real difference has the not-equal mark and a tint on the odd value. A timing difference has the about-equal mark and no tint: one copy is just older." }),
      link("Payment history for this account", "#/reports/account/" + sel, { icon: "grid" })], anyNum ? el("span", { cls: "mono", text: masked(anyNum.number) }) : null));
  } else if (g) body.push(card(titleCase(g.name), "compare", [el("p", { text: "Only " + bname(g.only) + " reports this account, so there is nothing to compare. An account on one bureau only is common (not every lender reports to all three)." })]));
  const diffs = d.compare.differences, tim = d.compare.timing;
  const xb = d.groups.filter((x) => x.rule === "cross_bureau_mismatch" && x.current);
  const k = keyAnswer("Differences to dispute", String(diffs), (diffs ? xb.map((x) => titleCase(x.subject.replace(/\s+\S*\d\S*$/, "")) + ": " + (x.members[0].evidence[0] ? x.members[0].evidence[0].value : "")).join(". ") + ". " : "The bureaus agree on every field they share. ") +
    (tim ? plural(tim, "more field") + " differ only because one bureau's copy is older; those are marked as timing and not counted." : ""), xb.length ? [link("See finding " + xb[0].label, "#/findings/" + xb[0].label, { cls: "primary", icon: "findings" })] : null);
  return { title: "Three-bureau compare", crumb: "Reports / Side by side", body: [el("div", { cls: "cols", style: "grid-template-columns:minmax(0,300px) minmax(0,1fr)" }, [card("Accounts", "compare", [list], null, { cls: "card hide-ph" }),
    el("div", { cls: "stack" }, [k].concat(body))])] };
}
const RATING_CLASS = (r) => { const x = String(r || "").toUpperCase(); if (x === "OK" || x === "C" || x === "0") return x === "C" ? "c-co" : "c-ok"; if (x === "30") return "c-30"; if (x === "60") return "c-60";
  if (["90", "120", "150", "180"].includes(x)) return "c-90"; if (["CO", "C/O", "COL", "VS", "RPO", "FC"].includes(x)) return "c-co"; return "c-x"; };
const RATING_WORD = (r) => { const x = String(r || "").toUpperCase(); if (x === "OK") return "paid as agreed"; if (/^\d+$/.test(x) && x !== "0") return x + " days late"; if (x === "C" || x === "COL") return "collection"; if (x === "CO" || x === "C/O") return "charge-off"; return "no data"; };
function accountView(d, r) {
  const groups = d.compare.groups;
  const sel = Math.min(Number(r.parts[2] || 0) || 0, Math.max(0, groups.length - 1));
  const g = groups[sel];
  if (!g) return { title: "Account", crumb: "Reports / Account", body: [keyAnswer("Worst reported", "None", "No accounts yet.")] };
  const bs = BUREAU_ORDER.filter((b) => d.reports.some((x) => x.bureau === b));
  const accts = {};
  for (const b of bs) {
    const id = g.ids ? g.ids[b] : null;
    const rep = d.reports.find((x) => x.bureau === b);
    accts[b] = id ? rep.accounts.find((a) => a.id === id) : g.only === b ? rep.accounts.find((a) => C.norm_name(a.name) === C.norm_name(g.name)) : null;
  }
  const any = Object.values(accts).find(Boolean);
  const months = new Set();
  for (const b of bs) for (const h of (accts[b] ? accts[b].history : [])) months.add(h.month);
  const ms = Array.from(months).sort().slice(-24);
  const years = Array.from(new Set(ms.map((m) => m.slice(0, 4)))).sort();
  let worst = null;
  for (const b of bs) for (const h of (accts[b] ? accts[b].history : [])) { const dd = C.rating_days(h.rating); if (dd && dd >= 30 && (!worst || dd > worst.d || (dd === worst.d && h.month > worst.m))) worst = { d: dd, m: h.month, b }; }
  const pick = S.ui.cell && S.ui.cell.acct === sel ? S.ui.cell : null;
  const grids = bs.map((b) => {
    const a = accts[b];
    const hm = new Map((a ? a.history : []).map((h) => [h.month, h]));
    const trs = years.map((y) => el("tr", null, [el("th", { cls: "y", scope: "row", text: y })].concat([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((mi) => {
      const m = y + "-" + String(mi).padStart(2, "0");
      const h = hm.get(m);
      if (!ms.includes(m)) return el("td");
      const code = h ? (h.rating === "C/O" ? "CO" : h.rating || "X") : "X";
      const lab = C.month_label(m) + ", " + bname(b) + ": " + RATING_WORD(code) + (h && h.bal !== null && h.bal !== undefined ? ", balance " + money(h.bal) : "") + (h && h.past_due ? ", past due " + money(h.past_due) : "");
      return el("td", null, [el("button", { type: "button", cls: RATING_CLASS(code), "aria-label": lab, title: lab, "aria-pressed": pick && pick.b === b && pick.m === m ? "true" : null,
        on: { click: () => { S.ui.cell = pick && pick.b === b && pick.m === m ? null : { acct: sel, b, m }; render(); } } }, [el("span", { text: code })])]);
    }))));
    const pop = pick && pick.b === b ? cellPop(d, g, accts, pick, bs) : null;
    return el("div", { cls: "pg" }, [el("h4", null, [bu(b), " " + bname(b)]), a ? el("table", null, [el("thead", null, [el("tr", null, [el("th", { cls: "y" })].concat("JFMAMJJASOND".split("").map((c) => el("th", { scope: "col", text: c }))))]), el("tbody", null, trs)]) : el("p", { cls: "muted", text: "Not on this report." }), pop]);
  });
  const legend = el("div", { cls: "pg-legend pg" }, [["OK", "c-ok", "Paid as agreed"], ["30", "c-30", "30 days late"], ["60", "c-60", "60 days late"], ["90", "c-90", "90 to 180 days"], ["C", "c-co", "Collection"], ["CO", "c-co", "Charge-off"], ["X", "c-x", "No data reported"]]
    .map(([c, cls, t]) => el("span", null, [el("i", { cls, text: c }), t])));
  const summ = bs.map((b) => { const a = accts[b]; return el("div", { cls: "card", style: "padding:var(--s-4)" }, [el("h3", { cls: "ch", style: "font-size:16px" }, [bu(b), " " + bname(b)]), a ? el("dl", { cls: "dl" }, [
    el("dt", { text: "Status" }), el("dd", { text: a.pay_status || "Not reported" }), el("dt", { text: "Balance" }), el("dd", { cls: "num", text: money(a.balance) }),
    el("dt", { text: a.kind === "revolving" ? "Limit" : "High balance" }), el("dd", { cls: "num", text: money(a.kind === "revolving" ? a.credit_limit : a.high_balance) }),
    el("dt", { text: "Last reported" }), el("dd", { cls: "num", text: mdy(a.updated) })]) : el("p", { cls: "muted", text: "Not reported." }),
    a ? btn("Correct a field", () => editAccountDialog(d, b, a), { cls: "sm quiet", icon: "edit", icoCls: "ico sm" }) : null]); });
  const k = keyAnswer("Worst reported", worst ? worst.d + " days, " + C.us_date(worst.m) : "Never late", worst ? (bs.filter((b) => accts[b] && accts[b].history.some((h) => h.month === worst.m && C.rating_days(h.rating) >= 30)).map(bname).join(" and ") + " report it. " +
    bs.filter((b) => accts[b] && accts[b].history.some((h) => h.month === worst.m && h.rating === "OK")).map(bname).join(" and ") + (bs.some((b) => accts[b] && accts[b].history.some((h) => h.month === worst.m && h.rating === "OK")) ? " show the same month paid as agreed." : "")).trim() : "Every month in the history is reported as paid as agreed.");
  return { title: titleCase(g.name), crumb: "Reports / Account / " + (any ? masked(any.number) : ""), body: [
    el("div", { cls: "cols" }, [k, card("Account", "card", [el("dl", { cls: "dl" }, [el("dt", { text: "Type" }), el("dd", { text: any ? titleCase(any.loan_type || any.account_type || any.kind) : "" }), el("dt", { text: "Opened" }), el("dd", { cls: "num", text: any ? mdy(any.opened) : "" }),
      el("dt", { text: "Number" }), el("dd", { cls: "num", text: any ? masked(any.number) : "" }), el("dt", { text: "Responsibility" }), el("dd", { text: any && any.responsibility ? any.responsibility : "Not stated" }),
      any && any.original_creditor ? el("dt", { text: "Original creditor" }) : null, any && any.original_creditor ? el("dd", { text: titleCase(any.original_creditor) }) : null])])]),
    el("div", { cls: "cols three" }, summ),
    card("Payment history, " + ms.length + " months", "grid", [legend, el("div", { cls: "pg-wrap" }, grids)], "tap or hover a month for balance and past due"),
    el("div", { cls: "row" }, groups.map((x, i) => (i === sel ? null : link(titleCase(x.name), "#/reports/account/" + i, { cls: "sm" }))))] };
}
// Correct any field the reader got wrong: the correction is kept beside the report (the report as
// read is never changed) and is applied before findings are computed.
const EDIT_FIELDS = ["name", "number", "pay_status", "opened", "closed", "paid", "balance", "credit_limit", "high_balance", "past_due", "original_creditor", "dofd", "removal", "updated"];
function editAccountDialog(d, bureau, a) {
  const round = d.round;
  const rep = round.reports.find((x) => x.bureau === bureau);
  if (!rep) return;
  const orig = rep.accounts.find((x) => x.name === a.name) || a;
  const inputs = {};
  const rows = EDIT_FIELDS.map((f) => { inputs[f] = input({ value: fieldText(f, a[f]), mono: !!FIELD_KIND[f], "aria-label": FIELD_LABEL[f] || f }); return field((FIELD_LABEL[f] || f) + (orig.raw && orig.raw[f] ? " (page: " + orig.raw[f] + ")" : ""), inputs[f]); });
  openDialog({ title: "Correct " + titleCase(a.name) + " (" + bname(bureau) + ")", icon: "correct", wide: true, body: [el("p", { cls: "muted small", text: "Change only what the report itself shows differently from what was read. The report as read is kept; your corrections sit beside it and can be undone." }), el("div", { cls: "grid2" }, rows)],
    actions: [{ label: "Cancel" }, { label: "Save corrections", primary: true, id: "acct-save", onClick: () => change("Corrections saved for " + titleCase(a.name), (P) => {
      const key = reportKey(round, rep);
      P.corrections = P.corrections || {};
      P.corrections[key] = P.corrections[key] || {};
      for (const f of EDIT_FIELDS) if (inputs[f].value !== fieldText(f, a[f])) P.corrections[key][orig.name + "|" + f] = inputs[f].value;
    }) }] });
}
function cellPop(d, g, accts, pick, bs) {
  const a = accts[pick.b];
  const h = a.history.find((x) => x.month === pick.m) || { rating: "X" };
  const idx = Number(pick.m.slice(5, 7)) - 1;
  const others = bs.filter((b) => b !== pick.b).map((b) => { const o = accts[b] ? accts[b].history.find((x) => x.month === pick.m) : null; return [bname(b), o ? (o.rating || "No data") + (o.past_due !== null && o.past_due !== undefined ? ", past due " + money(o.past_due) : "") : "No data"]; });
  const f = d.findings.find((x) => x.account_id === a.id && x.current && (x.facts.join(" ").includes(C.us_date(pick.m)) || x.rule === "cross_bureau_mismatch"));
  return el("div", { cls: "cellpop", style: "--tip:calc(40px + " + (idx + 0.5) + " * (100% - 40px) / 12 - 6px)" }, [el("h5", null, [bu(pick.b), " " + C.month_label(pick.m), C.is_late(h.rating) ? chip("Reported late") : null]),
    el("dl", null, [el("dt", { text: "Reported as" }), el("dd", { text: RATING_WORD(h.rating) }), el("dt", { text: "Balance" }), el("dd", { cls: "num", text: money(h.bal) || "Not reported" }),
      el("dt", { text: "Past due" }), el("dd", { cls: "num", text: h.past_due !== null && h.past_due !== undefined ? money(h.past_due) : "Not reported" })].concat(others.flatMap(([n, v]) => [el("dt", { text: n }), el("dd", { text: v })]))),
    f ? link("Finding " + f.group.label, "#/findings/" + f.group.label, { cls: "quiet", after: "chevron-right" }) : null]);
}

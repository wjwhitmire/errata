// ---------------------------------------------------------------- CSV and manual entry, results letters (twin of intake.py)
const MAX_ROWS = 50000;
const INTAKE_COLUMNS = { bureau: "bureau", name: "name", creditor: "name", "account name": "name", number: "number", "account number": "number", account: "number",
  type: "account_type", "account type": "account_type", "loan type": "loan_type", opened: "opened", "date opened": "opened", balance: "balance", limit: "credit_limit",
  "credit limit": "credit_limit", "high balance": "high_balance", "past due": "past_due", status: "pay_status", "pay status": "pay_status", closed: "closed",
  "date closed": "closed", paid: "paid", "date paid": "paid", removal: "removal", "estimated removal": "removal", "original creditor": "original_creditor",
  history: "history", remarks: "remarks", terms: "terms", address: "address", updated: "updated", "date updated": "updated", dofd: "dofd", "date of first delinquency": "dofd" };
const BUREAU_WORDS = { transunion: "transunion", tu: "transunion", experian: "experian", ex: "experian", exp: "experian", equifax: "equifax", eq: "equifax", efx: "equifax" };
function split_rows(text) {
  text = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const first = text.split("\n")[0];
  const sep = (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? "\t" : ",";
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"' && cell === "") q = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}
function intake_history(text) {
  const out = [];
  for (const part of String(text || "").split(/[;|]/)) {
    const m = /^\s*(\d{4}-\d{2}|\d{2}\/\d{4})\s*[:=]\s*([A-Za-z0-9/]+)\s*$/.exec(part);
    if (m) out.push({ rating: m[2].toUpperCase(), bal: null, high: null, past_due: null, paid: null, due: null, remarks: [], month: parse_month(m[1]) });
  }
  return sortBy(out.filter((h) => h.month), (h) => [h.month]);
}
function intake_account(rec, warnings) {
  const a = new_account();
  a.section = "manual";
  for (const k of Object.keys(rec)) {
    const v = norm_space(rec[k]);
    if (["balance", "credit_limit", "high_balance", "past_due"].includes(k)) {
      a[k] = parse_money(v);
      if (v && a[k] === null) warnings.push({ account: rec.name || "", field: k, message: "Could not read the amount '" + v + "'." });
    } else if (["opened", "closed", "paid", "updated"].includes(k)) {
      a[k] = parse_date(v) || "";
      if (v && !a[k]) warnings.push({ account: rec.name || "", field: k, message: "Could not read the date '" + v + "'." });
    } else if (k === "removal" || k === "dofd") a[k] = parse_month(v) || "";
    else if (k === "history") a.history = intake_history(v);
    else if (k === "remarks") a.remarks = v.split(";").map(norm_space).filter((x) => x);
    else if (k === "terms") a.terms = parse_terms(v);
    else if (own(a, k) && typeof a[k] === "string") a[k] = v;
  }
  a.raw = {};
  for (const k of Object.keys(rec)) a.raw[k] = norm_space(rec[k]);
  // a status typed by hand that says late, charged off or in collection is adverse even without a grid
  a.pay_status_adverse = /PAST DUE|LATE|DELINQ|CHARGE|COLLECTION/i.test(a.pay_status || "");
  [a.kind, a.flags] = classify(a);
  a.confidence = account_confidence(a);
  return a;
}
function manual_report(bureau, records, report_date) {
  const key = norm_space(bureau).toLowerCase();
  const r = new_report(own(BUREAU_WORDS, key) ? BUREAU_WORDS[key] : "unknown");
  Object.assign(r.source, { kind: "manual", parser: "manual" });
  for (const rec of records) {
    if (!norm_space(rec.name || "")) throw new CreditError("input", "Every account needs a creditor name.");
    r.accounts.push(intake_account(rec, r.warnings));
  }
  tu_finish(r, report_date || "");
  r.source.report_date = r.source.report_date || report_date || "";
  return r;
}
function parse_csv(text, bureau, report_date) {
  bureau = bureau || "";
  const rows = split_rows(text);
  if (!rows.length) throw new CreditError("input", "The file is empty.");
  if (rows.length > MAX_ROWS + 1) throw new CreditError("input", "The file has more than " + commas(MAX_ROWS) + " rows.");
  const cols = rows[0].map((h) => { const k = norm_space(h).toLowerCase(); return own(INTAKE_COLUMNS, k) ? INTAKE_COLUMNS[k] : null; });
  if (!cols.includes("name")) throw new CreditError("input", "The first row must name the columns, with one called name or creditor.");
  const by = {};
  const bw = (s) => { const k = norm_space(s).toLowerCase(); return own(BUREAU_WORDS, k) ? BUREAU_WORDS[k] : null; };
  for (const row of rows.slice(1)) {
    const rec = {};
    cols.forEach((c, i) => { if (c && i < row.length) rec[c] = row[i]; });
    const given = own(rec, "bureau") ? rec.bureau : bureau;
    delete rec.bureau;
    const b = bw(given) || bw(bureau) || "unknown";
    if (!norm_space(rec.name || "")) continue;
    (by[b] = by[b] || []).push(rec);
  }
  const keys = Object.keys(by).sort();
  if (!keys.length) throw new CreditError("input", "No accounts were found under the header row.");
  return keys.map((b) => manual_report(b, by[b], report_date || ""));
}
const OUTCOME_WORDS = [["deleted", /\b(DELETED|REMOVED|HAS BEEN DELETED|WAS DELETED|NO LONGER APPEARS)\b/], ["updated", /\b(UPDATED|MODIFIED|CHANGED|CORRECTED|REVISED)\b/],
  ["verified", /\b(VERIFIED|REMAINS|NO CHANGE|ACCURATE AS REPORTED|VERIFIED AS ACCURATE|CONFIRMED)\b/]];
function parse_response(text, accounts) {
  const t = norm_space(String(text || "").toUpperCase().replace(/\n/g, " "));
  const nt = norm_name(t);
  let spots = [];
  for (const a of accounts) {
    const n = norm_name(a.name);
    if (!n) continue;
    const k = nt.indexOf(n);
    if (k >= 0) spots.push([k, a]);
  }
  spots = sortBy(spots, (x) => [x[0], x[1].id]);
  const items = [];
  spots.forEach(([k, a], i) => {
    const end = i + 1 < spots.length ? spots[i + 1][0] : Math.min(nt.length, k + 600);
    const win = nt.slice(k, end);
    let best = null;
    for (const [outcome, pat] of OUTCOME_WORDS) { const m = pat.exec(win); if (m && (best === null || m.index < best[1])) best = [outcome, m.index]; }
    if (best) items.push({ account_id: a.id, name: a.name, outcome: best[0], evidence: win.slice(Math.max(0, best[1] - 60), best[1] + 40).trim() });
  });
  const dm = /\b(\d{2}\/\d{2}\/\d{4})\b/.exec(t);
  return { items, frivolous: /FRIVOLOUS|IRRELEVANT/.test(t), reinsertion: /REINSERT/.test(t), date: dm ? parse_date(dm[1]) : "" };
}

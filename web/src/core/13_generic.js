// ---------------------------------------------------------------- template reader for labeled-field reports; Experian and Equifax templates
// Twin of src/errata/generic.py; see its notes. The templates were written from the bureaus' general
// descriptions of their reports, without any real Experian or Equifax report, so the reader is
// forgiving and says so: raw text kept, warnings for anything it cannot place, a lower confidence.
const G_MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const G_CODE = { OK: "OK", "✓": "OK", C: "C", CO: "CO", "C/O": "CO", X: "X", "-": "X", "--": "X", ND: "X", "N/R": "X", NR: "X",
  "30": "30", "60": "60", "90": "90", "120": "120", "150": "150", "180": "180", CLS: "X", "*": "OK", E: "OK", "0": "OK",
  "1": "30", "2": "60", "3": "90", "4": "120", "5": "150", "6": "180", "7": "C", "8": "CO", "9": "CO", G: "C", H: "C", J: "C", K: "C", L: "CO" };
const G_CODE_VALUES = new Set(Object.values(G_CODE));
const G_COMMON = {
  "account name": "name", "creditor name": "name", "account number": "number", "account #": "number",
  "original creditor": "original_creditor", "account type": "account_type", "loan type": "loan_type", "loan/account type": "loan_type",
  "date opened": "opened", opened: "opened", "date closed": "closed", "date paid": "paid", status: "pay_status",
  "account status": "pay_status", "payment status": "pay_status", balance: "balance", "current balance": "balance",
  "credit limit": "credit_limit", "high credit": "high_balance", "highest balance": "high_balance", "high balance": "high_balance",
  "original amount": "high_balance", "past due": "past_due", "amount past due": "past_due", "monthly payment": "monthly_payment",
  "scheduled payment amount": "monthly_payment", terms: "terms", responsibility: "responsibility", owner: "responsibility",
  "date reported": "updated", "status updated": "updated", "balance updated": "updated", "date updated": "updated",
  "date of last payment": "last_payment", "last payment date": "last_payment", "recent payment": "payment_received",
  "date of first delinquency": "dofd", "first delinquency": "dofd", "on record until": "removal", "estimated removal": "removal",
  comments: "remarks", remarks: "remarks", "narrative code": "remarks", address: "address", phone: "phone", "phone number": "phone",
};
const G_TEMPLATES = {
  // used only for saved web pages (14_html.js); TransUnion PDFs have their own reader
  transunion: {
    name: "TransUnion", detect: /\bTransUnion\b/, parser: "transunion-template-1",
    report_date: [/Report (?:date|created)[: ]+(\d{2}\/\d{2}\/\d{4})/i, /Date (?:of|created)[: ]+(\d{2}\/\d{2}\/\d{4})/i],
    file_number: [/File number[: ]+([A-Z0-9-]+)/i],
    headings: { "personal information": "personal", accounts: "accounts", "adverse accounts": "accounts", "satisfactory accounts": "accounts",
      "account information": "accounts", collections: "collections", "collection accounts": "collections", "public records": "public",
      "regular inquiries": "inq_hard", "hard inquiries": "inq_hard", inquiries: "inq_hard", "promotional inquiries": "inq_review",
      "account review inquiries": "inq_review", "soft inquiries": "inq_review", "consumer statements": "statements",
      "consumer statement": "statements", "additional information": "end", "contact information": "end" },
    personal: { name: "name", "also known as": "aka", "other names": "aka", "current address": "address", address: "address",
      "other addresses": "address", "previous address": "address", "previous addresses": "address", "date of birth": "dob",
      "social security number": "ssn", ssn: "ssn", "telephone numbers": "phone", telephone: "phone", phone: "phone",
      "phone numbers": "phone", employer: "employer", "employment data": "employer", employers: "employer" },
    fields: { "pay status": "pay_status", "date updated": "updated", "estimated month and year this item will be removed": "removal",
      "estimated removal date": "removal", "loan type": "loan_type", remarks: "remarks", terms: "terms" },
  },
  experian: {
    name: "Experian", detect: /\bExperian\b/, parser: "experian-template-1",
    report_date: [/Report (?:date|generated)[: ]+(\d{2}\/\d{2}\/\d{4})/i, /Prepared (?:on|for [^\n]*? on)[: ]+(\d{2}\/\d{2}\/\d{4})/i],
    file_number: [/Report number[: ]+([A-Z0-9-]+)/i],
    headings: { "personal information": "personal", accounts: "accounts", "adverse accounts": "accounts", "accounts in good standing": "accounts",
      "collection accounts": "collections", collections: "collections", "public records": "public", "hard inquiries": "inq_hard",
      "soft inquiries": "inq_review", "inquiries shared with others": "inq_hard", "inquiries shared only with you": "inq_review",
      "personal statements": "statements", "contact us": "end", "know your rights": "end" },
    personal: { name: "name", names: "aka", "also known as": "aka", "other names": "aka", address: "address", "current address": "address",
      "previous address": "address", "other addresses": "address", "year of birth": "dob", "date of birth": "dob",
      "social security number": "ssn", "phone number": "phone", "phone numbers": "phone", employer: "employer", employers: "employer" },
    fields: { "company sold": "remarks", "sold to": "remarks", "status details": "remarks" },
  },
  equifax: {
    name: "Equifax", detect: /\bEquifax\b/, parser: "equifax-template-1",
    report_date: [/Report Date[: ]+(\d{2}\/\d{2}\/\d{4})/i, /Date(?: of)? Report[: ]+(\d{2}\/\d{2}\/\d{4})/i],
    file_number: [/Confirmation (?:Number|#)[: ]+([A-Z0-9-]+)/i],
    headings: { "personal information": "personal", "revolving accounts": "accounts", "mortgage accounts": "accounts",
      "installment accounts": "accounts", "other accounts": "accounts", "credit accounts": "accounts", "consumer finance accounts": "accounts",
      collections: "collections", "public records": "public", "hard inquiries": "inq_hard", "soft inquiries": "inq_review",
      inquiries: "inq_hard", "dispute file information": "end", "consumer statements": "statements" },
    personal: { name: "name", "formerly known as": "aka", "also known as": "aka", "current address": "address", "previous address": "address",
      address: "address", "date of birth": "dob", "social security number": "ssn", phone: "phone", telephone: "phone",
      employer: "employer", "employment history": "employer" },
    fields: { "creditor classification": "loan_type", "activity designator": "remarks", "terms duration": "terms", "terms frequency": "terms",
      "charge off amount": "charge_off", "deferred payment start date": "skip", "balloon payment amount": "skip", "months reviewed": "skip",
      "date major delinquency first reported": "dofd", "credit limit / high credit": "credit_limit" },
  },
};
const G_MONEY = new Set(["balance", "credit_limit", "high_balance", "past_due", "monthly_payment", "payment_received", "charge_off"]);
const G_DATES = new Set(["opened", "closed", "paid", "updated", "last_payment"]);
const G_MONTHS_ONLY = new Set(["dofd", "removal"]);
const G_IGNORE = /^(payment history|account history|\d+-month payment history|year|account details|contact information)$/i;
const G_SECTION_TYPE = { "revolving accounts": "Revolving", "installment accounts": "Installment", "mortgage accounts": "Mortgage", "other accounts": "Open", "consumer finance accounts": "Installment" };
const G_TYPE_WORDS = [[/CREDIT CARD|CHARGE CARD|REVOLVING|LINE OF CREDIT|FLEXIBLE SPENDING/i, "Revolving"], [/MORTGAGE|HOME EQUITY LOAN|REAL ESTATE/i, "Mortgage"],
  [/AUTO|STUDENT|INSTALLMENT|PERSONAL LOAN|CONSUMER LOAN|LEASE|SECURED LOAN/i, "Installment"], [/COLLECTION/i, "Collection"], [/OPEN|UTILITY|TELECOM/i, "Open"]];
const G_COLLECTION_WORD = /COLLECTION|FACTORING|DEBT BUYER/i;
const G_DATE_RE = /\b(\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\/\d{4})\b/;
const G_NONE = new Set(["-", "--", "None", "N/A"]);
function generic_detect(items) {
  const head = (items || []).slice(0, 120).map((i) => String(i.s === undefined || i.s === null ? "" : i.s)).join(" ");
  if (/TransUnion Credit Report/.test(head)) return null;
  for (const b of ["experian", "equifax"]) if (G_TEMPLATES[b].detect.test(head)) return b;
  return null;
}
function g_label(s, labels) { const k = norm_space(s).replace(/:+$/, "").toLowerCase(); return own(labels, k) ? labels[k] : null; }
function g_date(v) {
  v = norm_space(v);
  const d = parse_date(v);
  if (d) return d;
  const m = /^(\d{1,2})\/(\d{4})$/.exec(v);
  if (m) return m[2] + "-" + pad2(+m[1]) + "-01";
  return parse_date(v) || "";
}
function g_set(a, key, raw, warnings) {
  const v = norm_space(raw);
  if (!v || key === "skip") return;
  a.raw[key] = own(a.raw, key) ? a.raw[key] + "; " + v : v;
  if (G_MONEY.has(key)) {
    if (key === "charge_off") { a.remarks.push("Charge off amount " + v); return; }
    if (["-", "--", "---", "None", "N/A"].includes(v)) return;
    const m = parse_money(v);
    if (m === null) warnings.push({ account: a.name, field: key, raw: v, value: "", conf: 50, message: "Could not read the amount '" + v + "'." });
    else a[key] = m;
  } else if (G_DATES.has(key)) {
    const d = g_date(v);
    if (!d && !G_NONE.has(v)) warnings.push({ account: a.name, field: key, raw: v, value: "", conf: 50, message: "Could not read the date '" + v + "'." });
    a[key] = d || a[key] || "";
  } else if (G_MONTHS_ONLY.has(key)) {
    a[key] = parse_month(v) || (g_date(v) ? g_date(v).slice(0, 7) : "");
    if (!a[key] && !G_NONE.has(v)) warnings.push({ account: a.name, field: key, raw: v, value: "", conf: 50, message: "Could not read the month '" + v + "'." });
  } else if (key === "terms") {
    const prev = a.terms.text;
    a.terms = parse_terms(prev ? (prev + " " + v).trim() : v);
  } else if (key === "remarks") {
    for (const part of v.split(/;\s*/)) if (part) a.remarks.push(part);
  } else if (key === "pay_status") {
    const [s, adv] = strip_marks(v);
    a.pay_status = s;
    a.pay_status_adverse = adv || /PAST DUE|LATE|DELINQ|CHARGE|COLLECTION/i.test(s);
  } else if (own(a, key) && typeof a[key] === "string") a[key] = v;
}
function g_code(s) { const t = norm_space(s).toUpperCase(); return own(G_CODE, t) ? G_CODE[t] : G_CODE_VALUES.has(t) ? t : null; }
function g_history_row(cells, anchors) {
  if (!cells.length || !/^(19|20)\d{2}$/.test(cells[0].s)) return null;
  const year = cells[0].s, rest = cells.slice(1), out = [];
  if (rest.length > 12) return null;
  for (let i = 0; i < rest.length; i++) {
    const code = g_code(rest[i].s);
    if (code === null) return null;
    const mi = anchors ? nearest(rest[i].x, anchors) : i;
    out.push({ month: year + "-" + pad2(mi + 1), rating: code, bal: null, high: null, past_due: null, paid: null, due: null, remarks: [] });
  }
  return out;
}
function g_month_header(cells) {
  const names = cells.map((c) => norm_space(c.s).toUpperCase().slice(0, 3));
  if (names.length >= 6 && names.every((n) => G_MONTHS.includes(n))) return [names.map((n) => G_MONTHS.indexOf(n)), cells.map((c) => c.x)];
  if (names.length >= 7 && norm_space(cells[0].s).toUpperCase() === "YEAR" && names.slice(1).every((n) => G_MONTHS.includes(n))) return [names.slice(1).map((n) => G_MONTHS.indexOf(n)), cells.slice(1).map((c) => c.x)];
  return null;
}
function g_types(a, hint) {
  const printed = a.account_type;
  if (printed && !/^(Revolving|Installment|Mortgage|Open|Collection)( Account)?$/i.test(printed)) { a.loan_type = a.loan_type || printed; a.account_type = ""; }
  if (!a.account_type) {
    let kind = hint;
    for (const [rx, k] of G_TYPE_WORDS) if (!kind && (rx.test(a.loan_type) || rx.test(printed))) kind = k;
    if (a.section === "collections") { kind = "Collection"; a.loan_type = G_COLLECTION_WORD.test(a.loan_type) ? a.loan_type : "Collection"; }
    a.account_type = kind && kind !== "Collection" ? kind + " Account" : a.account_type;
  }
}
function g_set_personal(r, key, val) {
  const v = norm_space(val);
  if (!v) return;
  const p = r.personal;
  if (key === "name") { if (!p.names.some((n) => n.kind === "primary")) p.names.unshift({ name: v, kind: "primary" }); else p.names.push({ name: v, kind: "aka" }); }
  else if (key === "aka") { for (const part of v.split(/;\s*/)) p.names.push({ name: part, kind: "aka" }); }
  else if (key === "address") {
    const dm = G_DATE_RE.exec(v);
    const text = norm_space(v.replace(new RegExp(G_DATE_RE.source, "g"), "").split("Reported").join("").split("reported").join(""));
    p.addresses.push({ text, kind: p.addresses.length ? "previous" : "current", reported: dm ? g_date(dm[1]) : "" });
  } else if (key === "dob") p.dob = g_date(v) || (/^\d{4}$/.test(v) ? v : "");
  else if (key === "ssn") { p.ssn_masked = v; const m = /(\d{4})\s*$/.exec(v); p.ssn_last4 = m ? m[1] : ""; }
  else if (key === "phone") { for (const part of v.split(/;\s*/)) p.phones.push({ number: part }); }
  else if (key === "employer") p.employers.push({ name: v, occupation: "", location: "", verified: "" });
}
function generic_parse(items, report_date, bureau) {
  bureau = bureau || generic_detect(items);
  if (!own(G_TEMPLATES, bureau || "")) throw new CreditError("parse", "This does not look like an Experian or Equifax report.");
  const t = G_TEMPLATES[bureau], labels = Object.assign({}, G_COMMON, t.fields);
  const r = new_report(bureau);
  Object.assign(r.source, { kind: "pdf", parser: t.parser, pages: items && items.length ? Math.max.apply(null, items.map((i) => Math.trunc(Number(i.p || 0)))) + 1 : 0 });
  const lines = make_lines(items);
  const alltext = lines.slice(0, 200).map((l) => l.text).join("\n");
  for (const pat of t.report_date) { const m = pat.exec(alltext); if (m) { r.source.report_date = parse_date(m[1]) || ""; break; } }
  for (const pat of t.file_number) { const m = pat.exec(alltext); if (m) { r.source.file_number = m[1]; break; } }
  let section = "intro", acct = null, anchors = null, pending = null, unknown = 0, type_hint = "";
  for (const ln of lines) {
    const text = norm_space(ln.text), low = text.toLowerCase().replace(/:+$/, "");
    if (own(t.headings, low)) { section = t.headings[low]; type_hint = own(G_SECTION_TYPE, low) ? G_SECTION_TYPE[low] : ""; acct = null; anchors = null; pending = null; continue; }
    const cells = ln.cells;
    if (["intro", "end", "public", "statements"].includes(section)) { if (section === "statements" && text) r.statements.push(text); continue; }
    if (section === "personal") {
      let i = 0;
      while (i < cells.length) {
        const k0 = norm_space(cells[i].s).replace(/:+$/, "").toLowerCase();
        const key = own(t.personal, k0) ? t.personal[k0] : null;
        const inline = /^([^:]{2,40}):\s*(.+)$/.exec(cells[i].s);
        if (key && i + 1 < cells.length) { g_set_personal(r, key, cells[i + 1].s); i += 2; continue; }
        if (inline) { const k1 = inline[1].trim().toLowerCase(); if (own(t.personal, k1)) g_set_personal(r, t.personal[k1], inline[2]); }
        i++;
      }
      continue;
    }
    if (section.startsWith("inq")) {
      const dm = G_DATE_RE.exec(text), name = norm_space(text.replace(new RegExp(G_DATE_RE.source, "g"), ""));
      if (dm && name && !g_label(name, labels)) {
        const d = g_date(dm[1]), kind = section === "inq_hard" ? "hard" : "review";
        const q = r.inquiries.find((x) => x.name === name && x.kind === kind);
        if (q) q.dates.push(d); else r.inquiries.push({ kind, name, dates: [d], location: "", phone: "", inquiry_type: "", purpose: "" });
      }
      continue;
    }
    const hdr = g_month_header(cells);
    if (hdr) { anchors = hdr[1]; continue; }
    if (acct !== null) { const row = g_history_row(cells, anchors); if (row !== null) { acct.history.push(...row); continue; } }
    if (pending !== null) {
      for (const c of cells) { const k = column_of(c.x, pending.map((x) => x[0]), 6); g_set(acct, pending[k][1], c.s, r.warnings); }
      pending = null;
      continue;
    }
    const keys = cells.map((c) => g_label(c.s, labels));
    if (acct !== null && cells.length >= 2 && keys.every((k) => k)) { pending = cells.map((c, i) => [c.x, keys[i]]); continue; }
    if (cells.length === 1 && !keys[0] && /^[A-Z0-9][A-Z0-9 &'.,/\-]{2,}$/.test(cells[0].s) && !/^[\d/$,.\s-]+$/.test(cells[0].s)) {
      acct = new_account();
      acct.name = norm_space(cells[0].s);
      acct.section = section === "collections" ? "collections" : "accounts";
      acct.raw.section_type = type_hint;
      if (section === "collections") acct.loan_type = "Collection";
      r.accounts.push(acct);
      anchors = null;
      continue;
    }
    if (acct === null || G_IGNORE.test(text)) continue;
    let i = 0, placed = false;
    while (i < cells.length) {
      const k = keys[i], inline = /^([^:]{2,40}):\s*(.*)$/.exec(cells[i].s);
      if (k && i + 1 < cells.length && !keys[i + 1]) { g_set(acct, k, cells[i + 1].s, r.warnings); i += 2; placed = true; continue; }
      if (inline && g_label(inline[1], labels)) { g_set(acct, g_label(inline[1], labels), inline[2], r.warnings); placed = true; }
      i++;
    }
    if (!placed) unknown++;
  }
  for (const a of r.accounts) {
    const seen = {};
    for (const h of a.history.slice().sort((x, y) => (x.month < y.month ? -1 : x.month > y.month ? 1 : 0))) seen[h.month] = h;
    a.history = Object.keys(seen).sort().map((m) => seen[m]);
    const hint = a.raw.section_type || "";
    delete a.raw.section_type;
    g_types(a, hint);
    const cf = classify(a);
    a.kind = cf[0]; a.flags = cf[1];
    a.confidence = account_confidence(a);
  }
  if (unknown) r.messages.push(unknown + " line(s) in the account sections were not recognized; check the accounts against the report.");
  tu_finish(r, report_date || "");
  if (unknown) r.source.confidence = Math.max(0, r.source.confidence - Math.min(15, unknown));
  return r;
}
// Which reader: the TransUnion reader for its layout, the templates for Experian and Equifax.
function detect_bureau(items) { return generic_detect(items) || tu_detect(items); }
function parse_items(items, report_date) {
  const b = detect_bureau(items);
  if (b === "transunion") return tu_parse(items, report_date);
  if (b === "experian" || b === "equifax") return generic_parse(items, report_date, b);
  throw new CreditError("parse", "This does not look like a TransUnion, Experian or Equifax report.");
}

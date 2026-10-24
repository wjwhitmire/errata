// ---------------------------------------------------------------- TransUnion parser (twin of tu.py; see its notes on the layout)
const TU_PARSER = "transunion-2026";
const TU_HEADINGS = {
  "personal information": "personal", "also known as": "personal", addresses: "personal", "phone numbers": "personal", employers: "employers",
  accounts: "intro", "payment/remarks key": "intro", ratings: "intro", "accounts with adverse information": "adverse",
  "satisfactory accounts": "satisfactory", inquiries: "intro", "regular inquiries": "inq_hard", "promotional inquiries": "inq_promo",
  "account review inquiries": "inq_review", "credit report messages": "messages", "additional information": "intro", "public records": "public",
  "consumer statement": "statements", "consumer statements": "statements",
  "checking account and demand deposit account (dda) activity": "specialty", "supplemental consumer credit information": "specialty",
  "should you wish to contact transunion, you may do so": "contact", "summary of rights": "rights",
};
const FIELD_LABELS = {
  Address: "address", Phone: "phone", "Monthly Payment": "monthly_payment", "Date Opened": "opened", Responsibility: "responsibility",
  "Account Type": "account_type", "Loan Type": "loan_type", Balance: "balance", "Date Updated": "updated", "Payment Received": "payment_received",
  "Last Payment Made": "last_payment", "Original Creditor": "original_creditor", "Pay Status": "pay_status", Terms: "terms", "Date Closed": "closed",
  "Date Paid": "paid", "High Balance": "high_balance", "High Balance (Hist.)": "high_balance_hist", "Credit Limit": "credit_limit",
  "Credit Limit (Hist.)": "credit_limit_hist", "Maximum Delinquency Note": "max_delinquency",
  "Estimated month and year this item will be removed": "removal", Remarks: "remarks", "Past Due": "past_due",
  "Date of First Delinquency": "dofd", "Date Placed for Collection": "placed",
};
const MONEY_FIELDS = new Set(["monthly_payment", "balance", "payment_received", "high_balance", "credit_limit", "past_due"]);
const DATE_FIELDS = new Set(["opened", "updated", "last_payment", "closed", "paid", "placed"]);
const PERSONAL_KEYS = new Set(["Credit Report Date", "Social Security Number", "Date of Birth", "Name", "AKA", "Current Address", "Other Address", "Date Reported", "Phone Number"]);
const INQ_LABELS = new Set(["Name", "Requested On", "Location", "Phone", "Inquiry Type", "Permissible Purpose"]);
const MONTH_CELL = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}$/;
const DATE_CELL = /^\d{2}\/\d{2}\/\d{4}$/;
function tu_heading(line) {
  const t = norm_space(line.text).toLowerCase();
  return line.cells.length === 1 && own(TU_HEADINGS, t) ? t : null;
}
function is_label_line(line, labels) { return line.cells.length > 0 && line.cells.every((c) => (labels instanceof Set ? labels.has(c.s) : own(labels, c.s))); }
function strip_marks(s) {
  const t = norm_space(s);
  const adverse = />[^<>]*</.test(t);
  return [norm_space(t.replace(/[<>]/g, "")), adverse];
}
function tu_detect(items) {
  const head = (items || []).slice(0, 80).map((i) => String(i.s === undefined ? "" : i.s)).join(" ");
  return /TransUnion Credit Report|TransUnion/.test(head) ? "transunion" : null;
}
function cap(s) { return s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s; }
const TERM_AMOUNT = /\$([0-9][0-9,]*)(?:\.\d{2})?\s*(?:per\s+month|a\s+month|\/\s*mo(?:nth)?\b|monthly\b)/i;
const TERM_MONTHS = /(?:for\s+)?(?<![$\d,.])(\d{1,3})\s*(?:months?\b|month\(s\)|mos?\b\.?)/i;
const TERM_FREQ = /\b(Monthly|Weekly|Bi-?weekly|Semi-?monthly|Quarterly|Annually|Yearly)\b/i;
function parse_terms(text) {
  const t = norm_space(text);
  const m = TERM_AMOUNT.exec(t), n = TERM_MONTHS.exec(t);
  let months = n ? parseInt(n[1], 10) : null;
  if (months === null && /^\d{1,3}$/.test(t) && +t >= 1 && +t <= 480) months = +t;
  const f = /paid\s+(Monthly|Weekly|Biweekly|Bi-weekly|Semimonthly|Quarterly|Annually|Yearly)/i.exec(t) || TERM_FREQ.exec(t);
  let amount = m ? parse_money(m[1]) : null;
  if (amount === null) {
    const bare = /^\$([0-9][0-9,]*)(?:\.\d{2})?(?:\s|$|\/)/.exec(t);
    if (bare && (months || f)) amount = parse_money(bare[1]);
  }
  return { text: t, amount, months: months && months <= 480 ? months : null, frequency: f ? cap(f[1]) : "" };
}
function parse_max_delinquency(text) {
  const t = norm_space(text);
  const m = /of\s+(\d+)\s+days/i.exec(t);
  const entries = [];
  for (const e of t.matchAll(/in\s+(\d{2}\/\d{4})(?:\s+for\s+\$([0-9][0-9,]*))?/g)) entries.push({ month: parse_month(e[1]), amount: e[2] ? parse_money(e[2]) : null });
  return { text: t, days: m ? parseInt(m[1], 10) : null, entries };
}
function parse_hist_ranges(text) {
  const out = [];
  for (const m of norm_space(text).matchAll(/\$([0-9][0-9,]*)(?:\s+from\s+(\d{2}\/\d{4})\s+to\s+(\d{2}\/\d{4}))?/g)) {
    out.push({ amount: parse_money(m[1]), start: m[2] ? parse_month(m[2]) : "", end: m[3] ? parse_month(m[3]) : "" });
  }
  return out;
}
function latest_amount(text) {
  const r = parse_hist_ranges(text);
  if (!r.length) return null;
  return sortBy(r, (x) => [x.end || "", x.start || ""])[r.length - 1].amount;
}
function tu_set_field(a, key, raw, warnings) {
  raw = norm_space(raw);
  if (/^[-\s]+$/.test(raw || "x")) raw = "---";
  a.raw[key] = raw;
  if (MONEY_FIELDS.has(key)) {
    const v = strip_marks(raw)[0];
    a[key] = parse_money(v);
    if (raw && raw !== "---" && a[key] === null) warnings.push({ account: a.name, field: key, message: "Could not read the amount '" + raw + "'." });
  } else if (DATE_FIELDS.has(key)) {
    const v = strip_marks(raw)[0];
    a[key] = parse_date(v) || "";
    if (v && v !== "---" && !a[key]) warnings.push({ account: a.name, field: key, message: "Could not read the date '" + raw + "'." });
  } else if (key === "removal" || key === "dofd") a[key] = parse_month(strip_marks(raw)[0]) || "";
  else if (key === "pay_status") { const [v, adv] = strip_marks(raw); a.pay_status = v; a.pay_status_adverse = adv; }
  else if (key === "terms") a.terms = parse_terms(raw);
  else if (key === "max_delinquency") a.max_delinquency = parse_max_delinquency(raw);
  else if (key === "remarks") a.remarks = raw.split(";").map((p) => strip_marks(p)[0]).filter((p) => p && p !== "---");
  else if (key === "high_balance_hist" || key === "credit_limit_hist") a[key] = raw;
  else a[key] = raw === "---" ? "" : raw;
}
function tu_parse_cell(texts) {
  const cell = { rating: "", bal: null, high: null, past_due: null, paid: null, due: null, remarks: [] };
  for (let t of texts) {
    t = norm_space(t);
    const m = /^(Bal|High|Past Due|Paid|Due|Limit):\s*(.*)$/.exec(t);
    if (m) {
      const key = { Bal: "bal", High: "high", "Past Due": "past_due", Paid: "paid", Due: "due", Limit: "limit" }[m[1]];
      if (key === "limit") continue;
      cell[key] = parse_money(m[2]);
      continue;
    }
    for (const tok of t.split(" ")) {
      const [v, adv] = strip_marks(tok);
      if (adv || (v && !RATINGS.has(v.toUpperCase()))) { if (v) cell.remarks.push(v); }
      else if (v) cell.rating = v.toUpperCase();
    }
  }
  return cell;
}
function tu_stop_line(ln) {
  if (tu_heading(ln)) return true;
  if (ln.text.startsWith("Account Name") || is_label_line(ln, FIELD_LABELS)) return true;
  if (ln.cells.length === 2 && ln.cells[0].s === "Name") return true;
  return false;
}
const isMonthLine = (ln) => ln.cells.every((c) => MONTH_CELL.test(c.s));
function tu_parse_grid(lines, i, a) {
  const n = lines.length, cells = {};
  while (i < n) {
    const ln = lines[i];
    if (tu_stop_line(ln)) break;
    if (isMonthLine(ln)) {
      const anchors = ln.cells.map((c) => c.x), months = ln.cells.map((c) => parse_month(c.s));
      const cols = anchors.map(() => []);
      i++;
      while (i < n && !tu_stop_line(lines[i]) && !isMonthLine(lines[i])) {
        const parts = anchors.map(() => []);
        for (const it of lines[i].items) parts[nearest(it.x, anchors)].push(it);
        parts.forEach((p, k) => { if (p.length) cols[k].push(make_cells(p).map((c) => c.s).join(" ")); });
        i++;
      }
      months.forEach((mo, k) => { if (mo) { const c = tu_parse_cell(cols[k]); c.month = mo; cells[mo] = c; } });
      continue;
    }
    i++;
  }
  a.history = Object.keys(cells).sort().map((k) => cells[k]);
  return i;
}
function tu_parse_card(lines, i, section, report) {
  const warnings = report.warnings, head = lines[i];
  const num_x = head.cells.length > 1 ? head.cells[1].x : 1e6;
  const a = new_account();
  a.section = section;
  i++;
  if (i < lines.length) { const nc = split_columns(lines[i], [head.cells[0].x, num_x], 6.0); a.name = nc[0]; a.number = nc[1]; i++; }
  let anchors = null, keys = null;
  const buf = {}, order = [];
  while (i < lines.length) {
    const ln = lines[i];
    if (ln.text.startsWith("Account Name") || tu_heading(ln)) break;
    if (ln.text === "Payment History") { i = tu_parse_grid(lines, i + 1, a); break; }
    if (is_label_line(ln, FIELD_LABELS)) {
      anchors = ln.cells.map((c) => c.x);
      keys = ln.cells.map((c) => FIELD_LABELS[c.s]);
      for (const k of keys) if (!own(buf, k)) { buf[k] = []; order.push(k); }
      i++;
      continue;
    }
    if (anchors === null) { warnings.push({ account: a.name, field: "", message: "Unplaced text in account card: " + ln.text.slice(0, 80) }); i++; continue; }
    const vals = split_columns(ln, anchors, 6.0);
    keys.forEach((k, j) => { if (vals[j]) buf[k].push(vals[j]); });
    i++;
  }
  for (const k of order) tu_set_field(a, k, buf[k].join(" "), warnings);
  if (a.credit_limit === null && a.credit_limit_hist) a.credit_limit = latest_amount(a.credit_limit_hist);
  if (a.high_balance === null && a.high_balance_hist) {
    const am = parse_hist_ranges(a.high_balance_hist).map((x) => x.amount).filter((x) => x !== null);
    a.high_balance = am.length ? Math.max(...am) : null;
  }
  [a.kind, a.flags] = classify(a);
  a.confidence = account_confidence(a);
  return [a, i];
}
function account_confidence(a) {
  let score = 100;
  for (const [k, pts] of [["name", 30], ["opened", 15], ["pay_status", 15], ["account_type", 10]]) if (!a[k]) score -= pts;
  if (a.balance === null || a.balance === undefined) score -= 10;
  const hist = a.history || [];
  if (hist.length) {
    const idx = hist.map((h) => month_index(h.month));
    if (Math.max(...idx) - Math.min(...idx) + 1 !== idx.length) score -= 5;
    if (hist.some((h) => !h.rating && h.bal === null)) score -= 5;
  }
  return Math.max(0, score);
}
const INQ_FIELD = { Location: "location", Phone: "phone", "Inquiry Type": "inquiry_type", "Permissible Purpose": "purpose", Name: "name", "Requested On": "requested" };
function tu_parse_inquiries(lines, i, kind, report) {
  let req_x = null, anchors = null, keys = null, cur = null;
  while (i < lines.length) {
    const ln = lines[i];
    if (tu_heading(ln)) break;
    const cells = ln.cells;
    if (is_label_line(ln, INQ_LABELS)) {
      if (cells.length === 2 && cells[0].s === "Name" && cells[1].s === "Requested On") req_x = cells[1].x;
      else { anchors = cells.map((c) => c.x); keys = cells.map((c) => c.s); }
      i++;
      continue;
    }
    if (req_x === null) { i++; continue; }
    const right = cells.filter((c) => c.x >= req_x - 8), left = cells.filter((c) => c.x < req_x - 8);
    if (right.length && right.every((c) => DATE_CELL.test(c.s)) && left.length) {
      cur = { name: left.map((c) => c.s).join(" "), dates: right.map((c) => parse_date(c.s)), kind, location: "", phone: "", inquiry_type: "", purpose: "" };
      report.inquiries.push(cur);
      anchors = null; keys = null;
    } else if (right.length && !left.length && right.every((c) => DATE_CELL.test(c.s)) && cur) {
      for (const c of right) cur.dates.push(parse_date(c.s));
    } else if (cur && anchors) {
      const vals = split_columns(ln, anchors, 6.0);
      keys.forEach((k, j) => {
        const v = vals[j];
        if (!v) return;
        const f = INQ_FIELD[k];
        if (f === "requested") return;
        cur[f] = norm_space((cur[f] || "") + " " + v);
      });
    }
    i++;
  }
  return i;
}
function tu_parse_specialty(lines, i, report) {
  const block = { source: "", requested_by: "", requested_on: "", fields: {} };
  report.specialty.push(block);
  let anchors = null, keys = null, expect = false;
  while (i < lines.length) {
    const ln = lines[i];
    if (tu_heading(ln)) break;
    const cells = ln.cells;
    if (ln.text.trim() === "Data Source:") { expect = true; i++; continue; }
    if (expect) { block.source = ln.text; expect = false; i++; continue; }
    if (cells.length && cells.every((c) => c.s.endsWith(":"))) { anchors = cells.map((c) => c.x); keys = cells.map((c) => c.s.slice(0, -1)); i++; continue; }
    if (anchors) {
      const vals = split_columns(ln, anchors, 6.0);
      keys.forEach((k, j) => {
        const v = vals[j];
        if (k === "Requested by") block.requested_by = v;
        else if (k === "Requested on") block.requested_on = parse_date(v) || v;
        else block.fields[k] = v;
      });
      anchors = null;
    }
    i++;
  }
  return i;
}
function tu_parse(items, report_date) {
  const lines = make_lines(items);
  const r = new_report("transunion");
  const pages = (items || []).reduce((m, it) => Math.max(m, +it.p || 0), -1) + 1;
  Object.assign(r.source, { kind: "pdf", parser: TU_PARSER, pages });
  let section = "header", i = 0, pending = null, last_personal = null, emp_anchors = null, emp_label_anchors = null, emp_label_keys = null;
  const n = lines.length;
  while (i < n) {
    const ln = lines[i];
    const h = tu_heading(ln);
    if (h) {
      section = TU_HEADINGS[h];
      i++;
      if (section === "inq_hard" || section === "inq_promo" || section === "inq_review") {
        i = tu_parse_inquiries(lines, i, { inq_hard: "hard", inq_promo: "promotional", inq_review: "review" }[section], r);
      } else if (section === "specialty") i = tu_parse_specialty(lines, i, r);
      continue;
    }
    const t = ln.text, cells = ln.cells;
    if (section === "header") {
      if (pending) {
        if (pending === "file") r.source.file_number = t;
        else if (pending === "date") r.source.report_date = parse_date(t) || "";
        else if (pending === "for") r.personal.report_for = t;
        pending = null;
      } else if (t.startsWith("File Number")) {
        const v = t.split(":").slice(1).join(":").trim();
        if (v) r.source.file_number = v; else pending = "file";
      } else if (t.startsWith("Date Created")) {
        const v = t.split(":").slice(1).join(":").trim();
        if (v) r.source.report_date = parse_date(v) || ""; else pending = "date";
      } else if (t.startsWith("Personal Credit Report for")) pending = "for";
      i++;
      continue;
    }
    if (section === "personal") {
      const m = /on our files since (\d{2}\/\d{2}\/\d{4})/.exec(t);
      if (m) r.personal.on_file_since = parse_date(m[1]) || "";
      if (cells.length >= 2 && PERSONAL_KEYS.has(cells[0].s)) last_personal = tu_set_personal(r, cells[0].s, cells.slice(1).map((c) => c.s).join(" "));
      else if (cells.length === 1 && last_personal && cells[0].x > 100) last_personal.text = norm_space(last_personal.text + " " + cells[0].s);
      i++;
      continue;
    }
    if (section === "employers") {
      if (cells.length === 2 && cells[0].s === "Employer" && cells[1].s === "Occupation") { emp_anchors = [cells[0].x, cells[1].x]; i++; continue; }
      if (cells.length && cells.every((c) => ["Date Verified", "Location", "Date Reported"].includes(c.s))) {
        emp_label_anchors = cells.map((c) => c.x); emp_label_keys = cells.map((c) => c.s); i++; continue;
      }
      if (emp_label_anchors && r.personal.employers.length) {
        const e = r.personal.employers[r.personal.employers.length - 1];
        const vals = split_columns(ln, emp_label_anchors, 6.0);
        emp_label_keys.forEach((k, j) => {
          if (k === "Date Verified" || k === "Date Reported") e.verified = parse_date(vals[j]) || vals[j];
          else if (k === "Location") e.location = vals[j];
        });
        emp_label_anchors = null;
      } else if (emp_anchors) {
        const cols = split_columns(ln, emp_anchors, 6.0);
        r.personal.employers.push({ name: cols[0], occupation: cols[1] !== "---" ? cols[1] : "", location: "", verified: "" });
      }
      i++;
      continue;
    }
    if ((section === "adverse" || section === "satisfactory" || section === "public") && t.startsWith("Account Name") && cells.length >= 1) {
      const res = tu_parse_card(lines, i, section, r);
      r.accounts.push(res[0]);
      i = res[1];
      continue;
    }
    if (section === "messages") { if (!t.startsWith("Your credit report contains")) r.messages.push(t); }
    else if (section === "statements") r.statements.push(t);
    i++;
  }
  return tu_finish(r, report_date || "");
}
function tu_set_personal(r, key, val) {
  const p = r.personal;
  val = norm_space(val);
  if (key === "Credit Report Date") p.on_file_since = p.on_file_since || parse_date(val) || "";
  else if (key === "Social Security Number") { p.ssn_masked = val; const m = /(\d{4})\s*$/.exec(val); p.ssn_last4 = m ? m[1] : ""; }
  else if (key === "Date of Birth") p.dob = parse_date(val) || val;
  else if (key === "Name") p.names.push({ name: val, kind: "primary" });
  else if (key === "AKA") p.names.push({ name: val, kind: "aka" });
  else if (key === "Current Address" || key === "Other Address") {
    const rec = { text: val, kind: key === "Current Address" ? "current" : "other", reported: "" };
    p.addresses.push(rec);
    return rec;
  } else if (key === "Date Reported") { if (p.addresses.length) p.addresses[p.addresses.length - 1].reported = parse_date(val) || val; }
  else if (key === "Phone Number") p.phones.push({ number: val });
  return null;
}
function tu_finish(r, report_date) {
  if (!r.source.report_date && report_date) r.source.report_date = report_date;
  const seen = {};
  for (const a of r.accounts) {
    const base = account_id(r.bureau, a);
    seen[base] = (seen[base] || 0) + 1;
    a.id = seen[base] === 1 ? base : base + "-" + seen[base];
  }
  r.inquiries.forEach((q, k) => { q.dates = Array.from(new Set(q.dates.filter((d) => d))).sort().reverse(); q.id = "q" + (k + 1); });
  const conf = r.accounts.map((a) => a.confidence);
  let base = conf.length ? Math.floor((2 * conf.reduce((s, x) => s + x, 0) + conf.length) / (2 * conf.length)) : (r.personal.names.length ? 60 : 0);
  if (!r.personal.names.length) base -= 20;
  base -= Math.min(20, 2 * r.warnings.length);
  r.source.confidence = Math.max(0, Math.min(100, base));
  return r;
}

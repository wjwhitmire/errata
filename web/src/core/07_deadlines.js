// ---------------------------------------------------------------- deadlines and the escalation ladder (twin of deadlines.py)
function deadline(kind, start) {
  const d = own(TABLES.deadlines, kind) ? TABLES.deadlines[kind] : null;
  if (!d) throw new CreditError("deadline", "Unknown deadline: " + String(kind));
  if (!start || parse_date(start) !== start) throw new CreditError("deadline", "A start date (YYYY-MM-DD) is needed for " + d.label.toLowerCase() + ".");
  const due = d.business ? add_business_days(start, d.days) : add_days(start, d.days);
  const earliest = d.begins_on ? add_days(start, d.days - 1) : due;
  return { kind, label: d.label, start, due, earliest, days: d.days, business: d.business, cite: d.cite };
}
function mail_deadlines(entry) {
  const out = [], letter = entry.letter || "", delivered = entry.delivered || "";
  if (!delivered) return out;
  for (let k of TABLES.letter_clocks[letter] || []) {
    if (k === "bureau_dispute" && (entry.extended || entry.after_free_report)) k = "bureau_dispute_extended";
    out.push(deadline(k, delivered));
  }
  if (entry.completed) out.push(deadline("results_notice", entry.completed));
  return out;
}
function validation_window(sent, received) {
  const out = {};
  if (sent) out.assumed_receipt = deadline("validation_assumed_receipt", sent).due;
  const rec = received || out.assumed_receipt || "";
  if (rec) { out.period_end = deadline("validation_period", rec).due; out.received = rec; }
  return out;
}
function oag_review_deadline(notice_date, received) {
  const n = parse_date(notice_date || ""), r = parse_date(received || "");
  if (!n || !r) throw new CreditError("deadline", "Enter the date on the notice and the date you received it (YYYY-MM-DD).");
  if (r < n) throw new CreditError("deadline", "The notice cannot arrive before the date printed on it.");
  const a = add_days(r, 30), b = add_days(n, 45), due = a < b ? a : b;
  let latest = due;
  while (!is_business_day(latest)) latest = add_days(latest, 1);
  return { kind: "oag_review", label: "Request administrative review (postmark by)", start: r, due, earliest: due, latest, from_receipt: a, from_notice: b,
    rule: a <= b ? "receipt" : "notice", cite: "tac55_103", business: false, days: a <= b ? 30 : 45 };
}
function collector_contact_check(first_letter_mailed, first_reported) {
  if (!first_letter_mailed) return { ok: false, reason: "No letter from the collector is on record before it reported." };
  const wait = deadline("collector_wait", first_letter_mailed).due;
  if (first_reported < wait) return { ok: false, reason: "It reported on " + first_reported + ", before " + wait + ", 14 days after its letter was mailed." };
  return { ok: true, reason: "It reported on or after " + wait + "." };
}
function next_step(entry, as_of) {
  const L = TABLES.ladder, letter = entry.letter || "", outcome = entry.outcome || "", delivered = entry.delivered || "";
  if (outcome === "deleted") return { step: null, action: "Deleted. Watch the next reports for reinsertion; a reinserted item needs written notice within 5 business days.", letters: [], cite: ["fcra611a5b"] };
  if (outcome === "updated") return { step: null, action: "Updated. Check the new report line by line; dispute again only with a new, specific inaccuracy.", letters: [], cite: ["fcra611a3"] };
  if (["bureau_611", "obsolete_605", "personal_info", "cares_act", "bankruptcy_correction"].includes(letter)) {
    if (outcome === "verified") return Object.assign({}, L[3], { also: L[2] });
    if (delivered && !outcome) {
      const due = deadline(entry.extended ? "bureau_dispute_extended" : "bureau_dispute", delivered).due;
      if (as_of > due) return Object.assign({}, L[2], { late: true, due, note: "No result by " + long_date(due) + ". Log the date; send the furnisher dispute and a second bureau dispute noting the missed deadline." });
      return { step: 1, action: "Waiting for the bureau's result.", letters: [], cite: ["fcra611"], due };
    }
  }
  if (letter === "mov_611a7" && delivered && !outcome) {
    const due = deadline("mov", delivered).due;
    if (as_of > due) return Object.assign({}, L[4], { late: true, due });
    return { step: 3, action: "Waiting for the description of the procedure.", letters: [], cite: ["fcra611a7"], due };
  }
  if ((letter === "furnisher_623" || letter === "dispute_notation") && delivered && !outcome) {
    const due = deadline("furnisher_direct", delivered).due;
    if (as_of > due) return Object.assign({}, L[4], { late: true, due });
    return { step: 2, action: "Waiting for the furnisher's answer.", letters: [], cite: ["regv1022_43"], due };
  }
  if (letter === "cfpb_complaint") {
    if (["closed", "no_relief", "verified"].includes(outcome)) return L[5];
    return { step: 4, action: "Waiting for the company's response (usually within 15 days).", letters: [], cite: ["cfpb_complaint"] };
  }
  if (letter === "state_ag_complaint" && (outcome === "closed" || outcome === "no_relief")) return L[6];
  if (outcome === "no_response") return L[4];
  return { step: null, action: !delivered ? "Record the delivery date from the return receipt to start the clock." : "No automatic next step.", letters: [], cite: [] };
}
function reminders(entries, as_of, windowDays) {
  const w = windowDays === undefined ? 7 : windowDays, out = [];
  for (const e of entries) {
    if (e.outcome) continue;
    for (const d of mail_deadlines(e)) {
      const left = days_between(as_of, d.due);
      if (left <= w) out.push({ entry: e.id || "", label: d.label, due: d.due, days_left: left, overdue: left < 0, cite: d.cite, subject: e.subject || "" });
    }
  }
  return sortBy(out, (x) => [x.due, x.entry, x.label]);
}
function ics_escape(s) { return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n?/g, "\n").replace(/\n/g, "\\n"); }
function ics(events, stamp, product) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:" + (product || "-//Field Tools//" + PRODUCT_NAME + "//EN"), "CALSCALE:GREGORIAN"];
  for (const e of sortBy(events, (x) => [x.date, x.uid])) {
    lines.push("BEGIN:VEVENT", "UID:" + ics_escape(e.uid), "DTSTAMP:" + stamp, "DTSTART;VALUE=DATE:" + e.date.replace(/-/g, ""),
      "DTEND;VALUE=DATE:" + add_days(e.date, 1).replace(/-/g, ""), "SUMMARY:" + ics_escape(e.title));
    if (e.description) lines.push("DESCRIPTION:" + ics_escape(e.description));
    lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + ics_escape(e.title), "TRIGGER:-P2D", "END:VALARM", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  const out = [], blen = (s) => UTF8.encode(s).length;
  for (let ln of lines) {
    while (blen(ln) > 75) {
      let cut = 75;
      while (blen(ln.slice(0, cut)) > 75) cut--;
      out.push(ln.slice(0, cut));
      ln = " " + ln.slice(cut);
    }
    out.push(ln);
  }
  return out.join("\r\n") + "\r\n";
}

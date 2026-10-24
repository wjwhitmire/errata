// ---------------------------------------------------------------- findings engine (twin of findings.py)
// RULES, CARES and the other tables come from 90_tables.js, written from the Python library.
const CONF_ORDER = { high: 0, medium: 1, low: 2, needs_answer: 3 };
function mkf(rule, report, subject, evidence, facts, request, confidence, account, detail, confirm, extra) {
  const meta = TABLES.rules[rule];
  const f = {
    id: "f" + stable_hash([rule, report.bureau || "", account ? account.id : "", subject, detail || ""].join("|")),
    rule, title: meta.title, group: meta.group, bureau: report.bureau || "", account_id: account ? account.id : "", subject,
    confidence: confidence || "high", legal: meta.legal.slice(), evidence, facts, request, confirm: confirm || [], letter: meta.letter,
    then: meta.then, impact: meta.impact, speed: meta.speed, status: "open", explain: "",
  };
  if (extra) Object.assign(f, extra);
  return f;
}
function subject_of(a) { const num = norm_space(a.number); return a.name + (num ? " " + num : ""); }
function late_text(h) { return is_late(h.rating) && isDigits(h.rating) ? rating_days(h.rating) + " days late in " + us_date(h.month) : h.rating + " in " + us_date(h.month); }
function list_text(parts) {
  parts = Array.from(parts);
  if (parts.length <= 1) return parts.join("");
  if (parts.length === 2) return parts[0] + " and " + parts[1];
  return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
}
const ev = (label, value) => ({ label, value });
const isNum = (v) => v !== null && v !== undefined;
function rule_paid_then_late(r, a) {
  const hist = a.history || [];
  if (!hist.length) return [];
  let anchor = null, why = "", conf = "high";
  if (a.paid) { anchor = a.paid.slice(0, 7); why = "a Date Paid of " + us_date(a.paid); }
  else if (a.closed && a.balance === 0 && PAID_STATUS.test(a.pay_status || "")) { anchor = a.closed.slice(0, 7); why = "a $0 balance and a paid, closed status as of " + us_date(a.closed); conf = "medium"; }
  if (!anchor) return [];
  const late = hist.filter((h) => h.month > anchor && (is_late(h.rating) || DEROG_RATINGS.has(h.rating)));
  if (!late.length) return [];
  const lates = list_text(late.map(late_text));
  const status = a.pay_status || "";
  const facts = ["The account shows " + why + ", yet the payment history reports " + lates + "."];
  if (PAID_AS_AGREED.test(status)) facts.push("The pay status reads \"" + status + "\", which also conflicts with those late entries.");
  const e = [ev(a.paid ? "Date paid" : "Date closed", us_date(a.paid || a.closed)), ev("Balance", money_text(a.balance)), ev("Pay status", status), ev("Later late entries", lates)];
  return [mkf("paid_then_late", r, subject_of(a), e, facts, "Please delete the late payment entries reported after " + us_date(anchor) + ", or delete the account if the furnisher cannot verify them.", conf, a, anchor)];
}
function grid_max(hist) { const v = hist.filter((h) => isDigits(h.rating) && is_late(h.rating)).map((h) => rating_days(h.rating)); return v.length ? Math.max(...v) : 0; }
function rule_max_delinquency(r, a) {
  const md = a.max_delinquency || {}, hist = a.history || [];
  if (!md.days || !hist.length) return [];
  const by = {};
  for (const h of hist) by[h.month] = h;
  const first = hist[0].month, last = hist[hist.length - 1].month, note = md.text, gmax = grid_max(hist);
  const entries = (md.entries || []).filter((e) => e.month);
  const in_range = entries.filter((e) => first <= e.month && e.month <= last);
  const problems = [];
  let conf = "high";
  for (const e of in_range) {
    const h = by[e.month];
    if (!h) continue;
    const rd = isDigits(h.rating) ? rating_days(h.rating) : null;
    if (h.rating && h.rating !== "X" && rd !== md.days) problems.push("the note names " + us_date(e.month) + ", but the grid shows " + h.rating + " for " + us_date(e.month));
    if (isNum(e.amount) && isNum(h.past_due) && h.past_due !== e.amount) problems.push("the note gives " + money_text(e.amount) + " for " + us_date(e.month) + ", but the grid shows " + money_text(h.past_due) + " past due that month");
  }
  if (in_range.length && gmax && gmax !== md.days) problems.push("the note says the worst delinquency was " + md.days + " days, but the grid's worst rating is " + gmax + " days");
  if (!problems.length && entries.length && gmax === md.days) {
    const listed = new Set(entries.map((e) => e.month));
    const extra = hist.filter((h) => isDigits(h.rating) && rating_days(h.rating) === md.days && !listed.has(h.month));
    if (extra.length && in_range.length) {
      problems.push("the note names only " + list_text(entries.map((e) => us_date(e.month))) + ", but the grid also shows " + md.days + "-day ratings in " + list_text(extra.map((h) => us_date(h.month))));
      conf = "medium";
    }
  }
  if (!problems.length) return [];
  const facts = ["The Maximum Delinquency Note reads \"" + note + "\", and it does not match the payment history: " + problems.join("; ") + "."];
  const e = [ev("Maximum Delinquency Note", note), ev("Worst rating in grid", gmax ? gmax + " days" : "none"), ev("Disagreements", problems.join("; "))];
  return [mkf("max_delinquency_mismatch", r, subject_of(a), e, facts, "Please correct the delinquency history so the note and the payment grid agree, or delete the late entries the furnisher cannot verify.", conf, a)];
}
function rule_skipped_step(r, a) {
  const out = [], hist = a.history || [];
  for (let i = 1; i < hist.length; i++) {
    const prev = hist[i - 1], cur = hist[i];
    if (month_index(cur.month) - month_index(prev.month) !== 1) continue;
    if (!(isDigits(cur.rating) && is_late(cur.rating))) continue;
    const d = rating_days(cur.rating), p = rating_days(prev.rating);
    if (p === null || d < 60 || p >= d - 30) continue;
    const zero_due = prev.past_due === 0;
    const conf = p === 0 && (zero_due || !isNum(prev.past_due)) ? "high" : "medium";
    const pd = isNum(prev.past_due) ? " with " + money_text(prev.past_due) + " past due" : "";
    const prev_txt = p === 0 ? "current (OK)" : p + " days late";
    const facts = ["The payment history shows " + us_date(prev.month) + " as " + prev_txt + pd + ", then " + cur.rating + " days late in " + us_date(cur.month) + ". " +
      "An account cannot be " + d + " days late one month after it was " + prev_txt + "."];
    const e = [ev(month_label(prev.month), prev.rating + (pd ? ", " + money_text(prev.past_due) + " past due" : "")),
      ev(month_label(cur.month), cur.rating + (isNum(cur.past_due) ? ", " + money_text(cur.past_due) + " past due" : ""))];
    out.push(mkf("skipped_step", r, subject_of(a), e, facts, "Please correct or delete the " + cur.rating + "-day late entry for " + us_date(cur.month) + ".", conf, a, cur.month));
  }
  return out;
}
function rule_zero_terms(r, a) {
  const t = a.terms || {};
  if (t.amount !== 0) return [];
  const due = (a.history || []).filter((h) => (h.due || 0) > 0);
  if (!due.length && !((a.monthly_payment || 0) > 0)) return [];
  const amounts = Array.from(new Set(due.map((h) => h.due))).sort((x, y) => x - y);
  const span = due.length ? us_date(due[0].month) + " to " + us_date(due[due.length - 1].month) : "";
  const facts = [due.length ? "The terms read \"" + t.text + "\", but the payment history lists amounts due of " + list_text(amounts.map((x) => money_text(x))) + " in " + due.length + " months from " + span + "."
    : "The terms read \"" + t.text + "\", but the monthly payment is reported as " + money_text(a.monthly_payment) + "."];
  const e = [ev("Terms", t.text), ev("Months with an amount due", String(due.length)), ev("Amounts due", list_text(amounts.map((x) => money_text(x))) || money_text(a.monthly_payment))];
  return [mkf("zero_terms_amounts_due", r, subject_of(a), e, facts, "Please correct the terms to the scheduled payment the furnisher actually reported, or explain the $0 terms.", "high", a)];
}
function rule_closed_then_activity(r, a) {
  if (!a.closed) return [];
  const cm = a.closed.slice(0, 7), hist = a.history || [];
  const at = hist.filter((h) => h.month <= cm);
  if (!at.length || at[at.length - 1].bal !== 0) return [];
  const later = hist.filter((h) => h.month > cm && ((h.bal || 0) > 0 || is_late(h.rating)));
  if (!later.length) return [];
  const desc = list_text(later.map((h) => us_date(h.month) + " (" + (h.rating || "no rating") + (h.bal ? ", balance " + money_text(h.bal) : "") + ")"));
  const facts = ["The account shows Date Closed " + us_date(a.closed) + " with a $0 balance that month, yet later months report activity: " + desc + "."];
  return [mkf("closed_then_activity", r, subject_of(a), [ev("Date closed", us_date(a.closed)), ev("Later activity", desc)], facts, "Please delete the entries reported after " + us_date(cm) + " or correct the closing date.", "high", a)];
}
const CURRENT_STATUS = /^(Current|Current Account|Paid or paying as agreed|Pays as agreed|OK)\b/i;
function rule_status_consistency(r, a) {
  const out = [], st = a.pay_status || "";
  if (a.kind === "collection" || (a.flags || []).includes("charged_off")) return out;
  const pd = a.past_due, hist = a.history || [], last = hist.length ? hist[hist.length - 1] : null;
  if (CURRENT_STATUS.test(st) && isNum(pd) && pd > 0) out.push(mkf("status_vs_past_due", r, subject_of(a), [ev("Pay status", st), ev("Past due", money_text(pd))], ["The pay status reads \"" + st + "\" while the account reports " + money_text(pd) + " past due."], "Please correct the pay status or the past due amount so they agree.", "high", a, "pd"));
  if (/(\d+)\s+Days/i.test(st) && pd === 0 && (a.balance || 0) > 0) out.push(mkf("status_vs_past_due", r, subject_of(a), [ev("Pay status", st), ev("Past due", money_text(pd))], ["The pay status reads \"" + st + "\" while the past due amount is $0."], "Please correct the pay status or the past due amount so they agree.", "high", a, "late0"));
  if (last && CURRENT_STATUS.test(st) && isDigits(last.rating) && is_late(last.rating) && a.updated && a.updated.slice(0, 7) === last.month) {
    out.push(mkf("status_vs_latest_month", r, subject_of(a), [ev("Pay status", st), ev(month_label(last.month), last.rating)],
      ["The pay status reads \"" + st + "\", but the payment history for " + us_date(last.month) + ", the month the account was last updated, shows " + last.rating + " days late."],
      "Please correct the pay status or the latest month so they agree.", "medium", a));
  }
  return out;
}
function first_late_of_last_run(hist) {
  let first = null;
  for (const h of hist) {
    const late = is_late(h.rating) || DEROG_RATINGS.has(h.rating);
    if (late && first === null) first = h;
    else if (!late && h.rating === "OK") first = null;
  }
  return first;
}
function rule_dates(r, a, as_of, ctx) {
  const out = [], hist = a.history || [];
  if (!(a.flags || []).includes("adverse")) return out;
  const month_now = as_of.slice(0, 7), first = first_late_of_last_run(hist);
  const kd = ((ctx.profile || {}).known_dofd) || {};
  const known = own(kd, a.id) ? kd[a.id] : "";
  if (a.removal && a.removal <= month_now) {
    out.push(mkf("obsolete", r, subject_of(a), [ev("Estimated removal", us_date(a.removal)), ev("Report date", us_date(as_of))],
      ["The report itself estimates this item would be removed in " + us_date(a.removal) + ", and it is still reported as of " + us_date(as_of) + "."],
      "Please delete this item; it is past the reporting period.", "high", a, "removal"));
  } else if (!first && !known) {
    const old = hist.filter((h) => (is_late(h.rating) || DEROG_RATINGS.has(h.rating)) && add_months(h.month, 84) < month_now);
    if (old.length) out.push(mkf("obsolete", r, subject_of(a), [ev("Late entries older than 7 years", list_text(old.map(late_text)))],
      ["The payment history still reports " + list_text(old.map(late_text)) + ", more than seven years ago."], "Please delete the late entries that are more than seven years old.", "high", a, "old-lates"));
  } else {
    const anchor = known || (first ? first.month : "");
    if (anchor) {
      const limit = add_months(anchor, 12 * 7 + 6);
      if (limit < month_now) {
        const src = known ? "the delinquency date you confirmed" : "the first late entry in the payment history";
        out.push(mkf("obsolete", r, subject_of(a), [ev("Delinquency began", us_date(anchor)), ev("Reporting limit", us_date(limit))],
          ["The delinquency began by " + us_date(anchor) + " (" + src + "). Seven years plus 180 days from then ended in " + us_date(limit) + "."],
          "Please delete this item; it is past the reporting period.", "high", a, "dofd"));
      }
    }
  }
  if (a.removal) {
    const anchor = known || (first ? first.month : "");
    if (anchor) {
      // bureaus set the removal date 7 years after the date of first delinquency, so it implies one
      const implied = add_months(a.removal, -84);
      if (implied > add_months(anchor, 1)) {
        const src = known ? "your confirmed delinquency date" : "the first late entry in the payment history";
        const late_by = month_index(implied) - month_index(anchor);
        const conf = a.removal > add_months(anchor, 12 * 7 + 6) ? "high" : "medium";
        out.push(mkf("reaged", r, subject_of(a), [ev("Delinquency began by", us_date(anchor)), ev("Estimated removal", us_date(a.removal)), ev("Delinquency date that removal implies", us_date(implied))],
          ["The report estimates removal in " + us_date(a.removal) + ", seven years after " + us_date(implied) + ", but the delinquency began by " + us_date(anchor) + " (" + src + "), " + late_by + " months earlier."],
          "Please correct the date of first delinquency to " + us_date(anchor) + " or earlier, as the furnisher's own payment history shows.", conf, a));
      }
    }
  }
  if (((a.flags || []).includes("charged_off") || a.kind === "collection") && !a.removal && !a.dofd) {
    out.push(mkf("missing_dofd", r, subject_of(a), [ev("Pay status", a.pay_status || ""), ev("Estimated removal", "not shown")],
      ["The account is reported as charged off or in collection, but no date of first delinquency or removal date is shown."],
      "Please report the month and year the delinquency began, or delete the item if it cannot be verified.", "medium", a));
  }
  return out;
}
const NAME_STOP = new Set(["INC", "LLC", "NA", "N", "A", "CORP", "CO", "THE", "OF", "BANK", "BK", "USA", "FSB", "LP", "LTD", "AND", "SERVICES", "SVCS", "FINANCIAL", "FINANCE", "CREDIT", "CARD", "VIA", "C", "O", "CAPITAL"]);
function name_tokens(s) { return new Set(norm_name(s).split(" ").filter((t) => t && !NAME_STOP.has(t) && t.length > 1)); }
function names_match(a, b) {
  const na = norm_name(a), nb = norm_name(b);
  if (!na || !nb) return false;
  if (na === nb || nb.includes(na) || na.includes(nb)) return true;
  const ta = name_tokens(a), tb = name_tokens(b);
  if (!ta.size || !tb.size) return false;
  const shared = [...ta].filter((t) => tb.has(t));
  const union = new Set([...ta, ...tb]);
  return shared.some((t) => t.length >= 4) && shared.length * 2 >= union.size;
}
function rule_collections(r, accounts, as_of, ctx) {
  const out = [], facts_ok = (ctx.profile || {}).facts || {};
  for (const c of accounts) {
    if (c.kind !== "collection") continue;
    if (!norm_space(c.original_creditor)) out.push(mkf("collection_missing_oc", r, subject_of(c), [ev("Original creditor", "not shown")], ["The collection account does not identify the original creditor."], "Please identify the original creditor or delete the account if it cannot be verified.", "medium", c));
    for (const a of accounts) {
      if (a === c || a.kind === "collection") continue;
      if (!names_match(c.original_creditor || "", a.name || "")) continue;
      if (!(a.flags || []).some((f) => f === "charged_off" || f === "transferred")) continue;
      if ((a.balance || 0) > 0 && (c.balance || 0) > 0) {
        out.push(mkf("duplicate_debt", r, subject_of(a) + " and " + subject_of(c),
          [ev(a.name + " balance", money_text(a.balance)), ev(c.name + " balance", money_text(c.balance)), ev(c.name + " original creditor", c.original_creditor || "")],
          [a.name + " reports a balance of " + money_text(a.balance) + " with the status \"" + (a.pay_status || "") + "\", and " + c.name + " reports a balance of " + money_text(c.balance) +
            " on the same debt, naming " + (c.original_creditor || "") + " as the original creditor. The same debt is counted twice; only one of them may report a balance."],
          "Please have " + a.name + " report a $0 balance on the transferred or charged-off account, or delete the duplicate.", "high", a, c.id, null, { related: [c.id] }));
      }
      if (c.removal && a.removal && c.removal > add_months(a.removal, 1)) {
        out.push(mkf("reaged", r, subject_of(c), [ev(a.name + " estimated removal", us_date(a.removal)), ev(c.name + " estimated removal", us_date(c.removal))],
          ["The original creditor's account (" + a.name + ") is due to come off in " + us_date(a.removal) + ", but the collection by " + c.name + " on the same debt is due to come off later, in " + us_date(c.removal) + ". A debt sale does not restart the reporting period."],
          "Please correct the collection's date of first delinquency to match the original account, so it comes off by " + us_date(a.removal) + ".", "high", c, a.id, null, { related: [a.id] }));
      }
    }
    if (c.opened && days_between(c.opened, as_of) >= 0 && days_between(c.opened, as_of) <= 365) {
      const key = "acct:" + c.id + ":no_contact_before_reporting";
      const sentence = "I received no letter, email or call from " + c.name + " about this debt before " + us_date(c.opened) + ".";
      const ans = own(facts_ok, key) ? facts_ok[key] : undefined;
      if (ans !== false) {
        out.push(mkf("collector_reported_early", r, subject_of(c), [ev("Opened (reported)", us_date(c.opened)), ev("Days before this report", String(days_between(c.opened, as_of)))],
          [c.name + " began reporting this collection on " + us_date(c.opened) + "."].concat(ans === true ? [sentence] : []),
          "Please provide validation information for this debt and the date and method of your first communication with me before you reported it.",
          ans === true ? "high" : "needs_answer", c, "", [{ key, sentence }], { needs: ans === true ? [] : [key] }));
      }
    }
    if ((c.flags || []).includes("medical")) {
      const reasons = [];
      const initial = isNum(c.high_balance) ? c.high_balance : c.balance;
      if ((c.flags || []).includes("paid") || c.balance === 0) reasons.push("it is reported as paid");
      if (isNum(initial) && initial < 50000) reasons.push("its reported balance of " + money_text(initial) + " is under $500");
      if (c.opened && c.dofd && month_index(c.opened.slice(0, 7)) - month_index(c.dofd.slice(0, 7)) < 12) reasons.push("it was reported on " + us_date(c.opened) + ", less than a year after the delinquency began in " + us_date(c.dofd));
      if (reasons.length) out.push(mkf("medical_policy", r, subject_of(c), [ev("Why", list_text(reasons))],
        ["This is a medical collection and " + list_text(reasons) + ". Equifax, Experian and TransUnion have said they do not report medical collections that are paid, " +
          "that had an initial balance under $500, or until a year after the delinquency."],
        "Please delete this medical collection under your own stated policy.", "medium", c));
    }
  }
  for (const a of accounts) {
    if ((a.flags || []).includes("transferred") && (a.balance || 0) > 0 && a.kind !== "collection") {
      const rm = (a.remarks || []).join("; ");
      out.push(mkf("sold_with_balance", r, subject_of(a), [ev("Remarks", rm), ev("Balance", money_text(a.balance))],
        ["The account is marked \"" + (rm || a.pay_status || "") + "\" yet still reports a balance of " + money_text(a.balance) + ". A sold or transferred account should report a $0 balance."],
        "Please report a $0 balance on this transferred account.", "high", a));
    }
  }
  return out;
}
function rule_bankruptcy(r, accounts, ctx) {
  const out = [], prof = ctx.profile || {}, bk = prof.bankruptcy || {};
  for (const a of accounts) {
    const st = [a.pay_status || ""].concat(a.remarks || []).join(" ");
    let included = (a.flags || []).includes("bankruptcy");
    if (!included && bk.discharged && bk.filed && a.opened && a.opened < bk.filed && ((prof.facts || {})["acct:" + a.id + ":in_bankruptcy"] === true)) included = true;
    if (!included) continue;
    // a balance can be accurate while a case is open; only a discharge makes it wrong
    const facts = prof.facts || {};
    const on_report = /DISCHARG/i.test(st);
    const bad = [];
    if ((a.balance || 0) > 0) bad.push("a balance of " + money_text(a.balance));
    if ((a.past_due || 0) > 0) bad.push(money_text(a.past_due) + " past due");
    if (bk.discharged) {
      const later = (a.history || []).filter((h) => h.month > bk.discharged.slice(0, 7) && is_late(h.rating));
      if (later.length) bad.push("late ratings after the discharge in " + list_text(later.map((h) => us_date(h.month))));
    }
    if (!bad.length) continue;
    const key = "bk:discharged";
    const sentence = "My bankruptcy case that included this account ended in a discharge" + (bk.discharged ? " on " + us_date(bk.discharged) + "." : ".");
    const known = on_report || !!bk.discharged;
    const ans = own(facts, key) ? facts[key] : undefined;
    if (!known && ans === false) continue;
    const confirmed = known || ans === true;
    const head = on_report ? "The account is reported as discharged in bankruptcy" : "The account is included in bankruptcy";
    const fact = head + (bk.discharged ? ", discharged " + us_date(bk.discharged) + "," : "") + " but still shows " + list_text(bad) + ".";
    out.push(mkf("bankruptcy_balance", r, subject_of(a), [ev("Status", st), ev("Problem", list_text(bad)), ev("Discharge", on_report ? "on the report" : bk.discharged ? us_date(bk.discharged) : "your answer")],
      (known || ans !== true ? [] : [sentence]).concat(confirmed ? [fact] : []),
      "Please report this account as included in bankruptcy with a $0 balance and no amount past due.", confirmed ? "high" : "needs_answer", a, "",
      known ? [] : [{ key, sentence }], { needs: confirmed ? [] : [key] }));
  }
  return out;
}
function rule_cares(r, accounts, ctx) {
  const out = [], prof = ctx.profile || {}, CARES = TABLES.cares;
  for (const acc of prof.accommodations || []) {
    const a = accounts.find((x) => x.id === acc.account_id);
    if (!a || (prof.facts || {})["acct:" + a.id + ":accommodation"] !== true) continue;
    const start = (acc.start || "").slice(0, 7), end = (acc.end || "").slice(0, 7);
    // covered: an accommodation made during the covered period, for its own term
    if (!start || !end || start < CARES.start.slice(0, 7) || start > CARES.end.slice(0, 7)) continue;
    const lo = start, hi = end;
    const hist = a.history || [];
    const before = hist.filter((h) => h.month < start);
    if (before.length && is_late(before[before.length - 1].rating)) continue;
    const lates = hist.filter((h) => lo <= h.month && h.month <= hi && is_late(h.rating));
    if (lates.length) {
      const sentence = "I had a payment accommodation on this account from " + us_date(start) + " to " + us_date(end) + ", I was current before it began, " +
        "and I made every payment the accommodation required.";
      out.push(mkf("cares_act", r, subject_of(a), [ev("Accommodation", us_date(start) + " to " + us_date(end)), ev("Late entries in that time", list_text(lates.map(late_text)))],
        [sentence, "The payment history reports " + list_text(lates.map(late_text)) + " during that accommodation."],
        "Please report these months as current, as the CARES Act requires for accommodations made during the covered period.", "high", a));
    }
  }
  return out;
}
function rule_dispute_flag(r, accounts, ctx) {
  const out = [], rd = r.source.report_date || ctx.as_of || "";
  for (const d of ctx.disputes || []) {
    if (d.kind !== "furnisher" || !d.delivered) continue;
    const a = accounts.find((x) => x.id === d.account_id);
    if (!a || (a.flags || []).includes("disputed")) continue;
    if (rd && days_between(d.delivered, rd) > 30) out.push(mkf("dispute_flag_missing", r, subject_of(a), [ev("Your dispute delivered", us_date(d.delivered)), ev("Report date", us_date(rd)), ev("Dispute remark", "none")],
      ["I disputed this account directly with the furnisher; my dispute was delivered on " + us_date(d.delivered) + ". The report dated " + us_date(rd) + " does not show the account as disputed."],
      "Please report this account as disputed by the consumer while the dispute is open.", "high", a));
  }
  return out;
}
function rule_user_confirmed(r, accounts, ctx) {
  const out = [], prof = ctx.profile || {}, facts = prof.facts || {};
  for (const a of accounts) {
    if (facts["acct:" + a.id + ":identity_theft"] === true && prof.ftc_report) {
      const sentence = "The account " + subject_of(a) + " resulted from identity theft; I did not open it, use it or benefit from it.";
      out.push(mkf("identity_theft", r, subject_of(a), [ev("FTC report number", prof.ftc_report)], [sentence], "Please block this information under section 605B within four business days.", "high", a, "", [{ key: "acct:" + a.id + ":identity_theft", sentence }]));
    } else if (facts["acct:" + a.id + ":not_mine"] === true) {
      const sentence = "The account " + subject_of(a) + " is not mine. I never opened it and never authorized anyone to open it in my name.";
      out.push(mkf("not_mine", r, subject_of(a), [ev("Your answer", "Not my account")], [sentence], "Please investigate and delete this account from my file.", "high", a, "", [{ key: "acct:" + a.id + ":not_mine", sentence }]));
    }
  }
  return out;
}
const TX_SUPPORT = /\bTEXAS\b|\bTX\b|ATTORNEY GENERAL|\bOAG\b/i;
const LATE_STATUS = /\d+\s*DAYS|PAST DUE|DELINQ|\bLATE\b/i;
function rule_child_support(r, accounts, ctx) {
  const out = [], prof = ctx.profile || {}, facts = prof.facts || {};
  for (const a of accounts) {
    if (!(a.flags || []).includes("child_support")) continue;
    if (prof.state !== "TX" && !TX_SUPPORT.test(a.name || "")) continue;
    const hist = a.history || [], last = hist.length ? hist[hist.length - 1] : null, st = a.pay_status || "";
    const late_now = !!(last && is_late(last.rating));
    if (!(late_now || LATE_STATUS.test(st))) continue;
    const key = "acct:" + a.id + ":cs_court_plan";
    const sentence = "A court order set the amount of my past-due child support and required periodic payments to reduce it, and I have paid on time " +
      "every periodic payment for current and past-due support that the order required.";
    const ans = own(facts, key) ? facts[key] : undefined;
    if (ans === false) continue;
    let shown = st ? "The account is reported with the pay status \"" + st + "\"" : "The account is reported as delinquent";
    if (late_now) shown += " and the payment history shows " + late_text(last);
    shown += (a.past_due || 0) > 0 ? ", with " + money_text(a.past_due) + " past due." : ".";
    const evs = [ev("Reported by", a.name), ev("Pay status", st || "not shown"), ev("Latest month", last ? late_text(last) : "no payment history"), ev("Past due", money_text(a.past_due))];
    out.push(mkf("child_support_tx", r, subject_of(a), evs, ans === true ? [sentence, shown] : [],
      "Please report the past-due support as past due and zero months delinquent, as 1 Tex. Admin. Code 55.102(b) provides when a court-ordered " +
      "payment schedule on the arrears is being paid on time.", ans === true ? "high" : "needs_answer", a, "", [{ key, sentence }], { needs: ans === true ? [] : [key] }));
  }
  return out;
}
const SUFFIX = new Set(["JR", "SR", "II", "III", "IV", "V"]);
function name_parts(n) {
  const t = norm_name(n).split(" ").filter((x) => x && !SUFFIX.has(x));
  if (!t.length) return null;
  return { first: t[0], middle: t.slice(1, -1), last: t.length > 1 ? t[t.length - 1] : "" };
}
function name_problem(name, refs) {
  const p = name_parts(name);
  if (!p) return "";
  let best = "";
  const middles = uniqSorted(refs.map((x) => name_parts(x)).filter((q) => q && q.middle.length).map((q) => q.middle[0]));
  if (p.middle.length && middles.length && !middles.some((m) => m[0] === p.middle[0][0])) {
    if (!refs.some((x) => norm_name(name) === norm_name(x))) return "the middle initial " + p.middle[0][0] + " does not match " + list_text(middles);
  }
  for (const ref of refs) {
    const q = name_parts(ref);
    if (!q) continue;
    if (norm_name(name) === norm_name(ref)) return "";
    const issues = [];
    if (p.last && q.last && p.last !== q.last) issues.push(edit_distance(p.last, q.last) <= 2 ? "the last name " + p.last + " is a misspelling of " + q.last : "the last name " + p.last + " is not " + q.last);
    if (p.first !== q.first) issues.push(edit_distance(p.first, q.first) <= 2 && q.first.length > 3 ? "the first name " + p.first + " is a misspelling of " + q.first : "the first name " + p.first + " is not " + q.first);
    if (p.middle.length && q.middle.length && p.middle[0][0] !== q.middle[0][0]) issues.push("the middle initial " + p.middle[0][0] + " does not match " + q.middle[0]);
    if (!issues.length) return "";
    const text = list_text(issues);
    if (!best || text.length < best.length) best = text;
  }
  return best;
}
function parse_addr(text) {
  const t = norm_name(text);
  const m = /^(\d+[A-Z]?)\s+(.*?)\s+([A-Z]{2})\s+(\d{5})(?:\s+(\d{4}))?$/.exec(t);
  const m2 = /^(\d+)/.exec(t);
  const unit = /\b(APT|UNIT|STE|SUITE|LOT|BLDG|TRLR|RM|SPC)\s+([A-Z0-9]+)/.exec(t);
  const zipm = /\b(\d{5})(?:\s+\d{4})?$/.exec(t);
  return { number: m2 ? m2[1] : "", zip: zipm ? zipm[1] : "", unit: unit ? unit[2] : "", state: m ? m[3] : "", full: t, ok: !!m };
}
function addresses_problems(r, ctx) {
  const out = [], addrs = r.personal.addresses || [], prof = ctx.profile || {};
  const parsed = addrs.map((x) => parse_addr(x.text));
  addrs.forEach((x, i) => {
    const p = parsed[i], bad = [];
    if (!p.ok || !p.zip) bad.push("it has no valid state and ZIP code");
    if (p.unit && p.number && p.unit.length >= 5 && (p.unit.startsWith(p.number) || /\d[A-Z]{2,}$/.test(p.unit))) bad.push("the unit \"" + p.unit + "\" repeats the street number or mixes in letters");
    if (bad.length) out.push(mkf("address_malformed", r, x.text, [ev("Address", x.text), ev("Problem", list_text(bad))], ["The address \"" + x.text + "\" is malformed: " + list_text(bad) + "."], "Please remove this malformed address from my file.", "high", null, x.text));
  });
  const groups = new Map();
  addrs.forEach((x, i) => { const p = parsed[i]; if (p.number && p.zip) { const k = JSON.stringify([p.number, p.zip]); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); } });
  const keys = sortBy([...groups.keys()], (k) => JSON.parse(k));
  for (const k of keys) {
    const [num, z] = JSON.parse(k);
    const texts = uniqSorted(groups.get(k).map((x) => norm_space(x.text)));
    if (texts.length < 2) continue;
    out.push(mkf("address_variants", r, num + " ... " + z, [ev("Versions", texts.join(" | "))], ["My file lists " + texts.length + " versions of the address at " + num + " in ZIP code " + z + ": " + texts.join("; ") + "."],
      "Please keep only the correct version of this address and remove the others.", "medium", null, num + z, null, { variants: texts }));
  }
  const known = (prof.addresses || []).map((a) => norm_name(a && typeof a === "object" ? (own(a, "text") ? a.text : a) : a));
  if (known.length) {
    const facts = prof.facts || {};
    for (const x of addrs) {
      const nx = norm_name(x.text);
      if (known.some((k) => nx === k || nx.startsWith(k) || k.startsWith(nx))) continue;
      const key = "addr:" + stable_hash(nx) + ":never_lived";
      const sentence = "I have never lived at " + x.text + ".";
      const ans = own(facts, key) ? facts[key] : undefined;
      if (ans === false) continue;
      out.push(mkf("address_unknown", r, x.text, [ev("Address", x.text), ev("In your profile", "no")], ans === true ? [sentence] : [], "Please remove this address from my file.", ans === true ? "high" : "needs_answer", null, x.text, [{ key, sentence }], { needs: ans === true ? [] : [key] }));
    }
  }
  return out;
}
function area_code_problem(npa, nxx) {
  nxx = nxx || "";
  if (!/^\d{3}$/.test(npa || "")) return "it has no three-digit area code";
  if ("01".includes(npa[0])) return "area code " + npa + " starts with " + npa[0] + ", which no area code can";
  if (npa.slice(1) === "11") return npa + " is a service code (like 411 or 911), not an area code";
  if (npa[1] === "9") return "area codes with 9 in the middle (" + npa + ") are reserved and not in use";
  if (nxx && "01".includes(nxx[0])) return "the exchange " + nxx + " starts with " + nxx[0] + ", which no exchange can";
  const kind = own(TABLES.nanp, npa) ? TABLES.nanp[npa][0] : "";
  if (!kind) return "area code " + npa + " is not in service in the North American Numbering Plan (area code list of " + TABLES.nanp_source.version + ")";
  if (kind === "personal") return "area code " + npa + " is not a geographic area code; it is set aside for personal communications services";
  if (kind === "premium") return "area code " + npa + " is for premium-rate services, not personal lines";
  if (kind === "non_geographic") return "area code " + npa + " is a non-geographic service code, not a personal line";
  return "";
}
function phones_problems(r, ctx) {
  const out = [], phones = r.personal.phones || [], prof = ctx.profile || {};
  const known = new Set((prof.phones || []).map((p) => String(p).replace(/\D/g, "").slice(-10)));
  const facts = prof.facts || {}, lines = new Map();
  for (const ph of phones) {
    const digits = ph.number.replace(/\D/g, "").slice(-10), npa = digits.slice(0, 3), nxx = digits.slice(3, 6);
    const why = digits.length === 10 ? area_code_problem(npa, nxx) : "it does not have ten digits";
    if (why && !known.has(digits)) {
      const sure = ["0", "1"].includes(npa.slice(0, 1)) || npa.slice(1) === "11" || digits.length !== 10 || npa.slice(1, 2) === "9" || ["0", "1"].includes(nxx.slice(0, 1));
      out.push(mkf("phone_invalid", r, ph.number, [ev("Phone", ph.number), ev("Problem", why)], ["The phone number " + ph.number + " cannot be right: " + why + "."], "Please remove this phone number from my file.", sure ? "high" : "medium", null, digits));
    }
    if (digits.length === 10) { const k = digits.slice(3); if (!lines.has(k)) lines.set(k, []); lines.get(k).push(ph.number); }
    if (known.size && !known.has(digits) && !why) {
      const key = "phone:" + digits + ":not_mine", sentence = "The phone number " + ph.number + " is not mine.";
      const ans = own(facts, key) ? facts[key] : undefined;
      if (ans !== false) out.push(mkf("phone_unknown", r, ph.number, [ev("Phone", ph.number), ev("In your profile", "no")], ans === true ? [sentence] : [], "Please remove this phone number from my file.", ans === true ? "high" : "needs_answer", null, digits, [{ key, sentence }], { needs: ans === true ? [] : [key] }));
    }
  }
  for (const k of [...lines.keys()].sort()) {
    const nums = lines.get(k);
    if (new Set(nums).size > 1) out.push(mkf("phone_variant", r, nums.join(" and "), [ev("Numbers", list_text(nums))], ["My file lists " + list_text(nums) + ", which differ only in the area code; at most one of them is right."], "Please remove the incorrect versions of this phone number.", "medium", null, k));
  }
  return out;
}
function names_problems(r, ctx) {
  const out = [], prof = ctx.profile || {}, names = r.personal.names || [];
  let refs = (prof.names || []).filter((n) => n), check;
  const ownNames = refs.length > 0, nfacts = prof.facts || {};
  if (!refs.length) { refs = names.filter((n) => n.kind === "primary").map((n) => n.name).slice(0, 1); check = names.filter((n) => n.kind !== "primary"); }
  else check = names;
  for (const n of check) {
    const why = name_problem(n.name, refs);
    if (!why) continue;
    const fact = "The name \"" + n.name + "\" is not a name I use: " + why + ".";
    const evs = [ev("Name on file", n.name), ev("Compared with", list_text(refs)), ev("Problem", why)];
    const conf = why.includes("misspelling") || why.includes("middle initial") ? "high" : "medium";
    if (ownNames) { out.push(mkf("name_variant", r, n.name, evs, [fact], "Please remove this name variant from my file.", conf, null, n.name)); continue; }
    const key = "name:" + stable_hash(norm_name(n.name)) + ":not_used";
    const ans = own(nfacts, key) ? nfacts[key] : undefined;
    if (ans === false) continue;
    out.push(mkf("name_variant", r, n.name, evs, ans === true ? [fact] : [], "Please remove this name variant from my file.", ans === true ? conf : "needs_answer", null, n.name,
      [{ key, sentence: fact }], { needs: ans === true ? [] : [key] }));
  }
  const p = r.personal;
  if (prof.dob && p.dob && prof.dob !== p.dob) out.push(mkf("identity_mismatch", r, "Date of birth", [ev("On file", us_date(p.dob)), ev("Yours", us_date(prof.dob))], ["My file shows a date of birth of " + us_date(p.dob) + "; my date of birth is " + us_date(prof.dob) + "."], "Please correct my date of birth.", "high", null, "dob"));
  if (prof.ssn_last4 && p.ssn_last4 && prof.ssn_last4 !== p.ssn_last4) out.push(mkf("identity_mismatch", r, "SSN", [ev("Last four on file", p.ssn_last4)], ["The Social Security number on my file does not end in my last four digits."], "Please correct the Social Security number on my file.", "high", null, "ssn"));
  if (prof.employers && prof.employers.length) {
    const facts = prof.facts || {};
    for (const e of p.employers || []) {
      if (prof.employers.some((k) => names_match(e.name, k))) continue;
      const key = "emp:" + stable_hash(norm_name(e.name)) + ":never", sentence = "I have never worked for " + e.name + ".";
      const ans = own(facts, key) ? facts[key] : undefined;
      if (ans === false) continue;
      out.push(mkf("employer_unknown", r, e.name, [ev("Employer", e.name), ev("In your profile", "no")], ans === true ? [sentence] : [], "Please remove this employer from my file.", ans === true ? "high" : "needs_answer", null, e.name, [{ key, sentence }], { needs: ans === true ? [] : [key] }));
    }
  }
  return out;
}
function inquiries_problems(r, as_of, ctx) {
  const out = [], facts = (ctx.profile || {}).facts || {};
  for (const q of r.inquiries || []) {
    if (q.kind !== "hard") continue;
    for (const d of q.dates) {
      if (days_between(d, as_of) > 730) {
        out.push(mkf("obsolete_inquiry", r, q.name, [ev("Inquiry date", us_date(d))], ["The inquiry by " + q.name + " on " + us_date(d) + " is more than two years old."], "Please remove this inquiry; it is older than the two years inquiries stay on the file.", "high", null, d));
        continue;
      }
      const parts = q.name.split(/\s+via\s+/i);
      const matched = r.accounts.filter((a) => a.opened && days_between(d, a.opened) >= -7 && days_between(d, a.opened) <= 60 && parts.some((p) => names_match(p, a.name) || names_match(p, a.original_creditor || "")));
      if (matched.length) continue;
      const key = "inq:" + stable_hash(norm_name(q.name) + d) + ":not_authorized";
      const sentence = "I did not apply for credit with " + q.name + " on or about " + us_date(d) + " and did not authorize this inquiry.";
      const ans = own(facts, key) ? facts[key] : undefined;
      if (ans === false) continue;
      out.push(mkf("inquiry_no_account", r, q.name + " " + us_date(d), [ev("Inquiry", q.name), ev("Date", us_date(d)), ev("Matching account opened", "none found")], ans === true ? [sentence] : [],
        "Please tell me the permissible purpose you had for this inquiry, or have it removed.", ans === true ? "high" : "needs_answer", null, d, [{ key, sentence }], { needs: ans === true ? [] : [key], inquiry_id: q.id, date: d }));
    }
  }
  return out;
}
const PERSONAL_RULES = new Set(["name_variant", "address_malformed", "address_variants", "address_unknown", "phone_invalid", "phone_variant", "phone_unknown", "employer_unknown", "identity_mismatch"]);
function explain(f) {
  let base = { needs_answer: "This needs your answer first. Nothing is disputed until you confirm the sentence below is true.",
    high: "The report contradicts itself here, so the furnisher cannot verify it as it stands.",
    medium: "This looks wrong from the report alone; check it against your records before you dispute it.",
    low: "A weak signal; dispute it only if your records support it." }[f.confidence];
  if (PERSONAL_RULES.has(f.rule)) base += " Clean personal information goes to the bureaus first; furnishers need not investigate identifying information.";
  if (f.rule === "inquiry_no_account") base += " If you did apply, answer no: disputing an inquiry you authorized would be a false statement.";
  if (f.rule === "collector_reported_early") base += " A collector must communicate with you before it reports a debt, and wait about 14 days after mailing a letter.";
  if (f.rule === "child_support_tx") base += " Answer yes only if a court order set your arrears payments and you have made every one on time; your payment record from the Attorney General is the evidence.";
  if (f.rule === "bankruptcy_balance" && f.confidence === "needs_answer") base += " While a case is open, a balance can be accurate; only a discharge makes it wrong.";
  return base;
}
function find(report, ctx) {
  ctx = Object.assign({}, ctx || {});
  const as_of = ctx.as_of || report.source.report_date || "2026-01-01";
  ctx.as_of = as_of;
  let out = [];
  const accounts = report.accounts || [];
  for (const a of accounts) {
    out = out.concat(rule_paid_then_late(report, a), rule_max_delinquency(report, a), rule_skipped_step(report, a), rule_zero_terms(report, a),
      rule_closed_then_activity(report, a), rule_status_consistency(report, a), rule_dates(report, a, as_of, ctx));
  }
  out = out.concat(rule_collections(report, accounts, as_of, ctx), rule_bankruptcy(report, accounts, ctx), rule_cares(report, accounts, ctx),
    rule_dispute_flag(report, accounts, ctx), rule_user_confirmed(report, accounts, ctx), rule_child_support(report, accounts, ctx), names_problems(report, ctx), addresses_problems(report, ctx),
    phones_problems(report, ctx), inquiries_problems(report, as_of, ctx));
  const seen = new Set(), uniq = [];
  for (const f of out) { if (seen.has(f.id)) continue; seen.add(f.id); f.explain = explain(f); uniq.push(f); }
  return sortBy(uniq, (f) => [CONF_ORDER[f.confidence], -f.impact, -f.speed, f.group, f.subject, f.id]);
}
function findings_summary(fs) {
  const by = {};
  for (const f of fs) by[f.rule] = (by[f.rule] || 0) + 1;
  return { total: fs.length, needs_answer: fs.filter((f) => f.confidence === "needs_answer").length, by_rule: by };
}

// ---------------------------------------------------------------- planner, utilization, score ranges, SOL (twin of strategy.py)
const PLAN_PERSONAL = new Set(["name_variant", "address_malformed", "address_variants", "address_unknown", "phone_invalid", "phone_variant", "phone_unknown", "employer_unknown", "identity_mismatch"]);
const ROUND1_RULES = new Set(["identity_theft", "obsolete", "obsolete_inquiry", "bankruptcy_balance", "duplicate_debt", "sold_with_balance", "medical_policy", "paid_then_late",
  "max_delinquency_mismatch", "skipped_step", "zero_terms_amounts_due", "closed_then_activity", "status_vs_past_due", "status_vs_latest_month", "missing_dofd", "reaged",
  "collection_missing_oc", "cares_act", "not_mine", "cross_bureau_mismatch", "reinserted"]);
const CONTRADICTIONS = new Set(["paid_then_late", "max_delinquency_mismatch", "skipped_step", "zero_terms_amounts_due", "closed_then_activity", "status_vs_past_due",
  "status_vs_latest_month", "duplicate_debt", "sold_with_balance", "reaged", "obsolete", "bankruptcy_balance", "cross_bureau_mismatch"]);
function mkstep(kind, title, why, cite, findings, letter, recipient, account_id) {
  return { kind, title, why, cite: (cite || []).slice(), findings: (findings || []).map((f) => f.id), letter: letter || "", recipient: recipient || "", order: 0, account_id: account_id || "" };
}
function recipient_for(f, report) {
  const l = f.letter;
  if (["bureau_611", "obsolete_605", "personal_info", "block_605b", "cares_act", "bankruptcy_correction", "reinsertion_demand"].includes(l)) return "bureau:" + (f.bureau || report.bureau || "");
  if (l === "inquiry_removal") return "inquirer:" + (f.inquiry_id || "");
  if (["validation_regf", "furnisher_623", "dispute_notation"].includes(l)) return "furnisher:" + (f.account_id || "");
  return "";
}
function candidates(report, findings) {
  const by_acct = {};
  for (const f of findings) if (f.account_id && (f.confidence === "high" || f.confidence === "medium")) (by_acct[f.account_id] = by_acct[f.account_id] || []).push(f);
  const goodwill = [], pfd = [], leave = [];
  for (const a of report.accounts || []) {
    const fl = a.flags || [];
    if (!fl.includes("adverse")) continue;
    const disputable = by_acct[a.id] || [];
    const lates = (a.history || []).filter((h) => is_late(h.rating));
    if (a.kind === "collection") {
      if ((a.balance || 0) > 0 && !disputable.length) pfd.push({ account_id: a.id, name: a.name, balance: a.balance,
        why: "Unpaid collection with no reporting error found. FICO 9 and VantageScore 4.0 ignore paid collections; deletion helps most under FICO 8 and older mortgage scores. Get any deletion promise in writing before paying, and check the statute of limitations first: a payment can restart it in many states.",
        cite: ["pay_for_delete", "fico9", "fico8", "sol_table"] });
      continue;
    }
    if (fl.includes("charged_off")) {
      if (!disputable.length) leave.push({ account_id: a.id, name: a.name,
        why: "Charged off and reported consistently. Accurate information cannot be removed by dispute. Options: settle in writing with an agreed reporting status, or let time pass" + (a.removal ? " (the report estimates removal in " + us_date(a.removal) + ")." : "."),
        cite: ["croa1679c", "settlement"] });
      continue;
    }
    if (lates.length && !disputable.length && CURRENT_STATUS.test(a.pay_status || "") && lates.length <= 2 && lates.every((h) => h.rating === "30")) {
      goodwill.push({ account_id: a.id, name: a.name, lates: lates.map((h) => h.month),
        why: "An isolated, accurate 30-day late on an account that is current now. A goodwill letter asks for removal as a courtesy; it is not a dispute and many creditors refuse.", cite: ["experian_goodwill"] });
    } else if (lates.length && !disputable.length) {
      leave.push({ account_id: a.id, name: a.name,
        why: "The late payments look accurate and consistent. They cannot be removed by dispute; they fade with time and on-time payments" + (a.removal ? " and should be removed by " + us_date(a.removal) + "." : "."),
        cite: ["croa1679c", "fcra605"] });
    }
  }
  return { goodwill, pay_for_delete: sortBy(pfd, (x) => [x.balance, x.name]), leave_alone: leave };
}
function plan(report, findings, profile, goal, as_of, cards, scores) {
  goal = goal || "standard";
  if (!own(TABLES.goals, goal)) throw new CreditError("plan", "Unknown goal: " + String(goal));
  const RULES = TABLES.rules;
  const open_f = findings.filter((f) => (f.status || "open") === "open");
  const answers = open_f.filter((f) => f.confidence === "needs_answer"), ready = open_f.filter((f) => f.confidence !== "needs_answer");
  const personal = ready.filter((f) => PLAN_PERSONAL.has(f.rule)), round1 = ready.filter((f) => ROUND1_RULES.has(f.rule));
  const inquiries = ready.filter((f) => f.rule === "inquiry_no_account"), collectors = ready.filter((f) => f.rule === "collector_reported_early");
  const other = ready.filter((f) => !personal.includes(f) && !round1.includes(f) && !inquiries.includes(f) && !collectors.includes(f));
  const by_strength = (fs) => sortBy(fs, (f) => [-RULES[f.rule].impact - RULES[f.rule].speed, f.confidence !== "high", f.subject, f.id]);
  const phases = TABLES.playbook.map((p) => Object.assign({}, p, { steps: p.steps.map((s) => Object.assign(mkstep("playbook", s.title, "", s.cite), { id: s.id })) }));
  const ph = {};
  for (const p of phases) ph[p.id] = p;
  const bureau = report.bureau || "";
  const r1 = [];
  if (answers.length) r1.push(mkstep("answers", "Answer " + answers.length + " question" + (answers.length !== 1 ? "s" : "") + " so these items can be disputed or set aside",
    "Some findings depend on facts only you know (did you apply, did a collector contact you first). Nothing is disputed until you confirm.", [], answers));
  if (personal.length) r1.push(mkstep("letter", "Personal information cleanup at the bureau", "Fewer wrong identifiers means fewer mismatched accounts can attach. Bureaus handle this; furnishers need not.",
    ["fcra611", "fcra607b"], personal, "personal_info", "bureau:" + bureau));
  const theft = round1.filter((f) => f.rule === "identity_theft");
  if (theft.length) r1.push(mkstep("letter", "Identity theft block (605B), only for real identity theft", "Block due within 4 business days of receipt.", ["fcra605b"], theft, "block_605b", "bureau:" + bureau));
  for (const f of by_strength(round1.filter((x) => x.rule !== "identity_theft"))) r1.push(mkstep("letter", f.title + ": " + f.subject, f.facts.length ? f.facts[0] : f.explain, f.legal, [f], f.letter, recipient_for(f, report), f.account_id || ""));
  for (const f of collectors) r1.push(mkstep("letter", "Validation request and contact question: " + f.subject, f.explain, f.legal, [f], "validation_regf", "furnisher:" + f.account_id, f.account_id));
  for (const f of inquiries) r1.push(mkstep("letter", "Ask for the permissible purpose: " + f.subject, "You said you did not apply. The inquirer must have had a permissible purpose.", f.legal, [f], "inquiry_removal", "inquirer:" + (f.inquiry_id || "")));
  ph.round1.steps = r1.concat(ph.round1.steps);
  const par = [];
  for (const f of by_strength(round1.filter((x) => RULES[x.rule].then === "furnisher_623" && x.account_id))) {
    par.push(mkstep("letter", "Direct dispute to the furnisher: " + f.subject, "Same inaccuracy, sent to the company that reports it, asking it to mark the account as disputed.",
      ["fcra623a8", "regv1022_43", "fcra623a3"], [f], "furnisher_623", "furnisher:" + f.account_id, f.account_id));
  }
  const cand = candidates(report, findings);
  for (const g of cand.goodwill) par.push(mkstep("letter", "Goodwill request: " + g.name, g.why, g.cite, [], "goodwill", "furnisher:" + g.account_id, g.account_id));
  for (const p of cand.pay_for_delete) par.push(mkstep("letter", "Pay-for-delete or settlement offer, in writing first: " + p.name + " (" + money_text(p.balance) + ")", p.why, p.cite, [], "pay_for_delete", "furnisher:" + p.account_id, p.account_id));
  for (const a of report.accounts || []) if ((a.flags || []).includes("student_loan") && (a.flags || []).includes("adverse") && /DEFAULT|COLLECTION|CHARGE/i.test(a.pay_status || "")) {
    par.push(mkstep("note", "Federal student loan in default: consider rehabilitation", "Nine on-time payments under an agreement; the record of default is removed. Consolidation ends default faster but leaves the record.", ["student_rehab"], [], "", "", a.id));
  }
  for (const f of other) par.push(mkstep("letter", f.title + ": " + f.subject, f.explain, f.legal, [f], f.letter, recipient_for(f, report), f.account_id || ""));
  ph.parallel.steps = par;
  let out = { goal, title: TABLES.goals[goal].title, note: TABLES.goals[goal].note, phases, candidates: cand, notes: notes_for(report) };
  if (goal === "auto_soon") { number_steps(out); out = auto_soon(out, report, findings, cards || [], scores || [], as_of); }
  number_steps(out);
  out.next_action = next_action(out);
  return out;
}
function number_steps(out) { let n = 0; for (const p of out.phases) for (const s of p.steps) s.order = ++n; }
function notes_for(report) {
  const notes = [];
  for (const a of report.accounts || []) {
    const fl = a.flags || [];
    if (fl.includes("bnpl")) notes.push({ account_id: a.id, text: a.name + " is a buy now, pay later loan. Some bureaus show these to you but lenders and classic scores do not use them yet.", cite: [] });
    if (fl.includes("child_support") || fl.includes("government")) notes.push({ account_id: a.id, text: a.name + " is reported by a government agency. The same accuracy duties apply; your payment records from the agency are the best evidence.", cite: ["fcra611", "fcra607b"] });
  }
  return notes;
}
function next_action(p) {
  for (const ph of p.phases) for (const s of ph.steps) if (["answers", "letter", "auto"].includes(s.kind)) return { phase: ph.title, title: s.title, why: s.why, kind: s.kind };
  return { phase: "", title: "Nothing to dispute right now. Keep payments on time and re-check your reports weekly.", why: "", kind: "none" };
}
function step_sig(s) { return s.kind === "letter" ? s.letter + "|" + s.findings.join(",") + "|" + s.account_id : s.kind + "|" + s.title; }
function auto_soon(out, report, findings, cards, scores, as_of) {
  const RULES = TABLES.rules;
  const util = cards.length ? utilization(cards, null, 10, false, as_of) : null;
  const docs = findings.filter((f) => CONTRADICTIONS.has(f.rule) && f.confidence === "high");
  const small = out.candidates.pay_for_delete.filter((p) => p.balance <= 50000);
  const steps = [];
  steps.push(mkstep("auto", "Pay card balances down before each statement closes",
    "Utilization has no memory in classic FICO scores, so a lower reported balance can show on the next report. Statement balances are what issuers usually report." +
    (util ? " Plan: " + money_text(util.total_pay) + " across " + util.cards.filter((c) => c.pay > 0).length + " card(s), overall use from " + util.overall_before + "% to " + util.overall_after + "%." : " Add your cards in Score plan to get amounts and dates."),
    ["util_timing", "fico8", "high_scorers"]));
  for (const f of sortBy(docs, (x) => [-RULES[x.rule].impact, x.subject])) steps.push(mkstep("letter", "Document-backed dispute: " + f.title + ": " + f.subject, f.facts.length ? f.facts[0] : "", f.legal, [f], f.letter, recipient_for(f, report), f.account_id || ""));
  for (const p of small) steps.push(mkstep("letter", "Pay-for-delete offer on a small collection: " + p.name + " (" + money_text(p.balance) + ")",
    "Small balances are where collectors most often agree. Written agreement first; check the statute of limitations before any payment.", p.cite, [], "pay_for_delete", "furnisher:" + p.account_id, p.account_id));
  steps.push(mkstep("auto", "No new accounts and no closing cards until the loan closes", "A new account adds an inquiry and lowers average age; closing a card removes its limit from your utilization right away.", ["fico_weights", "fico8"]));
  steps.push(mkstep("auto", "Keep auto or mortgage rate shopping inside 14 days", "Newer FICO versions count mortgage, auto and student loan inquiries within 45 days as one; older versions use 14 days. 14 days is safe across versions. Credit card inquiries are never grouped.", ["rate_shop"]));
  steps.push(mkstep("auto", "Know which scores lenders commonly use", "Auto lenders commonly use FICO Auto Scores; mortgage lenders commonly use FICO 2, 4 and 5, and VantageScore 4.0 is now accepted for loans sold to Fannie Mae and Freddie Mac. Ask each lender which score it pulls.", ["fico_versions", "freddie_models"]));
  steps.push(mkstep("auto", "Pre-application checklist", "Proof of income (recent pay stubs or tax returns), your down payment in a bank account, and a preapproval from a credit union first so you have a rate to compare. If a mortgage is near, ask the lender about a rapid rescore after a correction or paydown.", ["rapid_rescore"]));
  const phase = { id: "auto", days: "0 to 60", title: "Auto loan or mortgage soon: fastest levers first", steps };
  const moved = {};
  for (const p of out.phases) for (const s of p.steps) { const k = step_sig(s); if (!own(moved, k)) moved[k] = s.order; }
  for (const s of steps) { const k = step_sig(s); if (own(moved, k)) s.moved_from = moved[k]; }
  const used = new Set(steps.map(step_sig));
  const rest = out.phases.map((p) => Object.assign({}, p, { steps: p.steps.filter((s) => !used.has(step_sig(s))) }));
  const answers = rest.length > 2 ? rest[2].steps.filter((s) => s.kind === "answers") : [];
  if (answers.length) { rest[2].steps = rest[2].steps.filter((s) => s.kind !== "answers"); phase.steps = answers.concat(phase.steps); }
  out.phases = [phase].concat(rest);
  out.expect = expectations(scores, report, findings, cards, as_of);
  out.utilization = util;
  return out;
}
function expectations(scores, report, findings, cards, as_of) {
  const latest = {};
  for (const s of sortBy(scores || [], (x) => [x.date || ""])) latest[own(s, "model") ? s.model : "Unknown model"] = s;
  const sim = simulate(report, findings, cards, as_of);
  const lines = ["Lenders set their own score tiers and rates; ask each lender for its tier cutoffs and the rate at each.",
    "No one can promise a score or an approval. The ranges below are estimates from public facts about scoring, not a prediction.",
    "A correction shows only after the bureau updates the file; a mortgage lender can request a rapid rescore, usually in 2 to 5 days."];
  return { scores: Object.keys(latest).sort().map((k) => latest[k]), ranges: sim, lines, cite: ["fico_versions", "rapid_rescore", "ftc_study"] };
}
function next_close(day, as_of) {
  const y = +as_of.slice(0, 4), m = +as_of.slice(5, 7);
  for (let k = 0; k < 3; k++) {
    const base = add_months_date(pad4(y) + "-" + pad2(m) + "-01", k);
    const last = add_days(add_months_date(base, 1), -1);
    const cand = base.slice(0, 8) + pad2(Math.min(Math.trunc(day), +last.slice(8, 10)));
    if (cand > as_of) return cand;
  }
  return add_days(as_of, 30);
}
function sub_business_days(iso_s, n) { let d = iso_s, k = 0; while (k < n) { d = add_days(d, -1); if (is_business_day(d)) k++; } return d; }
function pct(bal, lim) { return !lim ? 0 : Math.floor((bal * 100 + Math.floor(lim / 2)) / lim); }
const intOf = (v) => Math.trunc(Number(v || 0)) || 0;
function utilization(cards, budget, target_pct, azeo, as_of) {
  target_pct = target_pct === undefined || target_pct === null ? 30 : target_pct;
  as_of = as_of || "2026-01-01";
  if (!(Math.trunc(target_pct) >= 1 && Math.trunc(target_pct) <= 100)) throw new CreditError("utilization", "Target must be between 1 and 100 percent.");
  const rows = [];
  for (const c of cards) {
    const lim = intOf(c.limit), bal = intOf(c.balance);
    if (lim < 0 || bal < 0) throw new CreditError("utilization", "Limits and balances cannot be negative.");
    rows.push({ id: own(c, "id") ? c.id : (c.name || ""), name: c.name || "", limit: lim, balance: bal, statement_day: intOf(c.statement_day) || 1 });
  }
  const total_lim = rows.reduce((s, r) => s + r.limit, 0), total_bal = rows.reduce((s, r) => s + r.balance, 0);
  let keep = null;
  if (azeo) {
    const wb = rows.filter((r) => r.balance > 0 && r.limit > 0);
    if (wb.length) keep = sortBy(wb, (r) => [-r.limit, r.name])[0].id;
  }
  for (const r of rows) {
    if (azeo) r.target = r.id === keep ? Math.min(r.balance, Math.max(1000, Math.floor(r.limit / 100)), Math.floor(r.limit * target_pct / 100)) : 0;
    else r.target = r.limit ? Math.min(r.balance, Math.floor(r.limit * target_pct / 100)) : 0;
    r.need = r.balance - r.target;
  }
  const order = sortBy(rows, (r) => [r.limit ? -pct(r.balance, r.limit) : -1e6, r.name]);
  let left = budget !== null && budget !== undefined ? budget : rows.reduce((s, r) => s + r.need, 0);
  for (const r of order) { const pay = Math.min(r.need, Math.max(0, left)); r.pay = pay; left -= pay; }
  const out = rows.map((r) => {
    const close = next_close(r.statement_day, as_of), after = r.balance - r.pay;
    return { id: r.id, name: r.name, limit: r.limit, balance: r.balance, pay: r.pay, after, util_before: pct(r.balance, r.limit), util_after: pct(after, r.limit),
      statement_close: close, pay_by: sub_business_days(close, 3), keep: r.id === keep };
  });
  const total_pay = out.reduce((s, r) => s + r.pay, 0), unmet = rows.reduce((s, r) => s + r.need, 0) - total_pay;
  return { cards: out, total_pay, unmet, overall_before: pct(total_bal, total_lim), overall_after: pct(total_bal - total_pay, total_lim), target_pct: Math.trunc(target_pct), azeo: !!azeo,
    notes: ["Issuers usually report the statement balance, so pay before the closing date, not the due date.",
      azeo ? "AZEO (all zero except one) is community-observed, not published by FICO." : "High scorers average about 7% utilization; FICO 8 is especially sensitive to card utilization."],
    cite: ["util_timing", azeo ? "azeo" : "high_scorers", "fico8"] };
}
function cards_from_report(report) {
  return (report.accounts || []).filter((a) => a.kind === "revolving" && !(a.flags || []).includes("closed") && a.credit_limit)
    .map((a) => ({ id: a.id, name: a.name, limit: a.credit_limit, balance: a.balance || 0, statement_day: 1 }));
}
const FAMILIES = [["fico8", "FICO 8-like"], ["fico9", "FICO 9 and 10-like"], ["vantage4", "VantageScore 4.0-like"]];
const ASSUMPTION = "Ranges are this tool's own estimates built from published weights and public facts; no scoring company publishes its model, and FICO says weights differ by person. Treat them as direction and rough size only.";
function band(lo, hi) { return { low: lo, high: hi, dir: lo >= 0 && hi > 0 ? "up" : hi <= 0 && lo < 0 ? "down" : lo === 0 && hi === 0 ? "flat" : "mixed" }; }
function allFamilies(lo, hi) { const o = {}; for (const [k] of FAMILIES) o[k] = band(lo, hi); return o; }
function simulate(report, findings, cards, as_of) {
  as_of = as_of || "2026-01-01";
  const out = [];
  cards = cards && cards.length ? cards : cards_from_report(report);
  if (cards.length) {
    const u = utilization(cards, null, 10, false, as_of), b = u.overall_before, a = u.overall_after;
    if (b > a) {
      const bd = b >= 50 ? [20, 60] : b >= 30 ? [10, 35] : b >= 10 ? [5, 20] : [0, 5];
      out.push({ id: "utilization", title: "Pay cards down from " + b + "% to " + a + "% overall before the statements close",
        families: { fico8: band(bd[0], bd[1]), fico9: band(bd[0], bd[1]), vantage4: band(Math.floor(bd[0] * 4 / 5), Math.floor(bd[1] * 4 / 5)) },
        basis: "Amounts owed are about 30% of a FICO score and utilization 20% of VantageScore 4.0; FICO 8 is especially sensitive. Newer models also look at 24 months of balances.",
        label: "Tool estimate", cite: ["fico_weights", "vantage4", "fico8"] });
    }
  }
  const month_now = as_of.slice(0, 7);
  for (const a of report.accounts || []) {
    if (a.kind === "collection") {
      const orig = a.high_balance !== null && a.high_balance !== undefined ? a.high_balance : (a.balance || 0);
      const paid = (a.balance || 0) === 0, medical = (a.flags || []).includes("medical");
      const f8 = orig < 10000 ? [0, 0] : [10, 45], f9 = paid ? [0, 0] : medical ? [0, 15] : [10, 40], v4 = medical ? [0, 0] : paid ? [0, 15] : [5, 30];
      out.push({ id: "remove:" + a.id, title: a.name + " collection removed (" + money_text(a.balance) + ")", families: { fico8: band(...f8), fico9: band(...f9), vantage4: band(...v4) },
        basis: "FICO 8 ignores collections under $100 original balance; FICO 9 ignores paid collections and weighs medical less; VantageScore 4.0 excludes medical collections.",
        label: "Published direction, tool estimate size", cite: ["fico8", "fico9", "vantage4"] });
    } else {
      const lates = (a.history || []).filter((h) => is_late(h.rating));
      if (lates.length && (findings || []).some((f) => f.account_id === a.id && (f.confidence === "high" || f.confidence === "medium"))) {
        const recent = lates.some((h) => month_index(month_now) - month_index(h.month) <= 24);
        const bd = recent ? [10, 50] : [0, 20];
        out.push({ id: "lates:" + a.id, title: "Disputed late entries on " + a.name + " corrected or deleted", families: allFamilies(bd[0], bd[1]),
          basis: "Payment history is about 35% of a FICO score and 41% of VantageScore 4.0; recent lates weigh more than old ones.", label: "Tool estimate", cite: ["fico_weights", "vantage4"] });
      }
    }
  }
  let recent_inq = 0;
  for (const q of report.inquiries || []) if (q.kind === "hard") for (const d of q.dates) if (days_between(d, as_of) <= 365) recent_inq++;
  if (recent_inq) out.push({ id: "inquiries", title: "Unauthorized hard inquiries from the last 12 months removed (" + recent_inq + " on file)", families: { fico8: band(0, 10), fico9: band(0, 10), vantage4: band(0, 10) },
    basis: "FICO counts inquiries for 12 months; only inquiries you did not authorize can be disputed.", label: "Tool estimate", cite: ["fico_weights", "tu_inquiries"] });
  out.push({ id: "au", title: "Added as an authorized user on a family member's long-standing, low-balance card", families: { fico8: band(0, 20), fico9: band(0, 20), vantage4: band(0, 20) },
    basis: "Most models count authorized user accounts; FICO 8 dampens tradeline renting; a high balance on that card raises your utilization; mortgage manual underwriting generally ignores it.",
    label: "Published direction, tool estimate size", cite: ["au_experian", "au_fico8", "fannie_au"] });
  out.push({ id: "secured", title: "Open a secured card (first months)", families: allFamilies(-10, 5),
    basis: "A new account adds an inquiry and lowers average age at first; it builds history over time. Credit builder loans helped people without other debt most.", label: "Tool estimate", cite: ["fico_weights", "credit_builder"] });
  return { scenarios: out, families: FAMILIES.map(([id, title]) => ({ id, title })), assumption: ASSUMPTION, cite: ["fico_weights", "vantage4", "ftc_study"] };
}
function sol(state, debt_type, last_payment, dofd, as_of) {
  as_of = as_of || "2026-01-01";
  const st = String(state || "").toUpperCase(), T = TABLES.sol;
  if (!own(T, st)) throw new CreditError("sol", "Choose a state.");
  if (!TABLES.sol_columns.includes(debt_type)) throw new CreditError("sol", "Choose a debt type.");
  const row = T[st], years = row[debt_type];
  const out = { state: st, state_name: row.name, debt_type, years, flag: row.flag, extinguished: row.extinguished, disclosure_state: TABLES.sol_disclosure_states.includes(st),
    warnings: ["Estimate from a secondary source. Verify with your state's statute before relying on it.",
      "A payment, even a small one, a written acknowledgment, a new payment plan or new charges can restart the clock in many states.",
      "The statute of limitations decides whether a creditor can win a lawsuit. It does not decide how long the debt can be reported.",
      "Never ignore a summons: respond to every lawsuit, even on an old debt."],
    cite: ["sol_table", "nclc_timebarred", "regf1006_26", "fcra605c"] };
  const lp = parse_date(last_payment || "");
  if (lp) { out.sol_expires = add_months_date(lp, 12 * years); out.time_barred = out.sol_expires < as_of; }
  const d = dofd ? dofd.slice(0, 7) : "";
  if (d) { out.reporting_ends = add_months(d, 12 * 7 + 6); out.reporting_ends_date = reporting_limit(dofd); out.reportable = out.reporting_ends_date >= as_of; }
  return out;
}
// FCRA 605(c): seven years that begin when the 180 days from the start of the delinquency run out; a
// month alone is read as its last day, so the date is never early.
function reporting_limit(dofd) {
  let d = parse_date(dofd || "");
  if (!d) {
    const m = String(dofd || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(m)) throw new CreditError("sol", "Enter the date of first delinquency as YYYY-MM or YYYY-MM-DD.");
    d = add_days(add_months_date(m + "-01", 1), -1);
  }
  return add_months_date(add_days(d, 180), 12 * 7);
}
// ---- the person's own scores narrow the ranges (twin of strategy.calibrate)
const MODEL_FAMILY = [[/VANTAGE/i, "vantage4"], [/FICO\s*(?:SCORE\s*)?(?:9|10)/i, "fico9"], [/FICO\s*(?:SCORE\s*)?8\b|FICO\s*(?:SCORE\s*)?$/i, "fico8"]];
const CHANGE_KINDS = { utilization: "Card balances paid down", collection_removed: "A collection came off", lates_corrected: "Late entries corrected or removed",
  inquiries: "Inquiries came off", au: "Added as an authorized user", new_account: "Opened a new account", none: "Nothing I know of" };
const SCENARIO_KIND = [["utilization", "utilization"], ["remove:", "collection_removed"], ["lates:", "lates_corrected"], ["inquiries", "inquiries"], ["au", "au"], ["secured", "new_account"]];
function model_family(model) { for (const [rx, fam] of MODEL_FAMILY) if (rx.test(model || "")) return fam; return ""; }
function calibrate(sim, scores) {
  const obs = {}, latest = {}, by_model = {};
  for (const x of sortBy(scores || [], (x) => [x.date || "", x.model || ""])) {
    const fam = model_family(x.model || "");
    if (!fam || !Number.isInteger(x.score)) continue;
    latest[fam] = x;
    const prev = own(by_model, x.model) ? by_model[x.model] : null;
    by_model[x.model] = x;
    if (prev && own(CHANGE_KINDS, x.change || "") && x.change !== "none") {
      const k = fam + "|" + x.change;
      (obs[k] = obs[k] || []).push({ delta: x.score - prev.score, from: prev.date, to: x.date, model: x.model });
    }
  }
  const scen = sim.scenarios.map((sc) => {
    const hit = SCENARIO_KIND.find(([k]) => sc.id === k || (k.endsWith(":") && sc.id.startsWith(k)));
    const kind = hit ? hit[1] : "";
    const fams = {};
    for (const fam of Object.keys(sc.families)) {
      const bd = sc.families[fam];
      let b = Object.assign({}, bd);
      const seen = obs[fam + "|" + kind] || [];
      if (seen.length) {
        const lo_o = Math.min(...seen.map((o) => o.delta)), hi_o = Math.max(...seen.map((o) => o.delta));
        const pad = Math.max(3, Math.floor(15 / seen.length));
        let lo = Math.max(bd.low, lo_o - pad), hi = Math.min(bd.high, hi_o + pad), how = "narrowed";
        if (lo_o < bd.low || hi_o > bd.high || lo > hi) { lo = Math.min(bd.low, lo_o); hi = Math.max(bd.high, hi_o); how = "widened"; }
        b = Object.assign(band(lo, hi), { observed: seen, how, prior: { low: bd.low, high: bd.high } });
      }
      if (own(latest, fam)) {
        const now = latest[fam].score;
        b.now = { score: now, model: latest[fam].model, date: latest[fam].date, low: Math.max(300, Math.min(850, now + b.low)), high: Math.max(300, Math.min(850, now + b.high)) };
      }
      fams[fam] = b;
    }
    return Object.assign({}, sc, { families: fams, kind });
  });
  const n = Object.values(obs).reduce((t, v) => t + v.length, 0);
  const note = n ? "Narrowed with " + n + " change" + (n !== 1 ? "s" : "") + " you recorded between scores of the same model. A few observations are not proof; the ranges stay estimates."
    : "Record each score you see with its model and what changed since the last one, and these ranges narrow to what your own scores show.";
  return Object.assign({}, sim, { scenarios: scen, calibration: { observations: n, note, kinds: CHANGE_KINDS } });
}
// ---- what a better rate is worth, at rates the person enters (basis points)
function savings(amount, months, rate_now, rate_goal) {
  if (!Number.isInteger(amount) || amount <= 0 || !Number.isInteger(months) || months < 1 || months > 480) throw new CreditError("savings", "Enter the loan amount and a term of 1 to 480 months.");
  for (const r of [rate_now, rate_goal]) if (!Number.isInteger(r) || r < 0 || r > 5000) throw new CreditError("savings", "Enter rates between 0% and 50%.");
  const pay = (bp) => {
    if (bp === 0) return Math.floor((amount + months - 1) / months);
    const i = bp / 120000.0;
    return Math.floor(amount * i / (1 - Math.pow(1 + i, -months)) + 0.5);
  };
  const a = pay(rate_now), b = pay(rate_goal), ta = a * months - amount, tb = b * months - amount;
  return { amount, months, now: { rate: rate_now, payment: a, interest: ta }, goal: { rate: rate_goal, payment: b, interest: tb }, monthly_difference: a - b, total_difference: ta - tb,
    note: "Payments are rounded to the cent and assume a fixed rate with no fees. Use rates a lender actually quoted you." };
}
// ---- goodwill and negotiation, in writing first
const AGREEMENT_ITEMS = [
  ["written", "The offer and its acceptance are in writing, on the company's letterhead"],
  ["signed", "It is signed by someone who can bind the company, with their name and title"],
  ["names", "It names you, the company, and the account number"],
  ["amount", "It states the exact amount, and it matches what you will pay"],
  ["reporting", "It says how the account will be reported: deleted, or paid in full, at every bureau the company reports to"],
  ["deadline", "It gives a date by which the company will update the bureaus"],
  ["method", "It names the payment method; pay in a way you can trace, never by giving access to your bank account"],
  ["rest", "For a settlement: it says the payment settles the whole balance and the rest will not be sold or collected"],
];
function negotiation_checklist(offer, sol_info, as_of) {
  const kind = offer.kind || "";
  if (!["goodwill", "pay_for_delete", "settlement"].includes(kind)) throw new CreditError("offer", "Choose goodwill, pay-for-delete or settlement.");
  const ag = offer.agreement || {};
  const items = kind === "goodwill" ? [] : AGREEMENT_ITEMS.filter(([k]) => !(k === "rest" && kind !== "settlement")).map(([k, t]) => ({ id: k, text: t, done: ag[k] === true }));
  const warnings = [];
  if (kind !== "goodwill") {
    if (sol_info && sol_info.time_barred) warnings.push("The statute of limitations looks past (" + (sol_info.state_name || "") + " estimate). A payment or a written promise can restart it in many states; talk to a consumer attorney or legal aid first.");
    else warnings.push("Check the statute of limitations first: a payment or a written promise can restart it in many states.");
    warnings.push("A company can take the money and not delete. Pay only after you hold the signed agreement, and keep it: it is your evidence for a dispute.");
    if (kind === "settlement") warnings.push("Forgiven debt can be taxable income; ask a tax professional.");
  }
  const ready = kind === "goodwill" || items.every((x) => x.done);
  let nxt;
  if (offer.paid && !offer.verified) nxt = "Check the next reports from every bureau; if the account is not reported as agreed, dispute it with the signed agreement as evidence.";
  else if (offer.paid) nxt = "Done. Keep the agreement and proof of payment in the vault.";
  else if (kind === "goodwill") nxt = offer.sent ? "Wait for the reply; a goodwill request is a courtesy and many creditors decline." : "Send the goodwill letter.";
  else if (!offer.sent) nxt = "Send the written offer. Do not pay anything yet.";
  else if (!ready) nxt = "Do not pay yet: " + items.filter((x) => !x.done).length + " of the agreement checks are not met.";
  else nxt = "The agreement passes every check. Pay by the agreed method and keep proof.";
  return { kind, items, ready_to_pay: ready && kind !== "goodwill", warnings, next: nxt, cite: kind === "goodwill" ? ["experian_goodwill"] : ["pay_for_delete", "settlement", "sol_table"] };
}

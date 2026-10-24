// ---------------------------------------------------------------- plain words, questions, and "Build my letters"
// The app decides everything it can from the reports, the profile, the findings, the plan and the mail
// log. The person confirms who they are once, answers yes or no to facts only they know, prints and
// mails, and types the tracking numbers. Letters themselves stay formal; only the app's own
// explanations are plain. Every letter still comes from the core's generator, so the honesty rules
// (every claim traced, no date of birth or SSN to a lender or collector) are unchanged.

// ---- letter types in plain words ({B} is the bureau's name); the legal name is shown small beside it
const PLAIN_LETTER = {
  bureau_611: "Ask {B} to fix errors", disclosure_609: "Ask {B} for a full copy of your file", mov_611a7: "Ask {B} how it checked your dispute",
  furnisher_623: "Ask the lender to fix what they report", validation_regf: "Ask a collector to prove the debt", cease_1692c: "Tell a collector to stop contacting you",
  written_only: "Ask a collector to contact you only in writing", pay_for_delete: "Offer to pay if they remove it", settlement: "Offer to settle for less",
  goodwill: "Ask the lender to remove a late payment as a courtesy", block_605b: "Ask {B} to block items from identity theft", personal_info: "Ask {B} to fix your personal details",
  inquiry_removal: "Ask a company why it checked your credit", reinsertion_demand: "Ask {B} why a removed item came back", security_freeze: "Freeze your credit at {B}",
  fraud_alert: "Put a fraud alert on your file", obsolete_605: "Ask {B} to remove items that are too old", cares_act: "Ask {B} to fix late marks during payment relief",
  bankruptcy_correction: "Ask {B} to fix accounts that were in bankruptcy", dispute_notation: "Ask the lender to mark the account as disputed",
  consumer_statement: "Add your own statement to your file", cfpb_complaint: "Complaint to the CFPB (filed online)", state_ag_complaint: "Complaint to your state attorney general",
  intent_to_sue: "Tell them you may take legal action", small_claims_outline: "Small claims court outline",
  child_support_zero_delinquent: "Ask the agency to report child support as zero months late", oag_review_request: "Ask the Texas Attorney General to review a child support notice",
  child_support_records: "Ask for your child support payment record",
};
function plainLetter(kind, bureau) { return (PLAIN_LETTER[kind] || letterTitle(kind)).replace("{B}", bureau ? bname(bureau) : "the bureau"); }
function legalLetter(kind) { return C.TABLES.letters[kind] ? C.TABLES.letters[kind].title : kind; }

// ---- findings in plain words
const RULE_PLAIN = {
  paid_then_late: "Late payments after the account was paid off", max_delinquency_mismatch: "The worst-late note doesn't match the history",
  skipped_step: "A late payment that skips steps", zero_terms_amounts_due: "A $0 monthly payment, but payments listed as due",
  closed_then_activity: "Activity after the account was closed", status_vs_past_due: "Status and amount past due don't match",
  status_vs_latest_month: "Status doesn't match the latest month", missing_dofd: "Missing the date the trouble started", obsolete: "Too old to be reported",
  obsolete_inquiry: "Credit check older than 2 years", reaged: "Set to stay on your report too long", collection_missing_oc: "Collection that doesn't name the original lender",
  duplicate_debt: "The same debt counted twice", sold_with_balance: "Sold account still shows a balance", collector_reported_early: "Collector may have reported before contacting you",
  medical_policy: "Medical collection the bureaus say they don't report", bankruptcy_balance: "Balance on an account that was in bankruptcy",
  name_variant: "A name that may not be yours", address_malformed: "A garbled address", address_variants: "One address listed several ways",
  address_unknown: "An address that may not be yours", phone_invalid: "A phone number that can't be real", phone_variant: "Phone numbers that differ only in area code",
  phone_unknown: "A phone number that may not be yours", employer_unknown: "An employer that may not be yours", identity_mismatch: "Wrong birth date or Social Security digits",
  inquiry_no_account: "A credit check you may not have asked for", cares_act: "Late marks during payment relief", dispute_flag_missing: "Your dispute isn't shown",
  cross_bureau_mismatch: "Bureaus disagree about this account", reinserted: "A removed item came back", not_mine: "An account you say isn't yours",
  identity_theft: "An account from identity theft", child_support_tx: "Child support shown as late",
};
function plainTitle(rule, fallback) { return RULE_PLAIN[rule] || fallback || rule; }
// The values that contradict each other, highlighted in the evidence table.
const CONFLICT = {
  paid_then_late: ["Date paid", "Date closed", "Later late entries"], max_delinquency_mismatch: ["Maximum Delinquency Note", "Worst rating in grid"],
  zero_terms_amounts_due: ["Terms", "Amounts due"], missing_dofd: ["Estimated removal"], obsolete: ["Estimated removal", "Reporting limit", "Late entries older than 7 years", "Inquiry date"],
  status_vs_past_due: ["Pay status", "Past due"], sold_with_balance: ["Remarks", "Balance"],
};
const CONTRADICTION_RULES = new Set(["paid_then_late", "max_delinquency_mismatch", "skipped_step", "zero_terms_amounts_due", "closed_then_activity", "status_vs_past_due",
  "status_vs_latest_month", "duplicate_debt", "sold_with_balance", "reaged", "obsolete", "cross_bureau_mismatch", "missing_dofd"]);
function conflictRow(f, e) {
  if (!CONTRADICTION_RULES.has(f.rule)) return false;
  const c = CONFLICT[f.rule];
  if (f.rule === "duplicate_debt") return / balance$/.test(e.label);
  return c ? c.includes(e.label) : true;
}
function ratingWords(v) {
  const s = String(v || "");
  const m = /^(\w+)(.*)$/.exec(s);
  if (!m) return s;
  const head = m[1].toUpperCase() === "OK" ? "on time" : /^\d+$/.test(m[1]) && m[1] !== "0" ? m[1] + " days late" : m[1];
  return head + m[2];
}
function evv(f, label) { const e = (f.evidence || []).find((x) => x.label === label); return e ? e.value : ""; }
function acctName(f) { return titleCase(String(f.subject || "").replace(/\s+\S*\d\S*$/, "")) || f.subject; }
// What is wrong, in plain words, for one bureau's copy of a finding.
function plainWhat(f) {
  const B = bname(f.bureau), A = acctName(f), ev = f.evidence || [];
  switch (f.rule) {
    case "paid_then_late": return B + " shows " + A + " was " + (evv(f, "Date paid") ? "paid off on " + evv(f, "Date paid") : "paid and closed on " + evv(f, "Date closed")) + ", but also shows you as " + evv(f, "Later late entries") + " after that. Both can't be true.";
    case "max_delinquency_mismatch": return B + "'s note on " + A + " says the worst late payment was \"" + evv(f, "Maximum Delinquency Note") + "\", but the month-by-month history doesn't match it.";
    case "skipped_step": return ev.length >= 2 ? B + " shows " + A + " as " + ratingWords(ev[0].value) + " in " + ev[0].label + ", then " + ratingWords(ev[1].value) + " in " + ev[1].label + ". A payment can't go from on time to that late in one month." : f.facts[0];
    case "zero_terms_amounts_due": return B + " says the monthly payment on " + A + " is $0, but also lists payments due of " + evv(f, "Amounts due") + ". Both can't be true.";
    case "closed_then_activity": return B + " shows " + A + " was closed with a $0 balance on " + evv(f, "Date closed") + ", but still reports activity after that: " + evv(f, "Later activity") + ".";
    case "status_vs_past_due": return B + " calls " + A + " \"" + evv(f, "Pay status") + "\" but also says " + evv(f, "Past due") + " is past due. Those don't match.";
    case "status_vs_latest_month": return B + " calls " + A + " \"" + evv(f, "Pay status") + "\", but its latest month shows a late payment.";
    case "missing_dofd": return B + " reports " + A + " as charged off or in collections, but leaves out the date the trouble started. That date decides when it must come off your report.";
    case "obsolete": return A + " is too old to be on your " + B + " report. Most negative items must come off after 7 years. " + ev.map((e) => e.label + ": " + e.value).join(". ") + ".";
    case "obsolete_inquiry": return "The credit check by " + A + " on " + evv(f, "Inquiry date") + " is more than 2 years old. Credit checks come off after 2 years.";
    case "reaged": return B + " is set to keep " + A + " on your report longer than its own history allows. " + ev.map((e) => e.label + ": " + e.value).join(". ") + ".";
    case "collection_missing_oc": return B + " lists the collection " + A + " without saying who you owed in the first place.";
    case "duplicate_debt": return "The same debt is counted twice on " + B + ": the original lender and a collector both show a balance.";
    case "sold_with_balance": return A + " was sold or transferred, but " + B + " still shows a balance of " + evv(f, "Balance") + ". Once it is sold, it should show $0.";
    case "collector_reported_early": return A + " started reporting this collection on " + evv(f, "Opened (reported)") + ". A collector has to contact you before it reports a debt.";
    case "medical_policy": return A + " is a medical collection. The three bureaus say they no longer report medical collections like this one: " + evv(f, "Why") + ".";
    case "bankruptcy_balance": return A + " was part of your bankruptcy, but " + B + " still shows " + evv(f, "Problem") + ".";
    case "name_variant": return B + " has the name \"" + f.subject + "\" on file. It may not be yours: " + evv(f, "Problem") + ".";
    case "address_malformed": return B + " has a garbled address on file: " + f.subject + ".";
    case "address_variants": return B + " lists one address several different ways: " + evv(f, "Versions") + ".";
    case "address_unknown": return B + " lists an address you may never have lived at: " + f.subject + ".";
    case "phone_invalid": return B + " has a phone number that can't be real: " + f.subject + ". " + evv(f, "Problem").replace(/^./, (c) => c.toUpperCase()) + ".";
    case "phone_variant": return B + " lists phone numbers that differ only in the area code: " + evv(f, "Numbers") + ".";
    case "phone_unknown": return B + " lists a phone number that may not be yours: " + f.subject + ".";
    case "employer_unknown": return B + " lists an employer you may never have worked for: " + f.subject + ".";
    case "identity_mismatch": return B + " has a different " + (f.subject === "SSN" ? "Social Security number" : "date of birth") + " than yours.";
    case "inquiry_no_account": return B + " shows a credit check by " + titleCase(evv(f, "Inquiry")) + " on " + evv(f, "Date") + ", but no new account from them.";
    case "cares_act": return B + " shows late payments on " + A + " during payment relief. The law says those months must be reported as on time.";
    case "dispute_flag_missing": return "You disputed " + A + " with the lender, but " + B + " doesn't show it as disputed.";
    case "cross_bureau_mismatch": return B + " reports " + A + " differently than another bureau does. " + ev.map((e) => e.label + ": " + e.value).join(". ") + ".";
    case "reinserted": return A + " was removed after your dispute, then put back on " + B + " without the notice the law requires.";
    case "not_mine": return "You said " + A + " is not your account.";
    case "identity_theft": return "You said " + A + " came from identity theft.";
    case "child_support_tx": return B + " shows " + A + " as late. If a court set up a payment plan for back support and you pay on time, Texas rules say it must be reported as zero months late.";
    default: return f.facts[0] || f.explain;
  }
}
const CONF_WORDS = { high: "Strong: the report contradicts itself", medium: "Likely: check it against your records", low: "Weak: dispute only if your records back it up", needs_answer: "Needs your answer" };
// What the app will do for a group, in plain words.
function plainDo(g) {
  const f = g.members[0];
  const bs = g.bureaus.map(bname);
  const list = (xs) => (xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);
  const A = acctName(f);
  const B = list(bs);
  const lender = f.account_id ? A : "";
  const base = {
    personal_info: "Ask " + B + " to remove it from your file.", obsolete_605: "Ask " + B + " to remove it because it is too old.",
    validation_regf: "Ask " + A + " to prove the debt and say when it first contacted you.", inquiry_removal: "Ask " + titleCase(evv(f, "Inquiry") || A) + " why it checked your credit.",
    reinsertion_demand: "Ask " + B + " for the notice it owed you, and to remove it again.", block_605b: "Ask " + B + " to block it as identity theft.",
    bankruptcy_correction: "Ask " + B + " to show it as part of your bankruptcy with a $0 balance.", cares_act: "Ask " + B + " to report those months as on time.",
    child_support_zero_delinquent: "Ask the agency that reports it to show it as zero months late.", dispute_notation: "Ask " + A + " to mark the account as disputed.",
  }[f.letter] || (f.rule === "medical_policy" ? "Ask " + B + " to remove it under their own policy." : "Ask " + B + " to fix it.");
  const then = f.then === "furnisher_623" && lender && BUREAU_KINDS.has(f.letter) ? " We'll also ask the lender (" + lender + ") to correct what they report." : "";
  return base + then;
}
function letterCount(g) {
  const f = g.members[0];
  return g.bureaus.length + (f.then === "furnisher_623" && f.account_id && BUREAU_KINDS.has(f.letter) ? 1 : 0);
}

// ---- yes or no questions only the person can answer
// Each question maps to one fact key. "yes" stores the fact as true or false depending on how the
// question is asked; the exact sentence a letter would use is shown small under the question.
function questionFor(f, c) {
  const k = c.key;
  const A = f ? acctName(f) : "";
  if (/:no_contact_before_reporting$/.test(k)) return { q: "Did " + A + " contact you (a letter, email or call) about this debt before " + (f ? evv(f, "Opened (reported)") : "it reported it") + "?", yes: false };
  if (/^name:.*:not_used$/.test(k)) return { q: "Do you ever use the name \"" + (f ? f.subject : "") + "\"?", yes: false };
  if (/^inq:.*:not_authorized$/.test(k)) return { q: "Did you apply for credit with " + titleCase(f ? evv(f, "Inquiry") : "") + " around " + (f ? evv(f, "Date") : "") + "?", yes: false };
  if (/^addr:.*:never_lived$/.test(k)) return { q: "Have you ever lived at " + (f ? f.subject : "this address") + "?", yes: false };
  if (/^phone:.*:not_mine$/.test(k)) return { q: "Is " + (f ? f.subject : "this number") + " a phone number you have used?", yes: false };
  if (/^emp:.*:never$/.test(k)) return { q: "Have you ever worked for " + titleCase(f ? f.subject : "") + "?", yes: false };
  if (k === "bk:discharged") return { q: "Did your bankruptcy case end in a discharge (the court wiped out the debts)?", yes: true };
  if (/:cs_court_plan$/.test(k)) return { q: "Are you on a court-ordered payment plan for back child support, and have you made every payment on time?", yes: true };
  if (k === C.INTENT_KEY) return { q: "If this isn't fixed, do you really plan to take legal action?", yes: true };
  if (k === C.FRAUD_KEY) return { q: "Do you believe someone has used, or may use, your identity to get credit?", yes: true };
  if (/:accommodation$/.test(k)) return { q: c.question, yes: true };
  return { q: "Is this true? \"" + c.sentence + "\"", yes: true };
}
function answerOf(P, key) {
  const facts = P.profile.facts || {};
  if (Object.prototype.hasOwnProperty.call(facts, key)) return facts[key];
  return (P.unsure || {})[key] ? "unsure" : null;
}
function setAnswer(key, value, extra, meta) {
  change(value === null ? "Answer cleared" : "Answer saved", (P) => {
    // keep the question itself, so an answer that removes its finding can still be seen and changed
    if (meta) { P.asked = P.asked || {}; P.asked[key] = { q: meta.q, yes: meta.yes, sentence: meta.sentence || "", label: meta.f ? meta.f.group.label : "" }; }
    P.profile.facts = P.profile.facts || {};
    P.unsure = P.unsure || {};
    delete P.unsure[key];
    if (value === "unsure") { delete P.profile.facts[key]; P.unsure[key] = true; }
    else if (value === null) delete P.profile.facts[key];
    else P.profile.facts[key] = value;
    if (extra) extra(P, value);
  });
}
// A question card: the plain question, three big answers, and the exact sentence the letter would use.
function questionCard(q, f) {
  const ans = answerOf(D.P, q.key);
  const said = ans === null ? null : ans === "unsure" ? "unsure" : ans === q.yes ? "yes" : "no";
  const b = (label, val, word) => el("button", { type: "button", cls: "btn answer", "aria-pressed": said === word ? "true" : "false", id: "q-" + word + "-" + q.key.replace(/[^a-z0-9]/gi, "-"),
    on: { click: () => setAnswer(q.key, said === word ? null : val, q.extra, q) } }, [label]);
  return el("div", { cls: "qcard", "data-q": q.key }, [el("p", { cls: "qq", text: q.q }),
    el("div", { cls: "row" }, [b("Yes", q.yes, "yes"), b("No", !q.yes, "no"), b("Not sure", "unsure", "unsure")]),
    said ? el("p", { cls: "muted small", text: said === "unsure" ? "Not sure: nothing is disputed. You can answer later." : (said === "yes") === q.yes ? "Saved. The letter will say this." : "Saved. This item will not be disputed." }) : null,
    q.sentence ? el("details", { cls: "said" }, [el("summary", { text: "What the letter will say" }), el("p", { cls: "q", text: "“" + q.sentence + "”" })]) : null,
    f ? el("p", { cls: "muted small" }, [el("a", { href: "#/findings/" + f.group.label, text: "See " + f.group.label + ": " + plainTitle(f.rule, f.title) })]) : null]);
}
// Accounts with late marks inside the CARES Act period: ask whether relief covered those months.
function caresQuestions(d) {
  const out = [];
  const start = C.TABLES.cares ? C.TABLES.cares.start : "2020-01-31", end = C.TABLES.cares ? C.TABLES.cares.end : "2023-08-08";
  for (const r of d.reports) for (const a of r.accounts) {
    const hist = a.history || [];
    const lates = hist.filter((h) => C.is_late(h.rating) && h.month >= start.slice(0, 7) && h.month <= end.slice(0, 7));
    if (!lates.length) continue;
    const s = lates[0].month, e = lates[lates.length - 1].month;
    const before = hist.filter((h) => h.month < s);
    if (before.length && C.is_late(before[before.length - 1].rating)) continue;
    const key = "acct:" + a.id + ":accommodation";
    if (out.some((q) => q.key === key)) continue;
    const sentence = "I had a payment accommodation on this account from " + C.us_date(s) + " to " + C.us_date(e) + ", I was current before it began, and I made every payment the accommodation required.";
    out.push({ key, yes: true, sentence, account: a, q: "Did " + titleCase(a.name) + " give you a payment deferment or other relief that covered " + C.us_date(s) + " to " + C.us_date(e) + ", and did you make every payment it asked for?",
      extra: (P, v) => { P.profile.accommodations = (P.profile.accommodations || []).filter((x) => x.account_id !== a.id); if (v === true) P.profile.accommodations.push({ account_id: a.id, start: s + "-01", end: e + "-01" }); } });
  }
  return out;
}
function openQuestions(d) {
  const out = [], seen = new Set();
  for (const f of d.findings.filter((x) => x.current && (x.confidence === "needs_answer" || x.state === "Needs answer"))) {
    for (const c of f.confirm || []) {
      if (seen.has(c.key)) continue;
      seen.add(c.key);
      const q = questionFor(f, c);
      out.push(Object.assign({ key: c.key, sentence: c.sentence, f }, q));
    }
  }
  for (const q of caresQuestions(d)) if (!seen.has(q.key)) { seen.add(q.key); out.push(q); }
  for (const [key, m] of Object.entries(d.P.asked || {})) {
    if (seen.has(key) || answerOf(d.P, key) === null) continue;
    seen.add(key);
    out.push({ key, q: m.q, yes: m.yes, sentence: m.sentence, f: null });
  }
  return out;
}
function pendingQuestions(d) { return openQuestions(d).filter((q) => answerOf(d.P, q.key) === null); }

// ---- who the letters come from: the report's own personal information, confirmed once
const STREET_END = new Set(["AVE", "AVENUE", "ST", "STREET", "RD", "ROAD", "DR", "DRIVE", "LN", "LANE", "CT", "COURT", "BLVD", "WAY", "PL", "PLACE", "CIR", "CIRCLE",
  "TER", "TRL", "TRAIL", "PKWY", "HWY", "SQ", "LOOP", "RUN", "PATH", "PIKE", "ROW", "XING", "PT", "COVE", "CV", "BOX"]);
const UNIT_WORDS = new Set(["APT", "UNIT", "STE", "SUITE", "LOT", "BLDG", "TRLR", "RM", "SPC", "#"]);
// "100 EXAMPLE AVE APT 2 ANYTOWN, TX 75001-1234" -> ["100 Example Ave Apt 2", "Anytown, TX 75001-1234"]
function splitAddress(text) {
  const t = C.norm_space(text).toUpperCase();
  const m = /^(.*?),?\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/.exec(t);
  if (!m) return t ? [titleCase(t)] : [];
  const words = m[1].split(" ");
  let cut = -1;
  for (let i = 0; i < words.length - 1; i++) {
    const w = words[i].replace(/[.,]/g, "");
    if (UNIT_WORDS.has(w)) { cut = Math.min(words.length - 2, i + 1); }
    else if (STREET_END.has(w) && i > 0) cut = Math.max(cut, i);
  }
  if (/,/.test(m[1])) { const k = m[1].lastIndexOf(","); return [titleCase(m[1].slice(0, k)), titleCase(m[1].slice(k + 1).trim()) + ", " + m[2] + " " + m[3]]; }
  if (cut < 0) cut = words.length - 2;
  const street = words.slice(0, cut + 1).join(" "), city = words.slice(cut + 1).join(" ");
  return [titleCase(street).replace(/\bPo Box\b/i, "PO Box"), titleCase(city) + ", " + m[2] + " " + m[3]];
}
function reportIdentity(d) {
  const reps = d.reports.slice().sort((a, b) => (b.personal && b.personal.addresses ? b.personal.addresses.length : 0) - (a.personal && a.personal.addresses ? a.personal.addresses.length : 0));
  const out = { name: "", mailing: [], dob: "", ssn_last4: "" };
  for (const r of reps) {
    const p = r.personal || {};
    const nm = (p.names || []).find((n) => n.kind === "primary");
    if (!out.name && nm) out.name = titleCase(nm.name);
    const ad = (p.addresses || []).find((x) => x.kind === "current") || (p.addresses || [])[0];
    if (!out.mailing.length && ad) out.mailing = splitAddress(ad.text);
    if (!out.dob && /^\d{4}-\d{2}-\d{2}$/.test(p.dob || "")) out.dob = p.dob;
    if (!out.ssn_last4 && /^\d{4}$/.test(p.ssn_last4 || "")) out.ssn_last4 = p.ssn_last4;
  }
  return out;
}
// The identity letters use: what the person confirmed, or what the report shows until they do.
function senderProfile(d) {
  const P = d.P, pr = P.profile || {};
  if (pr.confirmed) return pr;
  const r = reportIdentity(d);
  return Object.assign({}, pr, { name: (pr.mailing || []).length && pr.name ? pr.name : r.name || pr.name, mailing: (pr.mailing || []).length ? pr.mailing : r.mailing,
    dob: pr.dob || r.dob, ssn_last4: pr.ssn_last4 || r.ssn_last4 });
}
function identityConfirmed(d) { return !!(d.P.profile && d.P.profile.confirmed) || S.mode === "example"; }
function identityCard(d, needId) {
  const p = senderProfile(d);
  const editing = S.ui.idEdit || !p.name || !(p.mailing || []).length;
  const f = { name: input({ id: "id-name", value: p.name || "", autocomplete: "name" }), street: input({ id: "id-street", value: (p.mailing || [])[0] || "", autocomplete: "address-line1" }),
    city: input({ id: "id-city", value: (p.mailing || []).slice(1).join(" "), placeholder: "Anytown, TX 75000", autocomplete: "address-level2" }),
    dob: input({ id: "id-dob", type: "date", value: p.dob || "" }), ssn: input({ id: "id-ssn", value: p.ssn_last4 || "", maxlength: 4, inputmode: "numeric", placeholder: "1234" }) };
  const msg = el("p", { cls: "muted small", "aria-live": "polite" });
  const save = () => {
    const name = cleanName(f.name.value, 80), street = cleanName(f.street.value, 100), city = cleanName(f.city.value, 100);
    if (!name || !street || !city) { msg.textContent = "Type your name, your street address and your city, state and ZIP code."; return; }
    if (f.ssn.value && !/^\d{4}$/.test(f.ssn.value)) { msg.textContent = "Type only the last 4 digits of your Social Security number."; return; }
    S.ui.idEdit = false;
    change("Thanks. Your letters will use this name and address.", (P) => { Object.assign(P.profile, { name, mailing: [street, city], dob: f.dob.value || "", ssn_last4: f.ssn.value || "", confirmed: today() }); });
  };
  const missing = needId && (!p.dob || !p.ssn_last4);
  const show = el("dl", { cls: "dl idshow" }, [el("dt", { text: "Name" }), el("dd", { text: p.name || "Not found on your report" }), el("dt", { text: "Address" }), el("dd", { text: (p.mailing || []).join(", ") || "Not found on your report" }),
    el("dt", { text: "Birth date" }), el("dd", { text: p.dob ? mdy(p.dob) : "Not found" }), el("dt", { text: "Social Security, last 4" }), el("dd", { text: p.ssn_last4 || "Not found" })]);
  const ok = identityConfirmed(d);
  const names = d.reports.map((x) => bname(x.bureau));
  const joined = names.length < 2 ? names.join("") : names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
  return card(ok ? "Your letters come from" : "Is this you, and where you live now?", "person", [
    el("p", { cls: "muted", text: ok ? (d.P.profile.confirmed ? "You confirmed this on " + mdy(d.P.profile.confirmed) + "." : "The example person's details.") : (d.reports.length ? "We took this from your " + joined + " report" + (d.reports.length > 1 ? "s" : "") + ". " : "") + "Letters go out under this name and address, so check it once." }),
    editing ? el("div", { cls: "grid2" }, [field("Your name", f.name), field("Street address", f.street), field("City, state and ZIP", f.city), field("Birth date", f.dob, "Bureaus use it to find your file."), field("Social Security, last 4 digits", f.ssn, "Only the last 4. Bureaus use it to find your file.")]) : show,
    !editing && missing ? el("div", { cls: "grid2" }, [p.dob ? null : field("Birth date (bureaus need it to find your file)", f.dob), p.ssn_last4 ? null : field("Social Security, last 4 digits (bureaus need them)", f.ssn)]) : null,
    el("p", { cls: "muted small", text: "Only credit bureaus get your birth date and the last 4 of your Social Security number. Lenders and collectors never do." }), msg,
    el("div", { cls: "row" }, [ok && !editing && !missing ? null : btn(ok ? "Save" : "Yes, this is me", save, { cls: "primary", icon: "check", id: "id-confirm" }),
      editing ? null : btn("Change", () => { S.ui.idEdit = true; render(); }, { icon: "edit", id: "id-edit" })])], null, { cls: "card idcard", id: "identity" });
}

// ---- what to build: every Ready finding, grouped by who receives it, in the plan's order
function chunk(xs, n) { const out = []; for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n)); return out; }
function buildSet(d, only) {
  const P = d.P;
  const plan = P.goal === "auto_soon" ? d.auto : d.plan;
  const groups = new Map();
  const ready = (id) => { const f = d.byId.get(id); return f && f.current && f.state === "Ready" && (!only || only.includes(id)); };
  const put = (key, base, ids, order) => {
    if (!groups.has(key)) groups.set(key, Object.assign({ key, findings: [], order }, base));
    const g = groups.get(key);
    for (const id of ids) if (!g.findings.includes(id)) g.findings.push(id);
    g.order = Math.min(g.order, order);
  };
  const tradeKey = (id) => { const t = d.sameAccount.get(id); return t ? Object.values(t.ids).slice().sort()[0] : id; };
  for (const ph of plan.phases) for (const s of ph.steps) {
    if (s.kind !== "letter" || !s.findings.length || !s.findings.every(ready)) continue;
    const fs = s.findings.map((id) => d.byId.get(id));
    const f = fs[0];
    if (BUREAU_KINDS.has(s.letter)) put(s.letter + "|" + f.bureau, { kind: s.letter, bureau: f.bureau }, s.findings, s.order);
    else if (s.letter === "inquiry_removal") put(s.letter + "|" + f.bureau + "|" + (f.inquiry_id || f.id), { kind: s.letter, bureau: f.bureau, inquiry_id: f.inquiry_id }, s.findings, s.order);
    else if (s.letter === "furnisher_623" || s.letter === "validation_regf" || s.letter === "child_support_zero_delinquent" || s.letter === "dispute_notation") {
      const k = s.letter + "|" + tradeKey(f.account_id);
      const g = groups.get(k);
      if (g && g.bureau !== f.bureau) continue; // one letter per account to the company; it reports to every bureau
      put(k, { kind: s.letter, bureau: f.bureau, account_id: f.account_id }, s.findings, s.order);
    }
  }
  // follow-ups the dates call for: a missed deadline, or a result that kept an item as verified
  if (!only) {
    for (const m of d.overdue) {
      if (d.mail.some((x) => x.followup === m.id)) continue;
      const w = wizardFromQuery(d, { after: m.id });
      for (const x of wizardLetters(d, w)) if (!(C.TABLES.letters[x.kind] || {}).to || C.TABLES.letters[x.kind].to !== "complaint") put("after|" + m.id + "|" + x.kind + "|" + x.bureau + "|" + x.account_id, Object.assign({}, x, { followup: m.id, why: "Its reply was due " + mdy(m.due) + " and did not come. The missed deadline is the new fact in this letter." }), x.findings, -1);
    }
    const verified = d.groups.filter((g) => g.state === "Verified" && g.current);
    for (const g of verified) {
      const ids = g.members.map((m) => m.id);
      if (d.mail.some((m) => !m.outcome && m.letter === "mov_611a7" && (m.findings || []).some((id) => ids.includes(id)))) continue;
      const w = wizardFromQuery(d, { f: ids.join(","), kind: "mov_611a7" });
      if (!w.opts.log) continue;
      for (const x of wizardLetters(d, w)) put("mov|" + x.bureau + "|" + g.label, Object.assign({}, x, { why: "The bureau kept " + g.label + " as verified. Next, ask how it checked." }), x.findings, 0);
    }
  }
  const out = [];
  for (const g of Array.from(groups.values()).sort((a, b) => a.order - b.order)) {
    if (g.followup || g.why) { out.push(g); continue; }
    if (BUREAU_KINDS.has(g.kind)) {
      // keep each letter to five accounts so every item gets read
      const byAcct = new Map();
      for (const id of g.findings) { const f = d.byId.get(id); const k = f.account_id || f.subject; if (!byAcct.has(k)) byAcct.set(k, []); byAcct.get(k).push(id); }
      const parts = chunk(Array.from(byAcct.values()), 5);
      parts.forEach((p, i) => out.push(Object.assign({}, g, { key: g.key + "|" + i, findings: p.flat(), part: parts.length > 1 ? i + 1 + " of " + parts.length : "" })));
    } else out.push(g);
  }
  return out.map((g, i) => {
    const fs = g.findings.map((id) => d.byId.get(id)).filter(Boolean);
    const rep = reportFor(d, g.bureau, g.account_id);
    const a = g.account_id ? rep.accounts.find((x) => x.id === g.account_id) : null;
    const q = g.inquiry_id ? rep.inquiries.find((x) => x.id === g.inquiry_id) : null;
    const to = g.to || (BUREAU_KINDS.has(g.kind) ? bname(g.bureau) : q ? titleCase(q.name) : a ? titleCase(a.name) : "Recipient");
    const fromReport = !BUREAU_KINDS.has(g.kind) && (a ? !!a.address : q ? !!q.location : false);
    const opts = Object.assign({}, g.opts || {}, g.account_id ? { account_id: g.account_id } : {}, g.inquiry_id ? { inquiry_id: g.inquiry_id } : {});
    // an address the person typed for a company the report gives none for
    const book = (P.addressBook || {})[C.norm_name(a ? a.name : q ? q.name : "")];
    const needAddr = !BUREAU_KINDS.has(g.kind) && !fromReport && !(g.opts && g.opts.recipient) && (a || q);
    if (needAddr && book) opts.recipient = { name: a ? a.name : q.name, lines: book.slice() };
    const why = g.why || (g.kind === "furnisher_623" ? "The lender reports this account to every bureau. Asking it directly fixes the source." :
      BUREAU_KINDS.has(g.kind) ? plural(new Set(fs.map((f) => f.account_id || f.subject)).size, "item") + " " + bname(g.bureau) + " reports wrong. Each bureau keeps its own file, so each gets its own letter." :
      g.kind === "validation_regf" ? "You said the collector did not contact you first. It must prove the debt." : g.kind === "inquiry_removal" ? "You said you did not apply. The company must show why it checked your credit." : "");
    return { key: g.key, kind: g.kind, bureau: g.bureau || "", account_id: g.account_id || "", findings: fs.map((f) => f.id), opts, to, why, followup: g.followup || "", fromReport,
      noAddr: !!(needAddr && !book), bookKey: needAddr ? C.norm_name(a ? a.name : q.name) : "", part: g.part || "", n: i + 1 };
  });
}
// The report gives no address for this company: ask for it right here, once.
function addrAsk(x) {
  const st = input({ id: "addr1-" + x.key.replace(/[^a-z0-9]/gi, "-"), placeholder: "PO Box 123", "aria-label": "Street or PO Box for " + x.to });
  const ct = input({ id: "addr2-" + x.key.replace(/[^a-z0-9]/gi, "-"), placeholder: "Anytown, TX 75000", "aria-label": "City, state and ZIP for " + x.to });
  return el("div", { cls: "note warn" }, [icon("alert"), el("div", { cls: "stack", style: "gap:var(--s-2)" }, [el("p", { text: "Your report has no mailing address for " + x.to + ". Type the address from a statement or their website (look for \"credit reporting disputes\" or \"correspondence\")." }),
    el("div", { cls: "grid2" }, [field("Street or PO Box", st), field("City, state and ZIP", ct)]),
    btn("Save the address", () => { const l1 = cleanName(st.value, 100), l2 = cleanName(ct.value, 100); if (!l1 || !/,?\s+[A-Za-z]{2}\s+\d{5}(-\d{4})?$/.test(l2)) { toast("Type the street, then the city, state and ZIP, like: Anytown, TX 75000"); return; }
      change("Address saved for " + x.to, (P) => { P.addressBook = Object.assign({}, P.addressBook, { [x.bookKey]: [l1, l2] }); }); }, { cls: "sm primary" })])]);
}
// Draft every letter with the identity the person confirmed (or the report's, until they do).
function buildAll(d, set) {
  const prof = senderProfile(d);
  const dd = Object.assign({}, d, { P: Object.assign({}, d.P, { profile: prof }) });
  return set.map((x) => {
    try {
      const L = buildLetter(dd, x);
      if (x.followup) { const m = d.P.mail.find((z) => z.id === x.followup); if (m) L.enclosures = L.enclosures.concat(["Copy of my earlier letter dated " + mdy(m.mailed) + " and its certified mail receipt"]); }
      return { x, L };
    } catch (e) { return { x, err: plainError(e.message || String(e)) }; }
  });
}
// Never leave a letter undrafted without saying exactly what to do.
function plainError(m) {
  if (/name and mailing address/.test(m)) return "Confirm your name and address in the card above, then this letter is drafted.";
  if (/Answer the question/.test(m)) return "Answer the question for this item above first.";
  if (/five|items or fewer/.test(m)) return "Too many items for one letter; it is split into more letters automatically.";
  return m;
}
function packetIndex(built, d) {
  const lines = [["Your letters, ready to mail", "title"], ["Made " + longDate(d.today) + " on this device. Information, not legal advice.", "plain"], ["What is in this packet", "head"]];
  built.forEach((b, i) => lines.push([(i + 1) + ". " + b.x.to + ": " + plainLetter(b.L.kind, b.x.bureau) + (b.x.fromReport ? " (address from your report: check it before mailing)" : b.x.noAddr ? " (no address on your report: write it on the envelope before mailing)" : ""), "bullet"]));
  lines.push(["How to mail them", "head"], ["1. Sign and date each letter.", "plain"], ["2. Put the copies listed on its cover sheet in the envelope. Send copies, never originals.", "plain"],
    ["3. Mail each one by certified mail with a return receipt. Keep the receipt.", "plain"], ["4. Type each tracking number into " + C.PRODUCT_NAME + ". The legal clock starts when they receive it.", "plain"], [C.SUITE_LINE, "plain"]);
  return lines;
}
function envelopePage(L) {
  return [["Envelope", "title"], ["Print on an envelope, or copy by hand.", "plain"], ["From", "head"], [L.sender.name, "tight"]].concat(L.sender.lines.map((x) => [x, "tight"]),
    [["To", "head"], [L.recipient.name, "tight"]], L.recipient.lines.map((x) => [x, "tight"]), [["Send by certified mail with a return receipt.", "plain"]]);
}
function packetPdf(built, d) {
  return C.pdf_doc([packetIndex(built, d)].concat(built.flatMap((b) => [C.cover_sheet(b.L, ""), C.letter_paragraphs(b.L), envelopePage(b.L)])));
}
// An address for the screen: title case, with the state and PO Box kept as they are written.
function showAddr(parts) { return parts.map((x) => (x === x.toUpperCase() ? titleCase(x) : x).replace(/\bPo Box\b/g, "PO Box").replace(/\bP\.o\. Box\b/g, "P.O. Box").replace(/,\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/, (m, st, z) => ", " + st.toUpperCase() + " " + z)).join(", "); }
function fileName(L, ext) { return (L.kind + "-" + (L.recipient.name || "letter")).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60) + "." + ext; }
// Print: the packet PDF, and a mailing log entry per letter that waits for its tracking number.
function printPacket(d, built) {
  const good = built.filter((b) => b.L);
  if (!good.length) return;
  download("letters-" + d.today + ".pdf", packetPdf(good, d), "application/pdf");
  change("Printed " + plural(good.length, "letter") + ". Next: mail them and type the tracking numbers.", (P) => {
    good.forEach((b, i) => {
      const id = "m" + Date.now().toString(36) + i.toString(36);
      P.mail.push({ id, letter: b.L.kind, bureau: b.x.bureau || b.L.bureau || "", to: b.x.to, round: P.rounds.length, findings: (b.L.findings || []).slice(), account_id: b.x.account_id || "",
        mailed: "", delivered: "", tracking: "", card: false, outcome: "", L: b.L, followup: b.x.followup || "", printed: d.today, fromReport: !!b.x.fromReport });
    });
  });
}
function docxZip(built) {
  const names = new Set();
  return C.zip_stored(built.filter((b) => b.L).map((b) => { let n = fileName(b.L, "docx"); let k = 2; while (names.has(n)) n = n.replace(/(-\d+)?\.docx$/, "-" + k++ + ".docx"); names.add(n); return [n, C.docx(b.L)]; }));
}
// Mark a printed letter as mailed: its tracking number and the mailing date.
function markMailed(id, tracking, date) {
  change("Mailed. The deadline starts when they receive it.", (P) => {
    const m = P.mail.find((x) => x.id === id);
    if (!m) return;
    m.mailed = date || today(); m.tracking = cleanName(tracking, 40);
    P.vault.push({ id: "v-" + id, name: letterTitle(m.letter) + " to " + m.to + ".txt", kind: "Letter", account: "", date: m.mailed, type: "text/plain", text: C.letter_text(m.L) });
    if (m.followup) { const o = P.mail.find((z) => z.id === m.followup); if (o && !o.outcome) { o.outcome = "no_response"; o.completed = ""; } }
  });
}
function draftsCard(d) {
  const drafts = d.mail.filter((m) => !m.mailed && !m.outcome);
  if (!drafts.length) return null;
  const rows = drafts.map((m) => {
    const trk = input({ id: "trk-" + m.id, inputmode: "numeric", placeholder: "Tracking number", "aria-label": "Tracking number for " + m.to, cls: "input acctno" });
    const dt = input({ id: "mdt-" + m.id, type: "date", value: d.today, "aria-label": "Date mailed" });
    return el("li", { cls: "draft" }, [el("div", null, [el("b", { text: m.to }), el("br"), el("span", { cls: "muted small", text: plainLetter(m.letter, m.bureau) + (m.fromReport ? ". Address from your report: check it before mailing." : "") })]),
      el("div", { cls: "row" }, [trk, dt, btn("Mailed", () => { if (!trk.value.trim()) { toast("Type the tracking number from the certified mail receipt."); trk.focus(); return; } markMailed(m.id, trk.value, dt.value); }, { cls: "primary sm", id: "mailed-" + m.id }),
        btn("Remove", () => change("Removed the printed letter to " + m.to, (P) => { P.mail = P.mail.filter((x) => x.id !== m.id); }), { cls: "sm quiet" })])]);
  });
  return card("Mail them and type the tracking numbers", "certified", [el("p", { text: "Send each letter by certified mail with a return receipt. Type the tracking number from the receipt. The legal deadline starts when they receive it." }),
    el("ul", { cls: "rows drafts" }, rows),
    el("div", { cls: "row" }, [btn("Word files (ZIP)", () => download("letters-" + d.today + "-docx.zip", docxZip(drafts.map((m) => ({ x: {}, L: m.L }))), "application/zip"), { icon: "download", id: "drafts-docx" }), btn("Print these again", () => download("letters-" + d.today + ".pdf", packetPdf(drafts.map((m) => ({ x: { to: m.to, bureau: m.bureau, fromReport: m.fromReport }, L: m.L })), d), "application/pdf"), { icon: "print", id: "reprint" })])], null, { cls: "card", id: "drafts" });
}
function questionsCard(d, qs) {
  if (!qs.length) return null;
  const open = qs.filter((q) => answerOf(d.P, q.key) === null).length;
  return card(open ? "Questions only you can answer (" + open + ")" : "Your answers", "help", [el("p", { cls: "muted", text: "Answer what you know. Each yes or no updates the letters right away. Nothing waits on these; skip any you are not sure about." })]
    .concat(qs.map((q) => questionCard(q, q.f))), null, { cls: "card", id: "questions" });
}
VIEWS.build = null; // routed from Letters: #/letters/build
function buildView(d, r) {
  const only = r.q.f ? r.q.f.split(",").filter(Boolean) : null;
  const set = buildSet(d, only);
  const built = buildAll(d, set);
  const good = built.filter((b) => b.L);
  const qs = openQuestions(d).filter((q) => !only || (q.f && only.includes(q.f.id)));
  const confirmed = identityConfirmed(d);
  const needId = set.some((x) => BUREAU_KINDS.has(x.kind));
  const drafts = draftsCard(d);
  const list = built.map((b) => {
    const x = b.x;
    const addr = b.L ? showAddr([b.L.recipient.name].concat(b.L.recipient.lines)) : "";
    return el("li", { cls: "bl" }, [el("span", { cls: "ix", text: String(x.n).padStart(2, "0") }),
      el("div", null, [el("b", { text: plainLetter(x.kind, x.bureau) + (x.part ? " (" + x.part + ")" : "") }), el("span", { cls: "legal", text: legalLetter(x.kind) }),
        el("p", { cls: "small", text: "To " + addr + (x.account_id ? ". About account " + masked((reportFor(d, x.bureau, x.account_id).accounts.find((a) => a.id === x.account_id) || {}).number) : "") }),
        x.fromReport ? el("p", { cls: "flag small" }, [icon("alert", "ico sm"), " Address from your report. Check it before mailing."]) : null,
        x.noAddr ? addrAsk(x) : null,
        b.err ? note("bad", "alert", [el("p", { text: b.err })]) : el("p", { cls: "muted small", text: (x.findings.length ? x.findings.map((id) => { const f = d.byId.get(id); return f ? f.group.label : ""; }).filter((v, i, a) => v && a.indexOf(v) === i).join(", ") + ". " : "") + x.why }),
        b.L ? el("details", { cls: "change" }, [el("summary", { text: "Change" }), el("div", { cls: "row" }, [btn("Open this letter", () => { S.ui.draft = { L: b.L, x, followup: x.followup }; go("#/letters/draft"); }, { cls: "sm" }),
          link("Customize it", "#/letters/new?" + (x.followup ? "after=" + x.followup : "f=" + x.findings.join(",") + "&kind=" + x.kind), { cls: "sm quiet" }),
          btn("DOCX", () => download(fileName(b.L, "docx"), C.docx(b.L), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), { cls: "sm quiet" })])]) : null])]);
  });
  const pendingQ = qs.filter((q) => answerOf(d.P, q.key) === null).length;
  const k = keyAnswer("Letters ready", String(good.length), good.length ? "Each one says only what your report shows or what you confirmed. " + (pendingQ ? plural(pendingQ, "question") + " below can add more." : "")
    : drafts ? "Your printed letters are below. Mail them, then type the tracking numbers." : pendingQ ? "Nothing to send yet. Answer the questions below; a yes can add a letter." : "Nothing to send right now. When a deadline passes or a new report comes in, the next letters show up here.");
  const printBtn = btn(confirmed ? "Print all " + plural(good.length, "letter") + " (one PDF)" : "Confirm your name and address first", () => { if (!identityConfirmed(D)) { const c = $("identity"); if (c) c.scrollIntoView(); toast("Confirm your name and address first."); return; } printPacket(d, built); },
    { cls: "primary", icon: "print", id: "build-print", disabled: !good.length || !confirmed });
  const acts = good.length ? el("div", { cls: "row" }, [printBtn, btn("All as Word files (ZIP)", () => download("letters-" + d.today + "-docx.zip", docxZip(built), "application/zip"), { icon: "download", id: "build-docx", disabled: !good.length })]) : null;
  const body = [el("div", { cls: "cols" }, [el("div", { cls: "stack" }, [k, good.length ? acts : null]), good.length || needId ? identityCard(d, needId) : null])];
  if (built.length) body.push(card("Your letters, in the order to send them", "letters", [el("ul", { cls: "rows buildlist" }, list),
    el("p", { cls: "muted small", text: "Each letter comes with a cover sheet and an envelope page. The cover sheet lists what to put in the envelope and how to send it. They are in the order your plan sets" + (d.P.goal === "auto_soon" ? " for a loan soon" : "") + "." })], null, { cls: "card", id: "build-list" }));
  if (drafts) body.push(drafts);
  const qc = questionsCard(d, qs);
  if (qc) body.push(qc);
  body.push(el("p", { cls: "muted small" }, ["Want a different letter? ", el("a", { href: "#/letters/new", text: "Write one yourself (advanced)" }), "."]));
  return { title: "Build my letters", crumb: "Letters / Build", body };
}

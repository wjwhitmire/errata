// ---------------------------------------------------------------- letters with traced claims (twin of letters.py; see its notes on sources)
const BUREAU_LETTERS = new Set(["bureau_611", "disclosure_609", "mov_611a7", "block_605b", "personal_info", "reinsertion_demand", "obsolete_605", "cares_act", "bankruptcy_correction", "consumer_statement", "security_freeze", "fraud_alert"]);
const FURNISHER_LETTERS = new Set(["furnisher_623", "dispute_notation", "validation_regf", "cease_1692c", "written_only", "pay_for_delete", "settlement", "goodwill", "inquiry_removal", "intent_to_sue",
  "child_support_zero_delinquent", "oag_review_request", "child_support_records"]);
const COMPLAINTS = new Set(["cfpb_complaint", "state_ag_complaint", "small_claims_outline"]);
const MAX_ITEMS = 5;
const INTENT_KEY = "intent:pursue_claim";
const INTENT_SENTENCE = "If this is not corrected, I intend to pursue my remedies under the Fair Credit Reporting Act and to consult a consumer attorney about doing so.";
const FRAUD_KEY = "fraud:suspect";
const FRAUD_SENTENCE = "I suspect in good faith that I have been, or am about to become, a victim of fraud or identity theft.";
const OAG_DEFAULT = { name: "Office of the Attorney General, Child Support Division", lines: ["(the address printed on your notice)"] };
function blk(kind, text, src, asserts) { return { kind, text: kind !== "pre" ? norm_space(text) : text, src: src.slice(), asserts: !!asserts }; }
function sec(k) { return TABLES.citations[k].cite; }
function bureau_recipient(bureau, overrides) {
  const o = (overrides || {})[bureau];
  if (o) return { name: o.name, lines: o.lines.slice() };
  const b = TABLES.bureaus[bureau];
  if (!b) throw new CreditError("letter", "Choose the bureau this letter goes to.");
  return { name: b.name, lines: b.lines.slice() };
}
function account_recipient(a) {
  if (!a) throw new CreditError("letter", "Choose the account this letter is about.");
  return { name: a.name, lines: a.address ? [a.address] : ["(address: check the report or your statements)"] };
}
function letter_sender(profile) {
  const name = norm_space(profile.name || ""), lines = (profile.mailing || []).map(norm_space).filter((x) => x);
  if (!name || !lines.length) throw new CreditError("letter", "Add your name and mailing address under People first.");
  return { name, lines };
}
function identity_blocks(profile, bureau_letter) {
  const out = [blk("p", "My identifying information:", ["template"])];
  out.push(blk("id", "Name: " + profile.name, ["profile"], true));
  out.push(blk("id", "Current address: " + (profile.mailing || []).join(", "), ["profile"], true));
  if (bureau_letter) {
    if (profile.dob) out.push(blk("id", "Date of birth: " + us_date(profile.dob), ["profile"], true));
    if (profile.ssn_last4) out.push(blk("id", "Social Security number, last four digits: " + profile.ssn_last4, ["profile"], true));
  }
  return out;
}
function finding_items(findings, accounts) {
  const blocks = [], seen = {};
  let n = 0;
  for (const f of findings) {
    const key = f.account_id || f.subject;
    if (!own(seen, key)) {
      n++;
      seen[key] = n;
      const a = accounts[f.account_id];
      blocks.push(blk("item", a && a.number ? n + ". " + a.name + ", account " + a.number : n + ". " + f.subject, ["finding:" + f.id]));
    }
    for (const s of f.facts) blocks.push(blk("p", s, ["finding:" + f.id], true));
    blocks.push(blk("p", f.request, ["finding:" + f.id]));
  }
  return blocks;
}
function letter_base(kind, report, profile, as_of, recipient, subject, include_id) {
  const meta = TABLES.letters[kind];
  return { kind, title: meta.title, date: as_of, sender: letter_sender(profile), recipient, subject, blocks: [], enclosures: [], cite: meta.cite.slice(), include_id,
    bureau: report ? report.bureau || "" : "", warnings: [] };
}
const PRIOR_LETTERS = ["bureau_611", "obsolete_605", "personal_info", "cares_act", "bankruptcy_correction"];
function generate_letter(kind, report, findings, profile, as_of, opts) {
  if (!own(TABLES.letters, kind)) throw new CreditError("letter", "Unknown letter type: " + String(kind));
  opts = opts || {}; profile = profile || {}; findings = (findings || []).slice();
  for (const f of findings) {
    if (f.confidence === "needs_answer") throw new CreditError("letter", "Answer the question for " + f.subject + " first; nothing is disputed until you confirm it.");
    if ((f.status || "open") !== "open") throw new CreditError("letter", f.subject + " is marked " + f.status + "; reopen it to use it in a letter.");
  }
  report = report || {};
  const accounts = {};
  for (const a of report.accounts || []) accounts[a.id] = a;
  const bureau = report.bureau || "", bname = own(BUREAU_NAMES, bureau) ? BUREAU_NAMES[bureau] : "the bureau";
  const file_no = (report.source || {}).file_number || "", to = TABLES.letters[kind].to;
  const firstAcct = opts.account_id || (findings.length ? findings[0].account_id || "" : "");
  let rec;
  if (to === "bureau") rec = opts.recipient || bureau_recipient(bureau, opts.bureau_overrides);
  else if (to === "inquirer") {
    const q = (report.inquiries || []).find((x) => x.id === opts.inquiry_id || (findings.length && x.id === findings[0].inquiry_id));
    rec = opts.recipient || { name: q ? q.name : "", lines: q && q.location ? [q.location] : ["(address)"] };
  } else if (to === "furnisher") rec = opts.recipient || account_recipient(accounts[firstAcct]);
  else if (to === "agency") rec = opts.recipient || { name: OAG_DEFAULT.name, lines: OAG_DEFAULT.lines.slice() };
  else rec = opts.recipient || { name: "", lines: [] };
  const ref = file_no && to === "bureau" ? " (file number " + file_no + ")" : "";
  const acct = accounts[firstAcct], acct_ref = acct ? acct.name + ", account " + acct.number : "";
  let L = null;
  const B = [];
  const nItems = () => new Set(findings.map((f) => f.account_id || f.subject)).size;
  const STD_ENC = ["Copy of a government photo ID", "Copy of a recent utility bill or bank statement showing my address"];
  if (["bureau_611", "obsolete_605", "cares_act", "bankruptcy_correction"].includes(kind)) {
    if (!findings.length) throw new CreditError("letter", "Pick at least one finding for this letter.");
    if (nItems() > MAX_ITEMS) throw new CreditError("letter", "Keep a letter to " + MAX_ITEMS + " items or fewer; send the rest in a second letter.");
    const subj = { bureau_611: "Dispute of inaccurate information", obsolete_605: "Request to remove obsolete information", cares_act: "Dispute of late payments during a CARES Act accommodation",
      bankruptcy_correction: "Correction of accounts included in bankruptcy" }[kind] + ref;
    L = letter_base(kind, report, profile, as_of, rec, subj, true);
    const intro = {
      bureau_611: "I am writing to dispute information in my " + bname + " credit file. Each item below is inaccurate or incomplete for the reason stated with it. Please reinvestigate each item free of charge and delete or correct it, as " + sec("fcra611") + " requires, and review the information I send, as " + sec("fcra611a4") + " requires.",
      obsolete_605: "I am writing about information in my " + bname + " credit file that is past the period " + sec("fcra605") + " allows. For collections and charge-offs, the seven years begin 180 days after the delinquency that preceded the collection or charge-off (" + sec("fcra605c") + ").",
      cares_act: "I am writing to dispute late payments in my " + bname + " credit file that were reported during a payment accommodation. " + sec("fcra623a1f") + " requires an account that was current before an accommodation made during the covered period, and on which the consumer made the payments the accommodation required, to be reported as current.",
      bankruptcy_correction: "I am writing to correct accounts in my " + bname + " credit file that were included in my bankruptcy. After a discharge, an included account should show a $0 balance and an included-in-bankruptcy status.",
    }[kind];
    B.push(blk("p", intro, ["template"]));
    const prior = opts.prior || {};
    if (prior.delivered) {
      // a second dispute after a missed deadline: the silence is the new information (611(a)(3))
      B.push(blk("p", "My " + (prior.what || "earlier request") + " was delivered to you on " + us_date(prior.delivered) + ".", ["log:" + (prior.id || "")], true));
      if (prior.due) B.push(blk("p", "Your response was due by " + us_date(prior.due) + ", and I have not received it.", ["log:" + (prior.id || "")], true));
    }
    B.push(...finding_items(findings, accounts));
    B.push(blk("p", "For any item you do not delete, please send me the name, address and telephone number of each furnisher you contacted and a description of how you verified the item (" + sec("fcra611a7") + ").", ["template"]));
    L.enclosures = STD_ENC.concat(["Copy of the " + bname + " report pages with each item marked"]);
    for (let i = 0; i < nItems(); i++) L.enclosures.push("Supporting documents for item " + (i + 1));
    if (kind === "bankruptcy_correction") L.enclosures.push("Copy of the bankruptcy discharge order and the schedule listing these accounts");
    if (kind === "cares_act") L.enclosures.push("Copy of the accommodation agreement (forbearance or deferment)");
  } else if (kind === "personal_info") {
    if (!findings.length) throw new CreditError("letter", "Pick at least one personal information finding.");
    L = letter_base(kind, report, profile, as_of, rec, "Correction of personal information" + ref, true);
    B.push(blk("p", "I am writing to correct personal information in my " + bname + " credit file. Each item below is inaccurate for the reason stated with it. Please remove or correct them and keep my file accurate, as " + sec("fcra611") + " and " + sec("fcra607b") + " require.", ["template"]));
    findings.forEach((f, i) => {
      B.push(blk("item", (i + 1) + ". " + f.subject, ["finding:" + f.id]));
      for (const s of f.facts) B.push(blk("p", s, ["finding:" + f.id], true));
      for (const c of f.confirm || []) if ((profile.facts || {})[c.key] === true && !f.facts.includes(c.sentence)) B.push(blk("p", c.sentence, ["fact:" + c.key], true));
      B.push(blk("p", f.request, ["finding:" + f.id]));
    });
    L.enclosures = STD_ENC.slice();
  } else if (kind === "disclosure_609") {
    L = letter_base(kind, report, profile, as_of, rec, "Request for disclosure of my file", true);
    B.push(blk("p", "Under " + sec("fcra609") + ", please send me all information in my file, the sources of that information, the name of each person who obtained my report in the last year (two years for employment purposes), and the record of inquiries I did not initiate.", ["template"]));
    B.push(blk("p", "This is a request for disclosure. It is not a dispute.", ["template"]));
    L.enclosures = STD_ENC.slice();
  } else if (kind === "mov_611a7") {
    const log = opts.log || {};
    if (!log.delivered) throw new CreditError("letter", "Pick the earlier dispute in the mail log (with its delivery date) that this request follows.");
    L = letter_base(kind, report, profile, as_of, rec, "Request for the description of the verification procedure" + ref, true);
    B.push(blk("p", "My dispute was delivered to you on " + us_date(log.delivered) + ".", ["log:" + (log.id || "")], true));
    if (log.result_date) B.push(blk("p", "Your results, dated " + us_date(log.result_date) + ", say the following items were verified.", ["log:" + (log.id || "")], true));
    B.push(...finding_items(findings, accounts).filter((x) => x.kind === "item"));
    B.push(blk("p", "Under " + sec("fcra611a7") + ", please send me, within 15 days of receiving this request, a description of the procedure you used to determine the accuracy and completeness of each item, including the business name, address and telephone number of each furnisher you contacted.", ["template"]));
  } else if (kind === "furnisher_623") {
    if (!findings.length || !acct) throw new CreditError("letter", "Pick the findings for one account.");
    if (new Set(findings.map((f) => f.account_id)).size > 1) throw new CreditError("letter", "A direct dispute covers one account; make one letter per furnisher account.");
    L = letter_base(kind, report, profile, as_of, rec, "Direct dispute: " + acct_ref, false);
    B.push(blk("p", "I dispute information you furnish to the credit bureaus about my account " + acct_ref + ". I send this to the address shown on my credit report, under " + sec("fcra623a8") + " and " + sec("regv1022_43") + ".", ["template"]));
    for (const f of findings) { for (const s of f.facts) B.push(blk("p", s, ["finding:" + f.id], true)); B.push(blk("p", f.request, ["finding:" + f.id])); }
    B.push(blk("p", "Please investigate, report the result to me, correct the information with every bureau you report to, and report the account as disputed while the dispute is open (" + sec("fcra623a3") + ").", ["template"]));
    L.enclosures = ["Copy of the credit report page showing the account, with the items marked", "Supporting documents"];
  } else if (kind === "dispute_notation") {
    const log = opts.log || {};
    if (!acct || !log.delivered) throw new CreditError("letter", "Pick the account and the earlier direct dispute in the mail log.");
    L = letter_base(kind, report, profile, as_of, rec, "Report my account as disputed: " + acct_ref, false);
    B.push(blk("p", "My direct dispute about account " + acct_ref + " was delivered to you on " + us_date(log.delivered) + ".", ["log:" + (log.id || "")], true));
    for (const f of findings) for (const s of f.facts) B.push(blk("p", s, ["finding:" + f.id], true));
    B.push(blk("p", sec("fcra623a3") + " does not allow you to furnish information about a disputed account without notice that it is disputed. Please report the account as disputed by the consumer to every bureau you report to while the dispute is open.", ["template"]));
  } else if (kind === "validation_regf") {
    if (!acct) throw new CreditError("letter", "Pick the collection account.");
    L = letter_base(kind, report, profile, as_of, rec, "Dispute and request for validation: " + acct_ref, false);
    const rec_d = parse_date(opts.notice_received || "") || "";
    const period_end = rec_d ? add_days(rec_d, 30) : "";
    const inside = !!period_end && as_of <= period_end;
    if (inside) B.push(blk("p", "I am writing about the debt you report as account " + acct_ref + ". I dispute this debt. Please send me verification of the debt, and the name and address of the original creditor, and stop collection until you do (" + sec("regf1006_38") + "; " + sec("fdcpa1692g") + ").", ["template"]));
    else {
      B.push(blk("p", "I am writing about the debt you report as account " + acct_ref + ". I dispute this debt. Please send me verification of the debt and the name and address of the original creditor, and report the debt as disputed to any credit bureau you report it to (" + sec("fdcpa1692e8") + ").", ["template"]));
      L.warnings.push("The stop-collection right in 12 CFR 1006.38 applies to a dispute made within the validation period (30 days after you receive the validation notice)" +
        (period_end ? ", which ended " + us_date(period_end) : "; add the date you received the notice to check it") + ". A later dispute still has to be reported as disputed, and you can still dispute with the bureaus.");
    }
    if (rec_d) B.push(blk("p", "I received your validation notice on " + us_date(rec_d) + ".", ["user:notice_received"], true));
    if (inside && days_between(as_of, period_end) <= 10) L.warnings.push("The validation period ends " + us_date(period_end) + ". Mail this today with tracking so it arrives before then.");
    for (const f of findings) {
      for (const s of f.facts) {
        let src = ["finding:" + f.id];
        for (const c of f.confirm || []) if (c.sentence === s) src = ["fact:" + c.key];
        B.push(blk("p", s, src, true));
      }
      if (f.rule === "collector_reported_early") B.push(blk("p", "Please also tell me the date and the method of your first communication with me about this debt. A debt collector may not report a debt to a credit bureau before it communicates with the consumer (" + sec("regf1006_30a") + ").", ["template"]));
    }
    B.push(blk("p", "Please send everything in writing to the address above.", ["template"]));
  } else if (kind === "cease_1692c") {
    if (!acct) throw new CreditError("letter", "Pick the collection account.");
    L = letter_base(kind, report, profile, as_of, rec, "Request to stop communication: " + acct_ref, false);
    B.push(blk("p", "Under " + sec("fdcpa1692c") + ", please stop communicating with me about the debt you report as account " + acct_ref + ".", ["template"]));
    L.warnings.push("A stop request does not erase the debt, and on a debt that is still within the statute of limitations it can push a collector toward a lawsuit.");
  } else if (kind === "written_only") {
    if (!acct) throw new CreditError("letter", "Pick the account.");
    L = letter_base(kind, report, profile, as_of, rec, "Written communication only: " + acct_ref, false);
    B.push(blk("p", "Please communicate with me about account " + acct_ref + " only in writing, by mail to the address above. Please do not call me about this account.", ["template"]));
  } else if (kind === "pay_for_delete" || kind === "settlement") {
    const amt = opts.offer;
    if (!acct || !Number.isInteger(amt) || amt <= 0) throw new CreditError("letter", "Pick the account and enter the amount you can pay.");
    const days = Math.trunc(Number(opts.pay_within_days || 15));
    L = letter_base(kind, report, profile, as_of, rec, (kind === "pay_for_delete" ? "Offer to pay for deletion: " : "Settlement offer: ") + acct_ref, false);
    B.push(blk("p", "I am writing about account " + acct_ref + ", which you report with a balance of " + money_text(acct.balance) + ".", ["report"], true));
    B.push(blk("p", "I offer to pay " + money_text(amt) + ".", ["user:offer"], true));
    B.push(blk("p", kind === "pay_for_delete" ? "In exchange, you agree to delete this account from every credit bureau you report to, within 30 days of receiving my payment."
      : "In exchange, you agree to accept this amount as settlement in full and to report the account to every credit bureau you report to as paid in full, or to delete it, within 30 days of receiving my payment.", ["template"]));
    B.push(blk("p", "If you accept, please sign and return a written agreement on your letterhead with these terms, signed by an authorized representative. I will pay within " + days + " days of receiving the signed agreement. I will not pay before I have it.", ["template"]));
    B.push(blk("p", "This offer is made only to resolve the account. It is not an acknowledgment that I owe this debt, and it is not a promise to pay except on the written terms above, once you accept them in writing.", ["template"]));
    L.warnings.push("Check the statute of limitations first: in many states a payment or a written acknowledgment can restart it.",
      "A collector can accept payment and not delete. Keep the signed agreement; if it reports otherwise, dispute with the agreement as evidence.",
      "Forgiven debt may have tax consequences; ask a tax professional.");
  } else if (kind === "goodwill") {
    if (!acct) throw new CreditError("letter", "Pick the account.");
    const lates = (acct.history || []).filter((h) => isDigits(h.rating) && parseInt(h.rating, 10) >= 30);
    if (!lates.length) throw new CreditError("letter", "This account shows no late payments to ask about.");
    const reason = norm_space(opts.reason || "");
    L = letter_base(kind, report, profile, as_of, rec, "Goodwill request: " + acct_ref, false);
    B.push(blk("p", "I am writing about my account " + acct_ref + ". Your reporting shows a late payment in " + lates.map((h) => us_date(h.month)).join(", ") + ".", ["report"], true));
    if (reason) B.push(blk("p", reason, ["user:reason"], true));
    const last = lates[lates.length - 1].month, since = (acct.history || []).filter((h) => h.month > last);
    if (since.length && since.every((h) => h.rating === "OK")) B.push(blk("p", "Every month since then, through " + us_date(since[since.length - 1].month) + ", is reported as paid on time.", ["report"], true));
    B.push(blk("p", "I am not disputing the accuracy of this information. I am asking you, as a courtesy, to consider removing the late payment from your reporting.", ["template"]));
  } else if (kind === "block_605b") {
    if (!findings.length || findings.some((f) => f.rule !== "identity_theft")) throw new CreditError("letter", "A 605B block is only for items you confirmed came from identity theft.");
    if (!profile.ftc_report || (profile.facts || {})["theft:confirmed"] !== true) throw new CreditError("letter", "A 605B block needs your confirmation that you are a victim of identity theft and your FTC identity theft report number.");
    L = letter_base(kind, report, profile, as_of, rec, "Request to block identity theft information" + ref, true);
    B.push(blk("p", "I am a victim of identity theft.", ["fact:theft:confirmed"], true));
    B.push(blk("p", "My identity theft report number is " + profile.ftc_report + ". A copy is enclosed.", ["profile"], true));
    B.push(...finding_items(findings, accounts));
    B.push(blk("p", "Under " + sec("fcra605b") + ", please block this information within four business days of receiving this request and notify the furnishers.", ["template"]));
    L.enclosures = ["Copy of my identity theft report", "Proof of identity (government photo ID)", "Copy of a recent utility bill or bank statement showing my address"];
    L.warnings.push("An identity theft report is a statement to the government. A false report can be a federal crime (18 U.S.C. 1001), and a bureau can rescind a block obtained by misrepresentation.");
  } else if (kind === "inquiry_removal") {
    if (!findings.length || findings[0].rule !== "inquiry_no_account") throw new CreditError("letter", "Pick the inquiry you did not authorize.");
    const f = findings[0], key = f.confirm && f.confirm.length ? f.confirm[0].key : "";
    if ((profile.facts || {})[key] !== true) throw new CreditError("letter", "Confirm that you did not apply before sending this.");
    L = letter_base(kind, report, profile, as_of, rec, "Inquiry on my credit report", false);
    B.push(blk("p", "My " + bname + " credit report shows an inquiry by your company on " + us_date(f.date || "") + ".", ["report"], true));
    B.push(blk("p", f.confirm[0].sentence, ["fact:" + key], true));
    B.push(blk("p", "No one may obtain a consumer report without a permissible purpose (" + sec("fcra604f") + "). Please tell me the permissible purpose you had, or ask " + bname + " to remove the inquiry and send me a copy of that request.", ["template"]));
  } else if (kind === "reinsertion_demand") {
    if (!findings.length || findings[0].rule !== "reinserted") throw new CreditError("letter", "Pick the reinserted item.");
    L = letter_base(kind, report, profile, as_of, rec, "Reinserted information" + ref, true);
    B.push(blk("p", "I am writing about information that came back into my file after it was deleted, as described below. " + sec("fcra611a5b") + " allows reinsertion only after the furnisher certifies that it is complete and accurate, and requires you to tell me in writing within 5 business days of the reinsertion.", ["template"]));
    B.push(...finding_items(findings, accounts));
    B.push(blk("p", "Please send me the notice, the furnisher's certification and its name, address and telephone number, or delete the item.", ["template"]));
  } else if (kind === "consumer_statement") {
    const text = norm_space(opts.statement || ""), words = text ? text.split(" ").length : 0;
    if (!text || words > 100) throw new CreditError("letter", "Write your statement in 100 words or fewer.");
    L = letter_base(kind, report, profile, as_of, rec, "Statement of dispute for my file" + ref, true);
    B.push(blk("p", "Please add the following statement to my file (" + sec("fcra611b") + "):", ["template"]));
    B.push(blk("quote", text, ["user:statement"], true));
  } else if (kind === "security_freeze") {
    L = letter_base(kind, report, profile, as_of, rec, "Request for a security freeze" + ref, true);
    B.push(blk("p", "Please place a security freeze on my credit file (" + sec("fcra605a_freeze") + "). The freeze is free of charge, and for a request by mail it must be placed within 3 business days of receiving it. Please send me written confirmation and tell me how to lift the freeze.", ["template"]));
    L.enclosures = STD_ENC.slice();
    L.warnings.push("A freeze requested online or by phone must be placed within 1 business day, faster than by mail. A bureau may ask for more identifying information than this letter carries; give it only to the bureau.");
  } else if (kind === "fraud_alert") {
    if ((profile.facts || {})[FRAUD_KEY] !== true) throw new CreditError("letter", "An initial fraud alert is for a good-faith suspicion of fraud or identity theft. Confirm that sentence first.");
    L = letter_base(kind, report, profile, as_of, rec, "Request for an initial fraud alert" + ref, true);
    B.push(blk("p", FRAUD_SENTENCE, ["fact:" + FRAUD_KEY], true));
    B.push(blk("p", "Please place an initial fraud alert on my credit file for at least one year and refer it to the other nationwide consumer reporting agencies, as " + sec("fcra605a_alert") + " requires.", ["template"]));
    const phone = norm_space(opts.phone || "");
    if (phone) B.push(blk("p", "A business that checks my identity may call me at " + phone + ".", ["user:phone"], true));
    L.enclosures = STD_ENC.slice();
  } else if (kind === "child_support_zero_delinquent") {
    if (!findings.length || findings.some((f) => f.rule !== "child_support_tx") || !acct) throw new CreditError("letter", "Pick the child support finding you confirmed.");
    L = letter_base(kind, report, profile, as_of, rec, "Report my child support as zero months delinquent: " + acct_ref, false);
    const cs_case = norm_space(opts.case || "");
    B.push(blk("p", "I dispute the delinquency you report to the credit bureaus on my child support account " + acct_ref + ".", ["template"]));
    if (cs_case) B.push(blk("p", "My child support case number is " + cs_case + ".", ["user:case"], true));
    for (const f of findings) {
      for (const x of f.facts) {
        let src = ["finding:" + f.id];
        for (const c of f.confirm || []) if (c.sentence === x) src = ["fact:" + c.key];
        B.push(blk("p", x, src, true));
      }
    }
    B.push(blk("p", "Under " + sec("tac55_102") + ", past-due child support is reported as past due and zero months delinquent when a court order set periodic payments on the arrears and each payment the order required has been paid on time. Please report this account that way to every consumer reporting agency you report to, and report it as disputed while you review it (" + sec("fcra623a3") + ").", ["template"]));
    L.enclosures = ["Copy of the court order that set the arrears payments", "Payment record showing each payment and its date"];
  } else if (kind === "oag_review_request") {
    const notice = parse_date(opts.notice_date || "") || "", got = parse_date(opts.received || "") || "", reason = norm_space(opts.reason || "");
    if (!notice || !got || !reason) throw new CreditError("letter", "Enter the date on the notice, the date you received it and what you contest.");
    const dl = oag_review_deadline(notice, got);
    L = letter_base(kind, report, profile, as_of, rec, "Request for administrative review of a proposed report to consumer credit reporting agencies", false);
    const cs_case = norm_space(opts.case || "");
    if (cs_case) B.push(blk("p", "Child support case number: " + cs_case + ".", ["user:case"], true));
    B.push(blk("p", "I received your notice of a proposed report to consumer credit reporting agencies, dated " + us_date(notice) + ", on " + us_date(got) + ".", ["user:notice"], true));
    B.push(blk("p", "I contest the amount of child support you propose to report. " + reason, ["user:reason"], true));
    const want = opts.review || "both";
    const ask = { informal: "an informal resolution of this disputed matter", hearing: "a formal administrative review hearing",
      both: "an informal resolution of this disputed matter and, if it is not resolved, a formal administrative review hearing" }[want];
    if (!ask || !own({ informal: 1, hearing: 1, both: 1 }, want)) throw new CreditError("letter", "Choose an informal resolution, a hearing, or both.");
    B.push(blk("p", "Under " + sec("tac55_103") + ", I request " + ask + ". I make this request within the time your notice gives to contest (" + sec("tfc231_114") + ").", ["template"]));
    B.push(blk("p", "Please send me the Request for Administrative Review form if one is needed to schedule a hearing, and send everything to the address above.", ["template"]));
    L.enclosures = ["Copy of the notice of the proposed report", "Records that support the amount you believe is right (payment record, court order)"];
    L.warnings.push("Mail it so it is postmarked by " + us_date(dl.due) + ": the earlier of 30 days after you received the notice and 45 days after the date on it (1 Tex. Admin. Code 55.103(c)). A mailed request is timely if postmarked on the last day, and there is no good cause exception (55.104).");
    if (as_of > dl.due) L.warnings.push("That date has passed (" + us_date(dl.due) + "). A late request may be refused; you can still dispute what is reported with the bureaus.");
    L.warnings.push("If the notice came with a Request for Administrative Review form, fill it in and send it with this letter: the rule grants a hearing once the completed form is submitted.");
    L.deadline = dl;
  } else if (kind === "child_support_records") {
    L = letter_base(kind, report, profile, as_of, rec, "Request for my child support payment record", false);
    const cs_case = norm_space(opts.case || "");
    if (cs_case) B.push(blk("p", "Child support case number: " + cs_case + ".", ["user:case"], true));
    B.push(blk("p", "Please send me the payment record for my child support case: each payment received with its date and amount, how each was applied to current support and to past-due support, the past-due balance after each payment, and the amount and status you have reported to consumer reporting agencies about me, with the dates you reported them. The information you release must be kept up to date (" + sec("tfc231_114") + ").", ["template"]));
  } else if (["cfpb_complaint", "state_ag_complaint", "intent_to_sue", "small_claims_outline"].includes(kind)) {
    const prior = (opts.logs || []).filter((x) => PRIOR_LETTERS.includes(x.letter) && x.delivered);
    if (kind !== "state_ag_complaint" && !prior.length) throw new CreditError("letter", "Dispute with the bureau first and log the delivery date. The CFPB now requires that before an inaccuracy complaint.");
    const title = { cfpb_complaint: "Complaint about inaccurate credit reporting", state_ag_complaint: "Complaint about credit reporting or collection",
      intent_to_sue: "Notice of dispute and potential claim: " + (acct_ref || "my credit file"), small_claims_outline: "Outline for a small claims case (FCRA)" }[kind];
    L = letter_base(kind, report, profile, as_of, rec, title, false);
    B.push(blk("h", "What happened", ["template"]));
    for (const x of prior) {
      B.push(blk("p", "I sent a dispute to " + (own(x, "to") ? x.to : "the bureau") + " that was delivered on " + us_date(x.delivered) +
        (x.result_date ? "; the result, dated " + us_date(x.result_date) + ", was: " + (own(x, "outcome") ? x.outcome : "no answer") + "." : "; the outcome is " + (x.outcome || "no answer yet") + "."), ["log:" + (x.id || "")], true));
    }
    for (const f of findings) for (const s of f.facts) B.push(blk("p", s, ["finding:" + f.id], true));
    if (opts.harm) { B.push(blk("h", "Harm", ["template"])); B.push(blk("p", opts.harm, ["user:harm"], true)); }
    B.push(blk("h", "What I am asking for", ["template"]));
    B.push(blk("p", "Correct or delete the inaccurate information, confirm the correction to me in writing, and send corrected reports to anyone who received the inaccurate ones.", ["template"]));
    if (kind === "intent_to_sue") {
      const d = Math.trunc(Number(opts.deadline_days || 30));
      if ((profile.facts || {})[INTENT_KEY] !== true) throw new CreditError("letter", "Confirm first that you intend to pursue a claim if this is not corrected. Never threaten what you will not do.");
      B.push(blk("p", "If the information is not corrected within " + d + " days of this notice, I intend to pursue my remedies under " + sec("fcra616") + ", " + sec("fcra617") + " and " + sec("fcra618") + ", and I will consult a consumer attorney about doing so.", ["fact:" + INTENT_KEY], true));
      L.warnings.push("Have a consumer attorney review this before you send it (NACA directory). Never threaten what you will not do.", "Suit deadline: the earlier of 2 years after you discover the violation or 5 years after it happened.");
    }
    if (kind === "small_claims_outline") {
      B.push(blk("h", "Checklist", ["template"]));
      for (const s of ["Check your state's small claims limit and whether it hears FCRA statutory damages claims.",
        "Claims: willful noncompliance (actual or $100 to $1,000 statutory damages, punitive damages, fees) or negligent noncompliance (actual damages, fees).",
        "Standing: show concrete harm, usually that the inaccurate report went to a lender or other third party.",
        "Deadline: 2 years from discovery or 5 years from the violation, whichever is earlier.",
        "Evidence: every letter, receipt, response and report version from the vault, in date order."]) B.push(blk("li", s, ["template"]));
    }
    if (kind === "cfpb_complaint") L.warnings.push("Write and file it yourself, once. The CFPB screens out duplicate and third-party submissions.");
  }
  if (L === null) throw new CreditError("letter", "Unsupported letter.");
  const note = norm_space(opts.note || "");
  if (note) {
    if (note.length > 1200) throw new CreditError("letter", "Keep your own paragraph to 1,200 characters.");
    B.push(blk("p", note, ["user:note"], true));
  }
  const include_id = L.include_id && BUREAU_LETTERS.has(kind);
  L.blocks = COMPLAINTS.has(kind) ? B : B.concat(include_id || FURNISHER_LETTERS.has(kind) ? identity_blocks(profile, include_id) : [], [blk("p", "Sincerely,", ["template"]), blk("sig", L.sender.name, ["profile"])]);
  L.id = kind + ":" + findings.map((f) => f.id).sort().join(",") + ":" + (opts.account_id || "");
  L.findings = findings.map((f) => f.id);
  const P = TABLES.postage;
  L.cost = { certified_err: P.certified_err_cents + P.stamp_cents, certified_green: P.certified_green_cents + P.stamp_cents, stamp: P.stamp_cents };
  const problems = audit_letter(L, findings, profile);
  if (problems.length) throw new CreditError("letter", "The letter failed its honesty check: " + problems.join("; "));
  return L;
}
const NOT_MINE = /\bnot mine\b|\bnever opened\b|\bnot my account\b|\bdid not open (?:this|that|the) account\b|\bdo not recogni[sz]e (?:this|that|the) account\b/i;
const THEFT_RE = /identity theft|stolen identity|\bidentity (?:was|has been) stolen\b/i;
const SSN_LIKE = /\b\d{3}-\d{2}-\d{4}\b|\b\d{3} \d{2} \d{4}\b/;
const BARE_NINE = /(?<![\d-])\d{9}(?![\d-])/;
const ID_WORDS = /date of birth|\bDOB\b|\bbirth ?date\b|\bborn on\b|social security|\bSSN\b|\bS\.S\.N\.?|\bSS ?#/i;
const OVERREACH = new RegExp("\\bguarantee|\\boriginal (?:signed |wet[- ]ink )?(?:contract|application)\\b|\\bwet[- ](?:ink )?signature|" +
  "\\b609\\b[^.]*\\b(?:delete|remove|deletion|removal|prove|original)|\\b(?:section|FCRA) 609 (?:requires|demands|forces)|" +
  "\\bforce[sd]? (?:you |the bureau |them )?to (?:delete|remove)|\\bmetro ?2\\b[^.]*\\b(?:law|requires|mandates|violation)|" +
  "\\bmust (?:delete|remove) (?:it|this|the item|this account) (?:immediately|now|within \\d+ (?:hours|days))|" +
  "\\b(?:credit privacy|credit profile|credit protection) number\\b|\\bCPN\\b|\\bfile segregation\\b|\\bnew (?:credit )?identity\\b|" +
  "\\bEIN (?:in place of|instead of) (?:my|a) (?:SSN|social security)", "i");
const THREAT = /\b(?:I|we) (?:will|shall|am going to|intend to|plan to) (?:sue|file (?:a )?(?:suit|lawsuit|claim|complaint in court)|take (?:legal|court) action|pursue (?:my |all )?(?:legal )?remedies|see you in court|press charges|report you to the police)|\bsee you in court\b/i;
function dob_forms(dob) {
  const d = parse_date(dob || "");
  if (!d) return [];
  const y = d.slice(0, 4), m = d.slice(5, 7), dd = d.slice(8, 10);
  return [d, us_date(d), (+m) + "/" + (+dd) + "/" + y, long_date(d), m + "-" + dd + "-" + y];
}
function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function audit_letter(letter, findings, profile) {
  const probs = [], fids = {};
  profile = profile || {};
  const facts = profile.facts || {};
  for (const f of findings) fids[f.id] = f;
  const bureau_letter = BUREAU_LETTERS.has(letter.kind);
  const dobs = dob_forms(profile.dob || "");
  const intent = facts[INTENT_KEY] === true && letter.kind === "intent_to_sue";
  const isTemplateOnly = (src) => src.length === 1 && src[0] === "template";
  const confirmed = (b) => b.src.some((s) => s.startsWith("fact:") && facts[s.slice(5)] === true);
  for (const b of letter.blocks) {
    const text = b.text;
    if (b.asserts) {
      if (!b.src.length || isTemplateOnly(b.src)) probs.push("a sentence states a fact without a source: " + text.slice(0, 60));
      for (const s of b.src) {
        if (s.startsWith("finding:")) {
          const f = fids[s.slice(8)];
          if (!f) probs.push("a sentence cites a finding that is not in this letter");
          else if (f.confidence === "needs_answer") probs.push("a sentence uses a finding that still needs your answer");
          else if (!f.facts.map(norm_space).includes(text) && b.kind !== "item") probs.push("a sentence does not match its finding's evidence: " + text.slice(0, 60));
        }
        if (s.startsWith("fact:") && facts[s.slice(5)] !== true) probs.push("a sentence relies on a fact you have not confirmed: " + text.slice(0, 60));
      }
    }
    if (NOT_MINE.test(text)) {
      const ok = confirmed(b) || b.src.some((s) => s.startsWith("finding:") && ["not_mine", "identity_theft"].includes((fids[s.slice(8)] || {}).rule));
      if (!ok) probs.push("the letter says an item is not yours without your confirmation");
    }
    if (THEFT_RE.test(text) && letter.kind !== "block_605b" && !(confirmed(b) || findings.some((f) => f.rule === "identity_theft"))) probs.push("the letter mentions identity theft without a confirmed theft finding");
    const ov = OVERREACH.exec(text);
    if (ov) probs.push("the letter claims more than the law supports, or mentions an identity scheme: " + ov[0]);
    if (THREAT.test(text) && !(intent && confirmed(b))) probs.push("the letter threatens an action you have not confirmed you intend to take");
    if (!bureau_letter && b.kind !== "id") {
      if (ID_WORDS.test(text) || dobs.some((x) => text.includes(x))) probs.push("a letter to a furnisher, collector or agency must not include a date of birth or SSN digits");
      const last4 = profile.ssn_last4 || "";
      if (last4 && new RegExp("(?:ending in|last (?:four|4)(?: digits)?:?)\\s*" + escRe(last4) + "\\b", "i").test(text)) probs.push("a letter to a furnisher, collector or agency must not include SSN digits");
    }
    if (!bureau_letter && b.kind === "id" && (ID_WORDS.test(text) || dobs.some((x) => text.includes(x)))) probs.push("a letter to a furnisher, collector or agency must not include a date of birth or SSN digits");
    if (SSN_LIKE.test(text) || (b.src.some((s) => s.startsWith("user:")) && BARE_NINE.test(text))) probs.push("a full Social Security number must never appear in a letter");
  }
  if (letter.kind === "block_605b" && !profile.ftc_report) probs.push("a 605B block needs an FTC identity theft report number");
  if (letter.kind === "fraud_alert" && facts[FRAUD_KEY] !== true) probs.push("a fraud alert needs your good-faith statement of suspected fraud");
  return probs;
}
function same_body(letters) {
  const seen = {}, out = [];
  for (const L of letters) {
    const body = L.blocks.filter((b) => b.kind !== "sig" && b.kind !== "id").map((b) => b.text).join("\n");
    if (own(seen, body)) out.push([seen[body], L.id]); else seen[body] = L.id;
  }
  return out;
}
function letter_text(L) {
  let out = [L.sender.name].concat(L.sender.lines, ["", long_date(L.date), ""]);
  if (L.recipient.name) out = out.concat([L.recipient.name], L.recipient.lines, [""]);
  out.push("Re: " + L.subject, "");
  for (const b of L.blocks) {
    if (b.kind === "li") out.push("- " + b.text);
    else if (b.kind === "id") out.push(b.text);
    else if (b.kind === "h" || b.kind === "item") out.push("", b.text);
    else if (b.kind === "sig") out.push(b.text);
    else out.push(b.text, "");
  }
  if (L.enclosures.length) out = out.concat(["", "Enclosures:"], L.enclosures.map((e) => "- " + e));
  return out.join("\n").split("\n\n\n").join("\n\n").trim() + "\n";
}

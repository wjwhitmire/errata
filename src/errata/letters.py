"""Letters built from findings and from facts the person confirmed.

A letter is a list of blocks. Each block says where its words come from:
  template      fixed wording: requests, citations, closings (asserts no fact)
  finding:<id>  a sentence that restates a finding's evidence
  fact:<key>    a sentence the person confirmed with a checkbox (the exact sentence)
  profile       the person's own identity details
  user:<field>  text the person typed (hardship reason, offer amount, harm)
  log:<id>      a date from the mail log
  report        a value read straight from the report (a balance, the months reported late)
audit() refuses any block that asserts a fact without one of those sources, a "not mine" or identity
theft claim without the person's confirmation, a 605B block without confirmed theft and an FTC report
number, a date of birth or SSN digits in a letter to anyone but a bureau, a full SSN anywhere,
claims the law does not support ("609 requires the original contract", "Metro 2 law", guarantees),
any credit privacy number or identity change, and a threat to sue that the person has not confirmed
they intend. Twin: web/src/core/09_letters.js.
"""

import re

from .law import BUREAUS, CITATIONS, POSTAGE
from .model import BUREAU_NAMES
from .util import CreditError, add_days, days_between, long_date, money_text, norm_space, parse_date, us_date

BUREAU_LETTERS = {"bureau_611", "disclosure_609", "mov_611a7", "block_605b", "personal_info", "reinsertion_demand",
                  "obsolete_605", "cares_act", "bankruptcy_correction", "consumer_statement", "security_freeze", "fraud_alert"}
FURNISHER_LETTERS = {"furnisher_623", "dispute_notation", "validation_regf", "cease_1692c", "written_only", "pay_for_delete",
                     "settlement", "goodwill", "inquiry_removal", "intent_to_sue", "child_support_zero_delinquent",
                     "oag_review_request", "child_support_records"}
COMPLAINTS = {"cfpb_complaint", "state_ag_complaint", "small_claims_outline"}

LETTERS = {
    "bureau_611": {"title": "Dispute to a credit bureau (FCRA 611)", "cite": ["fcra611", "fcra611a4", "fcra607b"], "to": "bureau"},
    "disclosure_609": {"title": "File disclosure request (FCRA 609)", "cite": ["fcra609", "experian_609"], "to": "bureau"},
    "mov_611a7": {"title": "Method of verification request (FCRA 611(a)(7))", "cite": ["fcra611a6", "fcra611a7"], "to": "bureau"},
    "furnisher_623": {"title": "Direct dispute to the furnisher (FCRA 623, 12 CFR 1022.43)", "cite": ["fcra623a8", "regv1022_43", "fcra623a3"], "to": "furnisher"},
    "validation_regf": {"title": "Debt validation dispute and original creditor request (Reg F)", "cite": ["regf1006_34", "regf1006_38", "fdcpa1692g", "regf1006_30a"], "to": "furnisher"},
    "cease_1692c": {"title": "Request to stop communication (FDCPA 805(c))", "cite": ["fdcpa1692c"], "to": "furnisher"},
    "written_only": {"title": "Request for written communication only", "cite": [], "to": "furnisher"},
    "pay_for_delete": {"title": "Pay-for-delete offer", "cite": ["pay_for_delete"], "to": "furnisher"},
    "settlement": {"title": "Settlement offer with a reporting term", "cite": ["settlement", "pay_for_delete"], "to": "furnisher"},
    "goodwill": {"title": "Goodwill request", "cite": ["experian_goodwill"], "to": "furnisher"},
    "block_605b": {"title": "Identity theft block (FCRA 605B)", "cite": ["fcra605b", "fcra623a6"], "to": "bureau"},
    "personal_info": {"title": "Personal information correction", "cite": ["fcra611", "fcra607b"], "to": "bureau"},
    "inquiry_removal": {"title": "Permissible purpose request for an inquiry", "cite": ["fcra604", "fcra604f"], "to": "inquirer"},
    "reinsertion_demand": {"title": "Reinsertion notice demand (FCRA 611(a)(5)(B))", "cite": ["fcra611a5b"], "to": "bureau"},
    "security_freeze": {"title": "Security freeze request (FCRA 605A(i))", "cite": ["fcra605a_freeze"], "to": "bureau"},
    "fraud_alert": {"title": "Initial fraud alert request (FCRA 605A(a))", "cite": ["fcra605a_alert"], "to": "bureau"},
    "obsolete_605": {"title": "Obsolete item removal (FCRA 605)", "cite": ["fcra605", "fcra605c", "fcra611"], "to": "bureau"},
    "cares_act": {"title": "CARES Act accommodation dispute", "cite": ["fcra623a1f", "fcra611"], "to": "bureau"},
    "bankruptcy_correction": {"title": "Bankruptcy discharge correction", "cite": ["fcra611", "fcra607b", "white_v_experian"], "to": "bureau"},
    "dispute_notation": {"title": "Request to report the account as disputed (FCRA 623(a)(3))", "cite": ["fcra623a3", "saunders"], "to": "furnisher"},
    "consumer_statement": {"title": "Consumer statement for the file (FCRA 611(b))", "cite": ["fcra611b"], "to": "bureau"},
    "cfpb_complaint": {"title": "CFPB complaint text", "cite": ["cfpb_complaint"], "to": "complaint"},
    "state_ag_complaint": {"title": "State attorney general complaint text", "cite": ["naag"], "to": "complaint"},
    "intent_to_sue": {"title": "Notice of dispute and potential claim", "cite": ["fcra616", "fcra617", "fcra618"], "to": "furnisher"},
    "small_claims_outline": {"title": "Small claims outline", "cite": ["fcra618", "fcra616", "fcra617"], "to": "complaint"},
    "child_support_zero_delinquent": {"title": "Texas child support: report as zero months delinquent (1 TAC 55.102)",
                                      "cite": ["tac55_102", "fcra623a8", "regv1022_43"], "to": "furnisher"},
    "oag_review_request": {"title": "Texas child support: administrative review of a credit report notice (1 TAC 55.103)",
                           "cite": ["tac55_103", "tac55_104", "tfc231_114", "ssa666a7"], "to": "agency"},
    "child_support_records": {"title": "Texas child support: payment record request", "cite": ["tfc231_114"], "to": "agency"},
}
OAG_DEFAULT = {"name": "Office of the Attorney General, Child Support Division", "lines": ["(the address printed on your notice)"]}

MAX_ITEMS = 5
# The sentence the person checks before a notice of a potential claim can be drafted.
INTENT_KEY = "intent:pursue_claim"
INTENT_SENTENCE = ("If this is not corrected, I intend to pursue my remedies under the Fair Credit Reporting Act and to consult a consumer attorney "
                   "about doing so.")
FRAUD_KEY = "fraud:suspect"
FRAUD_SENTENCE = "I suspect in good faith that I have been, or am about to become, a victim of fraud or identity theft."


def _b(kind, text, src, asserts=False):
    return {"kind": kind, "text": norm_space(text) if kind != "pre" else text, "src": list(src), "asserts": bool(asserts)}


def _sec(cite_key):
    return CITATIONS[cite_key]["cite"]


def bureau_recipient(bureau, overrides=None):
    o = (overrides or {}).get(bureau)
    if o:
        return {"name": o["name"], "lines": list(o["lines"])}
    b = BUREAUS.get(bureau)
    if not b:
        raise CreditError("letter", "Choose the bureau this letter goes to.")
    return {"name": b["name"], "lines": list(b["lines"])}


def account_recipient(a):
    if not a:
        raise CreditError("letter", "Choose the account this letter is about.")
    return {"name": a["name"], "lines": [a["address"]] if a.get("address") else ["(address: check the report or your statements)"]}


def sender(profile):
    name = norm_space(profile.get("name", ""))
    lines = [norm_space(x) for x in profile.get("mailing", []) if norm_space(x)]
    if not name or not lines:
        raise CreditError("letter", "Add your name and mailing address under People first.")
    return {"name": name, "lines": lines}


def _check_findings(findings, letter):
    for f in findings:
        if f["confidence"] == "needs_answer":
            raise CreditError("letter", f"Answer the question for {f['subject']} first; nothing is disputed until you confirm it.")
        if f.get("status", "open") != "open":
            raise CreditError("letter", f"{f['subject']} is marked {f.get('status')}; reopen it to use it in a letter.")


def _identity_blocks(profile, bureau_letter):
    out = [_b("p", "My identifying information:", ["template"])]
    out.append(_b("id", "Name: " + profile["name"], ["profile"], True))
    out.append(_b("id", "Current address: " + ", ".join(profile.get("mailing", [])), ["profile"], True))
    if bureau_letter:
        if profile.get("dob"):
            out.append(_b("id", "Date of birth: " + us_date(profile["dob"]), ["profile"], True))
        if profile.get("ssn_last4"):
            out.append(_b("id", "Social Security number, last four digits: " + profile["ssn_last4"], ["profile"], True))
    return out


def _finding_items(findings, accounts):
    """One numbered item per account (or personal detail): heading, the finding's facts, its request."""
    blocks, n, seen = [], 0, {}
    for f in findings:
        key = f.get("account_id") or f["subject"]
        if key not in seen:
            n += 1
            seen[key] = n
            a = accounts.get(f.get("account_id"))
            head = f"{n}. {a['name']}, account {a['number']}" if a and a.get("number") else f"{n}. {f['subject']}"
            blocks.append(_b("item", head, ["finding:" + f["id"]]))
        for s in f["facts"]:
            blocks.append(_b("p", s, ["finding:" + f["id"]], True))
        blocks.append(_b("p", f["request"], ["finding:" + f["id"]]))
    return blocks, n


def _closing(name):
    return [_b("p", "Sincerely,", ["template"]), _b("sig", name, ["profile"])]


def _base(kind, report, profile, as_of, recipient, subject, include_id):
    meta = LETTERS[kind]
    return {"kind": kind, "title": meta["title"], "date": as_of, "sender": sender(profile), "recipient": recipient,
            "subject": subject, "blocks": [], "enclosures": [], "cite": list(meta["cite"]), "include_id": include_id,
            "bureau": report.get("bureau", "") if report else "", "warnings": []}


def generate(kind, report, findings, profile, as_of, opts=None):
    """Build one letter. findings: the selected findings (all confirmed and open)."""
    if kind not in LETTERS:
        raise CreditError("letter", "Unknown letter type: " + str(kind))
    opts = opts or {}
    profile = profile or {}
    findings = list(findings or [])
    _check_findings(findings, kind)
    accounts = {a["id"]: a for a in (report or {}).get("accounts", [])}
    bureau = (report or {}).get("bureau", "")
    bname = BUREAU_NAMES.get(bureau, "the bureau")
    file_no = ((report or {}).get("source") or {}).get("file_number", "")
    to = LETTERS[kind]["to"]
    if to == "bureau":
        rec = opts.get("recipient") or bureau_recipient(bureau, opts.get("bureau_overrides"))
    elif to == "inquirer":
        q = next((x for x in (report or {}).get("inquiries", []) if x["id"] == opts.get("inquiry_id") or
                  (findings and x["id"] == findings[0].get("inquiry_id"))), None)
        rec = opts.get("recipient") or {"name": q["name"] if q else "", "lines": [q["location"]] if q and q.get("location") else ["(address)"]}
    elif to == "furnisher":
        acct = accounts.get(opts.get("account_id") or (findings[0].get("account_id") if findings else ""))
        rec = opts.get("recipient") or account_recipient(acct)
    elif to == "agency":
        rec = opts.get("recipient") or dict(OAG_DEFAULT, lines=list(OAG_DEFAULT["lines"]))
    else:
        rec = opts.get("recipient") or {"name": "", "lines": []}
    ref = f" (file number {file_no})" if file_no and to == "bureau" else ""
    acct = accounts.get(opts.get("account_id") or (findings[0].get("account_id") if findings else ""))
    acct_ref = f"{acct['name']}, account {acct['number']}" if acct else ""
    L = None
    B = []
    if kind in ("bureau_611", "obsolete_605", "cares_act", "bankruptcy_correction"):
        if not findings:
            raise CreditError("letter", "Pick at least one finding for this letter.")
        if len({f.get("account_id") or f["subject"] for f in findings}) > MAX_ITEMS:
            raise CreditError("letter", f"Keep a letter to {MAX_ITEMS} items or fewer; send the rest in a second letter.")
        subj = {"bureau_611": "Dispute of inaccurate information", "obsolete_605": "Request to remove obsolete information",
                "cares_act": "Dispute of late payments during a CARES Act accommodation",
                "bankruptcy_correction": "Correction of accounts included in bankruptcy"}[kind] + ref
        L = _base(kind, report, profile, as_of, rec, subj, True)
        intro = {"bureau_611": f"I am writing to dispute information in my {bname} credit file. Each item below is inaccurate or incomplete for the reason stated with it. "
                               f"Please reinvestigate each item free of charge and delete or correct it, as {_sec('fcra611')} requires, and review the information I send, as {_sec('fcra611a4')} requires.",
                 "obsolete_605": f"I am writing about information in my {bname} credit file that is past the period {_sec('fcra605')} allows. For collections and charge-offs, "
                                 f"the seven years begin 180 days after the delinquency that preceded the collection or charge-off ({_sec('fcra605c')}).",
                 "cares_act": f"I am writing to dispute late payments in my {bname} credit file that were reported during a payment accommodation. "
                              f"{_sec('fcra623a1f')} requires an account that was current before an accommodation made during the covered period, and on which the "
                              "consumer made the payments the accommodation required, to be reported as current.",
                 "bankruptcy_correction": f"I am writing to correct accounts in my {bname} credit file that were included in my bankruptcy. "
                                          "After a discharge, an included account should show a $0 balance and an included-in-bankruptcy status."}[kind]
        B.append(_b("p", intro, ["template"]))
        prior = opts.get("prior") or {}
        if prior.get("delivered"):
            # a second dispute after a missed deadline: the silence is the new information (611(a)(3))
            what = prior.get("what") or "earlier request"
            B.append(_b("p", f"My {what} was delivered to you on {us_date(prior['delivered'])}.", ["log:" + prior.get("id", "")], True))
            if prior.get("due"):
                B.append(_b("p", f"Your response was due by {us_date(prior['due'])}, and I have not received it.", ["log:" + prior.get("id", "")], True))
        items, _ = _finding_items(findings, accounts)
        B += items
        B.append(_b("p", f"For any item you do not delete, please send me the name, address and telephone number of each furnisher you contacted and a description of how you verified the item ({_sec('fcra611a7')}).", ["template"]))
        L["enclosures"] = ["Copy of a government photo ID", "Copy of a recent utility bill or bank statement showing my address",
                           f"Copy of the {bname} report pages with each item marked"] + [f"Supporting documents for item {i + 1}" for i in range(len({f.get('account_id') or f['subject'] for f in findings}))]
        if kind == "bankruptcy_correction":
            L["enclosures"].append("Copy of the bankruptcy discharge order and the schedule listing these accounts")
        if kind == "cares_act":
            L["enclosures"].append("Copy of the accommodation agreement (forbearance or deferment)")
    elif kind == "personal_info":
        if not findings:
            raise CreditError("letter", "Pick at least one personal information finding.")
        L = _base(kind, report, profile, as_of, rec, "Correction of personal information" + ref, True)
        B.append(_b("p", f"I am writing to correct personal information in my {bname} credit file. Each item below is inaccurate for the reason stated with it. "
                         f"Please remove or correct them and keep my file accurate, as {_sec('fcra611')} and {_sec('fcra607b')} require.", ["template"]))
        for i, f in enumerate(findings):
            B.append(_b("item", f"{i + 1}. {f['subject']}", ["finding:" + f["id"]]))
            for s in f["facts"]:
                B.append(_b("p", s, ["finding:" + f["id"]], True))
            for c in f.get("confirm", []):
                if (profile.get("facts") or {}).get(c["key"]) is True and c["sentence"] not in f["facts"]:
                    B.append(_b("p", c["sentence"], ["fact:" + c["key"]], True))
            B.append(_b("p", f["request"], ["finding:" + f["id"]]))
        L["enclosures"] = ["Copy of a government photo ID", "Copy of a recent utility bill or bank statement showing my address"]
    elif kind == "disclosure_609":
        L = _base(kind, report, profile, as_of, rec, "Request for disclosure of my file", True)
        B.append(_b("p", f"Under {_sec('fcra609')}, please send me all information in my file, the sources of that information, the name of each person who obtained my "
                         "report in the last year (two years for employment purposes), and the record of inquiries I did not initiate.", ["template"]))
        B.append(_b("p", "This is a request for disclosure. It is not a dispute.", ["template"]))
        L["enclosures"] = ["Copy of a government photo ID", "Copy of a recent utility bill or bank statement showing my address"]
    elif kind == "mov_611a7":
        log = opts.get("log") or {}
        if not log.get("delivered"):
            raise CreditError("letter", "Pick the earlier dispute in the mail log (with its delivery date) that this request follows.")
        L = _base(kind, report, profile, as_of, rec, "Request for the description of the verification procedure" + ref, True)
        B.append(_b("p", f"My dispute was delivered to you on {us_date(log['delivered'])}.", ["log:" + log.get("id", "")], True))
        if log.get("result_date"):
            B.append(_b("p", f"Your results, dated {us_date(log['result_date'])}, say the following items were verified.", ["log:" + log.get("id", "")], True))
        items, _ = _finding_items(findings, accounts)
        B += [x for x in items if x["kind"] == "item"]
        B.append(_b("p", f"Under {_sec('fcra611a7')}, please send me, within 15 days of receiving this request, a description of the procedure you used to determine "
                         "the accuracy and completeness of each item, including the business name, address and telephone number of each furnisher you contacted.", ["template"]))
    elif kind == "furnisher_623":
        if not findings or not acct:
            raise CreditError("letter", "Pick the findings for one account.")
        if len({f.get("account_id") for f in findings}) > 1:
            raise CreditError("letter", "A direct dispute covers one account; make one letter per furnisher account.")
        L = _base(kind, report, profile, as_of, rec, "Direct dispute: " + acct_ref, False)
        B.append(_b("p", f"I dispute information you furnish to the credit bureaus about my account {acct_ref}. I send this to the address shown on my credit report, "
                         f"under {_sec('fcra623a8')} and {_sec('regv1022_43')}.", ["template"]))
        for f in findings:
            for s in f["facts"]:
                B.append(_b("p", s, ["finding:" + f["id"]], True))
            B.append(_b("p", f["request"], ["finding:" + f["id"]]))
        B.append(_b("p", f"Please investigate, report the result to me, correct the information with every bureau you report to, and report the account as disputed "
                         f"while the dispute is open ({_sec('fcra623a3')}).", ["template"]))
        L["enclosures"] = ["Copy of the credit report page showing the account, with the items marked", "Supporting documents"]
    elif kind == "dispute_notation":
        log = opts.get("log") or {}
        if not acct or not log.get("delivered"):
            raise CreditError("letter", "Pick the account and the earlier direct dispute in the mail log.")
        L = _base(kind, report, profile, as_of, rec, "Report my account as disputed: " + acct_ref, False)
        B.append(_b("p", f"My direct dispute about account {acct_ref} was delivered to you on {us_date(log['delivered'])}.", ["log:" + log.get("id", "")], True))
        for f in findings:
            for s in f["facts"]:
                B.append(_b("p", s, ["finding:" + f["id"]], True))
        B.append(_b("p", f"{_sec('fcra623a3')} does not allow you to furnish information about a disputed account without notice that it is disputed. "
                         "Please report the account as disputed by the consumer to every bureau you report to while the dispute is open.", ["template"]))
    elif kind == "validation_regf":
        if not acct:
            raise CreditError("letter", "Pick the collection account.")
        L = _base(kind, report, profile, as_of, rec, "Dispute and request for validation: " + acct_ref, False)
        rec_d = parse_date(opts.get("notice_received") or "") or ""
        period_end = add_days(rec_d, 30) if rec_d else ""
        inside = bool(period_end) and as_of <= period_end
        if inside:
            B.append(_b("p", f"I am writing about the debt you report as account {acct_ref}. I dispute this debt. Please send me verification of the debt, and the name "
                             f"and address of the original creditor, and stop collection until you do ({_sec('regf1006_38')}; {_sec('fdcpa1692g')}).", ["template"]))
        else:
            B.append(_b("p", f"I am writing about the debt you report as account {acct_ref}. I dispute this debt. Please send me verification of the debt and the name "
                             f"and address of the original creditor, and report the debt as disputed to any credit bureau you report it to ({_sec('fdcpa1692e8')}).", ["template"]))
            L["warnings"].append("The stop-collection right in 12 CFR 1006.38 applies to a dispute made within the validation period (30 days after you receive the validation notice)"
                                 + (f", which ended {us_date(period_end)}" if period_end else "; add the date you received the notice to check it") +
                                 ". A later dispute still has to be reported as disputed, and you can still dispute with the bureaus.")
        if rec_d:
            B.append(_b("p", f"I received your validation notice on {us_date(rec_d)}.", ["user:notice_received"], True))
        if inside and days_between(as_of, period_end) <= 10:
            L["warnings"].append(f"The validation period ends {us_date(period_end)}. Mail this today with tracking so it arrives before then.")
        for f in findings:
            for s in f["facts"]:
                src = ["finding:" + f["id"]]
                for c in f.get("confirm", []):
                    if c["sentence"] == s:
                        src = ["fact:" + c["key"]]
                B.append(_b("p", s, src, True))
            if f["rule"] == "collector_reported_early":
                B.append(_b("p", f"Please also tell me the date and the method of your first communication with me about this debt. A debt collector may not report a debt "
                                 f"to a credit bureau before it communicates with the consumer ({_sec('regf1006_30a')}).", ["template"]))
        B.append(_b("p", "Please send everything in writing to the address above.", ["template"]))
    elif kind == "cease_1692c":
        if not acct:
            raise CreditError("letter", "Pick the collection account.")
        L = _base(kind, report, profile, as_of, rec, "Request to stop communication: " + acct_ref, False)
        B.append(_b("p", f"Under {_sec('fdcpa1692c')}, please stop communicating with me about the debt you report as account {acct_ref}.", ["template"]))
        L["warnings"].append("A stop request does not erase the debt, and on a debt that is still within the statute of limitations it can push a collector toward a lawsuit.")
    elif kind == "written_only":
        if not acct:
            raise CreditError("letter", "Pick the account.")
        L = _base(kind, report, profile, as_of, rec, "Written communication only: " + acct_ref, False)
        B.append(_b("p", f"Please communicate with me about account {acct_ref} only in writing, by mail to the address above. Please do not call me about this account.", ["template"]))
    elif kind in ("pay_for_delete", "settlement"):
        amt = opts.get("offer")
        if not acct or not isinstance(amt, int) or amt <= 0:
            raise CreditError("letter", "Pick the account and enter the amount you can pay.")
        days = int(opts.get("pay_within_days") or 15)
        L = _base(kind, report, profile, as_of, rec, ("Offer to pay for deletion: " if kind == "pay_for_delete" else "Settlement offer: ") + acct_ref, False)
        B.append(_b("p", f"I am writing about account {acct_ref}, which you report with a balance of {money_text(acct.get('balance'))}.", ["report"], True))
        B.append(_b("p", f"I offer to pay {money_text(amt)}.", ["user:offer"], True))
        if kind == "pay_for_delete":
            B.append(_b("p", "In exchange, you agree to delete this account from every credit bureau you report to, within 30 days of receiving my payment.", ["template"]))
        else:
            B.append(_b("p", "In exchange, you agree to accept this amount as settlement in full and to report the account to every credit bureau you report to as paid in full, or to delete it, within 30 days of receiving my payment.", ["template"]))
        B.append(_b("p", f"If you accept, please sign and return a written agreement on your letterhead with these terms, signed by an authorized representative. I will pay within {days} days "
                         "of receiving the signed agreement. I will not pay before I have it.", ["template"]))
        B.append(_b("p", "This offer is made only to resolve the account. It is not an acknowledgment that I owe this debt, and it is not a promise to pay "
                         "except on the written terms above, once you accept them in writing.", ["template"]))
        L["warnings"] += ["Check the statute of limitations first: in many states a payment or a written acknowledgment can restart it.",
                          "A collector can accept payment and not delete. Keep the signed agreement; if it reports otherwise, dispute with the agreement as evidence.",
                          "Forgiven debt may have tax consequences; ask a tax professional."]
    elif kind == "goodwill":
        if not acct:
            raise CreditError("letter", "Pick the account.")
        lates = [h for h in acct.get("history", []) if h["rating"].isdigit() and int(h["rating"]) >= 30]
        if not lates:
            raise CreditError("letter", "This account shows no late payments to ask about.")
        reason = norm_space(opts.get("reason", ""))
        L = _base(kind, report, profile, as_of, rec, "Goodwill request: " + acct_ref, False)
        months = ", ".join(us_date(h["month"]) for h in lates)
        B.append(_b("p", f"I am writing about my account {acct_ref}. Your reporting shows a late payment in {months}.", ["report"], True))
        if reason:
            B.append(_b("p", reason, ["user:reason"], True))
        last = lates[-1]["month"]
        since = [h for h in acct.get("history", []) if h["month"] > last]
        if since and all(h["rating"] == "OK" for h in since):
            B.append(_b("p", f"Every month since then, through {us_date(since[-1]['month'])}, is reported as paid on time.", ["report"], True))
        B.append(_b("p", "I am not disputing the accuracy of this information. I am asking you, as a courtesy, to consider removing the late payment from your reporting.", ["template"]))
    elif kind == "block_605b":
        if not findings or any(f["rule"] != "identity_theft" for f in findings):
            raise CreditError("letter", "A 605B block is only for items you confirmed came from identity theft.")
        if not profile.get("ftc_report") or (profile.get("facts") or {}).get("theft:confirmed") is not True:
            raise CreditError("letter", "A 605B block needs your confirmation that you are a victim of identity theft and your FTC identity theft report number.")
        L = _base(kind, report, profile, as_of, rec, "Request to block identity theft information" + ref, True)
        B.append(_b("p", "I am a victim of identity theft.", ["fact:theft:confirmed"], True))
        B.append(_b("p", f"My identity theft report number is {profile['ftc_report']}. A copy is enclosed.", ["profile"], True))
        items, _ = _finding_items(findings, accounts)
        B += items
        B.append(_b("p", f"Under {_sec('fcra605b')}, please block this information within four business days of receiving this request and notify the furnishers.", ["template"]))
        L["enclosures"] = ["Copy of my identity theft report", "Proof of identity (government photo ID)", "Copy of a recent utility bill or bank statement showing my address"]
        L["warnings"].append("An identity theft report is a statement to the government. A false report can be a federal crime (18 U.S.C. 1001), and a bureau can rescind a block obtained by misrepresentation.")
    elif kind == "inquiry_removal":
        if not findings or findings[0]["rule"] != "inquiry_no_account":
            raise CreditError("letter", "Pick the inquiry you did not authorize.")
        f = findings[0]
        key = f["confirm"][0]["key"] if f.get("confirm") else ""
        if (profile.get("facts") or {}).get(key) is not True:
            raise CreditError("letter", "Confirm that you did not apply before sending this.")
        L = _base(kind, report, profile, as_of, rec, "Inquiry on my credit report", False)
        B.append(_b("p", f"My {bname} credit report shows an inquiry by your company on {us_date(f.get('date', ''))}.", ["report"], True))
        B.append(_b("p", f["confirm"][0]["sentence"], ["fact:" + key], True))
        B.append(_b("p", f"No one may obtain a consumer report without a permissible purpose ({_sec('fcra604f')}). Please tell me the permissible purpose you had, "
                         f"or ask {bname} to remove the inquiry and send me a copy of that request.", ["template"]))
    elif kind == "reinsertion_demand":
        if not findings or findings[0]["rule"] != "reinserted":
            raise CreditError("letter", "Pick the reinserted item.")
        L = _base(kind, report, profile, as_of, rec, "Reinserted information" + ref, True)
        items, _ = _finding_items(findings, accounts)
        B.append(_b("p", f"I am writing about information that came back into my file after it was deleted, as described below. {_sec('fcra611a5b')} allows "
                         "reinsertion only after the furnisher certifies that it is complete and accurate, and requires you to tell me in writing within 5 business days of the reinsertion.", ["template"]))
        B += items
        B.append(_b("p", "Please send me the notice, the furnisher's certification and its name, address and telephone number, or delete the item.", ["template"]))
    elif kind == "consumer_statement":
        text = norm_space(opts.get("statement", ""))
        words = len(text.split()) if text else 0
        if not text or words > 100:
            raise CreditError("letter", "Write your statement in 100 words or fewer.")
        L = _base(kind, report, profile, as_of, rec, "Statement of dispute for my file" + ref, True)
        B.append(_b("p", f"Please add the following statement to my file ({_sec('fcra611b')}):", ["template"]))
        B.append(_b("quote", text, ["user:statement"], True))
    elif kind == "security_freeze":
        L = _base(kind, report, profile, as_of, rec, "Request for a security freeze" + ref, True)
        B.append(_b("p", f"Please place a security freeze on my credit file ({_sec('fcra605a_freeze')}). The freeze is free of charge, and for a request by mail it "
                         "must be placed within 3 business days of receiving it. Please send me written confirmation and tell me how to lift the freeze.", ["template"]))
        L["enclosures"] = ["Copy of a government photo ID", "Copy of a recent utility bill or bank statement showing my address"]
        L["warnings"].append("A freeze requested online or by phone must be placed within 1 business day, faster than by mail. A bureau may ask for more identifying "
                             "information than this letter carries; give it only to the bureau.")
    elif kind == "fraud_alert":
        if (profile.get("facts") or {}).get(FRAUD_KEY) is not True:
            raise CreditError("letter", "An initial fraud alert is for a good-faith suspicion of fraud or identity theft. Confirm that sentence first.")
        L = _base(kind, report, profile, as_of, rec, "Request for an initial fraud alert" + ref, True)
        B.append(_b("p", FRAUD_SENTENCE, ["fact:" + FRAUD_KEY], True))
        B.append(_b("p", f"Please place an initial fraud alert on my credit file for at least one year and refer it to the other nationwide consumer reporting agencies, "
                         f"as {_sec('fcra605a_alert')} requires.", ["template"]))
        phone = norm_space(opts.get("phone", ""))
        if phone:
            B.append(_b("p", f"A business that checks my identity may call me at {phone}.", ["user:phone"], True))
        L["enclosures"] = ["Copy of a government photo ID", "Copy of a recent utility bill or bank statement showing my address"]
    elif kind == "child_support_zero_delinquent":
        if not findings or any(f["rule"] != "child_support_tx" for f in findings) or not acct:
            raise CreditError("letter", "Pick the child support finding you confirmed.")
        L = _base(kind, report, profile, as_of, rec, "Report my child support as zero months delinquent: " + acct_ref, False)
        case = norm_space(opts.get("case", ""))
        B.append(_b("p", f"I dispute the delinquency you report to the credit bureaus on my child support account {acct_ref}.", ["template"]))
        if case:
            B.append(_b("p", f"My child support case number is {case}.", ["user:case"], True))
        for f in findings:
            for x in f["facts"]:
                src = ["finding:" + f["id"]]
                for c in f.get("confirm", []):
                    if c["sentence"] == x:
                        src = ["fact:" + c["key"]]
                B.append(_b("p", x, src, True))
        B.append(_b("p", f"Under {_sec('tac55_102')}, past-due child support is reported as past due and zero months delinquent when a court order set periodic "
                         "payments on the arrears and each payment the order required has been paid on time. Please report this account that way to every consumer "
                         f"reporting agency you report to, and report it as disputed while you review it ({_sec('fcra623a3')}).", ["template"]))
        L["enclosures"] = ["Copy of the court order that set the arrears payments", "Payment record showing each payment and its date"]
    elif kind == "oag_review_request":
        notice = parse_date(opts.get("notice_date") or "") or ""
        got = parse_date(opts.get("received") or "") or ""
        reason = norm_space(opts.get("reason", ""))
        if not notice or not got or not reason:
            raise CreditError("letter", "Enter the date on the notice, the date you received it and what you contest.")
        from .deadlines import oag_review_deadline
        dl = oag_review_deadline(notice, got)
        L = _base(kind, report, profile, as_of, rec, "Request for administrative review of a proposed report to consumer credit reporting agencies", False)
        case = norm_space(opts.get("case", ""))
        if case:
            B.append(_b("p", f"Child support case number: {case}.", ["user:case"], True))
        B.append(_b("p", f"I received your notice of a proposed report to consumer credit reporting agencies, dated {us_date(notice)}, on {us_date(got)}.",
                    ["user:notice"], True))
        B.append(_b("p", "I contest the amount of child support you propose to report. " + reason, ["user:reason"], True))
        want = opts.get("review") or "both"
        ask = {"informal": "an informal resolution of this disputed matter",
               "hearing": "a formal administrative review hearing",
               "both": "an informal resolution of this disputed matter and, if it is not resolved, a formal administrative review hearing"}.get(want)
        if not ask:
            raise CreditError("letter", "Choose an informal resolution, a hearing, or both.")
        B.append(_b("p", f"Under {_sec('tac55_103')}, I request {ask}. I make this request within the time your notice gives to contest ({_sec('tfc231_114')}).", ["template"]))
        B.append(_b("p", "Please send me the Request for Administrative Review form if one is needed to schedule a hearing, and send everything to the address above.", ["template"]))
        L["enclosures"] = ["Copy of the notice of the proposed report", "Records that support the amount you believe is right (payment record, court order)"]
        L["warnings"].append(f"Mail it so it is postmarked by {us_date(dl['due'])}: the earlier of 30 days after you received the notice and 45 days after the date on it "
                             "(1 Tex. Admin. Code 55.103(c)). A mailed request is timely if postmarked on the last day, and there is no good cause exception (55.104).")
        if as_of > dl["due"]:
            L["warnings"].append(f"That date has passed ({us_date(dl['due'])}). A late request may be refused; you can still dispute what is reported with the bureaus.")
        L["warnings"].append("If the notice came with a Request for Administrative Review form, fill it in and send it with this letter: the rule grants a hearing once the completed form is submitted.")
        L["deadline"] = dl
    elif kind == "child_support_records":
        L = _base(kind, report, profile, as_of, rec, "Request for my child support payment record", False)
        case = norm_space(opts.get("case", ""))
        if case:
            B.append(_b("p", f"Child support case number: {case}.", ["user:case"], True))
        B.append(_b("p", "Please send me the payment record for my child support case: each payment received with its date and amount, how each was applied to current "
                         "support and to past-due support, the past-due balance after each payment, and the amount and status you have reported to consumer reporting "
                         f"agencies about me, with the dates you reported them. The information you release must be kept up to date ({_sec('tfc231_114')}).", ["template"]))
    elif kind in ("cfpb_complaint", "state_ag_complaint", "intent_to_sue", "small_claims_outline"):
        logs = opts.get("logs") or []
        prior = [x for x in logs if x.get("letter") in ("bureau_611", "obsolete_605", "personal_info", "cares_act", "bankruptcy_correction") and x.get("delivered")]
        if kind in ("cfpb_complaint", "intent_to_sue", "small_claims_outline") and not prior:
            raise CreditError("letter", "Dispute with the bureau first and log the delivery date. The CFPB now requires that before an inaccuracy complaint.")
        title = {"cfpb_complaint": "Complaint about inaccurate credit reporting", "state_ag_complaint": "Complaint about credit reporting or collection",
                 "intent_to_sue": "Notice of dispute and potential claim: " + (acct_ref or "my credit file"),
                 "small_claims_outline": "Outline for a small claims case (FCRA)"}[kind]
        L = _base(kind, report, profile, as_of, rec, title, False)
        B.append(_b("h", "What happened", ["template"]))
        for x in prior:
            B.append(_b("p", f"I sent a dispute to {x.get('to', 'the bureau')} that was delivered on {us_date(x['delivered'])}" +
                        (f"; the result, dated {us_date(x['result_date'])}, was: {x.get('outcome', 'no answer')}." if x.get("result_date") else
                         f"; the outcome is {x.get('outcome') or 'no answer yet'}."), ["log:" + x.get("id", "")], True))
        for f in findings:
            for s in f["facts"]:
                B.append(_b("p", s, ["finding:" + f["id"]], True))
        if opts.get("harm"):
            B.append(_b("h", "Harm", ["template"]))
            B.append(_b("p", opts["harm"], ["user:harm"], True))
        B.append(_b("h", "What I am asking for", ["template"]))
        B.append(_b("p", "Correct or delete the inaccurate information, confirm the correction to me in writing, and send corrected reports to anyone who received the inaccurate ones.", ["template"]))
        if kind == "intent_to_sue":
            d = int(opts.get("deadline_days") or 30)
            if (profile.get("facts") or {}).get(INTENT_KEY) is not True:
                raise CreditError("letter", "Confirm first that you intend to pursue a claim if this is not corrected. Never threaten what you will not do.")
            B.append(_b("p", f"If the information is not corrected within {d} days of this notice, I intend to pursue my remedies under {_sec('fcra616')}, "
                             f"{_sec('fcra617')} and {_sec('fcra618')}, and I will consult a consumer attorney about doing so.", ["fact:" + INTENT_KEY], True))
            L["warnings"] += ["Have a consumer attorney review this before you send it (NACA directory). Never threaten what you will not do.",
                              "Suit deadline: the earlier of 2 years after you discover the violation or 5 years after it happened."]
        if kind == "small_claims_outline":
            B.append(_b("h", "Checklist", ["template"]))
            for s in ["Check your state's small claims limit and whether it hears FCRA statutory damages claims.",
                      "Claims: willful noncompliance (actual or $100 to $1,000 statutory damages, punitive damages, fees) or negligent noncompliance (actual damages, fees).",
                      "Standing: show concrete harm, usually that the inaccurate report went to a lender or other third party.",
                      "Deadline: 2 years from discovery or 5 years from the violation, whichever is earlier.",
                      "Evidence: every letter, receipt, response and report version from the vault, in date order."]:
                B.append(_b("li", s, ["template"]))
        if kind == "cfpb_complaint":
            L["warnings"].append("Write and file it yourself, once. The CFPB screens out duplicate and third-party submissions.")
    if L is None:
        raise CreditError("letter", "Unsupported letter.")
    note = norm_space(opts.get("note", ""))
    if note:
        # a paragraph in the person's own words; the audit below holds it to the same rules
        if len(note) > 1200:
            raise CreditError("letter", "Keep your own paragraph to 1,200 characters.")
        B.append(_b("p", note, ["user:note"], True))
    include_id = L["include_id"] and kind in BUREAU_LETTERS
    if kind in COMPLAINTS:
        L["blocks"] = B
    else:
        L["blocks"] = B + (_identity_blocks(profile, include_id) if include_id or kind in FURNISHER_LETTERS else []) + _closing(L["sender"]["name"])
    L["id"] = kind + ":" + ",".join(sorted(f["id"] for f in findings)) + ":" + (opts.get("account_id") or "")
    L["findings"] = [f["id"] for f in findings]
    L["cost"] = {"certified_err": POSTAGE["certified_err_cents"] + POSTAGE["stamp_cents"],
                 "certified_green": POSTAGE["certified_green_cents"] + POSTAGE["stamp_cents"], "stamp": POSTAGE["stamp_cents"]}
    problems = audit(L, findings, profile)
    if problems:
        raise CreditError("letter", "The letter failed its honesty check: " + "; ".join(problems))
    return L


NOT_MINE = re.compile(r"\bnot mine\b|\bnever opened\b|\bnot my account\b|\bdid not open (?:this|that|the) account\b|\bdo not recogni[sz]e (?:this|that|the) account\b", re.I)
THEFT = re.compile(r"identity theft|stolen identity|\bidentity (?:was|has been) stolen\b", re.I)
SSN_LIKE = re.compile(r"\b\d{3}-\d{2}-\d{4}\b|\b\d{3} \d{2} \d{4}\b")
BARE_NINE = re.compile(r"(?<![\d-])\d{9}(?![\d-])")
ID_WORDS = re.compile(r"date of birth|\bDOB\b|\bbirth ?date\b|\bborn on\b|social security|\bSSN\b|\bS\.S\.N\.?|\bSS ?#", re.I)
# Claims the law does not support, and the scams 15 U.S.C. 1679b(a) forbids anyone to advise.
OVERREACH = re.compile(
    r"\bguarantee|\boriginal (?:signed |wet[- ]ink )?(?:contract|application)\b|\bwet[- ](?:ink )?signature|"
    r"\b609\b[^.]*\b(?:delete|remove|deletion|removal|prove|original)|\b(?:section|FCRA) 609 (?:requires|demands|forces)|"
    r"\bforce[sd]? (?:you |the bureau |them )?to (?:delete|remove)|\bmetro ?2\b[^.]*\b(?:law|requires|mandates|violation)|"
    r"\bmust (?:delete|remove) (?:it|this|the item|this account) (?:immediately|now|within \d+ (?:hours|days))|"
    r"\b(?:credit privacy|credit profile|credit protection) number\b|\bCPN\b|\bfile segregation\b|\bnew (?:credit )?identity\b|"
    r"\bEIN (?:in place of|instead of) (?:my|a) (?:SSN|social security)", re.I)
THREAT = re.compile(r"\b(?:I|we) (?:will|shall|am going to|intend to|plan to) (?:sue|file (?:a )?(?:suit|lawsuit|claim|complaint in court)|"
                    r"take (?:legal|court) action|pursue (?:my |all )?(?:legal )?remedies|see you in court|press charges|report you to the police)|\bsee you in court\b", re.I)


def _dob_forms(dob):
    d = parse_date(dob or "")
    if not d:
        return []
    y, m, dd = d[:4], d[5:7], d[8:10]
    return [d, us_date(d), f"{int(m)}/{int(dd)}/{y}", long_date(d), f"{m}-{dd}-{y}"]


def audit(letter, findings, profile):
    """Honesty and privacy checks; returns a list of problems (empty when the letter may go out)."""
    probs = []
    fids = {f["id"]: f for f in findings}
    profile = profile or {}
    facts = profile.get("facts") or {}
    bureau_letter = letter["kind"] in BUREAU_LETTERS
    dobs = _dob_forms(profile.get("dob", ""))
    intent = facts.get(INTENT_KEY) is True and letter["kind"] == "intent_to_sue"

    def confirmed(b):
        return any(s.startswith("fact:") and facts.get(s[5:]) is True for s in b["src"])

    for b in letter["blocks"]:
        text = b["text"]
        if b["asserts"]:
            if not b["src"] or b["src"] == ["template"]:
                probs.append("a sentence states a fact without a source: " + text[:60])
            for s in b["src"]:
                if s.startswith("finding:"):
                    f = fids.get(s[8:])
                    if not f:
                        probs.append("a sentence cites a finding that is not in this letter")
                    elif f["confidence"] == "needs_answer":
                        probs.append("a sentence uses a finding that still needs your answer")
                    elif text not in [norm_space(x) for x in f["facts"]] and b["kind"] != "item":
                        probs.append("a sentence does not match its finding's evidence: " + text[:60])
                if s.startswith("fact:") and facts.get(s[5:]) is not True:
                    probs.append("a sentence relies on a fact you have not confirmed: " + text[:60])
        if NOT_MINE.search(text):
            ok = confirmed(b) or any(s.startswith("finding:") and fids.get(s[8:], {}).get("rule") in ("not_mine", "identity_theft") for s in b["src"])
            if not ok:
                probs.append("the letter says an item is not yours without your confirmation")
        if THEFT.search(text) and letter["kind"] != "block_605b":
            if not (confirmed(b) or any(f["rule"] == "identity_theft" for f in findings)):
                probs.append("the letter mentions identity theft without a confirmed theft finding")
        if OVERREACH.search(text):
            probs.append("the letter claims more than the law supports, or mentions an identity scheme: " + OVERREACH.search(text).group(0))
        if THREAT.search(text) and not (intent and confirmed(b)):
            probs.append("the letter threatens an action you have not confirmed you intend to take")
        if not bureau_letter and b["kind"] != "id":
            if ID_WORDS.search(text) or any(x in text for x in dobs):
                probs.append("a letter to a furnisher, collector or agency must not include a date of birth or SSN digits")
            last4 = profile.get("ssn_last4") or ""
            if last4 and re.search(r"(?:ending in|last (?:four|4)(?: digits)?:?)\s*" + re.escape(last4) + r"\b", text, re.I):
                probs.append("a letter to a furnisher, collector or agency must not include SSN digits")
        if not bureau_letter and b["kind"] == "id" and (ID_WORDS.search(text) or any(x in text for x in dobs)):
            probs.append("a letter to a furnisher, collector or agency must not include a date of birth or SSN digits")
        if SSN_LIKE.search(text) or (any(s.startswith("user:") for s in b["src"]) and BARE_NINE.search(text)):
            probs.append("a full Social Security number must never appear in a letter")
    if letter["kind"] == "block_605b" and not profile.get("ftc_report"):
        probs.append("a 605B block needs an FTC identity theft report number")
    if letter["kind"] == "fraud_alert" and facts.get(FRAUD_KEY) is not True:
        probs.append("a fraud alert needs your good-faith statement of suspected fraud")
    return probs


def same_body(letters):
    """Pairs of letters whose bodies are identical; the planner never sends the same letter twice."""
    seen, out = {}, []
    for L in letters:
        body = "\n".join(b["text"] for b in L["blocks"] if b["kind"] not in ("sig", "id"))
        key = L["recipient"]["name"] + "\n" + body
        if body in seen:
            out.append((seen[body], L["id"]))
        else:
            seen[body] = L["id"]
    return out


def to_text(L):
    """Plain text of the whole letter."""
    out = [L["sender"]["name"]] + L["sender"]["lines"] + ["", long_date(L["date"]), ""]
    if L["recipient"]["name"]:
        out += [L["recipient"]["name"]] + L["recipient"]["lines"] + [""]
    out += ["Re: " + L["subject"], ""]
    for b in L["blocks"]:
        if b["kind"] == "li":
            out.append("- " + b["text"])
        elif b["kind"] == "id":
            out.append(b["text"])
        elif b["kind"] in ("h", "item"):
            out += ["", b["text"]]
        else:
            out += [b["text"], ""] if b["kind"] not in ("sig",) else [b["text"]]
    if L["enclosures"]:
        out += ["", "Enclosures:"] + ["- " + e for e in L["enclosures"]]
    return "\n".join(out).replace("\n\n\n", "\n\n").strip() + "\n"

"""Findings engine: deterministic rules over one normalized report (plus the person's profile and
answers). Each finding carries its rule, the legal basis (keys into law.CITATIONS), the evidence
it rests on, a confidence label, the sentences a letter may use (every one restates evidence),
any fact the person must confirm first, and the recommended action.

Nothing here decides that an item is "not mine": that is only ever a fact the person confirms.
Twin: web/src/core/06_findings.js.
"""

import re

from .model import DEROG_RATINGS, LATE_STEPS, PAID_AS_AGREED, PAID_STATUS, is_late, rating_days, visible_digits
from .nanp import SOURCE as NANP_SOURCE, TABLE as NANP
from .util import (add_months, days_between, edit_distance, money_text, month_index, month_label, norm_name,
                   norm_space, stable_hash, us_date)

# ---------------------------------------------------------------- rule catalog
# impact: expected effect if corrected (5 high); speed: how fast the lever works (5 fast).
RULES = {
    "paid_then_late": {"title": "Late payments reported after the account was paid", "legal": ["fcra611", "fcra607b", "fcra623a1"],
                       "letter": "bureau_611", "then": "furnisher_623", "impact": 5, "speed": 4, "group": "Internal contradictions"},
    "max_delinquency_mismatch": {"title": "Maximum delinquency note disagrees with the payment grid", "legal": ["fcra611", "fcra607b", "fcra623a1"],
                                 "letter": "bureau_611", "then": "furnisher_623", "impact": 4, "speed": 4, "group": "Internal contradictions"},
    "skipped_step": {"title": "Delinquency jumps a step after a current month", "legal": ["fcra611", "fcra607b", "fcra623a1", "metro2_status"],
                     "letter": "bureau_611", "then": "furnisher_623", "impact": 5, "speed": 4, "group": "Internal contradictions"},
    "zero_terms_amounts_due": {"title": "Terms of $0 per month with amounts due", "legal": ["fcra611", "fcra607b", "fcra623a1"],
                               "letter": "bureau_611", "then": "furnisher_623", "impact": 3, "speed": 4, "group": "Internal contradictions"},
    "closed_then_activity": {"title": "Activity reported after a paid, closed account", "legal": ["fcra611", "fcra607b", "fcra623a1"],
                             "letter": "bureau_611", "then": "furnisher_623", "impact": 4, "speed": 4, "group": "Internal contradictions"},
    "status_vs_past_due": {"title": "Pay status and amount past due disagree", "legal": ["fcra611", "fcra607b", "metro2_status"],
                           "letter": "bureau_611", "then": "furnisher_623", "impact": 3, "speed": 4, "group": "Metro 2 consistency"},
    "status_vs_latest_month": {"title": "Pay status disagrees with the latest month in the grid", "legal": ["fcra611", "fcra607b", "metro2_status"],
                               "letter": "bureau_611", "then": "furnisher_623", "impact": 3, "speed": 4, "group": "Metro 2 consistency"},
    "missing_dofd": {"title": "Charge-off or collection without a delinquency date", "legal": ["fcra623a5", "fcra605c", "fcra611"],
                     "letter": "bureau_611", "then": "furnisher_623", "impact": 3, "speed": 3, "group": "Metro 2 consistency"},
    "obsolete": {"title": "Reported past the 7-year limit", "legal": ["fcra605", "fcra605c", "fcra611"],
                 "letter": "obsolete_605", "then": "furnisher_623", "impact": 5, "speed": 5, "group": "Obsolete items"},
    "obsolete_inquiry": {"title": "Inquiry older than 2 years", "legal": ["tu_inquiries", "fcra611"],
                         "letter": "bureau_611", "then": None, "impact": 1, "speed": 5, "group": "Obsolete items"},
    "reaged": {"title": "Removal date later than the delinquency allows (re-aging)", "legal": ["fcra623a5", "fcra605c", "fcra611"],
               "letter": "bureau_611", "then": "furnisher_623", "impact": 4, "speed": 4, "group": "Obsolete items"},
    "collection_missing_oc": {"title": "Collection without the original creditor", "legal": ["fcra611", "fcra607b", "metro2_k1"],
                              "letter": "bureau_611", "then": "validation_regf", "impact": 3, "speed": 4, "group": "Collections"},
    "duplicate_debt": {"title": "Same debt reported with a balance by the original creditor and a collector",
                       "legal": ["fcra611", "fcra607b", "fcra623a1", "metro2_status"],
                       "letter": "bureau_611", "then": "furnisher_623", "impact": 5, "speed": 4, "group": "Collections"},
    "sold_with_balance": {"title": "Sold or transferred account still shows a balance", "legal": ["fcra611", "fcra607b", "metro2_status"],
                          "letter": "bureau_611", "then": "furnisher_623", "impact": 4, "speed": 4, "group": "Collections"},
    "collector_reported_early": {"title": "Collector may have reported before contacting you", "legal": ["regf1006_30a", "regf1006_30a_c", "regf1006_34"],
                                 "letter": "validation_regf", "then": "cfpb_complaint", "impact": 3, "speed": 3, "group": "Collections"},
    "medical_policy": {"title": "Medical collection the bureaus say they do not report", "legal": ["medical_policy", "fcra611"],
                       "letter": "bureau_611", "then": None, "impact": 4, "speed": 5, "group": "Collections"},
    "bankruptcy_balance": {"title": "Balance or late status on an account included in bankruptcy", "legal": ["fcra611", "fcra607b", "white_v_experian"],
                           "letter": "bankruptcy_correction", "then": "furnisher_623", "impact": 5, "speed": 4, "group": "Bankruptcy"},
    "name_variant": {"title": "Name variant that is not yours", "legal": ["fcra611", "fcra607b"],
                     "letter": "personal_info", "then": None, "impact": 2, "speed": 5, "group": "Personal information"},
    "address_malformed": {"title": "Malformed address", "legal": ["fcra611", "fcra607b"],
                          "letter": "personal_info", "then": None, "impact": 1, "speed": 5, "group": "Personal information"},
    "address_variants": {"title": "Several versions of one address", "legal": ["fcra611", "fcra607b"],
                         "letter": "personal_info", "then": None, "impact": 1, "speed": 5, "group": "Personal information"},
    "address_unknown": {"title": "Address you never lived at", "legal": ["fcra611", "fcra607b"],
                        "letter": "personal_info", "then": None, "impact": 2, "speed": 5, "group": "Personal information"},
    "phone_invalid": {"title": "Phone number with an invalid area code", "legal": ["fcra611", "fcra607b", "nanp"],
                      "letter": "personal_info", "then": None, "impact": 1, "speed": 5, "group": "Personal information"},
    "phone_variant": {"title": "Phone numbers that differ only in the area code", "legal": ["fcra611", "fcra607b"],
                      "letter": "personal_info", "then": None, "impact": 1, "speed": 5, "group": "Personal information"},
    "phone_unknown": {"title": "Phone number that is not yours", "legal": ["fcra611", "fcra607b"],
                      "letter": "personal_info", "then": None, "impact": 1, "speed": 5, "group": "Personal information"},
    "employer_unknown": {"title": "Employer you never worked for", "legal": ["fcra611", "fcra607b"],
                         "letter": "personal_info", "then": None, "impact": 1, "speed": 5, "group": "Personal information"},
    "identity_mismatch": {"title": "Date of birth or SSN digits do not match", "legal": ["fcra611", "fcra607b"],
                          "letter": "personal_info", "then": None, "impact": 3, "speed": 5, "group": "Personal information"},
    "inquiry_no_account": {"title": "Hard inquiry with no matching account", "legal": ["fcra604f", "fcra611"],
                           "letter": "inquiry_removal", "then": "bureau_611", "impact": 2, "speed": 4, "group": "Inquiries"},
    "cares_act": {"title": "Late marks during a CARES Act accommodation", "legal": ["fcra623a1f", "cares_period", "fcra611"],
                  "letter": "cares_act", "then": "furnisher_623", "impact": 4, "speed": 4, "group": "Accommodations"},
    "dispute_flag_missing": {"title": "Disputed account not marked as disputed", "legal": ["fcra623a3", "saunders", "metro2_ccc"],
                             "letter": "dispute_notation", "then": "bureau_611", "impact": 2, "speed": 4, "group": "Metro 2 consistency"},
    "cross_bureau_mismatch": {"title": "Bureaus report the same account differently", "legal": ["fcra607b", "fcra611"],
                              "letter": "bureau_611", "then": "furnisher_623", "impact": 3, "speed": 4, "group": "Cross-bureau"},
    "reinserted": {"title": "Deleted item came back", "legal": ["fcra611a5b"],
                   "letter": "reinsertion_demand", "then": "cfpb_complaint", "impact": 5, "speed": 4, "group": "Rounds"},
    "not_mine": {"title": "Account you say is not yours", "legal": ["fcra611", "fcra607b"],
                 "letter": "bureau_611", "then": "furnisher_623", "impact": 5, "speed": 4, "group": "Not yours"},
    "identity_theft": {"title": "Identity theft item (block request)", "legal": ["fcra605b", "fcra623a6"],
                       "letter": "block_605b", "then": "furnisher_623", "impact": 5, "speed": 5, "group": "Identity theft"},
    "child_support_tx": {"title": "Child support on a court-ordered arrears schedule reported as delinquent",
                         "legal": ["tac55_102", "tfc231_114", "fcra611", "fcra607b"],
                         "letter": "child_support_zero_delinquent", "then": "bureau_611", "impact": 4, "speed": 3, "group": "Child support"},
}

CONF_ORDER = {"high": 0, "medium": 1, "low": 2, "needs_answer": 3}


def _f(rule, report, subject, evidence, facts, request, confidence="high", account=None, detail="", confirm=None, extra=None):
    meta = RULES[rule]
    f = {
        "id": "f" + stable_hash("|".join([rule, report.get("bureau", ""), account["id"] if account else "", subject, detail])),
        "rule": rule, "title": meta["title"], "group": meta["group"], "bureau": report.get("bureau", ""),
        "account_id": account["id"] if account else "", "subject": subject, "confidence": confidence,
        "legal": list(meta["legal"]), "evidence": evidence, "facts": facts, "request": request,
        "confirm": confirm or [], "letter": meta["letter"], "then": meta["then"], "impact": meta["impact"],
        "speed": meta["speed"], "status": "open", "explain": "",
    }
    if extra:
        f.update(extra)
    return f


def subject_of(a):
    num = norm_space(a.get("number"))
    return a["name"] + (" " + num if num else "")


def _late_text(h):
    return f"{rating_days(h['rating'])} days late in {us_date(h['month'])}" if is_late(h["rating"]) and h["rating"].isdigit() else \
        f"{h['rating']} in {us_date(h['month'])}"


def _list(parts):
    parts = list(parts)
    if len(parts) <= 1:
        return "".join(parts)
    if len(parts) == 2:
        return parts[0] + " and " + parts[1]
    return ", ".join(parts[:-1]) + " and " + parts[-1]


def _ev(label, value):
    return {"label": label, "value": value}


# ---------------------------------------------------------------- account rules
def rule_paid_then_late(r, a):
    hist = a.get("history", [])
    if not hist:
        return []
    anchor, why, conf = None, "", "high"
    if a.get("paid"):
        anchor, why = a["paid"][:7], "a Date Paid of " + us_date(a["paid"])
    elif a.get("closed") and a.get("balance") == 0 and PAID_STATUS.search(a.get("pay_status", "")):
        anchor, why, conf = a["closed"][:7], "a $0 balance and a paid, closed status as of " + us_date(a["closed"]), "medium"
    if not anchor:
        return []
    late = [h for h in hist if h["month"] > anchor and (is_late(h["rating"]) or h["rating"] in DEROG_RATINGS)]
    if not late:
        return []
    lates = _list(_late_text(h) for h in late)
    status = a.get("pay_status", "")
    facts = [f"The account shows {why}, yet the payment history reports {lates}."]
    if PAID_AS_AGREED.search(status):
        facts.append(f"The pay status reads \"{status}\", which also conflicts with those late entries.")
    ev = [_ev("Date paid" if a.get("paid") else "Date closed", us_date(a.get("paid") or a.get("closed"))),
          _ev("Balance", money_text(a.get("balance"))), _ev("Pay status", status), _ev("Later late entries", lates)]
    return [_f("paid_then_late", r, subject_of(a), ev, facts,
               f"Please delete the late payment entries reported after {us_date(anchor)}, or delete the account if the furnisher cannot verify them.",
               conf, a, anchor)]


def _grid_max(hist):
    vals = [rating_days(h["rating"]) for h in hist if h["rating"].isdigit() and is_late(h["rating"])]
    return max(vals) if vals else 0


def rule_max_delinquency(r, a):
    md = a.get("max_delinquency") or {}
    hist = a.get("history", [])
    if not md.get("days") or not hist:
        return []
    by = {h["month"]: h for h in hist}
    first, last = hist[0]["month"], hist[-1]["month"]
    out = []
    note = md["text"]
    gmax = _grid_max(hist)
    entries = [e for e in md.get("entries", []) if e.get("month")]
    in_range = [e for e in entries if first <= e["month"] <= last]
    problems, conf = [], "high"
    for e in in_range:
        h = by.get(e["month"])
        if not h:
            continue
        rd = rating_days(h["rating"]) if h["rating"].isdigit() else None
        if h["rating"] and h["rating"] != "X" and rd != md["days"]:
            problems.append(f"the note names {us_date(e['month'])}, but the grid shows {h['rating']} for {us_date(e['month'])}")
        if e.get("amount") is not None and h.get("past_due") is not None and h["past_due"] != e["amount"]:
            problems.append(f"the note gives {money_text(e['amount'])} for {us_date(e['month'])}, but the grid shows {money_text(h['past_due'])} past due that month")
    if in_range and gmax and gmax != md["days"]:
        problems.append(f"the note says the worst delinquency was {md['days']} days, but the grid's worst rating is {gmax} days")
    if not problems and entries and gmax == md["days"]:
        listed = {e["month"] for e in entries}
        extra = [h for h in hist if h["rating"].isdigit() and rating_days(h["rating"]) == md["days"] and h["month"] not in listed]
        if extra and in_range:
            problems.append(f"the note names only {_list(us_date(e['month']) for e in entries)}, but the grid also shows "
                            f"{md['days']}-day ratings in {_list(us_date(h['month']) for h in extra)}")
            conf = "medium"
    if problems:
        facts = [f"The Maximum Delinquency Note reads \"{note}\", and it does not match the payment history: " + "; ".join(problems) + "."]
        ev = [_ev("Maximum Delinquency Note", note), _ev("Worst rating in grid", f"{gmax} days" if gmax else "none"),
              _ev("Disagreements", "; ".join(problems))]
        out.append(_f("max_delinquency_mismatch", r, subject_of(a), ev, facts,
                      "Please correct the delinquency history so the note and the payment grid agree, or delete the late entries the furnisher cannot verify.",
                      conf, a))
    return out


def rule_skipped_step(r, a):
    out = []
    hist = a.get("history", [])
    for prev, cur in zip(hist, hist[1:]):
        if month_index(cur["month"]) - month_index(prev["month"]) != 1:
            continue
        if not (cur["rating"].isdigit() and is_late(cur["rating"])):
            continue
        d = rating_days(cur["rating"])
        p = rating_days(prev["rating"])
        if p is None or d < 60 or p >= d - 30:
            continue
        zero_due = prev.get("past_due") == 0
        conf = "high" if p == 0 and (zero_due or prev.get("past_due") is None) else "medium"
        pd = f" with {money_text(prev['past_due'])} past due" if prev.get("past_due") is not None else ""
        prev_txt = "current (OK)" if p == 0 else f"{p} days late"
        facts = [f"The payment history shows {us_date(prev['month'])} as {prev_txt}{pd}, then {cur['rating']} days late in {us_date(cur['month'])}. "
                 f"An account cannot be {d} days late one month after it was {prev_txt}."]
        ev = [_ev(month_label(prev["month"]), prev["rating"] + (pd and (", " + money_text(prev['past_due']) + " past due"))),
              _ev(month_label(cur["month"]), cur["rating"] + (", " + money_text(cur["past_due"]) + " past due" if cur.get("past_due") is not None else ""))]
        out.append(_f("skipped_step", r, subject_of(a), ev, facts,
                      f"Please correct or delete the {cur['rating']}-day late entry for {us_date(cur['month'])}.", conf, a, cur["month"]))
    return out


def rule_zero_terms(r, a):
    t = a.get("terms") or {}
    if t.get("amount") != 0:
        return []
    due = [h for h in a.get("history", []) if (h.get("due") or 0) > 0]
    if not due and not (a.get("monthly_payment") or 0) > 0:
        return []
    amounts = sorted({h["due"] for h in due})
    span = f"{us_date(due[0]['month'])} to {us_date(due[-1]['month'])}" if due else ""
    facts = [f"The terms read \"{t['text']}\", but the payment history lists amounts due of {_list(money_text(x) for x in amounts)} "
             f"in {len(due)} months from {span}." if due else
             f"The terms read \"{t['text']}\", but the monthly payment is reported as {money_text(a['monthly_payment'])}."]
    ev = [_ev("Terms", t["text"]), _ev("Months with an amount due", str(len(due))),
          _ev("Amounts due", _list(money_text(x) for x in amounts) or money_text(a.get("monthly_payment")))]
    return [_f("zero_terms_amounts_due", r, subject_of(a), ev, facts,
               "Please correct the terms to the scheduled payment the furnisher actually reported, or explain the $0 terms.", "high", a)]


def rule_closed_then_activity(r, a):
    if not a.get("closed"):
        return []
    cm = a["closed"][:7]
    hist = a.get("history", [])
    at = [h for h in hist if h["month"] <= cm]
    if not at or at[-1].get("bal") != 0:
        return []
    later = [h for h in hist if h["month"] > cm and ((h.get("bal") or 0) > 0 or is_late(h["rating"]))]
    if not later:
        return []
    desc = _list(f"{us_date(h['month'])} ({h['rating'] or 'no rating'}" + (f", balance {money_text(h['bal'])}" if h.get("bal") else "") + ")" for h in later)
    facts = [f"The account shows Date Closed {us_date(a['closed'])} with a $0 balance that month, yet later months report activity: {desc}."]
    ev = [_ev("Date closed", us_date(a["closed"])), _ev("Later activity", desc)]
    return [_f("closed_then_activity", r, subject_of(a), ev, facts,
               f"Please delete the entries reported after {us_date(cm)} or correct the closing date.", "high", a)]


CURRENT_STATUS = re.compile(r"^(Current|Current Account|Paid or paying as agreed|Pays as agreed|OK)\b", re.I)


def rule_status_consistency(r, a):
    out = []
    st = a.get("pay_status", "")
    if a.get("kind") == "collection" or "charged_off" in a.get("flags", []):
        return out
    pd = a.get("past_due")
    hist = a.get("history", [])
    last = hist[-1] if hist else None
    if CURRENT_STATUS.match(st) and pd is not None and pd > 0:
        out.append(_f("status_vs_past_due", r, subject_of(a), [_ev("Pay status", st), _ev("Past due", money_text(pd))],
                      [f"The pay status reads \"{st}\" while the account reports {money_text(pd)} past due."],
                      "Please correct the pay status or the past due amount so they agree.", "high", a, "pd"))
    m = re.search(r"(\d+)\s+Days", st, re.I)
    if m and pd == 0 and (a.get("balance") or 0) > 0:
        out.append(_f("status_vs_past_due", r, subject_of(a), [_ev("Pay status", st), _ev("Past due", money_text(pd))],
                      [f"The pay status reads \"{st}\" while the past due amount is $0."],
                      "Please correct the pay status or the past due amount so they agree.", "high", a, "late0"))
    if last and CURRENT_STATUS.match(st) and last["rating"].isdigit() and is_late(last["rating"]) and \
            a.get("updated") and a["updated"][:7] == last["month"]:
        out.append(_f("status_vs_latest_month", r, subject_of(a),
                      [_ev("Pay status", st), _ev(month_label(last["month"]), last["rating"])],
                      [f"The pay status reads \"{st}\", but the payment history for {us_date(last['month'])}, the month the account was last updated, shows {last['rating']} days late."],
                      "Please correct the pay status or the latest month so they agree.", "medium", a))
    return out


def first_late_of_last_run(hist):
    """The month of the first late rating in the delinquency that ended in the latest adverse state."""
    first = None
    for h in hist:
        late = is_late(h["rating"]) or h["rating"] in DEROG_RATINGS
        if late and first is None:
            first = h
        elif not late and h["rating"] in ("OK",):
            first = None
    return first


def rule_dates(r, a, as_of, ctx):
    """Obsolete items, re-aging and a missing delinquency date."""
    out = []
    hist = a.get("history", [])
    adverse = "adverse" in a.get("flags", [])
    if not adverse:
        return out
    month_now = as_of[:7]
    first = first_late_of_last_run(hist)
    known = (ctx.get("profile") or {}).get("known_dofd", {}).get(a["id"], "")
    if a.get("removal") and a["removal"] <= month_now:
        out.append(_f("obsolete", r, subject_of(a), [_ev("Estimated removal", us_date(a["removal"])), _ev("Report date", us_date(as_of))],
                      [f"The report itself estimates this item would be removed in {us_date(a['removal'])}, and it is still reported as of {us_date(as_of)}."],
                      "Please delete this item; it is past the reporting period.", "high", a, "removal"))
    elif not first and not known:
        old = [h for h in hist if (is_late(h["rating"]) or h["rating"] in DEROG_RATINGS) and add_months(h["month"], 84) < month_now]
        if old:
            out.append(_f("obsolete", r, subject_of(a), [_ev("Late entries older than 7 years", _list(_late_text(h) for h in old))],
                          [f"The payment history still reports {_list(_late_text(h) for h in old)}, more than seven years ago."],
                          "Please delete the late entries that are more than seven years old.", "high", a, "old-lates"))
    else:
        anchor = known or (first["month"] if first else "")
        if anchor:
            limit = add_months(anchor, 12 * 7 + 6)
            if limit < month_now:
                src = "the delinquency date you confirmed" if known else "the first late entry in the payment history"
                out.append(_f("obsolete", r, subject_of(a), [_ev("Delinquency began", us_date(anchor)), _ev("Reporting limit", us_date(limit))],
                              [f"The delinquency began by {us_date(anchor)} ({src}). Seven years plus 180 days from then ended in {us_date(limit)}."],
                              "Please delete this item; it is past the reporting period.", "high", a, "dofd"))
    if a.get("removal"):
        anchor = known or (first["month"] if first else "")
        if anchor:
            # Bureaus set the removal date 7 years after the date of first delinquency, so a removal date
            # implies a delinquency date. Two months of slack covers the month a late is first printed.
            implied = add_months(a["removal"], -84)
            if implied > add_months(anchor, 1):
                src = "your confirmed delinquency date" if known else "the first late entry in the payment history"
                late_by = month_index(implied) - month_index(anchor)
                conf = "high" if a["removal"] > add_months(anchor, 12 * 7 + 6) else "medium"
                out.append(_f("reaged", r, subject_of(a), [_ev("Delinquency began by", us_date(anchor)), _ev("Estimated removal", us_date(a["removal"])),
                                                           _ev("Delinquency date that removal implies", us_date(implied))],
                              [f"The report estimates removal in {us_date(a['removal'])}, seven years after {us_date(implied)}, but the delinquency began by "
                               f"{us_date(anchor)} ({src}), {late_by} months earlier."],
                              f"Please correct the date of first delinquency to {us_date(anchor)} or earlier, as the furnisher's own payment history shows.",
                              conf, a))
    if ("charged_off" in a.get("flags", []) or a.get("kind") == "collection") and not a.get("removal") and not a.get("dofd"):
        out.append(_f("missing_dofd", r, subject_of(a), [_ev("Pay status", a.get("pay_status", "")), _ev("Estimated removal", "not shown")],
                      ["The account is reported as charged off or in collection, but no date of first delinquency or removal date is shown."],
                      "Please report the month and year the delinquency began, or delete the item if it cannot be verified.", "medium", a))
    return out


def _name_tokens(s):
    stop = {"INC", "LLC", "NA", "N", "A", "CORP", "CO", "THE", "OF", "BANK", "BK", "USA", "FSB", "LP", "LTD", "AND", "SERVICES", "SVCS",
            "FINANCIAL", "FINANCE", "CREDIT", "CARD", "VIA", "C", "O", "CAPITAL"}
    return {t for t in norm_name(s).split(" ") if t and t not in stop and len(t) > 1}


def names_match(a, b):
    na, nb = norm_name(a), norm_name(b)
    if not na or not nb:
        return False
    if na == nb or na in nb or nb in na:
        return True
    ta, tb = _name_tokens(a), _name_tokens(b)
    if not ta or not tb:
        return False
    shared = ta & tb
    return any(len(t) >= 4 for t in shared) and len(shared) * 2 >= len(ta | tb)


def rule_collections(r, accounts, as_of, ctx):
    out = []
    profile = ctx.get("profile") or {}
    facts_ok = profile.get("facts", {})
    for c in accounts:
        if c.get("kind") != "collection":
            continue
        if not norm_space(c.get("original_creditor")):
            out.append(_f("collection_missing_oc", r, subject_of(c), [_ev("Original creditor", "not shown")],
                          ["The collection account does not identify the original creditor."],
                          "Please identify the original creditor or delete the account if it cannot be verified.", "medium", c))
        # same debt with a balance at the original creditor
        for a in accounts:
            if a is c or a.get("kind") == "collection":
                continue
            if not names_match(c.get("original_creditor", ""), a.get("name", "")):
                continue
            if not ({"charged_off", "transferred"} & set(a.get("flags", []))):
                continue
            if (a.get("balance") or 0) > 0 and (c.get("balance") or 0) > 0:
                out.append(_f("duplicate_debt", r, subject_of(a) + " and " + subject_of(c),
                              [_ev(a["name"] + " balance", money_text(a["balance"])), _ev(c["name"] + " balance", money_text(c["balance"])),
                               _ev(c["name"] + " original creditor", c.get("original_creditor", ""))],
                              [f"{a['name']} reports a balance of {money_text(a['balance'])} with the status \"{a.get('pay_status', '')}\", and "
                               f"{c['name']} reports a balance of {money_text(c['balance'])} on the same debt, naming {c.get('original_creditor', '')} as the original creditor. "
                               "The same debt is counted twice; only one of them may report a balance."],
                              f"Please have {a['name']} report a $0 balance on the transferred or charged-off account, or delete the duplicate.",
                              "high", a, c["id"], extra={"related": [c["id"]]}))
            if c.get("removal") and a.get("removal") and c["removal"] > add_months(a["removal"], 1):
                out.append(_f("reaged", r, subject_of(c), [_ev(a["name"] + " estimated removal", us_date(a["removal"])),
                                                           _ev(c["name"] + " estimated removal", us_date(c["removal"]))],
                              [f"The original creditor's account ({a['name']}) is due to come off in {us_date(a['removal'])}, but the collection "
                               f"by {c['name']} on the same debt is due to come off later, in {us_date(c['removal'])}. A debt sale does not restart the reporting period."],
                              f"Please correct the collection's date of first delinquency to match the original account, so it comes off by {us_date(a['removal'])}.",
                              "high", c, a["id"], extra={"related": [a["id"]]}))
        # reported soon after it was opened: did the collector contact the person first?
        if c.get("opened") and 0 <= days_between(c["opened"], as_of) <= 365:
            key = "acct:" + c["id"] + ":no_contact_before_reporting"
            sentence = f"I received no letter, email or call from {c['name']} about this debt before {us_date(c['opened'])}."
            ans = facts_ok.get(key)
            if ans is not False:
                out.append(_f("collector_reported_early", r, subject_of(c),
                              [_ev("Opened (reported)", us_date(c["opened"])), _ev("Days before this report", str(days_between(c["opened"], as_of)))],
                              [f"{c['name']} began reporting this collection on {us_date(c['opened'])}."] + ([sentence] if ans is True else []),
                              "Please provide validation information for this debt and the date and method of your first communication with me before you reported it.",
                              "high" if ans is True else "needs_answer", c, extra={"needs": [] if ans is True else [key]},
                              confirm=[{"key": key, "sentence": sentence}]))
        # medical debt under the bureaus' own policy
        if "medical" in c.get("flags", []):
            reasons = []
            initial = c.get("high_balance") if c.get("high_balance") is not None else c.get("balance")
            if "paid" in c.get("flags", []) or c.get("balance") == 0:
                reasons.append("it is reported as paid")
            if initial is not None and initial < 50000:
                reasons.append(f"its reported balance of {money_text(initial)} is under $500")
            if c.get("opened") and c.get("dofd") and month_index(c["opened"][:7]) - month_index(c["dofd"][:7]) < 12:
                reasons.append(f"it was reported on {us_date(c['opened'])}, less than a year after the delinquency began in {us_date(c['dofd'])}")
            if reasons:
                out.append(_f("medical_policy", r, subject_of(c), [_ev("Why", _list(reasons))],
                              [f"This is a medical collection and {_list(reasons)}. Equifax, Experian and TransUnion have said they do not report medical collections that are paid, "
                               "that had an initial balance under $500, or until a year after the delinquency."],
                              "Please delete this medical collection under your own stated policy.", "medium", c))
    for a in accounts:
        if "transferred" in a.get("flags", []) and (a.get("balance") or 0) > 0 and a.get("kind") != "collection":
            out.append(_f("sold_with_balance", r, subject_of(a), [_ev("Remarks", "; ".join(a.get("remarks", []))), _ev("Balance", money_text(a["balance"]))],
                          [f"The account is marked \"{'; '.join(a.get('remarks', [])) or a.get('pay_status', '')}\" yet still reports a balance of {money_text(a['balance'])}. "
                           "A sold or transferred account should report a $0 balance."],
                          "Please report a $0 balance on this transferred account.", "high", a))
    return out


def rule_bankruptcy(r, accounts, ctx):
    out = []
    bk = (ctx.get("profile") or {}).get("bankruptcy") or {}
    for a in accounts:
        st = " ".join([a.get("pay_status", "")] + a.get("remarks", []))
        included = "bankruptcy" in a.get("flags", [])
        if not included and bk.get("discharged") and bk.get("filed") and a.get("opened") and a["opened"] < bk["filed"]:
            key = "acct:" + a["id"] + ":in_bankruptcy"
            if (ctx.get("profile") or {}).get("facts", {}).get(key) is True:
                included = True
        if not included:
            continue
        # While a case is open (a Chapter 13 plan, for one) a balance can be accurate; only a discharge
        # makes it wrong. The discharge comes from the report's own words or the person's answer.
        facts = (ctx.get("profile") or {}).get("facts", {})
        on_report = bool(re.search(r"DISCHARG", st, re.I))
        bad = []
        if (a.get("balance") or 0) > 0:
            bad.append(f"a balance of {money_text(a['balance'])}")
        if (a.get("past_due") or 0) > 0:
            bad.append(f"{money_text(a['past_due'])} past due")
        if bk.get("discharged"):
            later = [h for h in a.get("history", []) if h["month"] > bk["discharged"][:7] and is_late(h["rating"])]
            if later:
                bad.append("late ratings after the discharge in " + _list(us_date(h["month"]) for h in later))
        if not bad:
            continue
        key = "bk:discharged"
        sentence = "My bankruptcy case that included this account ended in a discharge" + (f" on {us_date(bk['discharged'])}." if bk.get("discharged") else ".")
        known = on_report or bool(bk.get("discharged"))
        ans = facts.get(key)
        if not known and ans is False:
            continue
        confirmed = known or ans is True
        head = "The account is reported as discharged in bankruptcy" if on_report else "The account is included in bankruptcy"
        fact = head + (f", discharged {us_date(bk['discharged'])}," if bk.get("discharged") else "") + f" but still shows {_list(bad)}."
        out.append(_f("bankruptcy_balance", r, subject_of(a), [_ev("Status", st), _ev("Problem", _list(bad)),
                                                               _ev("Discharge", "on the report" if on_report else us_date(bk["discharged"]) if bk.get("discharged") else "your answer")],
                      ([] if known or ans is not True else [sentence]) + ([fact] if confirmed else []),
                      "Please report this account as included in bankruptcy with a $0 balance and no amount past due.",
                      "high" if confirmed else "needs_answer", a,
                      confirm=[] if known else [{"key": key, "sentence": sentence}], extra={"needs": [] if confirmed else [key]}))
    return out


def rule_cares(r, accounts, ctx):
    from .law import CARES
    out = []
    prof = ctx.get("profile") or {}
    for acc in prof.get("accommodations", []) or []:
        a = next((x for x in accounts if x["id"] == acc.get("account_id")), None)
        if not a or prof.get("facts", {}).get("acct:" + a["id"] + ":accommodation") is not True:
            continue
        start, end = acc.get("start", "")[:7], acc.get("end", "")[:7]
        # 623(a)(1)(F) covers an accommodation made during the covered period, for the term of that
        # accommodation; one made before January 31, 2020 or after the period ended is not covered.
        if not start or not end or start < CARES["start"][:7] or start > CARES["end"][:7]:
            continue
        lo, hi = start, end
        hist = a.get("history", [])
        before = [h for h in hist if h["month"] < start]
        if before and is_late(before[-1]["rating"]):
            continue
        lates = [h for h in hist if lo <= h["month"] <= hi and is_late(h["rating"])]
        if lates:
            sentence = (f"I had a payment accommodation on this account from {us_date(start)} to {us_date(end)}, I was current before it began, "
                        "and I made every payment the accommodation required.")
            out.append(_f("cares_act", r, subject_of(a), [_ev("Accommodation", us_date(start) + " to " + us_date(end)),
                                                         _ev("Late entries in that time", _list(_late_text(h) for h in lates))],
                          [sentence, f"The payment history reports {_list(_late_text(h) for h in lates)} during that accommodation."],
                          "Please report these months as current, as the CARES Act requires for accommodations made during the covered period.",
                          "high", a))
    return out


def rule_dispute_flag(r, accounts, ctx):
    out = []
    rd = r["source"].get("report_date") or ctx.get("as_of", "")
    for d in ctx.get("disputes", []) or []:
        if d.get("kind") != "furnisher" or not d.get("delivered"):
            continue
        a = next((x for x in accounts if x["id"] == d.get("account_id")), None)
        if not a or "disputed" in a.get("flags", []):
            continue
        if rd and days_between(d["delivered"], rd) > 30:
            out.append(_f("dispute_flag_missing", r, subject_of(a), [_ev("Your dispute delivered", us_date(d["delivered"])),
                                                                     _ev("Report date", us_date(rd)), _ev("Dispute remark", "none")],
                          [f"I disputed this account directly with the furnisher; my dispute was delivered on {us_date(d['delivered'])}. "
                           f"The report dated {us_date(rd)} does not show the account as disputed."],
                          "Please report this account as disputed by the consumer while the dispute is open.", "high", a))
    return out


def rule_user_confirmed(r, accounts, ctx):
    """Accounts the person said are not theirs, or that came from identity theft (with an FTC report)."""
    out = []
    prof = ctx.get("profile") or {}
    facts = prof.get("facts", {})
    for a in accounts:
        if facts.get("acct:" + a["id"] + ":identity_theft") is True and prof.get("ftc_report"):
            sentence = f"The account {subject_of(a)} resulted from identity theft; I did not open it, use it or benefit from it."
            out.append(_f("identity_theft", r, subject_of(a), [_ev("FTC report number", prof["ftc_report"])],
                          [sentence], "Please block this information under section 605B within four business days.", "high", a,
                          confirm=[{"key": "acct:" + a["id"] + ":identity_theft", "sentence": sentence}]))
        elif facts.get("acct:" + a["id"] + ":not_mine") is True:
            sentence = f"The account {subject_of(a)} is not mine. I never opened it and never authorized anyone to open it in my name."
            out.append(_f("not_mine", r, subject_of(a), [_ev("Your answer", "Not my account")], [sentence],
                          "Please investigate and delete this account from my file.", "high", a,
                          confirm=[{"key": "acct:" + a["id"] + ":not_mine", "sentence": sentence}]))
    return out


# ---------------------------------------------------------------- Texas child support
TX_SUPPORT = re.compile(r"\bTEXAS\b|\bTX\b|ATTORNEY GENERAL|\bOAG\b", re.I)
LATE_STATUS = re.compile(r"\d+\s*DAYS|PAST DUE|DELINQ|\bLATE\b", re.I)


def rule_child_support(r, accounts, ctx):
    """1 Tex. Admin. Code 55.102(b): past-due support is reported as past due and zero months
    delinquent when a court order set periodic payments on the arrears and each was paid on time.
    Only the person knows the order and their payments, so this waits for their answer."""
    out = []
    prof = ctx.get("profile") or {}
    facts = prof.get("facts", {})
    for a in accounts:
        if "child_support" not in a.get("flags", []):
            continue
        if prof.get("state") != "TX" and not TX_SUPPORT.search(a.get("name", "")):
            continue
        hist = a.get("history", [])
        last = hist[-1] if hist else None
        st = a.get("pay_status", "")
        late_now = bool(last and is_late(last["rating"]))
        if not (late_now or LATE_STATUS.search(st)):
            continue
        key = "acct:" + a["id"] + ":cs_court_plan"
        sentence = ("A court order set the amount of my past-due child support and required periodic payments to reduce it, and I have paid on time "
                    "every periodic payment for current and past-due support that the order required.")
        ans = facts.get(key)
        if ans is False:
            continue
        shown = f"The account is reported with the pay status \"{st}\"" if st else "The account is reported as delinquent"
        if late_now:
            shown += f" and the payment history shows {_late_text(last)}"
        shown += (f", with {money_text(a['past_due'])} past due." if (a.get("past_due") or 0) > 0 else ".")
        ev = [_ev("Reported by", a["name"]), _ev("Pay status", st or "not shown"),
              _ev("Latest month", _late_text(last) if last else "no payment history"), _ev("Past due", money_text(a.get("past_due")))]
        out.append(_f("child_support_tx", r, subject_of(a), ev, [sentence, shown] if ans is True else [],
                      "Please report the past-due support as past due and zero months delinquent, as 1 Tex. Admin. Code 55.102(b) provides when a court-ordered "
                      "payment schedule on the arrears is being paid on time.",
                      "high" if ans is True else "needs_answer", a,
                      confirm=[{"key": key, "sentence": sentence}], extra={"needs": [] if ans is True else [key]}))
    return out


# ---------------------------------------------------------------- personal information
SUFFIX = {"JR", "SR", "II", "III", "IV", "V"}


def _name_parts(n):
    t = [x for x in norm_name(n).split(" ") if x and x not in SUFFIX]
    if not t:
        return None
    return {"first": t[0], "middle": t[1:-1], "last": t[-1] if len(t) > 1 else ""}


def name_problem(name, refs):
    """Why this name is not one of the reference names, or '' when it matches one."""
    p = _name_parts(name)
    if not p:
        return ""
    best = ""
    middles = sorted({(_name_parts(x) or {}).get("middle", [""])[0] for x in refs if (_name_parts(x) or {}).get("middle")})
    if p["middle"] and middles and p["middle"][0][0] not in {m[0] for m in middles}:
        if not any(norm_name(name) == norm_name(x) for x in refs):
            return f"the middle initial {p['middle'][0][0]} does not match {_list(middles)}"
    for ref in refs:
        q = _name_parts(ref)
        if not q:
            continue
        if norm_name(name) == norm_name(ref):
            return ""
        issues = []
        if p["last"] and q["last"] and p["last"] != q["last"]:
            d = edit_distance(p["last"], q["last"])
            issues.append(f"the last name {p['last']} is a misspelling of {q['last']}" if d <= 2 else f"the last name {p['last']} is not {q['last']}")
        if p["first"] != q["first"]:
            d = edit_distance(p["first"], q["first"])
            issues.append(f"the first name {p['first']} is a misspelling of {q['first']}" if d <= 2 and len(q["first"]) > 3 else
                          f"the first name {p['first']} is not {q['first']}")
        if p["middle"] and q["middle"] and p["middle"][0][0] != q["middle"][0][0]:
            issues.append(f"the middle initial {p['middle'][0][0]} does not match {q['middle'][0]}")
        if not issues:
            return ""
        text = _list(issues)
        if not best or len(text) < len(best):
            best = text
    return best


def _addr(text):
    t = norm_name(text)
    m = re.match(r"^(\d+[A-Z]?)\s+(.*?)\s+([A-Z]{2})\s+(\d{5})(?:\s+(\d{4}))?$", t)
    m2 = re.match(r"^(\d+)", t)
    unit = re.search(r"\b(APT|UNIT|STE|SUITE|LOT|BLDG|TRLR|RM|SPC)\s+([A-Z0-9]+)", t)
    zipm = re.search(r"\b(\d{5})(?:\s+\d{4})?$", t)
    return {"number": m2.group(1) if m2 else "", "zip": zipm.group(1) if zipm else "", "unit": unit.group(2) if unit else "",
            "state": m.group(3) if m else "", "full": t, "ok": bool(m)}


def addresses_problems(r, ctx):
    out = []
    addrs = r["personal"].get("addresses", [])
    prof = ctx.get("profile") or {}
    parsed = [_addr(x["text"]) for x in addrs]
    for x, p in zip(addrs, parsed):
        bad = []
        if not p["ok"] or not p["zip"]:
            bad.append("it has no valid state and ZIP code")
        if p["unit"] and p["number"] and len(p["unit"]) >= 5 and (p["unit"].startswith(p["number"]) or re.search(r"\d[A-Z]{2,}$", p["unit"])):
            bad.append(f"the unit \"{p['unit']}\" repeats the street number or mixes in letters")
        if bad:
            out.append(_f("address_malformed", r, x["text"], [_ev("Address", x["text"]), _ev("Problem", _list(bad))],
                          [f"The address \"{x['text']}\" is malformed: {_list(bad)}."],
                          "Please remove this malformed address from my file.", "high", None, x["text"]))
    groups = {}
    for x, p in zip(addrs, parsed):
        if p["number"] and p["zip"]:
            groups.setdefault((p["number"], p["zip"]), []).append(x)
    for (num, z), xs in sorted(groups.items()):
        texts = sorted({norm_space(x["text"]) for x in xs})
        if len(texts) < 2:
            continue
        out.append(_f("address_variants", r, f"{num} ... {z}", [_ev("Versions", " | ".join(texts))],
                      [f"My file lists {len(texts)} versions of the address at {num} in ZIP code {z}: " + "; ".join(texts) + "."],
                      "Please keep only the correct version of this address and remove the others.", "medium", None, num + z,
                      extra={"variants": texts}))
    known = [norm_name(a.get("text", a) if isinstance(a, dict) else a) for a in prof.get("addresses", []) or []]
    if known:
        facts = prof.get("facts", {})
        for x in addrs:
            nx = norm_name(x["text"])
            if any(nx == k or nx.startswith(k) or k.startswith(nx) for k in known):
                continue
            key = "addr:" + stable_hash(nx) + ":never_lived"
            sentence = f"I have never lived at {x['text']}."
            ans = facts.get(key)
            if ans is False:
                continue
            out.append(_f("address_unknown", r, x["text"], [_ev("Address", x["text"]), _ev("In your profile", "no")],
                          [sentence] if ans is True else [],
                          "Please remove this address from my file.", "high" if ans is True else "needs_answer", None, x["text"],
                          confirm=[{"key": key, "sentence": sentence}], extra={"needs": [] if ans is True else [key]}))
    return out


TOLL_FREE = {k for k, v in NANP.items() if v[0] == "toll_free"}


def area_code_problem(npa, nxx=""):
    """Why a phone number cannot be a person's line, or ''. Structure first (rules of the numbering
    plan itself), then the list of area codes in service (errata.nanp, pinned)."""
    if not re.fullmatch(r"\d{3}", npa or ""):
        return "it has no three-digit area code"
    if npa[0] in "01":
        return f"area code {npa} starts with {npa[0]}, which no area code can"
    if npa[1:] == "11":
        return f"{npa} is a service code (like 411 or 911), not an area code"
    if npa[1] == "9":
        return f"area codes with 9 in the middle ({npa}) are reserved and not in use"
    if nxx and nxx[0] in "01":
        return f"the exchange {nxx} starts with {nxx[0]}, which no exchange can"
    kind = (NANP.get(npa) or [""])[0]
    if not kind:
        return f"area code {npa} is not in service in the North American Numbering Plan (area code list of {NANP_SOURCE['version']})"
    if kind == "personal":
        return f"area code {npa} is not a geographic area code; it is set aside for personal communications services"
    if kind == "premium":
        return f"area code {npa} is for premium-rate services, not personal lines"
    if kind == "non_geographic":
        return f"area code {npa} is a non-geographic service code, not a personal line"
    return ""


def phones_problems(r, ctx):
    out = []
    phones = r["personal"].get("phones", [])
    prof = ctx.get("profile") or {}
    known = {re.sub(r"\D", "", p)[-10:] for p in prof.get("phones", []) or []}
    facts = prof.get("facts", {})
    lines = {}
    for ph in phones:
        digits = re.sub(r"\D", "", ph["number"])[-10:]
        npa, nxx = digits[:3], digits[3:6]
        why = area_code_problem(npa, nxx) if len(digits) == 10 else "it does not have ten digits"
        if why and digits not in known:
            sure = npa[:1] in ("0", "1") or npa[1:] == "11" or len(digits) != 10 or npa[1:2] == "9" or nxx[:1] in ("0", "1")
            out.append(_f("phone_invalid", r, ph["number"], [_ev("Phone", ph["number"]), _ev("Problem", why)],
                          [f"The phone number {ph['number']} cannot be right: {why}."],
                          "Please remove this phone number from my file.", "high" if sure else "medium", None, digits))
        if len(digits) == 10:
            lines.setdefault(digits[3:], []).append(ph["number"])
        if known and digits not in known and not why:
            key = "phone:" + digits + ":not_mine"
            sentence = f"The phone number {ph['number']} is not mine."
            ans = facts.get(key)
            if ans is not False:
                out.append(_f("phone_unknown", r, ph["number"], [_ev("Phone", ph["number"]), _ev("In your profile", "no")],
                              [sentence] if ans is True else [], "Please remove this phone number from my file.",
                              "high" if ans is True else "needs_answer", None, digits,
                              confirm=[{"key": key, "sentence": sentence}], extra={"needs": [] if ans is True else [key]}))
    for line, nums in sorted(lines.items()):
        if len(set(nums)) > 1:
            out.append(_f("phone_variant", r, " and ".join(nums), [_ev("Numbers", _list(nums))],
                          [f"My file lists {_list(nums)}, which differ only in the area code; at most one of them is right."],
                          "Please remove the incorrect versions of this phone number.", "medium", None, line))
    return out


def names_problems(r, ctx):
    out = []
    prof = ctx.get("profile") or {}
    names = r["personal"].get("names", [])
    refs = [n for n in prof.get("names", []) or [] if n]
    own = bool(refs)
    facts = prof.get("facts", {})
    if not refs:
        refs = [n["name"] for n in names if n["kind"] == "primary"][:1]
        check = [n for n in names if n["kind"] != "primary"]
    else:
        check = names
    for n in check:
        why = name_problem(n["name"], refs)
        if not why:
            continue
        fact = f"The name \"{n['name']}\" is not a name I use: {why}."
        ev = [_ev("Name on file", n["name"]), _ev("Compared with", _list(refs)), _ev("Problem", why)]
        conf = "high" if "misspelling" in why or "middle initial" in why else "medium"
        if own:
            out.append(_f("name_variant", r, n["name"], ev, [fact], "Please remove this name variant from my file.", conf, None, n["name"]))
            continue
        # compared only with the report's own primary name: the person says whether they use it
        key = "name:" + stable_hash(norm_name(n["name"])) + ":not_used"
        ans = facts.get(key)
        if ans is False:
            continue
        out.append(_f("name_variant", r, n["name"], ev, [fact] if ans is True else [], "Please remove this name variant from my file.",
                      conf if ans is True else "needs_answer", None, n["name"],
                      confirm=[{"key": key, "sentence": fact}], extra={"needs": [] if ans is True else [key]}))
    p = r["personal"]
    if prof.get("dob") and p.get("dob") and prof["dob"] != p["dob"]:
        out.append(_f("identity_mismatch", r, "Date of birth", [_ev("On file", us_date(p["dob"])), _ev("Yours", us_date(prof["dob"]))],
                      [f"My file shows a date of birth of {us_date(p['dob'])}; my date of birth is {us_date(prof['dob'])}."],
                      "Please correct my date of birth.", "high", None, "dob"))
    if prof.get("ssn_last4") and p.get("ssn_last4") and prof["ssn_last4"] != p["ssn_last4"]:
        out.append(_f("identity_mismatch", r, "SSN", [_ev("Last four on file", p["ssn_last4"])],
                      ["The Social Security number on my file does not end in my last four digits."],
                      "Please correct the Social Security number on my file.", "high", None, "ssn"))
    if prof.get("employers"):
        facts = prof.get("facts", {})
        for e in p.get("employers", []):
            if any(names_match(e["name"], k) for k in prof["employers"]):
                continue
            key = "emp:" + stable_hash(norm_name(e["name"])) + ":never"
            sentence = f"I have never worked for {e['name']}."
            ans = facts.get(key)
            if ans is False:
                continue
            out.append(_f("employer_unknown", r, e["name"], [_ev("Employer", e["name"]), _ev("In your profile", "no")],
                          [sentence] if ans is True else [], "Please remove this employer from my file.",
                          "high" if ans is True else "needs_answer", None, e["name"],
                          confirm=[{"key": key, "sentence": sentence}], extra={"needs": [] if ans is True else [key]}))
    return out


# ---------------------------------------------------------------- inquiries
def inquiries_problems(r, as_of, ctx):
    out = []
    facts = (ctx.get("profile") or {}).get("facts", {})
    for q in r.get("inquiries", []):
        if q["kind"] != "hard":
            continue
        for d in q["dates"]:
            if days_between(d, as_of) > 730:
                out.append(_f("obsolete_inquiry", r, q["name"], [_ev("Inquiry date", us_date(d))],
                              [f"The inquiry by {q['name']} on {us_date(d)} is more than two years old."],
                              "Please remove this inquiry; it is older than the two years inquiries stay on the file.", "high", None, d))
                continue
            parts = re.split(r"\s+via\s+", q["name"], flags=re.I)
            matched = [a for a in r["accounts"] if a.get("opened") and -7 <= days_between(d, a["opened"]) <= 60
                       and any(names_match(p, a["name"]) or names_match(p, a.get("original_creditor", "")) for p in parts)]
            if matched:
                continue
            key = "inq:" + stable_hash(norm_name(q["name"]) + d) + ":not_authorized"
            sentence = f"I did not apply for credit with {q['name']} on or about {us_date(d)} and did not authorize this inquiry."
            ans = facts.get(key)
            if ans is False:
                continue
            out.append(_f("inquiry_no_account", r, q["name"] + " " + us_date(d),
                          [_ev("Inquiry", q["name"]), _ev("Date", us_date(d)), _ev("Matching account opened", "none found")],
                          [sentence] if ans is True else [],
                          "Please tell me the permissible purpose you had for this inquiry, or have it removed.",
                          "high" if ans is True else "needs_answer", None, d,
                          confirm=[{"key": key, "sentence": sentence}], extra={"needs": [] if ans is True else [key], "inquiry_id": q["id"], "date": d}))
    return out


# ---------------------------------------------------------------- driver
def find(report, ctx=None):
    """All findings for one report. ctx: {as_of (ISO date), profile, disputes}."""
    ctx = dict(ctx or {})
    as_of = ctx.get("as_of") or report["source"].get("report_date") or "2026-01-01"
    ctx["as_of"] = as_of
    out = []
    accounts = report.get("accounts", [])
    for a in accounts:
        out += rule_paid_then_late(report, a)
        out += rule_max_delinquency(report, a)
        out += rule_skipped_step(report, a)
        out += rule_zero_terms(report, a)
        out += rule_closed_then_activity(report, a)
        out += rule_status_consistency(report, a)
        out += rule_dates(report, a, as_of, ctx)
    out += rule_collections(report, accounts, as_of, ctx)
    out += rule_bankruptcy(report, accounts, ctx)
    out += rule_cares(report, accounts, ctx)
    out += rule_dispute_flag(report, accounts, ctx)
    out += rule_user_confirmed(report, accounts, ctx)
    out += rule_child_support(report, accounts, ctx)
    out += names_problems(report, ctx)
    out += addresses_problems(report, ctx)
    out += phones_problems(report, ctx)
    out += inquiries_problems(report, as_of, ctx)
    seen, uniq = set(), []
    for f in out:
        if f["id"] in seen:
            continue
        seen.add(f["id"])
        f["explain"] = explain(f)
        uniq.append(f)
    uniq.sort(key=lambda f: (CONF_ORDER[f["confidence"]], -f["impact"], -f["speed"], f["group"], f["subject"], f["id"]))
    return uniq


def explain(f):
    """A plain-language line about what the finding means and what to do."""
    base = {
        "needs_answer": "This needs your answer first. Nothing is disputed until you confirm the sentence below is true.",
        "high": "The report contradicts itself here, so the furnisher cannot verify it as it stands.",
        "medium": "This looks wrong from the report alone; check it against your records before you dispute it.",
        "low": "A weak signal; dispute it only if your records support it.",
    }[f["confidence"]]
    if f["rule"] in ("name_variant", "address_malformed", "address_variants", "address_unknown", "phone_invalid", "phone_variant",
                     "phone_unknown", "employer_unknown", "identity_mismatch"):
        base += " Clean personal information goes to the bureaus first; furnishers need not investigate identifying information."
    if f["rule"] == "inquiry_no_account":
        base += " If you did apply, answer no: disputing an inquiry you authorized would be a false statement."
    if f["rule"] == "collector_reported_early":
        base += " A collector must communicate with you before it reports a debt, and wait about 14 days after mailing a letter."
    if f["rule"] == "child_support_tx":
        base += " Answer yes only if a court order set your arrears payments and you have made every one on time; your payment record from the Attorney General is the evidence."
    if f["rule"] == "bankruptcy_balance" and f["confidence"] == "needs_answer":
        base += " While a case is open, a balance can be accurate; only a discharge makes it wrong."
    return base


def summary(findings):
    by = {}
    for f in findings:
        by[f["rule"]] = by.get(f["rule"], 0) + 1
    return {"total": len(findings), "needs_answer": sum(1 for f in findings if f["confidence"] == "needs_answer"), "by_rule": by}

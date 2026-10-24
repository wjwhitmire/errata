"""Strategy planner, utilization planner, score estimate with ranges, and the statute of
limitations calculator.

The default order is the 90-day playbook from the research (ordered by impact and speed). The
"auto loan or mortgage soon" goal reorders toward levers that can move a score within 30 to 60
days. Score estimates are ranges with stated assumptions: no scoring company publishes its model,
and FICO says weights differ by person. Twin: web/src/core/08_strategy.js.
"""

import math
import re

from .findings import CURRENT_STATUS, RULES
from .law import SOL, SOL_COLUMNS, SOL_DISCLOSURE_STATES, SOL_EXTINGUISHED, SOL_FLAGS
from .model import is_late
from .util import (CreditError, add_days, add_months, add_months_date, days_between, is_business_day, money_text,
                   month_index, parse_date, us_date)

# ---------------------------------------------------------------- the 90-day playbook (research section 10)
PLAYBOOK = [
    {"id": "baseline", "days": "0 to 3", "title": "Baseline", "steps": [
        {"id": "pull", "title": "Pull all three reports free at AnnualCreditReport.com (weekly is allowed) and import them.", "cite": ["annual_report", "weekly_reports"]},
        {"id": "scores", "title": "Record any free scores you can see, with the model name, so the estimates can be checked.", "cite": ["fico_versions"]},
        {"id": "specialty", "title": "If you had banking, insurance or utility denials, request your specialty reports (ChexSystems, Early Warning, LexisNexis, Innovis, NCTUE).", "cite": []},
        {"id": "freeze", "title": "Freeze or add a fraud alert only if you suspect identity theft.", "cite": ["fcra605b"]},
    ]},
    {"id": "quick", "days": "1 to 7", "title": "Fastest score wins (no disputes needed)", "steps": [
        {"id": "utilization", "title": "Pay revolving balances before each statement closing date; aim for low overall and per-card use.", "cite": ["util_timing", "fico8"]},
        {"id": "no_apps", "title": "Stop new applications; keep any loan shopping inside a 14-day window.", "cite": ["rate_shop"]},
        {"id": "boost", "title": "Optional: add Experian Boost (affects Experian-based scores only).", "cite": ["experian_boost"]},
    ]},
    {"id": "round1", "days": "3 to 10", "title": "Round 1: highest legal strength first", "steps": []},
    {"id": "parallel", "days": "10 to 20", "title": "Parallel tracks", "steps": []},
    {"id": "results", "days": "30 to 45", "title": "Results", "steps": [
        {"id": "log_results", "title": "Log each result (due 5 business days after the reinvestigation ends); import a fresh weekly report and compare rounds.", "cite": ["fcra611a6"]},
        {"id": "watch_reinsertion", "title": "Deleted items: confirm at all three bureaus and watch for reinsertion (written notice within 5 business days).", "cite": ["fcra611a5b"]},
        {"id": "mov", "title": "Verified items: ask how they were verified (15 days); send the furnisher a direct dispute with documents if not done.", "cite": ["fcra611a7", "regv1022_43"]},
        {"id": "no_answer", "title": "No answer by day 30 after delivery (45 if extended): log the date and send a second dispute noting it.", "cite": ["fcra611"]},
    ]},
    {"id": "round2", "days": "45 to 60", "title": "Round 2", "steps": [
        {"id": "second", "title": "Dispute again only with new information or a new, specific inaccuracy.", "cite": ["fcra611a3"]},
        {"id": "cfpb", "title": "CFPB complaint for unresolved items, after the bureau dispute, written by you, once.", "cite": ["cfpb_complaint", "cfpb_volume"]},
    ]},
    {"id": "escalate", "days": "60 to 75", "title": "Escalation", "steps": [
        {"id": "ag", "title": "State attorney general complaint for unresolved items or collector conduct.", "cite": ["naag"]},
        {"id": "harm", "title": "Keep evidence of harm (denial letters, rate quotes) for any inaccuracy a lender saw.", "cite": ["ramirez"]},
    ]},
    {"id": "decide", "days": "75 to 90", "title": "Decision point", "steps": [
        {"id": "attorney", "title": "For documented inaccuracies that survived two rounds and were shared with a lender: talk to a NACA attorney or consider small claims.", "cite": ["naca", "fcra618"]},
        {"id": "rerun", "title": "Re-run the score estimate and add your actual scores.", "cite": ["ftc_study"]},
        {"id": "build", "title": "Plan the next 90 days of score building (secured card or credit builder loan for thin files without other debt; authorized user from family; rent reporting where your lenders' scores count it).", "cite": ["credit_builder", "au_experian", "fico9"]},
        {"id": "rescore", "title": "If a mortgage is near, ask the lender about a rapid rescore.", "cite": ["rapid_rescore"]},
    ]},
]

PERSONAL = {"name_variant", "address_malformed", "address_variants", "address_unknown", "phone_invalid", "phone_variant",
            "phone_unknown", "employer_unknown", "identity_mismatch"}
ROUND1_RULES = {"identity_theft", "obsolete", "obsolete_inquiry", "bankruptcy_balance", "duplicate_debt", "sold_with_balance",
                "medical_policy", "paid_then_late", "max_delinquency_mismatch", "skipped_step", "zero_terms_amounts_due",
                "closed_then_activity", "status_vs_past_due", "status_vs_latest_month", "missing_dofd", "reaged",
                "collection_missing_oc", "cares_act", "not_mine", "cross_bureau_mismatch", "reinserted"}
CONTRADICTIONS = {"paid_then_late", "max_delinquency_mismatch", "skipped_step", "zero_terms_amounts_due", "closed_then_activity",
                  "status_vs_past_due", "status_vs_latest_month", "duplicate_debt", "sold_with_balance", "reaged", "obsolete",
                  "bankruptcy_balance", "cross_bureau_mismatch"}

GOALS = {
    "standard": {"title": "Standard 90-day plan", "note": "Ordered by legal strength, expected impact and speed."},
    "auto_soon": {"title": "Auto loan or mortgage soon", "note": "Reordered toward levers that can move a score within 30 to 60 days. Ranges only; no lender promises."},
}


def _step(kind, title, why, cite, findings=(), letter="", recipient="", order=0, account_id=""):
    return {"kind": kind, "title": title, "why": why, "cite": list(cite), "findings": [f["id"] for f in findings],
            "letter": letter, "recipient": recipient, "order": order, "account_id": account_id}


def _recipient_for(f, report):
    letter = f["letter"]
    if letter in ("bureau_611", "obsolete_605", "personal_info", "block_605b", "cares_act", "bankruptcy_correction", "reinsertion_demand"):
        return "bureau:" + (f.get("bureau") or report.get("bureau", ""))
    if letter == "inquiry_removal":
        return "inquirer:" + f.get("inquiry_id", "")
    if letter in ("validation_regf", "furnisher_623", "dispute_notation"):
        return "furnisher:" + f.get("account_id", "")
    return ""


def candidates(report, findings):
    """Goodwill, pay-for-delete and leave-alone lists from accurate-looking adverse items."""
    by_acct = {}
    for f in findings:
        if f.get("account_id") and f["confidence"] in ("high", "medium"):
            by_acct.setdefault(f["account_id"], []).append(f)
    goodwill, pfd, leave = [], [], []
    for a in report.get("accounts", []):
        if "adverse" not in a.get("flags", []):
            continue
        disputable = by_acct.get(a["id"], [])
        lates = [h for h in a.get("history", []) if is_late(h["rating"])]
        if a.get("kind") == "collection":
            if (a.get("balance") or 0) > 0 and not disputable:
                pfd.append({"account_id": a["id"], "name": a["name"], "balance": a["balance"],
                            "why": "Unpaid collection with no reporting error found. FICO 9 and VantageScore 4.0 ignore paid collections; deletion helps most under FICO 8 and older mortgage scores. Get any deletion promise in writing before paying, and check the statute of limitations first: a payment can restart it in many states.",
                            "cite": ["pay_for_delete", "fico9", "fico8", "sol_table"]})
            continue
        if "charged_off" in a.get("flags", []):
            if not disputable:
                leave.append({"account_id": a["id"], "name": a["name"],
                              "why": "Charged off and reported consistently. Accurate information cannot be removed by dispute. Options: settle in writing with an agreed reporting status, or let time pass" +
                                     (f" (the report estimates removal in {us_date(a['removal'])})." if a.get("removal") else "."),
                              "cite": ["croa1679c", "settlement"]})
            continue
        if lates and not disputable and CURRENT_STATUS.match(a.get("pay_status", "")) and len(lates) <= 2 and \
                all(h["rating"] == "30" for h in lates):
            goodwill.append({"account_id": a["id"], "name": a["name"], "lates": [h["month"] for h in lates],
                             "why": "An isolated, accurate 30-day late on an account that is current now. A goodwill letter asks for removal as a courtesy; it is not a dispute and many creditors refuse.",
                             "cite": ["experian_goodwill"]})
        elif lates and not disputable:
            leave.append({"account_id": a["id"], "name": a["name"],
                          "why": "The late payments look accurate and consistent. They cannot be removed by dispute; they fade with time and on-time payments" +
                                 (f" and should be removed by {us_date(a['removal'])}." if a.get("removal") else "."),
                          "cite": ["croa1679c", "fcra605"]})
    pfd.sort(key=lambda x: (x["balance"], x["name"]))
    return {"goodwill": goodwill, "pay_for_delete": pfd, "leave_alone": leave}


def plan(report, findings, profile=None, goal="standard", as_of="", cards=None, scores=None):
    """The ordered plan. Findings that still need the person's answer go to a 'Your answers' step first."""
    if goal not in GOALS:
        raise CreditError("plan", "Unknown goal: " + str(goal))
    profile = profile or {}
    open_f = [f for f in findings if f.get("status", "open") == "open"]
    answers = [f for f in open_f if f["confidence"] == "needs_answer"]
    ready = [f for f in open_f if f["confidence"] != "needs_answer"]
    personal = [f for f in ready if f["rule"] in PERSONAL]
    round1 = [f for f in ready if f["rule"] in ROUND1_RULES]
    inquiries = [f for f in ready if f["rule"] == "inquiry_no_account"]
    collectors = [f for f in ready if f["rule"] in ("collector_reported_early",)]
    other = [f for f in ready if f not in personal and f not in round1 and f not in inquiries and f not in collectors]

    def by_strength(fs):
        return sorted(fs, key=lambda f: (-RULES[f["rule"]]["impact"] - RULES[f["rule"]]["speed"], f["confidence"] != "high", f["subject"], f["id"]))

    phases = [dict(p, steps=[dict(_step("playbook", s["title"], "", s["cite"]), id=s["id"]) for s in p["steps"]]) for p in PLAYBOOK]
    ph = {p["id"]: p for p in phases}
    r1 = []
    if answers:
        r1.append(_step("answers", f"Answer {len(answers)} question{'s' if len(answers) != 1 else ''} so these items can be disputed or set aside",
                        "Some findings depend on facts only you know (did you apply, did a collector contact you first). Nothing is disputed until you confirm.",
                        [], answers))
    if personal:
        r1.append(_step("letter", "Personal information cleanup at the bureau", "Fewer wrong identifiers means fewer mismatched accounts can attach. Bureaus handle this; furnishers need not.",
                        ["fcra611", "fcra607b"], personal, "personal_info", "bureau:" + report.get("bureau", "")))
    theft = [f for f in round1 if f["rule"] == "identity_theft"]
    if theft:
        r1.append(_step("letter", "Identity theft block (605B), only for real identity theft", "Block due within 4 business days of receipt.",
                        ["fcra605b"], theft, "block_605b", "bureau:" + report.get("bureau", "")))
    for f in by_strength([f for f in round1 if f["rule"] != "identity_theft"]):
        r1.append(_step("letter", f["title"] + ": " + f["subject"], f["facts"][0] if f["facts"] else f["explain"], f["legal"], [f],
                        f["letter"], _recipient_for(f, report), account_id=f.get("account_id", "")))
    for f in collectors:
        r1.append(_step("letter", "Validation request and contact question: " + f["subject"], f["explain"], f["legal"], [f],
                        "validation_regf", "furnisher:" + f["account_id"], account_id=f["account_id"]))
    for f in inquiries:
        r1.append(_step("letter", "Ask for the permissible purpose: " + f["subject"], "You said you did not apply. The inquirer must have had a permissible purpose.",
                        f["legal"], [f], "inquiry_removal", "inquirer:" + f.get("inquiry_id", "")))
    ph["round1"]["steps"] = r1 + ph["round1"]["steps"]
    par = []
    for f in by_strength([f for f in round1 if RULES[f["rule"]]["then"] == "furnisher_623" and f.get("account_id")]):
        par.append(_step("letter", "Direct dispute to the furnisher: " + f["subject"], "Same inaccuracy, sent to the company that reports it, asking it to mark the account as disputed.",
                         ["fcra623a8", "regv1022_43", "fcra623a3"], [f], "furnisher_623", "furnisher:" + f["account_id"], account_id=f["account_id"]))
    cand = candidates(report, findings)
    for g in cand["goodwill"]:
        par.append(_step("letter", "Goodwill request: " + g["name"], g["why"], g["cite"], [], "goodwill", "furnisher:" + g["account_id"], account_id=g["account_id"]))
    for p in cand["pay_for_delete"]:
        par.append(_step("letter", "Pay-for-delete or settlement offer, in writing first: " + p["name"] + " (" + money_text(p["balance"]) + ")", p["why"], p["cite"], [],
                         "pay_for_delete", "furnisher:" + p["account_id"], account_id=p["account_id"]))
    for a in report.get("accounts", []):
        if "student_loan" in a.get("flags", []) and "adverse" in a.get("flags", []) and re.search(r"DEFAULT|COLLECTION|CHARGE", a.get("pay_status", ""), re.I):
            par.append(_step("note", "Federal student loan in default: consider rehabilitation", "Nine on-time payments under an agreement; the record of default is removed. Consolidation ends default faster but leaves the record.",
                             ["student_rehab"], [], account_id=a["id"]))
    for f in other:
        par.append(_step("letter", f["title"] + ": " + f["subject"], f["explain"], f["legal"], [f], f["letter"], _recipient_for(f, report), account_id=f.get("account_id", "")))
    ph["parallel"]["steps"] = par
    out = {"goal": goal, "title": GOALS[goal]["title"], "note": GOALS[goal]["note"], "phases": phases, "candidates": cand,
           "notes": notes_for(report)}
    if goal == "auto_soon":
        _number(out)
        out = auto_soon(out, report, findings, cards or [], scores or [], as_of)
    _number(out)
    out["next_action"] = next_action(out)
    return out


def _number(out):
    n = 0
    for p in out["phases"]:
        for s in p["steps"]:
            n += 1
            s["order"] = n


def notes_for(report):
    notes = []
    for a in report.get("accounts", []):
        fl = a.get("flags", [])
        if "bnpl" in fl:
            notes.append({"account_id": a["id"], "text": f"{a['name']} is a buy now, pay later loan. Some bureaus show these to you but lenders and classic scores do not use them yet.", "cite": []})
        if "child_support" in fl or "government" in fl:
            notes.append({"account_id": a["id"], "text": f"{a['name']} is reported by a government agency. The same accuracy duties apply; your payment records from the agency are the best evidence.", "cite": ["fcra611", "fcra607b"]})
    return notes


def next_action(p):
    for ph in p["phases"]:
        for s in ph["steps"]:
            if s["kind"] in ("answers", "letter", "auto"):
                return {"phase": ph["title"], "title": s["title"], "why": s["why"], "kind": s["kind"]}
    return {"phase": "", "title": "Nothing to dispute right now. Keep payments on time and re-check your reports weekly.", "why": "", "kind": "none"}


# ---------------------------------------------------------------- auto loan or mortgage soon
def auto_soon(out, report, findings, cards, scores, as_of):
    util = utilization(cards, target_pct=10, as_of=as_of) if cards else None
    docs = [f for f in findings if f["rule"] in CONTRADICTIONS and f["confidence"] == "high"]
    small = [p for p in out["candidates"]["pay_for_delete"] if p["balance"] <= 50000]
    steps = []
    steps.append(_step("auto", "Pay card balances down before each statement closes",
                       "Utilization has no memory in classic FICO scores, so a lower reported balance can show on the next report. Statement balances are what issuers usually report." +
                       (f" Plan: {money_text(util['total_pay'])} across {len([c for c in util['cards'] if c['pay'] > 0])} card(s), overall use from {util['overall_before']}% to {util['overall_after']}%." if util else " Add your cards in Score plan to get amounts and dates."),
                       ["util_timing", "fico8", "high_scorers"]))
    for f in sorted(docs, key=lambda f: (-RULES[f["rule"]]["impact"], f["subject"])):
        steps.append(_step("letter", "Document-backed dispute: " + f["title"] + ": " + f["subject"], f["facts"][0] if f["facts"] else "",
                           f["legal"], [f], f["letter"], _recipient_for(f, report), account_id=f.get("account_id", "")))
    for p in small:
        steps.append(_step("letter", "Pay-for-delete offer on a small collection: " + p["name"] + " (" + money_text(p["balance"]) + ")",
                           "Small balances are where collectors most often agree. Written agreement first; check the statute of limitations before any payment.",
                           p["cite"], [], "pay_for_delete", "furnisher:" + p["account_id"], account_id=p["account_id"]))
    steps.append(_step("auto", "No new accounts and no closing cards until the loan closes",
                       "A new account adds an inquiry and lowers average age; closing a card removes its limit from your utilization right away.",
                       ["fico_weights", "fico8"]))
    steps.append(_step("auto", "Keep auto or mortgage rate shopping inside 14 days",
                       "Newer FICO versions count mortgage, auto and student loan inquiries within 45 days as one; older versions use 14 days. 14 days is safe across versions. Credit card inquiries are never grouped.",
                       ["rate_shop"]))
    steps.append(_step("auto", "Know which scores lenders commonly use",
                       "Auto lenders commonly use FICO Auto Scores; mortgage lenders commonly use FICO 2, 4 and 5, and VantageScore 4.0 is now accepted for loans sold to Fannie Mae and Freddie Mac. Ask each lender which score it pulls.",
                       ["fico_versions", "freddie_models"]))
    steps.append(_step("auto", "Pre-application checklist",
                       "Proof of income (recent pay stubs or tax returns), your down payment in a bank account, and a preapproval from a credit union first so you have a rate to compare. If a mortgage is near, ask the lender about a rapid rescore after a correction or paydown.",
                       ["rapid_rescore"]))
    phase = {"id": "auto", "days": "0 to 60", "title": "Auto loan or mortgage soon: fastest levers first", "steps": steps}
    rest = []
    moved = {}
    for p in out["phases"]:
        for s in p["steps"]:
            moved.setdefault(_sig(s), s["order"])
    for s in steps:
        if _sig(s) in moved:
            s["moved_from"] = moved[_sig(s)]
    used = {_sig(s) for s in steps}
    for p in out["phases"]:
        q = dict(p, steps=[s for s in p["steps"] if _sig(s) not in used])
        rest.append(q)
    answers = [s for s in rest[2]["steps"] if s["kind"] == "answers"] if len(rest) > 2 else []
    if answers:
        rest[2]["steps"] = [s for s in rest[2]["steps"] if s["kind"] != "answers"]
        phase["steps"] = answers + phase["steps"]
    out["phases"] = [phase] + rest
    out["expect"] = expectations(scores, report, findings, cards, as_of)
    out["utilization"] = util
    return out


def _sig(s):
    if s["kind"] == "letter":
        return s["letter"] + "|" + ",".join(s["findings"]) + "|" + s["account_id"]
    return s["kind"] + "|" + s["title"]


def expectations(scores, report, findings, cards, as_of):
    """The honest 'what to expect' panel: the person's own latest scores, the estimated ranges for
    the plan's levers, and what lenders decide on their own."""
    latest = {}
    for s in sorted(scores or [], key=lambda x: x.get("date", "")):
        latest[s.get("model", "Unknown model")] = s
    sim = simulate(report, findings, cards, as_of)
    lines = [
        "Lenders set their own score tiers and rates; ask each lender for its tier cutoffs and the rate at each.",
        "No one can promise a score or an approval. The ranges below are estimates from public facts about scoring, not a prediction.",
        "A correction shows only after the bureau updates the file; a mortgage lender can request a rapid rescore, usually in 2 to 5 days.",
    ]
    return {"scores": [latest[k] for k in sorted(latest)], "ranges": sim, "lines": lines, "cite": ["fico_versions", "rapid_rescore", "ftc_study"]}


# ---------------------------------------------------------------- utilization planner
def _next_close(day, as_of):
    """The next statement closing date on day-of-month `day` after as_of (clamped to month end)."""
    y, m = int(as_of[:4]), int(as_of[5:7])
    for k in range(0, 3):
        base = add_months_date(f"{y:04d}-{m:02d}-01", k)
        last = add_days(add_months_date(base, 1), -1)
        d = min(int(day), int(last[8:10]))
        cand = base[:8] + f"{d:02d}"
        if cand > as_of:
            return cand
    return add_days(as_of, 30)


def _sub_business_days(iso_s, n):
    d, k = iso_s, 0
    while k < n:
        d = add_days(d, -1)
        if is_business_day(d):
            k += 1
    return d


def _pct(bal, lim):
    return 0 if not lim else (bal * 100 + lim // 2) // lim


def utilization(cards, budget=None, target_pct=30, azeo=False, as_of="2026-01-01"):
    """cards: [{id, name, limit, balance, statement_day}] in cents. Returns payments per card with a
    pay-by date (3 business days before the statement closes), before and after utilization."""
    if not 1 <= int(target_pct) <= 100:
        raise CreditError("utilization", "Target must be between 1 and 100 percent.")
    rows = []
    for c in cards:
        lim, bal = int(c.get("limit") or 0), int(c.get("balance") or 0)
        if lim < 0 or bal < 0:
            raise CreditError("utilization", "Limits and balances cannot be negative.")
        rows.append({"id": c.get("id", c.get("name", "")), "name": c.get("name", ""), "limit": lim, "balance": bal,
                     "statement_day": int(c.get("statement_day") or 1)})
    total_lim = sum(r["limit"] for r in rows)
    total_bal = sum(r["balance"] for r in rows)
    keep = None
    if azeo:
        with_bal = [r for r in rows if r["balance"] > 0 and r["limit"] > 0]
        if with_bal:
            keep = sorted(with_bal, key=lambda r: (-r["limit"], r["name"]))[0]["id"]
    for r in rows:
        if azeo:
            if r["id"] == keep:
                small = max(1000, r["limit"] // 100)
                r["target"] = min(r["balance"], small, r["limit"] * target_pct // 100)
            else:
                r["target"] = 0
        else:
            r["target"] = min(r["balance"], r["limit"] * target_pct // 100) if r["limit"] else 0
        r["need"] = r["balance"] - r["target"]
    order = sorted(rows, key=lambda r: (-_pct(r["balance"], r["limit"]) if r["limit"] else -10 ** 6, r["name"]))
    left = budget if budget is not None else sum(r["need"] for r in rows)
    for r in order:
        pay = min(r["need"], max(0, left))
        r["pay"] = pay
        left -= pay
    out = []
    for r in rows:
        close = _next_close(r["statement_day"], as_of)
        after = r["balance"] - r["pay"]
        out.append({"id": r["id"], "name": r["name"], "limit": r["limit"], "balance": r["balance"], "pay": r["pay"], "after": after,
                    "util_before": _pct(r["balance"], r["limit"]), "util_after": _pct(after, r["limit"]),
                    "statement_close": close, "pay_by": _sub_business_days(close, 3), "keep": r["id"] == keep})
    total_pay = sum(r["pay"] for r in out)
    unmet = sum(r["need"] for r in rows) - total_pay
    return {"cards": out, "total_pay": total_pay, "unmet": unmet, "overall_before": _pct(total_bal, total_lim),
            "overall_after": _pct(total_bal - total_pay, total_lim), "target_pct": int(target_pct), "azeo": bool(azeo),
            "notes": ["Issuers usually report the statement balance, so pay before the closing date, not the due date.",
                      "AZEO (all zero except one) is community-observed, not published by FICO." if azeo else
                      "High scorers average about 7% utilization; FICO 8 is especially sensitive to card utilization."],
            "cite": ["util_timing", "azeo" if azeo else "high_scorers", "fico8"]}


def cards_from_report(report):
    out = []
    for a in report.get("accounts", []):
        if a.get("kind") == "revolving" and "closed" not in a.get("flags", []) and a.get("credit_limit"):
            out.append({"id": a["id"], "name": a["name"], "limit": a["credit_limit"], "balance": a.get("balance") or 0, "statement_day": 1})
    return out


# ---------------------------------------------------------------- score estimate with ranges
FAMILIES = [("fico8", "FICO 8-like"), ("fico9", "FICO 9 and 10-like"), ("vantage4", "VantageScore 4.0-like")]
ASSUMPTION = ("Ranges are this tool's own estimates built from published weights and public facts; no scoring company publishes its model, "
              "and FICO says weights differ by person. Treat them as direction and rough size only.")


def _band(lo, hi):
    return {"low": lo, "high": hi, "dir": "up" if lo >= 0 and hi > 0 else "down" if hi <= 0 and lo < 0 else "flat" if lo == 0 and hi == 0 else "mixed"}


def simulate(report, findings=None, cards=None, as_of="2026-01-01"):
    """Scenario cards from the report: each with a band per score family and its basis."""
    out = []
    cards = cards if cards else cards_from_report(report)
    if cards:
        u = utilization(cards, target_pct=10, as_of=as_of)
        b, a = u["overall_before"], u["overall_after"]
        if b > a:
            if b >= 50:
                band = (20, 60)
            elif b >= 30:
                band = (10, 35)
            elif b >= 10:
                band = (5, 20)
            else:
                band = (0, 5)
            out.append({"id": "utilization", "title": f"Pay cards down from {b}% to {a}% overall before the statements close",
                        "families": {"fico8": _band(*band), "fico9": _band(*band), "vantage4": _band(band[0] * 4 // 5, band[1] * 4 // 5)},
                        "basis": "Amounts owed are about 30% of a FICO score and utilization 20% of VantageScore 4.0; FICO 8 is especially sensitive. Newer models also look at 24 months of balances.",
                        "label": "Tool estimate", "cite": ["fico_weights", "vantage4", "fico8"]})
    month_now = as_of[:7]
    for a in report.get("accounts", []):
        if a.get("kind") == "collection":
            orig = a.get("high_balance") if a.get("high_balance") is not None else a.get("balance") or 0
            paid = (a.get("balance") or 0) == 0
            medical = "medical" in a.get("flags", [])
            f8 = (0, 0) if orig < 10000 else (10, 45)
            f9 = (0, 0) if paid else ((0, 15) if medical else (10, 40))
            v4 = (0, 0) if medical else ((0, 15) if paid else (5, 30))
            out.append({"id": "remove:" + a["id"], "title": f"{a['name']} collection removed ({money_text(a.get('balance'))})",
                        "families": {"fico8": _band(*f8), "fico9": _band(*f9), "vantage4": _band(*v4)},
                        "basis": "FICO 8 ignores collections under $100 original balance; FICO 9 ignores paid collections and weighs medical less; VantageScore 4.0 excludes medical collections.",
                        "label": "Published direction, tool estimate size", "cite": ["fico8", "fico9", "vantage4"]})
        else:
            lates = [h for h in a.get("history", []) if is_late(h["rating"])]
            if lates and any(f.get("account_id") == a["id"] and f["confidence"] in ("high", "medium") for f in findings or []):
                recent = any(month_index(month_now) - month_index(h["month"]) <= 24 for h in lates)
                band = (10, 50) if recent else (0, 20)
                out.append({"id": "lates:" + a["id"], "title": f"Disputed late entries on {a['name']} corrected or deleted",
                            "families": {k: _band(*band) for k, _ in FAMILIES},
                            "basis": "Payment history is about 35% of a FICO score and 41% of VantageScore 4.0; recent lates weigh more than old ones.",
                            "label": "Tool estimate", "cite": ["fico_weights", "vantage4"]})
    recent_inq = [q for q in report.get("inquiries", []) if q["kind"] == "hard" for d in q["dates"] if days_between(d, as_of) <= 365]
    if recent_inq:
        out.append({"id": "inquiries", "title": f"Unauthorized hard inquiries from the last 12 months removed ({len(recent_inq)} on file)",
                    "families": {"fico8": _band(0, 10), "fico9": _band(0, 10), "vantage4": _band(0, 10)},
                    "basis": "FICO counts inquiries for 12 months; only inquiries you did not authorize can be disputed.",
                    "label": "Tool estimate", "cite": ["fico_weights", "tu_inquiries"]})
    out.append({"id": "au", "title": "Added as an authorized user on a family member's long-standing, low-balance card",
                "families": {"fico8": _band(0, 20), "fico9": _band(0, 20), "vantage4": _band(0, 20)},
                "basis": "Most models count authorized user accounts; FICO 8 dampens tradeline renting; a high balance on that card raises your utilization; mortgage manual underwriting generally ignores it.",
                "label": "Published direction, tool estimate size", "cite": ["au_experian", "au_fico8", "fannie_au"]})
    out.append({"id": "secured", "title": "Open a secured card (first months)",
                "families": {k: _band(-10, 5) for k, _ in FAMILIES},
                "basis": "A new account adds an inquiry and lowers average age at first; it builds history over time. Credit builder loans helped people without other debt most.",
                "label": "Tool estimate", "cite": ["fico_weights", "credit_builder"]})
    return {"scenarios": out, "families": [{"id": k, "title": t} for k, t in FAMILIES], "assumption": ASSUMPTION,
            "cite": ["fico_weights", "vantage4", "ftc_study"]}


# ---------------------------------------------------------------- statute of limitations calculator
def sol(state, debt_type, last_payment, dofd="", as_of="2026-01-01"):
    """Both clocks: the state statute of limitations (estimate, verify) and the FCRA reporting limit."""
    st = (state or "").upper()
    if st not in SOL:
        raise CreditError("sol", "Choose a state.")
    if debt_type not in SOL_COLUMNS:
        raise CreditError("sol", "Choose a debt type.")
    years = SOL[st][1 + SOL_COLUMNS.index(debt_type)]
    out = {"state": st, "state_name": SOL[st][0], "debt_type": debt_type, "years": years, "flag": SOL_FLAGS.get(st, ""),
           "extinguished": SOL_EXTINGUISHED.get(st, ""), "disclosure_state": st in SOL_DISCLOSURE_STATES,
           "warnings": ["Estimate from a secondary source. Verify with your state's statute before relying on it.",
                        "A payment, even a small one, a written acknowledgment, a new payment plan or new charges can restart the clock in many states.",
                        "The statute of limitations decides whether a creditor can win a lawsuit. It does not decide how long the debt can be reported.",
                        "Never ignore a summons: respond to every lawsuit, even on an old debt."],
           "cite": ["sol_table", "nclc_timebarred", "regf1006_26", "fcra605c"]}
    lp = parse_date(last_payment or "")
    if lp:
        out["sol_expires"] = add_months_date(lp, 12 * years)
        # on the anniversary itself the period may still be running; only the day after is past it
        out["time_barred"] = out["sol_expires"] < as_of
    d = dofd[:7] if dofd else ""
    if d:
        out["reporting_ends"] = add_months(d, 12 * 7 + 6)
        out["reporting_ends_date"] = reporting_limit(dofd)
        out["reportable"] = out["reporting_ends_date"] >= as_of
    return out


def reporting_limit(dofd):
    """FCRA 605(c): seven years that begin when the 180 days from the start of the delinquency run out.
    With only a month known, the delinquency is taken to start on the month's last day, the latest it
    can be, so the date shown is never early."""
    d = parse_date(dofd or "")
    if not d:
        m = (dofd or "")[:7]
        if not re.match(r"^\d{4}-\d{2}$", m):
            raise CreditError("sol", "Enter the date of first delinquency as YYYY-MM or YYYY-MM-DD.")
        d = add_days(add_months_date(m + "-01", 1), -1)
    return add_months_date(add_days(d, 180), 12 * 7)


# ---------------------------------------------------------------- the person's own scores narrow the ranges
MODEL_FAMILY = [(re.compile(r"VANTAGE", re.I), "vantage4"), (re.compile(r"FICO\s*(?:SCORE\s*)?(?:9|10)", re.I), "fico9"),
                (re.compile(r"FICO\s*(?:SCORE\s*)?8\b|FICO\s*(?:SCORE\s*)?$", re.I), "fico8")]
CHANGE_KINDS = {"utilization": "Card balances paid down", "collection_removed": "A collection came off", "lates_corrected": "Late entries corrected or removed",
                "inquiries": "Inquiries came off", "au": "Added as an authorized user", "new_account": "Opened a new account", "none": "Nothing I know of"}
SCENARIO_KIND = {"utilization": "utilization", "remove:": "collection_removed", "lates:": "lates_corrected", "inquiries": "inquiries",
                 "au": "au", "secured": "new_account"}


def model_family(model):
    for rx, fam in MODEL_FAMILY:
        if rx.search(model or ""):
            return fam
    return ""


def calibrate(sim, scores):
    """Narrow (or honestly widen) the estimated bands with the person's own score history.
    scores: [{model, score, date, change}] where change says what happened since that model's
    previous score (a key of CHANGE_KINDS). Each pair of scores of the same model is one observed
    change. A band moves toward what was observed only as far as the observations support:
    the observed spread plus a margin that shrinks with more observations, and it widens when an
    observation falls outside it. With the latest score per family the bands are also shown as
    score ranges, clamped to 300 to 850."""
    obs = {}
    latest = {}
    by_model = {}
    for x in sorted(scores or [], key=lambda x: (x.get("date", ""), x.get("model", ""))):
        fam = model_family(x.get("model", ""))
        if not fam or not isinstance(x.get("score"), int):
            continue
        latest[fam] = x
        prev = by_model.get(x["model"])
        by_model[x["model"]] = x
        if prev and x.get("change") in CHANGE_KINDS and x["change"] != "none":
            obs.setdefault((fam, x["change"]), []).append({"delta": x["score"] - prev["score"], "from": prev["date"], "to": x["date"], "model": x["model"]})
    out = []
    for sc in sim["scenarios"]:
        kind = next((v for k, v in SCENARIO_KIND.items() if sc["id"] == k or (k.endswith(":") and sc["id"].startswith(k))), "")
        fams = {}
        for fam, band in sc["families"].items():
            b = dict(band)
            seen = obs.get((fam, kind), [])
            if seen:
                lo_o, hi_o = min(o["delta"] for o in seen), max(o["delta"] for o in seen)
                pad = max(3, 15 // len(seen))
                lo, hi = max(band["low"], lo_o - pad), min(band["high"], hi_o + pad)
                if lo_o < band["low"] or hi_o > band["high"] or lo > hi:
                    lo, hi = min(band["low"], lo_o), max(band["high"], hi_o)
                    how = "widened"
                else:
                    how = "narrowed"
                b = _band(lo, hi)
                b.update({"observed": seen, "how": how, "prior": {"low": band["low"], "high": band["high"]}})
            if fam in latest:
                now = latest[fam]["score"]
                b["now"] = {"score": now, "model": latest[fam]["model"], "date": latest[fam]["date"],
                            "low": max(300, min(850, now + b["low"])), "high": max(300, min(850, now + b["high"]))}
            fams[fam] = b
        out.append(dict(sc, families=fams, kind=kind))
    n = sum(len(v) for v in obs.values())
    note = ("Narrowed with " + (f"{n} change" + ("s" if n != 1 else "")) + " you recorded between scores of the same model. "
            "A few observations are not proof; the ranges stay estimates." if n else
            "Record each score you see with its model and what changed since the last one, and these ranges narrow to what your own scores show.")
    return dict(sim, scenarios=out, calibration={"observations": n, "note": note, "kinds": CHANGE_KINDS})


# ---------------------------------------------------------------- what a better rate is worth
def savings(amount, months, rate_now, rate_goal):
    """Monthly payment and total interest on a fixed-rate loan at two rates the person enters (annual
    percentage rates in basis points, 650 = 6.50%). The rates are theirs, from real quotes or a
    lender's own tiers; this tool does not supply rates."""
    if not isinstance(amount, int) or amount <= 0 or not isinstance(months, int) or not 1 <= months <= 480:
        raise CreditError("savings", "Enter the loan amount and a term of 1 to 480 months.")
    for r_ in (rate_now, rate_goal):
        if not isinstance(r_, int) or not 0 <= r_ <= 5000:
            raise CreditError("savings", "Enter rates between 0% and 50%.")

    def pay(bp):
        if bp == 0:
            return (amount + months - 1) // months
        i = bp / 120000.0
        return int(math.floor(amount * i / (1 - (1 + i) ** -months) + 0.5))  # half up, the same in the browser
    a, b = pay(rate_now), pay(rate_goal)
    ta, tb = a * months - amount, b * months - amount
    return {"amount": amount, "months": months, "now": {"rate": rate_now, "payment": a, "interest": ta},
            "goal": {"rate": rate_goal, "payment": b, "interest": tb}, "monthly_difference": a - b, "total_difference": ta - tb,
            "note": "Payments are rounded to the cent and assume a fixed rate with no fees. Use rates a lender actually quoted you."}


# ---------------------------------------------------------------- goodwill and negotiation, in writing first
AGREEMENT_ITEMS = [
    ("written", "The offer and its acceptance are in writing, on the company's letterhead"),
    ("signed", "It is signed by someone who can bind the company, with their name and title"),
    ("names", "It names you, the company, and the account number"),
    ("amount", "It states the exact amount, and it matches what you will pay"),
    ("reporting", "It says how the account will be reported: deleted, or paid in full, at every bureau the company reports to"),
    ("deadline", "It gives a date by which the company will update the bureaus"),
    ("method", "It names the payment method; pay in a way you can trace, never by giving access to your bank account"),
    ("rest", "For a settlement: it says the payment settles the whole balance and the rest will not be sold or collected"),
]


def negotiation_checklist(offer, sol_info=None, as_of=""):
    """The checks before paying anything on a goodwill, pay-for-delete or settlement offer.
    offer: {kind, amount, balance, agreement: {item: bool}, sent, response, paid, verified}."""
    kind = offer.get("kind", "")
    if kind not in ("goodwill", "pay_for_delete", "settlement"):
        raise CreditError("offer", "Choose goodwill, pay-for-delete or settlement.")
    ag = offer.get("agreement") or {}
    items = [] if kind == "goodwill" else [{"id": k, "text": t, "done": ag.get(k) is True} for k, t in AGREEMENT_ITEMS
                                         if not (k == "rest" and kind != "settlement")]
    warnings = []
    if kind != "goodwill":
        if sol_info and sol_info.get("time_barred"):
            warnings.append(f"The statute of limitations looks past ({sol_info.get('state_name', '')} estimate). A payment or a written promise can restart it in many states; talk to a consumer attorney or legal aid first.")
        else:
            warnings.append("Check the statute of limitations first: a payment or a written promise can restart it in many states.")
        warnings.append("A company can take the money and not delete. Pay only after you hold the signed agreement, and keep it: it is your evidence for a dispute.")
        if kind == "settlement":
            warnings.append("Forgiven debt can be taxable income; ask a tax professional.")
    ready = kind == "goodwill" or all(x["done"] for x in items)
    if offer.get("paid") and not offer.get("verified"):
        nxt = "Check the next reports from every bureau; if the account is not reported as agreed, dispute it with the signed agreement as evidence."
    elif offer.get("paid"):
        nxt = "Done. Keep the agreement and proof of payment in the vault."
    elif kind == "goodwill":
        nxt = "Wait for the reply; a goodwill request is a courtesy and many creditors decline." if offer.get("sent") else "Send the goodwill letter."
    elif not offer.get("sent"):
        nxt = "Send the written offer. Do not pay anything yet."
    elif not ready:
        nxt = "Do not pay yet: " + str(sum(1 for x in items if not x["done"])) + " of the agreement checks are not met."
    else:
        nxt = "The agreement passes every check. Pay by the agreed method and keep proof."
    cite = ["experian_goodwill"] if kind == "goodwill" else ["pay_for_delete", "settlement", "sol_table"]
    return {"kind": kind, "items": items, "ready_to_pay": ready and kind != "goodwill", "warnings": warnings, "next": nxt, "cite": cite}

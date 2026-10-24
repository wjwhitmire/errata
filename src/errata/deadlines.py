"""Legal deadlines from the dates in the mail log, the escalation ladder, reminders and an
iCalendar export. Clocks start on delivery (the date on the return receipt or the portal's
confirmation), not on mailing: FCRA 611(a)(1)(A) runs from the agency's receipt.
Twin: web/src/core/07_deadlines.js.
"""

from .law import DEADLINES
from .util import CreditError, add_business_days, add_days, days_between, is_business_day, long_date, parse_date


def deadline(kind, start):
    d = DEADLINES.get(kind)
    if not d:
        raise CreditError("deadline", "Unknown deadline: " + str(kind))
    if not start or parse_date(start) != start:
        raise CreditError("deadline", "A start date (YYYY-MM-DD) is needed for " + d["label"].lower() + ".")
    due = add_business_days(start, d["days"]) if d["business"] else add_days(start, d["days"])
    earliest = add_days(start, d["days"] - 1) if d.get("begins_on") else due
    return {"kind": kind, "label": d["label"], "start": start, "due": due, "earliest": earliest, "days": d["days"],
            "business": d["business"], "cite": d["cite"]}


# Which clocks a mailed item starts. kind is the letter's recipient class and purpose.
LETTER_CLOCKS = {
    "bureau_611": ["bureau_dispute", "furnisher_notice"], "obsolete_605": ["bureau_dispute", "furnisher_notice"],
    "personal_info": ["bureau_dispute"], "cares_act": ["bureau_dispute", "furnisher_notice"],
    "bankruptcy_correction": ["bureau_dispute", "furnisher_notice"], "reinsertion_demand": ["bureau_dispute"],
    "mov_611a7": ["mov"], "block_605b": ["block_605b"], "furnisher_623": ["furnisher_direct"],
    "dispute_notation": ["furnisher_direct"], "validation_regf": [], "inquiry_removal": [], "goodwill": [],
    "pay_for_delete": [], "settlement": [], "cease_1692c": [], "written_only": [], "disclosure_609": [],
    "cfpb_complaint": ["cfpb_response", "cfpb_final"], "state_ag_complaint": [], "intent_to_sue": [],
    "consumer_statement": [], "small_claims_outline": [], "security_freeze": ["freeze_mail"], "fraud_alert": [],
    "child_support_zero_delinquent": ["furnisher_direct"], "oag_review_request": [], "child_support_records": [],
}


def mail_deadlines(entry):
    """Deadlines for one mail log entry: {letter, delivered, extended, after_free_report, completed, reinserted}."""
    out = []
    letter = entry.get("letter", "")
    delivered = entry.get("delivered") or ""
    if not delivered:
        return out
    for k in LETTER_CLOCKS.get(letter, []):
        if k == "bureau_dispute" and (entry.get("extended") or entry.get("after_free_report")):
            k = "bureau_dispute_extended"
        out.append(deadline(k, delivered))
    if entry.get("completed"):
        out.append(deadline("results_notice", entry["completed"]))
    return out


def validation_window(sent="", received=""):
    """Reg F validation period: 30 days after receipt; the collector may assume receipt 5 business days
    (no Saturdays, Sundays or legal public holidays) after it sent the notice."""
    out = {}
    if sent:
        out["assumed_receipt"] = deadline("validation_assumed_receipt", sent)["due"]
    rec = received or out.get("assumed_receipt", "")
    if rec:
        out["period_end"] = deadline("validation_period", rec)["due"]
        out["received"] = rec
    return out


def oag_review_deadline(notice_date, received):
    """1 Tex. Admin. Code 55.103(c): request review not later than 30 days from the date the notice is
    received and not later than 45 days from the date on the notice. 55.104 lets a period that ends on a
    weekend or legal holiday run to the next working day and counts a mailed request by its postmark.
    The person's own deadline is shown the safe way: the earlier date, without counting on a roll-over
    (state holidays are not in this tool's calendar), with the rolled date shown as the latest reading."""
    n, r = parse_date(notice_date or ""), parse_date(received or "")
    if not n or not r:
        raise CreditError("deadline", "Enter the date on the notice and the date you received it (YYYY-MM-DD).")
    if r < n:
        raise CreditError("deadline", "The notice cannot arrive before the date printed on it.")
    a, b = add_days(r, 30), add_days(n, 45)
    due = min(a, b)
    latest = due
    while not is_business_day(latest):
        latest = add_days(latest, 1)
    return {"kind": "oag_review", "label": "Request administrative review (postmark by)", "start": r, "due": due, "earliest": due,
            "latest": latest, "from_receipt": a, "from_notice": b, "rule": "receipt" if a <= b else "notice",
            "cite": "tac55_103", "business": False, "days": 30 if a <= b else 45}


def collector_contact_check(first_letter_mailed, first_reported):
    """Reg F 1006.30(a)(1): a collector that mailed its first letter must wait a reasonable period
    (14 consecutive days in the official interpretation) before reporting."""
    if not first_letter_mailed:
        return {"ok": False, "reason": "No letter from the collector is on record before it reported."}
    wait = deadline("collector_wait", first_letter_mailed)["due"]
    if first_reported < wait:
        return {"ok": False, "reason": f"It reported on {first_reported}, before {wait}, 14 days after its letter was mailed."}
    return {"ok": True, "reason": f"It reported on or after {wait}."}


# ---------------------------------------------------------------- escalation ladder (research 6.3)
LADDER = [
    {"step": 0, "trigger": "New report imported", "action": "Clean up personal information; request a 609 file disclosure if sources or furnisher addresses are missing",
     "letters": ["personal_info", "disclosure_609"], "cite": ["fcra611", "fcra609"]},
    {"step": 1, "trigger": "Error found", "action": "Bureau dispute, one issue per account, evidence attached, certified mail",
     "letters": ["bureau_611"], "cite": ["fcra611"]},
    {"step": 2, "trigger": "Verified, or no answer 30 (45) days after delivery", "action": "Direct dispute to the furnisher; ask for the dispute notation",
     "letters": ["furnisher_623", "dispute_notation"], "cite": ["fcra623a8", "regv1022_43", "fcra623a3"]},
    {"step": 3, "trigger": "Bureau says verified", "action": "Ask the bureau how it verified (method of verification)",
     "letters": ["mov_611a7"], "cite": ["fcra611a6", "fcra611a7"]},
    {"step": 4, "trigger": "No or vague description after 15 days, or no furnisher answer after 30 days",
     "action": "Second bureau dispute with new information; CFPB complaint", "letters": ["bureau_611", "cfpb_complaint"],
     "cite": ["fcra611a3", "regv1022_43", "cfpb_complaint"]},
    {"step": 5, "trigger": "CFPB complaint closed without relief", "action": "State attorney general complaint",
     "letters": ["state_ag_complaint"], "cite": ["naag"]},
    {"step": 6, "trigger": "Documented, still-inaccurate item that was shared with a lender and caused harm",
     "action": "Talk to a consumer attorney (NACA); small claims information; notice of dispute and potential claim",
     "letters": ["intent_to_sue", "small_claims_outline"], "cite": ["fcra616", "fcra617", "fcra618", "naca"]},
]


def next_step(entry, as_of):
    """What to do next for a mail log entry, from its outcome and dates."""
    letter = entry.get("letter", "")
    outcome = entry.get("outcome", "")
    delivered = entry.get("delivered", "")
    if outcome == "deleted":
        return {"step": None, "action": "Deleted. Watch the next reports for reinsertion; a reinserted item needs written notice within 5 business days.",
                "letters": [], "cite": ["fcra611a5b"]}
    if outcome == "updated":
        return {"step": None, "action": "Updated. Check the new report line by line; dispute again only with a new, specific inaccuracy.",
                "letters": [], "cite": ["fcra611a3"]}
    if letter in ("bureau_611", "obsolete_605", "personal_info", "cares_act", "bankruptcy_correction"):
        if outcome == "verified":
            return dict(LADDER[3], also=LADDER[2])
        if delivered and not outcome:
            due = deadline("bureau_dispute_extended" if entry.get("extended") else "bureau_dispute", delivered)["due"]
            if as_of > due:
                return dict(LADDER[2], late=True, due=due, note="No result by " + long_date(due) + ". Log the date; send the furnisher dispute and a second bureau dispute noting the missed deadline.")
            return {"step": 1, "action": "Waiting for the bureau's result.", "letters": [], "cite": ["fcra611"], "due": due}
    if letter == "mov_611a7" and delivered and not outcome:
        due = deadline("mov", delivered)["due"]
        if as_of > due:
            return dict(LADDER[4], late=True, due=due)
        return {"step": 3, "action": "Waiting for the description of the procedure.", "letters": [], "cite": ["fcra611a7"], "due": due}
    if letter in ("furnisher_623", "dispute_notation") and delivered and not outcome:
        due = deadline("furnisher_direct", delivered)["due"]
        if as_of > due:
            return dict(LADDER[4], late=True, due=due)
        return {"step": 2, "action": "Waiting for the furnisher's answer.", "letters": [], "cite": ["regv1022_43"], "due": due}
    if letter == "cfpb_complaint":
        if outcome in ("closed", "no_relief", "verified"):
            return LADDER[5]
        return {"step": 4, "action": "Waiting for the company's response (usually within 15 days).", "letters": [], "cite": ["cfpb_complaint"]}
    if letter == "state_ag_complaint" and outcome in ("closed", "no_relief"):
        return LADDER[6]
    if outcome == "no_response":
        return LADDER[4]
    return {"step": None, "action": "Record the delivery date from the return receipt to start the clock." if not delivered else "No automatic next step.",
            "letters": [], "cite": []}


def reminders(entries, as_of, window=7):
    """Deadlines that are past or within `window` days, soonest first."""
    out = []
    for e in entries:
        if e.get("outcome"):
            continue
        for d in mail_deadlines(e):
            left = days_between(as_of, d["due"])
            if left <= window:
                out.append({"entry": e.get("id", ""), "label": d["label"], "due": d["due"], "days_left": left,
                            "overdue": left < 0, "cite": d["cite"], "subject": e.get("subject", "")})
    out.sort(key=lambda x: (x["due"], x["entry"], x["label"]))
    return out


def _ics_escape(s):
    # a carriage return could end the line early and start a property of its own; it goes like a newline
    return str(s).replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\r\n", "\n").replace("\r", "\n").replace("\n", "\\n")


def ics(events, stamp, product=""):
    """events: [{uid, date (ISO), title, description}]; stamp: 'YYYYMMDDTHHMMSSZ'. All-day events."""
    from .brand import PRODUCT_NAME
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:" + (product or "-//Field Tools//" + PRODUCT_NAME + "//EN"), "CALSCALE:GREGORIAN"]
    for e in sorted(events, key=lambda x: (x["date"], x["uid"])):
        d = e["date"].replace("-", "")
        nxt = add_days(e["date"], 1).replace("-", "")
        lines += ["BEGIN:VEVENT", "UID:" + _ics_escape(e["uid"]), "DTSTAMP:" + stamp, "DTSTART;VALUE=DATE:" + d,
                  "DTEND;VALUE=DATE:" + nxt, "SUMMARY:" + _ics_escape(e["title"])]
        if e.get("description"):
            lines.append("DESCRIPTION:" + _ics_escape(e["description"]))
        lines += ["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + _ics_escape(e["title"]), "TRIGGER:-P2D", "END:VALARM", "END:VEVENT"]
    lines.append("END:VCALENDAR")
    out = []
    for ln in lines:
        while len(ln.encode("utf-8")) > 75:
            cut = 75
            while len(ln[:cut].encode("utf-8")) > 75:
                cut -= 1
            out.append(ln[:cut])
            ln = " " + ln[cut:]
        out.append(ln)
    return "\r\n".join(out) + "\r\n"

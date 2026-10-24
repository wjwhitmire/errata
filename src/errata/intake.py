"""Two ways in besides a report PDF, and one way back.

- parse_csv: accounts typed by hand or exported from a spreadsheet (comma or tab separated, a
  header row naming the columns; extra columns ignored), into the normalized model.
- manual_report: the same from a list of dicts (the browser's manual entry form).
- parse_response: a bureau's or furnisher's results letter (its text, from the PDF text layer or the
  text reader) into a proposed outcome per account (deleted, updated, verified), with the line that
  supports it. The person confirms each outcome; nothing is recorded from this alone.
Twin: web/src/core/05_intake.js.
"""

import re

from .model import classify, new_account, new_report
from .tu import account_confidence, finish
from .util import CreditError, norm_name, norm_space, parse_date, parse_money, parse_month

MAX_ROWS = 50000
COLUMNS = {
    "bureau": "bureau", "name": "name", "creditor": "name", "account name": "name", "number": "number", "account number": "number",
    "account": "number", "type": "account_type", "account type": "account_type", "loan type": "loan_type", "opened": "opened",
    "date opened": "opened", "balance": "balance", "limit": "credit_limit", "credit limit": "credit_limit", "high balance": "high_balance",
    "past due": "past_due", "status": "pay_status", "pay status": "pay_status", "closed": "closed", "date closed": "closed",
    "paid": "paid", "date paid": "paid", "removal": "removal", "estimated removal": "removal", "original creditor": "original_creditor",
    "history": "history", "remarks": "remarks", "terms": "terms", "address": "address", "updated": "updated", "date updated": "updated",
    "dofd": "dofd", "date of first delinquency": "dofd",
}
BUREAU_WORDS = {"transunion": "transunion", "tu": "transunion", "experian": "experian", "ex": "experian", "exp": "experian",
                "equifax": "equifax", "eq": "equifax", "efx": "equifax"}


def split_rows(text):
    """A small CSV reader: quotes, doubled quotes, comma or tab (whichever the header uses)."""
    text = str(text or "").replace("\r\n", "\n").replace("\r", "\n")
    first = text.split("\n", 1)[0]
    sep = "\t" if first.count("\t") > first.count(",") else ","
    rows, row, cell, q, i = [], [], "", False, 0
    while i < len(text):
        ch = text[i]
        if q:
            if ch == '"':
                if i + 1 < len(text) and text[i + 1] == '"':
                    cell += '"'
                    i += 1
                else:
                    q = False
            else:
                cell += ch
        elif ch == '"' and cell == "":
            q = True
        elif ch == sep:
            row.append(cell)
            cell = ""
        elif ch == "\n":
            row.append(cell)
            rows.append(row)
            row, cell = [], ""
        else:
            cell += ch
        i += 1
    if cell or row:
        row.append(cell)
        rows.append(row)
    return [r for r in rows if any(c.strip() for c in r)]


def _history(text):
    out = []
    for part in re.split(r"[;|]", str(text or "")):
        m = re.match(r"^\s*(\d{4}-\d{2}|\d{2}/\d{4})\s*[:=]\s*([A-Za-z0-9/]+)\s*$", part)
        if m:
            out.append({"rating": m.group(2).upper(), "bal": None, "high": None, "past_due": None, "paid": None, "due": None,
                        "remarks": [], "month": parse_month(m.group(1))})
    out = [h for h in out if h["month"]]
    out.sort(key=lambda h: h["month"])
    return out


def _account(rec, warnings):
    a = new_account()
    a["section"] = "manual"
    for k, v in rec.items():
        v = norm_space(v)
        if k in ("balance", "credit_limit", "high_balance", "past_due"):
            a[k] = parse_money(v)
            if v and a[k] is None:
                warnings.append({"account": rec.get("name", ""), "field": k, "message": "Could not read the amount '" + v + "'."})
        elif k in ("opened", "closed", "paid", "updated"):
            a[k] = parse_date(v) or ""
            if v and not a[k]:
                warnings.append({"account": rec.get("name", ""), "field": k, "message": "Could not read the date '" + v + "'."})
        elif k in ("removal", "dofd"):
            a[k] = parse_month(v) or ""
        elif k == "history":
            a["history"] = _history(v)
        elif k == "remarks":
            a["remarks"] = [norm_space(x) for x in v.split(";") if norm_space(x)]
        elif k == "terms":
            from .tu import parse_terms
            a["terms"] = parse_terms(v)
        elif k in a and isinstance(a[k], str):
            a[k] = v
    a["raw"] = {k: norm_space(v) for k, v in rec.items()}
    # a status typed by hand that says late, charged off or in collection is adverse even without a grid,
    # as it is for the template readers; otherwise the 7-year and re-aging rules never look at it
    a["pay_status_adverse"] = bool(re.search(r"PAST DUE|LATE|DELINQ|CHARGE|COLLECTION", a.get("pay_status", ""), re.I))
    a["kind"], a["flags"] = classify(a)
    a["confidence"] = account_confidence(a)
    return a


def manual_report(bureau, records, report_date=""):
    b = BUREAU_WORDS.get(norm_space(bureau).lower(), "unknown")
    r = new_report(b)
    r["source"].update({"kind": "manual", "parser": "manual"})
    for rec in records:
        if not norm_space(rec.get("name", "")):
            raise CreditError("input", "Every account needs a creditor name.")
        r["accounts"].append(_account(rec, r["warnings"]))
    finish(r, report_date)
    r["source"]["report_date"] = r["source"]["report_date"] or report_date
    return r


def parse_csv(text, bureau="", report_date=""):
    rows = split_rows(text)
    if not rows:
        raise CreditError("input", "The file is empty.")
    if len(rows) > MAX_ROWS + 1:
        raise CreditError("input", f"The file has more than {MAX_ROWS:,} rows.")
    head = [norm_space(h).lower() for h in rows[0]]
    cols = [COLUMNS.get(h) for h in head]
    if "name" not in cols:
        raise CreditError("input", "The first row must name the columns, with one called name or creditor.")
    by = {}
    for row in rows[1:]:
        rec = {}
        for c, v in zip(cols, row):
            if c:
                rec[c] = v
        b = BUREAU_WORDS.get(norm_space(rec.pop("bureau", bureau)).lower(), BUREAU_WORDS.get(norm_space(bureau).lower(), "unknown"))
        if not norm_space(rec.get("name", "")):
            continue
        by.setdefault(b, []).append(rec)
    if not by:
        raise CreditError("input", "No accounts were found under the header row.")
    return [manual_report(b, recs, report_date) for b, recs in sorted(by.items())]


# ---------------------------------------------------------------- results letters
OUTCOME_WORDS = [("deleted", r"\b(DELETED|REMOVED|HAS BEEN DELETED|WAS DELETED|NO LONGER APPEARS)\b"),
                 ("updated", r"\b(UPDATED|MODIFIED|CHANGED|CORRECTED|REVISED)\b"),
                 ("verified", r"\b(VERIFIED|REMAINS|NO CHANGE|ACCURATE AS REPORTED|VERIFIED AS ACCURATE|CONFIRMED)\b")]


def parse_response(text, accounts):
    """Proposed outcomes per account named in a results letter."""
    t = norm_space(str(text or "").upper().replace("\n", " "))
    spots = []
    for a in accounts:
        n = norm_name(a.get("name"))
        if not n:
            continue
        k = norm_name(t).find(n)
        if k >= 0:
            spots.append((k, a))
    nt = norm_name(t)
    spots.sort(key=lambda x: (x[0], x[1]["id"]))
    items = []
    for i, (k, a) in enumerate(spots):
        end = spots[i + 1][0] if i + 1 < len(spots) else min(len(nt), k + 600)
        window = nt[k:end]
        best = None
        for outcome, pat in OUTCOME_WORDS:
            m = re.search(pat, window)
            if m and (best is None or m.start() < best[1]):
                best = (outcome, m.start())
        if best:
            snip = window[max(0, best[1] - 60):best[1] + 40].strip()
            items.append({"account_id": a["id"], "name": a["name"], "outcome": best[0], "evidence": snip})
    dm = re.search(r"\b(\d{2}/\d{2}/\d{4})\b", t)
    return {"items": items, "frivolous": bool(re.search(r"FRIVOLOUS|IRRELEVANT", t)),
            "reinsertion": bool(re.search(r"REINSERT", t)), "date": parse_date(dm.group(1)) if dm else ""}

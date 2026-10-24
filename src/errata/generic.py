"""A template-driven reader for reports printed as labeled fields, and the Experian and Equifax
templates.

How the Experian and Equifax reports are printed was taken from the bureaus' published
descriptions of their consumer reports and from the general structure every bureau report shares
(personal information, accounts with labeled fields and a monthly payment history, collections,
public records, inquiries). No real Experian or Equifax report was used to build or test these
templates, so they are written to be forgiving and to say so: every value keeps its raw text, every
field the reader cannot place becomes a warning, the parse confidence drops, and the person checks
and corrects fields before anything is used in a letter.

The reader works on lines of positioned text (errata.textlayer):
- a line that matches a template heading starts a section;
- in an account section, a line with one all-capital cell that is not a known label starts an
  account (the creditor name);
- a field is a known label with its value in the next cell on the line, or written as
  "Label: value" in one cell; a line made only of labels takes its values from the next line,
  matched by column;
- a payment history row is a four-digit year followed by up to twelve codes, placed in month
  columns by a header row of month names when there is one;
- an inquiry is a line in an inquiry section with a name and a date.
Templates are data (TEMPLATES below), so a changed layout is a data change.
Twin: web/src/core/13_generic.js.
"""

import re

from .model import classify, new_account, new_report
from .textlayer import column_of, make_lines, nearest
from .tu import account_confidence, finish, parse_terms, strip_marks
from .util import norm_space, parse_date, parse_money, parse_month

MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
CODE_MAP = {"OK": "OK", "✓": "OK", "C": "C", "CO": "CO", "C/O": "CO", "X": "X", "-": "X", "--": "X", "ND": "X", "N/R": "X", "NR": "X",
            "30": "30", "60": "60", "90": "90", "120": "120", "150": "150", "180": "180", "CLS": "X", "*": "OK", "E": "OK", "0": "OK",
            "1": "30", "2": "60", "3": "90", "4": "120", "5": "150", "6": "180", "7": "C", "8": "CO", "9": "CO", "G": "C", "H": "C", "J": "C", "K": "C", "L": "CO"}

COMMON_FIELDS = {
    "account name": "name", "creditor name": "name", "account number": "number", "account #": "number",
    "original creditor": "original_creditor", "account type": "account_type", "loan type": "loan_type", "loan/account type": "loan_type",
    "date opened": "opened", "opened": "opened", "date closed": "closed", "date paid": "paid", "status": "pay_status",
    "account status": "pay_status", "payment status": "pay_status", "balance": "balance", "current balance": "balance",
    "credit limit": "credit_limit", "high credit": "high_balance", "highest balance": "high_balance", "high balance": "high_balance",
    "original amount": "high_balance", "past due": "past_due", "amount past due": "past_due", "monthly payment": "monthly_payment",
    "scheduled payment amount": "monthly_payment", "terms": "terms", "responsibility": "responsibility", "owner": "responsibility",
    "date reported": "updated", "status updated": "updated", "balance updated": "updated", "date updated": "updated",
    "date of last payment": "last_payment", "last payment date": "last_payment", "recent payment": "payment_received",
    "date of first delinquency": "dofd", "first delinquency": "dofd", "on record until": "removal", "estimated removal": "removal",
    "comments": "remarks", "remarks": "remarks", "narrative code": "remarks", "address": "address", "phone": "phone", "phone number": "phone",
}

TEMPLATES = {
    # Used only for saved web pages (errata.htmltext); TransUnion PDFs have their own reader (errata.tu).
    "transunion": {
        "name": "TransUnion",
        "detect": r"\bTransUnion\b",
        "parser": "transunion-template-1",
        "report_date": [r"Report (?:date|created)[: ]+(\d{2}/\d{2}/\d{4})", r"Date (?:of|created)[: ]+(\d{2}/\d{2}/\d{4})"],
        "file_number": [r"File number[: ]+([A-Z0-9-]+)"],
        "headings": {"personal information": "personal", "accounts": "accounts", "adverse accounts": "accounts", "satisfactory accounts": "accounts",
                     "account information": "accounts", "collections": "collections", "collection accounts": "collections", "public records": "public",
                     "regular inquiries": "inq_hard", "hard inquiries": "inq_hard", "inquiries": "inq_hard", "promotional inquiries": "inq_review",
                     "account review inquiries": "inq_review", "soft inquiries": "inq_review", "consumer statements": "statements",
                     "consumer statement": "statements", "additional information": "end", "contact information": "end"},
        "personal": {"name": "name", "also known as": "aka", "other names": "aka", "current address": "address", "address": "address",
                     "other addresses": "address", "previous address": "address", "previous addresses": "address", "date of birth": "dob",
                     "social security number": "ssn", "ssn": "ssn", "telephone numbers": "phone", "telephone": "phone", "phone": "phone",
                     "phone numbers": "phone", "employer": "employer", "employment data": "employer", "employers": "employer"},
        "fields": {"pay status": "pay_status", "date updated": "updated", "estimated month and year this item will be removed": "removal",
                   "estimated removal date": "removal", "loan type": "loan_type", "remarks": "remarks", "terms": "terms"},
    },
    "experian": {
        "name": "Experian",
        "detect": r"\bExperian\b",
        "parser": "experian-template-1",
        "report_date": [r"Report (?:date|generated)[: ]+(\d{2}/\d{2}/\d{4})", r"Prepared (?:on|for [^\n]*? on)[: ]+(\d{2}/\d{2}/\d{4})"],
        "file_number": [r"Report number[: ]+([A-Z0-9-]+)"],
        "headings": {"personal information": "personal", "accounts": "accounts", "adverse accounts": "accounts", "accounts in good standing": "accounts",
                     "collection accounts": "collections", "collections": "collections", "public records": "public", "hard inquiries": "inq_hard",
                     "soft inquiries": "inq_review", "inquiries shared with others": "inq_hard", "inquiries shared only with you": "inq_review",
                     "personal statements": "statements", "contact us": "end", "know your rights": "end"},
        "personal": {"name": "name", "names": "aka", "also known as": "aka", "other names": "aka", "address": "address", "current address": "address",
                     "previous address": "address", "other addresses": "address", "year of birth": "dob", "date of birth": "dob",
                     "social security number": "ssn", "phone number": "phone", "phone numbers": "phone", "employer": "employer", "employers": "employer"},
        "fields": {"company sold": "remarks", "sold to": "remarks", "status details": "remarks"},
    },
    "equifax": {
        "name": "Equifax",
        "detect": r"\bEquifax\b",
        "parser": "equifax-template-1",
        "report_date": [r"Report Date[: ]+(\d{2}/\d{2}/\d{4})", r"Date(?: of)? Report[: ]+(\d{2}/\d{2}/\d{4})"],
        "file_number": [r"Confirmation (?:Number|#)[: ]+([A-Z0-9-]+)"],
        "headings": {"personal information": "personal", "revolving accounts": "accounts", "mortgage accounts": "accounts",
                     "installment accounts": "accounts", "other accounts": "accounts", "credit accounts": "accounts", "consumer finance accounts": "accounts",
                     "collections": "collections", "public records": "public", "hard inquiries": "inq_hard", "soft inquiries": "inq_review",
                     "inquiries": "inq_hard", "dispute file information": "end", "consumer statements": "statements"},
        "personal": {"name": "name", "formerly known as": "aka", "also known as": "aka", "current address": "address", "previous address": "address",
                     "address": "address", "date of birth": "dob", "social security number": "ssn", "phone": "phone", "telephone": "phone",
                     "employer": "employer", "employment history": "employer"},
        "fields": {"creditor classification": "loan_type", "activity designator": "remarks", "terms duration": "terms", "terms frequency": "terms",
                   "charge off amount": "charge_off", "deferred payment start date": "skip", "balloon payment amount": "skip", "months reviewed": "skip",
                   "date major delinquency first reported": "dofd", "credit limit / high credit": "credit_limit"},
    },
}

MONEY = {"balance", "credit_limit", "high_balance", "past_due", "monthly_payment", "payment_received", "charge_off"}
DATES = {"opened", "closed", "paid", "updated", "last_payment"}
MONTHS_ONLY = {"dofd", "removal"}
IGNORE = re.compile(r"^(payment history|account history|\d+-month payment history|year|account details|contact information)$", re.I)
SECTION_TYPE = {"revolving accounts": "Revolving", "installment accounts": "Installment", "mortgage accounts": "Mortgage", "other accounts": "Open",
                "consumer finance accounts": "Installment"}
TYPE_WORDS = [(re.compile(r"CREDIT CARD|CHARGE CARD|REVOLVING|LINE OF CREDIT|FLEXIBLE SPENDING", re.I), "Revolving"),
              (re.compile(r"MORTGAGE|HOME EQUITY LOAN|REAL ESTATE", re.I), "Mortgage"),
              (re.compile(r"AUTO|STUDENT|INSTALLMENT|PERSONAL LOAN|CONSUMER LOAN|LEASE|SECURED LOAN", re.I), "Installment"),
              (re.compile(r"COLLECTION", re.I), "Collection"), (re.compile(r"OPEN|UTILITY|TELECOM", re.I), "Open")]
DATE_RE = re.compile(r"\b(\d{1,2}/\d{1,2}/\d{4}|\d{1,2}/\d{4})\b")


def detect(items):
    head = " ".join(str(i.get("s", "")) for i in (items or [])[:120])
    if re.search(r"TransUnion Credit Report", head):
        return None
    for b in ("experian", "equifax"):
        if re.search(TEMPLATES[b]["detect"], head):
            return b
    return None


def _labels(t):
    m = dict(COMMON_FIELDS)
    m.update(t["fields"])
    return m


def _label_of(s, labels):
    k = norm_space(s).rstrip(":").lower()
    return labels.get(k)


def _date(v):
    v = norm_space(v)
    d = parse_date(v)
    if d:
        return d
    m = re.match(r"^(\d{1,2})/(\d{4})$", v)
    if m:
        return f"{m.group(2)}-{int(m.group(1)):02d}-01"
    return parse_date(v) or ""


def _set(a, key, raw, warnings):
    v = norm_space(raw)
    if not v or key == "skip":
        return
    a["raw"][key] = v if key not in a["raw"] else a["raw"][key] + "; " + v
    if key in MONEY:
        if key == "charge_off":
            a["remarks"].append("Charge off amount " + v)
            return
        if v in ("-", "--", "---", "None", "N/A"):
            return
        m = parse_money(v)
        if m is None:
            warnings.append({"account": a["name"], "field": key, "raw": v, "value": "", "conf": 50, "message": "Could not read the amount '" + v + "'."})
        else:
            a[key] = m
    elif key in DATES:
        d = _date(v)
        if not d and v not in ("-", "--", "None", "N/A"):
            warnings.append({"account": a["name"], "field": key, "raw": v, "value": "", "conf": 50, "message": "Could not read the date '" + v + "'."})
        a[key] = d or a.get(key, "")
    elif key in MONTHS_ONLY:
        a[key] = parse_month(v) or (_date(v)[:7] if _date(v) else "")
        if not a[key] and v not in ("-", "--", "None", "N/A"):
            warnings.append({"account": a["name"], "field": key, "raw": v, "value": "", "conf": 50, "message": "Could not read the month '" + v + "'."})
    elif key == "terms":
        prev = a["terms"]["text"]
        a["terms"] = parse_terms((prev + " " + v).strip() if prev else v)
    elif key == "remarks":
        for part in re.split(r";\s*", v):
            if part:
                a["remarks"].append(part)
    elif key == "pay_status":
        s, adv = strip_marks(v)
        a["pay_status"] = s
        a["pay_status_adverse"] = adv or bool(re.search(r"PAST DUE|LATE|DELINQ|CHARGE|COLLECTION", s, re.I))
    elif key in a and isinstance(a[key], str):
        a[key] = v


def _code(s):
    t = norm_space(s).upper()
    return CODE_MAP.get(t, t if t in CODE_MAP.values() else None)


def _history_row(cells, anchors):
    """A year row: [{month, rating}] or None."""
    if not cells or not re.match(r"^(19|20)\d{2}$", cells[0]["s"]):
        return None
    year = cells[0]["s"]
    out = []
    rest = cells[1:]
    if len(rest) > 12:
        return None
    for i, c in enumerate(rest):
        code = _code(c["s"])
        if code is None:
            return None
        mi = nearest(c["x"], anchors) if anchors else i
        out.append({"month": f"{year}-{mi + 1:02d}", "rating": code, "bal": None, "high": None, "past_due": None, "paid": None, "due": None, "remarks": []})
    return out


def _month_header(cells):
    names = [norm_space(c["s"]).upper()[:3] for c in cells]
    if len(names) >= 6 and all(n in MONTHS for n in names):
        return [MONTHS.index(n) for n in names], [c["x"] for c in cells]
    if len(names) >= 7 and norm_space(cells[0]["s"]).upper() == "YEAR" and all(n in MONTHS for n in names[1:]):
        return [MONTHS.index(n) for n in names[1:]], [c["x"] for c in cells[1:]]
    return None


def _types(a, hint):
    """Account type words as printed ("Credit card", "Auto loan") to the model's account and loan types."""
    printed = a["account_type"]
    if printed and not re.match(r"^(Revolving|Installment|Mortgage|Open|Collection)( Account)?$", printed, re.I):
        a["loan_type"] = a["loan_type"] or printed
        a["account_type"] = ""
    if not a["account_type"]:
        kind = hint
        for rx, k in TYPE_WORDS:
            if not kind and (rx.search(a["loan_type"]) or rx.search(printed)):
                kind = k
        if a["section"] == "collections":
            kind = "Collection"
            a["loan_type"] = a["loan_type"] if COLLECTION_WORD.search(a["loan_type"]) else "Collection"
        a["account_type"] = (kind + " Account") if kind and kind != "Collection" else a["account_type"]


COLLECTION_WORD = re.compile(r"COLLECTION|FACTORING|DEBT BUYER", re.I)


def _set_personal(r, key, val):
    v = norm_space(val)
    if not v:
        return
    p = r["personal"]
    if key == "name":
        p["names"].insert(0, {"name": v, "kind": "primary"}) if not any(n["kind"] == "primary" for n in p["names"]) else p["names"].append({"name": v, "kind": "aka"})
    elif key == "aka":
        for part in re.split(r";\s*", v):
            p["names"].append({"name": part, "kind": "aka"})
    elif key == "address":
        dm = DATE_RE.search(v)
        text = norm_space(DATE_RE.sub("", v).replace("Reported", "").replace("reported", ""))
        p["addresses"].append({"text": text, "kind": "current" if not p["addresses"] else "previous", "reported": _date(dm.group(1)) if dm else ""})
    elif key == "dob":
        p["dob"] = _date(v) or (v if re.match(r"^\d{4}$", v) else "")
    elif key == "ssn":
        p["ssn_masked"] = v
        m = re.search(r"(\d{4})\s*$", v)
        p["ssn_last4"] = m.group(1) if m else ""
    elif key == "phone":
        for part in re.split(r";\s*", v):
            p["phones"].append({"number": part})
    elif key == "employer":
        p["employers"].append({"name": v, "occupation": "", "location": "", "verified": ""})


def parse(items, report_date="", bureau=None):
    bureau = bureau or detect(items)
    if bureau not in TEMPLATES:
        from .util import CreditError
        raise CreditError("parse", "This does not look like an Experian or Equifax report.")
    t = TEMPLATES[bureau]
    labels = _labels(t)
    r = new_report(bureau)
    r["source"].update({"kind": "pdf", "parser": t["parser"], "pages": (max([int(i.get("p", 0)) for i in items]) + 1) if items else 0})
    lines = make_lines(items)
    alltext = "\n".join(ln["text"] for ln in lines[:200])
    for pat in t["report_date"]:
        m = re.search(pat, alltext, re.I)
        if m:
            r["source"]["report_date"] = parse_date(m.group(1)) or ""
            break
    for pat in t["file_number"]:
        m = re.search(pat, alltext, re.I)
        if m:
            r["source"]["file_number"] = m.group(1)
            break
    section = "intro"
    acct = None
    anchors = None
    pending = None   # a row of labels waiting for its values on the next line
    unknown = 0
    type_hint = ""
    for ln in lines:
        text = norm_space(ln["text"])
        low = text.lower().rstrip(":")
        if low in t["headings"]:
            section = t["headings"][low]
            type_hint = SECTION_TYPE.get(low, "")
            acct, anchors, pending = None, None, None
            continue
        cells = ln["cells"]
        if section in ("intro", "end", "public", "statements"):
            if section == "statements" and text:
                r["statements"].append(text)
            continue
        if section == "personal":
            i = 0
            while i < len(cells):
                key = t["personal"].get(norm_space(cells[i]["s"]).rstrip(":").lower())
                inline = re.match(r"^([^:]{2,40}):\s*(.+)$", cells[i]["s"])
                if key and i + 1 < len(cells):
                    _set_personal(r, key, cells[i + 1]["s"])
                    i += 2
                    continue
                if inline and t["personal"].get(inline.group(1).strip().lower()):
                    _set_personal(r, t["personal"][inline.group(1).strip().lower()], inline.group(2))
                i += 1
            continue
        if section.startswith("inq"):
            dm = DATE_RE.search(text)
            name = norm_space(DATE_RE.sub("", text))
            if dm and name and not _label_of(name, labels):
                d = _date(dm.group(1))
                kind = "hard" if section == "inq_hard" else "review"
                q = next((x for x in r["inquiries"] if x["name"] == name and x["kind"] == kind), None)
                if q:
                    q["dates"].append(d)
                else:
                    r["inquiries"].append({"kind": kind, "name": name, "dates": [d], "location": "", "phone": "", "inquiry_type": "", "purpose": ""})
            continue
        # accounts and collections
        hdr = _month_header(cells)
        if hdr:
            anchors = hdr[1]
            continue
        if acct is not None:
            row = _history_row(cells, anchors)
            if row is not None:
                acct["history"].extend(row)
                continue
        if pending is not None:
            for c in cells:
                k = column_of(c["x"], [x for x, _ in pending], 6)
                _set(acct, pending[k][1], c["s"], r["warnings"])
            pending = None
            continue
        keys = [_label_of(c["s"], labels) for c in cells]
        if acct is not None and len(cells) >= 2 and all(keys):
            pending = [(c["x"], k) for c, k in zip(cells, keys)]
            continue
        if len(cells) == 1 and not keys[0] and re.match(r"^[A-Z0-9][A-Z0-9 &'.,/\-]{2,}$", cells[0]["s"]) and not re.match(r"^[\d/$,.\s-]+$", cells[0]["s"]):
            acct = new_account()
            acct["name"] = norm_space(cells[0]["s"])
            acct["section"] = "collections" if section == "collections" else "accounts"
            acct["raw"]["section_type"] = type_hint
            if section == "collections":
                acct["loan_type"] = "Collection"
            r["accounts"].append(acct)
            anchors = None
            continue
        if acct is None or IGNORE.match(text):
            continue
        i = 0
        placed = False
        while i < len(cells):
            k = keys[i]
            inline = re.match(r"^([^:]{2,40}):\s*(.*)$", cells[i]["s"])
            if k and i + 1 < len(cells) and not keys[i + 1]:
                _set(acct, k, cells[i + 1]["s"], r["warnings"])
                i += 2
                placed = True
                continue
            if inline and _label_of(inline.group(1), labels):
                _set(acct, _label_of(inline.group(1), labels), inline.group(2), r["warnings"])
                placed = True
            i += 1
        if not placed:
            unknown += 1
    for a in r["accounts"]:
        a["history"].sort(key=lambda h: h["month"])
        seen = {}
        for h in a["history"]:
            seen[h["month"]] = h
        a["history"] = [seen[m] for m in sorted(seen)]
        _types(a, a["raw"].pop("section_type", ""))
        a["kind"], a["flags"] = classify(a)
        a["confidence"] = account_confidence(a)
    if unknown:
        r["messages"].append(f"{unknown} line(s) in the account sections were not recognized; check the accounts against the report.")
    finish(r, report_date)
    if unknown:
        r["source"]["confidence"] = max(0, r["source"]["confidence"] - min(15, unknown))
    return r

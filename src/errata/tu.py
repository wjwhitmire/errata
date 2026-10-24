"""TransUnion consumer report parser (the annualcreditreport.com and transunion.com PDF layout as
printed in 2026). Input: positioned text items (see textlayer). Output: the normalized model.

The layout, as the parser reads it:
- header lines ("Your TransUnion Credit Report", "File Number:", "Date Created:");
- personal information as label and value pairs on one line (Credit Report Date, Social Security
  Number, Date of Birth, Name, AKA, Current Address, Other Address, Date Reported, Phone Number);
- employers as a two-column table followed by "Date Verified" and optional "Location" rows;
- account cards: an "Account Name / Account Number" row, then rows of up to three labels with
  their values on the lines below, aligned under each label, then a "Payment History" grid whose
  month labels set the column positions; each cell stacks optional Bal, High, Past Due, Paid and
  Due lines, an optional >remark< and a rating;
- inquiries (regular, promotional, account review) as name and date rows followed by label rows;
- specialty blocks (ChexSystems, Teletrack) as rows of "Label:" cells with values below.
Twin: web/src/core/04_tu.js.
"""

import re

from .model import RATINGS, account_id, classify, new_account, new_report
from .textlayer import column_of, make_cells, make_lines, nearest, split_columns
from .util import norm_space, parse_date, parse_money, parse_month

PARSER = "transunion-2026"

HEADINGS = {
    "personal information": "personal", "also known as": "personal", "addresses": "personal",
    "phone numbers": "personal", "employers": "employers", "accounts": "intro", "payment/remarks key": "intro",
    "ratings": "intro",
    "accounts with adverse information": "adverse", "satisfactory accounts": "satisfactory",
    "inquiries": "intro", "regular inquiries": "inq_hard", "promotional inquiries": "inq_promo",
    "account review inquiries": "inq_review", "credit report messages": "messages",
    "additional information": "intro", "public records": "public", "consumer statement": "statements",
    "consumer statements": "statements",
    "checking account and demand deposit account (dda) activity": "specialty",
    "supplemental consumer credit information": "specialty",
    "should you wish to contact transunion, you may do so": "contact", "summary of rights": "rights",
}

FIELD_LABELS = {
    "Address": "address", "Phone": "phone", "Monthly Payment": "monthly_payment", "Date Opened": "opened",
    "Responsibility": "responsibility", "Account Type": "account_type", "Loan Type": "loan_type",
    "Balance": "balance", "Date Updated": "updated", "Payment Received": "payment_received",
    "Last Payment Made": "last_payment", "Original Creditor": "original_creditor", "Pay Status": "pay_status",
    "Terms": "terms", "Date Closed": "closed", "Date Paid": "paid", "High Balance": "high_balance",
    "High Balance (Hist.)": "high_balance_hist", "Credit Limit": "credit_limit",
    "Credit Limit (Hist.)": "credit_limit_hist", "Maximum Delinquency Note": "max_delinquency",
    "Estimated month and year this item will be removed": "removal", "Remarks": "remarks",
    "Past Due": "past_due", "Date of First Delinquency": "dofd", "Date Placed for Collection": "placed",
}
MONEY_FIELDS = {"monthly_payment", "balance", "payment_received", "high_balance", "credit_limit", "past_due"}
DATE_FIELDS = {"opened", "updated", "last_payment", "closed", "paid", "placed"}
PERSONAL_KEYS = {"Credit Report Date", "Social Security Number", "Date of Birth", "Name", "AKA", "Current Address",
                 "Other Address", "Date Reported", "Phone Number"}
INQ_LABELS = {"Name", "Requested On", "Location", "Phone", "Inquiry Type", "Permissible Purpose"}
MONTH_CELL = re.compile(r"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}$")
DATE_CELL = re.compile(r"^\d{2}/\d{2}/\d{4}$")


def _heading(line):
    t = norm_space(line["text"]).lower()
    if len(line["cells"]) == 1 and t in HEADINGS:
        return t
    return None


def _is_label_line(line, labels):
    return bool(line["cells"]) and all(c["s"] in labels for c in line["cells"])


def strip_marks(s):
    """'>Charge-off<' -> ('Charge-off', True)."""
    t = norm_space(s)
    adverse = bool(re.search(r">[^<>]*<", t))
    t = re.sub(r"[<>]", "", t)
    return norm_space(t), adverse


def detect(items):
    head = " ".join(str(i.get("s", "")) for i in (items or [])[:80])
    return "transunion" if re.search(r"TransUnion Credit Report|TransUnion", head) else None


TERM_AMOUNT = re.compile(r"\$([0-9][0-9,]*)(?:\.\d{2})?\s*(?:per\s+month|a\s+month|/\s*mo(?:nth)?\b|monthly\b)", re.I)
TERM_MONTHS = re.compile(r"(?:for\s+)?(?<![$\d,.])(\d{1,3})\s*(?:months?\b|month\(s\)|mos?\b\.?)", re.I)
TERM_FREQ = re.compile(r"\b(Monthly|Weekly|Bi-?weekly|Semi-?monthly|Quarterly|Annually|Yearly)\b", re.I)


def parse_terms(text):
    """Terms as the bureaus print them: "$185 per month, paid Monthly for 120 months" (TransUnion),
    "120 Months", "$185 / 120 Months", "Monthly" and "60 mo." (other layouts), or a bare number of
    months when the field is the term's duration."""
    t = norm_space(text)
    m = TERM_AMOUNT.search(t)
    n = TERM_MONTHS.search(t)
    months = int(n.group(1)) if n else None
    if months is None and re.fullmatch(r"\d{1,3}", t) and 1 <= int(t) <= 480:
        months = int(t)
    f = re.search(r"paid\s+(Monthly|Weekly|Biweekly|Bi-weekly|Semimonthly|Quarterly|Annually|Yearly)", t, re.I) or TERM_FREQ.search(t)
    amount = parse_money(m.group(1)) if m else None
    if amount is None:
        bare = re.match(r"^\$([0-9][0-9,]*)(?:\.\d{2})?(?:\s|$|/)", t)
        if bare and (months or f):
            amount = parse_money(bare.group(1))
    return {"text": t, "amount": amount, "months": months if months and months <= 480 else None,
            "frequency": f.group(1).capitalize() if f else ""}


def parse_max_delinquency(text):
    t = norm_space(text)
    m = re.search(r"of\s+(\d+)\s+days", t, re.I)
    entries = []
    for e in re.finditer(r"in\s+(\d{2}/\d{4})(?:\s+for\s+\$([0-9][0-9,]*))?", t):
        entries.append({"month": parse_month(e.group(1)), "amount": parse_money(e.group(2)) if e.group(2) else None})
    return {"text": t, "days": int(m.group(1)) if m else None, "entries": entries}


def parse_hist_ranges(text):
    """'Credit limit of $700 from 01/2020 to 06/2021; $900 ...' -> [{amount, start, end}]."""
    out = []
    for m in re.finditer(r"\$([0-9][0-9,]*)(?:\s+from\s+(\d{2}/\d{4})\s+to\s+(\d{2}/\d{4}))?", norm_space(text)):
        out.append({"amount": parse_money(m.group(1)), "start": parse_month(m.group(2)) if m.group(2) else "",
                    "end": parse_month(m.group(3)) if m.group(3) else ""})
    return out


def latest_amount(text):
    r = parse_hist_ranges(text)
    if not r:
        return None
    r.sort(key=lambda x: (x["end"] or "", x["start"] or ""))
    return r[-1]["amount"]


def _set_field(a, key, raw, warnings):
    raw = norm_space(raw)
    if re.fullmatch(r"[-\s]+", raw or "x"):
        raw = "---"
    a["raw"][key] = raw
    if key in MONEY_FIELDS:
        v, _ = strip_marks(raw)
        a[key] = parse_money(v)
        if raw and raw not in ("---",) and a[key] is None:
            warnings.append({"account": a["name"], "field": key, "message": "Could not read the amount '" + raw + "'."})
    elif key in DATE_FIELDS:
        v, _ = strip_marks(raw)
        a[key] = parse_date(v) or ""
        if v and v != "---" and not a[key]:
            warnings.append({"account": a["name"], "field": key, "message": "Could not read the date '" + raw + "'."})
    elif key == "removal" or key == "dofd":
        a[key] = parse_month(strip_marks(raw)[0]) or ""
    elif key == "pay_status":
        v, adv = strip_marks(raw)
        a["pay_status"] = v
        a["pay_status_adverse"] = adv
    elif key == "terms":
        a["terms"] = parse_terms(raw)
    elif key == "max_delinquency":
        a["max_delinquency"] = parse_max_delinquency(raw)
    elif key == "remarks":
        parts = [strip_marks(p)[0] for p in re.split(r";", raw) if strip_marks(p)[0]]
        a["remarks"] = [p for p in parts if p != "---"]
    elif key in ("high_balance_hist", "credit_limit_hist"):
        a[key] = raw
    else:
        a[key] = "" if raw == "---" else raw


def _parse_cell(texts):
    """One payment history cell: its lines top to bottom."""
    cell = {"rating": "", "bal": None, "high": None, "past_due": None, "paid": None, "due": None, "remarks": []}
    for t in texts:
        t = norm_space(t)
        m = re.match(r"^(Bal|High|Past Due|Paid|Due|Limit):\s*(.*)$", t)
        if m:
            key = {"Bal": "bal", "High": "high", "Past Due": "past_due", "Paid": "paid", "Due": "due", "Limit": "limit"}[m.group(1)]
            if key == "limit":
                continue
            cell[key] = parse_money(m.group(2))
            continue
        for tok in t.split(" "):
            v, adv = strip_marks(tok)
            if adv or (v and v.upper() not in RATINGS):
                if v:
                    cell["remarks"].append(v)
            elif v:
                cell["rating"] = v.upper()
    return cell


def _parse_grid(lines, i, a):
    """Read a payment history grid starting at lines[i] (the first line after 'Payment History')."""
    n = len(lines)
    cells = {}
    while i < n:
        ln = lines[i]
        if _stop_line(ln):
            break
        if all(MONTH_CELL.match(c["s"]) for c in ln["cells"]):
            anchors = [c["x"] for c in ln["cells"]]
            months = [parse_month(c["s"]) for c in ln["cells"]]
            cols = [[] for _ in anchors]
            i += 1
            while i < n and not _stop_line(lines[i]) and not all(MONTH_CELL.match(c["s"]) for c in lines[i]["cells"]):
                parts = [[] for _ in anchors]
                for it in lines[i]["items"]:
                    parts[nearest(it["x"], anchors)].append(it)
                for k, p in enumerate(parts):
                    if p:
                        cols[k].append(" ".join(c["s"] for c in make_cells(p)))
                i += 1
            for k, mo in enumerate(months):
                if mo:
                    c = _parse_cell(cols[k])
                    c["month"] = mo
                    cells[mo] = c
            continue
        i += 1
    a["history"] = [cells[k] for k in sorted(cells)]
    return i


def _stop_line(ln):
    if _heading(ln):
        return True
    t = ln["text"]
    if t.startswith("Account Name") or _is_label_line(ln, FIELD_LABELS):
        return True
    if ln["cells"] and ln["cells"][0]["s"] in ("Name",) and len(ln["cells"]) == 2:
        return True
    return False


def _parse_card(lines, i, section, report):
    """lines[i] is the 'Account Name / Account Number' row."""
    warnings = report["warnings"]
    head = lines[i]
    num_x = head["cells"][1]["x"] if len(head["cells"]) > 1 else 10 ** 6
    a = new_account()
    a["section"] = section
    i += 1
    if i < len(lines):
        name_cols = split_columns(lines[i], [head["cells"][0]["x"], num_x], 6.0)
        a["name"], a["number"] = name_cols[0], name_cols[1]
        i += 1
    anchors, keys = None, None
    buf = {}
    order = []
    while i < len(lines):
        ln = lines[i]
        if ln["text"].startswith("Account Name") or _heading(ln):
            break
        if ln["text"] == "Payment History":
            i = _parse_grid(lines, i + 1, a)
            break
        if _is_label_line(ln, FIELD_LABELS):
            anchors = [c["x"] for c in ln["cells"]]
            keys = [FIELD_LABELS[c["s"]] for c in ln["cells"]]
            for k in keys:
                if k not in buf:
                    buf[k] = []
                    order.append(k)
            i += 1
            continue
        if anchors is None:
            warnings.append({"account": a["name"], "field": "", "message": "Unplaced text in account card: " + ln["text"][:80]})
            i += 1
            continue
        vals = split_columns(ln, anchors, 6.0)
        for k, v in zip(keys, vals):
            if v:
                buf[k].append(v)
        i += 1
    for k in order:
        _set_field(a, k, " ".join(buf[k]), warnings)
    if a["credit_limit"] is None and a["credit_limit_hist"]:
        a["credit_limit"] = latest_amount(a["credit_limit_hist"])
    if a["high_balance"] is None and a["high_balance_hist"]:
        r = parse_hist_ranges(a["high_balance_hist"])
        a["high_balance"] = max((x["amount"] for x in r if x["amount"] is not None), default=None)
    a["kind"], a["flags"] = classify(a)
    a["confidence"] = account_confidence(a)
    return a, i


def account_confidence(a):
    score = 100
    for k, pts in (("name", 30), ("opened", 15), ("pay_status", 15), ("account_type", 10)):
        if not a.get(k):
            score -= pts
    if a.get("balance") is None:
        score -= 10
    hist = a.get("history", [])
    if hist:
        from .util import month_index
        idx = [month_index(h["month"]) for h in hist]
        if idx and (max(idx) - min(idx) + 1) != len(idx):
            score -= 5
        if any(not h["rating"] and h["bal"] is None for h in hist):
            score -= 5
    return max(0, score)


def _parse_inquiry_block(lines, i, kind, report):
    req_x = None
    anchors, keys = None, None
    cur = None
    while i < len(lines):
        ln = lines[i]
        if _heading(ln):
            break
        cells = ln["cells"]
        if _is_label_line(ln, INQ_LABELS):
            if [c["s"] for c in cells] == ["Name", "Requested On"]:
                req_x = cells[1]["x"]
            else:
                anchors = [c["x"] for c in cells]
                keys = [c["s"] for c in cells]
            i += 1
            continue
        if req_x is None:
            i += 1
            continue
        right = [c for c in cells if c["x"] >= req_x - 8]
        left = [c for c in cells if c["x"] < req_x - 8]
        if right and all(DATE_CELL.match(c["s"]) for c in right) and left and (anchors is None or cur is None or
                                                                               _starts_new(ln, anchors)):
            cur = {"name": " ".join(c["s"] for c in left), "dates": [parse_date(c["s"]) for c in right],
                   "kind": kind, "location": "", "phone": "", "inquiry_type": "", "purpose": ""}
            report["inquiries"].append(cur)
            anchors, keys = None, None
        elif right and not left and all(DATE_CELL.match(c["s"]) for c in right) and cur is not None:
            cur["dates"].extend(parse_date(c["s"]) for c in right)
        elif cur is not None and anchors is not None:
            for k, v in zip(keys, split_columns(ln, anchors, 6.0)):
                if not v:
                    continue
                f = {"Location": "location", "Phone": "phone", "Inquiry Type": "inquiry_type",
                     "Permissible Purpose": "purpose", "Name": "name", "Requested On": "requested"}[k]
                if f == "requested":
                    continue
                cur[f] = norm_space((cur.get(f, "") + " " + v))
        i += 1
    return i


def _starts_new(ln, anchors):
    return True


def _parse_specialty(lines, i, report):
    block = {"source": "", "requested_by": "", "requested_on": "", "fields": {}}
    report["specialty"].append(block)
    anchors, keys = None, None
    expect_source = False
    while i < len(lines):
        ln = lines[i]
        if _heading(ln):
            break
        cells = ln["cells"]
        if ln["text"].strip() == "Data Source:":
            expect_source = True
            i += 1
            continue
        if expect_source:
            block["source"] = ln["text"]
            expect_source = False
            i += 1
            continue
        if cells and all(c["s"].endswith(":") for c in cells):
            anchors = [c["x"] for c in cells]
            keys = [c["s"][:-1] for c in cells]
            i += 1
            continue
        if anchors is not None:
            for k, v in zip(keys, split_columns(ln, anchors, 6.0)):
                if k == "Requested by":
                    block["requested_by"] = v
                elif k == "Requested on":
                    block["requested_on"] = parse_date(v) or v
                else:
                    block["fields"][k] = v
            anchors = None
        i += 1
    return i


def parse(items, report_date=""):
    """Parse TransUnion report items into the normalized model."""
    lines = make_lines(items)
    r = new_report("transunion")
    r["source"].update({"kind": "pdf", "parser": PARSER, "pages": (max((i.get("p", 0) for i in items), default=-1) + 1)})
    section = "header"
    i = 0
    n = len(lines)
    pending = None
    last_personal = None
    emp_anchors = None
    emp_label_anchors, emp_label_keys = None, None
    while i < n:
        ln = lines[i]
        h = _heading(ln)
        if h:
            section = HEADINGS[h]
            i += 1
            if section in ("inq_hard", "inq_promo", "inq_review"):
                i = _parse_inquiry_block(lines, i, {"inq_hard": "hard", "inq_promo": "promotional", "inq_review": "review"}[section], r)
            elif section == "specialty":
                i = _parse_specialty(lines, i, r)
            continue
        t = ln["text"]
        cells = ln["cells"]
        if section == "header":
            if pending:
                if pending == "file":
                    r["source"]["file_number"] = t
                elif pending == "date":
                    r["source"]["report_date"] = parse_date(t) or ""
                elif pending == "for":
                    r["personal"]["report_for"] = t
                pending = None
            elif t.startswith("File Number"):
                v = t.split(":", 1)[1].strip()
                if v:
                    r["source"]["file_number"] = v
                else:
                    pending = "file"
            elif t.startswith("Date Created"):
                v = t.split(":", 1)[1].strip()
                if v:
                    r["source"]["report_date"] = parse_date(v) or ""
                else:
                    pending = "date"
            elif t.startswith("Personal Credit Report for"):
                pending = "for"
            i += 1
            continue
        if section == "personal":
            m = re.search(r"on our files since (\d{2}/\d{2}/\d{4})", t)
            if m:
                r["personal"]["on_file_since"] = parse_date(m.group(1)) or ""
            if len(cells) >= 2 and cells[0]["s"] in PERSONAL_KEYS:
                key, val = cells[0]["s"], " ".join(c["s"] for c in cells[1:])
                last_personal = _set_personal(r, key, val)
            elif len(cells) == 1 and last_personal is not None and cells[0]["x"] > 100:
                last_personal["text"] = norm_space(last_personal["text"] + " " + cells[0]["s"])
            i += 1
            continue
        if section == "employers":
            if [c["s"] for c in cells] == ["Employer", "Occupation"]:
                emp_anchors = [cells[0]["x"], cells[1]["x"]]
                i += 1
                continue
            if cells and all(c["s"] in ("Date Verified", "Location", "Date Reported") for c in cells):
                emp_label_anchors = [c["x"] for c in cells]
                emp_label_keys = [c["s"] for c in cells]
                i += 1
                continue
            if emp_label_anchors and r["personal"]["employers"]:
                e = r["personal"]["employers"][-1]
                for k, v in zip(emp_label_keys, split_columns(ln, emp_label_anchors, 6.0)):
                    if k in ("Date Verified", "Date Reported"):
                        e["verified"] = parse_date(v) or v
                    elif k == "Location":
                        e["location"] = v
                emp_label_anchors = None
            elif emp_anchors:
                cols = split_columns(ln, emp_anchors, 6.0)
                occ = cols[1] if cols[1] not in ("---",) else ""
                r["personal"]["employers"].append({"name": cols[0], "occupation": occ, "location": "", "verified": ""})
            i += 1
            continue
        if section in ("adverse", "satisfactory", "public") and t.startswith("Account Name") and len(cells) >= 1:
            a, i = _parse_card(lines, i, section, r)
            r["accounts"].append(a)
            continue
        if section == "messages":
            if not t.startswith("Your credit report contains"):
                r["messages"].append(t)
        elif section == "statements":
            r["statements"].append(t)
        i += 1
    finish(r, report_date)
    return r


def _set_personal(r, key, val):
    p = r["personal"]
    val = norm_space(val)
    if key == "Credit Report Date":
        p["on_file_since"] = p["on_file_since"] or (parse_date(val) or "")
    elif key == "Social Security Number":
        p["ssn_masked"] = val
        m = re.search(r"(\d{4})\s*$", val)
        p["ssn_last4"] = m.group(1) if m else ""
    elif key == "Date of Birth":
        p["dob"] = parse_date(val) or val
    elif key == "Name":
        p["names"].append({"name": val, "kind": "primary"})
    elif key == "AKA":
        p["names"].append({"name": val, "kind": "aka"})
    elif key in ("Current Address", "Other Address"):
        rec = {"text": val, "kind": "current" if key == "Current Address" else "other", "reported": ""}
        p["addresses"].append(rec)
        return rec
    elif key == "Date Reported":
        if p["addresses"]:
            p["addresses"][-1]["reported"] = parse_date(val) or val
    elif key == "Phone Number":
        p["phones"].append({"number": val})
    return None


def finish(r, report_date=""):
    """Ids, report date fallback and the overall parse confidence."""
    if not r["source"].get("report_date") and report_date:
        r["source"]["report_date"] = report_date
    seen = {}
    for a in r["accounts"]:
        base = account_id(r["bureau"], a)
        seen[base] = seen.get(base, 0) + 1
        a["id"] = base if seen[base] == 1 else base + "-" + str(seen[base])
    for k, q in enumerate(r["inquiries"]):
        q["dates"] = sorted({d for d in q["dates"] if d}, reverse=True)
        q["id"] = "q" + str(k + 1)
    conf = [a["confidence"] for a in r["accounts"]]
    base = (2 * sum(conf) + len(conf)) // (2 * len(conf)) if conf else (60 if r["personal"]["names"] else 0)
    if not r["personal"]["names"]:
        base -= 20
    base -= min(20, 2 * len(r["warnings"]))
    r["source"]["confidence"] = max(0, min(100, base))
    return r

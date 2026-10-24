"""Write the synthetic TransUnion-layout test reports in tests/fixtures/ with reportlab.

Every person, address, phone number, employer, creditor and account number here is invented.
The reports follow the 2026 TransUnion consumer report layout (label rows with values aligned
below them, a payment history grid of month cells) so the parser is tested on the real shape
without anyone's real data. Each planted error is listed in PLANTED with the rule that must
find it; tests/test_fixtures.py checks every one, and that the clean accounts produce nothing.

Run: python tests/fixtures/make_fixtures.py   (needs reportlab)
"""

from pathlib import Path

HERE = Path(__file__).resolve().parent
PAGE_W, PAGE_H = 595.28, 841.89
COLS3 = [20.0, 205.74, 391.48]
GRID = [16.0, 110.0, 204.0, 298.0, 391.0, 485.0]
MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def months(start, n):
    y, m = int(start[:4]), int(start[5:7])
    out = []
    for _ in range(n):
        out.append(f"{y:04d}-{m:02d}")
        m += 1
        if m > 12:
            y, m = y + 1, 1
    return out


def grid(start, ratings, **lines):
    """ratings: list of rating strings; lines: optional per-month lists (bal, high, past_due, paid, due, remark)."""
    ms = months(start, len(ratings))
    cells = []
    for i, (mo, r) in enumerate(zip(ms, ratings)):
        c = {"month": mo, "rating": r}
        for k, v in lines.items():
            if v is not None and i < len(v) and v[i] is not None:
                c[k] = v[i]
        cells.append(c)
    return cells


def ok(n):
    return ["OK"] * n


# ---------------------------------------------------------------- the planted report
PERSON = {
    "report_for": "JORDAN SAMPLE",
    "file_number": "900000001",
    "date_created": "10/20/2026",
    "on_file": "03/14/2008",
    "ssn": "XXX-XX-0000",
    "dob": "01/01/1980",
    "name": "JORDAN QUINN SAMPLE",
    "aka": ["JORDAN SAMPLE", "JORDAN Q. SAMPEL", "JORDAN R. SAMPLE", "JORDON SAMPLE"],
    "addresses": [
        ("Current Address", "100 EXAMPLE AVE ANYTOWN, TX 75001-1234", "08/01/2025"),
        ("Other Address", "100 EXAMPLE AVE APT 100EXA ANYTOWN, TX 75001-1234", "02/10/2025"),
        ("Other Address", "22 TESTING RD APT 5 SAMPLEVILLE, OK 73001-0001", "06/28/2022"),
        ("Other Address", "22 TESTING RD APT 55 SAMPLEVILLE, OK 73001-0002", "01/15/2021"),
        ("Other Address", "4 PLACEHOLDER CT FICTION CITY, TX 75002-4444", "03/14/2008"),
    ],
    "phones": ["(512) 555-0134", "(123) 555-0101", "(214) 555-0199"],
    "employers": [("EXAMPLE FREIGHT CO", "DISPATCHER", "", "04/02/2019"),
                  ("SAMPLE LOGISTICS INC", "DRIVER", "ANYTOWN, TX", "05/09/2013")],
}

ADDR_BANK = "PO BOX 0001 ANYTOWN, TX 75001"

ACCOUNTS_ADVERSE = [
    {  # PLANTED paid_then_late: paid $0 secured card with later 30/60/90
        "name": "EXAMPLE SECURED CARD", "number": "4000111122****",
        "rows": [
            [("Address", ADDR_BANK), ("Phone", "(800) 555-0110"), ("Monthly Payment", "---")],
            [("Date Opened", "05/12/2019"), ("Responsibility", "Individual Account"), ("Account Type", "Revolving Account")],
            [("Loan Type", "CREDIT CARD"), ("Balance", "$0"), ("Date Updated", "10/31/2024")],
            [("Payment Received", "$25"), ("Last Payment Made", "03/15/2024"), ("High Balance", "$310")],
            [("Credit Limit", "$300"), ("Pay Status", "Paid, Closed; was Paid as agreed"), ("Terms", "Paid Monthly")],
            [("Date Closed", "09/27/2024"), ("Date Paid", "03/15/2024"), ("Maximum Delinquency Note", "Maximum Delinquency of 90 days in 07/2024 for $75")],
            [("Remarks", "CLOSED BY CREDIT GRANTOR; CLOSED")],
        ],
        "grid": grid("2023-10", ok(7) + ["30", "60", "90", "OK", "OK", "OK"]),
    },
    {  # PLANTED max_delinquency_mismatch: note says 60 in 04/2022, grid shows 30 there and nothing worse
        "name": "SAMPLE AUTO FINANCE", "number": "7310****",
        "rows": [
            [("Address", "ONE EXAMPLE PLAZA MAIL DROP 1 DETROIT, MI 48226"), ("Phone", "(313) 555-0120"), ("Monthly Payment", "$0")],
            [("Date Opened", "08/15/2019"), ("Responsibility", "Individual Account"), ("Account Type", "Installment Account")],
            [("Loan Type", "AUTOMOBILE"), ("Balance", "$0"), ("Date Updated", "12/20/2023")],
            [("Payment Received", "$0"), ("Last Payment Made", "12/20/2023"), ("High Balance", "$31,450")],
            [("Pay Status", "Paid, Closed; was Paid as agreed"), ("Terms", "$0 per month, paid Monthly for 54 months"), ("Date Closed", "12/20/2023")],
            [("Maximum Delinquency Note", "Maximum Delinquency of 60 days in 04/2022 for $410"), ("Remarks", "CLOSED")],
        ],
        "grid": grid("2021-11", ok(5) + ["30"] + ok(19)),
    },
    {  # PLANTED skipped_step: a 60 right after an OK month with $0 past due (government child support)
        "name": "EXAMPLE STATE CHILD SUPPORT OFFICE", "number": "7777****",
        "rows": [
            [("Address", "PO BOX 0002 CAPITAL CITY, TX 78701-0002"), ("Phone", "(512) 555-0130"), ("Monthly Payment", "---")],
            [("Date Opened", "03/09/2021"), ("Responsibility", "Individual Account"), ("Account Type", "Open Account")],
            [("Loan Type", "CHILD SUPPORT"), ("Balance", "$1,800"), ("Date Updated", "09/22/2026")],
            [("Payment Received", "$0"), ("Last Payment Made", "07/07/2026"), ("Pay Status", ">Account 60 Days Past Due Date<")],
            [("Terms", "Paid Monthly"), ("Estimated month and year this item will be removed", "08/2033"),
             ("Maximum Delinquency Note", "Maximum Delinquency of 60 days in 09/2026 for $900")],
        ],
        "grid": grid("2026-01", ok(8) + ["60"], bal=[0, 0, 0, 0, 0, 0, 0, 900, 1800],
                     past_due=[0, 0, 0, 0, 0, 0, 0, 0, 900], paid=[900, 900, 900, 900, 900, 900, 900, 0, 0]),
    },
    {  # PLANTED zero_terms_amounts_due (BNPL), clean otherwise
        "name": "PAYLATER EXAMPLE INC", "number": "PLA1****",
        "rows": [
            [("Address", "1 SAMPLE STREET SUITE 600 SAN FRANCISCO, CA 94199"), ("Phone", "(415) 555-0140"), ("Monthly Payment", "$0")],
            [("Date Opened", "07/21/2025"), ("Responsibility", "Individual Account"), ("Account Type", "Installment Account")],
            [("Loan Type", "UNSECURED"), ("Balance", "$272"), ("Date Updated", "10/02/2026")],
            [("Payment Received", "$45"), ("Last Payment Made", "09/13/2026"), ("Original Creditor", "EXAMPLE PARTNER BANK")],
            [("Pay Status", ">Account 30 Days Past Due Date<"), ("Terms", "$0 per month, paid Monthly for 12 months"),
             ("Estimated month and year this item will be removed", "06/2033")],
            [("Maximum Delinquency Note", "Maximum Delinquency of 30 days in 08/2026 for $45"), ("High Balance (Hist.)", "High balance of $540 from 08/2025 to 10/2026")],
        ],
        "grid": grid("2025-08", ok(12) + ["30", "OK"], bal=[540, 497, 452, 407, 362, 362, 317, 317, 317, 317, 317, 317, 317, 272],
                     past_due=[0] * 12 + [45, 0], paid=[0, 45, 45, 45, 45, 0, 45, 0, 0, 0, 0, 0, 0, 45],
                     due=[45] * 14),
    },
    {  # PLANTED zero_terms_amounts_due (second BNPL)
        "name": "PAYLATER EXAMPLE INC", "number": "PLB2****",
        "rows": [
            [("Address", "1 SAMPLE STREET SUITE 600 SAN FRANCISCO, CA 94199"), ("Phone", "(415) 555-0140"), ("Monthly Payment", "$0")],
            [("Date Opened", "02/10/2026"), ("Responsibility", "Individual Account"), ("Account Type", "Installment Account")],
            [("Loan Type", "UNSECURED"), ("Balance", "$120"), ("Date Updated", "10/02/2026")],
            [("Payment Received", "$30"), ("Last Payment Made", "09/10/2026"), ("Original Creditor", "EXAMPLE PARTNER BANK")],
            [("Pay Status", ">Account 30 Days Past Due Date<"), ("Terms", "$0 per month, paid Monthly for 6 months"),
             ("Estimated month and year this item will be removed", "06/2033")],
            [("Maximum Delinquency Note", "Maximum Delinquency of 30 days in 07/2026 for $30")],
        ],
        "grid": grid("2026-03", ["OK", "OK", "OK", "OK", "30", "OK", "OK", "OK"], due=[30] * 8,
                     past_due=[0, 0, 0, 0, 30, 0, 0, 0]),
    },
    {  # PLANTED obsolete: charge-off past its own estimated removal date, lates from 2018
        "name": "OLD EXAMPLE RETAIL", "number": "6011****",
        "rows": [
            [("Address", "PO BOX 0003 ANYTOWN, OH 43001"), ("Phone", "(614) 555-0150"), ("Monthly Payment", "---")],
            [("Date Opened", "05/02/2016"), ("Responsibility", "Individual Account"), ("Account Type", "Revolving Account")],
            [("Loan Type", "CHARGE ACCOUNT"), ("Balance", "$640"), ("Date Updated", "09/27/2026")],
            [("Pay Status", ">Charged Off<"), ("Estimated month and year this item will be removed", "12/2024"), ("Remarks", ">PROFIT AND LOSS WRITEOFF<")],
            [("Maximum Delinquency Note", "Maximum Delinquency of 120 days in 09/2018 for $210"), ("Credit Limit (Hist.)", "Credit limit of $800 from 05/2016 to 10/2018")],
        ],
        "grid": grid("2018-03", ok(3) + ["30", "60", "90", "120", "C/O"]),
    },
    {  # PLANTED reaged: removal estimate years later than the first late in its own grid
        "name": "MIDTOWN EXAMPLE CARD", "number": "4111222233****",
        "rows": [
            [("Address", "PO BOX 0004 MIDTOWN, NY 10001"), ("Phone", "(212) 555-0160"), ("Monthly Payment", "---")],
            [("Date Opened", "03/11/2018"), ("Responsibility", "Individual Account"), ("Account Type", "Revolving Account")],
            [("Loan Type", "CREDIT CARD"), ("Balance", "$2,310"), ("Date Updated", "10/01/2026")],
            [("Pay Status", ">Charged Off<"), ("Estimated month and year this item will be removed", "06/2030"), ("Remarks", ">PROFIT AND LOSS WRITEOFF<")],
            [("Maximum Delinquency Note", "Maximum Delinquency of 120 days in 04/2021 for $480"), ("Credit Limit (Hist.)", "Credit limit of $2,500 from 03/2018 to 05/2021")],
        ],
        "grid": grid("2020-10", ok(3) + ["30", "60", "90", "120", "C/O", "C/O"]),
    },
    {  # PLANTED duplicate_debt (original creditor side): charged off, transferred, still a balance
        "name": "NORTHWIND EXAMPLE BANK", "number": "5424****",
        "rows": [
            [("Address", "PO BOX 0005 WILMINGTON, DE 19801"), ("Phone", "(302) 555-0170"), ("Monthly Payment", "---")],
            [("Date Opened", "08/19/2020"), ("Responsibility", "Individual Account"), ("Account Type", "Revolving Account")],
            [("Loan Type", "CREDIT CARD"), ("Balance", "$1,840"), ("Date Updated", "08/31/2026")],
            [("Pay Status", ">Charged Off<"), ("Estimated month and year this item will be removed", "03/2031"),
             ("Remarks", ">PROFIT AND LOSS WRITEOFF<; TRANSFERRED TO RECOVERY")],
            [("Maximum Delinquency Note", "Maximum Delinquency of 120 days in 07/2024 for $520"), ("Credit Limit (Hist.)", "Credit limit of $2,000 from 08/2020 to 07/2024")],
        ],
        "grid": grid("2024-01", ok(3) + ["30", "60", "90", "120", "C/O", "C/O"]),
    },
    {  # a legitimate 30, 60, 90 progression: must give no skipped_step or note finding
        "name": "PROGRESSION EXAMPLE CARD", "number": "3712****",
        "rows": [
            [("Address", "PO BOX 0006 PHOENIX, AZ 85001"), ("Phone", "(602) 555-0180"), ("Monthly Payment", "$35")],
            [("Date Opened", "02/17/2021"), ("Responsibility", "Individual Account"), ("Account Type", "Revolving Account")],
            [("Loan Type", "CREDIT CARD"), ("Balance", "$410"), ("Date Updated", "09/27/2026")],
            [("Last Payment Made", "09/13/2026"), ("Pay Status", "Current Account"), ("Terms", "$35 per month; paid Monthly")],
            [("Maximum Delinquency Note", "Maximum Delinquency of 90 days in 06/2026 for $105"), ("Credit Limit (Hist.)", "Credit limit of $500 from 04/2021 to 09/2026")],
        ],
        "grid": grid("2026-01", ["OK", "OK", "OK", "30", "60", "90", "OK", "OK", "OK"],
                     bal=[303, 322, 341, 383, 404, 426, 419, 416, 410], past_due=[0, 0, 0, 35, 70, 105, 0, 0, 0],
                     due=[35] * 9),
    },
]

COLLECTIONS = [
    {"name": "EXAMPLE DEBT BUYERS LLC", "number": "8801****", "addr": "PO BOX 0007 GREENVILLE, SC 29699",
     "phone": "(864) 555-0190", "opened": "05/27/2026", "type": "FACTORING COMPANY ACCOUNT", "bal": "$1,512", "high": "$1,530",
     "oc": "EXAMPLE ONE BANK", "removal": "08/2032", "updated": "10/02/2026"},
    {"name": "SAMPLE ASSET RECOVERY", "number": "8802****", "addr": "40 EXAMPLE WAY SUITE 2 NORFOLK, VA 23599",
     "phone": "(757) 555-0191", "opened": "06/02/2026", "type": "FACTORING COMPANY ACCOUNT", "bal": "$740", "high": "$760",
     "oc": "SAMPLE RETAIL BANK", "removal": "08/2032", "updated": "10/08/2026"},
    {  # PLANTED duplicate_debt (collector side) and reaged against the original creditor's removal date
        "name": "TEST RECEIVABLES LLC", "number": "8803****", "addr": "18 SAMPLE BLVD EDINA, MN 55499",
        "phone": "(952) 555-0192", "opened": "05/19/2026", "type": "FACTORING COMPANY ACCOUNT", "bal": "$1,840", "high": "$1,840",
        "oc": "NORTHWIND EXAMPLE BANK", "removal": "08/2032", "updated": "10/17/2026"},
]

ACCOUNTS_SATISFACTORY = [
    {  # clean revolving card with full grid lines; matched by an inquiry on its open date
        "name": "EXAMPLE CARD BANK", "number": "4929000011****",
        "rows": [
            [("Address", "PO BOX 0008 OGDEN, UT 84499"), ("Phone", "(801) 555-0200"), ("Monthly Payment", "$40")],
            [("Date Opened", "02/04/2025"), ("Responsibility", "Individual Account"), ("Account Type", "Revolving Account")],
            [("Loan Type", "CREDIT CARD"), ("Balance", "$1,225"), ("Date Updated", "10/10/2026")],
            [("Last Payment Made", "10/05/2026"), ("Pay Status", "Current Account"), ("Terms", "$40 per month; paid Monthly")],
            [("Credit Limit (Hist.)", "Credit limit of $5,000 from 04/2025 to 10/2026")],
        ],
        "grid": grid("2025-04", ok(19), bal=[415 + 45 * i for i in range(19)], high=[1300] * 19, past_due=[0] * 19, due=[40] * 19),
    },
    {  # clean mortgage
        "name": "SAMPLE MORTGAGE CO", "number": "0099887766****",
        "rows": [
            [("Address", "PO BOX 0009 DALLAS, TX 75201"), ("Phone", "(214) 555-0210"), ("Monthly Payment", "$1,620")],
            [("Date Opened", "05/20/2021"), ("Responsibility", "Joint Account"), ("Account Type", "Mortgage Account")],
            [("Loan Type", "CONVENTIONAL REAL ESTATE MORTGAGE"), ("Balance", "$212,400"), ("Date Updated", "10/01/2026")],
            [("Last Payment Made", "09/27/2026"), ("Pay Status", "Current Account"), ("Terms", "$1,620 per month, paid Monthly for 360 months")],
            [("High Balance", "$240,000")],
        ],
        "grid": grid("2024-10", ok(24), past_due=[0] * 24, due=[1620] * 24),
    },
    {  # clean paid auto loan with real terms
        "name": "EXAMPLE CREDIT UNION", "number": "88****",
        "rows": [
            [("Address", "PO BOX 0010 AUSTIN, TX 78701"), ("Phone", "(512) 555-0220"), ("Monthly Payment", "$0")],
            [("Date Opened", "03/04/2019"), ("Responsibility", "Individual Account"), ("Account Type", "Installment Account")],
            [("Loan Type", "AUTOMOBILE"), ("Balance", "$0"), ("Date Updated", "03/04/2024")],
            [("Payment Received", "$310"), ("Last Payment Made", "03/04/2024"), ("High Balance", "$16,700")],
            [("Pay Status", "Paid, Closed; was Paid as agreed"), ("Terms", "$310 per month, paid Monthly for 60 months"), ("Date Closed", "03/04/2024")],
            [("Remarks", "CLOSED")],
        ],
        "grid": grid("2022-03", ok(23)),
    },
]

INQUIRIES = {
    "hard": [
        {"name": "EXAMPLE LENDING CO", "dates": ["05/18/2026"], "loc": "PO BOX 0011 FORT WAYNE, IN 46899", "phone": "(812) 555-0230", "type": "Individual"},
        {"name": "SAMPLE AUTO GROUP", "dates": ["02/09/2026"], "loc": "200 SAMPLE PKWY PLANO, TX 75024", "phone": "(972) 555-0231",
         "type": "Individual", "purpose": "CREDIT TRANSACTION"},
        {"name": "EXAMPLE CARD BANK", "dates": ["02/04/2025"], "loc": "200 EXAMPLE DRIVE RICHMOND, VA 23299", "phone": "(804) 555-0232", "type": "Individual"},
    ],
    "promotional": [
        {"name": "PRESCREEN EXAMPLE CARD", "dates": ["08/19/2026", "02/20/2026"], "loc": "5 SAMPLE PKWY MACON, GA 31299", "phone": "(770) 555-0240"},
    ],
    "review": [
        {"name": "EXAMPLE CARD BANK", "dates": ["10/17/2026", "07/16/2026", "04/17/2026"], "loc": "PO BOX 0008 OGDEN, UT 84499", "phone": "(801) 555-0200"},
        {"name": "JORDAN SAMPLE via EXAMPLE MONITORING", "dates": ["10/20/2026"], "loc": "100 SAMPLE ST FRESNO, CA 93799",
         "phone": "(805) 555-0241", "purpose": "CONSUMER REQUEST"},
    ],
}

# What the tests must find in tu_planted.pdf: (rule, subject substring)
PLANTED = [
    ("paid_then_late", "EXAMPLE SECURED CARD"),
    ("max_delinquency_mismatch", "SAMPLE AUTO FINANCE"),
    ("skipped_step", "EXAMPLE STATE CHILD SUPPORT OFFICE"),
    ("zero_terms_amounts_due", "PAYLATER EXAMPLE INC PLA1"),
    ("zero_terms_amounts_due", "PAYLATER EXAMPLE INC PLB2"),
    ("name_variant", "JORDAN Q. SAMPEL"),
    ("name_variant", "JORDAN R. SAMPLE"),
    ("name_variant", "JORDON SAMPLE"),
    ("address_malformed", "100 EXAMPLE AVE APT 100EXA"),
    ("address_variants", "22 ..."),
    ("address_variants", "100 ..."),
    ("phone_invalid", "(123) 555-0101"),
    ("collector_reported_early", "EXAMPLE DEBT BUYERS LLC"),
    ("collector_reported_early", "SAMPLE ASSET RECOVERY"),
    ("collector_reported_early", "TEST RECEIVABLES LLC"),
    ("obsolete", "OLD EXAMPLE RETAIL"),
    ("reaged", "MIDTOWN EXAMPLE CARD"),
    ("reaged", "TEST RECEIVABLES LLC"),
    ("duplicate_debt", "NORTHWIND EXAMPLE BANK"),
    ("sold_with_balance", "NORTHWIND EXAMPLE BANK"),
    ("inquiry_no_account", "EXAMPLE LENDING CO"),
    ("inquiry_no_account", "SAMPLE AUTO GROUP"),
]
CLEAN_ACCOUNTS = ["PROGRESSION EXAMPLE CARD", "EXAMPLE CARD BANK", "SAMPLE MORTGAGE CO", "EXAMPLE CREDIT UNION"]


# ---------------------------------------------------------------- layout writer
class Writer:
    def __init__(self, path, title):
        from reportlab.pdfgen import canvas
        self.path = path
        self.title = title
        self.canvas = canvas
        self.ops = []

    def reset(self, total):
        self.c = self.canvas.Canvas(str(self.path), pagesize=(PAGE_W, PAGE_H), invariant=1)
        self.c.setTitle(self.title)
        self.c.setAuthor("Synthetic test data")
        self.c.setSubject("Invented people and accounts for parser tests")
        self.page = 1
        self.total = total
        self.y = 50.0

    def text(self, x, s, size=7, bold=False):
        self.c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        self.c.drawString(x, PAGE_H - self.y, s)

    def need(self, h):
        if self.y + h > PAGE_H - 40:
            self.footer()
            self.c.showPage()
            self.page += 1
            self.y = 40.0

    def footer(self):
        self.c.setFont("Helvetica", 7)
        self.c.drawString(PAGE_W - 60, 25, f"{self.page} / {self.total}")

    def line(self, parts, size=7, step=8.0, bold=False):
        self.need(step)
        for x, s in parts:
            self.text(x, s, size, bold)
        self.y += step

    def gap(self, h):
        self.y += h

    def heading(self, s, size=11):
        self.need(24)
        self.gap(6)
        self.line([(20, s)], size=size, step=16, bold=True)

    def finish(self):
        self.footer()
        self.c.save()
        return self.page


def wrap(s, width_chars):
    words, out, cur = s.split(" "), [], ""
    for w in words:
        if cur and len(cur) + 1 + len(w) > width_chars:
            out.append(cur)
            cur = w
        else:
            cur = (cur + " " + w).strip()
    if cur:
        out.append(cur)
    return out or [""]


def card(w, a):
    w.need(60)
    w.gap(6)
    w.line([(20, "Account Name"), (358, "Account Number")])
    w.line([(20, a["name"]), (358, a["number"])])
    for row in a["rows"]:
        w.line([(COLS3[i], lab) for i, (lab, _) in enumerate(row)])
        wrapped = [wrap(v, 44) for _, v in row]
        for k in range(max(len(x) for x in wrapped)):
            w.line([(COLS3[i], x[k]) for i, x in enumerate(wrapped) if k < len(x)])
    if a.get("grid"):
        w.line([(16, "Payment History")], size=8, step=10)
        cells = a["grid"]
        for start in range(0, len(cells), 6):
            row = cells[start:start + 6]
            w.need(60)
            w.line([(GRID[i], MON[int(c["month"][5:7]) - 1] + " " + c["month"][:4]) for i, c in enumerate(row)], step=6)
            for key, lab in (("bal", "Bal"), ("high", "High"), ("past_due", "Past Due"), ("paid", "Paid"), ("due", "Due")):
                vals = [(GRID[i], f"{lab}: ${c[key]:,}") for i, c in enumerate(row) if key in c]
                if vals:
                    w.line(vals, step=6)
            rem = [(GRID[i], ">" + c["remark"] + "<") for i, c in enumerate(row) if c.get("remark")]
            if rem:
                w.line(rem, step=6)
            w.line([(GRID[i] + 2, c["rating"]) for i, c in enumerate(row)], step=11)


def collection_card(w, c):
    a = {"name": c["name"], "number": c["number"], "rows": [
        [("Address", c["addr"]), ("Phone", c["phone"]), ("Monthly Payment", "---")],
        [("Date Opened", c["opened"]), ("Responsibility", "Individual Account"), ("Account Type", "Open Account")],
        [("Loan Type", c["type"]), ("Balance", c["bal"]), ("Date Updated", c["updated"])],
        [("High Balance", c["high"]), ("Original Creditor", c["oc"]), ("Past Due", c["bal"])],
        [("Pay Status", ">Collection<"), ("Estimated month and year this item will be removed", c["removal"]), ("Remarks", ">PLACED FOR COLLECTION<")],
    ]}
    card(w, a)


def inquiries(w, kind, rows):
    w.line([(20, "Name"), (358, "Requested On")])
    w.gap(3)
    for q in rows:
        w.need(40)
        w.line([(20, q["name"]), (358, q["dates"][0])])
        for d in q["dates"][1:]:
            w.line([(358, d)])
        labels = [(20, "Location"), (206, "Phone")]
        vals = [(20, q["loc"]), (206, q["phone"])]
        if kind == "hard":
            labels.append((358, "Inquiry Type"))
            vals.append((358, q["type"]))
        elif q.get("purpose"):
            labels.append((358, "Permissible Purpose"))
            vals.append((358, q["purpose"]))
        w.line(labels)
        w.line(vals)
        if kind == "hard" and q.get("purpose"):
            w.line([(20, "Permissible Purpose")])
            w.line([(20, q["purpose"])])


def specialty(w):
    w.heading("Checking Account and Demand Deposit Account (DDA) Activity", 9)
    w.line([(20, "Data Source:")])
    w.line([(20, "Example Check Screening Inc. (1 Sample Road, Testville, MN 55000, (800) 555-0250)")])
    pairs = [("Requested by:", "EXAMPLE MONITORING"), ("Requested on:", "08/12/2026"), ("Number of Accounts Consumer is Identified On:", "0"),
             ("Paid Checks in the Last 3 Years:", "0"), ("DDA Closures in Last 180 Days:", "0"), ("Average Checks Ordered in the Last 3 Years:", ".00000")]
    for k in range(0, len(pairs), 3):
        row = pairs[k:k + 3]
        w.line([(COLS3[i], p[0]) for i, p in enumerate(row)])
        w.line([(COLS3[i], p[1]) for i, p in enumerate(row)])
    w.heading("Supplemental Consumer Credit Information", 9)
    w.line([(20, "Data Source:")])
    w.line([(20, "Example Alternative Data (PO Box 0012, Atlanta, GA 30399, (877) 555-0251)")])
    pairs = [("Requested by:", "EXAMPLE CARD BANK"), ("Requested on:", "03/15/2024"), ("Auto Finance Inquiries in the Last 3 Months:", "0")]
    w.line([(COLS3[i], p[0]) for i, p in enumerate(pairs)])
    w.line([(COLS3[i], p[1]) for i, p in enumerate(pairs)])


def render(w, person, adverse, collections, satisfactory, inq, total):
    w.reset(total)
    w.line([(14, "SYNTHETIC TEST REPORT. EVERY PERSON AND ACCOUNT IN IT IS INVENTED.")], size=6, step=12)
    w.line([(14, "Your TransUnion Credit Report")], size=14, step=18, bold=True)
    w.line([(21, "Personal Credit Report for:")], step=10)
    w.line([(21, person["report_for"])], step=16)
    w.line([(21, "File Number:")], step=10)
    w.line([(21, person["file_number"])], step=16)
    w.line([(21, "Date Created:")], step=10)
    w.line([(21, person["date_created"])], step=20)
    w.line([(14, "Visit the bureau's website to start a dispute online.")], step=14)
    w.heading("Personal Information")
    w.line([(14, f"You have been on our files since {person['on_file']}. Your SSN has been masked for your protection.")], step=14)
    for k, v in (("Credit Report Date", person["on_file"]), ("Social Security Number", person["ssn"]), ("Date of Birth", person["dob"]),
                 ("Name", person["name"])):
        w.line([(19, k), (217, v)], step=15)
    w.heading("Also Known As", 9)
    for n in person["aka"]:
        w.line([(19, "AKA"), (217, n)], step=15)
    w.heading("Addresses", 9)
    for k, a, d in person["addresses"]:
        w.line([(19, k), (217, a)], step=15)
        w.line([(19, "Date Reported"), (217, d)], step=15)
    w.heading("Phone Numbers", 9)
    for p in person["phones"]:
        w.line([(19, "Phone Number"), (217, p)], step=15)
    w.heading("Employers", 9)
    w.line([(19, "Employer"), (300, "Occupation")], step=12)
    for name, occ, loc, ver in person["employers"]:
        w.line([(19, name), (300, occ or "---")], step=8)
        if loc:
            w.line([(19, "Location"), (206, "Date Verified")], step=8)
            w.line([(19, loc), (206, ver)], step=10)
        else:
            w.line([(19, "Date Verified")], step=8)
            w.line([(19, ver)], step=10)
    w.heading("Accounts")
    w.line([(14, "Creditors report changes monthly. Pay Status shows how you are paying now.")], step=10)
    w.line([(14, "Payment/Remarks Key")], step=10)
    w.line([(14, "OK"), (60, "Current, paying or paid as agreed"), (300, "N/R"), (340, "Not Reported")], step=8)
    w.line([(14, "30"), (60, "Account 30 days late"), (300, "C/O"), (340, "Charged off by account provider")], step=8)
    w.heading("Accounts with Adverse Information")
    w.line([(14, "Adverse information typically remains on your credit file for up to 7 years from the date of the delinquency.")], step=10)
    for a in adverse:
        card(w, a)
    for c in collections:
        collection_card(w, c)
    w.heading("Satisfactory Accounts")
    for a in satisfactory:
        card(w, a)
    w.heading("Inquiries")
    for kind, title in (("hard", "Regular Inquiries"), ("promotional", "Promotional Inquiries"), ("review", "Account Review Inquiries")):
        if inq.get(kind):
            w.heading(title, 9)
            w.line([(14, "The companies listed below received your credit information on the dates specified.")], step=10)
            inquiries(w, kind, inq[kind])
    w.heading("Credit Report Messages")
    w.line([(14, "Your credit report contains the following messages")], step=10)
    w.line([(14, "Promotional opt-out")], step=10)
    w.heading("Additional Information")
    w.line([(14, "The following disclosure of information might pertain to you.")], step=10)
    specialty(w)
    w.heading("Should you wish to contact TransUnion, you may do so", 9)
    w.line([(14, "By Mail:")], step=8)
    w.line([(14, "TransUnion Consumer Relations")], step=8)
    w.line([(14, "P.O. Box 2000")], step=8)
    w.line([(14, "Chester, PA 19016-2000")], step=12)
    w.heading("SUMMARY OF RIGHTS", 9)
    for k in range(6):
        w.line([(14, "A Summary of Your Rights Under the Fair Credit Reporting Act. You have the right to dispute incomplete or inaccurate information.")], step=9)
    return w.finish()


def write(path, *parts, title="Synthetic TransUnion-layout report"):
    w = Writer(path, title)
    n = render(w, *parts, total=99)
    render(w, *parts, total=n)


CLEAN_PERSON = dict(PERSON, aka=["JORDAN SAMPLE", "JORDAN Q SAMPLE"], file_number="900000002",
                    addresses=[("Current Address", "100 EXAMPLE AVE ANYTOWN, TX 75001-1234", "08/01/2025"),
                               ("Other Address", "4 PLACEHOLDER CT FICTION CITY, TX 75002-4444", "03/14/2008")],
                    phones=["(512) 555-0134", "(214) 555-0199"])
CLEAN_INQ = {"hard": [INQUIRIES["hard"][2]], "promotional": INQUIRIES["promotional"], "review": INQUIRIES["review"]}

# Round 2: what the next report looks like after round 1 (two collections deleted, the secured card
# corrected, a new inquiry).
ROUND2_PERSON = dict(PERSON, file_number="900000003", date_created="12/01/2026",
                     aka=["JORDAN SAMPLE", "JORDAN R. SAMPLE"],
                     addresses=[PERSON["addresses"][0], PERSON["addresses"][2], PERSON["addresses"][4]],
                     phones=["(512) 555-0134", "(214) 555-0199"])


def round2_adverse():
    out = []
    for a in ACCOUNTS_ADVERSE:
        if a["name"] == "EXAMPLE SECURED CARD":
            b = dict(a, grid=grid("2023-10", ok(13)))
            b["rows"] = [row if row[0][0] != "Date Closed" else [("Date Closed", "09/27/2024"), ("Date Paid", "03/15/2024"), ("Remarks", "CLOSED BY CREDIT GRANTOR; CLOSED")]
                         for row in a["rows"] if row[0][0] != "Remarks"]
            out.append(b)
        elif a["name"] != "OLD EXAMPLE RETAIL":
            out.append(a)
    return out


ROUND2_INQ = {"hard": INQUIRIES["hard"] + [{"name": "NEW EXAMPLE AUTO LENDER", "dates": ["11/20/2026"], "loc": "1 SAMPLE WAY DALLAS, TX 75201",
                                            "phone": "(214) 555-0260", "type": "Individual"}],
              "promotional": INQUIRIES["promotional"], "review": INQUIRIES["review"]}


def main():
    write(HERE / "tu_planted.pdf", PERSON, ACCOUNTS_ADVERSE, COLLECTIONS, ACCOUNTS_SATISFACTORY, INQUIRIES)
    write(HERE / "tu_clean.pdf", CLEAN_PERSON, [], [], ACCOUNTS_SATISFACTORY, CLEAN_INQ)
    write(HERE / "tu_round2.pdf", ROUND2_PERSON, round2_adverse(), [COLLECTIONS[2]], ACCOUNTS_SATISFACTORY, ROUND2_INQ)
    print("wrote", ", ".join(p.name for p in sorted(HERE.glob("tu_*.pdf"))))


if __name__ == "__main__":
    main()

"""Write the synthetic saved-page reports: tu_saved.html (label and value table rows) and
ex_saved.html (definition lists). Every person, address, company and number is invented; no real
report of any bureau was copied. Each page carries planted errors (PLANTED_HTML) and the things a
saved page also holds that must be ignored: scripts, styles, a frame and an image from elsewhere.
Run: python tests/fixtures/make_html_fixtures.py
"""

from pathlib import Path

HERE = Path(__file__).resolve().parent
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

# (rule, subject fragment) found on each page with no profile
PLANTED_HTML = {
    "transunion": [("paid_then_late", "EXAMPLE SECURED CARD"), ("skipped_step", "EXAMPLE SECURED CARD"), ("collection_missing_oc", "SAMPLE ASSET RECOVERY"),
                   ("phone_invalid", "(123) 555-0101"), ("name_variant", "JORDAN Q. SAMPEL"), ("inquiry_no_account", "EXAMPLE LENDING")],
    "experian": [("paid_then_late", "EXAMPLE SECURED CARD"), ("skipped_step", "EXAMPLE SECURED CARD"), ("phone_invalid", "(123) 555-0101")],
}

# head noise, then body noise (a saved page is serialized by the browser, so it is well formed)
NOISE = """<script>var bureau = "Equifax Experian TransUnion"; document.title = "x";</script>
<style>.Experian { color: red } /* TransUnion */</style>
"""
BODY_NOISE = """<noscript><p>Equifax</p></noscript>
<iframe src="https://example.invalid/frame"></iframe>
<img src="https://example.invalid/pixel.gif" alt="">
<template><p>Equifax template</p></template>
"""


def grid(rows):
    head = "<tr><th>Year</th>" + "".join(f"<th>{m}</th>" for m in MONTHS) + "</tr>"
    body = "".join("<tr><td>" + y + "</td>" + "".join(f"<td>{c}</td>" for c in codes) + "</tr>" for y, codes in rows)
    return f"<table class=\"history\">{head}{body}</table>"


def fields_table(pairs):
    return "<table>" + "".join(f"<tr><th>{k}</th><td>{v}</td></tr>" for k, v in pairs) + "</table>"


def fields_dl(pairs):
    return "<dl>" + "".join(f"<dt>{k}</dt><dd>{v}</dd>" for k, v in pairs) + "</dl>"


def tu_page():
    ok = ["OK"] * 12
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>TransUnion Credit Report</title>
{NOISE}</head>
<body>
{BODY_NOISE}<header><h1>TransUnion Credit Report</h1><p>Synthetic test data. Every name, address and number here is invented.</p>
<p>Report date: 10/15/2026</p><p>File number: 900000777</p></header>
<section><h2>Personal Information</h2>
{fields_table([("Name", "JORDAN SAMPLE"), ("Also Known As", "JORDAN Q. SAMPEL"), ("Current Address", "100 EXAMPLE AVE ANYTOWN, TX 75001"),
               ("Date of Birth", "01/01/1980"), ("Social Security Number", "XXX-XX-0000"), ("Telephone Numbers", "(512) 555-0134; (123) 555-0101"),
               ("Employer", "EXAMPLE FREIGHT CO")])}
</section>
<section><h2>Adverse Accounts</h2>
<h3>EXAMPLE SECURED CARD</h3>
{fields_table([("Account Number", "4000111122****"), ("Account Type", "Revolving Account"), ("Loan Type", "Credit Card"),
               ("Date Opened", "03/15/2019"), ("Balance", "$0"), ("Credit Limit", "$500"), ("Pay Status", "Paid, Closed"),
               ("Date Paid", "03/15/2024"), ("Date Closed", "03/15/2024"), ("Date Updated", "09/30/2026"), ("Terms", "Monthly")])}
{grid([("2024", ["OK", "OK", "OK", "OK", "OK", "OK", "60", "OK", "OK", "OK", "OK", "OK"]), ("2025", ok)])}
<h3>SAMPLE AUTO FINANCE</h3>
{fields_table([("Account Number", "7700****"), ("Account Type", "Installment Account"), ("Loan Type", "Auto Loan"),
               ("Date Opened", "02/10/2021"), ("Balance", "$9,850"), ("High Balance", "$22,000"), ("Pay Status", "Current"),
               ("Date Updated", "09/28/2026"), ("Terms", "$410 / 72 Months")])}
{grid([("2025", ok), ("2026", ["OK"] * 9 + ["", "", ""])])}
</section>
<section><h2>Collections</h2>
<h3>SAMPLE ASSET RECOVERY</h3>
{fields_table([("Account Number", "8802****"), ("Account Type", "Open Account"), ("Loan Type", "Collection"),
               ("Date Opened", "06/01/2023"), ("Balance", "$612"), ("Original Amount", "$612"), ("Pay Status", "Collection Account"),
               ("Estimated month and year this item will be removed", "05/2029"), ("Date Updated", "09/01/2026")])}
</section>
<section><h2>Regular Inquiries</h2>
<table><tr><td>EXAMPLE LENDING</td><td>02/04/2026</td></tr></table>
</section>
<footer><h2>Contact Information</h2><p>TransUnion, an invented address for this test.</p></footer>
</body></html>
"""


def ex_page():
    ok = ["OK"] * 12
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Experian report</title>
{NOISE}</head>
<body>
{BODY_NOISE}<div class="top"><h1>Experian</h1><div>Synthetic test data. Every name, address and number here is invented.</div>
<div>Report date: 10/16/2026</div><div>Report number: 0000-1111-22</div></div>
<div><h2>Personal Information</h2>
{fields_dl([("Name", "JORDAN SAMPLE"), ("Address", "100 EXAMPLE AVE ANYTOWN, TX 75001"), ("Year of birth", "1980"),
            ("Phone numbers", "(512) 555-0134; (123) 555-0101")])}
</div>
<div><h2>Accounts</h2>
<h3>EXAMPLE SECURED CARD</h3>
{fields_dl([("Account number", "4000111122****"), ("Account type", "Credit card"), ("Date opened", "03/15/2019"),
            ("Status", "Paid, Closed"), ("Date paid", "03/15/2024"), ("Balance", "$0"), ("Credit limit", "$500"), ("Terms", "120 Months")])}
{grid([("2024", ["OK", "OK", "OK", "OK", "OK", "OK", "60", "OK", "OK", "OK", "OK", "OK"]), ("2025", ok)])}
</div>
<div><h2>Contact us</h2><p>Experian, an invented address for this test.</p></div>
</body></html>
"""


def main():
    (HERE / "tu_saved.html").write_text(tu_page(), encoding="utf-8")
    (HERE / "ex_saved.html").write_text(ex_page(), encoding="utf-8")
    print("wrote tu_saved.html and ex_saved.html")


if __name__ == "__main__":
    main()

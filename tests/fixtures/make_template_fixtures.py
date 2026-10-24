"""Synthetic Experian-style and Equifax-style reports for the template reader (errata.generic).

These follow the general shape the bureaus describe for their consumer reports (sections of labeled
fields and a monthly payment history), drawn with reportlab. They are not copies of any real
report: every person, company, number and date is invented, and no real Experian or Equifax report
was used. Each carries planted errors (PLANTED_EX, PLANTED_EQ) and clean accounts.

Run: python tests/fixtures/make_template_fixtures.py
"""

from pathlib import Path

from make_fixtures import Writer

HERE = Path(__file__).resolve().parent
MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()

PLANTED_EX = [
    ("name_variant", "JORDAN Q SAMPEL"),
    ("paid_then_late", "SAMPLE FINANCE CO"),
    ("collection_missing_oc", "EXAMPLE RECOVERY GROUP"),
    ("obsolete", "OLD SAMPLE COLLECTIONS"),
    ("inquiry_no_account", "EXAMPLE LENDING CO"),
]
CLEAN_EX = ["EXAMPLE CARD SERVICES", "SAMPLE AUTO LOAN"]
PLANTED_EQ = [
    ("phone_invalid", "(123) 555-0101"),
    ("status_vs_past_due", "MIDTOWN SAMPLE BANK"),
    ("skipped_step", "SAMPLE STUDENT SERVICES"),
    ("medical_policy", "EXAMPLE ASSET PARTNERS"),
]
CLEAN_EQ = ["EXAMPLE CREDIT UNION"]


def pairs(w, rows, x1=20, x2=130, x3=300, x4=410):
    """Experian style: two label and value pairs per line."""
    for i in range(0, len(rows), 2):
        parts = [(x1, rows[i][0]), (x2, rows[i][1])]
        if i + 1 < len(rows):
            parts += [(x3, rows[i + 1][0]), (x4, rows[i + 1][1])]
        w.line(parts, size=8, step=11)


def history(w, years):
    w.line([(20, "Payment History")], size=8, step=11, bold=True)
    w.line([(20, "Year")] + [(70 + 32 * i, m) for i, m in enumerate(MONTHS)], size=7, step=10)
    for y, codes in years:
        w.line([(20, y)] + [(70 + 32 * i, c) for i, c in enumerate(codes) if c], size=7, step=10)


def ex_render(w, total):
    w.reset(total)
    w.line([(20, "Experian Credit Report")], size=14, step=20, bold=True)
    w.line([(20, "Prepared for JORDAN Q SAMPLE")], size=9, step=12)
    w.line([(20, "Report date: 10/20/2026"), (300, "Report number: EXS-0001-TEST")], size=9, step=14)
    w.heading("Personal Information")
    w.line([(20, "Name"), (130, "JORDAN Q SAMPLE")], size=8, step=11)
    w.line([(20, "Also known as"), (130, "JORDAN SAMPLE; JORDAN Q SAMPEL")], size=8, step=11)
    w.line([(20, "Current address"), (130, "100 EXAMPLE AVE ANYTOWN, TX 75001 Reported 08/01/2025")], size=8, step=11)
    w.line([(20, "Previous address"), (130, "4 PLACEHOLDER CT FICTION CITY, TX 75002 Reported 03/14/2008")], size=8, step=11)
    w.line([(20, "Year of birth"), (130, "1980")], size=8, step=11)
    w.line([(20, "Phone number"), (130, "(512) 555-0134")], size=8, step=11)
    w.line([(20, "Employer"), (130, "EXAMPLE FREIGHT CO")], size=8, step=11)
    w.heading("Accounts")
    w.gap(4)
    w.line([(20, "SAMPLE FINANCE CO")], size=10, step=14, bold=True)
    pairs(w, [("Account number", "5530XXXX"), ("Account type", "Installment"), ("Date opened", "01/10/2021"), ("Status", "Paid, Closed"),
              ("Date paid", "03/15/2024"), ("Date closed", "03/15/2024"), ("Balance", "$0"), ("Original amount", "$6,000"),
              ("Responsibility", "Individual"), ("Status updated", "08/2024"), ("Address", "PO BOX 10 ANYTOWN, TX 75001")])
    history(w, [("2024", ["OK", "OK", "OK", "", "", "30", "60", "", "", "", "", ""]), ("2023", ["OK"] * 12)])
    w.gap(6)
    w.line([(20, "EXAMPLE CARD SERVICES")], size=10, step=14, bold=True)
    pairs(w, [("Account number", "4417XXXXXXXX"), ("Account type", "Credit card"), ("Date opened", "06/12/2019"), ("Status", "Open, Current"),
              ("Balance", "$1,225"), ("Credit limit", "$5,000"), ("Highest balance", "$2,000"), ("Monthly payment", "$35"),
              ("Responsibility", "Individual"), ("Balance updated", "10/01/2026")])
    history(w, [("2026", ["OK"] * 9 + ["", "", ""]), ("2025", ["OK"] * 12)])
    w.gap(6)
    w.line([(20, "SAMPLE AUTO LOAN")], size=10, step=14, bold=True)
    pairs(w, [("Account number", "7310XXXX"), ("Account type", "Auto loan"), ("Date opened", "11/06/2025"), ("Status", "Open, Current"),
              ("Balance", "$8,400"), ("Original amount", "$21,000"), ("Monthly payment", "$412"), ("Terms", "60 Months"),
              ("Responsibility", "Individual"), ("Balance updated", "10/01/2026")])
    history(w, [("2026", ["OK"] * 9 + ["", "", ""])])
    w.heading("Collection Accounts")
    w.line([(20, "EXAMPLE RECOVERY GROUP")], size=10, step=14, bold=True)
    pairs(w, [("Account number", "8801XXXX"), ("Account type", "Collection"), ("Date opened", "05/02/2021"), ("Status", "Collection account"),
              ("Balance", "$640"), ("Original amount", "$640"), ("Past due", "$640"), ("Date of first delinquency", "11/2020"),
              ("On record until", "05/2027"), ("Status updated", "09/2026")])
    w.gap(6)
    w.line([(20, "OLD SAMPLE COLLECTIONS")], size=10, step=14, bold=True)
    pairs(w, [("Account number", "8802XXXX"), ("Account type", "Collection"), ("Original creditor", "EXAMPLE TELECOM"), ("Date opened", "02/01/2019"),
              ("Status", "Collection account"), ("Balance", "$410"), ("Original amount", "$410"), ("Past due", "$410"),
              ("Date of first delinquency", "06/2018"), ("On record until", "12/2025")])
    w.heading("Hard Inquiries")
    w.line([(20, "EXAMPLE LENDING CO"), (300, "05/18/2026")], size=8, step=11)
    w.line([(20, "SAMPLE AUTO LOAN"), (300, "11/04/2025")], size=8, step=11)
    w.heading("Soft Inquiries")
    w.line([(20, "EXAMPLE CARD SERVICES"), (300, "07/16/2026")], size=8, step=11)
    w.heading("Contact Us")
    w.line([(20, "Synthetic test data. Invented people and accounts for parser tests.")], size=8, step=11)
    return w.finish()


def labels_then_values(w, rows):
    """Equifax style: a row of labels with the values on the line below, column by column."""
    xs = [20, 150, 290, 420]
    for i in range(0, len(rows), 4):
        chunk = rows[i:i + 4]
        w.line([(xs[k], lab) for k, (lab, _) in enumerate(chunk)], size=7, step=9)
        w.line([(xs[k], val) for k, (_, val) in enumerate(chunk)], size=8, step=12)


def eq_render(w, total):
    w.reset(total)
    w.line([(20, "Equifax Credit Report")], size=14, step=20, bold=True)
    w.line([(20, "Report Date: 10/20/2026"), (300, "Confirmation Number: EQS-0002-TEST")], size=9, step=14)
    w.heading("Personal Information")
    w.line([(20, "Name"), (150, "JORDAN QUINN SAMPLE")], size=8, step=11)
    w.line([(20, "Also known as"), (150, "JORDAN SAMPLE")], size=8, step=11)
    w.line([(20, "Current address"), (150, "100 EXAMPLE AVE ANYTOWN, TX 75001 Reported 08/01/2025")], size=8, step=11)
    w.line([(20, "Date of birth"), (150, "01/01/1980")], size=8, step=11)
    w.line([(20, "Phone"), (150, "(512) 555-0134; (123) 555-0101")], size=8, step=11)
    w.heading("Revolving Accounts")
    w.line([(20, "MIDTOWN SAMPLE BANK")], size=10, step=14, bold=True)
    labels_then_values(w, [("Account Number", "XXXX2310"), ("Owner", "Individual"), ("Loan/Account Type", "Credit Card"), ("Status", "Current"),
                           ("Date Opened", "04/01/2018"), ("Date Reported", "10/01/2026"), ("Credit Limit", "$3,000"), ("High Credit", "$2,310"),
                           ("Balance", "$1,140"), ("Amount Past Due", "$250"), ("Date of Last Payment", "09/02/2026")])
    w.line([(20, "Payment history")], size=7, step=9)
    w.line([(20, "Year")] + [(70 + 32 * i, m) for i, m in enumerate(MONTHS)], size=7, step=10)
    w.line([(20, "2026")] + [(70 + 32 * i, c) for i, c in enumerate(["OK"] * 9)], size=7, step=10)
    w.heading("Installment Accounts")
    w.line([(20, "SAMPLE STUDENT SERVICES")], size=10, step=14, bold=True)
    labels_then_values(w, [("Account Number", "XXXX7781"), ("Owner", "Individual"), ("Loan/Account Type", "Student Loan"), ("Status", "60 Days Past Due"),
                           ("Date Opened", "08/20/2017"), ("Date Reported", "10/01/2026"), ("High Credit", "$18,500"), ("Balance", "$12,000"),
                           ("Amount Past Due", "$370"), ("Terms Duration", "120 Months")])
    w.line([(20, "Year")] + [(70 + 32 * i, m) for i, m in enumerate(MONTHS)], size=7, step=10)
    w.line([(20, "2026")] + [(70 + 32 * i, c) for i, c in enumerate(["OK", "OK", "OK", "OK", "OK", "OK", "OK", "OK", "60"])], size=7, step=10)
    w.line([(20, "2025")] + [(70 + 32 * i, c) for i, c in enumerate(["OK"] * 12)], size=7, step=10)
    w.gap(6)
    w.line([(20, "EXAMPLE CREDIT UNION")], size=10, step=14, bold=True)
    labels_then_values(w, [("Account Number", "XXXX0042"), ("Owner", "Joint"), ("Loan/Account Type", "Auto Loan"), ("Status", "Current"),
                           ("Date Opened", "02/10/2025"), ("Date Reported", "10/01/2026"), ("High Credit", "$24,000"), ("Balance", "$11,800"),
                           ("Amount Past Due", "$0"), ("Terms Duration", "72 Months")])
    w.line([(20, "Year")] + [(70 + 32 * i, m) for i, m in enumerate(MONTHS)], size=7, step=10)
    w.line([(20, "2026")] + [(70 + 32 * i, c) for i, c in enumerate(["OK"] * 9)], size=7, step=10)
    w.heading("Collections")
    w.line([(20, "EXAMPLE ASSET PARTNERS")], size=10, step=14, bold=True)
    labels_then_values(w, [("Account Number", "XXXX4471"), ("Original Creditor", "SAMPLE MEDICAL CENTER"), ("Status", "Collection"), ("Date Opened", "02/10/2023"),
                           ("Date Reported", "09/16/2026"), ("Balance", "$320"), ("High Credit", "$320"), ("Date of First Delinquency", "08/2022")])
    w.heading("Hard Inquiries")
    w.line([(20, "EXAMPLE CREDIT UNION"), (300, "02/10/2025")], size=8, step=11)
    w.heading("Dispute File Information")
    w.line([(20, "Synthetic test data. Invented people and accounts for parser tests.")], size=8, step=11)
    return w.finish()


def write(path, render, title):
    w = Writer(path, title)
    n = render(w, 99)
    render(w, n)


def main():
    write(HERE / "ex_planted.pdf", ex_render, "Synthetic Experian-style report")
    write(HERE / "eq_planted.pdf", eq_render, "Synthetic Equifax-style report")
    print("wrote ex_planted.pdf, eq_planted.pdf")


if __name__ == "__main__":
    main()

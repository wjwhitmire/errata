"""The normalized report model shared by every parser, the findings engine, the planner and the
browser. Plain dicts and lists (JSON), money in integer cents, dates as ISO strings, months as
'YYYY-MM'. Twin: web/src/core/03_model.js.
"""

import re

from .util import norm_name, norm_space, parse_money, stable_hash

REPORT_FORMAT = "errata-report"
REPORT_VERSION = 1
BUREAUS = ("transunion", "experian", "equifax")
BUREAU_NAMES = {"transunion": "TransUnion", "experian": "Experian", "equifax": "Equifax", "unknown": "Unknown bureau"}

# Payment ratings as the reports print them, with their delinquency level in days (0 current).
RATING_DAYS = {"OK": 0, "C": 0, "0": 0, "30": 30, "60": 60, "90": 90, "120": 120, "150": 150, "180": 180,
               "C/O": 180, "CO": 180, "COL": 180, "VS": 180, "RPO": 180, "FC": 180, "BK": None, "X": None,
               "N/R": None, "NR": None, "ND": None, "-": None, "": None}
RATINGS = set(RATING_DAYS)
LATE_STEPS = (30, 60, 90, 120, 150, 180)
DEROG_RATINGS = {"C/O", "CO", "COL", "VS", "RPO", "FC"}


def rating_days(r):
    return RATING_DAYS.get(str(r or "").upper())


def is_late(r):
    d = rating_days(r)
    return d is not None and d >= 30


def new_report(bureau="unknown"):
    return {
        "format": REPORT_FORMAT, "version": REPORT_VERSION, "bureau": bureau,
        "source": {"kind": "manual", "parser": "", "file_number": "", "report_date": "", "confidence": 0, "pages": 0},
        "personal": {"names": [], "ssn_masked": "", "ssn_last4": "", "dob": "", "on_file_since": "",
                     "addresses": [], "phones": [], "employers": []},
        "accounts": [], "public_records": [], "inquiries": [], "statements": [], "messages": [], "specialty": [],
        "warnings": [],
    }


def new_account():
    return {
        "id": "", "name": "", "number": "", "address": "", "phone": "", "monthly_payment": None,
        "opened": "", "responsibility": "", "account_type": "", "loan_type": "", "balance": None, "updated": "",
        "payment_received": None, "last_payment": "", "original_creditor": "", "pay_status": "",
        "pay_status_adverse": False, "terms": {"text": "", "amount": None, "months": None, "frequency": ""},
        "closed": "", "paid": "", "high_balance": None, "high_balance_hist": "", "credit_limit": None,
        "credit_limit_hist": "", "max_delinquency": {"text": "", "days": None, "entries": []}, "removal": "",
        "remarks": [], "past_due": None, "dofd": "", "history": [], "section": "", "kind": "", "flags": [],
        "confidence": 0, "raw": {},
    }


# ---------------------------------------------------------------- classification
COLLECTION_TYPES = re.compile(r"FACTORING|COLLECTION|DEBT BUYER|DEBT PURCHASER|RECOVERY", re.I)
COLLECTION_STATUS = re.compile(r"COLLECTION|PLACED FOR COLLECTION|\bCOL\b", re.I)
CHARGEOFF = re.compile(r"CHARGE.?OFF|CHARGED OFF|\bC/O\b|PROFIT AND LOSS|\bPRL\b", re.I)
PAID_STATUS = re.compile(r"\bPAID\b", re.I)
PAID_AS_AGREED = re.compile(r"PAID AS AGREED|PAYING AS AGREED|NEVER LATE", re.I)
TRANSFERRED = re.compile(r"TRANSFER|SOLD|PURCHASED BY ANOTHER|\bTRL\b|\bTTR\b|\bPAL\b|\bACT\b", re.I)
BANKRUPTCY = re.compile(r"BANKRUPTCY|\bBKL\b|CHAPTER (7|11|12|13)", re.I)
DISPUTED = re.compile(r"DISPUTE|\bAID\b|\bXB\b", re.I)
MEDICAL = re.compile(r"MEDICAL|HOSPITAL|HEALTH|CLINIC|PHYSICIAN|ANESTHES|RADIOLOG|AMBULANCE|EMERGENCY ROOM|PATHOLOG|"
                     r"DENTAL|ORTHOPED|PEDIATRIC|SURGERY|SURGICAL|URGENT CARE|LABORATOR", re.I)
STUDENT = re.compile(r"STUDENT|EDUCATION|DEPT OF ED|DEPARTMENT OF ED|NELNET|MOHELA|AIDVANTAGE|EDFINANCIAL|NAVIENT", re.I)
CHILD_SUPPORT = re.compile(r"CHILD SUPPORT|SUPPORT ENFORCEMENT|FAMILY SUPPORT", re.I)
GOVERNMENT = re.compile(r"ATTORNEY GENERAL|DEPARTMENT OF|DEPT OF|STATE OF|\bCOUNTY\b|CITY OF|\bU\.S\.|UNITED STATES|\bUS DEPT|TREASURY|"
                        r"CHILD SUPPORT|SUPPORT ENFORCEMENT|INTERNAL REVENUE", re.I)
BNPL = re.compile(r"AFFIRM|PAY ?LATER|PAY IN [0-9]|KLARNA|AFTERPAY|SEZZLE|ZIP CO|QUADPAY|PAYPAL PAY IN|SPLITIT", re.I)


def classify(a):
    """Kind (revolving, installment, mortgage, open, collection, other) and flags for an account."""
    t = " ".join([a.get("account_type", ""), a.get("loan_type", "")]).upper()
    st = " ".join([a.get("pay_status", "")] + a.get("remarks", [])).upper()
    hist = [h.get("rating", "") for h in a.get("history", [])]
    if COLLECTION_TYPES.search(a.get("loan_type", "")) or COLLECTION_STATUS.search(a.get("pay_status", "")):
        kind = "collection"
    elif "MORTGAGE" in t or "REAL ESTATE" in t or "HOME EQUITY" in t:
        kind = "mortgage"
    elif "REVOLVING" in t or "CREDIT CARD" in t or "LINE OF CREDIT" in t or "CHARGE CARD" in t:
        kind = "revolving"
    elif "INSTALLMENT" in t:
        kind = "installment"
    elif "OPEN" in t:
        kind = "open"
    else:
        kind = "other"
    flags = []
    if kind == "collection":
        flags.append("collection")
    if CHARGEOFF.search(st) or "C/O" in hist:
        flags.append("charged_off")
    if TRANSFERRED.search(st):
        flags.append("transferred")
    if BANKRUPTCY.search(st):
        flags.append("bankruptcy")
    if DISPUTED.search(st):
        flags.append("disputed")
    names = " ".join([a.get("name", ""), a.get("original_creditor", ""), a.get("loan_type", "")])
    if MEDICAL.search(names):
        flags.append("medical")
    if STUDENT.search(names) or "STUDENT" in t:
        flags.append("student_loan")
    if CHILD_SUPPORT.search(names) or "CHILD SUPPORT" in t:
        flags.append("child_support")
    if GOVERNMENT.search(a.get("name", "")) or "child_support" in flags:
        flags.append("government")
    if BNPL.search(a.get("name", "")):
        flags.append("bnpl")
    if "SECURED" in t and "UNSECURED" not in t:
        flags.append("secured")
    if a.get("pay_status_adverse") or any(is_late(r) or r in DEROG_RATINGS for r in hist) or kind == "collection":
        flags.append("adverse")
    if a.get("closed") or re.search(r"\bCLOSED\b", st):
        flags.append("closed")
    if PAID_STATUS.search(a.get("pay_status", "")) or a.get("paid"):
        flags.append("paid")
    if "CREDIT GRANTOR" in st or re.search(r"\bCBG\b", st):
        flags.append("closed_by_grantor")
    return kind, sorted(set(flags))


def account_id(bureau, a):
    key = "|".join([bureau, norm_name(a.get("name")), norm_space(a.get("number")), a.get("opened", "")])
    return "a" + stable_hash(key)


def visible_digits(number):
    """The unmasked characters of an account number: '4929000011****' -> '4929000011'."""
    return re.sub(r"[^0-9A-Z]", "", str(number or "").upper().split("*")[0])


def money_or_none(s):
    return parse_money(s)

"""Write web/src/core/91_example.js: the example family the browser opens from "Try the example".

Every person, lender, collector, address, account number, tracking number and score here is
invented, and the app labels it EXAMPLE DATA on every screen. The reports are built in the
normalized model by hand (not parsed from any real report); the findings, letters and deadlines the
app shows for them are computed by the core, the same as for real data. The mailed letters are
generated here by the Python library, so they carry the same traced sources a real letter does.

Run: python tests/make_example.py   (tests/make_vectors.py also runs it)
"""

import copy
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from errata import findings, letters, rounds  # noqa: E402
from errata.model import classify, new_account, new_report  # noqa: E402
from errata.tu import account_confidence, finish  # noqa: E402
from errata.util import add_months, month_index  # noqa: E402

TODAY = "2026-11-04"
ROUND1 = "2026-08-17"
R2 = {"equifax": "2026-10-02", "experian": "2026-10-02", "transunion": "2026-10-05"}
BUREAUS = ("equifax", "experian", "transunion")

PROFILE = {
    "name": "Jordan A. Example", "mailing": ["100 Sample Street, Apt 2", "Anytown, TX 75000"], "dob": "1990-01-01", "ssn_last4": "0000",
    "names": ["JORDAN A EXAMPLE", "JORDAN EXAMPLE", "JORDAN ALEX EXAMPLE"],
    "addresses": ["100 SAMPLE ST APT 2 ANYTOWN, TX 75000", "22 EXAMPLE RD ANYTOWN, TX 75001"],
    "phones": ["(512) 555-0100"], "employers": ["SAMPLE FREIGHT CO"], "facts": {}, "ftc_report": "", "state": "TX", "accommodations": [],
}


def months(first, last):
    out, m = [], first
    while m <= last:
        out.append(m)
        m = add_months(m, 1)
    return out


def hist(first, last, bal=None, rating="OK", past_due=0):
    out = []
    for m in months(first, last):
        b = bal(m) if callable(bal) else bal
        out.append({"month": m, "rating": rating, "bal": b, "high": None, "past_due": past_due if b is not None else None,
                    "paid": None, "due": None, "remarks": []})
    return out


def card_bal(m):
    i = month_index(m)
    return (900 + (i * 137) % 1100) * 100


def acct(**kw):
    a = new_account()
    a.update(kw)
    a.setdefault("section", "manual")
    a["kind"], a["flags"] = classify(a)
    a["confidence"] = account_confidence(a)
    return a


def larkspur(b, rnd):
    last = "2026-07" if rnd == 1 else ("2026-08" if b == "transunion" else "2026-09")
    h = hist("2024-08", last, card_bal)
    for x in h:
        if x["month"] == "2026-08":
            x["bal"] = 161200
        if x["month"] == "2026-09":
            x["bal"] = 164000
        if b == "experian" and x["month"] == "2025-03":
            x.update({"rating": "30", "bal": 128400, "past_due": 9600})
    upd = {"2026-07": "2026-07-28", "2026-08": "2026-08-28", "2026-09": "2026-09-29"}[last]
    return acct(name="LARKSPUR CARD SERVICES", number="XXXXXXXXXXXX4417", account_type="Revolving Account", loan_type="Credit Card",
                opened="2019-06-12", responsibility="Individual", credit_limit=300000, high_balance=290000, balance=h[-1]["bal"],
                past_due=0, pay_status="Current", updated=upd, monthly_payment=4000, address="PO BOX 1000 ANYTOWN, TX 75000",
                history=h)


def oldmill(b, rnd):
    h = hist("2024-08", "2025-05", lambda m: max(0, 620000 - (month_index(m) - month_index("2024-08")) * 62000))
    if b == "equifax":
        h.append({"month": "2025-06", "rating": "60" if rnd == 1 else "X", "bal": 0, "high": None, "past_due": 0, "paid": None, "due": None, "remarks": []})
    return acct(name="OLD MILL AUTO FINANCE", number="XXXXXX0932", account_type="Installment Account", loan_type="Auto Loan", opened="2021-02-10",
                responsibility="Individual", high_balance=1480000, balance=0, past_due=0, pay_status="Paid, Closed", paid="2025-05-22",
                closed="2025-05-22", updated="2025-06-27" if b == "equifax" else "2025-05-31", address="40 EXAMPLE PLAZA ANYTOWN, TX 75002",
                terms={"text": "$412 per month, paid Monthly for 48 months", "amount": 41200, "months": 48, "frequency": "Monthly"}, history=h)


def ashgrove(b):
    return acct(name="ASHGROVE RECOVERY LLC", number="XXXX7781", account_type="Open Account", loan_type="Collection Agency/Attorney",
                opened="2026-03-02", original_creditor="" if b == "experian" else "ANYTOWN MEDICAL GROUP", balance=41200, high_balance=41200,
                past_due=41200, pay_status="Collection Account", updated="2026-09-16", dofd="2025-09", removal="2032-10",
                address="9 COLLECTOR WAY ANYTOWN, TX 75003", remarks=["PLACED FOR COLLECTION"])


def fernway():
    return acct(name="FERNWAY MOBILE", number="XXXXX5530", account_type="Open Account", loan_type="Factoring Company Account",
                opened="2019-05-20", original_creditor="FERNWAY WIRELESS SERVICES", balance=18900, high_balance=18900, past_due=18900,
                pay_status="Collection Account", updated="2026-07-01", dofd="2018-11", removal="2026-05", address="PO BOX 77 ANYTOWN, TX 75004")


def tidewater(rnd):
    last = "2026-07" if rnd == 1 else "2026-09"
    h = hist("2024-06", last, lambda m: 1400000 - (month_index(m) - month_index("2024-06")) * 9000)
    for x in h:
        if x["month"] == "2024-08":
            x.update({"rating": "30", "past_due": 18500})
    return acct(name="TIDEWATER STUDENT LENDING", number="XXXXX2208", account_type="Installment Account", loan_type="Student Loan",
                opened="2017-08-20", responsibility="Individual", high_balance=1850000, balance=h[-1]["bal"], past_due=0, pay_status="Current",
                updated="2026-09-24" if rnd == 2 else "2026-07-31", address="1 LENDER SQ ANYTOWN, TX 75005", removal="2031-08",
                terms={"text": "$185 per month, paid Monthly for 120 months", "amount": 18500, "months": 120, "frequency": "Monthly"}, history=h)


def simple_card(name, number, opened, limit, bal, rnd, addr):
    last = "2026-07" if rnd == 1 else "2026-09"
    h = hist("2024-10", last, bal)
    return acct(name=name, number=number, account_type="Revolving Account", loan_type="Credit Card", opened=opened, responsibility="Individual",
                credit_limit=limit, high_balance=bal, balance=bal, past_due=0, pay_status="Current",
                updated="2026-09-26" if rnd == 2 else "2026-07-26", address=addr, history=h)


def personal(r, b, rnd):
    p = r["personal"]
    p["names"] = [{"name": "JORDAN A EXAMPLE", "kind": "primary"}, {"name": "JORDAN EXAMPLE", "kind": "aka"}]
    if b == "experian" and rnd == 1:
        p["names"].append({"name": "JORDAN EXMPLE", "kind": "aka"})
    p["dob"] = "1990-01-01"
    p["ssn_masked"] = "XXX-XX-0000"
    p["ssn_last4"] = "0000"
    p["addresses"] = [{"text": "100 SAMPLE ST APT 2 ANYTOWN, TX 75000", "kind": "current", "reported": "2024-01-10"},
                      {"text": "22 EXAMPLE RD ANYTOWN, TX 75001", "kind": "previous", "reported": "2019-03-02"}]
    p["phones"] = [{"number": "(512) 555-0100"}]
    p["employers"] = [{"name": "SAMPLE FREIGHT CO", "occupation": "", "location": "", "verified": "2023-02-01"}]


def report(b, rnd):
    r = new_report(b)
    date = ROUND1 if rnd == 1 else R2[b]
    r["source"].update({"kind": "example", "parser": "example", "file_number": {"equifax": "EX-EQ-0001", "experian": "EX-XP-0002", "transunion": "EX-TU-0003"}[b],
                        "report_date": date, "pages": {"equifax": 14, "experian": 11, "transunion": 19}[b], "name": "Example " + b + " report.pdf"})
    personal(r, b, rnd)
    A = r["accounts"]
    A.append(larkspur(b, rnd))
    A.append(oldmill(b, rnd))
    if rnd == 1 or b != "transunion":
        A.append(ashgrove(b))
    if rnd == 1 and b in ("equifax", "transunion"):
        A.append(fernway())
    A.append(tidewater(rnd))
    A.append(simple_card("HARBOR LANE REWARDS", "XXXXXXXXXXXX0268", "2022-11-04", 550000, 231000, rnd, "PO BOX 268 ANYTOWN, TX 75006"))
    A.append(simple_card("BIRCH STREET STORE CARD", "XXXXXXXX1190", "2023-04-01", 120000, 61000, rnd, "PO BOX 1190 ANYTOWN, TX 75007"))
    r["inquiries"] = [{"kind": "review", "name": "LARKSPUR CARD SERVICES", "dates": ["2026-07-01"], "location": "", "phone": "", "inquiry_type": "", "purpose": ""}]
    if rnd == 2 and b == "transunion":
        r["inquiries"].insert(0, {"kind": "hard", "name": "SUMMIT RIDGE AUTO SALES", "dates": ["2026-03-11"], "location": "500 SAMPLE PKWY ANYTOWN, TX 75008",
                                  "phone": "", "inquiry_type": "Individual", "purpose": "CREDIT TRANSACTION"})
    if b == "transunion" and rnd == 2:
        # fields the reader was unsure of, with the text on the page (the example shows the correction table)
        r["warnings"] = [
            {"account": "ASHGROVE RECOVERY LLC", "field": "dofd", "raw": "DOFD 0 9/2025", "value": "09/2025", "conf": 64,
             "message": "The first delinquency date has a stray space."},
            {"account": "HARBOR LANE REWARDS", "field": "high_balance", "raw": "Hi Bal $2,31O", "value": "$2,310", "conf": 58,
             "message": "The page shows the letter O where a zero belongs."},
            {"account": "OLD MILL AUTO FINANCE", "field": "closed", "raw": "Closed 05/2O25", "value": "05/2025", "conf": 69,
             "message": "The page shows the letter O where a zero belongs."},
            {"account": "TIDEWATER STUDENT LENDING", "field": "removal", "raw": "Est. removal 08/2O31", "value": "08/2031", "conf": 71,
             "message": "The page shows the letter O where a zero belongs."},
        ]
    if b == "experian" and rnd == 2:
        r["warnings"] = [{"account": "ASHGROVE RECOVERY LLC", "field": "original_creditor", "raw": "Original Creditor: (blank)", "value": "", "conf": 71,
                          "message": "No original creditor is printed for this collection."}]
    finish(r, date)
    return r


def key_of(r, name):
    return rounds.account_key(next(a for a in r["accounts"] if a["name"] == name))


def fid(fs, rule, name):
    return next(f["id"] for f in fs if f["rule"] == rule and f["subject"].startswith(name))


def build_jordan():
    r1 = {b: report(b, 1) for b in BUREAUS}
    r2 = {b: report(b, 2) for b in BUREAUS}
    prof = copy.deepcopy(PROFILE)
    f1 = {b: findings.find(r1[b], {"as_of": ROUND1, "profile": prof}) for b in BUREAUS}
    x1 = rounds.compare([r1[b] for b in BUREAUS])["findings"]
    allf1 = {b: f1[b] + [f for f in x1 if f["bureau"] == b] for b in BUREAUS}
    # the person's answers: the Summit Ridge inquiry was not authorized; the Equifax and TransUnion
    # collector questions answered (the collector did send a letter first), the Experian one left open
    f2tu = findings.find(r2["transunion"], {"as_of": TODAY, "profile": prof})
    inq = next(f for f in f2tu if f["rule"] == "inquiry_no_account")
    prof["facts"][inq["confirm"][0]["key"]] = True
    for b in ("equifax", "transunion"):
        for f in f1[b]:
            if f["rule"] == "collector_reported_early":
                prof["facts"][f["confirm"][0]["key"]] = False
    ash_eq = next(a for a in r1["equifax"]["accounts"] if a["name"] == "ASHGROVE RECOVERY LLC")
    for f in findings.find(r2["equifax"], {"as_of": TODAY, "profile": prof}):
        if f["rule"] == "collector_reported_early":
            prof["facts"][f["confirm"][0]["key"]] = False
    del ash_eq

    def pick(b, rule, name):
        return next(f for f in allf1[b] if f["rule"] == rule and f["subject"].startswith(name))

    def gen(kind, rep, fs, as_of, opts=None):
        return letters.generate(kind, rep, fs, prof, as_of, opts or {})

    m = []
    eq1 = [pick("equifax", "obsolete", "FERNWAY"), pick("equifax", "medical_policy", "ASHGROVE"), pick("equifax", "paid_then_late", "OLD MILL")]
    m.append({"id": "m1", "letter": "bureau_611", "bureau": "equifax", "to": "Equifax", "round": 1, "findings": [f["id"] for f in eq1],
              "mailed": "2026-08-20", "delivered": "2026-08-26", "tracking": "9407 1000 0000 0000 0000 11", "card": True,
              "outcome": "results", "completed": "2026-09-20", "result_date": "2026-09-20",
              "results": [{"key": key_of(r1["equifax"], "FERNWAY MOBILE"), "name": "FERNWAY MOBILE", "outcome": "deleted"},
                          {"key": key_of(r1["equifax"], "ASHGROVE RECOVERY LLC"), "name": "ASHGROVE RECOVERY LLC", "outcome": "deleted"},
                          {"key": key_of(r1["equifax"], "OLD MILL AUTO FINANCE"), "name": "OLD MILL AUTO FINANCE", "outcome": "updated"}],
              "L": gen("bureau_611", r1["equifax"], eq1, "2026-08-19")})
    ex1 = [pick("experian", "cross_bureau_mismatch", "LARKSPUR"), pick("experian", "collection_missing_oc", "ASHGROVE")]
    exn = [pick("experian", "name_variant", "JORDAN EXMPLE")]
    m.append({"id": "m2", "letter": "bureau_611", "bureau": "experian", "to": "Experian", "round": 1, "findings": [f["id"] for f in ex1],
              "mailed": "2026-08-20", "delivered": "2026-08-25", "tracking": "9407 1000 0000 0000 0000 28", "card": True,
              "outcome": "results", "completed": "2026-09-22", "result_date": "2026-09-22",
              "results": [{"key": key_of(r1["experian"], "LARKSPUR CARD SERVICES"), "name": "LARKSPUR CARD SERVICES", "outcome": "verified"},
                          {"key": key_of(r1["experian"], "ASHGROVE RECOVERY LLC"), "name": "ASHGROVE RECOVERY LLC", "outcome": "verified"}],
              "L": gen("bureau_611", r1["experian"], ex1, "2026-08-19")})
    m.append({"id": "m2b", "letter": "personal_info", "bureau": "experian", "to": "Experian", "round": 1, "findings": [f["id"] for f in exn],
              "mailed": "2026-08-20", "delivered": "2026-08-25", "tracking": "9407 1000 0000 0000 0000 30", "card": True,
              "outcome": "results", "completed": "2026-09-22", "result_date": "2026-09-22", "results": [],
              "L": gen("personal_info", r1["experian"], exn, "2026-08-19")})
    tu1 = [pick("transunion", "obsolete", "FERNWAY"), pick("transunion", "medical_policy", "ASHGROVE")]
    m.append({"id": "m3", "letter": "bureau_611", "bureau": "transunion", "to": "TransUnion", "round": 1, "findings": [f["id"] for f in tu1],
              "mailed": "2026-08-20", "delivered": "2026-08-26", "tracking": "9407 1000 0000 0000 0000 35", "card": True,
              "outcome": "results", "completed": "2026-09-16", "result_date": "2026-09-16",
              "results": [{"key": key_of(r1["transunion"], "FERNWAY MOBILE"), "name": "FERNWAY MOBILE", "outcome": "deleted"},
                          {"key": key_of(r1["transunion"], "ASHGROVE RECOVERY LLC"), "name": "ASHGROVE RECOVERY LLC", "outcome": "deleted"}],
              "L": gen("bureau_611", r1["transunion"], tu1, "2026-08-19")})
    # round 2: the findings on the round 2 reports
    f2 = {b: findings.find(r2[b], {"as_of": TODAY, "profile": prof}) for b in BUREAUS}
    x2 = rounds.compare([r2[b] for b in BUREAUS])["findings"]
    lark = next(f for f in x2 if f["bureau"] == "experian" and f["subject"].startswith("LARKSPUR"))
    m.append({"id": "m4", "letter": "mov_611a7", "bureau": "experian", "to": "Experian", "round": 2, "findings": [lark["id"]],
              "mailed": "2026-10-08", "delivered": "2026-10-13", "tracking": "9407 1000 0000 0000 0000 42", "card": True, "outcome": "",
              "L": gen("mov_611a7", r2["experian"], [lark], "2026-10-08", {"log": {"id": "m2", "delivered": "2026-08-25", "result_date": "2026-09-22"}})})
    m.append({"id": "m5", "letter": "furnisher_623", "bureau": "experian", "to": "Larkspur Card Services", "round": 2, "findings": [lark["id"]],
              "account_id": lark["account_id"], "mailed": "2026-10-08", "delivered": "2026-10-13", "tracking": "9407 1000 0000 0000 0000 59", "card": True,
              "outcome": "", "L": gen("furnisher_623", r2["experian"], [lark], "2026-10-08")})
    deleted_keys = [x["key"] for e in m for x in e.get("results", []) if x["outcome"] == "deleted" and e["bureau"] == "equifax"]
    d = rounds.diff(r1["equifax"], r2["equifax"], {"deleted_keys": deleted_keys})
    rein = d["findings"][0]
    m.append({"id": "m6", "letter": "reinsertion_demand", "bureau": "equifax", "to": "Equifax", "round": 2, "findings": [rein["id"]],
              "mailed": "2026-10-08", "delivered": "2026-10-20", "tracking": "9407 1000 0000 0000 0000 66", "card": False, "outcome": "",
              "L": gen("reinsertion_demand", r2["equifax"], [rein], "2026-10-08")})
    inq2 = next(f for f in f2["transunion"] if f["rule"] == "inquiry_no_account")
    m.append({"id": "m7", "letter": "inquiry_removal", "bureau": "transunion", "to": "Summit Ridge Auto Sales", "round": 2, "findings": [inq2["id"]],
              "mailed": "2026-10-08", "delivered": "", "tracking": "9407 1000 0000 0000 0000 73", "card": False, "outcome": "",
              "L": gen("inquiry_removal", r2["transunion"], [inq2], "2026-10-08")})
    del f2
    vault = []
    for e in m:
        vault.append({"id": "v-" + e["id"], "name": letters.LETTERS[e["letter"]]["title"].split(" (")[0] + " to " + e["to"] + ".txt", "kind": "Letter",
                      "account": _acct_name(e), "date": e["mailed"], "type": "text/plain", "text": letters.to_text(e["L"])})
        if e["card"]:
            vault.append({"id": "v-" + e["id"] + "-card", "name": e["to"] + " return receipt.txt", "kind": "Receipt", "account": _acct_name(e),
                          "date": e["delivered"], "type": "text/plain", "text": "EXAMPLE DATA. Return receipt for tracking number " + e["tracking"] + ", delivered " + e["delivered"] + ".\n"})
        if e.get("completed"):
            vault.append({"id": "v-" + e["id"] + "-reply", "name": e["to"] + " results.txt", "kind": "Reply", "account": _acct_name(e),
                          "date": e["completed"], "type": "text/plain",
                          "text": "EXAMPLE DATA. Results of your dispute, dated " + e["completed"] + ".\n" +
                                  "".join(x["name"] + ": " + {"deleted": "DELETED", "verified": "VERIFIED AS ACCURATE", "updated": "UPDATED"}[x["outcome"]] + "\n" for x in e["results"])})
    vault.append({"id": "v-proof-1", "name": "Larkspur statement March 2025.txt", "kind": "Your proof", "account": "LARKSPUR CARD SERVICES", "date": "2026-10-02",
                  "type": "text/plain", "text": "EXAMPLE DATA. Statement closing 03/15/2025. Payment received 03/28/2025, on or before the due date.\n"})
    vault.append({"id": "v-proof-2", "name": "Bank record of payment.txt", "kind": "Your proof", "account": "LARKSPUR CARD SERVICES", "date": "2026-10-02",
                  "type": "text/plain", "text": "EXAMPLE DATA. Payment to Larkspur Card Services, 03/28/2025, $96.\n"})
    vault.append({"id": "v-id", "name": "ID and proof of address.txt", "kind": "Your proof", "account": "", "date": "2026-08-19", "type": "text/plain",
                  "text": "EXAMPLE DATA. Placeholder for a copy of a photo ID and a utility bill.\n"})
    return {
        "id": "p-jordan", "name": "Jordan Example", "relationship": "You", "initials": "JE", "example": True,
        "profile": prof, "rounds": [{"id": "r1", "label": "Round 1", "date": ROUND1, "reports": [r1[b] for b in BUREAUS]},
                                    {"id": "r2", "label": "Round 2", "date": R2["equifax"], "reports": [r2[b] for b in BUREAUS]}],
        "start": ROUND1, "mail": m, "status": {}, "corrections": {}, "goal": "standard", "vault": vault, "notices": {},
        "scores": [{"date": "2026-05-15", "model": "VantageScore 4.0", "value": 588, "source": "Card app"},
                   {"date": "2026-06-15", "model": "FICO 8", "value": 579, "source": "Bank app"},
                   {"date": "2026-08-15", "model": "VantageScore 4.0", "value": 597, "source": "Card app"},
                   {"date": "2026-09-16", "model": "FICO 8", "value": 604, "source": "Bank app"},
                   {"date": "2026-10-13", "model": "VantageScore 4.0", "value": 618, "source": "Card app"}],
        "cards": [{"id": "c-lark", "name": "LARKSPUR CARD SERVICES", "limit": 300000, "balance": 164000, "statement_day": 14},
                  {"id": "c-harbor", "name": "HARBOR LANE REWARDS", "limit": 550000, "balance": 231000, "statement_day": 22},
                  {"id": "c-birch", "name": "BIRCH STREET STORE CARD", "limit": 120000, "balance": 61000, "statement_day": 8}],
        "accurate": {},
    }


def _acct_name(e):
    names = {"m1": "", "m2": "", "m2b": "", "m3": "", "m4": "LARKSPUR CARD SERVICES", "m5": "LARKSPUR CARD SERVICES", "m6": "ASHGROVE RECOVERY LLC",
             "m7": "SUMMIT RIDGE AUTO SALES"}
    return names.get(e["id"]) or e["to"].upper()


def small_person(pid, name, rel, initials, first):
    r = new_report("transunion")
    r["source"].update({"kind": "example", "parser": "example", "report_date": "2026-09-24", "pages": 6, "name": "Example transunion report.pdf"})
    r["personal"]["names"] = [{"name": first.upper() + " EXAMPLE", "kind": "primary"}]
    r["personal"]["addresses"] = [{"text": "100 SAMPLE ST APT 2 ANYTOWN, TX 75000", "kind": "current", "reported": "2025-02-04"}]
    r["accounts"].append(simple_card("HARBOR LANE REWARDS", "XXXXXXXXXXXX7710", "2020-01-15", 200000, 40000, 2, "PO BOX 268 ANYTOWN, TX 75006"))
    finish(r, "2026-09-24")
    return {"id": pid, "name": name, "relationship": rel, "initials": initials, "example": True,
            "profile": {"name": first + " Example", "mailing": ["100 Sample Street, Apt 2", "Anytown, TX 75000"], "dob": "", "ssn_last4": "",
                        "names": [first.upper() + " EXAMPLE"], "addresses": ["100 SAMPLE ST APT 2 ANYTOWN, TX 75000"], "phones": [], "employers": [],
                        "facts": {}, "ftc_report": "", "state": "TX", "accommodations": []},
            "rounds": [{"id": "r1", "label": "Round 1", "date": "2026-09-24", "reports": [r]}], "start": "2026-09-24", "mail": [], "status": {},
            "corrections": {}, "goal": "standard", "vault": [], "notices": {}, "scores": [], "cards": [], "accurate": {}}


def example():
    return {"today": TODAY, "passphrase": "example", "settings": {"lockMinutes": 5},
            "people": [build_jordan(), small_person("p-riley", "Riley Example", "Sister", "RE", "Riley"),
                       small_person("p-sam", "Sam Example", "Father", "SE", "Sam")]}


def main():
    text = ("// Written by tests/make_example.py. Invented example data: every name, number and date is made up, and the app labels\n"
            "// it EXAMPLE DATA on every screen. Do not edit by hand.\n"
            "const EXAMPLE = " + json.dumps(example(), sort_keys=True, ensure_ascii=True, separators=(",", ":")) + ";\n")
    (ROOT / "web" / "src" / "core" / "91_example.js").write_text(text, encoding="utf-8")


if __name__ == "__main__":
    main()

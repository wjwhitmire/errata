"""The template reader (Experian and Equifax) on synthetic fixtures built from the bureaus' general
report structure. No real Experian or Equifax report was used; these tests show the reader handles
both label layouts (label beside value, and a row of labels over a row of values), the payment
history grid by month columns, personal information and inquiries, and that every planted error is
found with its legal basis while the clean accounts produce nothing."""

import make_template_fixtures as fx
import pytest
from conftest import AS_OF, items
from errata import detect_bureau, findings, generic, parse_items
from errata.law import CITATIONS
from errata.util import CreditError
from test_findings import EXPECTED_BASIS

EXTRA_BASIS = {"collection_missing_oc": {"fcra611", "fcra607b", "metro2_k1"}, "status_vs_past_due": {"fcra611", "fcra607b", "metro2_status"}, "medical_policy": {"medical_policy", "fcra611"}}


@pytest.mark.parametrize("name,bureau,planted,clean", [("ex_planted.pdf", "experian", fx.PLANTED_EX, fx.CLEAN_EX),
                                                       ("eq_planted.pdf", "equifax", fx.PLANTED_EQ, fx.CLEAN_EQ)])
def test_planted_errors_found_and_clean_accounts_quiet(name, bureau, planted, clean):
    its = items(name)
    assert detect_bureau(its) == bureau
    r = parse_items(its)
    assert r["bureau"] == bureau and r["source"]["report_date"] == AS_OF and r["warnings"] == [] and r["source"]["confidence"] >= 90
    fs = findings.find(r, {"as_of": AS_OF})
    for rule, subject in planted:
        hits = [f for f in fs if f["rule"] == rule and subject in f["subject"]]
        assert hits, f"{rule} not found for {subject}"
        basis = EXPECTED_BASIS.get(rule) or EXTRA_BASIS[rule]
        assert all(set(f["legal"]) == basis and all(k in CITATIONS for k in f["legal"]) for f in hits)
    assert len(fs) == len(planted), [(f["rule"], f["subject"]) for f in fs]
    ids = {a["id"] for a in r["accounts"] if a["name"] in clean}
    assert len(ids) == len(clean) and not [f for f in fs if f["account_id"] in ids]


def test_experian_fields():
    r = generic.parse(items("ex_planted.pdf"))
    a = next(x for x in r["accounts"] if x["name"] == "SAMPLE FINANCE CO")
    assert a["paid"] == "2024-03-15" and a["closed"] == "2024-03-15" and a["high_balance"] == 600000 and a["kind"] == "installment"
    assert [h["month"] for h in a["history"] if h["rating"] != "OK"] == ["2024-06", "2024-07"]
    c = next(x for x in r["accounts"] if x["name"] == "OLD SAMPLE COLLECTIONS")
    assert c["kind"] == "collection" and c["dofd"] == "2018-06" and c["removal"] == "2025-12" and c["original_creditor"] == "EXAMPLE TELECOM"
    card = next(x for x in r["accounts"] if x["name"] == "EXAMPLE CARD SERVICES")
    assert card["kind"] == "revolving" and card["loan_type"] == "Credit card" and card["credit_limit"] == 500000 and card["updated"] == "2026-10-01"
    p = r["personal"]
    assert [n["name"] for n in p["names"]] == ["JORDAN Q SAMPLE", "JORDAN SAMPLE", "JORDAN Q SAMPEL"] and p["dob"] == "1980"
    assert p["addresses"][0] == {"text": "100 EXAMPLE AVE ANYTOWN, TX 75001", "kind": "current", "reported": "2025-08-01"}
    assert [(q["kind"], q["name"]) for q in r["inquiries"]] == [("hard", "EXAMPLE LENDING CO"), ("hard", "SAMPLE AUTO LOAN"), ("review", "EXAMPLE CARD SERVICES")]


def test_equifax_label_rows_and_grid():
    r = generic.parse(items("eq_planted.pdf"))
    a = next(x for x in r["accounts"] if x["name"] == "MIDTOWN SAMPLE BANK")
    assert a["past_due"] == 25000 and a["pay_status"] == "Current" and a["credit_limit"] == 300000 and a["last_payment"] == "2026-09-02"
    s = next(x for x in r["accounts"] if x["name"] == "SAMPLE STUDENT SERVICES")
    assert s["pay_status_adverse"] and s["history"][-1] == {"month": "2026-09", "rating": "60", "bal": None, "high": None, "past_due": None, "paid": None, "due": None, "remarks": []}
    assert s["terms"]["text"] == "120 Months" and "student_loan" in s["flags"]
    m = next(x for x in r["accounts"] if x["name"] == "EXAMPLE ASSET PARTNERS")
    assert "medical" in m["flags"] and m["kind"] == "collection"
    assert [x["number"] for x in r["personal"]["phones"]] == ["(512) 555-0134", "(123) 555-0101"]


def test_unreadable_values_become_warnings_and_lower_confidence():
    its = items("eq_planted.pdf")
    for it in its:
        if it["s"] == "$1,140":
            it["s"] = "$1,1A0"
    r = generic.parse(its)
    w = [x for x in r["warnings"] if x["field"] == "balance"]
    assert w and w[0]["raw"] == "$1,1A0" and r["source"]["confidence"] < 98
    with pytest.raises(CreditError):
        generic.parse([{"p": 0, "x": 1, "y": 1, "w": 1, "h": 7, "s": "Hello"}])

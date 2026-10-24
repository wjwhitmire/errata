"""The TransUnion parser on the synthetic fixtures: every section and the fields the rules use."""

from conftest import items, report
from errata import parse_items, tu
from errata.textlayer import make_cells, make_lines
from errata.util import CreditError


def acct(r, name, num=""):
    return next(a for a in r["accounts"] if a["name"] == name and a["number"].startswith(num))


def test_header_and_personal(planted):
    r = planted
    assert r["bureau"] == "transunion"
    assert r["source"]["file_number"] == "900000001"
    assert r["source"]["report_date"] == "2026-10-20"
    assert r["source"]["confidence"] == 100 and r["warnings"] == []
    p = r["personal"]
    assert p["on_file_since"] == "2008-03-14"
    assert p["ssn_masked"] == "XXX-XX-0000" and p["ssn_last4"] == "0000"
    assert p["dob"] == "1980-01-01"
    assert [n["name"] for n in p["names"]] == ["JORDAN QUINN SAMPLE", "JORDAN SAMPLE", "JORDAN Q. SAMPEL", "JORDAN R. SAMPLE", "JORDON SAMPLE"]
    assert p["names"][0]["kind"] == "primary" and all(n["kind"] == "aka" for n in p["names"][1:])
    assert len(p["addresses"]) == 5 and p["addresses"][0]["kind"] == "current" and p["addresses"][0]["reported"] == "2025-08-01"
    assert [x["number"] for x in p["phones"]] == ["(512) 555-0134", "(123) 555-0101", "(214) 555-0199"]
    assert p["employers"] == [{"name": "EXAMPLE FREIGHT CO", "occupation": "DISPATCHER", "location": "", "verified": "2019-04-02"},
                              {"name": "SAMPLE LOGISTICS INC", "occupation": "DRIVER", "location": "ANYTOWN, TX", "verified": "2013-05-09"}]


def test_accounts_sections_and_fields(planted):
    r = planted
    assert len(r["accounts"]) == 15
    assert sum(1 for a in r["accounts"] if a["section"] == "adverse") == 12
    assert sum(1 for a in r["accounts"] if a["kind"] == "collection") == 3
    a = acct(r, "PAYLATER EXAMPLE INC", "PLA1")
    assert a["terms"] == {"text": "$0 per month, paid Monthly for 12 months", "amount": 0, "months": 12, "frequency": "Monthly"}
    assert a["original_creditor"] == "EXAMPLE PARTNER BANK" and a["balance"] == 27200 and a["monthly_payment"] == 0
    assert a["pay_status"] == "Account 30 Days Past Due Date" and a["pay_status_adverse"] is True
    assert a["max_delinquency"]["days"] == 30 and a["max_delinquency"]["entries"] == [{"month": "2026-08", "amount": 4500}]
    assert a["removal"] == "2033-06" and a["high_balance"] == 54000 and "bnpl" in a["flags"]
    assert len(a["history"]) == 14 and a["history"][0] == {"rating": "OK", "bal": 54000, "high": None, "past_due": 0, "paid": 0,
                                                            "due": 4500, "remarks": [], "month": "2025-08"}
    s = acct(r, "EXAMPLE SECURED CARD")
    assert s["paid"] == "2024-03-15" and s["closed"] == "2024-09-27" and s["credit_limit"] == 30000 and s["monthly_payment"] is None
    assert s["remarks"] == ["CLOSED BY CREDIT GRANTOR", "CLOSED"] and "closed_by_grantor" in s["flags"]
    assert [h["rating"] for h in s["history"]][7:10] == ["30", "60", "90"]
    c = acct(r, "TEST RECEIVABLES LLC")
    assert c["kind"] == "collection" and c["original_creditor"] == "NORTHWIND EXAMPLE BANK" and c["past_due"] == 184000
    assert c["address"] == "18 SAMPLE BLVD EDINA, MN 55499" and c["phone"] == "(952) 555-0192"
    card = acct(r, "EXAMPLE CARD BANK")
    assert card["credit_limit"] == 500000 and card["section"] == "satisfactory" and len(card["history"]) == 19
    m = acct(r, "SAMPLE MORTGAGE CO")
    assert m["kind"] == "mortgage" and m["terms"]["amount"] == 162000 and m["terms"]["months"] == 360
    cs = acct(r, "EXAMPLE STATE CHILD SUPPORT OFFICE")
    assert {"child_support", "government"} <= set(cs["flags"]) and cs["kind"] == "open"
    ids = [a["id"] for a in r["accounts"]]
    assert len(set(ids)) == len(ids)


def test_inquiries_and_specialty(planted):
    r = planted
    kinds = [(q["kind"], q["name"], q["dates"]) for q in r["inquiries"]]
    assert kinds[0] == ("hard", "EXAMPLE LENDING CO", ["2026-05-18"])
    assert ("promotional", "PRESCREEN EXAMPLE CARD", ["2026-08-19", "2026-02-20"]) in kinds
    assert ("review", "EXAMPLE CARD BANK", ["2026-10-17", "2026-07-16", "2026-04-17"]) in kinds
    auto = next(q for q in r["inquiries"] if q["name"] == "SAMPLE AUTO GROUP")
    assert auto["purpose"] == "CREDIT TRANSACTION" and auto["inquiry_type"] == "Individual" and auto["location"] == "200 SAMPLE PKWY PLANO, TX 75024"
    assert len(r["specialty"]) == 2
    assert r["specialty"][0]["requested_by"] == "EXAMPLE MONITORING" and r["specialty"][0]["requested_on"] == "2026-08-12"
    assert r["specialty"][0]["fields"]["Average Checks Ordered in the Last 3 Years"] == ".00000"
    assert r["messages"] == ["Promotional opt-out"]


def test_clean_and_round2_parse(clean, round2):
    assert len(clean["accounts"]) == 3 and len(clean["inquiries"]) == 4
    assert len(round2["accounts"]) == 12 and round2["source"]["report_date"] == "2026-12-01"


def test_detect_and_dispatch():
    its = items("tu_clean.pdf")
    assert tu.detect(its) == "transunion"
    assert parse_items(its)["bureau"] == "transunion"


def test_lines_cells_and_footer():
    its = [{"p": 0, "x": 20, "y": 100, "w": 30, "h": 7, "s": "Date"}, {"p": 0, "x": 51.5, "y": 100.4, "w": 30, "h": 7, "s": "Opened"},
           {"p": 0, "x": 206, "y": 100, "w": 40, "h": 7, "s": "Balance"}, {"p": 0, "x": 500, "y": 800, "w": 20, "h": 7, "s": "3 / 18"}]
    lines = make_lines(its)
    assert len(lines) == 1 and [c["s"] for c in lines[0]["cells"]] == ["Date Opened", "Balance"]
    assert make_cells([]) == []


def test_bad_input_degrades_with_warnings():
    its = items("tu_clean.pdf")
    for it in its:
        if it["s"] == "$1,225":
            it["s"] = "$1,2X0"
    r = tu.parse(its)
    assert any(w["field"] == "balance" for w in r["warnings"])
    assert r["source"]["confidence"] < 100
    try:
        parse_items([{"p": 0, "x": 1, "y": 1, "w": 1, "h": 7, "s": "Hello"}])
    except CreditError as e:
        assert "TransUnion" in e.message
    else:
        raise AssertionError("expected a refusal")

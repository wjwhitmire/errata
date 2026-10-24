"""Manual entry, CSV import and the results-letter reader."""

import pytest
from conftest import AS_OF
from errata import findings, intake
from errata.util import CreditError

CSV = ('bureau,creditor,account number,type,opened,balance,limit,past due,status,history,remarks\n'
       'TU,"EXAMPLE CARD, INC",4111XXXX,Revolving,03/01/2020,"$1,200",$5000,$0,Current,2025-03:30;2025-04:OK,closed by grantor\n'
       'EQ,SAMPLE AUTO,7788,Installment,2021-02-10,$0,,$0,"Paid, Closed",,\n'
       'TU,,,,,,,,,,\n')


def test_csv_splits_by_bureau_and_normalizes():
    reps = intake.parse_csv(CSV, "", AS_OF)
    assert [r["bureau"] for r in reps] == ["equifax", "transunion"]
    tu = reps[1]
    a = tu["accounts"][0]
    assert a["name"] == "EXAMPLE CARD, INC" and a["balance"] == 120000 and a["credit_limit"] == 500000 and a["opened"] == "2020-03-01"
    assert [h["rating"] for h in a["history"]] == ["30", "OK"] and a["remarks"] == ["closed by grantor"]
    assert a["kind"] == "revolving" and a["id"] and tu["source"]["report_date"] == AS_OF
    findings.find(tu, {"as_of": AS_OF})


def test_csv_quotes_tabs_and_refusals():
    assert intake.split_rows('a\tb\n"x ""y"""\t2\n') == [["a", "b"], ['x "y"', "2"]]
    with pytest.raises(CreditError):
        intake.parse_csv("a,b\n1,2\n")
    with pytest.raises(CreditError):
        intake.parse_csv("")
    with pytest.raises(CreditError):
        intake.manual_report("tu", [{"name": " "}])
    r = intake.manual_report("experian", [{"name": "X BANK", "balance": "$1,2X0"}], AS_OF)
    assert r["warnings"][0]["field"] == "balance"


def test_results_letter_is_read_into_proposed_outcomes(planted):
    text = ("Results of your dispute dated 09/16/2026. EXAMPLE CARD BANK: this item has been deleted. "
            "SAMPLE MORTGAGE CO: verified as accurate. The dispute was not frivolous.")
    res = intake.parse_response(text, planted["accounts"])
    got = {x["name"]: x["outcome"] for x in res["items"]}
    assert got["EXAMPLE CARD BANK"] == "deleted" and got["SAMPLE MORTGAGE CO"] == "verified"
    assert res["date"] == "2026-09-16" and res["frivolous"] is True and res["reinsertion"] is False

"""Deadlines (counting convention, business days, holidays), the escalation ladder, the planner
with the 90-day playbook and the auto loan mode, utilization, the score ranges and the SOL clocks."""

import pytest

from conftest import AS_OF
from errata import deadlines, findings, strategy
from errata.util import CreditError, add_business_days, holidays, is_business_day


def test_holidays_2026_and_business_days():
    assert holidays(2026) == ["2026-01-01", "2026-01-19", "2026-02-16", "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07",
                              "2026-10-12", "2026-11-11", "2026-11-26", "2026-12-25"]
    assert "2021-12-31" in holidays(2021)  # New Year's Day 2022 fell on a Saturday
    assert not is_business_day("2026-11-26") and not is_business_day("2026-10-24") and is_business_day("2026-10-23")
    assert add_business_days("2026-11-25", 1) == "2026-11-27"
    assert add_business_days("2026-12-23", 3) == "2026-12-29"


def test_fcra_30_day_convention():
    # Delivered (return receipt) Monday 2026-11-02: the period begins on that day, so the literal day 30
    # is 2026-12-01; the tool uses the later 2026-12-02 as the deadline and shows the earlier one too.
    d = deadlines.deadline("bureau_dispute", "2026-11-02")
    assert (d["earliest"], d["due"], d["cite"]) == ("2026-12-01", "2026-12-02", "fcra611")
    e = deadlines.deadline("bureau_dispute_extended", "2026-11-02")
    assert (e["earliest"], e["due"]) == ("2026-12-16", "2026-12-17")
    m = deadlines.deadline("mov", "2026-11-02")
    assert m["earliest"] == m["due"] == "2026-11-17"
    b = deadlines.deadline("block_605b", "2026-11-25")
    assert b["due"] == "2026-12-02" and b["business"]
    v = deadlines.validation_window(sent="2026-11-20")
    assert v == {"assumed_receipt": "2026-11-30", "period_end": "2026-12-30", "received": "2026-11-30"}
    with pytest.raises(CreditError):
        deadlines.deadline("bureau_dispute", "11/02/2026")
    with pytest.raises(CreditError):
        deadlines.deadline("nope", "2026-11-02")


def test_mail_deadlines_and_ladder():
    e = {"id": "m1", "letter": "bureau_611", "delivered": "2026-09-01"}
    assert [d["kind"] for d in deadlines.mail_deadlines(e)] == ["bureau_dispute", "furnisher_notice"]
    assert deadlines.mail_deadlines({"letter": "bureau_611"}) == []
    assert deadlines.mail_deadlines(dict(e, after_free_report=True))[0]["kind"] == "bureau_dispute_extended"
    n = deadlines.next_step(e, "2026-10-17")
    assert n["step"] == 2 and n["late"] and n["due"] == "2026-10-01"
    assert deadlines.next_step(dict(e, outcome="verified"), "2026-09-20")["step"] == 3
    assert deadlines.next_step(dict(e, outcome="deleted"), "2026-09-20")["cite"] == ["fcra611a5b"]
    assert deadlines.next_step({"letter": "mov_611a7", "delivered": "2026-09-01"}, "2026-10-01")["step"] == 4
    assert deadlines.next_step({"letter": "cfpb_complaint", "outcome": "no_relief"}, AS_OF)["step"] == 5
    assert deadlines.next_step({"letter": "state_ag_complaint", "outcome": "closed"}, AS_OF)["step"] == 6
    r = deadlines.reminders([e, {"id": "m2", "letter": "mov_611a7", "delivered": "2026-10-10"}], "2026-10-20")
    assert [x["entry"] for x in r] == ["m1", "m1", "m2"] and r[0]["overdue"]
    assert deadlines.collector_contact_check("2026-06-01", "2026-06-09")["ok"] is False
    assert deadlines.collector_contact_check("2026-06-01", "2026-06-15")["ok"] is True
    assert deadlines.collector_contact_check("", "2026-06-15")["ok"] is False


def test_ics():
    text = deadlines.ics([{"uid": "x@e", "date": "2026-12-02", "title": "TransUnion must answer, dispute 1", "description": "a;b,c"}], "20261020T000000Z")
    assert text.startswith("BEGIN:VCALENDAR\r\n") and "DTSTART;VALUE=DATE:20261202" in text and "DTEND;VALUE=DATE:20261203" in text
    assert "a\\;b\\,c" in text and text.endswith("END:VCALENDAR\r\n")
    assert all(len(line.encode()) <= 75 for line in text.split("\r\n"))


def test_plan_default_follows_the_playbook(planted):
    fs = findings.find(planted, {"as_of": AS_OF})
    p = strategy.plan(planted, fs, {}, "standard", AS_OF)
    assert [ph["id"] for ph in p["phases"]] == ["baseline", "quick", "round1", "parallel", "results", "round2", "escalate", "decide"]
    r1 = p["phases"][2]["steps"]
    assert r1[0]["kind"] == "answers" and len(r1[0]["findings"]) == 8  # three name variants wait for the person without a profile
    assert r1[1]["letter"] == "personal_info"
    assert p["next_action"]["kind"] == "answers"
    orders = [s["order"] for ph in p["phases"] for s in ph["steps"]]
    assert orders == list(range(1, len(orders) + 1))
    par = p["phases"][3]["steps"]
    assert any(s["letter"] == "furnisher_623" for s in par)
    # collections with no reporting error found yet (their open question is about the collector's conduct)
    assert [x["name"] for x in p["candidates"]["pay_for_delete"]] == ["SAMPLE ASSET RECOVERY", "EXAMPLE DEBT BUYERS LLC"]
    notes = {n["text"].split(" ")[0] for n in p["notes"]}
    assert "PAYLATER" in notes and "EXAMPLE" in notes


def test_auto_loan_mode(planted):
    fs = findings.find(planted, {"as_of": AS_OF})
    cards = [{"id": "c1", "name": "Card A", "limit": 500000, "balance": 260000, "statement_day": 12},
             {"id": "c2", "name": "Card B", "limit": 100000, "balance": 20000, "statement_day": 28}]
    std = strategy.plan(planted, fs, {}, "standard", AS_OF)
    p = strategy.plan(planted, fs, {}, "auto_soon", AS_OF, cards=cards, scores=[{"model": "FICO 8", "score": 640, "date": "2026-10-01"}])
    first = p["phases"][0]
    titles = [s["title"] for s in first["steps"]]
    assert first["id"] == "auto"
    assert titles[0].startswith("Answer") and titles[1].startswith("Pay card balances down")
    i_doc = [i for i, t in enumerate(titles) if t.startswith("Document-backed")]
    i_rest = [titles.index(t) for t in ("No new accounts and no closing cards until the loan closes", "Keep auto or mortgage rate shopping inside 14 days",
                                         "Know which scores lenders commonly use", "Pre-application checklist")]
    assert i_doc and max(i_doc) < min(i_rest) and i_rest == sorted(i_rest)
    assert "commonly" in first["steps"][i_rest[2]]["why"] and "credit union" in first["steps"][i_rest[3]]["why"]
    assert all(s.get("moved_from") for s in first["steps"] if s["title"].startswith("Document-backed"))
    std_titles = [s["title"] for ph in std["phases"] for s in ph["steps"]]
    assert len([t for ph in p["phases"] for s in ph["steps"] for t in [s["title"]] if t in std_titles]) >= len(std_titles) - len(i_doc) - 1
    ex = p["expect"]
    assert ex["scores"][0]["score"] == 640 and any("No one can promise" in x for x in ex["lines"])
    for sc in ex["ranges"]["scenarios"]:
        for band in sc["families"].values():
            assert band["low"] <= band["high"]
    assert p["utilization"]["overall_after"] <= 10


def test_utilization_and_azeo():
    cards = [{"id": "a", "name": "A", "limit": 500000, "balance": 260000, "statement_day": 12},
             {"id": "b", "name": "B", "limit": 100000, "balance": 20000, "statement_day": 31}]
    u = strategy.utilization(cards, target_pct=30, as_of="2026-10-20")
    assert u["overall_before"] == 47 and u["overall_after"] == 28
    a = u["cards"][0]
    assert a["pay"] == 110000 and a["after"] == 150000 and a["statement_close"] == "2026-11-12" and a["pay_by"] == "2026-11-06"
    assert u["cards"][1]["pay"] == 0 and u["cards"][1]["statement_close"] == "2026-10-31" and u["cards"][1]["pay_by"] == "2026-10-28"
    t = strategy.utilization(cards, target_pct=10, as_of="2026-10-20", budget=100000)
    assert t["total_pay"] == 100000 and t["unmet"] > 0 and t["cards"][0]["pay"] == 100000
    z = strategy.utilization(cards, target_pct=10, azeo=True, as_of="2026-10-20")
    keep = [c for c in z["cards"] if c["keep"]]
    assert len(keep) == 1 and keep[0]["id"] == "a" and keep[0]["after"] == 5000 and z["cards"][1]["after"] == 0
    assert "community-observed" in z["notes"][1]
    with pytest.raises(CreditError):
        strategy.utilization(cards, target_pct=0)


def test_simulator_ranges_only(planted):
    fs = findings.find(planted, {"as_of": AS_OF})
    s = strategy.simulate(planted, fs, None, AS_OF)
    ids = [x["id"] for x in s["scenarios"]]
    assert "utilization" in ids and "au" in ids and "secured" in ids and sum(i.startswith("remove:") for i in ids) == 3
    for sc in s["scenarios"]:
        assert set(sc["families"]) == {"fico8", "fico9", "vantage4"}
        for b in sc["families"].values():
            assert b["low"] <= b["high"] and b["dir"] in ("up", "down", "flat", "mixed")
        assert sc["label"] and sc["cite"]
    assert "no scoring company publishes its model" in s["assumption"]


def test_sol_two_clocks():
    o = strategy.sol("TX", "open", "2021-03-15", "2021-01", "2026-10-20")
    assert o["years"] == 4 and o["sol_expires"] == "2025-03-15" and o["time_barred"] is True
    assert o["reporting_ends"] == "2028-07" and o["reportable"] is True
    assert any("restart" in w for w in o["warnings"]) and any("Verify" in w for w in o["warnings"])
    assert strategy.sol("NY", "open", "", "", "2026-10-20")["flag"].startswith("3 years for consumer credit")
    assert strategy.sol("MS", "written", "", "", "2026-10-20")["extinguished"]
    with pytest.raises(CreditError):
        strategy.sol("ZZ", "open", "")

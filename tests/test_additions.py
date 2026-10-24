"""The 605(c) date, the statute of limitations boundary, the Texas review window, the score
calibration, the savings estimate, the negotiation checklist, freeze clocks and the tradeline
helper that disputes every bureau reporting an item."""

import copy

import pytest

from conftest import AS_OF
from errata import deadlines, findings, rounds, strategy
from errata.util import CreditError


def test_605c_seven_years_plus_180_days():
    # a full date: 180 days, then 7 years
    assert strategy.reporting_limit("2018-03-10") == "2025-09-06"
    # a month only: the latest day of that month, so the date is never early
    assert strategy.reporting_limit("2018-03") == "2025-09-27"
    assert strategy.reporting_limit("2020-02") == "2027-08-27"
    with pytest.raises(CreditError):
        strategy.reporting_limit("soon")
    s = strategy.sol("TX", "open", "2021-03-15", "2018-03", "2025-09-27")
    assert s["reporting_ends_date"] == "2025-09-27" and s["reportable"] is True
    assert strategy.sol("TX", "open", "2021-03-15", "2018-03", "2025-09-28")["reportable"] is False


def test_sol_anniversary_is_not_yet_time_barred():
    assert strategy.sol("TX", "open", "2021-03-15", "", "2025-03-15")["time_barred"] is False
    assert strategy.sol("TX", "open", "2021-03-15", "", "2025-03-16")["time_barred"] is True
    assert strategy.sol("TX", "open", "2020-02-29", "", "2024-03-01")["sol_expires"] == "2024-02-29"


def test_oag_review_window():
    d = deadlines.oag_review_deadline("2026-10-01", "2026-10-06")
    assert (d["due"], d["rule"], d["from_receipt"], d["from_notice"]) == ("2026-11-05", "receipt", "2026-11-05", "2026-11-15")
    late = deadlines.oag_review_deadline("2026-09-01", "2026-10-10")
    assert (late["due"], late["rule"]) == ("2026-10-16", "notice")
    # notice + 45 is Sunday November 15: the safe date is that Sunday; the rule would allow Monday
    wk = deadlines.oag_review_deadline("2026-10-01", "2026-10-17")
    assert (wk["due"], wk["latest"], wk["rule"]) == ("2026-11-15", "2026-11-16", "notice")
    mon = deadlines.oag_review_deadline("2026-12-01", "2026-12-05")
    assert (mon["due"], mon["latest"]) == ("2027-01-04", "2027-01-04")
    with pytest.raises(CreditError):
        deadlines.oag_review_deadline("2026-10-06", "2026-10-01")


def test_freeze_clock_and_furnisher_notice_cite():
    ds = deadlines.mail_deadlines({"letter": "security_freeze", "delivered": "2026-11-25"})
    assert ds[0]["kind"] == "freeze_mail" and ds[0]["due"] == "2026-12-01"   # Thanksgiving and the weekend skipped
    b = deadlines.mail_deadlines({"letter": "bureau_611", "delivered": "2026-11-02"})
    assert [x["cite"] for x in b] == ["fcra611", "fcra611a2"]


def test_calibration_narrows_and_widens_honestly(planted):
    fs = findings.find(planted, {"as_of": AS_OF})
    cards = [{"id": "c1", "name": "Card A", "limit": 500000, "balance": 260000, "statement_day": 12}]
    sim = strategy.simulate(planted, fs, cards, AS_OF)
    base = next(s for s in sim["scenarios"] if s["id"] == "utilization")["families"]["fico8"]
    none = strategy.calibrate(sim, [])
    assert none["calibration"]["observations"] == 0
    scores = [{"model": "FICO 8", "score": 640, "date": "2026-08-01"}, {"model": "FICO 8", "score": 668, "date": "2026-09-01", "change": "utilization"}]
    cal = strategy.calibrate(sim, scores)
    u = next(s for s in cal["scenarios"] if s["id"] == "utilization")["families"]["fico8"]
    assert u["how"] == "narrowed" and base["low"] <= u["low"] <= 28 <= u["high"] <= base["high"] and (u["high"] - u["low"]) < (base["high"] - base["low"])
    assert u["now"]["score"] == 668 and u["now"]["low"] == 668 + u["low"]
    v = next(s for s in cal["scenarios"] if s["id"] == "utilization")["families"]["vantage4"]
    assert "how" not in v, "a FICO observation does not move the VantageScore band"
    big = strategy.calibrate(sim, [{"model": "FICO Score 8", "score": 600, "date": "2026-08-01"},
                                    {"model": "FICO Score 8", "score": 700, "date": "2026-09-01", "change": "utilization"}])
    w = next(s for s in big["scenarios"] if s["id"] == "utilization")["families"]["fico8"]
    assert w["how"] == "widened" and w["high"] >= 100 and w["low"] == base["low"]
    assert strategy.model_family("VantageScore 4.0") == "vantage4" and strategy.model_family("FICO 9") == "fico9" and strategy.model_family("Bankcard 8") == ""


def test_savings_uses_the_persons_rates():
    s = strategy.savings(2500000, 60, 1199, 649)
    assert s["now"]["payment"] > s["goal"]["payment"] and s["total_difference"] == s["now"]["interest"] - s["goal"]["interest"]
    assert strategy.savings(1200, 12, 0, 0)["now"]["payment"] == 100
    with pytest.raises(CreditError):
        strategy.savings(100, 0, 500, 400)
    with pytest.raises(CreditError):
        strategy.savings(100, 12, 9000, 400)


def test_negotiation_checklist_holds_payment_until_the_agreement_is_complete():
    c = strategy.negotiation_checklist({"kind": "pay_for_delete", "sent": "2026-10-01", "agreement": {"written": True}})
    assert not c["ready_to_pay"] and c["next"].startswith("Do not pay yet") and all(x["id"] != "rest" for x in c["items"])
    full = {k: True for k, _ in strategy.AGREEMENT_ITEMS}
    s = strategy.negotiation_checklist({"kind": "settlement", "sent": "2026-10-01", "agreement": full}, {"time_barred": True, "state_name": "Texas"})
    assert s["ready_to_pay"] and any("restart" in w for w in s["warnings"]) and any("taxable" in w for w in s["warnings"])
    g = strategy.negotiation_checklist({"kind": "goodwill"})
    assert g["items"] == [] and not g["ready_to_pay"] and g["next"] == "Send the goodwill letter."
    p = strategy.negotiation_checklist({"kind": "pay_for_delete", "agreement": full, "sent": "x", "paid": "2026-10-20"})
    assert "dispute it with the signed agreement" in p["next"]
    with pytest.raises(CreditError):
        strategy.negotiation_checklist({"kind": "cpn"})


def test_tradelines_dispute_each_bureau_with_its_own_findings(planted):
    ex = copy.deepcopy(planted)
    ex["bureau"] = "experian"
    for a in ex["accounts"]:
        a["id"] = "x" + a["id"]
    eq = copy.deepcopy(planted)
    eq["bureau"] = "equifax"
    for a in eq["accounts"]:
        a["id"] = "q" + a["id"]
    card = next(a for a in eq["accounts"] if a["name"] == "EXAMPLE SECURED CARD")
    card["history"] = [h for h in card["history"] if h["month"] < card["paid"][:7]]   # Equifax's copy is right
    fs = []
    for r in (planted, ex, eq):
        fs += findings.find(r, {"as_of": AS_OF})
    t = next(x for x in rounds.tradelines([planted, ex, eq], fs) if x["name"] == "EXAMPLE SECURED CARD")
    assert t["bureaus"] == ["transunion", "experian", "equifax"]
    gap = next(g for g in t["gaps"] if g["rule"] == "paid_then_late")
    assert gap["found"] == ["transunion", "experian"] and gap["not_found"] == ["equifax"]
    for b in t["bureaus"]:
        assert all(next(f for f in fs if f["id"] == i)["bureau"] == b for i in t["findings"][b])

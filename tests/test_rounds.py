"""Round compare (deleted, updated, new, reinserted) and the three-bureau compare (real differences
apart from reporting lag)."""

import copy

from errata import rounds


def test_round_diff(planted, round2):
    d = rounds.diff(planted, round2)
    assert d["counts"] == {"deleted": 3, "updated": 1, "unchanged": 11, "new": 0, "reinserted": 0}
    assert sorted(x["name"] for x in d["deleted"]) == ["EXAMPLE DEBT BUYERS LLC", "OLD EXAMPLE RETAIL", "SAMPLE ASSET RECOVERY"]
    up = d["updated"][0]
    assert up["name"] == "EXAMPLE SECURED CARD"
    fields = {c["field"]: (c["old"], c["new"]) for c in up["changes"]}
    assert fields["history 05/2024"] == ("30", "OK") and fields["history 07/2024"] == ("90", "OK")
    assert d["inquiries"]["new"] == [{"name": "NEW EXAMPLE AUTO LENDER", "date": "2026-11-20"}]
    assert "name:JORDAN Q. SAMPEL" in d["personal"]["removed"] and "phone:(123) 555-0101" in d["personal"]["removed"]
    assert d["personal"]["added"] == []


def test_reinsertion_from_earlier_rounds_and_notice(planted, round2):
    r3 = copy.deepcopy(planted)
    r3["source"]["report_date"] = "2027-01-05"
    d = rounds.diff(round2, r3, {"earlier": [planted]})
    assert len(d["reinserted"]) == 3 and len(d["findings"]) == 3
    f = d["findings"][0]
    assert f["rule"] == "reinserted" and f["legal"] == ["fcra611a5b"] and f["notice_due_if_reinserted_on"] == "2027-01-12"
    key = d["reinserted"][0]["key"]
    d2 = rounds.diff(round2, r3, {"earlier": [planted], "notices": {key: "2027-01-02"}})
    assert len(d2["reinserted"]) == 3 and len(d2["findings"]) == 2


def _as(r, bureau):
    x = copy.deepcopy(r)
    x["bureau"] = bureau
    return x


def test_three_bureau_compare_separates_timing(planted):
    tu = planted
    ex = _as(planted, "experian")
    eq = _as(planted, "equifax")
    card_ex = next(a for a in ex["accounts"] if a["name"] == "EXAMPLE CARD BANK")
    card_ex["updated"], card_ex["balance"] = "2026-09-09", 118000
    card_ex["history"] = card_ex["history"][:-1]
    mort_eq = next(a for a in eq["accounts"] if a["name"] == "SAMPLE MORTGAGE CO")
    mort_eq["balance"] = 19990000
    auto_ex = next(a for a in ex["accounts"] if a["name"] == "EXAMPLE CREDIT UNION")
    auto_ex["history"][3]["rating"] = "30"
    c = rounds.compare([tu, ex, eq])
    g = {x["name"]: x for x in c["groups"]}
    card = g["EXAMPLE CARD BANK"]
    bal = next(r for r in card["rows"] if r["field"] == "balance")
    assert bal["state"] == "timing" and card["differ"] == 0 and card["timing"] == 1
    mort = next(r for r in g["SAMPLE MORTGAGE CO"]["rows"] if r["field"] == "balance")
    assert mort["state"] == "differ" and mort["odd"] == ["equifax"]
    hist = next(r for r in g["EXAMPLE CREDIT UNION"]["rows"] if r["field"] == "history")
    assert hist["months"][0]["values"] == {"equifax": "OK", "experian": "30", "transunion": "OK"}
    assert c["differences"] == 2 and c["timing"] == 1
    fs = c["findings"]
    assert sorted((f["bureau"], f["subject"].split(" ")[0]) for f in fs) == [("equifax", "SAMPLE"), ("experian", "EXAMPLE")]
    assert all(f["rule"] == "cross_bureau_mismatch" and f["confidence"] == "high" for f in fs)
    assert "Equifax $199,900, Experian $212,400" in fs[0]["facts"][0]
    lone = rounds.compare([tu])
    assert lone["differences"] == 0 and all(x["rows"] == [] for x in lone["groups"])


def test_logged_deletion_counts_as_reinsertion_even_if_the_older_report_had_it(planted):
    from errata import rounds
    a = planted["accounts"][0]
    k = rounds.account_key(a)
    d = rounds.diff(planted, planted, {"deleted_keys": [k]})
    assert [x["name"] for x in d["reinserted"]] == [a["name"]] and not d["deleted"]
    assert d["findings"][0]["rule"] == "reinserted"

"""Every planted error is found by the right rule with the right legal basis; clean accounts and the
clean report produce nothing; answers and profile facts change findings the way they should."""

import copy

import make_fixtures as fx
from conftest import AS_OF
from errata import findings
from errata.law import CITATIONS

EXPECTED_BASIS = {
    "paid_then_late": {"fcra611", "fcra607b", "fcra623a1"},
    "max_delinquency_mismatch": {"fcra611", "fcra607b", "fcra623a1"},
    "skipped_step": {"fcra611", "fcra607b", "fcra623a1", "metro2_status"},
    "zero_terms_amounts_due": {"fcra611", "fcra607b", "fcra623a1"},
    "name_variant": {"fcra611", "fcra607b"},
    "address_malformed": {"fcra611", "fcra607b"},
    "address_variants": {"fcra611", "fcra607b"},
    "phone_invalid": {"fcra611", "fcra607b", "nanp"},
    "collector_reported_early": {"regf1006_30a", "regf1006_30a_c", "regf1006_34"},
    "obsolete": {"fcra605", "fcra605c", "fcra611"},
    "reaged": {"fcra623a5", "fcra605c", "fcra611"},
    "duplicate_debt": {"fcra611", "fcra607b", "fcra623a1", "metro2_status"},
    "sold_with_balance": {"fcra611", "fcra607b", "metro2_status"},
    "inquiry_no_account": {"fcra604f", "fcra611"},
}


def run(r, **ctx):
    ctx.setdefault("as_of", AS_OF)
    return findings.find(r, ctx)


def test_every_planted_error_is_found_with_its_basis(planted):
    fs = run(planted)
    for rule, subject in fx.PLANTED:
        hits = [f for f in fs if f["rule"] == rule and subject in f["subject"]]
        assert hits, f"{rule} not found for {subject}"
        for f in hits:
            assert set(f["legal"]) == EXPECTED_BASIS[rule], rule
            assert all(k in CITATIONS for k in f["legal"])
            assert f["evidence"] and (f["facts"] or f["confirm"]) and f["request"]


def test_no_false_positives(planted, clean):
    fs = run(planted)
    expected = {(r, s) for r, s in fx.PLANTED}
    for f in fs:
        assert any(f["rule"] == r and s in f["subject"] for r, s in expected), f"unexpected {f['rule']}: {f['subject']}"
    clean_ids = {a["id"] for a in planted["accounts"] if a["name"] in fx.CLEAN_ACCOUNTS}
    assert not [f for f in fs if f["account_id"] in clean_ids]
    assert run(clean) == []


def test_specific_evidence(planted):
    fs = {(f["rule"], f["subject"].split(" ")[0]): f for f in run(planted)}
    p = next(f for f in run(planted) if f["rule"] == "paid_then_late")
    assert "Date Paid of 03/15/2024" in p["facts"][0] and "90 days late in 07/2024" in p["facts"][0] and p["confidence"] == "high"
    m = next(f for f in run(planted) if f["rule"] == "max_delinquency_mismatch")
    assert "worst delinquency was 60 days" in m["facts"][0] and "shows 30 for 04/2022" in m["facts"][0]
    s = next(f for f in run(planted) if f["rule"] == "skipped_step")
    assert "08/2026 as current (OK) with $0 past due, then 60 days late in 09/2026" in s["facts"][0]
    z = next(f for f in run(planted) if f["rule"] == "zero_terms_amounts_due" and "PLA1" in f["subject"])
    assert "amounts due of $45 in 14 months" in z["facts"][0]
    rg = [f for f in run(planted) if f["rule"] == "reaged"]
    assert any("06/2030" in f["facts"][0] and "01/2021" in f["facts"][0] for f in rg)
    assert any("A debt sale does not restart" in f["facts"][0] for f in rg)
    ph = next(f for f in run(planted) if f["rule"] == "phone_invalid")
    assert "starts with 1" in ph["facts"][0] and ph["confidence"] == "high"
    assert fs  # noqa


def test_answers_change_findings(planted):
    fs = run(planted)
    q = next(f for f in fs if f["rule"] == "inquiry_no_account" and "EXAMPLE LENDING" in f["subject"])
    assert q["confidence"] == "needs_answer" and q["facts"] == [] and q["confirm"][0]["sentence"].startswith("I did not apply")
    key = q["confirm"][0]["key"]
    yes = run(planted, profile={"facts": {key: True}})
    q2 = next(f for f in yes if f["id"] == q["id"])
    assert q2["confidence"] == "high" and q2["facts"] == [q["confirm"][0]["sentence"]]
    no = run(planted, profile={"facts": {key: False}})
    assert not any(f["id"] == q["id"] for f in no)
    c = next(f for f in fs if f["rule"] == "collector_reported_early" and "TEST RECEIVABLES" in f["subject"])
    ck = c["confirm"][0]["key"]
    c2 = next(f for f in run(planted, profile={"facts": {ck: True}}) if f["id"] == c["id"])
    assert c2["confidence"] == "high" and c["confirm"][0]["sentence"] in c2["facts"]


def test_profile_rules(planted):
    prof = {"names": ["JORDAN QUINN SAMPLE", "JORDAN SAMPLE", "JORDAN Q SAMPLE"], "dob": "1980-01-02", "ssn_last4": "1111",
            "addresses": ["100 EXAMPLE AVE ANYTOWN, TX 75001-1234", "4 PLACEHOLDER CT FICTION CITY, TX 75002-4444"],
            "phones": ["(512) 555-0134"], "employers": ["EXAMPLE FREIGHT CO"], "facts": {}}
    fs = run(planted, profile=prof)
    rules = [f["rule"] for f in fs]
    assert rules.count("identity_mismatch") == 2
    assert {f["subject"] for f in fs if f["rule"] == "name_variant"} == {"JORDAN Q. SAMPEL", "JORDAN R. SAMPLE", "JORDON SAMPLE"}
    unknown = [f for f in fs if f["rule"] == "address_unknown"]
    assert len(unknown) == 3 and all(f["confidence"] == "needs_answer" for f in unknown)
    assert [f["subject"] for f in fs if f["rule"] == "employer_unknown"] == ["SAMPLE LOGISTICS INC"]
    assert [f["subject"] for f in fs if f["rule"] == "phone_unknown"] == ["(214) 555-0199"]


def test_not_mine_and_identity_theft_need_the_person(planted):
    a = next(x for x in planted["accounts"] if x["name"] == "EXAMPLE DEBT BUYERS LLC")
    assert not any(f["rule"] in ("not_mine", "identity_theft") for f in run(planted))
    fs = run(planted, profile={"facts": {"acct:" + a["id"] + ":not_mine": True}})
    assert [f["subject"] for f in fs if f["rule"] == "not_mine"] == ["EXAMPLE DEBT BUYERS LLC 8801****"]
    theft = {"facts": {"acct:" + a["id"] + ":identity_theft": True}}
    assert not any(f["rule"] == "identity_theft" for f in run(planted, profile=theft))
    theft["ftc_report"] = "EXAMPLE-12345"
    assert any(f["rule"] == "identity_theft" for f in run(planted, profile=theft))


def test_cares_bankruptcy_dispute_flag_medical(planted):
    r = copy.deepcopy(planted)
    s = next(x for x in r["accounts"] if x["name"] == "SAMPLE AUTO FINANCE")
    prof = {"accommodations": [{"account_id": s["id"], "start": "2022-03-01", "end": "2022-06-28"}], "facts": {"acct:" + s["id"] + ":accommodation": True}}
    c = [f for f in run(r, profile=prof) if f["rule"] == "cares_act"]
    assert len(c) == 1 and "30 days late in 04/2022" in c[0]["facts"][1]
    prof["accommodations"][0]["start"] = "2023-09-01"
    prof["accommodations"][0]["end"] = "2023-12-01"
    assert not [f for f in run(r, profile=prof) if f["rule"] == "cares_act"]
    # a single CARES-covered accommodation made during the period covers its own term, even past August 2023
    prof["accommodations"][0]["start"] = "2019-12-01"
    prof["accommodations"][0]["end"] = "2022-06-28"
    assert not [f for f in run(r, profile=prof) if f["rule"] == "cares_act"], "an accommodation made before January 31, 2020 is not covered"
    b = next(x for x in r["accounts"] if x["name"] == "MIDTOWN EXAMPLE CARD")
    b["remarks"].append("INCLUDED IN BANKRUPTCY")
    b["flags"].append("bankruptcy")
    bk = [f for f in run(r) if f["rule"] == "bankruptcy_balance"]
    # included but no discharge on record: a balance can be accurate during an open case, so it waits for the answer
    assert len(bk) == 1 and bk[0]["confidence"] == "needs_answer" and bk[0]["facts"] == []
    key = bk[0]["confirm"][0]["key"]
    yes = [f for f in run(r, profile={"facts": {key: True}}) if f["rule"] == "bankruptcy_balance"]
    assert yes[0]["confidence"] == "high" and "$2,310" in yes[0]["facts"][-1] and yes[0]["facts"][0] == bk[0]["confirm"][0]["sentence"]
    assert not [f for f in run(r, profile={"facts": {key: False}}) if f["rule"] == "bankruptcy_balance"]
    b["remarks"].append("DISCHARGED THROUGH BANKRUPTCY CHAPTER 7")
    d7 = [f for f in run(r) if f["rule"] == "bankruptcy_balance"]
    assert d7[0]["confidence"] == "high" and d7[0]["confirm"] == [] and "discharged in bankruptcy" in d7[0]["facts"][0]
    card = next(x for x in r["accounts"] if x["name"] == "EXAMPLE CARD BANK")
    d = [f for f in run(r, disputes=[{"kind": "furnisher", "account_id": card["id"], "delivered": "2026-08-01"}]) if f["rule"] == "dispute_flag_missing"]
    assert len(d) == 1 and set(d[0]["legal"]) == {"fcra623a3", "saunders", "metro2_ccc"}
    col = next(x for x in r["accounts"] if x["name"] == "SAMPLE ASSET RECOVERY")
    col["original_creditor"] = "EXAMPLE MEDICAL CENTER"
    col["flags"].append("medical")
    col["high_balance"] = 41000
    med = [f for f in run(r) if f["rule"] == "medical_policy"]
    assert len(med) == 1 and "under $500" in med[0]["facts"][0] and "less than a year after" not in med[0]["facts"][0]
    # the one-year wait runs from the delinquency, so it needs the delinquency date
    col["high_balance"] = 90000
    col["dofd"] = col["opened"][:7]
    med = [f for f in run(r) if f["rule"] == "medical_policy"]
    assert len(med) == 1 and "less than a year after the delinquency began" in med[0]["facts"][0]
    col["dofd"] = "2020-01"
    assert not [f for f in run(r) if f["rule"] == "medical_policy"]
    assert med[0]["legal"] == ["medical_policy", "fcra611"]


def test_obsolete_inquiry_and_missing_oc(planted):
    r = copy.deepcopy(planted)
    r["inquiries"][0]["dates"] = ["2024-01-02"]
    assert any(f["rule"] == "obsolete_inquiry" for f in run(r))
    c = next(x for x in r["accounts"] if x["kind"] == "collection")
    c["original_creditor"] = ""
    assert any(f["rule"] == "collection_missing_oc" for f in run(r))


def test_area_codes():
    from errata.findings import area_code_problem
    assert area_code_problem("123")
    assert area_code_problem("911")
    assert area_code_problem("544")
    assert area_code_problem("592")
    assert area_code_problem("373")
    assert not area_code_problem("512")
    assert not area_code_problem("808")
    assert not area_code_problem("806")
    assert not area_code_problem("726") and not area_code_problem("945")    # Texas overlays in service
    assert "not in service" in area_code_problem("221")                       # structurally fine, not assigned
    assert "personal communications" in area_code_problem("533")
    assert "premium" in area_code_problem("900")
    from errata import nanp
    import hashlib, json
    body = json.dumps(nanp.TABLE, sort_keys=True, separators=(",", ":"))
    assert hashlib.sha256(body.encode()).hexdigest() == nanp.TABLE_SHA256
    assert sum(1 for v in nanp.TABLE.values() if v[0] == "geographic") >= 400


def test_order_and_ids_are_stable(planted):
    a, b = run(planted), run(planted)
    assert [f["id"] for f in a] == [f["id"] for f in b]
    assert len({f["id"] for f in a}) == len(a)
    conf = [f["confidence"] for f in a]
    assert conf == sorted(conf, key=lambda c: findings.CONF_ORDER[c])


def test_name_variant_without_a_profile_waits_for_the_person(planted):
    fs = [f for f in run(planted) if f["rule"] == "name_variant"]
    assert fs and all(f["confidence"] == "needs_answer" and f["facts"] == [] for f in fs)
    f = fs[0]
    yes = next(x for x in run(planted, profile={"facts": {f["confirm"][0]["key"]: True}}) if x["id"] == f["id"])
    assert yes["facts"] == [f["confirm"][0]["sentence"]] and "is not a name I use" in yes["facts"][0]


def test_reaging_states_the_implied_date_and_its_strength(planted):
    rg = [f for f in run(planted) if f["rule"] == "reaged" and "MIDTOWN" in f["subject"]]
    assert rg and "seven years after" in rg[0]["facts"][0] and "months earlier" in rg[0]["facts"][0]
    assert not any("Latest lawful removal" in e["label"] for e in rg[0]["evidence"])


def test_texas_child_support_zero_months_delinquent(planted):
    r = copy.deepcopy(planted)
    a = next(x for x in r["accounts"] if "child_support" in x["flags"])
    a["history"][-1]["rating"] = "30"
    a["pay_status"] = "30 Days Past Due"
    assert not [f for f in run(r) if f["rule"] == "child_support_tx"], "outside Texas this rule does not apply"
    fs = [f for f in run(r, profile={"state": "TX", "facts": {}}) if f["rule"] == "child_support_tx"]
    assert len(fs) == 1 and fs[0]["confidence"] == "needs_answer" and fs[0]["facts"] == []
    assert set(fs[0]["legal"]) == {"tac55_102", "tfc231_114", "fcra611", "fcra607b"}
    key = fs[0]["confirm"][0]["key"]
    yes = [f for f in run(r, profile={"state": "TX", "facts": {key: True}}) if f["rule"] == "child_support_tx"]
    assert yes[0]["confidence"] == "high" and yes[0]["facts"][0].startswith("A court order set the amount")
    assert "zero months delinquent" in yes[0]["request"]
    assert not [f for f in run(r, profile={"state": "TX", "facts": {key: False}}) if f["rule"] == "child_support_tx"]
    a["history"][-1]["rating"] = "OK"
    a["pay_status"] = "Current"
    assert not [f for f in run(r, profile={"state": "TX", "facts": {key: True}}) if f["rule"] == "child_support_tx"]

"""Every findings rule, each with a small synthetic report that should trigger it (positive) and a
near twin that should not (negative). The twins differ in the one fact the rule depends on, so a rule
that fires too broadly or not at all fails here. Every person, lender and number is invented."""

import copy

import pytest

from errata import findings, rounds
from errata.findings import RULES
from errata.model import account_id, classify, new_account, new_report

AS_OF = "2026-10-20"


def acct(bureau="transunion", **kw):
    a = new_account()
    a.update({"name": "SAMPLE BANK", "number": "1234****", "opened": "2015-01-01", "account_type": "Revolving Account", "loan_type": "Credit Card",
              "pay_status": "Current Account", "balance": 0, "past_due": 0, "updated": "2026-09-01"})
    a.update(kw)
    a["id"] = account_id(bureau, a)
    a["kind"], a["flags"] = classify(a)
    return a


def hist(*pairs, pd=None):
    return [{"month": m, "rating": r, "bal": None, "past_due": pd, "due": None} for m, r in pairs]


def report(accounts=(), bureau="transunion", **personal):
    r = new_report(bureau)
    r["source"]["report_date"] = AS_OF
    r["accounts"] = list(accounts)
    r["personal"].update(personal)
    return r


def rules_of(r, profile=None, disputes=None):
    return {f["rule"] for f in findings.find(r, {"as_of": AS_OF, "profile": profile or {}, "disputes": disputes or []})}


CO = dict(pay_status="Charged Off", pay_status_adverse=True, balance=50000, past_due=50000)
COLL = dict(name="EXAMPLE COLLECTIONS LLC", account_type="Open Account", loan_type="Collection", pay_status="Collection", balance=40000, original_creditor="SAMPLE BANK")

# rule -> (positive report, negative report, profile for both, disputes for both)
CASES = {
    "paid_then_late": (report([acct(paid="2024-03-15", pay_status="Paid, Closed", history=hist(("2024-02", "OK"), ("2024-05", "30")))]),
                       report([acct(paid="2024-03-15", pay_status="Paid, Closed", history=hist(("2024-02", "30"), ("2024-05", "OK")))])),
    "max_delinquency_mismatch": (report([acct(max_delinquency={"text": "60 days in 03/2025", "days": 60, "entries": [{"month": "2025-03", "amount": None}]},
                                              history=hist(("2025-02", "OK"), ("2025-03", "30"), ("2025-04", "OK")))]),
                                 report([acct(max_delinquency={"text": "30 days in 03/2025", "days": 30, "entries": [{"month": "2025-03", "amount": None}]},
                                              history=hist(("2025-02", "OK"), ("2025-03", "30"), ("2025-04", "OK")))])),
    "skipped_step": (report([acct(history=hist(("2025-02", "OK"), ("2025-03", "90"), pd=0))]),
                     report([acct(history=hist(("2025-02", "60"), ("2025-03", "90"), pd=0))])),
    "zero_terms_amounts_due": (report([acct(terms={"text": "$0 per month", "amount": 0, "months": None, "frequency": ""},
                                            history=[{"month": "2025-03", "rating": "OK", "bal": 100, "past_due": 0, "due": 2500}])]),
                               report([acct(terms={"text": "$25 per month", "amount": 2500, "months": None, "frequency": ""},
                                            history=[{"month": "2025-03", "rating": "OK", "bal": 100, "past_due": 0, "due": 2500}])])),
    "closed_then_activity": (report([acct(closed="2024-06-10", history=[{"month": "2024-06", "rating": "OK", "bal": 0, "past_due": 0, "due": None},
                                                                          {"month": "2024-08", "rating": "30", "bal": 5000, "past_due": 2500, "due": None}])]),
                             report([acct(closed="2024-06-10", history=[{"month": "2024-06", "rating": "OK", "bal": 0, "past_due": 0, "due": None},
                                                                          {"month": "2024-08", "rating": "OK", "bal": 0, "past_due": 0, "due": None}])])),
    "status_vs_past_due": (report([acct(pay_status="Current Account", past_due=4500, balance=90000)]),
                           report([acct(pay_status="Current Account", past_due=0, balance=90000)])),
    "status_vs_latest_month": (report([acct(pay_status="Current Account", updated="2026-08-15", history=hist(("2026-07", "OK"), ("2026-08", "30")))]),
                               report([acct(pay_status="Current Account", updated="2026-08-15", history=hist(("2026-07", "30"), ("2026-08", "OK")))])),
    "missing_dofd": (report([acct(**CO)]), report([acct(**CO, removal="2031-04")])),
    "obsolete": (report([acct(**CO, removal="2026-05")]), report([acct(**CO, removal="2029-05")])),
    "obsolete_inquiry": (dict(report(), inquiries=[{"id": "q1", "name": "SAMPLE AUTO", "kind": "hard", "dates": ["2024-01-10"], "location": ""}]),
                         dict(report(), inquiries=[{"id": "q1", "name": "SAMPLE AUTO", "kind": "soft", "dates": ["2024-01-10"], "location": ""}])),
    "reaged": (report([acct(**CO, removal="2033-05", history=hist(("2024-01", "OK"), ("2024-02", "30"), ("2024-03", "60")))]),
               report([acct(**CO, removal="2031-02", history=hist(("2024-01", "OK"), ("2024-02", "30"), ("2024-03", "60")))])),
    "collection_missing_oc": (report([acct(**dict(COLL, original_creditor=""))]), report([acct(**COLL)])),
    "duplicate_debt": (report([acct(**CO), acct(**COLL)]), report([acct(**dict(CO, balance=0, past_due=0)), acct(**COLL)])),
    "sold_with_balance": (report([acct(pay_status="Transferred to another lender", balance=12000)]),
                          report([acct(pay_status="Transferred to another lender", balance=0)])),
    "collector_reported_early": (report([acct(**dict(COLL, opened="2026-05-01"))]), report([acct(**dict(COLL, opened="2024-05-01"))])),
    "medical_policy": (report([acct(**dict(COLL, name="SAMPLE MEDICAL RECOVERY", opened="2024-05-01", balance=30000))]),
                       report([acct(**dict(COLL, name="SAMPLE ASSET RECOVERY", opened="2024-05-01", balance=30000))])),
    "bankruptcy_balance": (report([acct(pay_status="Discharged in Bankruptcy Chapter 7", balance=20000)]),
                           report([acct(pay_status="Discharged in Bankruptcy Chapter 7", balance=0)])),
    "name_variant": (report(names=[{"name": "JORDAN SAMPLE", "kind": "primary"}, {"name": "JORDON SAMPLE", "kind": "aka"}]),
                     report(names=[{"name": "JORDAN SAMPLE", "kind": "primary"}, {"name": "JORDAN SAMPLE", "kind": "aka"}])),
    "address_malformed": (report(addresses=[{"text": "100 EXAMPLE AVE APT 100EXA ANYTOWN, TX 75001", "kind": "other"}]),
                          report(addresses=[{"text": "100 EXAMPLE AVE APT 2 ANYTOWN, TX 75001", "kind": "other"}])),
    "address_variants": (report(addresses=[{"text": "22 TEST RD APT 5 SAMPLEVILLE, OK 73001", "kind": "other"}, {"text": "22 TEST RD APT 55 SAMPLEVILLE, OK 73001", "kind": "other"}]),
                         report(addresses=[{"text": "22 TEST RD APT 5 SAMPLEVILLE, OK 73001", "kind": "other"}, {"text": "40 OTHER ST SAMPLEVILLE, OK 73001", "kind": "other"}])),
    "address_unknown": (report(addresses=[{"text": "9 ELSEWHERE LN FICTION, TX 75002", "kind": "other"}]),
                        report(addresses=[{"text": "100 EXAMPLE AVE ANYTOWN, TX 75001", "kind": "other"}]), {"addresses": ["100 EXAMPLE AVE ANYTOWN, TX 75001"]}),
    "phone_invalid": (report(phones=[{"number": "(123) 555-0101"}]), report(phones=[{"number": "(214) 555-0101"}])),
    "phone_variant": (report(phones=[{"number": "(214) 555-0199"}, {"number": "(512) 555-0199"}]), report(phones=[{"number": "(214) 555-0199"}, {"number": "(512) 555-0198"}])),
    "phone_unknown": (report(phones=[{"number": "(214) 555-0101"}]), report(phones=[{"number": "(512) 555-0134"}]), {"phones": ["512-555-0134"]}),
    "employer_unknown": (report(employers=[{"name": "FICTION FREIGHT", "occupation": "", "location": "", "verified": ""}]),
                         report(employers=[{"name": "EXAMPLE FREIGHT CO", "occupation": "", "location": "", "verified": ""}]), {"employers": ["EXAMPLE FREIGHT CO"]}),
    "identity_mismatch": (report(dob="1981-01-01"), report(dob="1980-01-01"), {"dob": "1980-01-01"}),
    "inquiry_no_account": (dict(report(), inquiries=[{"id": "q1", "name": "SAMPLE AUTO", "kind": "hard", "dates": ["2026-05-10"], "location": ""}]),
                           dict(report([acct(name="SAMPLE AUTO", opened="2026-05-20", account_type="Installment Account", loan_type="Auto Loan")]),
                                inquiries=[{"id": "q1", "name": "SAMPLE AUTO", "kind": "hard", "dates": ["2026-05-10"], "location": ""}])),
    "child_support_tx": (report([acct(name="TEXAS CHILD SUPPORT", account_type="Open Account", loan_type="Child Support", pay_status="Account 60 Days Past Due Date", balance=90000, past_due=30000)]),
                         report([acct(name="TEXAS CHILD SUPPORT", account_type="Open Account", loan_type="Child Support", pay_status="Current Account", balance=90000, past_due=0)])),
}


@pytest.mark.parametrize("rule", sorted(CASES))
def test_rule_positive_and_negative(rule):
    pos, neg, *rest = CASES[rule]
    profile = rest[0] if rest else {}
    assert rule in rules_of(copy.deepcopy(pos), profile), rule
    assert rule not in rules_of(copy.deepcopy(neg), profile), rule


def test_rules_that_need_the_persons_answer():
    # CARES Act: the accommodation the person confirms, inside the covered period
    a = acct(history=hist(("2020-03", "OK"), ("2020-05", "30"), ("2020-06", "60")))
    prof = {"accommodations": [{"account_id": a["id"], "start": "2020-04-01", "end": "2020-09-30"}], "facts": {"acct:" + a["id"] + ":accommodation": True}}
    assert "cares_act" in rules_of(report([a]), prof)
    assert "cares_act" not in rules_of(report([a]), dict(prof, facts={}))
    prof2 = dict(prof, accommodations=[{"account_id": a["id"], "start": "2019-10-01", "end": "2020-09-30"}])
    assert "cares_act" not in rules_of(report([a]), prof2)  # made before the covered period
    # not mine and identity theft only on the person's statement; 605B needs the FTC report number
    b = acct()
    assert "not_mine" in rules_of(report([b]), {"facts": {"acct:" + b["id"] + ":not_mine": True}})
    assert "not_mine" not in rules_of(report([b]))
    assert "identity_theft" in rules_of(report([b]), {"facts": {"acct:" + b["id"] + ":identity_theft": True}, "ftc_report": "123456789"})
    assert "identity_theft" not in rules_of(report([b]), {"facts": {"acct:" + b["id"] + ":identity_theft": True}})
    # dispute notation: a direct dispute delivered more than 30 days before the report, not marked disputed
    d = [{"kind": "furnisher", "account_id": b["id"], "delivered": "2026-08-01"}]
    assert "dispute_flag_missing" in rules_of(report([b]), disputes=d)
    marked = acct(pay_status="Current Account", remarks=["Account information disputed by consumer"])
    assert "dispute_flag_missing" not in rules_of(report([marked]), disputes=[{"kind": "furnisher", "account_id": marked["id"], "delivered": "2026-08-01"}])
    assert "dispute_flag_missing" not in rules_of(report([b]), disputes=[{"kind": "furnisher", "account_id": b["id"], "delivered": "2026-10-01"}])
    # a "no" answer silences a question rule
    c = acct(**dict(COLL, opened="2026-05-01"))
    key = "acct:" + c["id"] + ":no_contact_before_reporting"
    assert "collector_reported_early" not in rules_of(report([c]), {"facts": {key: False}})
    f = [x for x in findings.find(report([c]), {"as_of": AS_OF, "profile": {"facts": {key: True}}}) if x["rule"] == "collector_reported_early"][0]
    assert f["confidence"] == "high"


def test_cross_bureau_and_reinserted():
    tu = report([acct("transunion", balance=10000)], "transunion")
    ex_same = report([acct("experian", balance=10000)], "experian")
    ex_diff = report([acct("experian", balance=45000)], "experian")
    assert any(f["rule"] == "cross_bureau_mismatch" for f in rounds.compare([tu, ex_diff])["findings"])
    assert not any(f["rule"] == "cross_bureau_mismatch" for f in rounds.compare([tu, ex_same])["findings"])
    gone = acct(**COLL)
    r1, r2, r3 = report([gone]), report([]), report([copy.deepcopy(gone)])
    key = rounds.account_key(gone)
    assert any(f["rule"] == "reinserted" for f in rounds.diff(r2, r3, {"earlier": [r1]})["findings"])
    assert not any(f["rule"] == "reinserted" for f in rounds.diff(r2, r3, {"earlier": [r1], "notices": {key: "2026-09-01"}})["findings"])
    assert not any(f["rule"] == "reinserted" for f in rounds.diff(r1, r3)["findings"])


def test_every_rule_is_covered_here():
    covered = set(CASES) | {"cares_act", "not_mine", "identity_theft", "dispute_flag_missing", "cross_bureau_mismatch", "reinserted"}
    assert covered == set(RULES), set(RULES) ^ covered


def test_hand_entered_charge_off_is_checked_for_age():
    # regression: a charged-off account typed by hand (no payment grid) was never marked adverse, so
    # the 7-year, re-aging and missing-date rules skipped it
    from errata.intake import manual_report, parse_csv
    r = manual_report("experian", [{"name": "SAMPLE CARD", "number": "4111", "account_type": "Revolving Account", "pay_status": "Charged Off", "balance": "$500", "removal": "05/2026"}], AS_OF)
    assert "adverse" in r["accounts"][0]["flags"] and "obsolete" in rules_of(r)
    r = manual_report("experian", [{"name": "SAMPLE CARD", "number": "4111", "account_type": "Revolving Account", "pay_status": "Charged Off", "balance": "$500"}], AS_OF)
    assert "missing_dofd" in rules_of(r)
    r = manual_report("experian", [{"name": "SAMPLE CARD", "number": "4111", "account_type": "Revolving Account", "pay_status": "Current", "balance": "$500"}], AS_OF)
    assert "adverse" not in r["accounts"][0]["flags"]
    reps = parse_csv("bureau,name,number,type,status,balance,removal\nequifax,SAMPLE CARD,4111,Revolving,Charged Off,$500,05/2026\n", "", AS_OF)
    assert "obsolete" in rules_of(reps[0])

"""Adversarial tests for the honesty and privacy audit: every way a letter could say more than the
evidence or the person supports, or carry identifiers to the wrong recipient, is refused."""

import copy
import re

import pytest

from conftest import AS_OF, PROFILE
from errata import findings, letters
from errata.util import CreditError, long_date, us_date

FURNISHER_KINDS = sorted(letters.FURNISHER_LETTERS)


def fs_of(r, prof=None):
    return findings.find(r, {"as_of": AS_OF, "profile": prof or PROFILE})


def pick(fs, rule):
    return [f for f in fs if f["rule"] == rule][:1]


def acct(r, name):
    return next(a for a in r["accounts"] if a["name"] == name)


def full_profile():
    p = copy.deepcopy(PROFILE)
    p["facts"] = {letters.INTENT_KEY: True, letters.FRAUD_KEY: True}
    return p


@pytest.mark.parametrize("note", [
    "This account is not mine.",
    "I never opened this account.",
    "I did not open this account and I do not recognize the account.",
    "I am a victim of identity theft.",
    "My SSN is 123-45-6789.",
    "My SSN is 123 45 6789.",
    "Use 123456789 to find me.",
    "Under section 609 you must delete anything you cannot prove.",
    "FCRA 609 requires you to send the original signed contract.",
    "Please send the wet ink signature.",
    "Metro 2 law requires deletion of this account.",
    "Metro 2 compliance violation: delete it.",
    "You must delete this account within 24 hours.",
    "This dispute will force you to delete the item.",
    "I guarantee this is wrong.",
    "I will use my credit privacy number from now on.",
    "Please update my file to my new CPN.",
    "I will sue you if this stays.",
    "I am going to take legal action.",
    "See you in court.",
])
def test_bureau_letter_refuses_unsupported_notes(planted, note):
    fs = fs_of(planted)
    with pytest.raises(CreditError):
        letters.generate("bureau_611", planted, pick(fs, "paid_then_late"), PROFILE, AS_OF, {"note": note})


def test_a_plain_note_is_allowed_and_traced(planted):
    fs = fs_of(planted)
    L = letters.generate("bureau_611", planted, pick(fs, "paid_then_late"), PROFILE, AS_OF,
                         {"note": "I have my bank statements showing every payment and will send copies on request."})
    b = next(x for x in L["blocks"] if x["src"] == ["user:note"])
    assert b["asserts"] and letters.audit(L, pick(fs, "paid_then_late"), PROFILE) == []


@pytest.mark.parametrize("note", ["My date of birth is 01/01/1980.", "DOB 1/1/1980", "Born on January 1, 1980.",
                                  "My birthdate is 1980-01-01.", "SSN ending in 0000", "My SSN last four: 0000", "Social Security number on file."])
def test_furnisher_letters_never_carry_identifiers(planted, note):
    col = acct(planted, "SAMPLE ASSET RECOVERY")
    with pytest.raises(CreditError):
        letters.generate("validation_regf", planted, [], PROFILE, AS_OF, {"account_id": col["id"], "note": note})


def test_every_letter_to_a_furnisher_or_agency_leaves_out_dob_and_ssn(planted):
    prof = full_profile()
    fs = fs_of(planted, prof)
    col, card, auto = acct(planted, "SAMPLE ASSET RECOVERY"), acct(planted, "EXAMPLE SECURED CARD"), acct(planted, "SAMPLE AUTO FINANCE")
    log = {"id": "m1", "letter": "bureau_611", "to": "TransUnion", "delivered": "2026-09-01", "result_date": "2026-09-27", "outcome": "verified"}
    q = next(f for f in fs if f["rule"] == "inquiry_no_account")
    prof["facts"][q["confirm"][0]["key"]] = True
    fs = fs_of(planted, prof)
    q = next(f for f in fs if f["id"] == q["id"])
    cs = copy.deepcopy(planted)
    cs_acct = next(a for a in cs["accounts"] if "child_support" in a["flags"])
    cs_acct["history"][-1]["rating"] = "30"
    cs_prof = dict(prof, state="TX", facts=dict(prof["facts"], **{"acct:" + cs_acct["id"] + ":cs_court_plan": True}))
    cs_f = [f for f in findings.find(cs, {"as_of": AS_OF, "profile": cs_prof}) if f["rule"] == "child_support_tx"]
    cases = {
        "furnisher_623": (planted, pick(fs, "paid_then_late"), prof, {}),
        "dispute_notation": (planted, pick(fs, "paid_then_late"), prof, {"log": log}),
        "validation_regf": (planted, [], prof, {"account_id": col["id"], "notice_received": "2026-10-10"}),
        "cease_1692c": (planted, [], prof, {"account_id": col["id"]}),
        "written_only": (planted, [], prof, {"account_id": col["id"]}),
        "pay_for_delete": (planted, [], prof, {"account_id": col["id"], "offer": 30000}),
        "settlement": (planted, [], prof, {"account_id": col["id"], "offer": 30000}),
        "goodwill": (planted, [], prof, {"account_id": auto["id"]}),
        "inquiry_removal": (planted, [q], prof, {}),
        "intent_to_sue": (planted, pick(fs, "paid_then_late"), prof, {"logs": [log]}),
        "child_support_zero_delinquent": (cs, cs_f, cs_prof, {"case": "0000000000"}),
        "oag_review_request": (planted, [], prof, {"notice_date": "2026-10-01", "received": "2026-10-06", "reason": "The amount is wrong."}),
        "child_support_records": (planted, [], prof, {}),
    }
    assert set(cases) == set(FURNISHER_KINDS)
    forms = [prof["dob"], us_date(prof["dob"]), long_date(prof["dob"]), "1/1/1980"]
    for kind, (r, sel, p, opts) in cases.items():
        L = letters.generate(kind, r, sel, p, AS_OF, opts)
        text = letters.to_text(L)
        assert not re.search(r"date of birth|social security|\bSSN\b|\bDOB\b", text, re.I), kind
        assert not any(x in text for x in forms), kind
        assert "0000" not in text.replace("0000000000", ""), kind
        assert not [b for b in L["blocks"] if b["kind"] == "id" and "birth" in b["text"].lower()], kind


def test_bureau_letters_carry_only_dob_and_last_four(planted):
    fs = fs_of(planted)
    L = letters.generate("bureau_611", planted, pick(fs, "paid_then_late"), PROFILE, AS_OF)
    t = letters.to_text(L)
    assert "Date of birth: 01/01/1980" in t and "last four digits: 0000" in t
    assert not re.search(r"\b\d{3}-\d{2}-\d{4}\b", t)


def test_tampered_blocks_are_caught(planted):
    fs = fs_of(planted)
    sel = pick(fs, "paid_then_late")
    L = letters.generate("bureau_611", planted, sel, PROFILE, AS_OF)
    bad = copy.deepcopy(L)
    i = next(k for k, b in enumerate(bad["blocks"]) if b["src"] == ["finding:" + sel[0]["id"]] and b["asserts"])
    bad["blocks"][i]["text"] = bad["blocks"][i]["text"].replace("90 days", "120 days")
    assert any("does not match" in p for p in letters.audit(bad, sel, PROFILE))
    bad = copy.deepcopy(L)
    bad["blocks"].insert(3, {"kind": "p", "text": "The furnisher admitted the error by phone.", "src": ["template"], "asserts": True})
    assert any("without a source" in p for p in letters.audit(bad, sel, PROFILE))
    bad = copy.deepcopy(L)
    bad["blocks"].insert(3, {"kind": "p", "text": "These accounts are not mine.", "src": ["template"], "asserts": False})
    assert any("not yours" in p for p in letters.audit(bad, sel, PROFILE))
    bad = copy.deepcopy(L)
    bad["blocks"].insert(3, {"kind": "p", "text": "I confirmed this.", "src": ["fact:acct:x:not_mine"], "asserts": True})
    assert any("not confirmed" in p for p in letters.audit(bad, sel, PROFILE))
    q = next(f for f in fs if f["confidence"] == "needs_answer")
    bad = copy.deepcopy(L)
    bad["blocks"].insert(3, {"kind": "p", "text": "x", "src": ["finding:" + q["id"]], "asserts": True})
    assert any("needs your answer" in p for p in letters.audit(bad, sel + [q], PROFILE))
    bad = copy.deepcopy(L)
    bad["blocks"].insert(3, {"kind": "p", "text": "Ask Experian for my CPN.", "src": ["template"], "asserts": False})
    assert any("identity scheme" in p for p in letters.audit(bad, sel, PROFILE))


def test_no_template_in_any_letter_overreaches(planted):
    """Every template sentence of every letter type passes the audit's own overreach and threat rules."""
    prof = full_profile()
    fs = fs_of(planted, prof)
    sel = pick(fs, "paid_then_late")
    log = {"id": "m1", "letter": "bureau_611", "to": "TransUnion", "delivered": "2026-09-01", "result_date": "2026-09-27", "outcome": "verified"}
    col = acct(planted, "SAMPLE ASSET RECOVERY")
    for kind, f, opts in [("bureau_611", sel, {}), ("disclosure_609", [], {}), ("mov_611a7", sel, {"log": log}), ("obsolete_605", pick(fs, "obsolete"), {}),
                          ("validation_regf", [], {"account_id": col["id"]}), ("pay_for_delete", [], {"account_id": col["id"], "offer": 100}),
                          ("security_freeze", [], {}), ("fraud_alert", [], {}), ("cfpb_complaint", sel, {"logs": [log]}),
                          ("intent_to_sue", sel, {"logs": [log]}), ("small_claims_outline", sel, {"logs": [log]})]:
        L = letters.generate(kind, planted, f, prof, AS_OF, opts)
        for b in L["blocks"]:
            assert not letters.OVERREACH.search(b["text"]), (kind, b["text"])
            if kind != "intent_to_sue":
                assert not letters.THREAT.search(b["text"]), (kind, b["text"])


def test_609_is_a_disclosure_request_only(planted):
    L = letters.generate("disclosure_609", planted, [], PROFILE, AS_OF)
    t = letters.to_text(L)
    assert "It is not a dispute" in t
    assert not re.search(r"delete|remove|original contract|prove", t, re.I)


def test_intent_to_sue_needs_the_persons_confirmed_intent(planted):
    fs = fs_of(planted)
    log = {"id": "m1", "letter": "bureau_611", "to": "TransUnion", "delivered": "2026-09-01", "outcome": "verified"}
    with pytest.raises(CreditError) as e:
        letters.generate("intent_to_sue", planted, pick(fs, "paid_then_late"), PROFILE, AS_OF, {"logs": [log]})
    assert "Never threaten" in e.value.message
    prof = dict(PROFILE, facts={letters.INTENT_KEY: True})
    L = letters.generate("intent_to_sue", planted, pick(fs, "paid_then_late"), prof, AS_OF, {"logs": [log]})
    b = next(x for x in L["blocks"] if "I intend to pursue" in x["text"])
    assert b["src"] == ["fact:" + letters.INTENT_KEY] and b["asserts"]
    # the same threat in the person's own note is still refused in any other letter
    with pytest.raises(CreditError):
        letters.generate("bureau_611", planted, pick(fs, "paid_then_late"), prof, AS_OF, {"note": "I intend to sue."})


def test_identity_theft_and_fraud_alert_need_the_person(planted):
    fs = fs_of(planted)
    with pytest.raises(CreditError):
        letters.generate("block_605b", planted, pick(fs, "paid_then_late"), PROFILE, AS_OF)
    with pytest.raises(CreditError):
        letters.generate("fraud_alert", planted, [], PROFILE, AS_OF)
    L = letters.generate("fraud_alert", planted, [], dict(PROFILE, facts={letters.FRAUD_KEY: True}), AS_OF)
    assert any(b["src"] == ["fact:" + letters.FRAUD_KEY] for b in L["blocks"])


def test_reg_f_stop_collection_only_inside_the_validation_period(planted):
    col = acct(planted, "SAMPLE ASSET RECOVERY")
    inside = letters.to_text(letters.generate("validation_regf", planted, [], PROFILE, AS_OF, {"account_id": col["id"], "notice_received": "2026-10-01"}))
    assert "stop collection until you do" in inside
    late = letters.generate("validation_regf", planted, [], PROFILE, AS_OF, {"account_id": col["id"], "notice_received": "2026-07-01"})
    assert "stop collection" not in letters.to_text(late) and any("validation period" in w for w in late["warnings"])
    unknown = letters.generate("validation_regf", planted, [], PROFILE, AS_OF, {"account_id": col["id"]})
    assert "stop collection" not in letters.to_text(unknown)


def test_offers_never_acknowledge_the_debt(planted):
    col = acct(planted, "SAMPLE ASSET RECOVERY")
    for kind in ("pay_for_delete", "settlement"):
        L = letters.generate(kind, planted, [], PROFILE, AS_OF, {"account_id": col["id"], "offer": 25000})
        t = letters.to_text(L)
        assert "not an acknowledgment that I owe this debt" in t and "I will not pay before I have it" in t
        assert any("statute of limitations" in w for w in L["warnings"])


def test_personal_info_intro_claims_only_inaccuracy(planted):
    prof = dict(PROFILE, names=["JORDAN QUINN SAMPLE", "JORDAN SAMPLE"])
    fs = [f for f in fs_of(planted, prof) if f["group"] == "Personal information" and f["confidence"] != "needs_answer"][:3]
    t = letters.to_text(letters.generate("personal_info", planted, fs, prof, AS_OF))
    assert "not mine" not in t.lower()


def test_cpn_and_identity_change_paths_do_not_exist():
    for k, v in letters.LETTERS.items():
        assert not re.search(r"\bCPN\b|privacy number|segregat|new identity|\bEIN\b", k + " " + v["title"], re.I)

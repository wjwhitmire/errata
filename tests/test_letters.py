"""Letters: every type builds, every factual sentence traces to a finding, a log entry, the report or a
confirmed fact; privacy rules for DOB and SSN; refusals; DOCX and PDF output."""

import copy
import io
import re
import xml.dom.minidom
import zipfile

import pytest

from conftest import AS_OF, PROFILE
from errata import docs, findings, letters, rounds, strategy
from errata.util import CreditError


def fs_of(r, prof=None):
    return findings.find(r, {"as_of": AS_OF, "profile": prof or PROFILE})


def pick(fs, rule, sub=""):
    return [f for f in fs if f["rule"] == rule and sub in f["subject"]]


def acct(r, name):
    return next(a for a in r["accounts"] if a["name"] == name)


def check_trace(L, fs, prof):
    by = {f["id"]: f for f in fs}
    facts = prof.get("facts", {})
    for b in L["blocks"]:
        if not b["asserts"]:
            continue
        assert b["src"] and b["src"] != ["template"], b["text"]
        for s in b["src"]:
            kind, _, ref = s.partition(":")
            assert kind in ("finding", "fact", "profile", "user", "log", "report"), s
            if kind == "finding":
                assert ref in by and b["text"] in by[ref]["facts"]
            if kind == "fact":
                assert facts.get(ref) is True
    assert letters.audit(L, fs, prof) == []


def test_bureau_dispute_traces_every_claim(planted):
    fs = fs_of(planted)
    sel = pick(fs, "paid_then_late") + pick(fs, "skipped_step") + pick(fs, "zero_terms_amounts_due")
    L = letters.generate("bureau_611", planted, sel, PROFILE, AS_OF)
    check_trace(L, sel, PROFILE)
    text = letters.to_text(L)
    assert "TransUnion Consumer Solutions" in text and "P.O. Box 2000" in text and "file number 900000001" in text
    assert "Date of birth: 01/01/1980" in text and "last four digits: 0000" in text
    assert "1. EXAMPLE SECURED CARD, account 4000111122****" in text and "4. PAYLATER EXAMPLE INC, account PLB2****" in text
    for f in sel:
        for s in f["facts"]:
            assert s in text
    assert not re.search(r"\b\d{3}-\d{2}-\d{4}\b", text)


def test_furnisher_and_collector_letters_never_carry_dob_or_ssn(planted):
    fs = fs_of(planted)
    f = pick(fs, "paid_then_late")
    L = letters.generate("furnisher_623", planted, f, PROFILE, AS_OF)
    t = letters.to_text(L)
    assert "EXAMPLE SECURED CARD" in t and "1980" not in t and "0000" not in t.replace("75001-1234", "")
    assert not re.search(r"date of birth|social security", t, re.I)
    check_trace(L, f, PROFILE)
    c = acct(planted, "SAMPLE ASSET RECOVERY")
    for kind, opts in (("validation_regf", {}), ("cease_1692c", {}), ("written_only", {}), ("pay_for_delete", {"offer": 40000}),
                       ("settlement", {"offer": 50000}), ("goodwill", {"reason": "My payment was lost in a bank change."})):
        if kind == "goodwill":
            a = acct(planted, "SAMPLE AUTO FINANCE")
        else:
            a = c
        L = letters.generate(kind, planted, [], PROFILE, AS_OF, dict(opts, account_id=a["id"]))
        t = letters.to_text(L)
        assert not re.search(r"date of birth|social security", t, re.I), kind
        check_trace(L, [], PROFILE)
    pfd = letters.generate("pay_for_delete", planted, [], PROFILE, AS_OF, {"offer": 40000, "account_id": c["id"]})
    assert any("statute of limitations" in w for w in pfd["warnings"])
    assert "I will not pay before I have it." in letters.to_text(pfd)


def test_needs_answer_is_refused_until_confirmed(planted):
    fs = fs_of(planted)
    q = pick(fs, "inquiry_no_account", "EXAMPLE LENDING")
    with pytest.raises(CreditError) as e:
        letters.generate("inquiry_removal", planted, q, PROFILE, AS_OF)
    assert "Answer the question" in e.value.message
    prof = copy.deepcopy(PROFILE)
    prof["facts"][q[0]["confirm"][0]["key"]] = True
    fs2 = fs_of(planted, prof)
    q2 = [f for f in fs2 if f["id"] == q[0]["id"]]
    L = letters.generate("inquiry_removal", planted, q2, prof, AS_OF)
    assert L["recipient"]["name"] == "EXAMPLE LENDING CO" and "PO BOX 0011" in L["recipient"]["lines"][0]
    check_trace(L, q2, prof)
    assert "I did not apply for credit with EXAMPLE LENDING CO" in letters.to_text(L)


def test_collector_contact_letter_uses_the_confirmed_sentence(planted):
    fs = fs_of(planted)
    c = pick(fs, "collector_reported_early", "TEST RECEIVABLES")[0]
    prof = copy.deepcopy(PROFILE)
    prof["facts"][c["confirm"][0]["key"]] = True
    c2 = [f for f in fs_of(planted, prof) if f["id"] == c["id"]]
    L = letters.generate("validation_regf", planted, c2, prof, AS_OF)
    srcs = [b["src"] for b in L["blocks"] if b["text"] == c["confirm"][0]["sentence"]]
    assert srcs == [["fact:" + c["confirm"][0]["key"]]]
    assert "1006.30(a)(1)" in letters.to_text(L)
    check_trace(L, c2, prof)


def test_no_not_mine_or_theft_without_the_person(planted):
    fs = fs_of(planted)
    f = pick(fs, "paid_then_late")[0]
    bad = copy.deepcopy(f)
    bad["facts"] = ["This account is not mine."]
    L = letters.generate("bureau_611", planted, [f], PROFILE, AS_OF)
    L["blocks"].append({"kind": "p", "text": "This account is not mine.", "src": ["finding:" + f["id"]], "asserts": True})
    assert letters.audit(L, [f], PROFILE)
    L["blocks"][-1] = {"kind": "p", "text": "I am a victim of identity theft.", "src": ["user:x"], "asserts": True}
    assert any("identity theft" in p for p in letters.audit(L, [f], PROFILE))
    L["blocks"][-1] = {"kind": "p", "text": "My SSN is 123-45-6789.", "src": ["profile"], "asserts": True}
    assert any("full Social Security" in p for p in letters.audit(L, [f], PROFILE))
    L["blocks"][-1] = {"kind": "p", "text": "The balance is wrong.", "src": ["template"], "asserts": True}
    assert any("without a source" in p for p in letters.audit(L, [f], PROFILE))
    with pytest.raises(CreditError):
        letters.generate("block_605b", planted, [f], PROFILE, AS_OF)


def test_605b_needs_confirmed_theft_and_ftc_report(planted):
    a = acct(planted, "EXAMPLE DEBT BUYERS LLC")
    prof = copy.deepcopy(PROFILE)
    prof["facts"]["acct:" + a["id"] + ":identity_theft"] = True
    prof["ftc_report"] = "EXAMPLE-12345"
    theft = pick(fs_of(planted, prof), "identity_theft")
    with pytest.raises(CreditError) as e:
        letters.generate("block_605b", planted, theft, prof, AS_OF)
    assert "FTC" in e.value.message
    prof["facts"]["theft:confirmed"] = True
    L = letters.generate("block_605b", planted, theft, prof, AS_OF)
    t = letters.to_text(L)
    assert "four business days" in t and "EXAMPLE-12345" in t and any("18 U.S.C. 1001" in w for w in L["warnings"])
    check_trace(L, theft, prof)


def test_every_letter_type_builds(planted):
    fs = fs_of(planted)
    prof = copy.deepcopy(PROFILE)
    prof.setdefault("facts", {})[letters.INTENT_KEY] = True
    prof["facts"][letters.FRAUD_KEY] = True
    log = {"id": "m1", "letter": "bureau_611", "to": "TransUnion", "delivered": "2026-09-01", "result_date": "2026-09-27", "outcome": "verified"}
    a = acct(planted, "EXAMPLE SECURED CARD")
    built = {}
    cases = {
        "bureau_611": (pick(fs, "paid_then_late"), {}), "obsolete_605": (pick(fs, "obsolete"), {}),
        "personal_info": ([f for f in fs if f["group"] == "Personal information" and f["confidence"] != "needs_answer"][:5], {}),
        "disclosure_609": ([], {}), "mov_611a7": (pick(fs, "paid_then_late"), {"log": log}),
        "furnisher_623": (pick(fs, "paid_then_late"), {}), "dispute_notation": (pick(fs, "paid_then_late"), {"log": log}),
        "consumer_statement": ([], {"statement": "I dispute the late payments shown in 2024; the account was paid in March 2024."}),
        "cfpb_complaint": (pick(fs, "paid_then_late"), {"logs": [log]}), "state_ag_complaint": (pick(fs, "reaged"), {"logs": [log]}),
        "intent_to_sue": (pick(fs, "paid_then_late"), {"logs": [log], "harm": "I was offered a higher rate on 2026-09-29."}),
        "small_claims_outline": (pick(fs, "paid_then_late"), {"logs": [log]}),
        "bankruptcy_correction": (pick(fs, "skipped_step"), {}), "cares_act": (pick(fs, "max_delinquency_mismatch"), {}),
        "security_freeze": ([], {}), "fraud_alert": ([], {"phone": "(512) 555-0134"}),
        "oag_review_request": ([], {"notice_date": "2026-10-01", "received": "2026-10-06", "reason": "The notice lists arrears of $4,200; my payment record shows $1,350.",
                                    "case": "0000000000"}),
        "child_support_records": ([], {"case": "0000000000"}),
    }
    for kind, (sel, opts) in cases.items():
        L = letters.generate(kind, planted, sel, prof, AS_OF, opts)
        built[kind] = L
        check_trace(L, sel, prof)
        assert letters.to_text(L).strip()
    assert "This is a request for disclosure. It is not a dispute." in letters.to_text(built["disclosure_609"])
    assert "within 15 days" in letters.to_text(built["mov_611a7"])
    with pytest.raises(CreditError):
        letters.generate("cfpb_complaint", planted, pick(fs, "paid_then_late"), prof, AS_OF, {"logs": []})
    with pytest.raises(CreditError):
        letters.generate("consumer_statement", planted, [], prof, AS_OF, {"statement": "word " * 101})
    with pytest.raises(CreditError):
        letters.generate("bureau_611", planted, fs[:12], prof, AS_OF)
    with pytest.raises(CreditError):
        letters.generate("bureau_611", planted, pick(fs, "paid_then_late"), {"name": ""}, AS_OF)
    assert set(cases) | {"validation_regf", "cease_1692c", "written_only", "pay_for_delete", "settlement", "goodwill", "block_605b",
                         "inquiry_removal", "reinsertion_demand", "child_support_zero_delinquent"} == set(letters.LETTERS)
    assert a


def test_plan_letters_are_never_identical(planted):
    fs = fs_of(planted)
    p = strategy.plan(planted, fs, PROFILE, "standard", AS_OF)
    made = []
    for ph in p["phases"]:
        for s in ph["steps"]:
            if s["kind"] != "letter" or not s["findings"]:
                continue
            sel = [f for f in fs if f["id"] in s["findings"]]
            made.append(letters.generate(s["letter"], planted, sel, PROFILE, AS_OF, {"account_id": s["account_id"]}))
    assert len(made) >= 15
    assert letters.same_body(made) == []


def test_reinsertion_letter(planted, round2):
    r1 = planted
    gone = rounds.diff(r1, round2)["deleted"]
    back = copy.deepcopy(r1)
    back["source"]["report_date"] = "2027-01-05"
    d = rounds.diff(round2, back, {"deleted_keys": [g["key"] for g in gone]})
    f = d["findings"]
    assert len(f) == 3 and all(x["rule"] == "reinserted" for x in f)
    L = letters.generate("reinsertion_demand", back, f[:1], PROFILE, AS_OF)
    assert "5 business days" in letters.to_text(L)
    check_trace(L, f[:1], PROFILE)


def test_docx_and_pdf(planted):
    fs = fs_of(planted)
    L = letters.generate("bureau_611", planted, pick(fs, "paid_then_late"), PROFILE, AS_OF)
    data = docs.docx(L)
    z = zipfile.ZipFile(io.BytesIO(data))
    assert z.testzip() is None and sorted(z.namelist()) == ["[Content_Types].xml", "_rels/.rels", "word/document.xml"]
    doc = xml.dom.minidom.parseString(z.read("word/document.xml"))
    text = "".join(n.firstChild.data for n in doc.getElementsByTagName("w:t") if n.firstChild)
    assert "Date Paid of 03/15/2024" in text
    assert docs.docx(L) == data
    pdf = docs.letter_pdf(L)
    assert pdf.startswith(b"%PDF-1.4") and pdf.rstrip().endswith(b"%%EOF") and docs.letter_pdf(L) == pdf
    import tempfile
    from errata.pdftext import pdf_items
    with tempfile.NamedTemporaryFile(suffix=".pdf") as t:
        t.write(pdf)
        t.flush()
        words = " ".join(i["s"] for i in pdf_items(t.name))
    assert "Mailing cover sheet" in words and "Tracking number" in words and "$9.28" in words and "TransUnion Consumer Solutions" in words
    assert docs.crc32(b"123456789") == 0xCBF43926
    assert docs.text_width("Hi", False, 10) == (722 + 222) * 10
    assert "TransUnion" in docs.envelope_text(L)


def test_follow_up_after_a_missed_deadline_cites_the_log(planted):
    from errata import findings as F
    f = [x for x in F.find(planted, {"as_of": AS_OF}) if x["rule"] == "paid_then_late"]
    L = letters.generate("bureau_611", planted, f, PROFILE, AS_OF, {"prior": {"id": "m9", "delivered": "2026-08-05", "due": "2026-08-18"}})
    lines = [b for b in L["blocks"] if b["src"] == ["log:m9"]]
    assert [b["text"] for b in lines] == ["My earlier request was delivered to you on 08/05/2026.", "Your response was due by 08/18/2026, and I have not received it."]
    assert all(b["asserts"] for b in lines) and letters.audit(L, f, PROFILE) == []

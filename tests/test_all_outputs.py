"""Every letter type, built from the synthetic TransUnion report, passes the honesty audit and opens as
a Word file (a valid ZIP whose document XML parses and holds the letter's sentences) and as a PDF
(read back with pdfminer: the cover sheet, the recipient and the letter's first sentence are there)."""

import copy
import io
import tempfile
import xml.dom.minidom
import zipfile

from conftest import AS_OF, PROFILE
from errata import docs, findings, letters, rounds


def fs_of(r, prof):
    return findings.find(r, {"as_of": AS_OF, "profile": prof})


def pick(fs, rule):
    return [f for f in fs if f["rule"] == rule][:1]


def acct(r, name):
    return next(a for a in r["accounts"] if a["name"] == name)


def every_letter(planted, round2):
    prof = copy.deepcopy(PROFILE)
    prof["facts"] = {letters.INTENT_KEY: True, letters.FRAUD_KEY: True}
    fs = fs_of(planted, prof)
    q = next(f for f in fs if f["rule"] == "inquiry_no_account")
    prof["facts"][q["confirm"][0]["key"]] = True
    col, auto, card = acct(planted, "SAMPLE ASSET RECOVERY"), acct(planted, "SAMPLE AUTO FINANCE"), acct(planted, "EXAMPLE SECURED CARD")
    theft = dict(prof, ftc_report="123456789", facts=dict(prof["facts"], **{"acct:" + card["id"] + ":identity_theft": True, "theft:confirmed": True}))
    fs = fs_of(planted, prof)
    q = next(f for f in fs if f["id"] == q["id"])
    tf = [f for f in fs_of(planted, theft) if f["rule"] == "identity_theft"]
    log = {"id": "m1", "letter": "bureau_611", "to": "TransUnion", "delivered": "2026-09-01", "result_date": "2026-09-27", "outcome": "verified"}
    cs = copy.deepcopy(planted)
    cs_acct = next(a for a in cs["accounts"] if "child_support" in a["flags"])
    cs_acct["history"][-1]["rating"] = "30"
    cs_prof = dict(prof, state="TX", facts=dict(prof["facts"], **{"acct:" + cs_acct["id"] + ":cs_court_plan": True}))
    cs_f = [f for f in findings.find(cs, {"as_of": AS_OF, "profile": cs_prof}) if f["rule"] == "child_support_tx"]
    gone = rounds.diff(planted, round2)["deleted"]
    back = copy.deepcopy(planted)
    back["source"]["report_date"] = "2027-01-05"
    rein = rounds.diff(round2, back, {"deleted_keys": [g["key"] for g in gone]})["findings"][:1]
    personal = [f for f in fs if f["group"] == "Personal information" and f["confidence"] != "needs_answer"][:5]
    return {
        "bureau_611": (planted, pick(fs, "paid_then_late"), prof, {}), "obsolete_605": (planted, pick(fs, "obsolete"), prof, {}),
        "personal_info": (planted, personal, prof, {}), "disclosure_609": (planted, [], prof, {}),
        "mov_611a7": (planted, pick(fs, "paid_then_late"), prof, {"log": log}), "furnisher_623": (planted, pick(fs, "paid_then_late"), prof, {}),
        "dispute_notation": (planted, pick(fs, "paid_then_late"), prof, {"log": log}),
        "consumer_statement": (planted, [], prof, {"statement": "The late payments in 2024 came after the account was paid."}),
        "cfpb_complaint": (planted, pick(fs, "paid_then_late"), prof, {"logs": [log]}), "state_ag_complaint": (planted, pick(fs, "reaged"), prof, {"logs": [log]}),
        "intent_to_sue": (planted, pick(fs, "paid_then_late"), prof, {"logs": [log], "harm": "I was offered a higher rate on 2026-09-29."}),
        "small_claims_outline": (planted, pick(fs, "paid_then_late"), prof, {"logs": [log]}),
        "bankruptcy_correction": (planted, pick(fs, "skipped_step"), prof, {}), "cares_act": (planted, pick(fs, "max_delinquency_mismatch"), prof, {}),
        "security_freeze": (planted, [], prof, {}), "fraud_alert": (planted, [], prof, {"phone": "(512) 555-0134"}),
        "oag_review_request": (planted, [], prof, {"notice_date": "2026-10-01", "received": "2026-10-06", "reason": "The amount is wrong.", "case": "0000000000"}),
        "child_support_records": (planted, [], prof, {"case": "0000000000"}),
        "validation_regf": (planted, [], prof, {"account_id": col["id"], "notice_received": "2026-10-10"}),
        "cease_1692c": (planted, [], prof, {"account_id": col["id"]}), "written_only": (planted, [], prof, {"account_id": col["id"]}),
        "pay_for_delete": (planted, [], prof, {"account_id": col["id"], "offer": 30000}), "settlement": (planted, [], prof, {"account_id": col["id"], "offer": 30000}),
        "goodwill": (planted, [], prof, {"account_id": auto["id"]}), "inquiry_removal": (planted, [q], prof, {}),
        "block_605b": (planted, tf, theft, {}), "reinsertion_demand": (back, rein, prof, {}),
        "child_support_zero_delinquent": (cs, cs_f, cs_prof, {"case": "0000000000"}),
    }


def test_every_letter_type_opens_as_docx_and_pdf(planted, round2):
    from pdfminer.high_level import extract_text
    cases = every_letter(planted, round2)
    assert set(cases) == set(letters.LETTERS)
    for kind, (r, sel, prof, opts) in cases.items():
        L = letters.generate(kind, r, sel, prof, AS_OF, opts)
        assert letters.audit(L, sel, prof) == [], kind
        z = zipfile.ZipFile(io.BytesIO(docs.docx(L)))
        assert z.testzip() is None, kind
        dom = xml.dom.minidom.parseString(z.read("word/document.xml"))
        words = "".join(n.firstChild.data for n in dom.getElementsByTagName("w:t") if n.firstChild)
        first = next(b["text"] for b in L["blocks"] if b["kind"] == "p")
        assert first[:40] in words, kind
        pdf = docs.letter_pdf(L)
        with tempfile.NamedTemporaryFile(suffix=".pdf") as t:
            t.write(pdf)
            t.flush()
            text = " ".join(extract_text(t.name).split())
        assert "Mailing cover sheet" in text and " ".join(first.split()[:6]) in text, kind
        if L["recipient"]["name"]:
            assert " ".join(L["recipient"]["name"].split()[:2]) in text, kind

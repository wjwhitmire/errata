"""Write tests/vectors.json (reference cases from the Python library for the browser core) and
web/src/core/90_tables.js (the legal tables, rules, playbook and letter catalog the browser uses).

Run: python tests/make_vectors.py   (needs pdfminer.six to read the fixture PDFs)
"""

import copy
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "tests" / "fixtures"))
sys.path.insert(0, str(ROOT / "tests"))

from errata import deadlines, docs, findings, law, letters, rounds, strategy, tu, util  # noqa: E402
from errata.brand import PRODUCT_NAME  # noqa: E402
from errata.pdftext import pdf_items  # noqa: E402

AS_OF = "2026-10-20"
PROFILE = {"name": "Jordan Sample", "mailing": ["100 Example Ave", "Anytown, TX 75001-1234"], "dob": "1980-01-01", "ssn_last4": "0000", "facts": {}}


def tables():
    t = law.tables()
    t["rules"] = findings.RULES
    t["playbook"] = strategy.PLAYBOOK
    t["goals"] = strategy.GOALS
    t["letters"] = letters.LETTERS
    t["ladder"] = deadlines.LADDER
    t["letter_clocks"] = deadlines.LETTER_CLOCKS
    return t


def write_tables():
    text = ("// Written by tests/make_vectors.py from the Python library (src/errata/law.py and friends). Do not edit by hand.\n"
            "// Every legal value carries its source URL; see the README's sources table.\n"
            "const TABLES = " + json.dumps(tables(), indent=1, sort_keys=True, ensure_ascii=False) + ";\n")
    (ROOT / "web" / "src" / "core" / "90_tables.js").write_text(text, encoding="utf-8")


def sha(b):
    return hashlib.sha256(b).hexdigest()


def main():
    write_tables()
    fx = {}
    for name in ("planted", "clean", "round2"):
        fx[name + "_items"] = pdf_items(str(ROOT / "tests" / "fixtures" / f"tu_{name}.pdf"))
        fx[name] = tu.parse(fx[name + "_items"])
    from errata import generic, parse_items, detect_bureau
    for name in ("ex", "eq"):
        fx[name + "_items"] = pdf_items(str(ROOT / "tests" / "fixtures" / f"{name}_planted.pdf"))
        fx[name] = generic.parse(fx[name + "_items"])
    cases = []

    def case(fn, args, out):
        cases.append({"fn": fn, "args": json.loads(json.dumps(args)), "out": json.loads(json.dumps(out))})

    def err(fn, args, f):
        try:
            f()
        except util.CreditError as e:
            cases.append({"fn": fn, "args": json.loads(json.dumps(args)), "error": e.code, "message": e.message})
            return
        raise AssertionError("expected an error for " + fn)

    for s in ["$1,234", "$0", "---", ".00000", "$1,2X0", "-$5.5", "(12.34)", "", None, "$000000000.00"]:
        case("parse_money", [s], util.parse_money(s))
    for s in ["10/23/2026", "02/30/2026", "2026-02-26", "x", "1/2/2026"]:
        case("parse_date", [s], util.parse_date(s))
    for s in ["05/2031", "Sep 2025", "13/2020", "2026-01", "10/23/2026"]:
        case("parse_month", [s], util.parse_month(s))
    for c in [0, 5, 123456, -99, 100000000]:
        case("money_text", [c, False], util.money_text(c))
        case("money_text", [c, True], util.money_text(c, True))
    for y in (2021, 2022, 2026, 2027, 2028):
        case("holidays", [y], util.holidays(y))
    for d, n in (("2026-11-25", 1), ("2026-12-23", 3), ("2026-07-02", 2), ("2027-12-30", 5)):
        case("add_business_days", [d, n], util.add_business_days(d, n))
    for s in ["", "abc", "Ledger", "SAMPEL"]:
        case("stable_hash", [s], util.stable_hash(s))
    case("edit_distance", ["SAMPEL", "SAMPLE"], util.edit_distance("SAMPEL", "SAMPLE"))
    case("norm_name", ["Jordan Q. Sampel, Jr."], util.norm_name("Jordan Q. Sampel, Jr."))
    for a, b in (("NORTHWIND BANK N A", "NORTHWIND BANK"), ("WESTFIELD ONE", "NORTHWIND ONE BANK N A"), ("NORTHWIND EXAMPLE BANK", "MIDTOWN EXAMPLE CARD")):
        case("names_match", [a, b], findings.names_match(a, b))
    for npa in ("123", "911", "544", "592", "373", "512", "221", "726", "533", "900", "600", "800", "242"):
        case("area_code_problem", [npa, "555"], findings.area_code_problem(npa, "555"))
    case("name_problem", ["JORDAN R. SAMPLE", ["JORDAN QUINN SAMPLE", "JORDAN SAMPLE"]], findings.name_problem("JORDAN R. SAMPLE", ["JORDAN QUINN SAMPLE", "JORDAN SAMPLE"]))

    # parsing
    for name in ("planted", "clean", "round2"):
        case("tu_parse", [{"$fx": name + "_items"}, ""], fx[name])
    for name in ("ex", "eq"):
        case("generic_parse", [{"$fx": name + "_items"}, ""], fx[name])
        case("parse_items", [{"$fx": name + "_items"}, ""], parse_items(fx[name + "_items"]))
        case("detect_bureau", [{"$fx": name + "_items"}], detect_bureau(fx[name + "_items"]))
        case("find", [{"$fx": name}, {"as_of": AS_OF}], findings.find(fx[name], {"as_of": AS_OF}))
    case("detect_bureau", [{"$fx": "clean_items"}], detect_bureau(fx["clean_items"]))
    from errata import htmltext
    for name in ("tu_saved", "ex_saved"):
        fx[name + "_lines"] = htmltext.html_lines((ROOT / "tests" / "fixtures" / f"{name}.html").read_text(encoding="utf-8"))
        case("items_from_lines", [{"$fx": name + "_lines"}], htmltext.items_from_lines(fx[name + "_lines"]))
        case("detect_html", [{"$fx": name + "_lines"}], htmltext.detect_html(fx[name + "_lines"]))
        case("parse_html_lines", [{"$fx": name + "_lines"}, "", ""], htmltext.parse_lines(fx[name + "_lines"]))
        rh = htmltext.parse_lines(fx[name + "_lines"])
        case("find", [rh, {"as_of": AS_OF}], findings.find(rh, {"as_of": AS_OF}))
    for t in ["$185 per month, paid Monthly for 120 months", "120 Months", "$185 / 120 Months", "60 mo.", "72 Month(s)", "120", "$350 Monthly", "$1,200", "Revolving", "Bi-Weekly", "$410 /mo"]:
        case("parse_terms", [t], tu.parse_terms(t))
    case("make_lines", [fx["clean_items"][:60]], tu.make_lines(fx["clean_items"][:60]))

    # findings with several contexts
    p = fx["planted"]
    q = next(f for f in findings.find(p, {"as_of": AS_OF}) if f["rule"] == "inquiry_no_account")
    card = next(a for a in p["accounts"] if a["name"] == "EXAMPLE CARD BANK")
    auto = next(a for a in p["accounts"] if a["name"] == "SAMPLE AUTO FINANCE")
    ctxs = [
        {"as_of": AS_OF},
        {"as_of": AS_OF, "profile": {"facts": {q["confirm"][0]["key"]: True}}},
        {"as_of": AS_OF, "profile": {"facts": {q["confirm"][0]["key"]: False}}},
        {"as_of": AS_OF, "profile": {"names": ["JORDAN QUINN SAMPLE", "JORDAN SAMPLE"], "dob": "1980-01-02", "ssn_last4": "1111",
                                     "addresses": ["100 EXAMPLE AVE ANYTOWN, TX 75001-1234"], "phones": ["(512) 555-0134"],
                                     "employers": ["EXAMPLE FREIGHT CO"], "facts": {},
                                     "accommodations": [{"account_id": auto["id"], "start": "2022-03-01", "end": "2022-06-28"}]}},
        {"as_of": "2026-12-01", "disputes": [{"kind": "furnisher", "account_id": card["id"], "delivered": "2026-08-01"}]},
    ]
    ctxs[3]["profile"]["facts"]["acct:" + auto["id"] + ":accommodation"] = True
    cs_acct = next(a for a in p["accounts"] if "child_support" in a["flags"])
    ctxs.append({"as_of": AS_OF, "profile": {"state": "TX", "facts": {}}})
    ctxs.append({"as_of": AS_OF, "profile": {"state": "TX", "facts": {"acct:" + cs_acct["id"] + ":cs_court_plan": True}}})
    nv = next(f for f in findings.find(p, {"as_of": AS_OF}) if f["rule"] == "name_variant")
    ctxs.append({"as_of": AS_OF, "profile": {"facts": {nv["confirm"][0]["key"]: True}}})
    ctxs.append({"as_of": AS_OF, "profile": {"facts": {"acct:" + auto["id"] + ":accommodation": True},
                                             "accommodations": [{"account_id": auto["id"], "start": "2019-12-01", "end": "2022-06-28"}]}})
    for c in ctxs:
        case("find", [{"$fx": "planted"}, c], findings.find(p, c))
    case("find", [{"$fx": "clean"}, {"as_of": AS_OF}], findings.find(fx["clean"], {"as_of": AS_OF}))
    bk = copy.deepcopy(p)
    mid = next(a for a in bk["accounts"] if a["name"] == "MIDTOWN EXAMPLE CARD")
    mid["remarks"].append("INCLUDED IN BANKRUPTCY")
    mid["flags"].append("bankruptcy")
    for c in ({"as_of": AS_OF}, {"as_of": AS_OF, "profile": {"facts": {"bk:discharged": True}}}, {"as_of": AS_OF, "profile": {"facts": {"bk:discharged": False}}}):
        case("find", [bk, c], findings.find(bk, c))
    mid["remarks"].append("DISCHARGED THROUGH BANKRUPTCY CHAPTER 7")
    case("find", [bk, {"as_of": AS_OF}], findings.find(bk, {"as_of": AS_OF}))
    med = copy.deepcopy(p)
    mc = next(a for a in med["accounts"] if a["name"] == "SAMPLE ASSET RECOVERY")
    mc["flags"].append("medical")
    mc["high_balance"], mc["dofd"] = 90000, mc["opened"][:7]
    case("find", [med, {"as_of": AS_OF}], findings.find(med, {"as_of": AS_OF}))
    case("find", [{"$fx": "round2"}, {"as_of": "2026-12-01"}], findings.find(fx["round2"], {"as_of": "2026-12-01"}))
    fs = findings.find(p, {"as_of": AS_OF})

    # planner, utilization, ranges, SOL
    cards = [{"id": "c1", "name": "Card A", "limit": 500000, "balance": 260000, "statement_day": 12},
             {"id": "c2", "name": "Card B", "limit": 100000, "balance": 20000, "statement_day": 31},
             {"id": "c3", "name": "Card C", "limit": 0, "balance": 0, "statement_day": 5}]
    case("plan", [{"$fx": "planted"}, fs, PROFILE, "standard", AS_OF, [], []], strategy.plan(p, fs, PROFILE, "standard", AS_OF))
    scores = [{"model": "FICO 8", "score": 640, "date": "2026-10-01"}, {"model": "VantageScore 4.0", "score": 655, "date": "2026-09-01"}]
    case("plan", [{"$fx": "planted"}, fs, PROFILE, "auto_soon", AS_OF, cards, scores], strategy.plan(p, fs, PROFILE, "auto_soon", AS_OF, cards, scores))
    case("plan", [{"$fx": "clean"}, [], PROFILE, "auto_soon", AS_OF, [], []], strategy.plan(fx["clean"], [], PROFILE, "auto_soon", AS_OF))
    err("plan", [{"$fx": "clean"}, [], PROFILE, "nope", AS_OF, [], []], lambda: strategy.plan(fx["clean"], [], PROFILE, "nope", AS_OF))
    for budget, tgt, azeo, day in ((None, 30, False, "2026-10-20"), (100000, 10, False, "2026-10-20"), (None, 10, True, "2026-12-30"), (5000, 30, True, "2026-02-27")):
        case("utilization", [cards, budget, tgt, azeo, day], strategy.utilization(cards, budget, tgt, azeo, day))
    err("utilization", [cards, None, 0, False, AS_OF], lambda: strategy.utilization(cards, None, 0, False, AS_OF))
    case("simulate", [{"$fx": "planted"}, fs, [], AS_OF], strategy.simulate(p, fs, [], AS_OF))
    for args in (("TX", "open", "2021-03-15", "2021-01", AS_OF), ("NY", "written", "", "", AS_OF), ("RI", "oral", "2019-02-28", "2018-11", AS_OF),
                 ("TX", "open", "2021-03-15", "2018-03-10", "2025-03-15"), ("TX", "open", "2021-03-15", "2018-03", "2025-09-28")):
        case("sol", list(args), strategy.sol(*args))
    for d in ("2018-03-10", "2018-03", "2020-02", "2019-12-31"):
        case("reporting_limit", [d], strategy.reporting_limit(d))
    err("reporting_limit", ["soon"], lambda: strategy.reporting_limit("soon"))
    sim = strategy.simulate(p, fs, cards, AS_OF)
    case("simulate", [{"$fx": "planted"}, fs, cards, AS_OF], sim)
    for sc in ([], [{"model": "FICO 8", "score": 640, "date": "2026-08-01"}, {"model": "FICO 8", "score": 668, "date": "2026-09-01", "change": "utilization"},
                    {"model": "VantageScore 4.0", "score": 650, "date": "2026-08-02"}, {"model": "VantageScore 4.0", "score": 700, "date": "2026-09-02", "change": "utilization"},
                    {"model": "FICO 9", "score": 600, "date": "2026-07-01"}, {"model": "FICO 9", "score": 615, "date": "2026-10-01", "change": "collection_removed"}]):
        case("calibrate", [sim, sc], strategy.calibrate(sim, sc))
    for m in ("FICO 8", "FICO Score 9", "VantageScore 3.0", "Bankcard 8", "FICO"):
        case("model_family", [m], strategy.model_family(m))
    for args in ((2500000, 60, 1199, 649), (1200, 12, 0, 0), (30000000, 360, 725, 650), (999999, 37, 2999, 1)):
        case("savings", list(args), strategy.savings(*args))
    err("savings", [100, 0, 500, 400], lambda: strategy.savings(100, 0, 500, 400))
    full = {k: True for k, _ in strategy.AGREEMENT_ITEMS}
    for o, si in (({"kind": "pay_for_delete", "sent": "2026-10-01", "agreement": {"written": True}}, None),
                  ({"kind": "settlement", "sent": "2026-10-01", "agreement": full}, {"time_barred": True, "state_name": "Texas"}),
                  ({"kind": "goodwill"}, None), ({"kind": "goodwill", "sent": "x"}, None),
                  ({"kind": "pay_for_delete", "agreement": full, "sent": "x", "paid": "2026-10-20"}, None),
                  ({"kind": "pay_for_delete", "agreement": full, "sent": "x", "paid": "2026-10-20", "verified": True}, None),
                  ({"kind": "pay_for_delete"}, None)):
        case("negotiation_checklist", [o, si, AS_OF], strategy.negotiation_checklist(o, si, AS_OF))
    err("negotiation_checklist", [{"kind": "cpn"}, None, AS_OF], lambda: strategy.negotiation_checklist({"kind": "cpn"}))
    err("sol", ["ZZ", "open", "", "", AS_OF], lambda: strategy.sol("ZZ", "open", "", "", AS_OF))

    # deadlines
    for k, d in (("bureau_dispute", "2026-11-02"), ("bureau_dispute_extended", "2026-11-02"), ("mov", "2026-11-02"), ("block_605b", "2026-11-25"),
                 ("results_notice", "2026-12-24"), ("validation_period", "2026-11-30"), ("furnisher_direct", "2027-01-31")):
        case("deadline", [k, d], deadlines.deadline(k, d))
    err("deadline", ["bureau_dispute", "11/02/2026"], lambda: deadlines.deadline("bureau_dispute", "11/02/2026"))
    entries = [{"id": "m1", "letter": "bureau_611", "delivered": "2026-09-01"}, {"id": "m2", "letter": "mov_611a7", "delivered": "2026-10-10"},
               {"id": "m3", "letter": "furnisher_623", "delivered": "2026-10-01", "outcome": ""}, {"id": "m4", "letter": "bureau_611", "delivered": "2026-10-01", "outcome": "verified"},
               {"id": "m5", "letter": "cfpb_complaint", "outcome": "no_relief"}, {"id": "m6", "letter": "personal_info", "delivered": "2026-10-05", "after_free_report": True, "completed": "2026-10-30"}]
    for e in entries:
        case("mail_deadlines", [e], deadlines.mail_deadlines(e))
        case("next_step", [e, AS_OF], deadlines.next_step(e, AS_OF))
    case("reminders", [entries, AS_OF, 7], deadlines.reminders(entries, AS_OF, 7))
    case("validation_window", ["2026-11-20", ""], deadlines.validation_window("2026-11-20", ""))
    for n_, r_ in (("2026-10-01", "2026-10-06"), ("2026-09-01", "2026-10-10"), ("2026-10-01", "2026-10-17"), ("2026-12-01", "2026-12-05")):
        case("oag_review_deadline", [n_, r_], deadlines.oag_review_deadline(n_, r_))
    err("oag_review_deadline", ["2026-10-06", "2026-10-01"], lambda: deadlines.oag_review_deadline("2026-10-06", "2026-10-01"))
    for e in ({"id": "f1", "letter": "security_freeze", "delivered": "2026-11-25"}, {"id": "c1", "letter": "child_support_zero_delinquent", "delivered": "2026-10-01"}):
        case("mail_deadlines", [e], deadlines.mail_deadlines(e))
    case("collector_contact_check", ["2026-06-01", "2026-06-09"], deadlines.collector_contact_check("2026-06-01", "2026-06-09"))
    ev = [{"uid": "a@errata", "date": "2026-12-02", "title": "TransUnion must finish its reinvestigation, a long title that wraps past seventy five bytes",
           "description": "Dispute; delivered 11/02/2026, item 1"}]
    case("ics", [ev, "20261020T000000Z", ""], deadlines.ics(ev, "20261020T000000Z"))

    # letters (JSON, plain text, DOCX and PDF bytes as SHA-256)
    log = {"id": "m1", "letter": "bureau_611", "to": "TransUnion", "delivered": "2026-09-01", "result_date": "2026-09-27", "outcome": "verified"}

    def pick(rule):
        return [f for f in fs if f["rule"] == rule][:1]
    col = next(a for a in p["accounts"] if a["name"] == "SAMPLE ASSET RECOVERY")
    letter_cases = [
        ("bureau_611", pick("paid_then_late") + pick("skipped_step") + pick("zero_terms_amounts_due"), PROFILE, {}),
        ("personal_info", [f for f in fs if f["group"] == "Personal information" and f["confidence"] != "needs_answer"][:5], PROFILE, {}),
        ("obsolete_605", pick("obsolete"), PROFILE, {}),
        ("furnisher_623", pick("paid_then_late"), PROFILE, {}),
        ("mov_611a7", pick("paid_then_late"), PROFILE, {"log": log}),
        ("validation_regf", [], PROFILE, {"account_id": col["id"], "notice_received": "2026-07-01"}),
        ("pay_for_delete", [], PROFILE, {"account_id": col["id"], "offer": 40000}),
        ("goodwill", [], PROFILE, {"account_id": auto["id"], "reason": "A bank change delayed one payment."}),
        ("disclosure_609", [], PROFILE, {}),
        ("bureau_611", pick("paid_then_late"), PROFILE, {"prior": {"id": "m9", "delivered": "2026-08-05", "due": "2026-08-18", "what": "request for a description of how you verified the item"}}),
        ("cfpb_complaint", pick("reaged"), PROFILE, {"logs": [log], "harm": "A lender quoted a higher rate on 2026-09-29."}),
        ("small_claims_outline", pick("paid_then_late"), PROFILE, {"logs": [log]}),
        ("consumer_statement", [], PROFILE, {"statement": "The 2024 late entries on my secured card are wrong; it was paid in March 2024."}),
    ]
    prof_i = dict(PROFILE, facts={letters.INTENT_KEY: True, letters.FRAUD_KEY: True})
    cs = copy.deepcopy(p)
    csa = next(a for a in cs["accounts"] if "child_support" in a["flags"])
    cs_prof = dict(PROFILE, state="TX", facts={"acct:" + csa["id"] + ":cs_court_plan": True})
    cs_f = [f for f in findings.find(cs, {"as_of": AS_OF, "profile": cs_prof}) if f["rule"] == "child_support_tx"]
    letter_cases += [
        ("intent_to_sue", pick("paid_then_late"), prof_i, {"logs": [log], "harm": "A lender quoted a higher rate on 2026-09-29."}),
        ("security_freeze", [], PROFILE, {}), ("fraud_alert", [], prof_i, {"phone": "(512) 555-0134"}),
        ("oag_review_request", [], PROFILE, {"notice_date": "2026-10-01", "received": "2026-10-06", "reason": "The notice lists arrears of $4,200; my record shows $1,350.", "case": "0000000000", "review": "hearing"}),
        ("oag_review_request", [], PROFILE, {"notice_date": "2026-08-01", "received": "2026-08-06", "reason": "The amount is wrong."}),
        ("child_support_records", [], PROFILE, {"case": "0000000000"}),
        ("validation_regf", [], PROFILE, {"account_id": col["id"], "notice_received": "2026-10-15"}),
        ("validation_regf", [], PROFILE, {"account_id": col["id"]}),
        ("settlement", [], PROFILE, {"account_id": col["id"], "offer": 30000, "note": "I can pay this from a tax refund."}),
        ("reinsertion_demand", [], PROFILE, None),
    ]
    letter_cases = [c for c in letter_cases if c[3] is not None]
    case("generate_letter", ["child_support_zero_delinquent", cs, cs_f, cs_prof, AS_OF, {"case": "0000000000"}],
         letters.generate("child_support_zero_delinquent", cs, cs_f, cs_prof, AS_OF, {"case": "0000000000"}))
    err("generate_letter", ["intent_to_sue", {"$fx": "planted"}, pick("paid_then_late"), PROFILE, AS_OF, {"logs": [log]}],
        lambda: letters.generate("intent_to_sue", p, pick("paid_then_late"), PROFILE, AS_OF, {"logs": [log]}))
    err("generate_letter", ["fraud_alert", {"$fx": "planted"}, [], PROFILE, AS_OF, {}], lambda: letters.generate("fraud_alert", p, [], PROFILE, AS_OF, {}))
    for note in ("This account is not mine.", "Under section 609 you must delete it.", "My DOB is 01/01/1980.", "I will sue you.", "Use my CPN.", "Call 123456789."):
        err("generate_letter", ["goodwill", {"$fx": "planted"}, [], PROFILE, AS_OF, {"account_id": auto["id"], "note": note}],
            lambda: letters.generate("goodwill", p, [], PROFILE, AS_OF, {"account_id": auto["id"], "note": note}))
    for kind, sel, prof, opts in letter_cases:
        L = letters.generate(kind, p, sel, prof, AS_OF, opts)
        case("generate_letter", [kind, {"$fx": "planted"}, sel, prof, AS_OF, opts], L)
        case("letter_text", [L], letters.to_text(L))
        case("docx_sha", [L], sha(docs.docx(L)))
        case("letter_pdf_sha", [L, True, "9400 0000 0000 0000 0000 00"], sha(docs.letter_pdf(L, True, "9400 0000 0000 0000 0000 00")))
    qkey = q["confirm"][0]["key"]
    prof2 = dict(PROFILE, facts={qkey: True})
    fs2 = findings.find(p, {"as_of": AS_OF, "profile": prof2})
    q2 = [f for f in fs2 if f["id"] == q["id"]]
    case("generate_letter", ["inquiry_removal", {"$fx": "planted"}, q2, prof2, AS_OF, {}], letters.generate("inquiry_removal", p, q2, prof2, AS_OF))
    err("generate_letter", ["inquiry_removal", {"$fx": "planted"}, [q], PROFILE, AS_OF, {}], lambda: letters.generate("inquiry_removal", p, [q], PROFILE, AS_OF))
    err("generate_letter", ["block_605b", {"$fx": "planted"}, pick("paid_then_late"), PROFILE, AS_OF, {}],
        lambda: letters.generate("block_605b", p, pick("paid_then_late"), PROFILE, AS_OF))
    err("generate_letter", ["cfpb_complaint", {"$fx": "planted"}, pick("reaged"), PROFILE, AS_OF, {"logs": []}],
        lambda: letters.generate("cfpb_complaint", p, pick("reaged"), PROFILE, AS_OF, {"logs": []}))

    # rounds and the three-bureau compare
    case("diff_rounds", [{"$fx": "planted"}, {"$fx": "round2"}, {}], rounds.diff(p, fx["round2"]))
    gone = rounds.diff(p, fx["round2"])["deleted"]
    lk = [g["key"] for g in gone]
    case("diff_rounds", [{"$fx": "planted"}, {"$fx": "planted"}, {"deleted_keys": lk}], rounds.diff(p, p, {"deleted_keys": lk}))
    from errata import intake
    csv_text = ('bureau,creditor,account number,type,opened,balance,limit,past due,status,history,remarks\n'
                'TU,"EXAMPLE CARD, INC",4111XXXX,Revolving,03/2020,"$1,200",$5000,$0,Current,2025-03:30;2025-04:OK,closed by grantor\n'
                'EQ,SAMPLE AUTO,7788,Installment,2021-02-10,$0,,$0,"Paid, Closed",,\n')
    case("split_rows", [csv_text], intake.split_rows(csv_text))
    case("parse_csv", [csv_text, "", AS_OF], intake.parse_csv(csv_text, "", AS_OF))
    err("parse_csv", ["a,b\n1,2\n", "", AS_OF], lambda: intake.parse_csv("a,b\n1,2\n", "", AS_OF))
    co_text = "bureau,name,number,type,status,balance,removal\nEX,SAMPLE CARD,4111,Revolving,Charged Off,$500,05/2026\n"
    case("parse_csv", [co_text, "", AS_OF], intake.parse_csv(co_text, "", AS_OF))
    resp = ("Results of your dispute dated 09/20/2026. EXAMPLE CARD BANK: this item has been deleted. "
            "SAMPLE MORTGAGE CO: verified as accurate. SAMPLE AUTO FINANCE: updated.")
    case("parse_response", [resp, p["accounts"]], intake.parse_response(resp, p["accounts"]))
    r3 = copy.deepcopy(p)
    r3["source"]["report_date"] = "2027-01-05"
    case("diff_rounds", [{"$fx": "round2"}, r3, {"earlier": [p]}], rounds.diff(fx["round2"], r3, {"earlier": [p]}))
    ex = copy.deepcopy(p)
    ex["bureau"] = "experian"
    eq = copy.deepcopy(p)
    eq["bureau"] = "equifax"
    c_ex = next(a for a in ex["accounts"] if a["name"] == "EXAMPLE CARD BANK")
    c_ex["updated"], c_ex["balance"] = "2026-09-09", 118000
    next(a for a in eq["accounts"] if a["name"] == "SAMPLE MORTGAGE CO")["balance"] = 19990000
    next(a for a in ex["accounts"] if a["name"] == "EXAMPLE CREDIT UNION")["history"][3]["rating"] = "30"
    case("compare_bureaus", [[{"$fx": "planted"}, ex, eq]], rounds.compare([p, ex, eq]))
    allf = []
    for r_ in (p, ex, eq):
        allf += findings.find(r_, {"as_of": AS_OF})
    case("tradelines", [[{"$fx": "planted"}, ex, eq], allf], rounds.tradelines([p, ex, eq], allf))

    V = {"fixtures": fx, "cases": cases, "constants": {"product_name": PRODUCT_NAME, "tables": json.loads(json.dumps(tables()))}}
    (ROOT / "tests" / "vectors.json").write_text(json.dumps(V, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {len(cases)} cases and web/src/core/90_tables.js")


if __name__ == "__main__":
    main()
    import make_example
    make_example.main()

"""Command line: errata <command> ...

  parse REPORT.pdf|page.html|items.json [--out report.json]  read a report into the normalized model
  findings REPORT [--as-of DATE] [--profile p.json]   list findings with their legal basis
  plan REPORT [--goal standard|auto_soon]             the ordered plan
  letter TYPE REPORT --profile p.json --finding ID... [--out file.docx|.pdf|.txt]
  deadline KIND DATE                                  one legal deadline
  sol STATE TYPE [--last-payment DATE] [--dofd YYYY-MM]
  diff OLD NEW                                         round compare
  compare REPORT REPORT [REPORT]                       three-bureau compare
Reads only the files named. Never writes anything but --out.
"""

import argparse
import json
import sys
from pathlib import Path

from . import deadlines, docs, findings, letters, rounds, strategy
from .util import CreditError, money_text


def load_report(path, report_date=""):
    p = Path(path)
    if p.suffix.lower() == ".pdf":
        from . import parse_items
        from .pdftext import pdf_items
        return parse_items(pdf_items(str(p)), report_date)
    if p.suffix.lower() in (".html", ".htm"):
        from .htmltext import MAX_BYTES, parse_html
        if p.stat().st_size > MAX_BYTES:
            raise CreditError("input", f"{path} is larger than 20 MB.")
        return parse_html(p.read_text(encoding="utf-8", errors="replace"), report_date)
    data = json.loads(p.read_text(encoding="utf-8"))
    if isinstance(data, list):
        from . import parse_items
        return parse_items(data, report_date)
    if not isinstance(data, dict) or data.get("format") != "errata-report":
        raise CreditError("input", f"{path} is neither a PDF, a list of text items nor an exported report.")
    return data


def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8")) if path else {}


def main(argv=None):
    ap = argparse.ArgumentParser(prog="errata", description="Local-first credit report review.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("parse"); s.add_argument("report"); s.add_argument("--out")
    s = sub.add_parser("findings"); s.add_argument("report"); s.add_argument("--as-of", default=""); s.add_argument("--profile")
    s = sub.add_parser("plan"); s.add_argument("report"); s.add_argument("--as-of", default=""); s.add_argument("--profile")
    s.add_argument("--goal", default="standard", choices=sorted(strategy.GOALS))
    s = sub.add_parser("letter"); s.add_argument("type"); s.add_argument("report"); s.add_argument("--profile", required=True)
    s.add_argument("--finding", action="append", default=[]); s.add_argument("--as-of", default=""); s.add_argument("--out")
    s = sub.add_parser("deadline"); s.add_argument("kind"); s.add_argument("date")
    s = sub.add_parser("sol"); s.add_argument("state"); s.add_argument("type"); s.add_argument("--last-payment", default="")
    s.add_argument("--dofd", default=""); s.add_argument("--as-of", default="2026-01-01")
    s = sub.add_parser("diff"); s.add_argument("old"); s.add_argument("new")
    s = sub.add_parser("compare"); s.add_argument("reports", nargs="+")
    a = ap.parse_args(argv)
    try:
        if a.cmd == "parse":
            r = load_report(a.report)
            text = json.dumps(r, indent=1, sort_keys=True)
            if a.out:
                Path(a.out).write_text(text, encoding="utf-8")
            else:
                print(text)
            print(f"{len(r['accounts'])} accounts, {len(r['inquiries'])} inquiries, confidence {r['source']['confidence']}%", file=sys.stderr)
        elif a.cmd == "findings":
            r = load_report(a.report)
            ctx = {"as_of": a.as_of or r["source"].get("report_date", ""), "profile": load_json(a.profile)}
            for f in findings.find(r, ctx):
                print(f"{f['id']}  [{f['confidence']}] {f['title']}: {f['subject']}")
                for s_ in f["facts"]:
                    print("    " + s_)
                print("    basis: " + "; ".join(f["legal"]))
        elif a.cmd == "plan":
            r = load_report(a.report)
            as_of = a.as_of or r["source"].get("report_date", "")
            fs = findings.find(r, {"as_of": as_of, "profile": load_json(a.profile)})
            p = strategy.plan(r, fs, load_json(a.profile), a.goal, as_of)
            print(p["title"] + ". Next: " + p["next_action"]["title"])
            for ph in p["phases"]:
                print(f"\nDays {ph['days']}: {ph['title']}")
                for st in ph["steps"]:
                    print(f"  {st['order']:>2}. {st['title']}")
        elif a.cmd == "letter":
            r = load_report(a.report)
            prof = load_json(a.profile)
            as_of = a.as_of or r["source"].get("report_date", "")
            fs = {f["id"]: f for f in findings.find(r, {"as_of": as_of, "profile": prof})}
            sel = [fs[i] for i in a.finding if i in fs]
            if len(sel) != len(a.finding):
                raise CreditError("input", "Unknown finding id: " + ", ".join(i for i in a.finding if i not in fs))
            L = letters.generate(a.type, r, sel, prof, as_of)
            if a.out and a.out.endswith(".docx"):
                Path(a.out).write_bytes(docs.docx(L))
            elif a.out and a.out.endswith(".pdf"):
                Path(a.out).write_bytes(docs.letter_pdf(L))
            elif a.out:
                Path(a.out).write_text(letters.to_text(L), encoding="utf-8")
            else:
                print(letters.to_text(L))
        elif a.cmd == "deadline":
            d = deadlines.deadline(a.kind, a.date)
            print(f"{d['label']}: due {d['due']} (earliest reading {d['earliest']}), basis {d['cite']}")
        elif a.cmd == "sol":
            o = strategy.sol(a.state, a.type, a.last_payment, a.dofd, a.as_of)
            print(f"{o['state_name']}, {o['debt_type']}: {o['years']} years (estimate; verify with your state)")
            if "sol_expires" in o:
                print("Statute of limitations ends about " + o["sol_expires"])
            if "reporting_ends" in o:
                print("Reporting limit ends " + o["reporting_ends"])
            for w in o["warnings"]:
                print("  " + w)
        elif a.cmd == "diff":
            d = rounds.diff(load_report(a.old), load_report(a.new))
            print(json.dumps(d["counts"]))
            for k in ("deleted", "new", "reinserted"):
                for x in d[k]:
                    print(f"{k}: {x['name']} {x['number']}")
        elif a.cmd == "compare":
            c = rounds.compare([load_report(p) for p in a.reports])
            print(f"{c['differences']} differences to dispute, {c['timing']} timing only")
            for g in c["groups"]:
                for row in g["rows"]:
                    if row["state"] != "same":
                        vals = ", ".join(f"{k}={money_text(v) if isinstance(v, int) else v}" for k, v in sorted(row["values"].items()))
                        print(f"  {g['name']}: {row['field']} {row['state']} {vals}")
    except (CreditError, OSError, json.JSONDecodeError) as e:
        print("error: " + str(e), file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())

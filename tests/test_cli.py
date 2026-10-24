"""The command line reads only the files it is given and writes only --out."""

import json

from conftest import PROFILE, ROOT
from errata.cli import main

FX = str(ROOT / "tests" / "fixtures" / "tu_planted.pdf")


def test_cli_end_to_end(tmp_path, capsys):
    out = tmp_path / "r.json"
    assert main(["parse", FX, "--out", str(out)]) == 0
    r = json.loads(out.read_text())
    assert r["format"] == "errata-report" and len(r["accounts"]) == 15
    assert main(["findings", str(out), "--as-of", "2026-10-20"]) == 0
    text = capsys.readouterr().out
    assert "Late payments reported after the account was paid" in text and "basis: fcra611" in text
    assert main(["plan", str(out), "--goal", "auto_soon", "--as-of", "2026-10-20"]) == 0
    assert "Auto loan or mortgage soon" in capsys.readouterr().out
    prof = tmp_path / "p.json"
    prof.write_text(json.dumps(PROFILE))
    from errata import findings
    fid = next(f["id"] for f in findings.find(r, {"as_of": "2026-10-20"}) if f["rule"] == "paid_then_late")
    for ext in ("docx", "pdf", "txt"):
        dest = tmp_path / ("l." + ext)
        assert main(["letter", "bureau_611", str(out), "--profile", str(prof), "--finding", fid, "--as-of", "2026-10-20", "--out", str(dest)]) == 0
        assert dest.stat().st_size > 500
    assert main(["letter", "bureau_611", str(out), "--profile", str(prof), "--finding", "fnope"]) == 2
    assert main(["deadline", "bureau_dispute", "2026-11-02"]) == 0
    assert "due 2026-12-02 (earliest reading 2026-12-01)" in capsys.readouterr().out
    assert main(["sol", "TX", "open", "--last-payment", "2021-03-15", "--dofd", "2021-01"]) == 0
    assert main(["diff", FX, str(ROOT / "tests" / "fixtures" / "tu_round2.pdf")]) == 0
    assert '"deleted": 3' in capsys.readouterr().out
    assert main(["compare", FX, str(out)]) == 0
    assert main(["parse", str(tmp_path / "missing.pdf")]) == 2
    bad = tmp_path / "bad.json"
    bad.write_text('{"x": 1}')
    assert main(["findings", str(bad)]) == 2
    notpdf = tmp_path / "x.pdf"
    notpdf.write_text("hello")
    assert main(["parse", str(notpdf)]) == 2

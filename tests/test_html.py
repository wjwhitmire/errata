"""Saved web-page reports: the walk keeps table rows and definition lists as lines of cells, ignores
scripts, styles, frames and images, and the template reader finds the planted errors."""

import pytest

import make_html_fixtures as hx
from conftest import AS_OF, ROOT
from errata import findings, htmltext
from errata.util import CreditError


def page(name):
    return (ROOT / "tests" / "fixtures" / name).read_text(encoding="utf-8")


@pytest.mark.parametrize("name,bureau", [("tu_saved.html", "transunion"), ("ex_saved.html", "experian")])
def test_saved_pages_parse_and_find_the_planted_errors(name, bureau):
    r = htmltext.parse_html(page(name))
    assert r["bureau"] == bureau and r["source"]["kind"] == "html" and "html-template" in r["source"]["parser"]
    assert r["messages"][0] == htmltext.HTML_NOTE
    fs = findings.find(r, {"as_of": AS_OF})
    for rule, subject in hx.PLANTED_HTML[bureau]:
        assert any(f["rule"] == rule and subject in f["subject"] for f in fs), (rule, subject)
    for f in fs:
        assert any(f["rule"] == rule and subject in f["subject"] for rule, subject in hx.PLANTED_HTML[bureau]), f["rule"]


def test_noise_is_ignored_and_terms_are_read():
    lines = htmltext.html_lines(page("tu_saved.html"))
    text = " ".join(" ".join(c) for c in lines)
    assert "document.title" not in text and "color: red" not in text and "example.invalid" not in text
    assert ["Name", "JORDAN SAMPLE"] in lines
    hdr = next(c for c in lines if c[:1] == ["Year"])
    assert len(hdr) == 13
    r = htmltext.parse_html(page("tu_saved.html"))
    auto = next(a for a in r["accounts"] if a["name"] == "SAMPLE AUTO FINANCE")
    assert auto["terms"]["amount"] == 41000 and auto["terms"]["months"] == 72
    ex = htmltext.parse_html(page("ex_saved.html"))
    assert ex["accounts"][0]["terms"]["months"] == 120


def test_walk_rules():
    lines = htmltext.html_lines("<p>a<br>b</p><table><tr><td>x</td><td></td><td>z</td></tr><tr><td>1<td>2</table>"
                                "<dl><dt>Balance<dd>$5</dl><dl><dt>Orphan</dt><dt>Paid</dt><dd>Yes</dd></dl>")
    assert lines == [["a"], ["b"], ["x", "", "z"], ["1", "2"], ["Balance", "$5"], ["Orphan"], ["Paid", "Yes"]]


def test_refusals():
    with pytest.raises(CreditError):
        htmltext.parse_html("<html><body><p>Hello</p></body></html>")
    with pytest.raises(CreditError):
        htmltext.html_lines("x" * (htmltext.MAX_BYTES + 1))
    assert htmltext.detect_html([["Equifax and Experian"], ["Equifax"]]) == "equifax"
    assert htmltext.detect_html([["Equifax and Experian"]]) is None


def test_term_phrasing():
    from errata.tu import parse_terms
    cases = {"$185 per month, paid Monthly for 120 months": (18500, 120, "Monthly"), "120 Months": (None, 120, ""),
             "$185 / 120 Months": (18500, 120, ""), "60 mo.": (None, 60, ""), "72 Month(s)": (None, 72, ""), "120": (None, 120, ""),
             "$350 Monthly": (35000, None, "Monthly"), "$1,200": (None, None, ""), "Revolving": (None, None, ""), "$0 per month": (0, None, "")}
    for text, (amt, months, freq) in cases.items():
        t = parse_terms(text)
        assert (t["amount"], t["months"], t["frequency"]) == (amt, months, freq), text

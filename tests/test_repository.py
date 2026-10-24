"""Repository rules: banned words (kept rot13 so this file passes its own check), no em dashes, no
local paths, no real-report artifacts, the product name in one place, vendored files matching their
pins, and plain commit messages by the owner with no trailers."""

import base64
import codecs
import hashlib
import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

from errata.brand import PRODUCT_NAME

ROOT = Path(__file__).resolve().parent.parent
SKIP_DIRS = {".git", "node_modules", "__pycache__", ".pytest_cache", "build", "dist", "shots", "local", "scratch"}

BANNED = [codecs.decode(w, "rot13") for w in ("pynhqr", "nagujebcvp", "pungtcg", "bcranv", "pbcvybg")]
BANNED_PROSE = [codecs.decode(w, "rot13") for w in ("fnaqobk", "oevrs", "ntrag", "fcrp")]
NOTES = [codecs.decode(w, "rot13") + ".md" for w in ("PYNHQR", "NTRAGF")]
# The two model providers may be named only where the person picks one: the built page's security
# policy (their exact API addresses) and the README section that describes the provider switch.
PROVIDER_URLS = [codecs.decode(u, "rot13") for u in ("uggcf://ncv.naguebcvp.pbz/i1/zrffntrf", "uggcf://ncv.bcranv.pbz/i1/pung/pbzcyrgvbaf")]
PROVIDER_NAMES = [codecs.decode(u, "rot13") for u in ("Naguebcvp", "BcraNV", "ncv.naguebcvp.pbz", "ncv.bcranv.pbz")]
README_PROVIDERS = "### Model providers"


def repo_files():
    for p in ROOT.rglob("*"):
        if p.is_file() and not (SKIP_DIRS & set(p.relative_to(ROOT).parts)) and ".egg-info" not in str(p):
            yield p


def allowed_mentions(p, text):
    rel = p.relative_to(ROOT).as_posix()
    if rel == "docs/index.html":
        def csp(m):
            out = m.group(0)
            for u in PROVIDER_URLS:
                out = out.replace(" " + u, "", 1)
            return out
        return re.sub(r'<meta http-equiv="Content-Security-Policy" content="[^"]*">', csp, text, count=1)
    if rel == "README.md" and README_PROVIDERS in text:
        head, _, rest = text.partition(README_PROVIDERS)
        section, nxt, tail = rest.partition("\n#")
        for n in PROVIDER_NAMES:
            section = section.replace(n, "")
        return head + section + nxt + tail
    return text


def test_repository_words_dashes_and_paths():
    banned = re.compile(r"\b(" + "|".join(BANNED) + r")s?\b|\bAI[- ](generated|assist\w*)\b" + "|\u2014", re.I)
    prose = re.compile(r"\b(" + "|".join(BANNED_PROSE) + r")s?\b", re.I)
    for p in repo_files():
        try:
            text = allowed_mentions(p, p.read_text(encoding="utf-8"))
        except UnicodeDecodeError:
            continue
        hit = banned.search(text)
        assert hit is None, f"{p}: banned text {hit.group(0)!r}" if hit else ""
        if "vendor" not in p.parts:
            own = re.sub(r'<script[^>]*id="vendor-[^"]*"[^>]*>.*?</script>', "", text, flags=re.S)
            assert "\u2013" not in own, f"{p}: en dash"
            hit = prose.search(own)
            assert hit is None, f"{p}: banned word {hit.group(0) if hit else ''}"
        assert ("/ho" + "me/") not in text and ("/ro" + "ot/") not in text, str(p)
        assert BANNED[0] + ":" not in text.lower(), str(p)
    for name in NOTES:
        assert not list(ROOT.rglob(name))


def test_no_file_named_after_the_banned_words():
    for p in repo_files():
        low = p.name.lower()
        assert not any(w in low for w in BANNED + BANNED_PROSE), p


def test_no_real_report_artifacts():
    """Only the synthetic fixtures may be PDFs; local scratch is ignored by git."""
    pdfs = [p.relative_to(ROOT).as_posix() for p in repo_files() if p.suffix.lower() == ".pdf"]
    assert sorted(pdfs) == ["tests/fixtures/eq_planted.pdf", "tests/fixtures/ex_planted.pdf", "tests/fixtures/tu_clean.pdf", "tests/fixtures/tu_planted.pdf", "tests/fixtures/tu_round2.pdf"]
    gi = (ROOT / ".gitignore").read_text()
    for line in ("local/", "scratch/", "*.local.pdf", "*.local.json", "shots/"):
        assert line in gi.splitlines()
    for p in ROOT.joinpath("tests", "fixtures").glob("*.pdf"):
        data = p.read_bytes()
        assert b"Synthetic test data" in data


def test_product_name_lives_in_one_place():
    allowed = {"brand.py", "00_brand.js", "test_repository.py", "vectors.json"}
    for p in repo_files():
        rel = p.relative_to(ROOT).as_posix()
        if not (rel.startswith("src/") or rel.startswith("web/src/") or rel.startswith("tests/")):
            continue
        if p.suffix in (".py", ".js", ".mjs", ".json", ".css") and p.name not in allowed:
            assert re.search(r"\b" + PRODUCT_NAME + r"\b", p.read_text(encoding="utf-8", errors="ignore")) is None, str(p)
    js = (ROOT / "web" / "src" / "core" / "00_brand.js").read_text(encoding="utf-8")
    assert f'PRODUCT_NAME = "{PRODUCT_NAME}"' in js


def test_vendored_libraries_match_pins():
    pins = json.loads((ROOT / "web" / "vendor" / "pins.json").read_text(encoding="utf-8"))
    for name, pin in pins.items():
        path = ROOT / "web" / "vendor" / pin["file"]
        if pin.get("binary"):
            raw = path.read_bytes()
        else:
            data = path.read_text(encoding="utf-8")
            for a, b in pin.get("restore", []):
                data = data.replace(a, b)
            raw = data.encode("utf-8")
        assert "sha384-" + base64.b64encode(hashlib.sha384(raw).digest()).decode() == pin["sri"], name


def test_commit_history_rules():
    if not shutil.which("git") or not (ROOT / ".git").exists():
        pytest.skip("not a git checkout")
    res = subprocess.run(["git", "-C", str(ROOT), "log", "--no-merges", "--format=%an <%ae>%x1f%cn <%ce>%x1f%B%x1e"],
                         capture_output=True, text=True)
    if res.returncode != 0:
        pytest.skip("no commits yet")
    banned = re.compile(r"\b(" + "|".join(BANNED + BANNED_PROSE) + r")s?\b|\bAI[- ](generated|assist\w*)\b" + "|\u2014", re.I)
    for entry in filter(str.strip, res.stdout.split("\x1e")):
        author, committer, body = entry.strip("\n").split("\x1f")
        assert not banned.search(body), body
        assert author == committer == "Will Whitmire <will@users.noreply.github.com>", committer
        paras = [x for x in body.strip().split("\n\n") if x.strip()]
        assert len(paras) < 2 or not re.search(r"^[A-Za-z-]+: \S", paras[-1], re.M), body

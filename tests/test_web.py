"""The built page's contract: the policy, the framing guard, the theme tokens, the self-hosted fonts,
the manifest and the shell the design asks for. Builds web/app.html and docs/index.html first."""

import json
import re
import runpy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from tokens import DARK, LIGHT, LOCAL, SHARED  # noqa: E402

BUILD = runpy.run_path(str(ROOT / "web" / "build_pages.py"))
APP = BUILD["build_app"]()
DOC = (BUILD["build_docs"](APP)).read_text(encoding="utf-8")


def csp():
    return re.search(r'http-equiv="Content-Security-Policy" content="([^"]+)"', DOC).group(1)


def test_policy_and_guard():
    c = csp()
    assert "default-src 'none'" in c and "frame-src 'none'" in c and "form-action 'none'" in c and "object-src 'none'" in c
    assert "connect-src 'self' https: http://localhost:* http://127.0.0.1:*" in c
    assert "'unsafe-eval'" not in c.replace("'wasm-unsafe-eval'", "")
    assert "font-src 'self'" in c and "fonts.googleapis" not in DOC
    assert 'data-framed' in DOC and DOC.index('id="framed"') < DOC.index("<style>\n") if 'id="framed"' in DOC else True
    scripts = re.findall(r"<script(?![^>]*\bsrc=)(?![^>]*\btype=\"(?!module\"|importmap\")[^\"]*\")[^>]*>", DOC)
    assert len(scripts) >= 4 and c.count("'sha256-") >= 4


def test_tokens_in_every_theme_block():
    style = APP[APP.index("<style>"):APP.index("</style>")]
    for T in (LIGHT, DARK):
        for k in SHARED + LOCAL:
            assert f"--{k}:{T[k]}" in style, k
    assert len(SHARED) == 19
    assert ':root[data-theme="dark"]' in style and ':root:not([data-theme="light"])' in style and "@media print" in style
    own = re.sub(r"/\*TOKENS\*/", "", (ROOT / "web" / "src" / "style.css").read_text(encoding="utf-8"))
    assert not re.search(r"#[0-9a-fA-F]{3,8}\b", own), "literal colors outside the token blocks"
    assert ":focus-visible{outline:3px solid var(--accent);outline-offset:2px}" in own
    assert "prefers-reduced-motion: reduce" in own


def test_fonts_manifest_and_icons():
    for f in ("literata-latin-standard-normal.woff2", "literata-latin-standard-italic.woff2", "atkinson-hyperlegible-next-latin-wght-normal.woff2", "atkinson-hyperlegible-next-latin-wght-italic.woff2", "sono-latin-full-normal.woff2"):
        assert (ROOT / "docs" / "fonts" / f).stat().st_size > 10000
        assert "fonts/" + f in DOC
    m = json.loads((ROOT / "docs" / "manifest.webmanifest").read_text())
    assert m["name"] == BUILD["product_name"]() and m["background_color"] == "#eaede8" and m["theme_color"] == "#173a35"
    assert (ROOT / "docs" / "sw.js").read_text().count("app-shell-") == 1 and "app-shell-v1" not in (ROOT / "docs" / "sw.js").read_text()
    assert (ROOT / "docs" / "tesseract-core-lstm.wasm").exists()


def test_shell_and_honesty_surfaces():
    ui = "\n".join(p.read_text(encoding="utf-8") for p in sorted((ROOT / "web" / "src" / "ui").glob("*.js")))
    nav = re.search(r"const NAV = \[(.*?)\];", ui, re.S).group(1)
    assert re.findall(r'\["(\w+)", "', nav) == ["dashboard", "playbook", "reports", "findings", "letters", "tracker", "negotiate", "score", "vault", "settings"]
    assert "Built by Will Whitmire. Runs entirely in your browser; nothing you enter is uploaded." in ui
    for word in ("affiliate link", "upgrade now", "go premium", "partner offer", "paid plan"):
        assert word not in ui.lower().replace("no affiliate links", "").replace("no partner offers", "")
    for bad in ("derogatory", "toxic", "attack"):
        assert bad not in ui.lower()
    assert "There is no passphrase recovery." in ui and "Type DELETE to confirm" in ui

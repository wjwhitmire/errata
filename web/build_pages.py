"""Build the browser app.

1. web/app.html: the standalone page (no doctype, html, head or body tags). It starts with <title>,
   then the fonts stylesheet, then <style>, then the body markup and the scripts: the import map
   (integrity for the optional on-device model library), the pinned pdf.js build and its worker
   source, the text engine for scanned pages as inert data, the core (web/src/core/*.js in name
   order) and the interface (web/src/ui/*.js in name order). Vendored files are checked against
   their SHA-384 pins before they are embedded.
2. docs/index.html: app.html wrapped as a full HTML document for GitHub Pages, with a
   Content-Security-Policy that allows only the hosts behind the network switches, self-hosted
   fonts, the PWA manifest, a service worker that caches the app shell, and a framing guard that
   refuses to run inside another site's frame. The text engine's WebAssembly sits next to the page
   in docs/ and is fetched from this site only when the text reader is used.

The product name comes from src/errata/brand.py and the design tokens from tools/tokens.py.
Run: python web/build_pages.py
"""

import base64
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "web" / "src"
VENDOR = ROOT / "web" / "vendor"
APP = ROOT / "web" / "app.html"
DOCS = ROOT / "docs"
sys.path.insert(0, str(ROOT / "tools"))
from tokens import DARK, LIGHT, LOCAL, SHARED  # noqa: E402


def read(p):
    return p.read_text(encoding="utf-8")


def product_name():
    return re.search(r'^PRODUCT_NAME = "([^"]+)"', read(ROOT / "src" / "errata" / "brand.py"), re.M).group(1)


def token_css():
    def block(T):
        return ";".join(f"--{k}:{T[k]}" for k in SHARED + LOCAL)
    # print is always white paper: the light tokens again, whatever the screen theme
    return (f":root{{{block(LIGHT)}}}\n"
            f"@media (prefers-color-scheme: dark){{:root:not([data-theme=\"light\"]){{{block(DARK)};color-scheme:dark}}}}\n"
            f":root[data-theme=\"dark\"]{{{block(DARK)};color-scheme:dark}}\n"
            f"@media print{{:root,:root[data-theme=\"dark\"],:root:not([data-theme=\"light\"]){{{block(LIGHT)};color-scheme:light}}}}")


ICONS = json.loads(read(SRC / "icons.json"))


def vendor(name):
    pin = json.loads(read(VENDOR / "pins.json"))[name]
    if pin.get("binary"):
        data = (VENDOR / pin["file"]).read_bytes()
        if "sha384-" + base64.b64encode(hashlib.sha384(data).digest()).decode() != pin["sri"]:
            raise SystemExit(f"{pin['file']} does not match its pinned hash")
        enc = base64.b64encode(data).decode()
        return "\n".join(enc[i:i + 120] for i in range(0, len(enc), 120))
    text = read(VENDOR / pin["file"])
    check = text
    for a, b in pin.get("restore", []):
        check = check.replace(a, b)
    if "sha384-" + base64.b64encode(hashlib.sha384(check.encode("utf-8")).digest()).decode() != pin["sri"]:
        raise SystemExit(f"{pin['file']} does not match its pinned hash")
    if "</script" in text.lower():
        raise SystemExit(f"{pin['file']} contains '</script'")
    return text.rstrip("\n")


def joined(folder):
    return "\n".join(f"// ---- {p.parent.name}/{p.name}\n" + read(p) for p in sorted(folder.glob("*.js")))


# The optional on-device model (switch off by default): library pinned by version and SHA-384.
AI_JS = read(SRC / "core" / "12_ai.js")
LOCAL_LIB = re.search(r'lib: "([^"]+)"', AI_JS).group(1)
LOCAL_LIB_SRI = re.search(r'libSri: "([^"]+)"', AI_JS).group(1)
LOCAL_MODEL_LIB = re.search(r'modelLib: "([^"]+)"', AI_JS).group(1)
LOCAL_WEIGHTS = re.search(r'weights: "([^"]+)"', AI_JS).group(1)
NET_JS = read(SRC / "ui" / "05_net.js")
OCR_URL = re.search(r'url: "(https://cdn\.jsdelivr\.net/[^"]+)"', NET_JS).group(1)
MAIL_URL = re.search(r'MAIL_URL = "([^"]+)"', NET_JS).group(1)
# "Writing helper with your own key" may go to any https service the person names (or a model server on
# this computer), so the policy allows https and local http for connections; the gate in
# web/src/ui/05_net.js still refuses everything but the one address the person set, and only while
# that switch is on.
CONNECT = ["https:", "http://localhost:*", "http://127.0.0.1:*"]


def build_app():
    name = product_name()
    core = joined(SRC / "core")
    pin = json.loads(read(VENDOR / "pins.json"))["ocrWasm"]
    wasm_pin = {"file": pin["file"], "sri": pin["sri"], "bytes": (VENDOR / pin["file"]).stat().st_size}
    ui = (joined(SRC / "ui").replace("/*ICONS*/", json.dumps(ICONS, sort_keys=True))
          .replace("/*OCR_WASM_PIN*/", json.dumps(wasm_pin, sort_keys=True)))
    for label, js in (("core", core), ("ui", ui)):
        if "</script" in js.lower():
            raise SystemExit(f"the {label} script contains '</script'; it would end the block early")
    t = read(SRC / "app.template.html")
    parts = [
        ("{{NAME}}", name),
        ("/*STYLE*/", read(SRC / "style.css").replace("/*TOKENS*/", token_css())),
        ("<!--BODY-->", read(SRC / "body.html")),
        ("/*IMPORTMAP*/", json.dumps({"integrity": {LOCAL_LIB: LOCAL_LIB_SRI}})),
        ("/*PDFJS*/", vendor("pdfjs")),
        ("/*PDFJS_WORKER*/", vendor("pdfjsWorker")),
        ("/*OCR_CORE*/", vendor("ocrCore")),
        ("/*OCR_WASM*/", vendor("ocrWasm")),
        ("/*CORE*/", core),
        ("/*UI*/", ui),
    ]
    for key, val in parts:
        if key not in t:
            raise SystemExit(f"template is missing {key}")
        t = t.replace(key, val.rstrip("\n"))
    APP.write_text(t, encoding="utf-8")
    return t


CSP = (
    "default-src 'none'; "
    "script-src {SCRIPT_HASHES} " + LOCAL_LIB + " blob: 'wasm-unsafe-eval'; "
    "worker-src 'self' blob:; "
    "connect-src 'self' " + " ".join(CONNECT) + "; "
    "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; manifest-src 'self'; "
    "media-src blob:; form-action 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'"
)

HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="{CSP}">
<meta name="referrer" content="no-referrer">
<meta name="description" content="Free, local-first credit report review: find what is wrong in your reports, with the legal basis, write the letters and track the deadlines. Runs on your device.">
<meta name="theme-color" content="#fcfcfa" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#151b18" media="(prefers-color-scheme: dark)">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icon-192.png">
"""

# Framing guard: a page that another site puts in a frame could be used to trick clicks (for example
# on Delete everything), and GitHub Pages cannot send a header that forbids framing (a meta policy
# cannot set frame-ancestors). When framed, the page hides its markup, the interface does not start,
# and a short notice links to the app in its own tab. The script is covered by the policy hash.
FRAME_GUARD = """<script>
(function () {
  var framed = true;
  try { framed = window.top !== window.self; } catch (e) { framed = true; }
  if (!framed) return;
  document.documentElement.setAttribute("data-framed", "");
  document.addEventListener("DOMContentLoaded", function () {
    var box = document.createElement("div");
    box.id = "framed";
    var h = document.createElement("h1");
    h.textContent = "This page is shown inside another site.";
    var p = document.createElement("p");
    p.textContent = "For your safety {{NAME}} only runs in its own tab.";
    var a = document.createElement("a");
    a.href = location.href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = "Open {{NAME}} in its own tab";
    box.appendChild(h); box.appendChild(p); box.appendChild(a);
    document.body.insertBefore(box, document.body.firstChild);
  });
})();
</script>
<style>html[data-framed] body > :not(#framed){display:none!important}#framed{padding:24px max(16px,env(safe-area-inset-left,0px));font:400 1rem/1.5 system-ui,sans-serif}#framed h1{font-size:1.25rem;margin:0 0 8px}</style>
"""

FONT_FACES = """<style>
@font-face{font-family:"Literata";src:url(fonts/literata-latin-standard-normal.woff2) format("woff2");font-weight:200 900;font-style:normal;font-display:swap}
@font-face{font-family:"Literata";src:url(fonts/literata-latin-standard-italic.woff2) format("woff2");font-weight:200 900;font-style:italic;font-display:swap}
@font-face{font-family:"Atkinson Hyperlegible Next";src:url(fonts/atkinson-hyperlegible-next-latin-wght-normal.woff2) format("woff2");font-weight:200 800;font-style:normal;font-display:swap}
@font-face{font-family:"Atkinson Hyperlegible Next";src:url(fonts/atkinson-hyperlegible-next-latin-wght-italic.woff2) format("woff2");font-weight:200 800;font-style:italic;font-display:swap}
@font-face{font-family:"Sono";src:url(fonts/sono-latin-full-normal.woff2) format("woff2");font-weight:200 800;font-display:swap}
</style>"""

SW_REG = """<script>
if ("serviceWorker" in navigator && location.protocol === "https:" && !document.documentElement.hasAttribute("data-framed")) {
  try { navigator.serviceWorker.register("sw.js").catch(function () {}); } catch (e) {}
}
</script>
"""

SCRIPT_RE = r'<script(?![^>]*\bsrc=)(?![^>]*\btype="(?!module"|importmap")[^"]*")[^>]*>(.*?)</script>'


def build_docs(app):
    name = product_name()
    app = re.sub(r'<link rel="stylesheet" href="https://fonts.googleapis.com[^>]*>', FONT_FACES, app, count=1)
    app, n = re.subn(r'(<script type="application/octet-stream" id="vendor-ocr-wasm">)\n[A-Za-z0-9+/=\n]+\n(</script>)', r"\1\2", app, count=1)
    if n != 1:
        raise SystemExit("the text engine block is missing from the page")
    pin = json.loads(read(VENDOR / "pins.json"))["ocrWasm"]
    wasm = (VENDOR / pin["file"]).read_bytes()
    style_end = app.index("</style>", app.index("<style>\n")) + len("</style>")
    doc = (HEAD + FRAME_GUARD.replace("{{NAME}}", name) + app[:style_end] + "\n</head>\n<body>\n" + app[style_end:].lstrip("\n") + "\n" + SW_REG
           + "</body>\n</html>\n")
    hashes = []
    for m in re.finditer(SCRIPT_RE, doc, re.S):
        h = "'sha256-" + base64.b64encode(hashlib.sha256(m.group(1).encode("utf-8")).digest()).decode() + "'"
        if h not in hashes:
            hashes.append(h)
    doc = doc.replace("{CSP}", CSP.replace("{SCRIPT_HASHES}", " ".join(hashes)), 1)
    DOCS.mkdir(exist_ok=True)
    (DOCS / "index.html").write_text(doc, encoding="utf-8")
    (DOCS / pin["file"]).write_bytes(wasm)
    for src in sorted((SRC / "pwa").rglob("*")):
        if src.is_file():
            dst = DOCS / src.relative_to(SRC / "pwa")
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(src.read_bytes())
    shell = hashlib.sha256(doc.encode("utf-8"))
    for src in sorted((SRC / "pwa").rglob("*")):
        if src.is_file() and src.name != "sw.js":
            shell.update(src.read_bytes())
    sw = DOCS / "sw.js"
    sw.write_text(read(sw).replace('"app-shell-v1"', '"app-shell-' + shell.hexdigest()[:12] + '"'), encoding="utf-8")
    return DOCS / "index.html"


if __name__ == "__main__":
    app = build_app()
    out = build_docs(app)
    print(f"wrote {APP.relative_to(ROOT)} ({APP.stat().st_size:,} bytes) and {out.relative_to(ROOT)} ({out.stat().st_size:,} bytes)")

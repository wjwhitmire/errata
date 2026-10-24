"""Screenshots of every view of the built app (docs/index.html) at 400 and 1280 px, light and dark,
with the invented example data, into shots/ (not tracked). Each shot is checked: no sideways page
scroll, the three font families loaded, exactly one key answer, and on the phone layout (touch) no
visible control under 44 px.

Usage: python tools/shoot.py [view ...]     (needs Playwright and its Chromium)
"""

import functools
import http.server
import socketserver
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "shots"

SMALL = """()=>[...document.querySelectorAll('#app button,#app input,#app select,#app a.btn,.tabbar a,.navlist a,#lock button,#lock input,.menu button')]
  .filter(e=>{const r=e.getBoundingClientRect();if(!(r.width>0&&r.height>0))return false;const cs=getComputedStyle(e);if(cs.visibility==='hidden'||cs.display==='none')return false;
   if(e.type==='checkbox'||e.type==='radio'){const l=e.closest('label');return !l||l.getBoundingClientRect().height<43.5}
   if(e.classList.contains('quiet'))return false;
   return r.height<43.5})
  .slice(0,12).map(e=>e.tagName+'.'+e.className+' '+Math.round(e.getBoundingClientRect().height)+' '+(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,30))"""
WIDE = """()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>document.documentElement.clientWidth+0.5&&!e.closest('svg')&&!e.closest('.tablewrap'))
  .slice(0,8).map(e=>e.tagName+' '+(e.getAttribute('class')||'')+' '+Math.round(e.getBoundingClientRect().right))"""


def serve():
    class H(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(H, directory=str(ROOT / "docs")))
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}"


def hash_to(pg, h):
    pg.evaluate(f"location.hash = {h!r}")
    pg.wait_for_timeout(250)


def setup_auto(pg, on):
    hash_to(pg, "#/playbook")
    cur = pg.get_attribute("#mode-playbook", "aria-checked")
    if (cur == "true") != on:
        pg.click("#mode-playbook")
        pg.wait_for_timeout(250)


def open_cell(pg):
    hash_to(pg, "#/reports/account/0")
    pg.click("button[aria-label^='Mar 2025, Experian']")
    pg.wait_for_timeout(150)


def wizard(pg, steps):
    hash_to(pg, "#/dashboard")
    hash_to(pg, "#/letters/new?after=m4")
    for _ in range(steps):
        pg.click("#wiz-next")
        pg.wait_for_timeout(120)


def preview(pg):
    wizard(pg, 5)
    pg.click("#wiz-open")
    pg.wait_for_timeout(250)


def finding(pg, which):
    hash_to(pg, "#/findings")
    labels = pg.evaluate("""()=>[...document.querySelectorAll('tr.f-row')].map(r=>[r.querySelector('td').innerText.trim(), r.innerText])""")
    pick = next((l for l, t in labels if which in t), labels[0][0])
    hash_to(pg, "#/findings/" + pick)


VIEWS = [
    ("01-dashboard", lambda pg: hash_to(pg, "#/dashboard")),
    ("02-playbook", lambda pg: (setup_auto(pg, False), hash_to(pg, "#/playbook"))),
    ("02b-playbook-auto", lambda pg: setup_auto(pg, True)),
    ("03-reports", lambda pg: (setup_auto(pg, False), hash_to(pg, "#/reports"))),
    ("04-compare", lambda pg: hash_to(pg, "#/reports/compare/0")),
    ("05-account", open_cell),
    ("06-findings", lambda pg: hash_to(pg, "#/findings")),
    ("06b-finding-detail", lambda pg: finding(pg, "Needs answer")),
    ("06c-finding-accurate", lambda pg: hash_to(pg, "#/findings/accurate/0")),
    ("06d-build", lambda pg: hash_to(pg, "#/letters/build")),
    ("07-wizard", lambda pg: wizard(pg, 3)),
    ("08-letter", preview),
    ("09-mail-log", lambda pg: hash_to(pg, "#/letters")),
    ("10-tracker", lambda pg: hash_to(pg, "#/tracker")),
    ("11-rounds", lambda pg: hash_to(pg, "#/tracker/rounds")),
    ("11b-negotiate", lambda pg: hash_to(pg, "#/negotiate")),
    ("11c-texas-review", lambda pg: hash_to(pg, "#/letters/new?kind=oag_review_request&step=")),
    ("12-score", lambda pg: hash_to(pg, "#/score")),
    ("13-vault", lambda pg: hash_to(pg, "#/vault")),
    ("14-settings", lambda pg: hash_to(pg, "#/settings")),
    ("15-family", lambda pg: hash_to(pg, "#/family")),
    ("15b-lock", lambda pg: (hash_to(pg, "#/dashboard"), pg.click("#lockbtn"), pg.wait_for_timeout(250))),
]


def main():
    only = sys.argv[1:]
    OUT.mkdir(exist_ok=True)
    srv, base = serve()
    problems = 0
    with sync_playwright() as p:
        b = p.chromium.launch()
        for w in (400, 1280):
            for theme in ("light", "dark"):
                touch = w <= 640
                ctx = b.new_context(viewport={"width": w, "height": 900}, color_scheme=theme, has_touch=touch, is_mobile=touch, device_scale_factor=1)
                pg = ctx.new_page()
                errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)))
                pg.goto(base + "/index.html")
                pg.wait_for_function("() => window.ERRATA_READY === true", timeout=60000)
                pg.screenshot(path=str(OUT / f"00-welcome-{w}-{theme}.png"), full_page=True)
                pg.click("#try-example")
                pg.wait_for_function("() => document.getElementById('app').dataset.screen === 'dashboard'", timeout=60000)
                pg.evaluate("async()=>{await Promise.all(['600 30px \"Literata\"','italic 600 14px \"Literata\"','400 18px \"Atkinson Hyperlegible Next\"','400 13px \"Sono\"'].map(f=>document.fonts.load(f)));await document.fonts.ready;return 1}")
                for name, fn in VIEWS:
                    if only and name not in only:
                        continue
                    fn(pg)
                    pg.wait_for_timeout(200)
                    pg.evaluate("document.querySelectorAll('.toast').forEach(t => t.remove())")
                    info = pg.evaluate("""()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,keys:document.querySelectorAll('#content .key').length,
                      fonts:["Literata","Atkinson Hyperlegible Next","Sono"].map(f=>document.fonts.check('500 20px "'+f+'"'))})""")
                    bad = []
                    if info["sw"] > info["cw"]:
                        bad.append("sideways scroll " + str(pg.evaluate(WIDE)))
                    if not all(info["fonts"]):
                        bad.append("fonts " + str(info["fonts"]))
                    if info["keys"] != 1 and name != "15b-lock":
                        bad.append(f"{info['keys']} key answers")
                    if touch:
                        small = pg.evaluate(SMALL)
                        if small:
                            bad.append("small controls " + str(small))
                    if errs:
                        bad.append("errors " + str(errs[:3]))
                        errs.clear()
                    pg.screenshot(path=str(OUT / f"{name}-{w}-{theme}.png"), full_page=True)
                    if name == "15b-lock":
                        pg.fill("#unlock-pass", "example")
                        pg.click("#unlock-go")
                        pg.wait_for_selector("#content .key", timeout=60000)
                    print(f"{name} {w} {theme}: " + ("ok" if not bad else "; ".join(bad)))
                    problems += len(bad)
                ctx.close()
        b.close()
    srv.shutdown()
    print("PROBLEMS:", problems)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())

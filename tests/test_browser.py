"""Headless browser tests of the built app (docs/index.html) in Chromium via Playwright: no network
request with every switch off, no policy violation, every view renders its one key answer, a person's
record is encrypted at rest and opens only with the passphrase, a TransUnion PDF imports through pdf.js
and produces its findings, the framing guard, and Delete everything. Skipped when Playwright or its
Chromium is not installed."""

import functools
import http.server
import runpy
import socketserver
import threading
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
playwright_api = pytest.importorskip("playwright.sync_api")

ROUTES = ["dashboard", "playbook", "reports", "reports/compare/0", "reports/account/0", "findings", "findings/F-01", "findings/accurate/0", "letters/new?after=m4",
          "letters", "letters/view/m4", "tracker", "tracker/rounds", "negotiate", "score", "vault", "settings", "family"]


def _serve(directory):
    class H(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(H, directory=str(directory)))
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


@pytest.fixture(scope="module")
def server():
    build = runpy.run_path(str(ROOT / "web" / "build_pages.py"))
    build["build_docs"](build["build_app"]())
    srv = _serve(ROOT / "docs")
    yield f"http://127.0.0.1:{srv.server_address[1]}"
    srv.shutdown()


@pytest.fixture(scope="module")
def browser():
    with playwright_api.sync_playwright() as p:
        try:
            b = p.chromium.launch()
        except Exception as e:
            pytest.skip(f"Chromium is not available: {e}")
        yield b
        b.close()


def page(browser, server, width=1280):
    ctx = browser.new_context(viewport={"width": width, "height": 900}, accept_downloads=True)
    pg = ctx.new_page()
    pg.errors, pg.reqs, pg.csp = [], [], []
    pg.on("pageerror", lambda e: pg.errors.append(str(e)))
    pg.on("request", lambda r: pg.reqs.append(r.url))
    pg.on("console", lambda m: pg.csp.append(m.text) if "Content Security Policy" in m.text or "Content-Security-Policy" in m.text else None)
    pg.goto(server + "/index.html")
    pg.wait_for_function("() => window.ERRATA_READY === true", timeout=60000)
    return ctx, pg


def open_example(pg):
    pg.click("#try-example")
    pg.wait_for_function("() => document.getElementById('app').dataset.screen === 'dashboard'", timeout=60000)


def go(pg, h):
    pg.evaluate("h => { location.hash = '#/dashboard'; location.hash = h; }", "#/" + h)
    pg.wait_for_timeout(200)


def test_example_every_view_no_requests_no_violations(browser, server):
    ctx, pg = page(browser, server)
    pg.evaluate("document.addEventListener('securitypolicyviolation', e => (window.__v = (window.__v || []).concat([e.violatedDirective])))")
    open_example(pg)
    for r in ROUTES:
        go(pg, r)
        assert pg.locator("#content .key").count() == 1, r
        assert pg.locator("#content .k-fig").inner_text().strip(), r
    go(pg, "settings")
    assert pg.inner_text("#content .k-fig") == "0"
    assert not pg.errors, pg.errors
    assert not pg.csp and not pg.evaluate("window.__v || []")
    outside = [u for u in pg.reqs if not u.startswith(server) and not u.startswith("blob:") and not u.startswith("data:")]
    assert outside == [], outside
    # the copper key answer is the only copper text in the content area
    n = pg.evaluate("""() => { const mark = getComputedStyle(document.documentElement).getPropertyValue('--mark').trim();
      const probe = document.createElement('i'); probe.style.color = mark; document.body.append(probe); const c = getComputedStyle(probe).color; probe.remove();
      return [...document.querySelectorAll('#content *')].filter(e => getComputedStyle(e).color === c && !e.closest('.key') && e.textContent.trim()).length; }""")
    assert n == 0
    ctx.close()


def test_dashboard_next_action_and_deadline_convention(browser, server):
    ctx, pg = page(browser, server)
    open_example(pg)
    assert pg.inner_text("#content .k-fig") == "Follow up with Experian"
    assert "due 10/28" in pg.inner_text("#content .k-sub")
    go(pg, "tracker")
    pg.click("text=Larkspur Card Services")
    t = pg.inner_text("#content")
    assert "Earliest reading 11/11/2026" in t and "uses 11/12/2026" in t
    ctx.close()


def test_letter_preview_traces_every_claim(browser, server):
    ctx, pg = page(browser, server)
    open_example(pg)
    go(pg, "letters/new?after=m4")
    for _ in range(5):
        pg.click("#wiz-next")
    pg.click("#wiz-open")
    pg.wait_for_selector("#letter-paper")
    fig = pg.inner_text("#content .k-fig")
    a, b = fig.split(" of ")
    assert a == b and int(a) >= 3
    paper = pg.inner_text("#letter-paper")
    assert "have not received it" in paper and "Social Security number, last four digits: 0000" in paper
    with pg.expect_download() as d:
        pg.click("#dl-pdf")
    assert d.value.suggested_filename.endswith(".pdf")
    ctx.close()


def test_own_record_is_encrypted_and_pdf_import(browser, server):
    ctx, pg = page(browser, server)
    pg.click("#start-own")
    pg.fill("#np-name", "Casey Tester")
    pg.fill("#np-pass", "correct horse 42")
    pg.fill("#np-pass2", "correct horse 42")
    pg.click("#np-go")
    pg.wait_for_selector("#import-pdf", timeout=60000)
    with pg.expect_file_chooser() as fc:
        pg.click("#import-pdf")
    fc.value.set_files(str(ROOT / "tests" / "fixtures" / "tu_planted.pdf"))
    pg.wait_for_function("() => document.querySelector('#content') && /Round 1 reports/.test(document.querySelector('#content').innerText)", timeout=60000)
    with pg.expect_file_chooser() as fc:
        pg.click("#import-pdf")
    fc.value.set_files(str(ROOT / "tests" / "fixtures" / "ex_planted.pdf"))
    pg.wait_for_function("() => /Experian: check this report/.test(document.querySelector('#content').innerText)", timeout=60000)
    go(pg, "findings")
    text = pg.inner_text("#content")
    assert "Late payments after the account was paid off" in text and "A $0 monthly payment, but payments listed as due" in text
    assert "Collection that doesn't name the original lender" in text
    go(pg, "reports/account/0")
    pg.locator("text=Correct a field").first.click()
    pg.locator("#dlg input").nth(6).fill("$9")
    pg.click("#acct-save")
    pg.wait_for_selector(".toast")
    pg.wait_for_timeout(600)
    rec = pg.evaluate("""() => new Promise((res) => { const r = indexedDB.open('field-tools-errata'); r.onsuccess = () => {
      const tx = r.result.transaction('people'); const all = tx.objectStore('people').getAll(); all.onsuccess = () => res(all.result); }; })""")
    assert len(rec) == 1 and rec[0]["encrypted"] and "ct" in rec[0] and "plain" not in rec[0]
    assert "EXAMPLE CARD BANK" not in str(rec[0]) and rec[0]["iter"] == 600000
    pg.click("#lockbtn")
    pg.fill("#unlock-pass", "wrong passphrase")
    pg.click("#unlock-go")
    pg.wait_for_function("() => /does not open/.test(document.querySelector('#unlock-msg').textContent)", timeout=60000)
    pg.fill("#unlock-pass", "correct horse 42")
    pg.click("#unlock-go")
    pg.wait_for_selector("#lock", state="hidden", timeout=60000)
    assert "Casey Tester" in pg.inner_text("#nav")
    go(pg, "settings")
    pg.fill("#del-confirm", "DELETE")
    pg.click("#delete-all")
    pg.wait_for_selector("#start-own", timeout=60000)
    n = pg.evaluate("""() => new Promise((res) => { const r = indexedDB.open('field-tools-errata'); r.onsuccess = () => {
      const tx = r.result.transaction('people'); const c = tx.objectStore('people').count(); c.onsuccess = () => res(c.result); }; r.onupgradeneeded = () => {}; })""")
    assert n == 0
    assert not pg.errors, pg.errors
    ctx.close()


def test_framing_guard(browser, server, tmp_path):
    (tmp_path / "frame.html").write_text(f'<!doctype html><iframe id="f" src="{server}/index.html" width="800" height="600"></iframe>')
    other = _serve(tmp_path)
    ctx = browser.new_context()
    pg = ctx.new_page()
    pg.goto(f"http://localhost:{other.server_address[1]}/frame.html")
    fr = pg.frame_locator("#f")
    fr.locator("#framed").wait_for(timeout=30000)
    assert "own tab" in fr.locator("#framed").inner_text()
    assert fr.locator("#app").is_hidden()
    ctx.close()
    other.shutdown()


def test_phone_layout_has_tabs_and_no_sideways_scroll(browser, server):
    ctx, pg = page(browser, server, width=400)
    open_example(pg)
    for r in ("dashboard", "findings", "reports/compare/0", "score"):
        go(pg, r)
        assert pg.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth"), r
    assert pg.is_visible("#tabbar") and pg.is_hidden("#nav")
    pg.click("#tab-more")
    assert pg.is_visible(".more")
    ctx.close()


def new_person(pg, name="Casey Tester", passphrase="correct horse 42"):
    pg.click("#start-own")
    pg.fill("#np-name", name)
    pg.fill("#np-pass", passphrase)
    pg.fill("#np-pass2", passphrase)
    pg.click("#np-go")
    pg.wait_for_selector("#import-pdf", timeout=60000)


def test_saved_page_import_and_walker_parity(browser, server):
    import sys
    sys.path.insert(0, str(ROOT / "src"))
    from errata import htmltext
    ctx, pg = page(browser, server)
    new_person(pg)
    for name in ("tu_saved.html", "ex_saved.html"):
        text = (ROOT / "tests" / "fixtures" / name).read_text(encoding="utf-8")
        assert pg.evaluate("t => CORE.html_dom_lines(new DOMParser().parseFromString(t, 'text/html'))", text) == htmltext.html_lines(text), name
    with pg.expect_file_chooser() as fc:
        pg.click("#import-pdf")
    fc.value.set_files(str(ROOT / "tests" / "fixtures" / "tu_saved.html"))
    pg.wait_for_function("() => /Round 1 reports/.test(document.querySelector('#content').innerText)", timeout=60000)
    go(pg, "findings")
    t = pg.inner_text("#content")
    assert "Late payments after the account was paid off" in t and "Collection that doesn't name the original lender" in t
    outside = [u for u in pg.reqs if not u.startswith(server) and not u.startswith("blob:") and not u.startswith("data:")]
    assert outside == [], outside
    assert not pg.errors, pg.errors
    ctx.close()


def test_negotiation_workspace_holds_payment(browser, server):
    ctx, pg = page(browser, server)
    open_example(pg)
    go(pg, "negotiate")
    assert pg.inner_text("#content .k-lbl").lower() == "offers in writing"
    pg.select_option("#of-other", index=1)
    pg.select_option("#of-other-kind", "pay_for_delete")
    pg.click("#of-start")
    pg.wait_for_selector("[id^=offer-]")
    card = pg.inner_text("[id^=offer-]")
    assert "Send the written offer. Do not pay anything yet." in card and "Before you pay: the written agreement" in card
    assert "statute of limitations" in card
    assert not pg.errors, pg.errors
    ctx.close()


def test_texas_review_letter_and_lock_forgets(browser, server):
    ctx, pg = page(browser, server)
    open_example(pg)
    go(pg, "letters/new?kind=oag_review_request")
    pg.click("#wiz-next")
    pg.fill("#wiz-ndate", "2026-10-01")
    pg.dispatch_event("#wiz-ndate", "change")
    pg.fill("#wiz-nrec", "2026-10-06")
    pg.dispatch_event("#wiz-nrec", "change")
    pg.fill("#wiz-why", "The notice lists arrears my payment record does not show.")
    pg.dispatch_event("#wiz-why", "change")
    pg.fill("#wiz-rec", "Office of the Attorney General\nChild Support Division\nP.O. Box 0000\nAnytown, TX 75000")
    pg.dispatch_event("#wiz-rec", "change")
    assert "Postmark it by 11/05/2026" in pg.inner_text("#content")
    for _ in range(4):
        pg.click("#wiz-next")
    pg.click("#wiz-open")
    pg.wait_for_selector("#letter-paper")
    paper = pg.inner_text("#letter-paper")
    assert "administrative review hearing" in paper and "Date of birth" not in paper and "Social Security" not in paper
    pg.click("#lockbtn")
    pg.wait_for_selector("#unlock-pass")
    assert pg.evaluate("() => !/administrative review|Larkspur/.test(document.getElementById('content').textContent) && !document.querySelector('#toasts .toast')")
    assert pg.is_visible("#unlock-pass")
    assert not pg.errors, pg.errors
    ctx.close()


def test_service_keys_stay_in_the_encrypted_record(browser, server):
    ctx, pg = page(browser, server)
    new_person(pg)
    go(pg, "settings")
    pg.click("#net-ai-cloud")
    pg.fill("#ai-base", "http://localhost:11434/v1")
    pg.fill("#ai-model", "example-model")
    pg.fill("#ai-key", "sk-test-secret-123")
    pg.click("text=Save >> nth=0")
    pg.wait_for_timeout(800)
    dump = pg.evaluate("""() => new Promise((res) => { const r = indexedDB.open('field-tools-errata'); r.onsuccess = () => {
      const out = {}; const tx = r.result.transaction(['kv', 'people']); const k = tx.objectStore('kv').getAllKeys(); const p = tx.objectStore('people').getAll();
      tx.oncomplete = () => res({ kv: k.result, people: JSON.stringify(p.result) }); }; })""")
    assert "aiKey" not in dump["kv"] and "mailKey" not in dump["kv"]
    assert "sk-test-secret-123" not in dump["people"]
    go(pg, "settings")
    assert pg.get_attribute("#net-updates", "aria-checked") == "false"
    assert not pg.errors, pg.errors
    ctx.close()


def test_restore_from_welcome_screen(browser, server, tmp_path):
    ctx, pg = page(browser, server)
    new_person(pg, "Robin Restore", "restore phrase 77")
    go(pg, "settings")
    with pg.expect_download() as d:
        pg.click("#export")
    path = tmp_path / "backup.json"
    d.value.save_as(str(path))
    pg.fill("#del-confirm", "DELETE")
    pg.click("#delete-all")
    pg.wait_for_selector("#restore-welcome", timeout=60000)
    with pg.expect_file_chooser() as fc:
        pg.click("#restore-welcome")
    fc.value.set_files(str(path))
    pg.wait_for_function("() => /Restored 1 person/.test(document.body.innerText)", timeout=60000)
    ctx.close()


def test_pdf_import_falls_back_when_the_worker_cannot_start(browser, server):
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    ctx.add_init_script("window.Worker = function () { throw new Error('module workers are not available'); };")
    pg = ctx.new_page()
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(server + "/index.html")
    pg.wait_for_function("() => window.ERRATA_READY === true", timeout=60000)
    new_person(pg)
    with pg.expect_file_chooser() as fc:
        pg.click("#import-pdf")
    fc.value.set_files(str(ROOT / "tests" / "fixtures" / "tu_planted.pdf"))
    pg.wait_for_function("() => /Round 1 reports/.test(document.querySelector('#content').innerText)", timeout=90000)
    assert not errors
    ctx.close()


def test_published_copy_still_runs_after_link_fill(browser, tmp_path):
    # The publish step fills https://wjwhitmire.github.io/errata/-style marks in every file. No script the page's policy
    # fingerprints may contain one, or the filled page would refuse to run. Fill, then load it.
    import re, shutil
    site = tmp_path / "wjwhitmire.github.io" / "errata"
    shutil.copytree(ROOT / "docs", site)
    html = (site / "index.html").read_text(encoding="utf-8")
    for body in re.findall(r"<script[^>]*>(.*?)</script>", html, re.S):
        assert not re.search(r"\{\{(LIVE_URL|REPO_URL|GITHUB_USER)\}\}", body)
    filled = html.replace("https://wjwhitmire.github.io/errata/", "https://example.github.io/errata/").replace("https://github.com/wjwhitmire/errata", "https://github.com/example/errata").replace("wjwhitmire", "example")
    (site / "index.html").write_text(filled, encoding="utf-8")
    srv = _serve(site.parent)
    try:
        ctx = browser.new_context()
        pg = ctx.new_page()
        pg.goto(f"http://127.0.0.1:{srv.server_address[1]}/errata/index.html")
        pg.wait_for_function("() => window.ERRATA_READY === true", timeout=60000)
        ctx.close()
    finally:
        srv.shutdown()

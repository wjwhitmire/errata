"""The published page (docs/ with the publish step's link fill, served over https at
OWNER.github.io/errata/) driven through its main workflows in headless Chromium:

- Build my letters: a new person imports a synthetic TransUnion, Experian or Equifax report, opens
  Build from the dashboard, confirms the identity card once, answers yes or no questions, and prints
  one PDF packet. Every expected recipient gets a letter with the right address; bureau letters carry
  the date of birth and SSN last four, lender and collector letters never do; the mailing log gets one
  entry per letter waiting for its tracking number.
- Answers change the letters: a "no" to "did the collector contact you first" adds a validation
  letter, and changing it to "yes" takes it away.
- The update check finds its address from where the page is served, and the service worker starts.

Skipped when Playwright or its Chromium is not installed."""

import io
import json
import os
import mimetypes
import re
import shutil
import zipfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
FIX = ROOT / "tests" / "fixtures"
api = pytest.importorskip("playwright.sync_api")
OWNER, NAME = "example-owner", "errata"
ORIGIN = f"https://{OWNER}.github.io"
BASE = f"{ORIGIN}/{NAME}/"
FILL = {"https://wjwhitmire.github.io/errata/": BASE, "wjwhitmire": OWNER, "https://github.com/wjwhitmire/errata": f"https://github.com/{OWNER}/{NAME}"}


@pytest.fixture(scope="module")
def site(tmp_path_factory):
    out = tmp_path_factory.mktemp("pub") / NAME
    shutil.copytree(ROOT / "docs", out)
    for f in out.rglob("*"):
        if f.is_file():
            raw = f.read_bytes()
            if b"{{" in raw:
                for k, v in FILL.items():
                    raw = raw.replace(k.encode(), v.encode())
                f.write_bytes(raw)
    return out


@pytest.fixture(scope="module")
def browser():
    # the service worker's own fetches reach the routed site only with this switch (Chromium)
    os.environ.setdefault("PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS", "1")
    with api.sync_playwright() as p:
        try:
            b = p.chromium.launch()
        except Exception as e:  # noqa: BLE001
            pytest.skip(f"Chromium is not available: {e}")
        yield b
        b.close()


def open_page(browser, site, width=1280, sw="block", github=None):
    mimetypes.add_type("application/manifest+json", ".webmanifest")
    mimetypes.add_type("application/wasm", ".wasm")
    ctx = browser.new_context(viewport={"width": width, "height": 900}, accept_downloads=True, service_workers=sw)

    def serve(route):
        rel = route.request.url.split(BASE, 1)[-1].split("?", 1)[0].split("#", 1)[0] or "index.html"
        f = site / rel
        if f.is_file():
            route.fulfill(status=200, body=f.read_bytes(), content_type=mimetypes.guess_type(f.name)[0] or "application/octet-stream")
        else:
            route.fulfill(status=404, body="")
    ctx.route(f"{ORIGIN}/**", serve)
    ctx.route("https://api.github.com/**", github or (lambda r: r.abort()))
    pg = ctx.new_page()
    pg.set_default_timeout(90000)
    pg.errors, pg.reqs = [], []
    pg.on("pageerror", lambda e: pg.errors.append(str(e)))
    pg.on("request", lambda r: pg.reqs.append(r.url))
    pg.add_init_script("window.__v = []; document.addEventListener('securitypolicyviolation', e => window.__v.push(e.violatedDirective))")
    pg.goto(BASE)
    pg.wait_for_function("() => window.ERRATA_READY === true")
    return ctx, pg


def new_person(pg):
    pg.click("#start-own")
    pg.fill("#np-name", "Casey Tester")
    pg.fill("#np-pass", "correct horse 42")
    pg.fill("#np-pass2", "correct horse 42")
    pg.click("#np-go")
    pg.wait_for_selector("#import-pdf")


def import_file(pg, name):
    with pg.expect_file_chooser() as fc:
        pg.click("#import-pdf")
    fc.value.set_files(str(FIX / name))
    pg.wait_for_function("() => /Round 1 reports/.test(document.querySelector('#content').innerText)")


def go(pg, h):
    pg.evaluate("h => { location.hash = '#/dashboard'; location.hash = h; }", "#/" + h)
    pg.wait_for_timeout(150)


def key(pg):
    return pg.inner_text("#content .k-fig").strip()


def answer_all(pg, choose):
    """Answer every open question with choose(question text) -> 'yes' | 'no' | 'unsure'."""
    for _ in range(40):
        q = pg.locator(".qcard:not(:has(button[aria-pressed=true]))").first
        if not q.count():
            return
        word = choose(q.locator(".qq").inner_text())
        q.locator(f"button[id^=q-{word}-]").click()
        pg.wait_for_timeout(200)


def pdf_text(path):
    from pdfminer.high_level import extract_text
    return extract_text(str(path))


def letters_in(text):
    """[(recipient, letter text)] for each letter in a packet: a cover sheet, the letter, an envelope."""
    out = []
    for part in text.split("Mailing cover sheet")[1:]:
        to = part.split("Send to", 1)[1].strip().splitlines()[0].strip()
        out.append((to, part))
    return out


EXPECTED_TU = {"TransUnion Consumer Solutions": 4, "OLD EXAMPLE RETAIL": 1, "EXAMPLE SECURED CARD": 1, "EXAMPLE STATE CHILD SUPPORT OFFICE": 1,
               "NORTHWIND EXAMPLE BANK": 1, "MIDTOWN EXAMPLE CARD": 1, "SAMPLE AUTO FINANCE": 1, "TEST RECEIVABLES LLC": 2, "PAYLATER EXAMPLE INC": 2,
               "EXAMPLE DEBT BUYERS LLC": 1, "SAMPLE ASSET RECOVERY": 1, "EXAMPLE LENDING CO": 1, "SAMPLE AUTO GROUP": 1}


def test_one_click_letters_from_a_transunion_report(browser, site, tmp_path):
    """Import, Build, confirm, answer, Print: the only inputs are the identity card, yes or no and Print."""
    ctx, pg = open_page(browser, site)
    new_person(pg)
    import_file(pg, "tu_planted.pdf")
    go(pg, "dashboard")
    assert re.fullmatch(r"Build my letters \(\d+ ready\)", key(pg))
    pg.click("#next-go")
    pg.wait_for_selector("#build-list")
    assert key(pg) == "13" and pg.is_disabled("#build-print")
    card = pg.inner_text("#identity")
    assert "Jordan Quinn Sample" in card and "100 Example Ave, Anytown, TX 75001-1234" in card
    pg.click("#id-confirm")
    pg.wait_for_function("() => !document.querySelector('#build-print').disabled")
    # collectors did not contact first, the names are not used, no applications, no relief
    answer_all(pg, lambda t: "yes" if "use the name" in t else "no")
    assert key(pg) == "18"
    with pg.expect_download() as d:
        pg.click("#build-print")
    path = tmp_path / d.value.suggested_filename
    d.value.save_as(str(path))
    assert path.read_bytes().startswith(b"%PDF")
    text = pdf_text(path)
    got = {}
    for to, part in letters_in(text):
        got[to] = got.get(to, 0) + 1
        bureau = to.startswith("TransUnion")
        assert ("Social Security number, last four digits: 0000" in part) == bureau, to
        assert ("Date of birth" in part) == bureau, to
        assert "Jordan Quinn Sample" in part and "Envelope" in part and "Certified mail worksheet" in part
    assert got == EXPECTED_TU, got
    assert "PO BOX 0003" in text and "address from your report" in text.lower()
    go(pg, "dashboard")
    assert key(pg) == "Mail them and type the tracking numbers"
    go(pg, "letters/build")
    assert pg.locator("#drafts li").count() == 18
    pg.locator("[id^=trk-]").first.fill("9400111899223344556677")
    pg.locator("[id^=mailed-]").first.click()
    pg.wait_for_timeout(400)
    assert pg.locator("#drafts li").count() == 17
    go(pg, "letters")
    assert "9400111899223344556677" in pg.inner_text("#content")
    assert not pg.errors, pg.errors
    assert not pg.evaluate("window.__v")
    assert [u for u in pg.reqs if not u.startswith(BASE) and not u.startswith(("blob:", "data:"))] == []
    ctx.close()


@pytest.mark.parametrize("fixture,bureau,lender", [("ex_planted.pdf", "Experian", "Old Sample Collections"), ("eq_planted.pdf", "Equifax", "Sample Student Services")])
def test_one_click_letters_from_template_reports(browser, site, tmp_path, fixture, bureau, lender):
    ctx, pg = open_page(browser, site)
    new_person(pg)
    import_file(pg, fixture)
    go(pg, "letters/build")
    assert int(key(pg)) >= 3
    listing = pg.inner_text("#build-list")
    assert f"Ask {bureau} to fix errors" in listing and lender in listing
    # the report has no SSN digits: the card asks for them right there, and no address for the lender: it asks for that too
    pg.fill("#id-ssn", "1234")
    pg.click("#id-confirm")
    pg.wait_for_function("() => !document.querySelector('#build-print').disabled")
    assert "has no mailing address" in pg.inner_text("#build-list")
    pg.locator("[id^=addr1-]").first.fill("PO Box 77")
    pg.locator("[id^=addr2-]").first.fill("Testville, OH 44000")
    pg.locator("text=Save the address").first.click()
    pg.wait_for_timeout(300)
    assert "PO Box 77" in pg.inner_text("#build-list")
    with pg.expect_download() as d:
        pg.click("#build-print")
    path = tmp_path / "p.pdf"
    d.value.save_as(str(path))
    parts = letters_in(pdf_text(path))
    assert any(to.startswith(bureau) and "last four digits: 1234" in p for to, p in parts)
    assert all("1234" not in p for to, p in parts if not to.startswith(bureau))
    assert not pg.errors, pg.errors
    ctx.close()


def test_answers_update_the_letters(browser, site):
    ctx, pg = open_page(browser, site)
    new_person(pg)
    import_file(pg, "tu_planted.pdf")
    go(pg, "letters/build")
    before = int(key(pg))
    q = pg.locator(".qcard", has_text="Did Example Debt Buyers LLC contact you").first
    q.locator("button[id^=q-no-]").click()
    pg.wait_for_timeout(300)
    assert int(key(pg)) == before + 1
    assert "Example Debt Buyers LLC" in pg.inner_text("#build-list")
    q = pg.locator(".qcard", has_text="Did Example Debt Buyers LLC contact you").first
    q.locator("button[id^=q-yes-]").click()
    pg.wait_for_timeout(300)
    assert int(key(pg)) == before
    assert "Example Debt Buyers LLC" not in pg.inner_text("#build-list")
    # the answered question stays on screen so the answer can be changed back
    assert pg.locator(".qcard", has_text="Did Example Debt Buyers LLC contact you").count() == 1
    # the finding page asks the same question in the same words
    go(pg, "findings")
    pg.locator("a.t1", has_text="Collector may have reported before contacting you").first.click()
    pg.wait_for_timeout(200)
    assert "Did " in pg.inner_text("#finding-detail") and "Why this works (the law)" in pg.inner_text("#finding-detail")
    assert pg.locator("details#law[open]").count() == 0
    assert not pg.errors, pg.errors
    ctx.close()


def test_word_files_open(browser, site, tmp_path):
    ctx, pg = open_page(browser, site)
    new_person(pg)
    import_file(pg, "tu_planted.pdf")
    go(pg, "letters/build")
    with pg.expect_download() as d:
        pg.click("#build-docx")
    z = zipfile.ZipFile(io.BytesIO(Path(d.value.path()).read_bytes()))
    names = z.namelist()
    assert len(names) == 13 and len(set(names)) == 13
    for n in names:
        inner = zipfile.ZipFile(io.BytesIO(z.read(n)))
        assert "word/document.xml" in inner.namelist()
        assert b"Jordan Quinn Sample" in inner.read("word/document.xml")
    ctx.close()


def test_update_check_uses_the_address_it_is_served_from(browser, site):
    calls = []

    def github(route):
        calls.append(route.request.url)
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"tag_name": "v99.0.0", "html_url": f"https://github.com/{OWNER}/{NAME}/releases/tag/v99.0.0"}))
    ctx, pg = open_page(browser, site, github=github)
    new_person(pg)
    go(pg, "settings")
    assert "api.github.com" in pg.inner_text("#content") and pg.get_attribute("#net-updates", "aria-checked") == "false"
    assert calls == []
    pg.click("#net-updates")
    pg.reload()
    pg.wait_for_function("() => window.ERRATA_READY === true")
    pg.fill("#unlock-pass", "correct horse 42")
    pg.click("#unlock-go")
    pg.wait_for_selector("#lock", state="hidden")
    pg.wait_for_function("() => /v99.0.0/.test(document.body.innerText)")
    assert calls == [f"https://api.github.com/repos/{OWNER}/{NAME}/releases/latest"]
    ctx.close()


def test_service_worker_starts_and_serves_offline(browser, site):
    ctx, pg = open_page(browser, site, sw="allow")
    pg.set_default_timeout(30000)
    pg.evaluate("() => navigator.serviceWorker.ready.then(() => true)")
    pg.reload()
    pg.wait_for_function("() => navigator.serviceWorker.controller !== null")
    shell = pg.evaluate("async () => { const ks = await caches.keys(); const c = await caches.open(ks.find(k => k.startsWith('app-shell-'))); return (await c.keys()).map(r => r.url); }")
    assert BASE + "index.html" in shell and any(u.endswith("atkinson-hyperlegible-next-latin-wght-normal.woff2") for u in shell)
    ctx.set_offline(True)
    pg.reload()
    pg.wait_for_function("() => window.ERRATA_READY === true")
    assert not pg.evaluate("window.__v")
    ctx.close()


# ---------------------------------------------------------------- regressions found in the full pass
def test_pdf_reader_falls_back_when_the_worker_reports_an_error(browser, site):
    # a worker that starts and then fires an error event (as a module worker does where it cannot run)
    init = """window.Worker = function () { const t = new EventTarget(); t.postMessage = () => {}; t.terminate = () => {};
      setTimeout(() => t.dispatchEvent(new Event('error')), 50); return t; };"""
    ctx, pg = open_page(browser, site)
    pg.add_init_script(init)
    pg.reload()
    pg.wait_for_function("() => window.ERRATA_READY === true")
    new_person(pg)
    t0 = __import__("time").time()
    import_file(pg, "tu_planted.pdf")
    assert __import__("time").time() - t0 < 20
    assert not pg.errors, pg.errors
    ctx.close()


def test_single_file_copy_imports_a_pdf_from_disk(browser):
    ctx = browser.new_context(accept_downloads=True)
    pg = ctx.new_page()
    pg.set_default_timeout(30000)
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto((ROOT / "web" / "app.html").as_uri())
    pg.wait_for_function("() => window.ERRATA_READY === true")
    new_person(pg)
    import_file(pg, "tu_planted.pdf")
    assert not errors, errors
    ctx.close()


def test_plain_http_copy_explains_instead_of_hanging(browser, site):
    ctx = browser.new_context()
    ctx.route("http://example-owner.github.io/**", lambda r: r.fulfill(status=200, body=(site / "index.html").read_bytes(), content_type="text/html")
              if r.request.url.endswith("/") or r.request.url.endswith(".html") else r.fulfill(status=404, body=""))
    pg = ctx.new_page()
    pg.goto("http://example-owner.github.io/errata/")
    pg.wait_for_function("() => window.ERRATA_READY === true")
    assert "can't keep your data safe" in pg.inner_text("#content")
    ctx.close()


def test_damaged_backup_record_still_opens(browser, site, tmp_path):
    bad = {"format": "errata-backup", "version": 1, "people": [{"id": "p-000000000001", "name": "Dana Damaged", "initials": "DD", "relationship": "You", "encrypted": False,
                                                                 "plain": {"rounds": "boom", "mail": 5, "profile": {"facts": [], "mailing": "x"}, "vault": [None, 3]}}]}
    f = tmp_path / "damaged.json"
    f.write_text(json.dumps(bad))
    ctx, pg = open_page(browser, site)
    with pg.expect_file_chooser() as fc:
        pg.click("#restore-welcome")
    fc.value.set_files(str(f))
    pg.wait_for_function("() => /Restored 1 person/.test(document.body.innerText)")
    pg.reload()
    pg.wait_for_function("() => window.ERRATA_READY === true")
    for r in ("dashboard", "findings", "letters/build", "letters", "tracker", "vault", "settings"):
        go(pg, r)
        assert "could not be shown" not in pg.inner_text("#content"), r
    assert not pg.errors, pg.errors
    ctx.close()


def test_undo_is_one_step_and_one_report_has_its_payment_grid(browser, site):
    ctx, pg = open_page(browser, site)
    new_person(pg)
    import_file(pg, "tu_planted.pdf")
    go(pg, "reports/account/0")
    assert pg.locator(".pg button").count() > 12  # one bureau's report still shows each account's grid
    pg.locator("text=Correct a field").first.click()
    pg.locator("#dlg input").nth(7).fill("$123")
    pg.click("#acct-save")
    pg.wait_for_timeout(300)
    # only the latest toast can undo; undoing the import now would also throw away the correction
    assert pg.locator("#toasts .toast", has_text="Imported").locator("button").count() == 0
    assert pg.locator("#toasts .toast", has_text="Corrections saved").locator("button").count() == 1
    ctx.close()


def test_labels_stay_put_and_a_logged_reinsertion_notice_clears_the_warning(browser, site):
    ctx, pg = open_page(browser, site)
    pg.click("#try-example")
    pg.wait_for_function("() => document.getElementById('app').dataset.screen === 'dashboard'")
    go(pg, "findings")
    pg.locator("a.t1", has_text="Collector may have reported").first.click()
    label = pg.evaluate("location.hash")
    pg.locator(".qcard button[id^=q-no-]").first.click()
    pg.wait_for_timeout(300)
    assert pg.evaluate("location.hash") == label and "Collector may have reported" in pg.inner_text("#finding-detail")
    go(pg, "tracker/rounds")
    assert "Reinserted without the required notice" in pg.inner_text("#content")
    pg.locator("button", has_text="I did get a notice").click()
    pg.wait_for_timeout(300)
    assert "Reinserted without the required notice" not in pg.inner_text("#content")
    assert "You logged the bureau's notice" in pg.inner_text("#content")
    ctx.close()

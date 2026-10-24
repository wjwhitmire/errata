"""Saved web-page reports (annualcreditreport.com and the bureaus' own sites, saved with the
browser's "Save page as") read into the same lines of cells the PDF readers use.

The page is read as text only: scripts, styles, frames and embedded objects are skipped, nothing
is fetched and nothing runs. Every table row becomes one line with one cell per table cell (empty
cells keep their place, so columns such as the months of a payment history stay aligned); a
definition term and its description become one line of two cells; every other block of text
becomes a one-cell line. The lines are laid out as positioned items so the template reader
(errata.generic) reads them exactly as it reads a PDF's text layer.

How the bureaus' saved pages are laid out was not available while this was built: this reader was
written from the general structure of a web page and tested on synthetic pages only. It says so on
every report it reads, keeps every value's raw text, and the person checks the accounts against the
page. Twin: web/src/core/14_html.js (the walk over the parsed page is in web/src/ui/34_reports.js,
because only the browser has the page's DOM).
"""

import re
from html.parser import HTMLParser

from .util import CreditError, norm_space

MAX_BYTES = 20 * 1024 * 1024
MAX_LINES = 60000
SKIP = {"script", "style", "noscript", "template", "svg", "iframe", "object", "embed", "canvas", "math", "select", "textarea"}
BLOCK = {"address", "article", "aside", "blockquote", "body", "caption", "center", "dd", "details", "dialog", "div", "dl", "dt",
         "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "html", "legend",
         "li", "main", "nav", "ol", "p", "pre", "section", "summary", "table", "tbody", "tfoot", "thead", "title", "ul"}
CELL = {"td", "th"}


class Lines:
    """The walk, as events: start(tag), end(tag), text(data). The browser twin feeds the same events
    from the page's DOM, so both produce the same lines for a well-formed page. End tags a browser
    would imply (a cell, row, term or description left open) are implied here the same way."""

    def __init__(self):
        self.lines, self.buf, self.row, self.cell, self.skip = [], "", None, None, 0
        self.label, self.in_dt, self.in_dd = None, False, False

    def _flush(self):
        t = norm_space(self.buf)
        self.buf = ""
        if t:
            self.lines.append([t])

    def _close_cell(self):
        if self.cell is not None:
            self.row.append(norm_space(self.cell))
            self.cell = None

    def _close_row(self):
        self._close_cell()
        if self.row is not None:
            if any(self.row):
                while self.row and not self.row[-1]:
                    self.row.pop()
                self.lines.append(self.row)
            self.row = None

    def _end_dt(self):
        if self.in_dt:
            if self.label:
                self.lines.append([self.label])
            self.label = norm_space(self.buf)
            self.buf = ""
            self.in_dt = False

    def _end_dd(self):
        if self.in_dd:
            value = norm_space(self.buf)
            self.buf = ""
            if self.label and value:
                self.lines.append([self.label, value])
            elif self.label or value:
                self.lines.append([self.label or value])
            self.label, self.in_dd = None, False

    def _end_dl(self):
        self._end_dd()
        self._end_dt()
        if self.label:
            self.lines.append([self.label])
            self.label = None

    def start(self, tag):
        if self.skip or tag in SKIP:
            if tag in SKIP:
                self.skip += 1
            return
        if tag == "br":
            if self.cell is not None:
                self.cell += " "
            elif not (self.in_dt or self.in_dd):
                self._flush()
            else:
                self.buf += " "
            return
        if tag == "tr":
            self._flush()
            self._close_row()
            self.row = []
            return
        if tag in CELL:
            if self.row is None:
                self._flush()
                self.row = []
            self._close_cell()
            self.cell = ""
            return
        if self.cell is not None:
            self.cell += " "
            return
        if tag == "dt":
            self._end_dd()
            self._end_dt()
            if self.label:
                self.lines.append([self.label])
                self.label = None
            self._flush()
            self.in_dt = True
            return
        if tag == "dd":
            self._end_dt()
            self._end_dd()
            if self.label is None:
                self._flush()
            self.buf = ""
            self.in_dd = True
            return
        if self.in_dt or self.in_dd:
            self.buf += " "
            return
        if tag in BLOCK:
            if tag in ("table", "dl"):
                self._close_row()
            self._flush()

    def end(self, tag):
        if self.skip:
            if tag in SKIP:
                self.skip -= 1
            return
        if tag in CELL:
            self._close_cell()
            return
        if tag == "tr":
            self._close_row()
            return
        if self.cell is not None:
            if tag in ("table", "tbody", "thead", "tfoot"):
                self._close_row()
            else:
                self.cell += " "
                return
        if tag == "dt":
            self._end_dt()
            return
        if tag == "dd":
            self._end_dd()
            return
        if tag == "dl":
            self._end_dl()
            self._flush()
            return
        if self.in_dt or self.in_dd:
            self.buf += " "
            return
        if tag in BLOCK:
            if tag in ("table", "tbody", "thead", "tfoot"):
                self._close_row()
            self._flush()

    def text(self, data):
        if self.skip:
            return
        if self.cell is not None:
            self.cell += data
        else:
            self.buf += data

    def done(self):
        self._close_row()
        self._end_dl()
        self._flush()
        return self.lines


class _Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.w = Lines()

    def handle_starttag(self, tag, attrs):
        self.w.start(tag.lower())

    def handle_startendtag(self, tag, attrs):
        t = tag.lower()
        self.w.start(t)
        if t not in ("br", "hr", "img", "input", "meta", "link", "wbr", "area", "base", "col", "source", "track", "param"):
            self.w.end(t)

    def handle_endtag(self, tag):
        self.w.end(tag.lower())

    def handle_data(self, data):
        self.w.text(data)


def html_lines(text):
    """Lines of cells from a saved page's HTML text."""
    text = str(text or "")
    if len(text.encode("utf-8", "ignore")) > MAX_BYTES:
        raise CreditError("html", "This page is larger than 20 MB, which is far more than a credit report.")
    p = _Parser()
    p.feed(text)
    p.close()
    lines = p.w.done()
    if len(lines) > MAX_LINES:
        raise CreditError("html", "This page has too many lines to be a credit report.")
    return lines


def items_from_lines(lines):
    """Lay the lines out as positioned items: one line every 14 points, cells in fixed columns."""
    items = []
    for i, cells in enumerate(lines):
        for k, c in enumerate(cells):
            if not c:
                continue
            items.append({"p": 0, "x": 40 + 150 * k, "y": 20 + 14 * i, "w": min(140, 5 * len(c)), "h": 10, "s": c})
    return items


BUREAU_WORDS = (("transunion", re.compile(r"\bTransUnion\b", re.I)), ("experian", re.compile(r"\bExperian\b", re.I)),
                ("equifax", re.compile(r"\bEquifax\b", re.I)))


def detect_html(lines):
    """The bureau a saved page is from: the one named in its first lines, or the one it names most."""
    head = " ".join(" ".join(c) for c in lines[:40])
    for b, rx in BUREAU_WORDS:
        if rx.search(head) and not any(rx2.search(head) for b2, rx2 in BUREAU_WORDS if b2 != b):
            return b
    whole = " ".join(" ".join(c) for c in lines)
    counts = sorted(((len(rx.findall(whole)), b) for b, rx in BUREAU_WORDS), reverse=True)
    if counts[0][0] and counts[0][0] > counts[1][0]:
        return counts[0][1]
    return None


HTML_NOTE = ("Read from a saved web page with the template reader, which was built without a real saved report to test against. "
             "Check every account against the page before you use it.")


def parse_lines(lines, report_date="", bureau=""):
    from . import generic
    b = bureau or detect_html(lines)
    if b not in ("transunion", "experian", "equifax"):
        raise CreditError("parse", "This page does not look like a TransUnion, Experian or Equifax report. Save the report page itself, or print it to PDF.")
    r = generic.parse(items_from_lines(lines), report_date, b)
    r["source"]["kind"] = "html"
    r["source"]["parser"] = r["source"]["parser"].replace("-template-", "-html-template-")
    r["source"]["pages"] = 1
    r["messages"].insert(0, HTML_NOTE)
    return r


def parse_html(text, report_date="", bureau=""):
    return parse_lines(html_lines(text), report_date, bureau)

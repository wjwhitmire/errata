"""Read a PDF's text layer into positioned items with pdfminer.six (optional dependency,
`pip install errata[pdf]`). Characters are grouped into runs the way pdf.js reports them in
the browser: a run ends at a change of baseline or at a gap wider than a fraction of the font size
with no space character in it.
"""

from .util import CreditError

MAX_BYTES = 50 * 1024 * 1024
MAX_PAGES = 400


def pdf_items(path):
    try:
        from pdfminer.high_level import extract_pages
        from pdfminer.layout import LAParams, LTChar, LTTextContainer
    except ImportError as e:  # pragma: no cover
        raise CreditError("pdf", "Reading PDFs needs pdfminer.six: pip install errata[pdf]") from e
    with open(path, "rb") as f:
        head = f.read(1024)
        f.seek(0, 2)
        size = f.tell()
    if size > MAX_BYTES:
        raise CreditError("pdf", "This PDF is larger than 50 MB.")
    if b"%PDF" not in head:
        raise CreditError("pdf", "This file is not a PDF (no %PDF header near the start).")
    items = []

    def chars(obj):
        if isinstance(obj, LTChar):
            yield obj
            return
        if hasattr(obj, "__iter__"):
            for o in obj:
                yield from chars(o)

    for pno, page in enumerate(extract_pages(path, laparams=LAParams(char_margin=0.5, line_margin=0.1))):
        if pno >= MAX_PAGES:
            raise CreditError("pdf", "This PDF has more than 400 pages.")
        height = page.height
        run = None
        page_chars = []
        for obj in page:
            if isinstance(obj, LTTextContainer) or hasattr(obj, "__iter__"):
                page_chars.extend(chars(obj))
        # stream order is lost inside pdfminer's layout boxes; sort by baseline then x
        page_chars.sort(key=lambda c: (round(height - c.matrix[5], 1), c.matrix[4]))
        for c in page_chars:
            t = c.get_text()
            if t.startswith("(cid:"):
                continue
            size = c.size or abs(c.matrix[3]) or 10
            base = height - c.matrix[5]
            x0, x1 = c.matrix[4], c.matrix[4] + c.adv
            if run is not None:
                same_line = abs(base - run["y"]) <= 0.5
                gap = x0 - run["x2"]
                if same_line and -0.5 * size <= gap <= 0.15 * size:
                    run["s"] += t
                    run["x2"] = x1
                    continue
                if same_line and t == " " and gap <= 0.5 * size:
                    run["s"] += t
                    run["x2"] = x1
                    continue
                items.append(run)
            run = {"p": pno, "x": x0, "y": base, "x2": x1, "h": size, "s": t}
        if run is not None:
            items.append(run)
    out = []
    for r in items:
        s = r["s"].rstrip()
        if not s.strip():
            continue
        lead = len(s) - len(s.lstrip())
        out.append({"p": r["p"], "x": round(r["x"], 2), "y": round(r["y"], 2), "w": round(r["x2"] - r["x"], 2),
                    "h": round(r["h"], 2), "s": s.lstrip() if lead else s})
    return out

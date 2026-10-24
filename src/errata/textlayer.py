"""From positioned text items to lines and cells.

A report PDF's text layer arrives as items: {"p": page, "x": left, "y": baseline measured down
from the top of the page, "w": width, "h": font size, "s": text}. The browser gets them from
pdf.js and the command line from pdfminer (errata.pdftext); the parsers only see items, so
both paths share every rule after extraction. Twin: web/src/core/02_textlayer.js.
"""

import re

FOOTER = re.compile(r"^\d+\s*/\s*\d+$")
PAGE_STRIDE = 10000.0


def _num(v):
    return round(float(v), 2)


def clean_items(items):
    out = []
    for it in items or []:
        s = re.sub(r"[\u0000-\u001f\u00ad\u200b]", "", re.sub(r"\(cid:\d+\)", "", str(it.get("s", ""))))
        if not s.strip():
            continue
        out.append({"p": int(it.get("p", 0)), "x": _num(it.get("x", 0)), "y": _num(it.get("y", 0)),
                    "w": _num(it.get("w", 0)), "h": _num(it.get("h", 10) or 10), "s": s})
    return out


def make_lines(items):
    """Group items into lines (same page, baselines within a tolerance), left to right. Page
    footers like '3 / 18' are dropped. Each line: {p, y, Y (y plus a page stride, so lines across
    pages sort in reading order), items, cells, text}."""
    its = sorted(clean_items(items), key=lambda i: (i["p"], i["y"], i["x"]))
    lines = []
    for it in its:
        tol = max(2.0, 0.35 * it["h"])
        cur = lines[-1] if lines else None
        if cur is not None and cur["p"] == it["p"] and abs(it["y"] - cur["y"]) <= tol:
            cur["items"].append(it)
        else:
            lines.append({"p": it["p"], "y": it["y"], "items": [it]})
    out = []
    for ln in lines:
        ln["items"].sort(key=lambda i: i["x"])
        ln["cells"] = make_cells(ln["items"])
        ln["text"] = " ".join(c["s"] for c in ln["cells"])
        ln["Y"] = round(ln["p"] * PAGE_STRIDE + ln["y"], 2)
        if FOOTER.match(ln["text"].strip()):
            continue
        out.append(ln)
    return out


def make_cells(items):
    """Join items that sit close together into cells (words of one label or value); a wider gap
    starts a new cell. Each cell: {x, x2, s}."""
    cells = []
    for it in items:
        s = it["s"]
        x2 = it["x"] + it["w"]
        if cells:
            c = cells[-1]
            gap = it["x"] - c["x2"]
            if gap <= 0.45 * it["h"]:
                joiner = "" if gap < 0.12 * it["h"] or c["s"].endswith(" ") or s.startswith(" ") else " "
                c["s"] = c["s"] + joiner + s
                c["x2"] = max(c["x2"], x2)
                continue
        cells.append({"x": it["x"], "x2": x2, "s": s})
    for c in cells:
        c["s"] = re.sub(r"\s+", " ", c["s"]).strip()
    return [c for c in cells if c["s"]]


def column_of(x, anchors, tol=3.0):
    """Index of the last anchor at or left of x (with a small tolerance); 0 when x is left of all."""
    k = 0
    for i, a in enumerate(anchors):
        if x + tol >= a:
            k = i
    return k


def nearest(x, anchors):
    best, bi = None, 0
    for i, a in enumerate(anchors):
        d = abs(x - a)
        if best is None or d < best:
            best, bi = d, i
    return bi


def split_columns(line, anchors, tol=3.0):
    """Split a line's items into columns by anchor x positions; returns texts per column."""
    cols = [[] for _ in anchors]
    for it in line["items"]:
        cols[column_of(it["x"], anchors, tol)].append(it)
    return [" ".join(c["s"] for c in make_cells(col)) for col in cols]

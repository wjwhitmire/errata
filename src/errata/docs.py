"""DOCX and PDF output for letters, built by hand so the browser can make the same bytes with no
library: DOCX is minimal Office Open XML in a stored (uncompressed) zip with fixed timestamps;
PDF uses the standard Helvetica fonts (no embedding), integer coordinates and WinAnsi text.
Also the mailing packet pages: cover sheet with the enclosure checklist and the certified mail
worksheet. Twin: web/src/core/10_docs.js; the parity test compares SHA-256 of the bytes.
"""

import re

from .letters import to_text
from .util import long_date, money_text

# ---------------------------------------------------------------- zip (stored) and crc32
_CRC = []
for _n in range(256):
    _c = _n
    for _ in range(8):
        _c = (0xEDB88320 ^ (_c >> 1)) if _c & 1 else (_c >> 1)
    _CRC.append(_c)


def crc32(data):
    c = 0xFFFFFFFF
    for b in data:
        c = _CRC[(c ^ b) & 0xFF] ^ (c >> 8)
    return c ^ 0xFFFFFFFF


def _u16(v):
    return bytes([v & 0xFF, (v >> 8) & 0xFF])


def _u32(v):
    return bytes([v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >> 24) & 0xFF])


def zip_stored(entries):
    """entries: [(name, bytes)]. DOS time 00:00, date 1980-01-01, for byte-identical output."""
    body, central, off = b"", b"", 0
    t, d = 0, (0 << 9) | (1 << 5) | 1
    for name, data in entries:
        nb = name.encode("utf-8")
        crc = crc32(data)
        head = b"PK\x03\x04" + _u16(20) + _u16(0x0800) + _u16(0) + _u16(t) + _u16(d) + _u32(crc) + _u32(len(data)) + _u32(len(data)) + _u16(len(nb)) + _u16(0)
        body += head + nb + data
        central += (b"PK\x01\x02" + _u16(20) + _u16(20) + _u16(0x0800) + _u16(0) + _u16(t) + _u16(d) + _u32(crc) + _u32(len(data)) + _u32(len(data)) +
                    _u16(len(nb)) + _u16(0) + _u16(0) + _u16(0) + _u16(0) + _u32(0) + _u32(off) + nb)
        off += len(head) + len(nb) + len(data)
    end = b"PK\x05\x06" + _u16(0) + _u16(0) + _u16(len(entries)) + _u16(len(entries)) + _u32(len(central)) + _u32(off) + _u16(0)
    return body + central + end


# ---------------------------------------------------------------- DOCX
XML_BAD = re.compile("[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]")


def _x(s):
    """Text for the DOCX XML: escaped, and without the control characters XML 1.0 forbids (a stray one
    pasted from elsewhere would make Word refuse the file)."""
    return XML_BAD.sub("", str(s)).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def _para(text, bold=False, italic=False, size=22, space_after=160, indent=0):
    rpr = "<w:rPr>" + ("<w:b/>" if bold else "") + ("<w:i/>" if italic else "") + f'<w:sz w:val="{size}"/></w:rPr>'
    ppr = f'<w:pPr><w:spacing w:after="{space_after}"/>' + (f'<w:ind w:left="{indent}"/>' if indent else "") + "</w:pPr>"
    return f'<w:p>{ppr}<w:r>{rpr}<w:t xml:space="preserve">{_x(text)}</w:t></w:r></w:p>'


def letter_paragraphs(L):
    """(text, style) lines for both writers: style one of plain, tight, bold, head, quote, bullet."""
    out = [(L["sender"]["name"], "tight")] + [(x, "tight") for x in L["sender"]["lines"]] + [("", "plain"), (long_date(L["date"]), "plain")]
    if L["recipient"]["name"]:
        out += [(L["recipient"]["name"], "tight")] + [(x, "tight") for x in L["recipient"]["lines"]] + [("", "plain")]
    out.append(("Re: " + L["subject"], "bold"))
    for b in L["blocks"]:
        k = b["kind"]
        if k in ("item", "h"):
            out.append((b["text"], "head"))
        elif k == "id":
            out.append((b["text"], "tight"))
        elif k == "li":
            out.append(("- " + b["text"], "bullet"))
        elif k == "quote":
            out.append((b["text"], "quote"))
        elif k == "sig":
            out += [("", "plain"), ("", "plain"), (b["text"], "plain")]
        else:
            out.append((b["text"], "plain"))
    if L.get("enclosures"):
        out.append(("Enclosures", "head"))
        out += [("- " + e, "bullet") for e in L["enclosures"]]
    return out


def docx(L):
    ps = []
    for text, st in letter_paragraphs(L):
        if st == "tight":
            ps.append(_para(text, space_after=0))
        elif st == "bold":
            ps.append(_para(text, bold=True))
        elif st == "head":
            ps.append(_para(text, bold=True, space_after=80))
        elif st == "quote":
            ps.append(_para(text, italic=True, indent=720))
        elif st == "bullet":
            ps.append(_para(text, space_after=40, indent=360))
        else:
            ps.append(_para(text))
    doc = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
           '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + "".join(ps) +
           '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>'
           "</w:body></w:document>")
    ct = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
          '<Default Extension="xml" ContentType="application/xml"/>'
          '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
          "</Types>")
    rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            "</Relationships>")
    return zip_stored([("[Content_Types].xml", ct.encode("utf-8")), ("_rels/.rels", rels.encode("utf-8")),
                       ("word/document.xml", doc.encode("utf-8"))])


# ---------------------------------------------------------------- PDF
# Helvetica and Helvetica-Bold advance widths (1/1000 em) for character codes 32 to 126 (Adobe AFM).
HELV = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
        278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667,
        611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833,
        556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584]
HELVB = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
         333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667,
         611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889,
         611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584]
PAGE_W, PAGE_H, MARGIN = 612, 792, 72


def _win(ch):
    o = ord(ch)
    if 32 <= o <= 126 or 160 <= o <= 255:
        return o
    return {0x2018: 145, 0x2019: 146, 0x201C: 147, 0x201D: 148, 0x2022: 149, 0x2013: 45, 0x2026: 133}.get(o, 63)


def text_width(s, bold, size):
    """Width in thousandths of a point (integer)."""
    tab = HELVB if bold else HELV
    w = 0
    for ch in s:
        o = _win(ch)
        w += tab[o - 32] if 32 <= o <= 126 else 556
    return w * size


def wrap(s, bold, size, width):
    words = s.split(" ")
    lines, cur = [], ""
    for w in words:
        t = w if not cur else cur + " " + w
        if cur and text_width(t, bold, size) > width * 1000:
            lines.append(cur)
            cur = w
        else:
            cur = t
    lines.append(cur)
    return lines


def _esc(s):
    out = []
    for ch in s:
        o = _win(ch)
        if ch in "()\\":
            out.append("\\" + ch)
        elif 32 <= o <= 126:
            out.append(chr(o))
        else:
            out.append("\\" + format(o, "03o"))
    return "".join(out)


def _layout(lines, size=11, lead=15):
    """lines: (text, style). Returns pages: lists of (x, y, bold, size, text)."""
    pages, cur, y = [], [], PAGE_H - MARGIN
    width = PAGE_W - 2 * MARGIN
    for text, st in lines:
        bold = st in ("bold", "head", "title")
        sz = 15 if st == "title" else size
        indent = 36 if st == "quote" else 18 if st == "bullet" else 0
        chunks = wrap(text, bold, sz, width - indent) if text else [""]
        before = 6 if st in ("head", "title") else 0
        after = 0 if st in ("tight", "bullet") else 8
        y -= before
        for c in chunks:
            if y < MARGIN + lead:
                pages.append(cur)
                cur, y = [], PAGE_H - MARGIN
            cur.append((MARGIN + indent, y, bold, sz, c))
            y -= lead + (6 if st == "title" else 0)
        y -= after
    pages.append(cur)
    return pages


def pdf(pages_lines):
    """pages_lines: a list of documents, each a list of (text, style); every document starts a page."""
    pages = []
    for doc in pages_lines:
        pages += _layout(doc)
    objs = ["<< /Type /Catalog /Pages 2 0 R >>", None,
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"]
    kids = []
    for pg in pages:
        ops = []
        for x, y, bold, sz, text in pg:
            if text:
                ops.append(f"BT /{'F2' if bold else 'F1'} {sz} Tf {x} {y} Td ({_esc(text)}) Tj ET")
        stream = "\n".join(ops)
        objs.append(f"<< /Length {len(stream.encode('latin-1'))} >>\nstream\n{stream}\nendstream")
        content_id = len(objs)
        objs.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_W} {PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {content_id} 0 R >>")
        kids.append(len(objs))
    objs[1] = "<< /Type /Pages /Kids [" + " ".join(f"{k} 0 R" for k in kids) + f"] /Count {len(kids)} >>"
    out = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
    offs = []
    for i, o in enumerate(objs, 1):
        offs.append(len(out))
        out += f"{i} 0 obj\n".encode("latin-1") + o.encode("latin-1") + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode("latin-1")
    for o in offs:
        out += f"{o:010d} 00000 n \n".encode("latin-1")
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode("latin-1")
    return out


def cover_sheet(L, tracking=""):
    lines = [("Mailing cover sheet", "title"), ("Keep this page. It is not part of the letter.", "plain"),
             ("Send to", "head"), (L["recipient"]["name"], "tight")] + [(x, "tight") for x in L["recipient"]["lines"]] + [
        ("From", "head"), (L["sender"]["name"], "tight")] + [(x, "tight") for x in L["sender"]["lines"]] + [
        ("Letter", "head"), (L["title"] + ", dated " + long_date(L["date"]), "plain"),
        ("Enclosure checklist", "head")] + [("[ ] " + e, "bullet") for e in (L.get("enclosures") or ["None"])] + [
        ("[ ] Signed and dated the letter", "bullet"), ("[ ] Kept a full copy of everything sent", "bullet"),
        ("Certified mail worksheet (PS Form 3800 at the post office counter)", "head"),
        ("Tracking number (20 digits): " + (tracking or "_" * 28), "plain"),
        ("Mailed on: ____________    Delivered on (from the return receipt): ____________", "plain"),
        ("The legal clock starts on the delivery date, so record it in the mail log when the receipt comes back.", "plain"),
        ("Postage (USPS prices effective July 12, 2026)", "head"),
        ("Certified with electronic return receipt, 1 oz: about " + money_text(L["cost"]["certified_err"], True) + " (fee $8.46 plus a $0.82 stamp).", "bullet"),
        ("Certified with the green card return receipt: about " + money_text(L["cost"]["certified_green"], True) + " (fee $10.20 plus a $0.82 stamp).", "bullet")]
    return lines


def letter_pdf(L, with_cover=True, tracking=""):
    docs = []
    if with_cover:
        docs.append(cover_sheet(L, tracking))
    docs.append(letter_paragraphs(L))
    return pdf(docs)


def envelope_text(L):
    return "\n".join([L["sender"]["name"]] + L["sender"]["lines"] + ["", "", "\t\t" + L["recipient"]["name"]] +
                     ["\t\t" + x for x in L["recipient"]["lines"]]) + "\n"


def plain(L):
    return to_text(L)

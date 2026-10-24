// ---------------------------------------------------------------- DOCX and PDF by hand (twin of docs.py; same bytes)
const CRC_TAB = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) >>> 0 : c >>> 1; t.push(c >>> 0); } return t; })();
function crc32(data) { let c = 0xffffffff; for (const b of data) c = (CRC_TAB[(c ^ b) & 0xff] ^ (c >>> 8)) >>> 0; return (c ^ 0xffffffff) >>> 0; }
function bytesConcat(parts) { const n = parts.reduce((s, p) => s + p.length, 0), out = new Uint8Array(n); let k = 0; for (const p of parts) { out.set(p, k); k += p.length; } return out; }
const u16 = (v) => Uint8Array.of(v & 0xff, (v >>> 8) & 0xff);
const u32 = (v) => Uint8Array.of(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
const ascii = (s) => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 0xff; return u; };
function zip_stored(entries) {
  const body = [], central = [];
  let off = 0;
  const t = 0, d = (0 << 9) | (1 << 5) | 1;
  for (const [name, data] of entries) {
    const nb = UTF8.encode(name), crc = crc32(data);
    const head = bytesConcat([ascii("PK\x03\x04"), u16(20), u16(0x0800), u16(0), u16(t), u16(d), u32(crc), u32(data.length), u32(data.length), u16(nb.length), u16(0)]);
    body.push(head, nb, data);
    central.push(bytesConcat([ascii("PK\x01\x02"), u16(20), u16(20), u16(0x0800), u16(0), u16(t), u16(d), u32(crc), u32(data.length), u32(data.length), u16(nb.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off), nb]));
    off += head.length + nb.length + data.length;
  }
  const cen = bytesConcat(central);
  const end = bytesConcat([ascii("PK\x05\x06"), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(cen.length), u32(off), u16(0)]);
  return bytesConcat(body.concat([cen, end]));
}
// escaped, and without the control characters XML 1.0 forbids (Word refuses a file with one)
function xesc(s) { return String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function wpara(text, o) {
  o = Object.assign({ bold: false, italic: false, size: 22, after: 160, indent: 0 }, o || {});
  const rpr = "<w:rPr>" + (o.bold ? "<w:b/>" : "") + (o.italic ? "<w:i/>" : "") + '<w:sz w:val="' + o.size + '"/></w:rPr>';
  const ppr = '<w:pPr><w:spacing w:after="' + o.after + '"/>' + (o.indent ? '<w:ind w:left="' + o.indent + '"/>' : "") + "</w:pPr>";
  return "<w:p>" + ppr + "<w:r>" + rpr + '<w:t xml:space="preserve">' + xesc(text) + "</w:t></w:r></w:p>";
}
function letter_paragraphs(L) {
  let out = [[L.sender.name, "tight"]].concat(L.sender.lines.map((x) => [x, "tight"]), [["", "plain"], [long_date(L.date), "plain"]]);
  if (L.recipient.name) out = out.concat([[L.recipient.name, "tight"]], L.recipient.lines.map((x) => [x, "tight"]), [["", "plain"]]);
  out.push(["Re: " + L.subject, "bold"]);
  for (const b of L.blocks) {
    const k = b.kind;
    if (k === "item" || k === "h") out.push([b.text, "head"]);
    else if (k === "id") out.push([b.text, "tight"]);
    else if (k === "li") out.push(["- " + b.text, "bullet"]);
    else if (k === "quote") out.push([b.text, "quote"]);
    else if (k === "sig") out.push(["", "plain"], ["", "plain"], [b.text, "plain"]);
    else out.push([b.text, "plain"]);
  }
  if (L.enclosures && L.enclosures.length) { out.push(["Enclosures", "head"]); for (const e of L.enclosures) out.push(["- " + e, "bullet"]); }
  return out;
}
function docx(L) {
  const ps = letter_paragraphs(L).map(([text, st]) => st === "tight" ? wpara(text, { after: 0 }) : st === "bold" ? wpara(text, { bold: true }) : st === "head" ? wpara(text, { bold: true, after: 80 })
    : st === "quote" ? wpara(text, { italic: true, indent: 720 }) : st === "bullet" ? wpara(text, { after: 40, indent: 360 }) : wpara(text));
  const doc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + ps.join("") +
    '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>';
  const ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
  const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  return zip_stored([["[Content_Types].xml", UTF8.encode(ct)], ["_rels/.rels", UTF8.encode(rels)], ["word/document.xml", UTF8.encode(doc)]]);
}
const HELV = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const HELVB = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
const PAGE_W = 612, PAGE_H = 792, MARGIN = 72;
const WIN_MAP = { 0x2018: 145, 0x2019: 146, 0x201c: 147, 0x201d: 148, 0x2022: 149, 0x2013: 45, 0x2026: 133 };
function win(ch) { const o = ch.codePointAt(0); if ((o >= 32 && o <= 126) || (o >= 160 && o <= 255)) return o; return own(WIN_MAP, o) ? WIN_MAP[o] : 63; }
function text_width(s, bold, size) { const tab = bold ? HELVB : HELV; let w = 0; for (const ch of s) { const o = win(ch); w += o >= 32 && o <= 126 ? tab[o - 32] : 556; } return w * size; }
function wrap_text(s, bold, size, width) {
  const words = s.split(" "), lines = [];
  let cur = "";
  for (const w of words) {
    const t = !cur ? w : cur + " " + w;
    if (cur && text_width(t, bold, size) > width * 1000) { lines.push(cur); cur = w; } else cur = t;
  }
  lines.push(cur);
  return lines;
}
function pdf_esc(s) {
  let out = "";
  for (const ch of s) {
    const o = win(ch);
    if (ch === "(" || ch === ")" || ch === "\\") out += "\\" + ch;
    else if (o >= 32 && o <= 126) out += String.fromCharCode(o);
    else out += "\\" + o.toString(8).padStart(3, "0");
  }
  return out;
}
function pdf_layout(lines) {
  const size = 11, lead = 15, pages = [];
  let cur = [], y = PAGE_H - MARGIN;
  const width = PAGE_W - 2 * MARGIN;
  for (const [text, st] of lines) {
    const bold = st === "bold" || st === "head" || st === "title", sz = st === "title" ? 15 : size;
    const indent = st === "quote" ? 36 : st === "bullet" ? 18 : 0;
    const chunks = text ? wrap_text(text, bold, sz, width - indent) : [""];
    y -= st === "head" || st === "title" ? 6 : 0;
    for (const c of chunks) {
      if (y < MARGIN + lead) { pages.push(cur); cur = []; y = PAGE_H - MARGIN; }
      cur.push([MARGIN + indent, y, bold, sz, c]);
      y -= lead + (st === "title" ? 6 : 0);
    }
    y -= st === "tight" || st === "bullet" ? 0 : 8;
  }
  pages.push(cur);
  return pages;
}
function pdf_doc(docs) {
  let pages = [];
  for (const d of docs) pages = pages.concat(pdf_layout(d));
  const objs = ["<< /Type /Catalog /Pages 2 0 R >>", null, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"];
  const kids = [];
  for (const pg of pages) {
    const ops = pg.filter((x) => x[4]).map(([x, y, bold, sz, text]) => "BT /" + (bold ? "F2" : "F1") + " " + sz + " Tf " + x + " " + y + " Td (" + pdf_esc(text) + ") Tj ET");
    const stream = ops.join("\n");
    objs.push("<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream");
    const cid = objs.length;
    objs.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + PAGE_W + " " + PAGE_H + "] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents " + cid + " 0 R >>");
    kids.push(objs.length);
  }
  objs[1] = "<< /Type /Pages /Kids [" + kids.map((k) => k + " 0 R").join(" ") + "] /Count " + kids.length + " >>";
  let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += (i + 1) + " 0 obj\n" + o + "\nendobj\n"; });
  const xref = out.length;
  out += "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n";
  for (const o of offs) out += String(o).padStart(10, "0") + " 00000 n \n";
  out += "trailer\n<< /Size " + (objs.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n";
  return ascii(out);
}
function cover_sheet(L, tracking) {
  return [["Mailing cover sheet", "title"], ["Keep this page. It is not part of the letter.", "plain"], ["Send to", "head"], [L.recipient.name, "tight"]]
    .concat(L.recipient.lines.map((x) => [x, "tight"]), [["From", "head"], [L.sender.name, "tight"]], L.sender.lines.map((x) => [x, "tight"]),
      [["Letter", "head"], [L.title + ", dated " + long_date(L.date), "plain"], ["Enclosure checklist", "head"]],
      (L.enclosures && L.enclosures.length ? L.enclosures : ["None"]).map((e) => ["[ ] " + e, "bullet"]),
      [["[ ] Signed and dated the letter", "bullet"], ["[ ] Kept a full copy of everything sent", "bullet"],
        ["Certified mail worksheet (PS Form 3800 at the post office counter)", "head"], ["Tracking number (20 digits): " + (tracking || "_".repeat(28)), "plain"],
        ["Mailed on: ____________    Delivered on (from the return receipt): ____________", "plain"],
        ["The legal clock starts on the delivery date, so record it in the mail log when the receipt comes back.", "plain"],
        ["Postage (USPS prices effective July 12, 2026)", "head"],
        ["Certified with electronic return receipt, 1 oz: about " + money_text(L.cost.certified_err, true) + " (fee $8.46 plus a $0.82 stamp).", "bullet"],
        ["Certified with the green card return receipt: about " + money_text(L.cost.certified_green, true) + " (fee $10.20 plus a $0.82 stamp).", "bullet"]]);
}
function letter_pdf(L, with_cover, tracking) {
  const docs = [];
  if (with_cover === undefined || with_cover) docs.push(cover_sheet(L, tracking || ""));
  docs.push(letter_paragraphs(L));
  return pdf_doc(docs);
}
function envelope_text(L) { return [L.sender.name].concat(L.sender.lines, ["", "", "\t\t" + L.recipient.name], L.recipient.lines.map((x) => "\t\t" + x)).join("\n") + "\n"; }

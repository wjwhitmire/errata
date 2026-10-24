// ---------------------------------------------------------------- text items to lines and cells (twin of textlayer.py)
const FOOTER = /^\d+\s*\/\s*\d+$/;
const PAGE_STRIDE = 10000.0;
function r2(v) { return Math.round(Number(v) * 100) / 100; }
function clean_items(items) {
  const out = [];
  for (const it of items || []) {
    const s = String(it.s === undefined ? "" : it.s).replace(/\(cid:\d+\)/g, "").replace(/[\u0000-\u001f­​]/g, "");
    if (!s.trim()) continue;
    out.push({ p: Math.trunc(+it.p || 0), x: r2(it.x || 0), y: r2(it.y || 0), w: r2(it.w || 0), h: r2(+it.h || 10), s });
  }
  return out;
}
function make_lines(items) {
  const its = sortBy(clean_items(items), (i) => [i.p, i.y, i.x]);
  const lines = [];
  for (const it of its) {
    const tol = Math.max(2.0, 0.35 * it.h);
    const cur = lines.length ? lines[lines.length - 1] : null;
    if (cur && cur.p === it.p && Math.abs(it.y - cur.y) <= tol) cur.items.push(it);
    else lines.push({ p: it.p, y: it.y, items: [it] });
  }
  const out = [];
  for (const ln of lines) {
    ln.items = sortBy(ln.items, (i) => [i.x]);
    ln.cells = make_cells(ln.items);
    ln.text = ln.cells.map((c) => c.s).join(" ");
    ln.Y = r2(ln.p * PAGE_STRIDE + ln.y);
    if (FOOTER.test(ln.text.trim())) continue;
    out.push(ln);
  }
  return out;
}
function make_cells(items) {
  const cells = [];
  for (const it of items) {
    const s = it.s, x2 = it.x + it.w;
    if (cells.length) {
      const c = cells[cells.length - 1];
      const gap = it.x - c.x2;
      if (gap <= 0.45 * it.h) {
        const joiner = gap < 0.12 * it.h || c.s.endsWith(" ") || s.startsWith(" ") ? "" : " ";
        c.s = c.s + joiner + s;
        c.x2 = Math.max(c.x2, x2);
        continue;
      }
    }
    cells.push({ x: it.x, x2, s });
  }
  for (const c of cells) c.s = c.s.replace(/\s+/g, " ").trim();
  return cells.filter((c) => c.s);
}
function column_of(x, anchors, tol) {
  tol = tol === undefined ? 3.0 : tol;
  let k = 0;
  anchors.forEach((a, i) => { if (x + tol >= a) k = i; });
  return k;
}
function nearest(x, anchors) {
  let best = null, bi = 0;
  anchors.forEach((a, i) => { const d = Math.abs(x - a); if (best === null || d < best) { best = d; bi = i; } });
  return bi;
}
function split_columns(line, anchors, tol) {
  const cols = anchors.map(() => []);
  for (const it of line.items) cols[column_of(it.x, anchors, tol)].push(it);
  return cols.map((c) => make_cells(c).map((x) => x.s).join(" "));
}
// pdf.js text content items for one page into the core's items (baseline measured down from the top).
function items_from_pdfjs(p, pageHeight, items) {
  const out = [];
  for (const it of items || []) {
    if (!it || typeof it.str !== "string" || !it.str.trim() || !it.transform) continue;
    const t = it.transform, h = Math.hypot(t[2], t[3]) || Math.abs(t[3]) || it.height || 10;
    out.push({ p, x: r2(t[4]), y: r2(pageHeight - t[5]), w: r2(it.width || 0), h: r2(h), s: it.str });
  }
  return out;
}

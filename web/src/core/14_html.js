// ---------------------------------------------------------------- saved web-page reports (twin of htmltext.py)
// The walk takes events (start, end, text) so the core never touches a DOM: the interface feeds
// them from DOMParser's inert document, and the Python reader feeds them from html.parser. Scripts,
// styles, frames and objects are skipped; nothing on the page is fetched or run.
const HTML_MAX_BYTES = 20 * 1024 * 1024, HTML_MAX_LINES = 60000;
const HTML_SKIP = new Set(["script", "style", "noscript", "template", "svg", "iframe", "object", "embed", "canvas", "math", "select", "textarea"]);
const HTML_BLOCK = new Set(["address", "article", "aside", "blockquote", "body", "caption", "center", "dd", "details", "dialog", "div", "dl", "dt",
  "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "html", "legend",
  "li", "main", "nav", "ol", "p", "pre", "section", "summary", "table", "tbody", "tfoot", "thead", "title", "ul"]);
const HTML_CELL = new Set(["td", "th"]);
function html_walker() {
  const w = { lines: [], buf: "", row: null, cell: null, skip: 0, label: null, in_dt: false, in_dd: false };
  const flush = () => { const t = norm_space(w.buf); w.buf = ""; if (t) w.lines.push([t]); };
  const close_cell = () => { if (w.cell !== null) { w.row.push(norm_space(w.cell)); w.cell = null; } };
  const close_row = () => {
    close_cell();
    if (w.row !== null) {
      if (w.row.some((c) => c)) { while (w.row.length && !w.row[w.row.length - 1]) w.row.pop(); w.lines.push(w.row); }
      w.row = null;
    }
  };
  const end_dt = () => { if (w.in_dt) { if (w.label) w.lines.push([w.label]); w.label = norm_space(w.buf); w.buf = ""; w.in_dt = false; } };
  const end_dd = () => {
    if (w.in_dd) {
      const value = norm_space(w.buf);
      w.buf = "";
      if (w.label && value) w.lines.push([w.label, value]);
      else if (w.label || value) w.lines.push([w.label || value]);
      w.label = null; w.in_dd = false;
    }
  };
  const end_dl = () => { end_dd(); end_dt(); if (w.label) { w.lines.push([w.label]); w.label = null; } };
  return {
    start(tag) {
      if (w.skip || HTML_SKIP.has(tag)) { if (HTML_SKIP.has(tag)) w.skip++; return; }
      if (tag === "br") { if (w.cell !== null) w.cell += " "; else if (!(w.in_dt || w.in_dd)) flush(); else w.buf += " "; return; }
      if (tag === "tr") { flush(); close_row(); w.row = []; return; }
      if (HTML_CELL.has(tag)) { if (w.row === null) { flush(); w.row = []; } close_cell(); w.cell = ""; return; }
      if (w.cell !== null) { w.cell += " "; return; }
      if (tag === "dt") { end_dd(); end_dt(); if (w.label) { w.lines.push([w.label]); w.label = null; } flush(); w.in_dt = true; return; }
      if (tag === "dd") { end_dt(); end_dd(); if (w.label === null) flush(); w.buf = ""; w.in_dd = true; return; }
      if (w.in_dt || w.in_dd) { w.buf += " "; return; }
      if (HTML_BLOCK.has(tag)) { if (tag === "table" || tag === "dl") close_row(); flush(); }
    },
    end(tag) {
      if (w.skip) { if (HTML_SKIP.has(tag)) w.skip--; return; }
      if (HTML_CELL.has(tag)) { close_cell(); return; }
      if (tag === "tr") { close_row(); return; }
      if (w.cell !== null) {
        if (["table", "tbody", "thead", "tfoot"].includes(tag)) close_row();
        else { w.cell += " "; return; }
      }
      if (tag === "dt") { end_dt(); return; }
      if (tag === "dd") { end_dd(); return; }
      if (tag === "dl") { end_dl(); flush(); return; }
      if (w.in_dt || w.in_dd) { w.buf += " "; return; }
      if (HTML_BLOCK.has(tag)) { if (["table", "tbody", "thead", "tfoot"].includes(tag)) close_row(); flush(); }
    },
    text(data) { if (w.skip) return; if (w.cell !== null) w.cell += data; else w.buf += data; },
    done() {
      close_row(); end_dl(); flush();
      if (w.lines.length > HTML_MAX_LINES) throw new CreditError("html", "This page has too many lines to be a credit report.");
      return w.lines;
    },
  };
}
// Walk a parsed page (any node with firstChild, nextSibling, nodeType, localName and nodeValue: the
// interface passes DOMParser's inert document) and feed the walker its events.
const HTML_VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
function html_dom_lines(root) {
  const w = html_walker();
  const walk = (node) => {
    for (let n = node.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) w.text(n.nodeValue);
      else if (n.nodeType === 1) {
        const t = String(n.localName || "").toLowerCase();
        w.start(t);
        if (!HTML_VOID.has(t)) { walk(t === "template" && n.content ? n.content : n); w.end(t); }
      }
    }
  };
  walk(root);
  return w.done();
}
function items_from_lines(lines) {
  const items = [];
  lines.forEach((cells, i) => cells.forEach((c, k) => { if (c) items.push({ p: 0, x: 40 + 150 * k, y: 20 + 14 * i, w: Math.min(140, 5 * c.length), h: 10, s: c }); }));
  return items;
}
const HTML_BUREAUS = [["transunion", /\bTransUnion\b/gi], ["experian", /\bExperian\b/gi], ["equifax", /\bEquifax\b/gi]];
function detect_html(lines) {
  const head = lines.slice(0, 40).map((c) => c.join(" ")).join(" ");
  const has = (rx, t) => new RegExp(rx.source, "i").test(t);
  for (const [b, rx] of HTML_BUREAUS) if (has(rx, head) && !HTML_BUREAUS.some(([b2, rx2]) => b2 !== b && has(rx2, head))) return b;
  const whole = lines.map((c) => c.join(" ")).join(" ");
  const counts = HTML_BUREAUS.map(([b, rx]) => [(whole.match(new RegExp(rx.source, "gi")) || []).length, b]);
  counts.sort((x, y) => y[0] - x[0] || (y[1] < x[1] ? -1 : y[1] > x[1] ? 1 : 0));
  if (counts[0][0] && counts[0][0] > counts[1][0]) return counts[0][1];
  return null;
}
const HTML_NOTE = "Read from a saved web page with the template reader, which was built without a real saved report to test against. Check every account against the page before you use it.";
function parse_html_lines(lines, report_date, bureau) {
  const b = bureau || detect_html(lines);
  if (!["transunion", "experian", "equifax"].includes(b)) throw new CreditError("parse", "This page does not look like a TransUnion, Experian or Equifax report. Save the report page itself, or print it to PDF.");
  const r = generic_parse(items_from_lines(lines), report_date || "", b);
  r.source.kind = "html";
  r.source.parser = r.source.parser.replace("-template-", "-html-template-");
  r.source.pages = 1;
  r.messages.unshift(HTML_NOTE);
  return r;
}

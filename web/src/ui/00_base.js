// ---------------------------------------------------------------- base: DOM helpers, icons, small widgets
// The interface is plain DOM built with el(). Text always goes in through textContent, never as
// markup, so nothing read from a report or typed by a person can become HTML.
const C = CORE;
const $ = (id) => document.getElementById(id);
const ICONS = /*ICONS*/;
const SVGNS = "http://www.w3.org/2000/svg";
function icon(name, cls) {
  const s = document.createElementNS(SVGNS, "svg");
  s.setAttribute("class", cls || "ico");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(SVGNS, "path");
  p.setAttribute("d", ICONS[name] || ICONS.info);
  s.append(p);
  return s;
}
// el(tag, attrs, children): attrs.cls, attrs.text, attrs.on{event: fn}, data-*, aria-*, any attribute.
function el(tag, attrs, kids) {
  const e = document.createElement(tag);
  const a = attrs || {};
  for (const k of Object.keys(a)) {
    const v = a[k];
    if (v === null || v === undefined || v === false) continue;
    if (k === "cls") e.className = v;
    else if (k === "text") e.textContent = String(v);
    else if (k === "on") for (const ev of Object.keys(v)) e.addEventListener(ev, v[ev]);
    else if (k === "style") e.setAttribute("style", v);
    else if (k === "value") e.value = v;
    else if (k === "checked") e.checked = !!v;
    else if (k === "disabled") e.disabled = !!v;
    else if (k === "selected") e.selected = !!v;
    else e.setAttribute(k, v === true ? "" : String(v));
  }
  add(e, kids);
  return e;
}
function add(e, kids) {
  if (kids === null || kids === undefined || kids === false) return e;
  if (!Array.isArray(kids)) kids = [kids];
  for (const k of kids) {
    if (k === null || k === undefined || k === false || k === "") continue;
    if (Array.isArray(k)) add(e, k);
    else e.append(typeof k === "string" || typeof k === "number" ? document.createTextNode(String(k)) : k);
  }
  return e;
}
// one atomic replace: removing a focused input can fire its blur handler, which may render again
function clear(e) { if (e) { if (e.replaceChildren) e.replaceChildren(); else while (e.firstChild) e.removeChild(e.firstChild); } return e; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function cleanName(s, n) { return String(s || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n || 120); }
function plural(n, one, many) { return n + " " + (n === 1 ? one : many || one + "s"); }

// ---- formatting: money and dates (set in the statement face where they sit in columns)
function money(c) { return c === null || c === undefined ? "" : C.money_text(c); }
function mdy(iso) { return iso ? C.us_date(iso) : ""; }
function md(iso) { return iso ? iso.slice(5, 7) + "/" + iso.slice(8, 10) : ""; }
function longDate(iso) { return iso ? C.long_date(iso) : ""; }
function num(text, cls) { return el("span", { cls: "num" + (cls ? " " + cls : ""), text }); }
const BUREAU_AB = { equifax: "EQ", experian: "EX", transunion: "TU", unknown: "?" };
const BUREAU_ORDER = ["equifax", "experian", "transunion"];
function bname(b) { return C.BUREAU_NAMES[b] || "Unknown bureau"; }
function bu(b, off) { return el("span", { cls: "bu" + (off ? " off" : ""), title: bname(b), text: BUREAU_AB[b] || "?" }); }
function titleCase(s) {
  return String(s || "").toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(Llc|Inc|Na|Usa|Fsb)\b/g, (m) => m.toUpperCase());
}
function stepTitle(t) {
  const i = String(t).indexOf(": ");
  if (i < 0) return t;
  return t.slice(0, i + 2) + t.slice(i + 2).split(": ").map((x) => (/[a-z]/.test(x) ? x : titleCase(x.replace(/\s+[X*\d][X*\d-]*\d+$/, "")))).join(": ");
}
function masked(n) {
  const d = String(n || "").replace(/[^0-9A-Za-z]/g, "");
  const tail = d.replace(/[^0-9]/g, "").slice(-4);
  return tail ? "XXXX-" + tail : String(n || "");
}

// ---- status chips: glyph and word first, color second
const STAT = {
  "Removed": ["good", "removed"], "Deleted": ["good", "removed"], "Updated": ["good", "updated"], "Results in": ["good", "check"],
  "In dispute": ["info", "dispute"], "Waiting": ["info", "clock"], "Reinserted": ["bad", "reinserted"], "Overdue": ["bad", "hourglass"],
  "Reported late": ["bad", "late"], "Deadline near": ["warn", "hourglass"], "Needs answer": ["warn", "help"], "To check": ["warn", "edit"],
  "Verified": ["plain", "verified"], "Ready": ["plain", "letters"], "Goodwill": ["plain", "envelope"], "New": ["plain", "new"],
  "In transit": ["plain", "envelope"], "Set aside": ["plain", "x"], "No dispute": ["plain", "scale"], "Match": ["plain", "check"],
  "Included": ["info", "check"], "Skipped": ["plain", "x"], "All read": ["good", "check"], "Draft": ["plain", "edit"], "Printed": ["warn", "print"], "Mailed": ["info", "envelope"],
};
function chip(word, label) {
  const s = STAT[word] || ["plain", "info"];
  return el("span", { cls: "chip " + s[0] }, [icon(s[1]), label || word]);
}
function cite(key) {
  const c = C.TABLES.citations[key];
  if (!c) return null;
  const parts = c.cite.split(", ");
  const head = c.kind === "industry" && /policy/i.test(c.cite) ? "Bureau policy" : parts[0];
  const tail = parts.length > 1 ? parts.slice(1).join(", ") : c.title;
  return el("a", { cls: "cite", href: c.url, target: "_blank", rel: "noopener noreferrer", title: c.title }, [el("b", { text: head }), el("span", { text: tail })]);
}
function cites(keys) { return el("ul", { cls: "cites" }, (keys || []).filter((k) => C.TABLES.citations[k]).map((k) => el("li", null, [cite(k)]))); }
const CONF_PCT = { high: 95, medium: 80, low: 60, needs_answer: 50 };
function conf(p) {
  const on = Math.round(p / 10);
  const bars = [];
  for (let i = 0; i < 10; i++) bars.push(el("b", { cls: i < on ? "on" : "" }));
  return el("span", { cls: "conf" + (p < 75 ? " low" : ""), "aria-label": "Confidence " + p + " percent" }, [el("i", null, bars), p + "%"]);
}
// The one key answer per view: copper figure over the double rule.
function keyAnswer(label, fig, sub, acts, text) {
  return el("div", { cls: "key", "data-key": "" }, [el("span", { cls: "k-lbl", text: label }), el("span", { cls: "k-fig" + (text ? " text" : ""), text: fig }),
    sub ? el("p", { cls: "k-sub", text: sub }) : null, acts && acts.length ? el("div", { cls: "k-act" }, acts) : null]);
}
function card(title, iconName, body, right, attrs) {
  return el("div", Object.assign({ cls: "card" }, attrs || {}), [el("h3", { cls: "ch" }, [iconName ? icon(iconName) : null, title, right ? el("span", { cls: "r" }, right) : null])].concat(body || []));
}
function btn(label, onClick, o) {
  o = o || {};
  return el(o.href ? "a" : "button", { type: o.href ? null : "button", href: o.href || null, cls: "btn" + (o.cls ? " " + o.cls : ""), id: o.id || null, disabled: o.disabled || null,
    "aria-label": o.aria || null, title: o.title || null, on: onClick ? { click: onClick } : null }, [o.icon ? icon(o.icon, o.icoCls || "ico") : null, label, o.after ? icon(o.after, "ico sm") : null]);
}
function link(label, href, o) { return btn(label, null, Object.assign({ href }, o || {})); }
function sw(on, label, onChange, o) {
  return el("button", { type: "button", cls: "switch", role: "switch", "aria-checked": on ? "true" : "false", "aria-label": label, id: (o && o.id) || null,
    disabled: (o && o.disabled) || null, on: { click: (e) => onChange(e.currentTarget.getAttribute("aria-checked") !== "true") } });
}
function switchRow(title, detail, on, onChange, o) {
  return el("div", { cls: "switchrow" }, [el("span", { cls: "t", text: title }), sw(on, title, onChange, o), el("span", { cls: "d" }, detail)]);
}
function field(label, input, hint) {
  const id = input.id || ("f" + Math.random().toString(36).slice(2, 9));
  input.id = id;
  return el("div", { cls: "field" }, [el("label", { for: id, text: label }), input, hint ? el("span", { cls: "muted small", text: hint }) : null]);
}
function input(o) { return el("input", Object.assign({ cls: "input" + (o && o.mono ? " mono" : ""), type: "text", autocomplete: "off" }, o || {}, { mono: null })); }
function select(options, value, o) {
  return el("select", Object.assign({ cls: "input" }, o || {}), options.map(([v, t]) => el("option", { value: v, text: t, selected: v === value })));
}
function table(heads, rows, o) {
  // heads: [label or [label, cls]]; rows: [{cells: [node|text], attrs}]. On phones each row becomes a
  // labeled card; the label of each cell comes from its header.
  const hl = heads.map((h) => (Array.isArray(h) ? h : [h, ""]));
  return el("div", { cls: "tablewrap" }, [el("table", { cls: "t" }, [
    el("thead", null, [el("tr", null, hl.map(([t, c]) => el("th", { cls: c || null, scope: "col", text: t })))]),
    el("tbody", null, rows.map((r) => el("tr", Object.assign({}, r.attrs || {}), r.cells.map((c, i) => {
      const td = el("td", { cls: (r.cls && r.cls[i]) || (hl[i] && hl[i][1]) || null, "data-l": hl[i] && hl[i][0] ? hl[i][0] : null });
      add(td, c);
      return td;
    })))),
  ])].concat(o && o.empty && !rows.length ? [el("p", { cls: "empty", text: o.empty })] : []));
}
function rowsList(items) { return el("ul", { cls: "rows" }, items); }
function note(kind, iconName, kids) { return el("div", { cls: "note" + (kind ? " " + kind : "") }, [icon(iconName || "info"), el("div", null, kids)]); }
function why(text) { return el("div", { cls: "why" }, [icon("info"), el("p", { text })]); }
function dbar(due, start, today, label) {
  if (!due) return el("div", { cls: "dbar" }, [el("div", { cls: "bar" }, [el("i", { style: "width:0" })]), el("span", { cls: "lb", text: label || "Starts on delivery" })]);
  const left = C.days_between(today, due), tot = Math.max(1, C.days_between(start, due));
  const done = Math.min(tot, Math.max(0, tot - left));
  const cls = left < 0 ? "late" : left <= 10 ? "near" : "";
  const lab = (left < 0 ? -left + " days overdue" : left === 0 ? "due today" : left + " days left") + ", due " + mdy(due);
  return el("div", { cls: "dbar " + cls }, [el("div", { cls: "bar" }, [el("i", { style: "width:" + Math.min(100, Math.round((100 * done) / tot)) + "%" })]), el("span", { cls: "lb", text: lab })]);
}

// ---- toasts (with undo) and the dialog
function toast(text, undo) {
  const box = $("toasts");
  // undo is one step: an older toast's Undo would also throw away every change made after it
  if (undo) for (const old of box.querySelectorAll(".toast .btn")) old.remove();
  const t = el("div", { cls: "toast" }, [icon("check"), el("span", { text })]);
  if (undo) t.append(btn("Undo", () => { t.remove(); undo(); }, { cls: "quiet" }));
  box.append(t);
  setTimeout(() => t.remove(), undo ? 8000 : 4000);
}
let dialogDone = null;
function openDialog(o) {
  const d = $("dlg");
  clear(d);
  d.className = "dlg" + (o.wide ? " wide" : "");
  const close = () => closeDialog();
  d.append(el("div", { cls: "dh" }, [o.icon ? icon(o.icon) : null, el("h2", { text: o.title }), el("button", { type: "button", cls: "iconbtn", "aria-label": "Close", on: { click: () => { if (o.onCancel) o.onCancel(); close(); } } }, [icon("x")])]),
    el("div", { cls: "db" }, o.body), el("div", { cls: "df" }, (o.actions || [{ label: "Close" }]).map((a) => btn(a.label, () => {
      if (a.onClick && a.onClick() === false) return;
      if (!a.keep) close();
    }, { cls: a.primary ? "primary" : a.danger ? "danger" : "", id: a.id || null, icon: a.icon || null }))));
  dialogDone = o.onCancel || null;
  if (!d.open) { try { d.showModal(); } catch (e) { d.setAttribute("open", ""); } }
  const f = d.querySelector(".db input, .db select, .db textarea, .df .btn.primary");
  if (f) f.focus();
}
function closeDialog() { const d = $("dlg"); dialogDone = null; if (d.open) { try { d.close(); } catch (e) { d.removeAttribute("open"); } } clear(d); }
// A file the person asked for: built here and handed to the browser; nothing leaves the device.
// Files are always saved, never opened in this page's origin; a stored file of any other type is
// labeled as plain bytes so no browser renders it as a page.
const SAFE_TYPES = /^(application\/(pdf|zip|json|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|octet-stream)|text\/(plain|calendar|csv)|image\/(png|jpeg|gif|webp|heic|heif))$/;
function download(name, data, type) {
  const safe = SAFE_TYPES.test(String(type || "")) ? type : "application/octet-stream";
  const blob = data instanceof Blob && SAFE_TYPES.test(data.type) ? data : new Blob([data], { type: safe });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: name, style: "display:none" });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}
function b64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function b64ToBytes(s) { const bin = atob(String(s).replace(/\s+/g, "")); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
const enc = new TextEncoder(), dec = new TextDecoder();
function readFile(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(new Uint8Array(r.result)); r.onerror = () => rej(r.error); r.readAsArrayBuffer(file); }); }
function pickFile(accept, multiple) {
  return new Promise((resolve) => {
    const i = el("input", { type: "file", accept, multiple: multiple || null, style: "display:none" });
    i.addEventListener("change", () => { resolve(Array.from(i.files || [])); i.remove(); });
    document.body.append(i);
    i.click();
  });
}
// The mark: a ruled statement with one line corrected (drawn in theme colors).
const MARK_PATHS = [["M96 120V392", "var(--nav-mark)", 10, ".55"], ["M136 168H384M136 344H290", "currentColor", 30, ""], ["M136 256H384", "currentColor", 30, ".38"],
  ["M116 256H404", "var(--nav-mark)", 16, ""], ["M322 396L354 316 386 396", "var(--nav-mark)", 28, ""]];
function markSvg(tile) {
  const s = document.createElementNS(SVGNS, "svg");
  s.setAttribute("viewBox", tile ? "0 0 512 512" : "80 100 352 312");
  s.setAttribute("class", tile ? "" : "mark-svg");
  s.setAttribute("aria-hidden", "true");
  if (tile) { const r = document.createElementNS(SVGNS, "rect"); r.setAttribute("width", "512"); r.setAttribute("height", "512"); r.setAttribute("rx", "96"); r.setAttribute("fill", "var(--nav)"); s.append(r); s.style.color = "var(--nav-fg)"; }
  for (const [d, st, w, op] of MARK_PATHS) {
    const p = document.createElementNS(SVGNS, "path");
    p.setAttribute("d", d); p.setAttribute("fill", "none"); p.setAttribute("stroke", st); p.setAttribute("stroke-width", String(w)); p.setAttribute("stroke-linecap", "round");
    if (d.startsWith("M322")) p.setAttribute("stroke-linejoin", "round");
    if (op) p.setAttribute("opacity", op);
    s.append(p);
  }
  return s;
}
const FOOTER_LINE = "Built by Will Whitmire. Runs entirely in your browser; nothing you enter is uploaded.";
function footer() { return el("div", { cls: "suite-foot" }, [el("p", { cls: "muted", text: FOOTER_LINE }), el("p", { cls: "maker", text: C.SUITE_LINE })]); }

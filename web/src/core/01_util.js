// ---------------------------------------------------------------- shared helpers (twin of src/errata/util.py)
class CreditError extends Error {
  constructor(code, message) { super(message); this.code = code; this.name = "CreditError"; }
}
const MONEY_RE = /^\(?-?\$?\s*-?[0-9][0-9,]*(\.[0-9]+)?\)?$/;
function parse_money(s) {
  if (s === null || s === undefined) return null;
  let t = String(s).trim().replace(/ /g, "");
  if (!t || ["---", "--", "-", "N/A", "n/a"].includes(t)) return null;
  if (t.startsWith(".") && /^\.[0-9]+$/.test(t)) t = "0" + t;
  if (!MONEY_RE.test(t)) return null;
  const neg = t.startsWith("-") || t.startsWith("(") || t.includes("$-");
  const digits = t.replace(/[^0-9.]/g, "");
  if ((digits.match(/\./g) || []).length > 1 || !digits.replace(/\./g, "")) return null;
  const i = digits.indexOf(".");
  const whole = i < 0 ? digits : digits.slice(0, i);
  const frac = ((i < 0 ? "" : digits.slice(i + 1)) + "00").slice(0, 2);
  const v = parseInt(whole || "0", 10) * 100 + parseInt(frac, 10);
  return neg ? -v : v;
}
function commas(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
function money_text(c, cents) {
  if (c === null || c === undefined) return "";
  const neg = c < 0;
  c = Math.abs(Math.trunc(c));
  const d = Math.floor(c / 100), r = c % 100;
  let s = commas(d);
  if (cents || r) s += "." + String(r).padStart(2, "0");
  return (neg ? "-$" : "$") + s;
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad2 = (n) => String(n).padStart(2, "0");
const pad4 = (n) => String(n).padStart(4, "0");
function leap(y) { return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0); }
function mdays(y, m) { return [31, leap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]; }
function valid_ymd(y, m, d) { return m >= 1 && m <= 12 && d >= 1 && d <= mdays(y, m) && y >= 1 && y <= 9999; }
function parse_date(s) {
  if (s === null || s === undefined) return null;
  const t = String(s).trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) { const mo = +m[1], d = +m[2], y = +m[3]; return valid_ymd(y, mo, d) ? pad4(y) + "-" + pad2(mo) + "-" + pad2(d) : null; }
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return valid_ymd(+m[1], +m[2], +m[3]) ? t : null;
  return null;
}
function parse_month(s) {
  if (s === null || s === undefined) return null;
  const t = String(s).trim();
  let m = /^(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) { const mo = +m[1], y = +m[2]; return mo >= 1 && mo <= 12 ? pad4(y) + "-" + pad2(mo) : null; }
  m = /^([A-Z][a-z]{2})\s+(\d{4})$/.exec(t);
  if (m && MONTHS.includes(m[1])) return pad4(+m[2]) + "-" + pad2(MONTHS.indexOf(m[1]) + 1);
  if (/^\d{4}-\d{2}$/.test(t) && +t.slice(5, 7) >= 1 && +t.slice(5, 7) <= 12) return t;
  const d = parse_date(t);
  return d ? d.slice(0, 7) : null;
}
// days from civil (proleptic Gregorian), no time zones involved
function day_number(iso_s) {
  let y = +iso_s.slice(0, 4); const m = +iso_s.slice(5, 7), d = +iso_s.slice(8, 10);
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 400), yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
function from_day_number(z) {
  z += 719468;
  const era = Math.floor(z / 146097), doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  let y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  if (m <= 2) y += 1;
  return pad4(y) + "-" + pad2(m) + "-" + pad2(d);
}
function weekday(iso_s) { return ((day_number(iso_s) % 7) + 7 + 3) % 7; } // Monday 0, like Python
function add_days(iso_s, n) { return from_day_number(day_number(iso_s) + n); }
function days_between(a, b) { return day_number(b) - day_number(a); }
function month_index(ym) { return +ym.slice(0, 4) * 12 + +ym.slice(5, 7) - 1; }
function month_from_index(i) { return pad4(Math.floor(i / 12)) + "-" + pad2((i % 12) + 1); }
function add_months(ym, n) { return month_from_index(month_index(ym) + n); }
function months_between(a, b) { return month_index(b) - month_index(a); }
function add_months_date(iso_s, n) {
  const y = +iso_s.slice(0, 4), m = +iso_s.slice(5, 7), d = +iso_s.slice(8, 10);
  const i = y * 12 + m - 1 + n, y2 = Math.floor(i / 12), m2 = (i % 12) + 1;
  return pad4(y2) + "-" + pad2(m2) + "-" + pad2(Math.min(d, mdays(y2, m2)));
}
function month_label(ym) { return ym ? MONTHS[+ym.slice(5, 7) - 1] + " " + ym.slice(0, 4) : ""; }
function us_date(iso_s) {
  if (!iso_s) return "";
  if (iso_s.length === 7) return iso_s.slice(5, 7) + "/" + iso_s.slice(0, 4);
  return iso_s.slice(5, 7) + "/" + iso_s.slice(8, 10) + "/" + iso_s.slice(0, 4);
}
const LONG_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function long_date(iso_s) { return LONG_MONTHS[+iso_s.slice(5, 7) - 1] + " " + (+iso_s.slice(8, 10)) + ", " + iso_s.slice(0, 4); }
// legal public holidays (5 U.S.C. 6103), observed Friday or Monday
function ymd(y, m, d) { return pad4(y) + "-" + pad2(m) + "-" + pad2(d); }
function nth_weekday(y, m, wd, n) { let d = ymd(y, m, 1); d = add_days(d, (wd - weekday(d) + 7) % 7); return add_days(d, 7 * (n - 1)); }
function last_weekday(y, m, wd) { const d = ymd(y, m, mdays(y, m)); return add_days(d, -((weekday(d) - wd + 7) % 7)); }
function observed(d) { const w = weekday(d); return w === 5 ? add_days(d, -1) : w === 6 ? add_days(d, 1) : d; }
const HOLIDAY_CACHE = new Map();
function holidays(y) {
  if (HOLIDAY_CACHE.has(y)) return HOLIDAY_CACHE.get(y);
  const out = [observed(ymd(y, 1, 1)), nth_weekday(y, 1, 0, 3), nth_weekday(y, 2, 0, 3), last_weekday(y, 5, 0), observed(ymd(y, 6, 19)),
    observed(ymd(y, 7, 4)), nth_weekday(y, 9, 0, 1), nth_weekday(y, 10, 0, 2), observed(ymd(y, 11, 11)), nth_weekday(y, 11, 3, 4), observed(ymd(y, 12, 25))];
  if (weekday(ymd(y + 1, 1, 1)) === 5) out.push(ymd(y, 12, 31));
  const r = out.filter((d) => d.slice(0, 4) === pad4(y) || true).sort();
  HOLIDAY_CACHE.set(y, r);
  return r;
}
function is_business_day(iso_s) { return weekday(iso_s) < 5 && !holidays(+iso_s.slice(0, 4)).includes(iso_s); }
function add_business_days(iso_s, n) { let d = iso_s, k = 0; while (k < n) { d = add_days(d, 1); if (is_business_day(d)) k++; } return d; }
function norm_space(s) { return String(s === null || s === undefined ? "" : s).replace(/\s+/g, " ").trim(); }
function norm_name(s) { return String(s === null || s === undefined ? "" : s).toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim(); }
function edit_distance(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0)));
    prev = cur;
  }
  return prev[prev.length - 1];
}
function slug(s) { const t = String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); return t.slice(0, 40) || "x"; }
const UTF8 = new TextEncoder();
function stable_hash(s) {
  let h = 0x811c9dc5;
  for (const ch of UTF8.encode(String(s))) { h ^= ch; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}
// Python-style helpers used across the core
function cmp(a, b) { // compare arrays lexicographically like Python tuples
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const x = a[i], y = b[i];
    if (x === y) continue;
    if (typeof x === "boolean" || typeof y === "boolean") return (x ? 1 : 0) - (y ? 1 : 0);
    return x < y ? -1 : 1;
  }
  return a.length - b.length;
}
function sortBy(arr, key) { return arr.map((v, i) => [key(v), i, v]).sort((p, q) => cmp(p[0], q[0]) || p[1] - q[1]).map((x) => x[2]); }
function uniqSorted(arr) { return Array.from(new Set(arr)).sort(); }
function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

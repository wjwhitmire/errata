// The browser's reading path in node: the pinned pdf.js reads each synthetic fixture PDF, the JS core
// parses the text items and finds the planted errors with the same rules the Python tests check.
// Usage: node web/pdfjs.test.mjs [file.pdf ...]   (with files: print aggregate counts only)
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
// Text extraction never draws, so node needs only placeholders for the drawing classes pdf.js checks for.
for (const k of ["DOMMatrix", "ImageData", "Path2D"]) if (!globalThis[k]) globalThis[k] = class { constructor() { this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0; } };
const pdfjs = await import(pathToFileURL(join(here, "vendor", "pdf.min.mjs")).href);
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(join(here, "vendor", "pdf.worker.min.mjs")).href;
const coreDir = join(here, "src", "core");
const src = readdirSync(coreDir).filter((f) => f.endsWith(".js")).sort().map((f) => readFileSync(join(coreDir, f), "utf8")).join("\n");
const ctx = vm.createContext({ TextEncoder });
vm.runInContext(src + "\n;globalThis.CORE = CORE;", ctx);
const C = ctx.CORE;

export async function readItems(path) {
  const data = new Uint8Array(readFileSync(path));
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, enableXfa: false, verbosity: 0 }).promise;
  let items = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    items = items.concat(C.items_from_pdfjs(p - 1, vp.height, tc.items));
  }
  await doc.destroy();
  return items;
}

const args = process.argv.slice(2);
if (args.length) {
  for (const f of args) {
    const r = C.parse_items(await readItems(f), "");
    const fs = C.find(r, { as_of: r.source.report_date });
    const p = r.personal;
    console.log(JSON.stringify({ accounts: r.accounts.length, inquiries: r.inquiries.length, akas: p.names.filter((n) => n.kind === "aka").length,
      addresses: p.addresses.length, phones: p.phones.length, employers: p.employers.length, confidence: r.source.confidence, warnings: r.warnings.length,
      findings: fs.length, by_rule: C.findings_summary(fs).by_rule }));
  }
  process.exit(0);
}
const V = JSON.parse(readFileSync(join(here, "..", "tests", "vectors.json"), "utf8"));
let fails = 0;
const want = { tu_planted: V.fixtures.planted, tu_clean: V.fixtures.clean, tu_round2: V.fixtures.round2, ex_planted: V.fixtures.ex, eq_planted: V.fixtures.eq };
for (const name of Object.keys(want)) {
  const r = C.parse_items(await readItems(join(here, "..", "tests", "fixtures", name + ".pdf")), "");
  const w = want[name];
  const canon = (v) => Array.isArray(v) ? "[" + v.map(canon).join(",") + "]" : v && typeof v === "object" ? "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}" : JSON.stringify(v);
  const simple = (x) => canon({ n: x.accounts.length, ids: x.accounts.map((a) => a.id), hist: x.accounts.map((a) => a.history.map((h) => h.month + h.rating + h.bal + h.due)),
    pers: x.personal, inq: x.inquiries.map((q) => [q.kind, q.name, q.dates, q.location, q.purpose]), bal: x.accounts.map((a) => [a.balance, a.pay_status, a.terms.text, a.max_delinquency.text, a.removal]) });
  if (simple(r) !== simple(w)) {
    const a = simple(r), b = simple(w);
    let i = 0;
    while (a[i] === b[i]) i++;
    fails++;
    console.error("FAIL " + name + ": pdf.js items parse differently from the pdfminer items near\n  " + a.slice(Math.max(0, i - 120), i + 80) + "\n  " + b.slice(Math.max(0, i - 120), i + 80));
  }
  const a = C.find(r, { as_of: "2026-10-20" }).map((f) => f.id).join(","), b = C.find(w, { as_of: "2026-10-20" }).map((f) => f.id).join(",");
  if (a !== b) { fails++; console.error("FAIL " + name + ": findings differ between the two text readers"); }
}
console.log(fails ? fails + " failures" : "pdf.js reading path matches the Python reader on all fixtures");
process.exit(fails ? 1 : 0);

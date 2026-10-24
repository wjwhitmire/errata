// Parity check: load the browser core (web/src/core/*.js, joined in name order) in node:vm and
// replay every case in tests/vectors.json, written by the Python library. Every value is compared
// exactly: same keys, same numbers, same text; refused calls give the same error code and message;
// DOCX and PDF output are compared by the SHA-256 of their bytes.
// Usage: python tests/make_vectors.py && node web/parity.test.mjs
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const coreDir = join(here, "src", "core");
const src = readdirSync(coreDir).filter((f) => f.endsWith(".js")).sort().map((f) => readFileSync(join(coreDir, f), "utf8")).join("\n");
// strings and comments removed first, so text such as "word/document.xml" is not mistaken for code
const code = src.replace(/\/\/[^\n]*/g, "").replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""');
if (/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon|document|window|localStorage|indexedDB|eval)\b\s*[.(]/.test(code) || /new Function/.test(code)) {
  console.error("FAIL: the core must not touch the network, the DOM, storage or eval");
  process.exit(1);
}
const ctx = vm.createContext({ TextEncoder });
vm.runInContext(src + "\n;globalThis.CORE = CORE;", ctx, { filename: "core.js" });
const C = ctx.CORE;
const V = JSON.parse(readFileSync(join(here, "..", "tests", "vectors.json"), "utf8"));

let checks = 0;
const failures = [];
const fail = (msg) => { if (failures.length < 40) failures.push(msg); else failures.length++; };
function compare(got, want, path) {
  checks++;
  if (want === null || typeof want !== "object") {
    if (got !== want) fail(`${path}: got ${JSON.stringify(got)?.slice(0, 200)}, want ${JSON.stringify(want)?.slice(0, 200)}`);
    return;
  }
  if (Array.isArray(want)) {
    if (!Array.isArray(got) || got.length !== want.length) { fail(`${path}: array length got ${got && got.length}, want ${want.length}`); return; }
    want.forEach((w, i) => compare(got[i], w, `${path}[${i}]`));
    return;
  }
  if (got === null || typeof got !== "object" || Array.isArray(got)) { fail(`${path}: got ${JSON.stringify(got)?.slice(0, 80)}, want an object`); return; }
  const gk = Object.keys(got).sort().join(","), wk = Object.keys(want).sort().join(",");
  if (gk !== wk) fail(`${path}: keys differ\n  got  ${gk}\n  want ${wk}`);
  for (const k of Object.keys(want)) compare(got[k], want[k], `${path}.${k}`);
}
const plain = (x) => (x === undefined ? null : JSON.parse(JSON.stringify(x)));
function resolve(x) {
  if (Array.isArray(x)) return x.map(resolve);
  if (x && typeof x === "object") {
    const keys = Object.keys(x);
    if (keys.length === 1 && keys[0] === "$fx") return JSON.parse(JSON.stringify(V.fixtures[x.$fx]));
    const o = {};
    for (const k of keys) o[k] = resolve(x[k]);
    return o;
  }
  return x;
}
const inRealm = (x) => vm.runInContext("(" + JSON.stringify(x) + ")", ctx);
const sha = (u8) => createHash("sha256").update(Buffer.from(u8)).digest("hex");
const ADAPT = {
  docx_sha: (L) => sha(C.docx(L)),
  letter_pdf_sha: (L, cover, tracking) => sha(C.letter_pdf(L, cover, tracking)),
};
const counts = {};
for (const c of V.cases) {
  counts[c.fn] = (counts[c.fn] || 0) + 1;
  const where = `${c.fn}#${counts[c.fn]}`;
  const fn = ADAPT[c.fn] || C[c.fn];
  if (typeof fn !== "function") { checks++; fail(`${where}: no JS function`); continue; }
  let out, err = null;
  try { out = fn(...resolve(c.args).map(inRealm)); } catch (e) { err = e; }
  if ("error" in c) {
    checks++;
    if (!err) fail(`${where}: expected error ${c.error}, got a result`);
    else if (err.code !== c.error || err.message !== c.message) fail(`${where}: got ${err.code} "${err.message}", want ${c.error} "${c.message}"`);
    continue;
  }
  if (err) { checks++; fail(`${where}: threw ${err.code || ""} ${err.message}\n${(err.stack || "").split("\n").slice(1, 4).join("\n")}`); continue; }
  compare(plain(out), c.out, where);
}
compare(C.PRODUCT_NAME, V.constants.product_name, "PRODUCT_NAME");
compare(plain(C.TABLES), V.constants.tables, "TABLES");
if (failures.length) {
  console.error(failures.join("\n"));
  console.error(`FAIL: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`ok: ${checks} checks over ${V.cases.length} cases`);

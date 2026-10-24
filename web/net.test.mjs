// Static check of the one-gate network rule: in the interface and the core, fetch appears only in
// net() (web/src/ui/05_net.js), dynamic imports only for the pinned on-device library and the embedded PDF reader (a local blob), and nothing
// else that can reach the network (XMLHttpRequest, WebSocket, EventSource, sendBeacon, peer
// connections, remote images or scripts) appears at all. Strings and comments are ignored.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1")
  .replace(/`(?:\\.|[^`\\])*`/g, "``").replace(/"(?:\\.|[^"\\\n])*"/g, '""').replace(/'(?:\\.|[^'\\\n])*'/g, "''");
let checks = 0;
const where = {};
for (const dir of ["src/ui", "src/core"]) {
  for (const f of readdirSync(join(here, dir)).filter((x) => x.endsWith(".js")).sort()) {
    const code = strip(readFileSync(join(here, dir, f), "utf8"));
    for (const [name, re] of [["fetch", /\bfetch\s*\(/g], ["import", /\bimport\s*\(/g], ["XMLHttpRequest", /XMLHttpRequest/g], ["WebSocket", /WebSocket/g],
      ["EventSource", /EventSource/g], ["sendBeacon", /sendBeacon/g], ["RTCPeerConnection", /RTCPeerConnection/g], ["serviceWorker", /serviceWorker/g], ["src=", /\.src\s*=/g]]) {
      const n = (code.match(re) || []).length;
      checks++;
      if (n) where[name] = (where[name] || []).concat([f + " x" + n]);
    }
  }
}
assert.deepEqual(where.fetch, ["05_net.js x1"], "fetch only in net(): " + JSON.stringify(where.fetch));
assert.deepEqual(where.import, ["34_reports.js x1", "48_ai.js x1"], "dynamic imports: the pinned library, and the embedded PDF reader from a local blob: " + JSON.stringify(where.import));
assert.match(readFileSync(join(here, "src/ui/34_reports.js"), "utf8"), /globalThis\.pdfjsWorker = await import\(pdfWorkerUrl\(\)\)/, "the PDF fallback imports only the embedded reader's blob URL");
for (const k of ["XMLHttpRequest", "WebSocket", "EventSource", "sendBeacon", "RTCPeerConnection", "serviceWorker", "src="]) assert.equal(where[k], undefined, k + " found in " + JSON.stringify(where[k]));
const net = readFileSync(join(here, "src/ui/05_net.js"), "utf8");
assert.match(net, /const d = netDecision\(feature, url\);\s*if \(!d\.ok\) throw/, "net() checks the gate before fetching");
assert.match(net, /function switchOn\(name\)[\s\S]*?=== true/, "switches are off unless explicitly true");
const store = readFileSync(join(here, "src/ui/10_store.js"), "utf8");
assert.match(store, /DEFAULT_SETTINGS = \{[^}]*net: \{\}/, "no switch is on by default");
console.log("ok: " + checks + " network checks");

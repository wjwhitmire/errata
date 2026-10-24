// The writing helper's outgoing text: no SSN in any form and no date of birth ever leaves the device,
// the tailoring request carries only the sentences it may replace, and the rewrite check refuses added
// facts and claims. Usage: node web/ai.test.mjs
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "src", "core");
const src = readdirSync(dir).filter((f) => f.endsWith(".js")).sort().map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
const ctx = vm.createContext({ TextEncoder });
vm.runInContext(src + "\n;globalThis.CORE = CORE;", ctx);
const C = ctx.CORE;
let n = 0;
const fails = [];
const ok = (cond, msg) => { n++; if (!cond) fails.push(msg); };
const prof = { dob: "1980-01-02", ssn_last4: "4321", name: "Jordan Example" };
const bad = [
  ["My SSN is 123-45-6789.", "123-45-6789"], ["ssn 123 45 6789", "123 45 6789"], ["number 123456789", "123456789"], ["Social Security number: XXX-XX-4321", "4321"],
  ["SSN ending in 4321", "4321"], ["last four 4321 on file", "4321"], ["Date of birth: 01/02/1980", "01/02/1980"], ["DOB 1/2/1980", "1/2/1980"],
  ["born on January 2, 1980", "January 2, 1980"], ["birthdate 1980-01-02", "1980-01-02"], ["On file: 01/02/1980", "01/02/1980"], ["Year of birth 1980", "1980"],
  ["My file shows a date of birth of 03/04/1979; my date of birth is 01/02/1980.", "03/04/1979"],
];
for (const [text, secret] of bad) {
  const out = C.redact_text(text, prof);
  ok(!out.includes(secret), "leaked " + secret + " from: " + text + " -> " + out);
}
ok(C.redact_text("Balance $1,234 on 05/2024, account 4111****", prof) === "Balance $1,234 on 05/2024, account 4111****", "harmless text changed");
const f = { rule: "identity_mismatch", title: "Date of birth or SSN digits do not match", subject: "Date of birth", facts: ["My file shows a date of birth of 03/04/1979; my date of birth is 01/02/1980."],
  evidence: [{ label: "On file", value: "03/04/1979" }, { label: "Yours", value: "01/02/1980" }], legal: ["fcra611"], request: "Please correct my date of birth." };
const msgs = C.redact_messages(C.ai_explain_messages(f), prof);
const body = JSON.stringify(msgs);
ok(!body.includes("01/02/1980") && !body.includes("03/04/1979"), "explain payload carries a date of birth: " + body);
const L = { blocks: [
  { kind: "p", text: "I am writing to dispute.", src: ["template"], asserts: false },
  { kind: "p", text: "The account shows a Date Paid of 03/15/2024.", src: ["finding:f1"], asserts: true },
  { kind: "p", text: "Please delete the late entries.", src: ["finding:f1"], asserts: false },
  { kind: "id", text: "Date of birth: 01/02/1980", src: ["profile"], asserts: true }] };
const tm = C.ai_tailor_messages(L);
const sent = JSON.parse(tm[1].content.split("DATA:\n")[1]);
ok(sent.length === 1 && sent[0] === "Please delete the late entries.", "tailoring sends more than the replaceable sentences: " + JSON.stringify(sent));
const chk = C.check_rewrite(["Please delete the late entries."], "Please delete the late entries; this account is not mine.");
ok(!chk.ok, "rewrite added a not-mine claim and passed");
ok(!C.check_rewrite(["Please delete the late entries."], "Please delete the 3 late entries.").ok, "rewrite added a number and passed");
ok(C.check_rewrite(["Please delete the late entries."], "Please remove the late entries.").ok, "a plain rewording was refused");
if (fails.length) { console.error("FAIL: " + fails.length + " of " + n + "\n" + fails.join("\n")); process.exit(1); }
console.log("ok: " + n + " writing helper checks");

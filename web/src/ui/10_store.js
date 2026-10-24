// ---------------------------------------------------------------- storage: IndexedDB, encrypted per person
// Stores: kv (settings for this device and the keys you give the optional services) and people (one
// record per person). A person's record holds their reports, letters, mail log, scores and vault
// files. With "Encrypt stored data" on (the default) the record is AES-GCM ciphertext under a key made
// from that person's passphrase (PBKDF2 with SHA-256, 600,000 rounds); only the name, initials and
// relationship stay readable so the switcher and the lock screen can show who it is. The example
// family lives in memory only and is never written to this device.
const DB_NAME = "field-tools-errata";
const STORES = ["kv", "people"];
const KDF_ITER = 600000;
const DEFAULT_SETTINGS = { theme: "", lockMinutes: 5, net: {}, aiBase: "", aiModel: "", mailFrom: "" };
const S = {
  mode: "none",           // "device" or "example"
  settings: Object.assign({}, DEFAULT_SETTINGS),
  people: [],             // index: {id, name, initials, relationship, encrypted}
  cur: null,              // id of the person being worked on
  data: null,             // that person's record, decrypted
  key: null,              // that person's AES key while unlocked
  mem: new Map(),         // the example's records (memory only)
  ver: 0, today: "", route: "", ui: {}, undo: null, lockAt: 0,
};
let DB = null;
function idbOpen() {
  return new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(DB_NAME, 1); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => { for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("Another tab is upgrading storage. Close it and reload."));
  });
}
function idb(store, mode, fn) {
  return new Promise((resolve, reject) => {
    if (!DB) { resolve(undefined); return; }
    let tx;
    try { tx = DB.transaction(store, mode); } catch (e) { reject(e); return; }
    let out;
    const r = fn(tx.objectStore(store));
    if (r && "onsuccess" in r) r.onsuccess = () => { out = r.result; };
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Storage write was refused (the device may be full)."));
  });
}
const dbGet = (store, key) => idb(store, "readonly", (s) => s.get(key));
const dbPut = (store, key, val) => idb(store, "readwrite", (s) => s.put(val, key));
const dbDel = (store, key) => idb(store, "readwrite", (s) => s.delete(key));
const dbKeys = (store) => idb(store, "readonly", (s) => s.getAllKeys());
async function kvGet(key, dflt) { try { const v = await dbGet("kv", key); return v === undefined ? dflt : v; } catch (e) { return dflt; } }
async function kvSet(key, val) { if (S.mode === "example") { S.mem.set("kv:" + key, val); return; } try { await dbPut("kv", key, val); } catch (e) { toast("Could not save: " + e.message); } }
async function kvRead(key, dflt) { if (S.mode === "example") return S.mem.has("kv:" + key) ? S.mem.get("kv:" + key) : dflt; return kvGet(key, dflt); }

// ---- encryption
async function deriveKey(pass, salt, iter) {
  const base = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function sealWith(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(obj))));
  return { iv: b64(iv), ct: b64(ct) };
}
async function openWith(key, rec) {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBytes(rec.iv) }, key, b64ToBytes(rec.ct));
  return JSON.parse(dec.decode(pt));
}

// ---- people records
function indexEntry(rec) { return { id: rec.id, name: rec.name, initials: rec.initials, relationship: rec.relationship, encrypted: !!rec.encrypted }; }
async function recGet(id) { return S.mode === "example" ? S.mem.get("p:" + id) : dbGet("people", id); }
async function recPut(rec) { if (S.mode === "example") S.mem.set("p:" + rec.id, rec); else await dbPut("people", rec.id, rec); }
async function loadIndex() {
  const out = [];
  if (S.mode === "example") { for (const [k, v] of S.mem) if (k.startsWith("p:")) out.push(indexEntry(v)); }
  else for (const k of (await dbKeys("people")) || []) { const r = await dbGet("people", k); if (r) out.push(indexEntry(r)); }
  out.sort((a, b) => (a.relationship === "You" ? -1 : b.relationship === "You" ? 1 : a.name.localeCompare(b.name)));
  S.people = out;
}
function initials(name) { return String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?"; }
function emptyPerson(id, name, rel) {
  return { id, name, relationship: rel, initials: initials(name), example: false, start: "", goal: "standard",
    profile: { name, mailing: [], dob: "", ssn_last4: "", names: [], addresses: [], phones: [], employers: [], facts: {}, ftc_report: "", state: "", accommodations: [] },
    rounds: [], mail: [], status: {}, corrections: {}, vault: [], notices: {}, scores: [], cards: [], accurate: {}, offers: [], secrets: {} };
}
async function createPerson(name, rel, pass) {
  const id = "p-" + Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, "0")).join("");
  const data = emptyPerson(id, cleanName(name, 60), cleanName(rel, 40) || "Family");
  const rec = { id, name: data.name, initials: data.initials, relationship: data.relationship, encrypted: !!pass };
  let key = null;
  if (pass) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    key = await deriveKey(pass, salt, KDF_ITER);
    Object.assign(rec, { salt: b64(salt), iter: KDF_ITER }, await sealWith(key, data));
  } else rec.plain = data;
  await recPut(rec);
  await loadIndex();
  return { id, data, key };
}
// A record read back from storage or a backup keeps only fields of the kinds this tool writes, so a
// damaged or hand-edited record opens with empty parts instead of breaking every screen.
function normalPerson(raw, id, name, rel) {
  const base = emptyPerson(id, name, rel);
  const out = Object.assign({}, base);
  for (const k of Object.keys(raw || {})) {
    const v = raw[k], d = base[k];
    if (!(k in base)) { if (v !== null && typeof v === "object" && !Array.isArray(v)) out[k] = v; else if (typeof v === "string" || typeof v === "boolean") out[k] = v; continue; }
    if (Array.isArray(d)) out[k] = Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : d;
    else if (d && typeof d === "object") out[k] = v && typeof v === "object" && !Array.isArray(v) ? v : d;
    else if (typeof d === "string") out[k] = typeof v === "string" ? v : d;
    else if (typeof d === "boolean") out[k] = typeof v === "boolean" ? v : d;
  }
  out.profile = Object.assign({}, base.profile, out.profile);
  for (const k of ["mailing", "names", "addresses", "phones", "employers"]) if (!Array.isArray(out.profile[k])) out.profile[k] = [];
  if (!out.profile.facts || typeof out.profile.facts !== "object") out.profile.facts = {};
  if (!Array.isArray(out.profile.accommodations)) out.profile.accommodations = [];
  out.rounds = out.rounds.filter((rd) => Array.isArray(rd.reports) && rd.reports.every((x) => x && Array.isArray(x.accounts) && x.source && typeof x.bureau === "string"));
  out.id = id;
  return out;
}
async function unlockPerson(id, pass) {
  const rec = await recGet(id);
  if (!rec) throw new Error("That person is not on this device.");
  if (!rec.encrypted) return { data: normalPerson(rec.plain, rec.id, rec.name, rec.relationship), key: null };
  if (!(rec.iter >= KDF_ITER && rec.iter <= 10000000)) throw new Error("This record's key settings are not ones this tool uses.");
  const key = await deriveKey(pass, b64ToBytes(rec.salt), rec.iter);
  let data;
  try { data = await openWith(key, rec); } catch (e) { throw new Error("That passphrase does not open " + rec.name + "'s record."); }
  return { data: S.mode === "example" ? data : normalPerson(data, rec.id, rec.name, rec.relationship), key };
}
let saveTimer = null;
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { saveNow().catch((e) => toast("Could not save: " + e.message)); }, 250); }
async function saveNow() {
  clearTimeout(saveTimer);
  if (!S.data || !S.cur) return;
  const rec = await recGet(S.cur);
  if (!rec) return;
  const out = { id: rec.id, name: S.data.name, initials: S.data.initials, relationship: S.data.relationship, encrypted: rec.encrypted };
  if (rec.encrypted) {
    if (!S.key) return;
    Object.assign(out, { salt: rec.salt, iter: rec.iter }, await sealWith(S.key, S.data));
  } else out.plain = S.data;
  await recPut(out);
}
async function setEncryption(on, pass) {
  const rec = await recGet(S.cur);
  if (!rec) return;
  if (on) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    S.key = await deriveKey(pass, salt, KDF_ITER);
    await recPut(Object.assign({ id: rec.id, name: rec.name, initials: rec.initials, relationship: rec.relationship, encrypted: true, salt: b64(salt), iter: KDF_ITER }, await sealWith(S.key, S.data)));
  } else {
    S.key = null;
    await recPut({ id: rec.id, name: rec.name, initials: rec.initials, relationship: rec.relationship, encrypted: false, plain: S.data });
  }
  await loadIndex();
}
// Keys for the optional services live in the person's own record, so they are encrypted with that
// person's passphrase. Older builds kept them in this device's settings store; they move on first use.
const SECRET_KV = { ai: "aiKey", mail: "mailKey" };
async function kvDel(key) { if (S.mode === "example") { S.mem.delete("kv:" + key); return; } try { await dbDel("kv", key); } catch (e) { /* gone */ } }
async function secretGet(name) {
  const have = S.data && S.data.secrets && typeof S.data.secrets[name] === "string" ? S.data.secrets[name] : "";
  if (have) return have;
  const old = SECRET_KV[name] ? await kvRead(SECRET_KV[name], "") : "";
  if (old && S.data) { secretSet(name, old); await kvDel(SECRET_KV[name]); }
  return old || "";
}
function secretSet(name, value) {
  if (!S.data) return;
  S.data.secrets = Object.assign({}, S.data.secrets || {}, { [name]: String(value || "").slice(0, 400) });
  S.ver++;
  scheduleSave();
}
// What a backup carries: encrypted records as they are; a record stored unencrypted is written without
// its service keys, and the person is told it is readable.
function backupRecord(rec) {
  if (!rec || rec.encrypted || !rec.plain) return rec;
  const plain = Object.assign({}, rec.plain);
  delete plain.secrets;
  return Object.assign({}, rec, { plain });
}
// A restored record is checked field by field: only the fields this tool writes, of the right kinds.
function restoredRecord(r) {
  if (!r || typeof r !== "object" || typeof r.id !== "string" || !/^p-[0-9a-f]{12}$/.test(r.id)) return null;
  const base = { id: r.id, name: cleanName(r.name, 60) || "Person", initials: cleanName(r.initials, 4) || "?", relationship: cleanName(r.relationship, 40) || "Family" };
  if (r.encrypted) {
    if (typeof r.ct !== "string" || typeof r.iv !== "string" || typeof r.salt !== "string" || !Number.isInteger(r.iter)) return null;
    if (r.ct.length > 400 * 1024 * 1024 || r.iv.length > 64 || r.salt.length > 64) return null;
    return Object.assign(base, { encrypted: true, ct: r.ct, iv: r.iv, salt: r.salt, iter: r.iter });
  }
  if (!r.plain || typeof r.plain !== "object" || Array.isArray(r.plain)) return null;
  return Object.assign(base, { encrypted: false, plain: normalPerson(r.plain, r.id, base.name, base.relationship) });
}
async function deletePerson(id) {
  if (S.mode === "example") S.mem.delete("p:" + id); else await dbDel("people", id);
  await loadIndex();
}
// Delete everything on this device: every person, every setting and key, the kept model and
// language files. Pending saves are cancelled and storage detached first so nothing writes back.
async function deleteAllData() {
  clearTimeout(saveTimer);
  const db = DB;
  DB = null;
  if (db) {
    for (const s of STORES) {
      await new Promise((resolve) => { try { const tx = db.transaction(s, "readwrite"); tx.objectStore(s).clear(); tx.oncomplete = tx.onerror = tx.onabort = () => resolve(); } catch (e) { resolve(); } });
    }
    try { db.close(); } catch (e) { /* closed */ }
  }
  await new Promise((resolve) => { try { const r = indexedDB.deleteDatabase(DB_NAME); r.onsuccess = r.onerror = r.onblocked = () => resolve(); } catch (e) { resolve(); } });
  try { Object.keys(localStorage).filter((k) => k.startsWith("errata:")).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* none */ }
  try { if (typeof caches !== "undefined") for (const k of ["webllm/config", "webllm/wasm", "webllm/model"]) await caches.delete(k); } catch (e) { /* none */ }
}
async function storageInit() {
  try { DB = await idbOpen(); } catch (e) { DB = null; }
  const st = DB ? await kvGet("settings", null) : null;
  S.settings = Object.assign({}, DEFAULT_SETTINGS, st && typeof st === "object" ? st : {});
  S.settings.net = Object.assign({}, S.settings.net || {});
}
async function saveSettings() { if (S.mode === "example") return; await kvSet("settings", S.settings); }

// ---- the example family: memory only, each person encrypted with the example passphrase
async function openExample() {
  S.mode = "example";
  S.mem = new Map();
  S.settings = Object.assign({}, DEFAULT_SETTINGS, EXAMPLE.settings, { net: {} });
  const pass = EXAMPLE.passphrase;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(pass, salt, KDF_ITER);
  for (const p of EXAMPLE.people) {
    const data = JSON.parse(JSON.stringify(p));
    const rec = Object.assign({ id: p.id, name: p.name, initials: p.initials, relationship: p.relationship, encrypted: true, salt: b64(salt), iter: KDF_ITER }, await sealWith(key, data));
    S.mem.set("p:" + p.id, rec);
  }
  await loadIndex();
  const first = EXAMPLE.people[0];
  S.cur = first.id;
  S.data = JSON.parse(JSON.stringify(first));
  S.key = key;
}
async function leaveExample() {
  S.mode = "device"; S.mem = new Map(); S.cur = null; S.data = null; S.key = null;
  await storageInit();
  await loadIndex();
}
function today() {
  if (S.mode === "example") return EXAMPLE.today;
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
// One change to the open person's record, with a one-step undo.
function change(label, fn, opts) {
  if (!S.data) return;
  const before = JSON.stringify(S.data);
  fn(S.data);
  S.ver++;
  scheduleSave();
  render();
  if (opts && opts.quiet) { const box = $("toasts"); if (box) for (const old of box.querySelectorAll(".toast .btn")) old.remove(); }
  else toast(label, () => { S.data = JSON.parse(before); S.ver++; scheduleSave(); render(); });
}

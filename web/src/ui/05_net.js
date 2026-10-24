// ---------------------------------------------------------------- network: one gate, four switches, all off
// Every way out of this page passes through net(). There are five network switches, all off by
// default, set in Settings:
//   ocr        the text reader for scanned pages: one download of its English language data from one
//              pinned address, checked against its SHA-384 before it is kept; on the Pages build also
//              the text engine itself, one pinned file from this same site;
//   mail       online certified mail through the person's own account with a mail service, with their
//              key, kept on this device; the exact request is shown before anything is sent;
//   ai-local   the on-device writing helper: its library (pinned) and the pinned model files, once;
//   ai-cloud   the writing helper with your own key: requests to the one service address the person
//              sets, shown in full before each is sent;
//   updates    at most once a day when the app opens, one request to GitHub's API for this project's
//              latest release (one pinned address, no data about the person).
// fetch appears only in net(); the headless tests check that the page makes no request with every
// switch off.
const OCR_DATA = Object.freeze({
  url: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz",
  sri: "sha384-JI+fraGAoc5GBGIliuqzHRnP1nJyrukg5ggNSBv/TO+YOVj+6Te6XXQOx7ia10xq",
  bytes: 2952873,
  lang: "eng",
});
const OCR_WASM = Object.freeze(/*OCR_WASM_PIN*/);
const OCR_WASM_URL = new URL(OCR_WASM.file, document.baseURI).href;
// The mail service's letters endpoint (a print-and-mail API that offers certified mail with an
// electronic return receipt). Only this address, only with the switch on and the person's own key.
const MAIL_URL = "https://api.lob.com/v1/letters";
// The project's address comes from where this copy is served: a GitHub Pages site at
// OWNER.github.io/REPO/ asks github.com/OWNER/REPO. Any other copy (a saved file, a local server)
// has nowhere to ask, so the update check stays unavailable there. Nothing is filled in at publish
// time, so the page's script fingerprints never change.
const REPO_URL = (() => {
  const h = /^([a-z0-9-]+)\.github\.io$/i.exec(location.hostname || "");
  const seg = (location.pathname || "").split("/").filter(Boolean)[0] || "";
  return h && /^[A-Za-z0-9._-]+$/.test(seg) ? "https://github.com/" + h[1] + "/" + seg : "";
})();
const UPDATE_URL = (() => { const m = /^https:\/\/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/.exec(REPO_URL); return m ? "https://api.github.com/repos/" + m[1] + "/" + m[2] + "/releases/latest" : ""; })();
const NET_SWITCHES = Object.freeze([
  { id: "ocr", title: "Text reader for scanned pages", detail: "Downloads the English language data once (" + (OCR_DATA.bytes / 1048576).toFixed(1) +
    " MB, from cdn.jsdelivr.net), pinned and checked against its fingerprint, and loads the text engine from this site the same way. The reading itself runs on this device. Off: only PDFs with a text layer can be read." },
  { id: "mail", title: "Online certified mail", detail: "Sends a letter through your own account with an online mail service (api.lob.com), with your key, which stays on this device. You see the exact request and its cost before anything is sent. Off: print and mail it yourself." },
  { id: "ai-local", title: "On-device writing helper", detail: "Downloads a small open model once (about " + (C.LOCAL_MODEL.approxBytes / 1e9).toFixed(1) +
    " GB, pinned by fingerprint) that runs here, on the graphics chip, to explain a finding or reword your own sentences. Facts and numbers still come only from your reports; reworded text is checked and anything added is refused." },
  { id: "ai-cloud", title: "Writing helper with your own key", detail: "The same help from a service you choose (any service with the common chat completions API, or a model server on this computer), with your key. Before anything is sent you see exactly what goes; that service's terms apply to it." },
  { id: "updates", title: "Check for a newer version", detail: UPDATE_URL ? "At most once a day when the app opens, asks GitHub (api.github.com) for this project's latest release. Nothing about you is sent; GitHub sees your network address, as any site does. Off: look at the project page yourself."
    : "Not available in this copy: it has no project address to ask. Look at the project page yourself." },
]);
const NET_FEATURES = Object.freeze({
  ocr: Object.freeze({ title: "Text reader", urls: Object.freeze([OCR_DATA.url, OCR_WASM_URL]) }),
  mail: Object.freeze({ title: "Online certified mail", urls: Object.freeze([MAIL_URL]) }),
  "ai-local": Object.freeze({ title: "On-device writing helper", urls: Object.freeze([C.LOCAL_MODEL.lib, C.LOCAL_MODEL.modelLib].concat(C.LOCAL_MODEL.files.map((f) => f.url))),
    redirectHosts: Object.freeze(["huggingface.co", "hf.co"]) }),
  "ai-cloud": Object.freeze({ title: "Writing helper with your own key", urls: null }),
  updates: Object.freeze({ title: "Check for a newer version", urls: Object.freeze(UPDATE_URL ? [UPDATE_URL] : []) }),
});
let NET_SENT = 0;
function switchOn(name) {
  const n = S.settings.net || {};
  return Object.prototype.hasOwnProperty.call(n, name) && n[name] === true;
}
function anySwitchOn() { return NET_SWITCHES.some((s) => switchOn(s.id)); }
function netDecision(feature, url) {
  const f = Object.prototype.hasOwnProperty.call(NET_FEATURES, feature) ? NET_FEATURES[feature] : null;
  if (!f) return { ok: false, reason: "no such network feature" };
  if (!switchOn(feature)) return { ok: false, reason: f.title + " is off" };
  let u;
  try { u = new URL(url); } catch (e) { return { ok: false, reason: "not a web address" }; }
  const service = feature === "ai-cloud" ? C.ai_endpoint(S.settings.aiBase || "") : null;
  const urls = service ? (service.ok ? [service.url] : []) : f.urls;
  const plainOk = u.origin === location.origin || (service && service.ok && service.local && u.origin === service.origin);
  if ((u.protocol !== "https:" && !plainOk) || !urls.includes(u.href)) return { ok: false, reason: u.hostname + " is not allowed" };
  return { ok: true };
}
async function net(feature, url, opts) {
  const d = netDecision(feature, url);
  if (!d.ok) throw new Error("Blocked: " + d.reason + ".");
  const hosts = NET_FEATURES[feature].redirectHosts || null;
  NET_SENT++;
  const r = await fetch(url, Object.assign({}, opts || {}, { credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store", redirect: hosts ? "follow" : "error" }));
  if (r.redirected) {
    let h = "";
    try { h = new URL(r.url).hostname; } catch (e) { h = ""; }
    if (!hosts || !hosts.some((x) => h === x || h.endsWith("." + x))) throw new Error("Blocked: a redirect to " + (h || "an unknown address") + ".");
  }
  return r;
}

// ---- online certified mail (switch "mail"): the request as it will be sent, shown first
function addressParts(name, lines) {
  const last = lines.length ? lines[lines.length - 1] : "";
  const m = /^(.*?),?\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/.exec(String(last).trim());
  if (!m) return null;
  const street = lines.slice(0, -1);
  return { name: String(name).slice(0, 40), address_line1: (street[0] || "").slice(0, 64), address_line2: (street.slice(1).join(" ") || "").slice(0, 64),
    address_city: m[1].trim(), address_state: m[2], address_zip: m[3], address_country: "US" };
}
function letterHtml(L) {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return "<html><body style=\"font-family:serif;font-size:11pt;margin:0.5in\">" + C.letter_text(L).split("\n").map((l) => "<div>" + (esc(l) || "&nbsp;") + "</div>").join("") + "</body></html>";
}
function mailRequest(L, key) {
  const to = addressParts(L.recipient.name, L.recipient.lines), from = addressParts(L.sender.name, L.sender.lines);
  if (!to || !from) throw new Error("Both addresses need a last line like \"Anytown, TX 75000\" for the mail service.");
  const body = new URLSearchParams();
  const put = (pre, o) => { for (const k of Object.keys(o)) if (o[k]) body.append(pre + "[" + k + "]", o[k]); };
  put("to", to); put("from", from);
  body.append("file", letterHtml(L));
  body.append("color", "false");
  body.append("extra_service", "certified_return_receipt");
  body.append("use_type", "operational");
  body.append("description", L.title.slice(0, 255));
  return { url: MAIL_URL, headers: { authorization: "Basic " + btoa(key + ":"), "content-type": "application/x-www-form-urlencoded" }, body: body.toString() };
}
async function sendMail(req) {
  const r = await net("mail", req.url, { method: "POST", headers: req.headers, body: req.body });
  let j = null;
  try { j = await r.json(); } catch (e) { j = null; }
  if (!r.ok) throw new Error("The mail service answered " + r.status + (j && j.error && j.error.message ? ": " + cleanName(j.error.message, 160) : "") + ".");
  return { id: j && j.id ? String(j.id) : "", tracking: j && j.tracking_number ? String(j.tracking_number) : "", expected: j && j.expected_delivery_date ? String(j.expected_delivery_date) : "" };
}

// ---- check for a newer version (switch "updates"): one GET, no credentials, no data about the person
function newerThan(a, b) {
  const pa = String(a).replace(/^v/, "").split(".").map((x) => parseInt(x, 10) || 0), pb = String(b).replace(/^v/, "").split(".").map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
}
async function checkForUpdate(force) {
  if (!switchOn("updates") || !UPDATE_URL || S.mode === "example") return null;
  const last = Number(await kvGet("updateChecked", 0)) || 0;
  if (!force && Date.now() - last < 86400000) return kvGet("updateLatest", null);
  await kvSet("updateChecked", Date.now());
  const r = await net("updates", UPDATE_URL, { method: "GET", headers: { accept: "application/vnd.github+json" } });
  if (!r.ok) return null;
  let j = null;
  try { j = await r.json(); } catch (e) { return null; }
  const tag = j && typeof j.tag_name === "string" ? cleanName(j.tag_name, 20) : "";
  const page = j && typeof j.html_url === "string" && j.html_url.startsWith(REPO_URL + "/releases/") ? j.html_url : REPO_URL + "/releases";
  const out = tag && newerThan(tag, C.APP_VERSION) ? { tag, page } : null;
  await kvSet("updateLatest", out);
  return out;
}

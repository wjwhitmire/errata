// ---------------------------------------------------------------- the optional writing helper (two switches, both off)
// It explains a finding in plain words and rewords the person's own letter sentences. It never makes
// a fact: the core makes every fact, number and date, report text goes in as quoted data, and a
// reworded letter is accepted only if it adds no fact token (number, date, money, company name) and
// no forbidden claim (not mine, identity theft, a credit privacy number, a promise). Requests to the
// person's own service are shown in full before they are sent.
const AI = { engine: null, loading: null };
const aiLocalOn = () => switchOn("ai-local");
const aiCloudOn = () => switchOn("ai-cloud") && C.ai_endpoint(S.settings.aiBase || "").ok && !!S.settings.aiModel;
function aiAvailable() { return aiLocalOn() || aiCloudOn(); }
const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
async function modelFileOk(f, buf) {
  if (f.bytes !== null && buf.byteLength !== f.bytes) return false;
  if (f.sha256) return hex(await crypto.subtle.digest("SHA-256", buf)) === f.sha256;
  if (f.git) {
    const head = enc.encode("blob " + buf.byteLength + "\0");
    const all = new Uint8Array(head.length + buf.byteLength);
    all.set(head); all.set(new Uint8Array(buf), head.length);
    return hex(await crypto.subtle.digest("SHA-1", all)) === f.git;
  }
  if (f.sri) return "sha384-" + b64(new Uint8Array(await crypto.subtle.digest("SHA-384", buf))) === f.sri;
  return false;
}
async function ensureModelFiles(onProgress) {
  if (typeof caches === "undefined") throw new Error("This browser keeps no file cache here (a private window or an http address), which the on-device helper needs.");
  const L = C.LOCAL_MODEL;
  const list = L.files.concat([{ name: "model library", url: L.modelLib, scope: "webllm/wasm", sri: L.modelLibSri, bytes: null }]);
  const total = L.files.reduce((a, f) => a + f.bytes, 0);
  let done = 0;
  for (const f of list) {
    const cache = await caches.open(f.scope);
    const kept = await cache.match(f.url);
    if (kept && await modelFileOk(f, await kept.arrayBuffer())) { done += f.bytes || 0; onProgress(done / total); continue; }
    if (kept) await cache.delete(f.url);
    const r = await net("ai-local", f.url);
    if (!r.ok) throw new Error("The model file " + f.name + " could not be downloaded (" + r.status + ").");
    const buf = await r.arrayBuffer();
    if (!(await modelFileOk(f, buf))) throw new Error("The model file " + f.name + " does not match its pinned fingerprint, so it was not used.");
    await cache.put(f.url, new Response(buf, { headers: { "content-type": f.name.endsWith(".json") ? "application/json" : "application/octet-stream" } }));
    done += f.bytes || 0;
    onProgress(done / total);
  }
}
async function localEngine(onProgress) {
  if (AI.engine) return AI.engine;
  if (!navigator.gpu) throw new Error("This browser has no WebGPU, which the on-device helper needs. The helper with your own key works without it.");
  if (AI.loading) return AI.loading;
  const L = C.LOCAL_MODEL;
  AI.loading = (async () => {
    const dd = netDecision("ai-local", L.lib);
    if (!dd.ok) throw new Error("Blocked: " + dd.reason + ".");
    await ensureModelFiles(onProgress);
    NET_SENT++;
    const webllm = await import(L.lib);
    const appConfig = { cacheBackend: "cache", model_list: [{ model: L.weights, model_id: L.model, model_lib: L.modelLib, low_resource_required: true, vram_required_MB: L.vramMB,
      integrity: { model_lib: L.modelLibSri, onFailure: "error" }, overrides: { context_window_size: L.contextTokens } }] };
    AI.engine = await webllm.CreateMLCEngine(L.model, { appConfig });
    return AI.engine;
  })();
  try { return await AI.loading; } finally { AI.loading = null; }
}
// One model call: shown first when it goes to the person's service; returns the text or null.
async function modelText(raw, what, out) {
  const messages = C.redact_messages(raw, (S.data || {}).profile || {});
  if (aiCloudOn()) {
    const key = await secretGet("ai");
    const ep = C.ai_endpoint(S.settings.aiBase);
    if (!key && !ep.local) { toast("Add your key in Settings first."); return null; }
    const req = C.provider_request(S.settings.aiBase, S.settings.aiModel, key, messages, [], {});
    const pv = C.provider_preview(req);
    const ok = await new Promise((resolve) => openDialog({ title: "Send to " + ep.host + "?", icon: "export", wide: true, onCancel: () => resolve(false),
      body: [el("p", { cls: "muted", text: what + ": only the text below is sent, with your key." }), el("pre", { cls: "outbox", text: "POST " + pv.url + "\n" + Object.keys(pv.headers).map((k) => k + ": " + pv.headers[k]).join("\n") + "\n\n" + pv.body })],
      actions: [{ label: "Cancel", onClick: () => resolve(false) }, { label: "Send", primary: true, id: "ai-send", onClick: () => resolve(true) }] }));
    if (!ok) return null;
    out.textContent = "Waiting for " + ep.host + "...";
    const r = await net("ai-cloud", req.url, { method: "POST", headers: req.headers, body: req.body });
    let j = null;
    try { j = await r.json(); } catch (e) { j = null; }
    if (!r.ok) throw new Error("The service answered " + r.status + ".");
    return C.provider_reply(j).text;
  }
  if (aiLocalOn()) {
    const engine = await localEngine((p) => { out.textContent = "Loading the on-device model: " + Math.round(p * 100) + "%"; });
    out.textContent = "Thinking on this device...";
    const r = await engine.chat.completions.create({ messages, temperature: 0.2, max_tokens: 500 });
    return r && r.choices && r.choices[0] ? String(r.choices[0].message.content || "") : "";
  }
  return null;
}
function aiExplainButton(f) {
  if (!aiAvailable()) return null;
  const out = el("p", { cls: "muted", "aria-live": "polite" });
  return el("div", { cls: "stack", style: "gap:var(--s-2)" }, [btn("Explain in plain words", async () => {
    try {
      const t = await modelText(C.ai_explain_messages(f), "Explain this finding", out);
      if (t === null) { out.textContent = ""; return; }
      out.textContent = cleanName(t, 1500);
      out.className = "why";
    } catch (e) { out.textContent = e.message; }
  }, { icon: "help", cls: "sm" }), out, el("p", { cls: "muted small", text: "Written by a model from this finding only. The evidence and the law above are what count." })]);
}
function aiTailorButton(L) {
  if (!aiAvailable() || !S.ui.draft || S.ui.draft.L !== L) return null;
  const out = el("div", { cls: "stack", "aria-live": "polite" });
  return el("div", { cls: "stack", style: "gap:var(--s-2)" }, [btn("Reword in plainer language", async () => {
    clear(out);
    const status = el("p", { cls: "muted" });
    out.append(status);
    try {
      const msgs = C.ai_tailor_messages(L);
      const originals = JSON.parse(msgs[1].content.split("DATA:\n")[1]);
      const t = await modelText(msgs, "Reword this letter", status);
      if (t === null) { clear(out); return; }
      const chk = C.check_rewrite(originals, t);
      if (!chk.ok) { status.textContent = "The rewording was refused: " + chk.problems.join("; ") + ". The letter stays as it was."; return; }
      status.textContent = "Every fact, number and date was kept. Use the new wording?";
      out.append(btn("Use it", () => {
        const map = new Map(originals.map((o, i) => [o, chk.lines[i]]));
        const L2 = JSON.parse(JSON.stringify(L));
        for (const b of L2.blocks) if (b.kind === "p" && map.has(b.text) && !b.asserts) b.text = map.get(b.text);
        S.ui.draft = Object.assign({}, S.ui.draft, { L: L2 });
        render();
        toast("Reworded the letter's own sentences; sentences that state facts were kept exactly.");
      }, { cls: "sm primary" }));
    } catch (e) { status.textContent = e.message; }
  }, { icon: "edit", cls: "sm" }), out]);
}

// ---------------------------------------------------------------- the text reader for scanned pages (switch "ocr", off)
// The engine (tesseract compiled to WebAssembly, pinned) runs in a worker on this device. Its
// WebAssembly is embedded in the single-file page; the Pages build fetches it from this same site the
// first time it is used. The language data comes from the network once. Both are checked against
// their pinned SHA-384 before they are kept and again before each use. Recognized words go back to
// the parser as positioned text items, the same as a PDF's own text layer.
const ocr = { worker: null, ready: null, seq: 0, pending: new Map() };
const OCR_KV = "ocr:" + OCR_DATA.lang, OCR_WASM_KV = "ocr:engine:" + OCR_WASM.sri;
async function sha384Sri(bytes) { return "sha384-" + b64(new Uint8Array(await crypto.subtle.digest("SHA-384", bytes))); }
async function keptBytes(key) { const b = await kvGet(key, null); return b ? (b instanceof Uint8Array ? b : new Uint8Array(b)) : null; }
async function downloadPinned(url, size, sri, what, progress) {
  const res = await net("ocr", url);
  if (!res.ok) throw new Error("The download failed (" + res.status + ").");
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length !== size) throw new Error("The " + what + " is not the expected size; nothing was kept.");
  if ((await sha384Sri(buf)) !== sri) throw new Error("The " + what + " does not match its pinned fingerprint; nothing was kept.");
  if (progress) progress(1);
  return buf;
}
async function ocrData(progress) {
  let b = await keptBytes(OCR_KV);
  if (b && (await sha384Sri(b)) !== OCR_DATA.sri) { await kvSet(OCR_KV, null); b = null; }
  if (!b) { progress("Downloading the language data (" + (OCR_DATA.bytes / 1048576).toFixed(1) + " MB), once"); b = await downloadPinned(OCR_DATA.url, OCR_DATA.bytes, OCR_DATA.sri, "language data"); if (DB) await dbPut("kv", OCR_KV, b); }
  return b;
}
async function ocrWasm(progress) {
  const inline = $("vendor-ocr-wasm").textContent.trim();
  let b = inline ? b64ToBytes(inline) : await keptBytes(OCR_WASM_KV);
  if (b && (await sha384Sri(b)) !== OCR_WASM.sri) { if (inline) throw new Error("The embedded text engine does not match its pinned fingerprint."); b = null; }
  if (!b) { progress("Loading the text engine from this site, once"); b = await downloadPinned(OCR_WASM_URL, OCR_WASM.bytes, OCR_WASM.sri, "text engine"); if (DB) await dbPut("kv", OCR_WASM_KV, b); }
  return b;
}
const OCR_HANDLER = `
var api = null, M = null;
async function gunzip(bytes) { var s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")); return new Uint8Array(await new Response(s).arrayBuffer()); }
self.onmessage = async function (e) {
  var m = e.data;
  try {
    if (m.op === "init") {
      M = await TesseractCore({ wasmBinary: m.wasm, print: function () {}, printErr: function () {} });
      M.FS.writeFile("/" + m.lang + ".traineddata", await gunzip(m.data));
      api = new M.TessBaseAPI();
      if (api.Init("/", m.lang, 1) !== 0) throw new Error("the language data did not load");
      api.SetVariable("tessedit_pageseg_mode", "6");
      api.SetVariable("user_defined_dpi", "300");
      self.postMessage({ id: m.id, ok: true });
    } else if (m.op === "page") {
      M.FS.writeFile("/input", m.pgm);
      if (api.SetImageFile(1, 0) === 1) throw new Error("the page image could not be read");
      api.Recognize(null);
      self.postMessage({ id: m.id, ok: true, tsv: api.GetTSVText(0) });
    }
  } catch (err) { self.postMessage({ id: m.id, ok: false, error: String(err && err.message || err) }); }
};`;
function ocrCall(msg, transfer) {
  return new Promise((resolve, reject) => { const id = ++ocr.seq; ocr.pending.set(id, { resolve, reject }); ocr.worker.postMessage(Object.assign({ id }, msg), transfer || []); });
}
async function ocrEngine(progress) {
  if (ocr.ready) return ocr.ready;
  ocr.ready = (async () => {
    if (!switchOn("ocr")) throw new Error("The text reader is off. Turn it on in Settings.");
    const data = await ocrData(progress);
    const wasm = await ocrWasm(progress);
    const url = URL.createObjectURL(new Blob([$("vendor-ocr-core").textContent + "\n" + OCR_HANDLER], { type: "text/javascript" }));
    ocr.worker = new Worker(url);
    ocr.worker.onmessage = (e) => { const p = ocr.pending.get(e.data.id); if (!p) return; ocr.pending.delete(e.data.id); if (e.data.ok) p.resolve(e.data); else p.reject(new Error(e.data.error)); };
    ocr.worker.onerror = (ev) => { if (ev && ev.preventDefault) ev.preventDefault(); for (const p of ocr.pending.values()) p.reject(new Error("The text engine stopped.")); ocr.pending.clear(); ocr.ready = null; };
    progress("Starting the text engine");
    await ocrCall({ op: "init", wasm, data: data.slice(), lang: OCR_DATA.lang }, [wasm.buffer]);
    return true;
  })();
  ocr.ready.catch(() => { ocr.ready = null; });
  return ocr.ready;
}
// A page as a cleaned black-and-white image (gray, then Otsu's threshold) in PGM, which the engine reads.
function pgmOf(img, w, h) {
  const gray = new Uint8Array(w * h), hist = new Array(256).fill(0);
  for (let i = 0, j = 0; j < gray.length; i += 4, j++) { const g = (img[i] * 299 + img[i + 1] * 587 + img[i + 2] * 114) / 1000 | 0; gray[j] = g; hist[g]++; }
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, best = 0, thr = 128;
  for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = gray.length - wB; if (!wF) break; sumB += t * hist[t]; const mB = sumB / wB, mF = (sum - sumB) / wF, v = wB * wF * (mB - mF) * (mB - mF); if (v > best) { best = v; thr = t; } }
  const head = enc.encode("P5\n" + w + " " + h + "\n255\n");
  const out = new Uint8Array(head.length + gray.length);
  out.set(head);
  for (let j = 0; j < gray.length; j++) out[head.length + j] = gray[j] > thr ? 255 : 0;
  return out;
}
function tsvItems(tsv, p, scale) {
  const out = [];
  for (const line of String(tsv || "").split("\n")) {
    const c = line.split("\t");
    if (c.length < 12 || c[0] !== "5") continue;
    const s = c.slice(11).join(" ").trim(), confv = Number(c[10]);
    if (!s || confv < 30) continue;
    const left = Number(c[6]) / scale, top = Number(c[7]) / scale, w = Number(c[8]) / scale, h = Number(c[9]) / scale;
    out.push({ p, x: Math.round(left * 100) / 100, y: Math.round((top + h) * 100) / 100, w: Math.round(w * 100) / 100, h: Math.round(h * 100) / 100, s });
  }
  return out;
}
async function ocrPdf(pdf, progress) {
  await ocrEngine(progress);
  let items = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    progress("Reading scanned page " + p + " of " + pdf.numPages + " on this device");
    const page = await pdf.getPage(p);
    const vp1 = page.getViewport({ scale: 1 });
    const scale = Math.min(300 / 72, Math.sqrt(16e6 / (vp1.width * vp1.height)));
    const vp = page.getViewport({ scale });
    const cv = document.createElement("canvas");
    cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
    const ctx = cv.getContext("2d");
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const img = ctx.getImageData(0, 0, cv.width, cv.height);
    const pgm = pgmOf(img.data, cv.width, cv.height);
    cv.width = cv.height = 1;
    const res = await ocrCall({ op: "page", pgm }, [pgm.buffer]);
    items = items.concat(tsvItems(res.tsv, p - 1, scale));
  }
  return items;
}

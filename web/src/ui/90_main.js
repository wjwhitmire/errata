// ---------------------------------------------------------------- start
async function main() {
  await storageInit();
  S.mode = "device";
  setTheme(S.settings.theme);
  await loadIndex();
  window.addEventListener("hashchange", (e) => {
    // a fresh visit to the wizard starts at step 1
    if (/#\/letters\/new/.test(location.hash) && !/#\/letters\/new/.test(String(e.oldURL || ""))) S.ui.wiz = null;
    S.ui.focusContent = true; render(); window.scrollTo(0, 0);
  });
  $("dlg").addEventListener("cancel", () => { if (dialogDone) dialogDone(); });
  startClock();
  if (S.people.length) {
    const last = await kvGet("last", null);
    const p = S.people.find((x) => x.id === last) || S.people.find((x) => x.relationship === "You") || S.people[0];
    S.cur = p.id;
    if (!p.encrypted) { const r = await unlockPerson(p.id, ""); S.data = r.data; S.ver++; }
    else showLock(p.id);
  }
  render();
  window.ERRATA_READY = true;
  checkForUpdate(false).then((u) => { if (u) { S.ui.update = u; toast("Version " + u.tag + " is available; see Settings."); } }).catch(() => {});
}
main().catch((e) => {
  const c = $("content");
  if (c) { clear(c).append(note("bad", "alert", [el("b", { text: C.PRODUCT_NAME + " could not start." }), el("p", { text: cleanName(e && e.message, 300) })])); }
});

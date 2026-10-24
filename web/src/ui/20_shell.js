// ---------------------------------------------------------------- the shell: nav, top bar, tabs, router, lock
const NAV = [["dashboard", "Dashboard", "dashboard"], ["playbook", "Playbook", "playbook"], ["reports", "Reports", "reports"], ["findings", "Findings", "findings"],
  ["letters", "Letters", "letters"], ["tracker", "Tracker", "tracker"], ["negotiate", "Negotiate", "scale"], ["score", "Score plan", "score"], ["vault", "Vault", "vault"], ["settings", "Settings", "settings"]];
const TABS = [["dashboard", "Home", "home"], ["findings", "Findings", "findings"], ["letters", "Letters", "letters"], ["tracker", "Tracker", "tracker"]];
const VIEWS = {};
function route() {
  const h = decodeURIComponent((location.hash || "").replace(/^#\/?/, ""));
  const [path, qs] = h.split("?");
  const parts = path.split("/").filter(Boolean);
  const q = {};
  for (const kv of (qs || "").split("&").filter(Boolean)) { const [k, v] = kv.split("="); q[k] = v === undefined ? "" : decodeURIComponent(v); }
  return { name: parts[0] || "dashboard", parts, q };
}
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
function navCounts(d) {
  if (!d) return {};
  const open = d.mail.filter((m) => !m.outcome && m.mailed).length;
  return { playbook: d.round ? "Day " + Math.max(0, d.day) : "", reports: d.round ? String(d.round.reports.length) : "", findings: String(d.groups.filter((g) => g.current).length || ""),
    letters: String((S.data.mail || []).length || ""), tracker: open ? open + " open" : "", vault: String((S.data.vault || []).length || ""),
    negotiate: String((S.data.offers || []).filter((o) => !o.paid && o.response !== "refused").length || "") };
}
function renderNav(active, d) {
  const nav = clear($("nav"));
  const cnt = navCounts(d);
  const p = S.data;
  nav.append(el("div", { cls: "brand" }, [markSvg(false), el("div", null, [el("span", { cls: "wm", text: C.PRODUCT_NAME }), el("span", { cls: "no", text: "Field Tools No. 19" })])]));
  if (p) nav.append(el("button", { cls: "who", type: "button", id: "who", "aria-haspopup": "menu", "aria-label": "Working on " + p.name + ". Switch person", on: { click: (e) => personMenu(e.currentTarget) } },
    [el("span", { cls: "av", text: p.initials }), el("span", null, [el("span", { cls: "nm", text: p.name }), el("span", { cls: "rl", text: p.relationship + (S.people.length > 1 ? ", family mode" : "") })]), icon("switch", "ico sm")]));
  const ul = el("ul", { cls: "navlist" });
  for (const [k, t, i] of NAV) {
    if (k === "vault") ul.append(el("li", { cls: "sep", role: "separator" }));
    ul.append(el("li", null, [el("a", { href: "#/" + k, "aria-current": k === active ? "page" : null }, [icon(i), el("span", { text: t }), cnt[k] ? el("span", { cls: "cnt", text: cnt[k] }) : null])]));
  }
  nav.append(ul);
  const encOn = S.people.some((x) => x.id === S.cur && x.encrypted);
  nav.append(el("div", { cls: "navfoot" }, [el("div", { cls: "lk" }, [icon(encOn ? "lock" : "unlock", "ico sm"), el("span", { text: S.mode === "example" ? "Example, in memory only" : encOn ? "Encrypted on this device" : "Not encrypted" })]),
    el("p", { text: "No account. No uploads. Free for good." })]));
  const tb = clear($("tabbar"));
  const tabAct = TABS.some((t) => t[0] === active) ? active : "more";
  for (const [k, t, i] of TABS) tb.append(el("a", { href: "#/" + k, "aria-current": k === tabAct ? "page" : null }, [icon(i), el("span", { text: t })]));
  tb.append(el("a", { href: "#more", id: "tab-more", "aria-current": tabAct === "more" ? "page" : null, on: { click: (e) => { e.preventDefault(); moreSheet(); } } }, [icon("more"), el("span", { text: "More" })]));
}
function moreSheet() {
  const old = document.querySelector(".more");
  if (old) { old.remove(); return; }
  const close = () => sheet.remove();
  const sheet = el("nav", { cls: "more", "aria-label": "More" }, [["playbook", "Playbook", "playbook"], ["reports", "Reports", "reports"], ["score", "Score plan", "score"], ["vault", "Vault", "vault"], ["settings", "Settings", "settings"], ["family", "Switch person", "family"]]
    .map(([k, t, i]) => el("a", { href: "#/" + k, on: { click: close } }, [icon(i), el("span", { text: t })])));
  document.body.append(sheet);
  setTimeout(() => document.addEventListener("click", function off(e) { if (!sheet.contains(e.target) && e.target.id !== "tab-more") { close(); document.removeEventListener("click", off); } }), 0);
}
function lockLeft() { return Math.max(0, S.lockAt - Date.now()); }
function lockText() { const s = Math.ceil(lockLeft() / 1000); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
function renderTop(title, crumb) {
  const top = clear($("top"));
  const rec = S.people.find((x) => x.id === S.cur);
  const encOn = !!(rec && rec.encrypted);
  const priv = el("div", { cls: "priv" });
  if (S.mode === "example") priv.append(el("span", { cls: "chip ex", text: "Example data" }));
  if (S.mode === "example") priv.append(el("span", { cls: "enc", title: "The example is locked with the passphrase \"example\". It lives only in memory. Nothing is saved on this device." }, [icon("shield", "ico sm"), el("span", { text: "Encrypted, in memory only" })]));
  else if (encOn) priv.append(el("span", { cls: "enc", title: "Stored data is encrypted with this person's passphrase" }, [icon("shield", "ico sm"), el("span", { text: "Encrypted at rest" })]));
  else if (S.data) priv.append(el("span", { cls: "enc", style: "color:var(--warn)", title: "Encryption is off for this person. Turn it on in Settings." }, [icon("alert", "ico sm"), el("span", { text: "Not encrypted" })]));
  if (S.data && encOn) priv.append(el("button", { cls: "lockbtn", type: "button", id: "lockbtn", "aria-label": "Lock now. Auto-lock in " + lockText(), on: { click: () => lockNow() } },
    [icon("unlock", "ico sm"), el("span", { text: "Lock" }), el("span", { cls: "t", id: "locktime", text: lockText() })]));
  top.append(el("h1", null, [el("span", { cls: "crumb", text: crumb || "" }), title]), priv);
}
let rendering = false;
function render() {
  // a focused field inside the view commits its change first (its handler may render), then the view is rebuilt once
  const ae = document.activeElement, cont = $("content");
  if (!rendering && ae && cont && cont.contains(ae) && ae.blur) { rendering = true; try { ae.blur(); } finally { rendering = false; } }
  const r = route();
  S.route = r;
  const more = document.querySelector(".more");
  if (more) more.remove();
  const content = $("content");
  if (!S.data) {
    $("app").dataset.screen = "welcome";
    renderNav("", null);
    renderTop(S.people.length ? "Locked" : "Welcome", C.PRODUCT_NAME);
    clear(content).append(...welcomeView());
    return;
  }
  const d = derive();
  const view = VIEWS[r.name] || VIEWS.dashboard;
  const name = VIEWS[r.name] ? r.name : "dashboard";
  const navName = name === "family" ? "dashboard" : name;
  $("app").dataset.screen = name;
  renderNav(navName, d);
  let v;
  try { v = view(d, r); } catch (e) { v = { title: "Something went wrong", crumb: "", body: [note("bad", "alert", [el("b", { text: "This view could not be shown." }), el("p", { text: cleanName(e && e.message, 300) })])] }; if (typeof console !== "undefined") console.error(e); }
  renderTop(v.title, v.crumb);
  clear(content).append(...v.body.filter(Boolean));
  if (S.ui.focusContent) { content.focus(); S.ui.focusContent = false; }
}
function crumbOf(rest) { return S.data.name + (rest ? " / " + rest : ""); }

// ---- lock, unlock and switching people
function touch() { const m = Number(S.settings.lockMinutes) || 5; S.lockAt = Date.now() + m * 60000; }
// Locking drops every reference to the decrypted record this page holds: the record, its key, the
// derived views, drafts and wizard state, the undo copy a toast keeps, and the screen's own markup.
function forgetOpenRecord() {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  S.data = null; S.key = null; D = null; S.undo = null;
  S.ui = {};
  const t = $("toasts");
  if (t) clear(t);
  const c = document.getElementById("content");
  if (c) clear(c);
}
async function lockNow() {
  if (!S.data) return;
  await saveNow();
  const id = S.cur;
  forgetOpenRecord();
  S.cur = id;
  closeDialog();
  showLock(id);
  render();
}
function showLock(id) {
  const box = $("lock");
  const p = S.people.find((x) => x.id === id) || S.people[0];
  if (!p) { box.hidden = true; return; }
  const pass = input({ type: "password", id: "unlock-pass", autocomplete: "current-password" });
  const msg = el("p", { cls: "muted small", id: "unlock-msg", "aria-live": "polite" });
  const doUnlock = async () => {
    msg.textContent = "Opening...";
    try {
      const r = await unlockPerson(p.id, pass.value);
      S.cur = p.id; S.data = r.data; S.key = r.key; S.ver++; D = null;
      box.hidden = true; clear(box);
      if (S.mode === "device") kvSet("last", p.id);
      touch();
      render();
    } catch (e) { msg.textContent = e.message; pass.select(); }
  };
  pass.addEventListener("keydown", (e) => { if (e.key === "Enter") doUnlock(); });
  const others = S.people.filter((x) => x.id !== p.id);
  clear(box).append(el("div", { cls: "lockcard", role: "dialog", "aria-modal": "true", "aria-labelledby": "lock-name" }, [
    el("div", { cls: "mk" }, [el("span", { cls: "tile" }, [markSvg(true)]), el("div", null, [el("span", { cls: "eyebrow", text: "Locked" }), el("h3", { id: "lock-name", text: p.name })])]),
    el("p", { text: p.name + "'s reports and letters are encrypted with " + (p.relationship === "You" ? "your" : p.name.split(" ")[0] + "'s") + " passphrase. Switching people locks the one you leave." }),
    field("Passphrase", pass, S.mode === "example" ? "The example's passphrase is: example" : null),
    btn("Unlock", doUnlock, { cls: "primary", icon: "unlock", id: "unlock-go" }), msg,
    others.length ? el("div", { cls: "row" }, others.map((o) => btn("Switch to " + o.name, () => showLock(o.id), { cls: "sm" }))) : null,
    S.mode === "example" ? btn("Leave the example", async () => { await leaveExample(); box.hidden = true; render(); }, { cls: "quiet" }) : null,
    el("p", { cls: "muted small" }, [icon("shield", "ico sm"), " " + (S.mode === "example" ? "Encrypted in memory only; nothing is saved on this device." : "Encrypted at rest on this device. Locks after " + S.settings.lockMinutes + " minutes idle.")]),
  ]));
  box.hidden = false;
  setTimeout(() => pass.focus(), 0);
}
async function switchTo(id) {
  if (id === S.cur && S.data) return;
  await saveNow();
  const p = S.people.find((x) => x.id === id);
  if (!p) return;
  forgetOpenRecord(); S.cur = id;
  if (!p.encrypted) { const r = await unlockPerson(id, ""); S.data = r.data; S.ver++; touch(); go("#/dashboard"); return; }
  showLock(id);
  render();
}
function personMenu(anchor) {
  const old = document.querySelector(".who-menu");
  if (old) { old.remove(); return; }
  const m = peopleMenu(true);
  m.classList.add("who-menu");
  const r = anchor.getBoundingClientRect();
  if (window.innerWidth > 640) { m.style.left = Math.round(r.left) + "px"; m.style.top = Math.round(r.bottom + 6) + "px"; }
  document.body.append(m);
  const first = m.querySelector("button");
  if (first) first.focus();
  setTimeout(() => document.addEventListener("click", function off(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener("click", off); } }), 0);
  m.addEventListener("keydown", (e) => { if (e.key === "Escape") { m.remove(); anchor.focus(); } });
}
function peopleMenu(popup) {
  const items = S.people.map((p) => el("button", { type: "button", role: "menuitemradio", "aria-checked": p.id === S.cur ? "true" : "false", on: { click: () => { const w = document.querySelector(".who-menu"); if (w) w.remove(); switchTo(p.id); } } },
    [el("span", { cls: "av", text: p.initials }), el("b", { text: p.name }), icon(p.id === S.cur && S.data ? "unlock" : p.encrypted ? "lock" : "unlock", "ico sm"),
      el("span", { cls: "rl", text: p.relationship + ". " + (p.id === S.cur && S.data ? "Unlocked" : p.encrypted ? "Locked" : "Not encrypted") + (p.relationship !== "You" && p.encrypted ? ", own passphrase" : "") })]));
  return el("div", { cls: "menu", role: "menu", "aria-label": "Switch person" }, [el("div", { cls: "mh", text: "Working on" })].concat(items, [el("hr"),
    el("button", { type: "button", role: "menuitem", on: { click: () => { const w = document.querySelector(".who-menu"); if (w) w.remove(); addPersonDialog(); } } },
      [el("span", { cls: "av" }, [icon("plus", "ico sm")]), el("b", { text: "Add a person" }), el("span"), el("span", { cls: "rl", text: "Someone you help for free" })]),
    popup ? el("button", { type: "button", role: "menuitem", on: { click: () => { const w = document.querySelector(".who-menu"); if (w) w.remove(); go("#/family"); } } },
      [el("span", { cls: "av" }, [icon("family", "ico sm")]), el("b", { text: "Family view" }), el("span"), el("span", { cls: "rl", text: "Who is on this device" })]) : null]));
}
function addPersonDialog(first) {
  const name = input({ id: "np-name", maxlength: 60, autocomplete: "name" });
  const rel = select([["You", "You"], ["Partner", "Partner"], ["Parent", "Parent"], ["Child", "Child"], ["Sibling", "Sibling"], ["Family", "Other family"], ["Friend", "Friend"]], first ? "You" : "Family", { id: "np-rel" });
  const p1 = input({ type: "password", id: "np-pass", autocomplete: "new-password" });
  const p2 = input({ type: "password", id: "np-pass2", autocomplete: "new-password" });
  const encBox = el("input", { type: "checkbox", id: "np-enc", checked: true });
  const msg = el("p", { cls: "muted small", "aria-live": "polite" });
  openDialog({ title: first ? "Start with your own reports" : "Add a person", icon: "person", body: [
    field("Name", name), field("Who they are", rel),
    el("label", { cls: "check on", for: "np-enc" }, [encBox, el("span", null, [el("b", { text: "Encrypt stored data (recommended)" }), el("br"), el("span", { cls: "muted small", text: "Everything for this person is stored encrypted with this passphrase. Without it nobody can open the data, including you." })])]),
    field("Passphrase", p1, "At least 8 characters. There is no recovery: write it down somewhere safe."), field("Passphrase again", p2), msg,
    el("p", { cls: "muted small", text: "Helping people you know is free. Each person has their own vault, letters and passphrase, and letters go out in their name, never yours." })],
  actions: [{ label: "Cancel" }, { label: first ? "Start" : "Add", primary: true, id: "np-go", keep: true, onClick: () => {
    const n = cleanName(name.value, 60);
    if (!n) { msg.textContent = "Add a name."; return false; }
    if (encBox.checked && p1.value.length < 8) { msg.textContent = "Use a passphrase of at least 8 characters."; return false; }
    if (encBox.checked && p1.value !== p2.value) { msg.textContent = "The two passphrases differ."; return false; }
    msg.textContent = "Setting up...";
    (async () => {
      if (noCryptoText()) throw new Error(noCryptoText());
      if (S.mode === "example") await leaveExample();
      if (S.mode !== "device") S.mode = "device";
      await saveNow();
      const r = await createPerson(n, rel.value, encBox.checked ? p1.value : "");
      S.cur = r.id; S.data = r.data; S.key = r.key; S.ver++; D = null;
      await kvSet("last", r.id);
      closeDialog(); touch(); go("#/reports");
    })().catch((e) => { msg.textContent = e.message; });
    return false;
  } }] });
}
// Encryption needs a secure page (https, or a file or localhost on this computer). Say so plainly
// instead of failing silently.
function noCryptoText() {
  return typeof crypto !== "undefined" && crypto.subtle ? "" : "This copy is opened from a plain http address, where the browser turns off the encryption " + C.PRODUCT_NAME + " needs. Open it from an https address, or save the page and open the file.";
}
function welcomeView() {
  const nc = noCryptoText();
  if (nc) return [note("bad", "alert", [el("b", { text: "This page can't keep your data safe here." }), el("p", { text: nc })]), footer()];
  const startEx = async () => {
    const b = $("try-example");
    if (b) { b.disabled = true; b.textContent = "Opening the example..."; }
    try { await openExample(); } catch (e) {
      if (b) { b.disabled = false; b.textContent = "Try the example"; }
      openDialog({ title: "The example could not open", icon: "alert", body: [el("p", { text: noCryptoText() || cleanName(e && e.message, 200) })] });
      S.mode = "device";
      return;
    }
    touch();
    go("#/dashboard");
  };
  if (S.people.length && S.mode === "device") return [keyAnswer("Your data", "Locked", "Unlock to continue. Your records are encrypted on this device."), btn("Unlock", () => showLock(S.cur || S.people[0].id), { cls: "primary", icon: "unlock" })];
  return [el("div", { cls: "cols" }, [keyAnswer("Your data", "Stays on this device", C.PRODUCT_NAME + " reads your credit reports, finds what is wrong, writes the letters and tracks the legal deadlines, all in this browser. There is no account, no upload and no fee.", [
      btn("Start with your own reports", () => addPersonDialog(true), { cls: "primary", icon: "plus", id: "start-own" }), btn("Try the example", startEx, { icon: "eye", id: "try-example" }), btn("Restore a backup", restoreBackup, { icon: "upload", id: "restore-welcome" })], true),
    card("How it works", "help", [rowsList([
      el("li", null, [icon("upload", "ico sm"), el("span", { text: "Import the free reports from AnnualCreditReport.com (PDF or saved web page), or type the accounts in." }), el("span")]),
      el("li", null, [icon("findings", "ico sm"), el("span", { text: C.PRODUCT_NAME + " finds what the reports get wrong and shows the evidence and the law for each item." }), el("span")]),
      el("li", null, [icon("letters", "ico sm"), el("span", { text: "Each letter says only what a finding or a fact you confirmed supports." }), el("span")]),
      el("li", null, [icon("hourglass", "ico sm"), el("span", { text: "Type the date they received it; the deadlines and the next letter follow from it." }), el("span")])]),
      el("p", { cls: "muted small", text: "This is information, not legal advice. True items can't be removed by a dispute, and " + C.PRODUCT_NAME + " won't try." })])]),
    footer()];
}
// Auto-lock: any activity pushes the deadline out; the countdown shows in the top bar.
function startClock() {
  for (const ev of ["pointerdown", "keydown", "wheel", "touchstart"]) document.addEventListener(ev, () => { if (S.data) touch(); }, { passive: true });
  setInterval(() => {
    if (!S.data) return;
    const rec = S.people.find((x) => x.id === S.cur);
    if (!rec || !rec.encrypted) return;
    if (lockLeft() <= 0) { lockNow(); return; }
    const t = $("locktime");
    if (t) t.textContent = lockText();
  }, 1000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") saveNow().catch(() => {}); });
}

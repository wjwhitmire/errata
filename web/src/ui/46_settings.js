// Restore a backup file; used from Settings and from the welcome screen.
async function restoreBackup() {
  const ex = S.mode === "example";
    const fl = await pickFile(".json,application/json");
    if (!fl.length) return;
    try {
      if (fl[0].size > 500 * 1024 * 1024) throw new Error("This file is larger than 500 MB, more than a backup of this tool can be.");
      let j;
      try { j = JSON.parse(dec.decode(await readFile(fl[0]))); } catch (e) { throw new Error("This file is not an " + C.PRODUCT_NAME + " backup: it could not be read."); }
      if (!j || j.format !== "errata-backup" || !Array.isArray(j.people) || j.people.length > 50) throw new Error("This is not an " + C.PRODUCT_NAME + " backup.");
      const recs = j.people.map(restoredRecord);
      if (recs.some((r) => !r)) throw new Error("This backup has a record this tool did not write, so nothing was restored.");
      if (ex) await leaveExample();
      for (const r of recs) await recPut(r);
      await loadIndex();
      toast("Restored " + plural(recs.length, "person", "people") + ". Unlock to open.");
      render();
    } catch (e) { toast(e.message); }
}
// ---------------------------------------------------------------- settings, your details, family view
function setTheme(t) { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
function profileCard(d) {
  const p = d.P.profile;
  const f = {
    name: input({ id: "pf-name", value: p.name || "", autocomplete: "name" }),
    mailing: el("textarea", { cls: "input", id: "pf-mailing", rows: 3, style: "min-height:88px", placeholder: "100 Main Street, Apt 2\nAnytown, TX 75000" }, [(p.mailing || []).join("\n")]),
    dob: input({ id: "pf-dob", type: "date", value: p.dob || "" }),
    ssn: input({ id: "pf-ssn", value: p.ssn_last4 || "", mono: true, maxlength: 4, inputmode: "numeric", placeholder: "Last four only" }),
    state: select([["", "Choose"]].concat(Object.keys(C.TABLES.sol).sort().map((k) => [k, C.TABLES.sol[k].name])), p.state || "", { id: "pf-state" }),
    names: el("textarea", { cls: "input", id: "pf-names", rows: 3, style: "min-height:88px", placeholder: "Every version of your name you use" }, [(p.names || []).join("\n")]),
    addresses: el("textarea", { cls: "input", id: "pf-addresses", rows: 3, style: "min-height:88px", placeholder: "Addresses you lived at, one per line" }, [(p.addresses || []).join("\n")]),
    phones: el("textarea", { cls: "input", id: "pf-phones", rows: 2, style: "min-height:64px" }, [(p.phones || []).join("\n")]),
    employers: el("textarea", { cls: "input", id: "pf-employers", rows: 2, style: "min-height:64px" }, [(p.employers || []).join("\n")]),
  };
  const lines = (t) => t.value.split("\n").map((x) => cleanName(x, 120)).filter(Boolean);
  return card("Your details", "person", [el("p", { cls: "muted small", text: "Letters use these. A bureau letter carries your date of birth and the last four of your SSN so the bureau can find your file; a letter to a lender or collector never does. Never type a full SSN here." }),
    el("div", { cls: "grid2" }, [field("Name for letters", f.name), field("Date of birth", f.dob), field("Mailing address", f.mailing), field("SSN, last four digits", f.ssn), field("State you live in", f.state)]),
    el("div", { cls: "grid2" }, [field("Names you use", f.names, "Used to spot name variants that are not yours."), field("Addresses you lived at", f.addresses), field("Your phone numbers", f.phones), field("Employers", f.employers)]),
    btn("Save your details", () => {
      if (f.ssn.value && !/^\d{4}$/.test(f.ssn.value)) { toast("Enter only the last four digits of your SSN."); return; }
      change("Details saved", (P) => { Object.assign(P.profile, { name: cleanName(f.name.value, 80), mailing: lines(f.mailing), dob: f.dob.value, ssn_last4: f.ssn.value, state: f.state.value,
        names: lines(f.names).map((x) => x.toUpperCase()), addresses: lines(f.addresses).map((x) => x.toUpperCase()), phones: lines(f.phones), employers: lines(f.employers).map((x) => x.toUpperCase()) }); });
    }, { cls: "primary", id: "pf-save" })]);
}
function passDialog(title, onPass, confirmTwice) {
  const p1 = input({ type: "password", id: "pp1", autocomplete: "new-password" }), p2 = input({ type: "password", id: "pp2", autocomplete: "new-password" });
  const msg = el("p", { cls: "muted small", "aria-live": "polite" });
  openDialog({ title, icon: "key", body: [field("New passphrase", p1, "At least 8 characters. There is no recovery."), confirmTwice ? field("Again", p2) : null, msg],
    actions: [{ label: "Cancel" }, { label: "Save", primary: true, keep: true, onClick: () => {
      if (p1.value.length < 8) { msg.textContent = "Use at least 8 characters."; return false; }
      if (confirmTwice && p1.value !== p2.value) { msg.textContent = "The two passphrases differ."; return false; }
      msg.textContent = "Encrypting...";
      onPass(p1.value).then(() => { closeDialog(); render(); }).catch((e) => { msg.textContent = e.message; });
      return false;
    } }] });
}
VIEWS.settings = (d) => {
  const rec = S.people.find((x) => x.id === S.cur) || {};
  const ex = S.mode === "example";
  const on = NET_SWITCHES.filter((s) => switchOn(s.id));
  const k = keyAnswer("Network requests", String(NET_SENT), on.length ? plural(on.length, "network feature is", "network features are") + " on: " + on.map((s) => s.title.toLowerCase()).join(", ") + ". Each sends only what its switch describes." : "All " + NET_SWITCHES.length + " network features are off. " + (NET_SENT ? "This session sent " + plural(NET_SENT, "request") + " while a switch was on." : "This session has sent nothing anywhere."));
  const setNet = (id, v) => { S.settings.net = Object.assign({}, S.settings.net, { [id]: v }); saveSettings(); render(); toast(v ? "Turned on. It sends nothing until you use it." : "Turned off."); };
  const extra = (id) => {
    if (!switchOn(id)) return null;
    if (id === "ai-cloud") {
      const base = input({ id: "ai-base", value: S.settings.aiBase || "", mono: true, placeholder: "https://... or http://localhost:11434/v1" });
      const model = input({ id: "ai-model", value: S.settings.aiModel || "", mono: true });
      const key = input({ id: "ai-key", type: "password", autocomplete: "off", placeholder: "Kept in this person's encrypted record" });
      return el("div", { cls: "grid2", style: "grid-column:1/-1" }, [field("Service address", base), field("Model name", model), field("Your key", key), btn("Save", async () => { const e = C.ai_endpoint(base.value); if (!e.ok) { toast(e.why || "That address is not allowed."); return; } S.settings.aiBase = base.value.trim(); S.settings.aiModel = cleanName(model.value, 80); await saveSettings(); if (key.value) secretSet("ai", key.value); toast("Saved in this person's encrypted record."); }, { cls: "sm" })]);
    }
    if (id === "mail") {
      const key = input({ id: "mail-key", type: "password", autocomplete: "off", placeholder: "Your mail service key, kept in your encrypted record" });
      return el("div", { cls: "row", style: "grid-column:1/-1" }, [field("Mail service key", key), btn("Save", () => { secretSet("mail", key.value); toast("Saved in this person's encrypted record."); }, { cls: "sm" })]);
    }
    return null;
  };
  const netCard = card("Network features", "network-off", NET_SWITCHES.flatMap((s) => [switchRow(s.title, s.detail, switchOn(s.id), (v) => setNet(s.id, v), { id: "net-" + s.id }), extra(s.id)]).concat([
    S.ui.update ? note("", "info", [el("p", null, ["Version " + S.ui.update.tag + " is available. ", el("a", { href: S.ui.update.page, target: "_blank", rel: "noopener noreferrer", text: "Open the project page" }), ". Your data stays where it is."])]) : null,
    el("p", { cls: "muted small", text: "Everything else runs on this device. There is no account and no analytics, and nothing checks for updates unless you turn that switch on." })]), "all off by default");
  const lockSeg = el("div", { cls: "seg", role: "group", "aria-label": "Lock after" }, [1, 5, 15].map((m) => el("button", { type: "button", "aria-pressed": Number(S.settings.lockMinutes) === m ? "true" : "false", text: m + " min",
    on: { click: () => { S.settings.lockMinutes = m; saveSettings(); touch(); render(); } } })));
  const sec = card("Lock and passphrase", "lock", [switchRow("Encrypt stored data", ex ? "The example is encrypted in memory and never stored." : "AES-GCM with a key made from the passphrase (PBKDF2 with SHA-256, 600,000 rounds). On by default.", !!rec.encrypted, (v) => {
      if (ex) return;
      if (v) passDialog("Turn on encryption", (pw) => setEncryption(true, pw), true);
      else openDialog({ title: "Store " + d.P.name + "'s data unencrypted?", icon: "alert", body: [note("warn", "alert", [el("p", { text: "Anyone who can use this browser profile could read the reports, letters and files. The top bar will say Not encrypted until you turn it back on." })])],
        actions: [{ label: "Keep it encrypted" }, { label: "Turn it off", danger: true, onClick: () => { setEncryption(false).then(render); } }] });
    }, { id: "enc-switch", disabled: ex }),
    switchRow("Lock after", "of no activity. The app also locks when you close it.", true, () => {}, { id: "lock-dummy" }),
    note("warn", "alert", [el("p", null, [el("b", { text: "There is no passphrase recovery. " }), "Nobody, including the maker of this tool, can open your data without it. Write it down somewhere safe."])]),
    el("div", { cls: "row" }, [btn("Change passphrase", () => passDialog("Change passphrase", (pw) => setEncryption(true, pw), true), { icon: "key", disabled: ex || !rec.encrypted }), btn("Lock now", lockNow, { icon: "lock", disabled: !rec.encrypted })])]);
  // the lock-after row holds the segmented control rather than a switch
  const rows = sec.querySelectorAll(".switchrow");
  if (rows[1]) { const sw2 = rows[1].querySelector(".switch"); if (sw2) sw2.replaceWith(lockSeg); }
  const theme = el("div", { cls: "seg", role: "group", "aria-label": "Theme" }, [["", "Auto"], ["light", "Light"], ["dark", "Dark"]].map(([v, t]) => el("button", { type: "button", "aria-pressed": (S.settings.theme || "") === v ? "true" : "false", text: t,
    on: { click: () => { S.settings.theme = v; setTheme(v); saveSettings(); render(); } } })));
  const help = card("Free help", "help", [el("p", { text: C.PRODUCT_NAME + " is information, not legal advice. These are free:" }), rowsList(C.TABLES.help_links.map((h) => el("li", null, [icon("link", "ico sm"), el("a", { href: h.url, target: "_blank", rel: "noopener noreferrer", text: h.title }), el("span")]))),
    el("p", { cls: "muted small", text: C.PRODUCT_NAME + " is free and stays free: no paid tier, no partner offers, no affiliate links, no data sold or shared." }),
    el("div", { style: "border-top:1px solid var(--hair);padding-top:12px" }, [footer()])]);
  const exportBtn = btn("Export encrypted backup", async () => {
    const out = [];
    if (ex) { toast("The example is not saved, so there is nothing to back up."); return; }
    await saveNow();
    for (const p of S.people) out.push(backupRecord(await recGet(p.id)));
    const plain = S.people.filter((p) => !p.encrypted);
    const save = () => download("errata-backup.json", JSON.stringify({ format: "errata-backup", version: 1, people: out }), "application/json");
    if (!plain.length) { save(); return; }
    openDialog({ title: "Some records are not encrypted", icon: "alert", body: [note("warn", "alert", [el("p", { text: plural(plain.length, "person is", "people are") + " stored without a passphrase (" + plain.map((p) => p.name).join(", ") +
      "). Their reports and letters are readable in this file by anyone who gets it. Service keys are left out. Turn on encryption for them first if you can." })])],
      actions: [{ label: "Cancel" }, { label: "Export anyway", danger: true, onClick: save }] });
  }, { icon: "export", id: "export" });
  const importBtn = btn("Restore a backup", restoreBackup, { icon: "upload" });
  const conf = input({ id: "del-confirm", mono: true, placeholder: "DELETE", autocomplete: "off" });
  const delBtn = btn("Delete everything", async () => {
    if (conf.value !== "DELETE") { toast("Type DELETE to confirm."); conf.focus(); return; }
    await deleteAllData();
    location.hash = "";
    location.reload();
  }, { cls: "danger", icon: "trash", id: "delete-all" });
  const people = card("People on this device", "family", [rowsList(S.people.map((p) => el("li", null, [el("span", { cls: "mono", text: p.initials }), el("span", { text: p.name + ", " + p.relationship + (p.encrypted ? ", encrypted" : ", not encrypted") }),
    p.id === S.cur ? el("span", { cls: "muted small", text: "Open now" }) : btn("Remove", () => openDialog({ title: "Remove " + p.name + "?", icon: "trash", body: [el("p", { text: "Their reports, letters, mail log and files are deleted from this device. This cannot be undone." })],
      actions: [{ label: "Cancel" }, { label: "Remove", danger: true, onClick: () => { deletePerson(p.id).then(render); } }] }), { cls: "sm quiet" })]))),
    el("p", { cls: "muted small", text: "Names, initials and relationships stay readable on this device so the switcher can show who is who. Everything else is in each person's encrypted record." }),
    btn("Add a person", () => addPersonDialog(false), { icon: "plus" })]);
  const danger = el("div", { cls: "dangerzone" }, [el("h3", { cls: "ch" }, [icon("trash"), "Delete everything"]),
    el("p", { text: "Removes every report, letter, scan and log for all people on this device, the settings and keys, and any downloaded language or model files. It cannot be undone. Export first if you want a copy." }),
    field("Type DELETE to confirm", conf), el("div", { cls: "row" }, [exportBtn, importBtn, delBtn])]);
  return { title: "Settings", crumb: crumbOf("This device"), body: [el("div", { cls: "cols even" }, [el("div", { cls: "stack" }, [k, sec, card("Look", "sun", [el("div", { cls: "row" }, [el("span", { text: "Theme" }), theme])]), people]),
    el("div", { cls: "stack" }, [netCard, help])]), profileCard(d), danger] };
};
VIEWS.family = (d) => {
  const others = S.people.filter((p) => p.id !== S.cur);
  const locked = others.filter((p) => p.encrypted).length;
  const k = keyAnswer("Working on", d.P.name, (d.P.relationship === "You" ? "You. " : d.P.relationship + ". ") + (others.length ? plural(others.length, "other person is", "other people are") + " on this device" + (locked ? ", " + (locked === others.length ? (others.length === 1 ? "locked" : "all locked") : locked + " locked") : "") + "." : "Nobody else is on this device."), null, true);
  const rules = card("Family mode", "family", [rowsList([
    el("li", null, [icon("person", "ico sm"), el("span", { text: "Each person has their own vault, letters and passphrase" }), el("span")]),
    el("li", null, [icon("letters", "ico sm"), el("span", { text: "Letters go out in that person's name and signature, never yours" }), el("span")]),
    el("li", null, [icon("scale", "ico sm"), el("span", { text: "Helping people you know is free. " + C.PRODUCT_NAME + " has no fees, so it never asks for payment for this." }), el("span")])])]);
  const lockedP = others.find((p) => p.encrypted);
  let lockCard = null;
  if (lockedP) {
    const pass = input({ type: "password", id: "fam-pass", autocomplete: "current-password" });
    const msg = el("p", { cls: "muted small", "aria-live": "polite" });
    lockCard = el("div", { cls: "lockscreen" }, [el("div", { cls: "lockcard" }, [el("div", { cls: "mk" }, [el("span", { cls: "tile" }, [markSvg(true)]), el("div", null, [el("span", { cls: "eyebrow", text: "Locked" }), el("h3", { text: lockedP.name })])]),
      el("p", { text: lockedP.name.split(" ")[0] + "'s reports and letters are encrypted with " + lockedP.name.split(" ")[0] + "'s passphrase. Switching people locks the one you leave." }),
      field("Passphrase", pass, S.mode === "example" ? "The example's passphrase is: example" : null),
      btn("Unlock", async () => { msg.textContent = "Opening..."; try { await saveNow(); const r = await unlockPerson(lockedP.id, pass.value); S.cur = lockedP.id; S.data = r.data; S.key = r.key; S.ver++; D = null; touch(); go("#/dashboard"); } catch (e) { msg.textContent = e.message; } }, { cls: "primary", icon: "unlock", id: "fam-unlock" }), msg,
      el("p", { cls: "muted small" }, [icon("shield", "ico sm"), S.mode === "example" ? " Encrypted in memory only." : " Encrypted at rest on this device. Locks after " + S.settings.lockMinutes + " minutes idle."])])]);
  }
  return { title: "Switch person", crumb: "Family mode", body: [el("div", { cls: "cols even" }, [el("div", { cls: "stack" }, [k, peopleMenu(false)]), lockCard || rules]), lockCard ? rules : null] };
};

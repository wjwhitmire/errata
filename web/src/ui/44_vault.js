// ---------------------------------------------------------------- vault: every file, encrypted with the person's record; packets
function vaultBytes(f) { return f.data ? b64ToBytes(f.data) : enc.encode(f.text || ""); }
function vaultTree(d) {
  const P = d.P;
  const by = new Map();
  for (const f of P.vault || []) { const k = f.account || (f.kind === "Your proof" ? "ID and proof" : "General"); if (!by.has(k)) by.set(k, []); by.get(k).push(f); }
  return by;
}
function packetEntries(d, files, attorney) {
  const P = d.P;
  const entries = [];
  const idx = (S.mode === "example" ? ["EXAMPLE DATA. Invented people, lenders and numbers."] : []).concat([P.name + ": " + (attorney ? "attorney packet" : "complaint packet") + ", made " + mdy(d.today) + " on this device.", "", "Files, in date order:"]);
  const sorted = files.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.name.localeCompare(b.name));
  sorted.forEach((f, i) => {
    const name = String(i + 1).padStart(2, "0") + "-" + f.name.replace(/[^A-Za-z0-9._ -]+/g, "_");
    entries.push([name, vaultBytes(f)]);
    idx.push(String(i + 1).padStart(2, "0") + "  " + mdy(f.date) + "  " + f.kind + "  " + f.name);
  });
  idx.push("", "Mailing log:");
  for (const m of d.mail) idx.push(mdy(m.mailed) + "  " + m.to + "  " + letterTitle(m.letter) + "  delivered " + (m.delivered ? mdy(m.delivered) : "not logged") + "  " + (m.outcome || "open"));
  if (attorney) {
    idx.push("", "Findings:");
    for (const g of d.groups) idx.push(g.label + "  " + g.title + "  " + g.subject + "  " + g.bureaus.map(bname).join(", ") + "  " + g.state);
    entries.push(["reports.json", enc.encode(JSON.stringify(P.rounds, null, 1))]);
  }
  entries.unshift(["00-index.txt", enc.encode(idx.join("\n") + "\n")]);
  return entries;
}
VIEWS.vault = (d) => {
  const P = d.P;
  const by = vaultTree(d);
  const keys = Array.from(by.keys());
  const sel = by.has(S.ui.vsel) ? S.ui.vsel : keys.find((k) => k !== "General" && k !== "ID and proof") || keys[0];
  const files = sel ? by.get(sel) : [];
  const tree = el("ul", { cls: "tree" }, [el("li", null, [el("button", { type: "button", on: { click: () => go("#/reports") } }, [icon("reports", "ico sm"), "Reports", el("span", { cls: "c", text: String(P.rounds.reduce((n, r) => n + r.reports.length, 0)) })])])]
    .concat(keys.map((k) => el("li", null, [el("button", { type: "button", "aria-current": k === sel ? "true" : null, on: { click: () => { S.ui.vsel = k; render(); } } }, [icon(k === "ID and proof" ? "person" : k === "General" ? "file" : "card", "ico sm"), k === "ID and proof" ? k : titleCase(k), el("span", { cls: "c", text: String(by.get(k).length) })]),
      k === sel ? el("ul", null, ["Letter", "Receipt", "Reply", "Your proof"].filter((t) => files.some((f) => f.kind === t)).map((t) => el("li", null, [el("button", { type: "button" }, [icon({ Letter: "letters", Receipt: "certified", Reply: "file", "Your proof": "evidence" }[t], "ico sm"), t === "Letter" ? "Letters" : t === "Receipt" ? "Receipts" : t === "Reply" ? "Replies" : t, el("span", { cls: "c", text: String(files.filter((f) => f.kind === t).length) })])]))) : null]))));
  const rows = files.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).map((f) => ({ cells: [num(mdy(f.date)), el("a", { href: "#/vault", on: { click: (e) => { e.preventDefault(); download(f.name, vaultBytes(f), f.type); } } }, [icon("file", "ico sm"), " " + f.name]), f.kind,
    el("span", { cls: "encl" }, [icon(S.people.find((x) => x.id === S.cur && x.encrypted) ? "lock" : "unlock", "ico sm"), S.mode === "example" ? "In memory" : S.people.find((x) => x.id === S.cur && x.encrypted) ? "Encrypted" : "Not encrypted"]),
    btn("Delete", () => change("Deleted " + f.name, (Q) => { Q.vault = Q.vault.filter((x) => x.id !== f.id); }), { cls: "sm quiet", aria: "Delete " + f.name })] }));
  const all = (P.vault || []).filter((f) => !sel || (f.account || (f.kind === "Your proof" ? "ID and proof" : "General")) === sel || f.kind === "Your proof" && !f.account);
  const add = btn("Add a file", async () => {
    const fl = await pickFile("image/*,application/pdf,text/plain", true);
    for (const f of fl) {
      if (f.size > 10 * 1024 * 1024) { toast(f.name + " is larger than 10 MB."); continue; }
      const bytes = await readFile(f);
      change("Added " + cleanName(f.name, 60) + ", encrypted with your record", (Q) => { Q.vault.push({ id: "v-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: cleanName(f.name, 80), kind: "Your proof", account: sel && sel !== "General" && sel !== "ID and proof" ? sel : "", date: today(), type: f.type || "application/octet-stream", data: b64(bytes) }); });
    }
  }, { icon: "plus", id: "vault-add" });
  const k = keyAnswer("Packet ready", plural(all.length, "file"), (sel ? titleCase(sel) + ", filed by date with an index page. " : "") + "Export it for a complaint or for an attorney.",
    [btn("Complaint packet (ZIP)", () => download("complaint-packet.zip", C.zip_stored(packetEntries(d, all, false)), "application/zip"), { cls: "primary", icon: "packet", id: "pk-complaint" }),
      btn("Attorney packet", () => download("attorney-packet.zip", C.zip_stored(packetEntries(d, P.vault || [], true)), "application/zip"), { icon: "packet", id: "pk-attorney" }),
      d.P.goal === "auto_soon" ? btn("Rapid rescore packet", () => download("rapid-rescore-packet.zip", C.zip_stored(packetEntries(d, (P.vault || []).filter((f) => f.kind !== "Letter"), false)), "application/zip"), { icon: "packet" }) : null]);
  return { title: "Vault", crumb: crumbOf("Evidence"), body: [el("div", { cls: "cols", style: "grid-template-columns:minmax(0,300px) minmax(0,1fr)" }, [card("Filed by account", "vault", [tree, add]),
    el("div", { cls: "stack" }, [k, card(sel ? titleCase(sel) : "Files", "card", [table(["Date", "File", "Kind", "Storage", ""], rows, { empty: "No files yet. Letters you log, receipts and replies land here." }),
      el("p", { cls: "muted small", text: S.mode === "example" ? "The example's files live in memory only and disappear when you leave it." : "Files are stored inside this person's record, encrypted with their passphrase when encryption is on. Exports are plain files you choose where to save." })], "newest last")])])] };
};

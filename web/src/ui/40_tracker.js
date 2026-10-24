// ---------------------------------------------------------------- tracker: deadlines, replies, the escalation ladder, round compare
// The escalation ladder in plain words: what to do, and when (the law is shown small beside it).
const PLAIN_LADDER = {
  1: ["Ask the bureau to fix it", "we found an error"],
  2: ["Ask the lender directly", "the bureau kept the item, or did not answer within 30 days (45 if you sent more proof)"],
  3: ["Ask the bureau how it checked", "the bureau says the item is correct"],
  4: ["Dispute again with new proof, and complain to the CFPB", "there is no clear answer 15 days after you asked how it checked, or no answer from the lender after 30 days"],
  5: ["Complain to your state attorney general", "the CFPB complaint closed without a fix"],
  6: ["Talk to a consumer lawyer", "a wrong item is still there and it hurt you, for example a loan was denied"],
};
function icsExport(d) {
  const ev = [];
  for (const m of d.mail) for (const x of m.deadlines) if (!m.outcome) ev.push({ uid: m.id + "-" + x.kind, date: x.due, title: x.label + ": " + m.to, description: "Earliest reading " + mdy(x.earliest) + "; conservative due date " + mdy(x.due) + ". " + C.TABLES.citations[x.cite].cite });
  for (const c of (d.util10 ? d.util10.cards : [])) if (c.pay > 0) ev.push({ uid: "pay-" + c.id + "-" + c.pay_by, date: c.pay_by, title: "Pay " + titleCase(c.name) + " " + money(c.pay), description: "Before the statement closes on " + mdy(c.statement_close) + "." });
  if (!ev.length) { toast("No open deadlines to export."); return; }
  const stamp = d.today.replace(/-/g, "") + "T000000Z";
  download("errata-deadlines.ics", C.ics(ev, stamp, C.PRODUCT_NAME), "text/calendar");
}
function replyDialog(d, entry) {
  const which = select(d.mail.filter((m) => m.mailed && !m.outcome).map((m) => [m.id, m.to + ", " + letterTitle(m.letter)]), entry ? entry.id : "", { id: "rp-which" });
  const text = el("textarea", { cls: "input", id: "rp-text", placeholder: "Paste the text of the results letter, or choose its PDF." });
  const out = el("div", { cls: "stack", id: "rp-out" });
  const date = input({ id: "rp-date", type: "date", value: d.today });
  const read = (t) => {
    const m = d.P.mail.find((x) => x.id === which.value);
    const accts = d.round ? d.round.reports.flatMap((r2) => r2.accounts).filter((a, i, all) => all.findIndex((z) => z.name === a.name) === i) : [];
    const res = C.parse_response(t, accts);
    if (res.date) date.value = res.date;
    clear(out).append(el("p", { cls: "muted small", text: res.items.length ? "Read from the letter. Check each one; nothing is recorded until you save." : "No account names were found in the text. Pick the outcomes by hand below." }));
    const names = (m && m.L ? m.L.blocks.filter((b) => b.kind === "item").map((b) => b.text.replace(/^\d+\.\s*/, "").split(", account")[0]) : []).concat(res.items.map((x) => x.name)).filter((x, i, a) => x && a.indexOf(x) === i);
    for (const n of names.length ? names : accts.slice(0, 6).map((a) => a.name)) {
      const hit = res.items.find((x) => x.name === n);
      const s = select([["", "Not mentioned"], ["deleted", "Deleted (removed)"], ["updated", "Updated (changed)"], ["verified", "Verified (kept as is)"]], hit ? hit.outcome : "", { "data-name": n, cls: "input rp-outcome", "aria-label": "Outcome for " + n });
      out.append(el("div", { cls: "grid2" }, [el("div", null, [el("b", { text: titleCase(n) }), hit ? el("p", { cls: "muted small mono", text: "“" + hit.evidence + "”" }) : null]), s]));
    }
    if (res.frivolous) out.append(note("warn", "alert", [el("p", { text: "The letter calls the dispute frivolous or irrelevant. The bureau must say why and what it needs (FCRA 611(a)(3)); a second dispute should add that information." })]));
    if (res.reinsertion) out.append(note("bad", "reinserted", [el("p", { text: "The letter mentions a reinsertion. That is the written notice; keep it in the Vault." })]));
  };
  text.addEventListener("change", () => read(text.value));
  openDialog({ title: "Add a reply you got", icon: "upload", wide: true, body: [el("p", { cls: "muted small", text: "Choose the PDF or paste the letter's text. " + C.PRODUCT_NAME + " reads which accounts were deleted, changed or kept, and fills in the answers below for you to check." }), field("Which letter it answers", which), field("Text of their letter", text), btn("Choose the PDF", async () => {
    const files = await pickFile("application/pdf,.pdf");
    if (!files.length) return;
    try { if (files[0].size > MAX_PDF_BYTES) throw new Error("This PDF is larger than 80 MB."); const pdf = await openPdf(await readFile(files[0])); const items = await pdfItems(pdf); text.value = C.make_lines(C.clean_items(items)).map((l) => l.cells.map((c) => c.s).join("  ")).join("\n"); read(text.value); } catch (e) { toast(e.message); }
  }, { cls: "sm", icon: "file" }), btn("Read the text", () => read(text.value), { cls: "sm" }), out, field("Date of the results", date)],
  actions: [{ label: "Cancel" }, { label: "Save the results", primary: true, id: "rp-save", onClick: () => {
    const sels = Array.from(out.querySelectorAll("select.rp-outcome"));
    change("Results logged", (P) => {
      const m = P.mail.find((x) => x.id === which.value);
      if (!m) return;
      m.outcome = "results"; m.completed = date.value || d.today; m.result_date = date.value || d.today;
      m.results = sels.filter((s) => s.value).map((s) => { const n = s.getAttribute("data-name"); const a = d.merged.accounts.find((x) => x.name === n); return { key: a ? C.account_key(a) : n, name: n, outcome: s.value }; });
      if (text.value.trim()) P.vault.push({ id: "v-" + Date.now().toString(36), name: m.to + " results.txt", kind: "Reply", account: "", date: m.completed, type: "text/plain", text: text.value.slice(0, 200000) });
    });
  } }] });
  if (entry) setTimeout(() => read(""), 0);
}
VIEWS.tracker = (d, r) => {
  if (r.parts[1] === "rounds") return roundsView(d);
  const open = d.mail.filter((m) => m.mailed && !m.outcome);
  const sel = d.mail.find((m) => m.id === S.ui.tsel) || d.overdue[0] || open[0] || d.mail[d.mail.length - 1];
  const rows = open.map((m) => ({ attrs: { "aria-selected": sel && m.id === sel.id ? "true" : null }, cells: [[el("a", { href: "#/tracker", on: { click: (e) => { e.preventDefault(); S.ui.tsel = m.id; render(); } } }, [el("b", { text: m.to })]), el("br"), el("span", { cls: "muted", text: letterTitle(m.letter) })],
    dbar(m.due, m.delivered, d.today), chip(m.state)] }));
  const gone = d.removed.map((x) => el("li", { cls: "gone" }, [bu(x.bureau), el("span", { cls: "nm", text: titleCase(x.name) + (x.kind !== "account" ? " (" + x.kind + ")" : "") }), el("span", { cls: "stamp" }, [icon("removed"), "Removed"])]));
  const upd = d.groups.filter((g) => g.state === "Updated").length, rein = d.groups.filter((g) => g.state === "Reinserted").length;
  const k = keyAnswer("Items removed", String(d.removed.length), "Of " + d.disputed + " items disputed" + (d.P.start ? " since " + md(d.P.start) : "") + ". " + [upd ? upd + " more corrected" : "", rein ? rein + " came back and " + (rein === 1 ? "is" : "are") + " challenged" : "", open.length ? plural(open.length, "letter is", "letters are") + " still open" : ""].filter(Boolean).join(", ") + ".");
  let ladderCard = null;
  if (sel) {
    const st = sel.step || {};
    const cur = typeof st.step === "number" ? st.step : sel.letter === "mov_611a7" ? 3 : sel.letter.startsWith("furnisher") ? 2 : 1;
    const rungs = C.TABLES.ladder.slice(1).map((x) => el("li", { cls: x.step < cur ? "done" : "", "aria-current": x.step === cur ? "step" : null }, [el("span", { cls: "rt", text: (PLAIN_LADDER[x.step] || [x.action])[0] }),
      el("span", { cls: "rd", text: "When " + ((PLAIN_LADDER[x.step] || [0, x.trigger])[1]) + ". " + x.cite.map((c) => C.TABLES.citations[c].cite.split(", ")[0]).join(", ") })]));
    const ds = sel.deadlines.map((x) => el("li", null, [icon("hourglass", "ico sm"), el("span", { text: x.label }), num(mdy(x.due)), el("span", { cls: "sub", text: (x.earliest !== x.due ? "Earliest reading " + mdy(x.earliest) + " (counting the day they got it as day 1); " + C.PRODUCT_NAME + " uses " + mdy(x.due) + ", the safer date. " : "") + C.TABLES.citations[x.cite].cite })]));
    ladderCard = card(sel.to + ": what happens next", "ladder", [el("p", { text: st.action || "" }), st.note ? el("p", { cls: "muted", text: st.note }) : null, el("ol", { cls: "ladder" }, rungs),
      ds.length ? rowsList(ds) : el("p", { cls: "muted small", text: sel.delivered ? "No legal clock for this letter." : "Add the delivery date to start the clock." }),
      (st.letters || []).length && st.late ? link("The next letter is written: open Build my letters", "#/letters/build", { cls: "primary", icon: "letters" }) : null,
      cur >= 4 ? el("div", { cls: "row" }, [btn("Complaint packet (ZIP), ready to attach", () => download("complaint-packet.zip", C.zip_stored(packetEntries(d, d.P.vault || [], false)), "application/zip"), { cls: "primary", icon: "packet", id: "auto-complaint" }),
        link("Write the complaint text", "#/letters/new?after=" + sel.id + "&kind=cfpb_complaint", { cls: "quiet" })]) : null,
      el("p", { cls: "muted small", text: "When a deadline passes, the next letter is written for you and waits in Build my letters. Nothing is sent without you." })]);
  }
  const rem = d.reminders.filter((x) => x.days_left >= 0);
  return { title: "Tracker", crumb: crumbOf("Deadlines and rounds"), body: [el("div", { cls: "cols" }, [el("div", { cls: "stack" }, [k,
    card("Letters waiting for an answer", "hourglass", [table(["Item", "Deadline", "State"], rows, { empty: "Nothing open." }),
      el("div", { cls: "row" }, [btn("Add deadlines to calendar (.ics)", () => icsExport(d), { icon: "calendar", id: "ics" }), btn("Add a reply you got", () => replyDialog(d, sel && !sel.outcome ? sel : null), { icon: "upload", id: "log-reply" }), d.P.rounds.length > 1 ? link("Round compare", "#/tracker/rounds", { icon: "diff" }) : null])], "reminders show when the app opens"),
    rem.length ? card("Due within 10 days", "clock", [rowsList(rem.map((x) => el("li", null, [icon("hourglass", "ico sm"), el("span", { text: x.label + (x.subject ? ": " + x.subject : "") }), num(mdy(x.due))])))]) : null]),
  el("div", { cls: "stack" }, [card("Removed so far", "removed", [gone.length ? rowsList(gone) : el("p", { cls: "muted", text: "Nothing removed yet. Answers usually come 30 to 45 days after they get your letter." })]), ladderCard])])] };
};
function roundsView(d) {
  const P = d.P;
  if (P.rounds.length < 2) return { title: "Round compare", crumb: "Tracker / Rounds", body: [keyAnswer("Removed this round", "0", "Import a new report after your results arrive; it is compared with the last one, bureau by bureau."), link("Import a report", "#/reports", { cls: "primary", icon: "upload" })] };
  const g = { Deleted: [], Updated: [], Verified: [], Reinserted: [], New: [] };
  const verifiedKeys = new Set(P.mail.flatMap((m) => (m.results || []).filter((x) => x.outcome === "verified").map((x) => m.bureau + "|" + x.key)));
  for (const b of Object.keys(d.diffs)) {
    const df = d.diffs[b];
    for (const x of df.deleted) g.Deleted.push({ b, name: titleCase(x.name), detail: "Not on the new report" });
    for (const x of df.personal.removed) g.Deleted.push({ b, name: x.replace(/^[a-z]+:/, ""), detail: "Personal information removed (" + x.split(":")[0] + ")" });
    for (const x of df.updated) g.Updated.push({ b, name: titleCase(x.name), detail: x.changes.map((c) => c.field + ": " + c.old + " to " + c.new).join("; ") });
    for (const x of df.unchanged) { const a = d.reports.find((r) => r.bureau === b).accounts.find((z) => z.id === x.id); if (a && verifiedKeys.has(b + "|" + C.account_key(a))) g.Verified.push({ b, name: titleCase(x.name), detail: "Kept as reported after the dispute" }); }
    for (const x of df.reinserted) { const n = (P.notices || {})[x.key]; g.Reinserted.push({ b, name: titleCase(x.name), detail: "Deleted after a dispute and back on this report" + (n ? ". You logged the bureau's notice on " + mdy(n) + "." : ""), key: x.key, noticed: !!n }); }
    for (const x of df.new) g.New.push({ b, name: titleCase(x.name), detail: "First seen on this report" });
    for (const q of df.inquiries.new) g.New.push({ b, name: titleCase(q.name) + " inquiry", detail: "Hard inquiry " + mdy(q.date) + " first seen on this report" });
  }
  const grp = (name) => el("div", { cls: "card dgrp" }, [el("h4", null, [chip(name), el("span", { cls: "c", text: String(g[name].length) })]), g[name].length ? el("ul", { cls: "rows" }, g[name].map((x) => el("li", { cls: name === "Deleted" ? "gone" : "" }, [bu(x.b), el("span", { cls: "nm" }, [el("b", { text: x.name })]), name === "Deleted" ? el("span", { cls: "stamp" }, [icon("removed"), "Removed"]) : el("span"), el("span", { cls: "sub", text: x.detail })]))) : el("p", { cls: "muted small", text: "None." })]);
  const reinF = d.groups.find((x) => x.rule === "reinserted" && x.current);
  let rein = null;
  const unnoticed = g.Reinserted.filter((x) => !x.noticed);
  if (unnoticed.length) {
    const x = unnoticed[0];
    const rep = d.reports.find((r) => r.bureau === x.b);
    const due = C.add_business_days(rep.source.report_date, 5);
    rein = note("bad", "reinserted", [el("b", { text: "Reinserted without the required notice" }), el("p", { text: bname(x.b) + " deleted " + x.name + " after your dispute and it is back on the report of " + mdy(rep.source.report_date) + ". A bureau must tell you in writing within 5 business days of putting an item back (by " + mdy(due) + " here, counted from that report date). No such notice is logged." }),
      cites(["fcra611a5b"]), el("div", { cls: "row" }, [reinF ? link("Draft the reinsertion letter", "#/letters/new?f=" + reinF.members.map((m) => m.id).join(",") + "&kind=reinsertion_demand", { cls: "primary", icon: "letters" }) : null,
        btn("I did get a notice", () => change("Notice recorded; the reinsertion is not flagged", (Q) => { Q.notices = Q.notices || {}; Q.notices[x.key] = d.today; }), { icon: "attach" })])]);
  }
  const prev = d.prev, cur = d.round;
  const k = keyAnswer("Removed this round", String(g.Deleted.length), prev.label + " reports from " + md(prev.date) + " against " + cur.label + " reports from " + md(cur.date) + ", " + Object.keys(d.diffs).length + " bureau" + (Object.keys(d.diffs).length === 1 ? "" : "s") + ".");
  return { title: "Round compare", crumb: "Tracker / " + prev.label + " to " + cur.label, body: [el("div", { cls: "cols" }, [k, rein]), el("div", { cls: "cols even" }, [el("div", { cls: "stack" }, [grp("Deleted"), grp("Updated")]), el("div", { cls: "stack" }, [grp("Verified"), grp("Reinserted"), grp("New")])])] };
}

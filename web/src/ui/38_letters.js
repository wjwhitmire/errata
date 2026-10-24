// ---------------------------------------------------------------- letters: new dispute, preview, print and mail, mailing log
const WIZ_STEPS = ["Items", "Reason", "Facts", "Recipient", "Enclosures", "Review"];
const BUREAU_KINDS = new Set(["bureau_611", "obsolete_605", "personal_info", "cares_act", "bankruptcy_correction", "mov_611a7", "reinsertion_demand", "block_605b", "disclosure_609", "consumer_statement", "security_freeze", "fraud_alert"]);
// letters that need no finding and go to every nationwide bureau (skip any in the Recipient step)
const ALL_BUREAU_KINDS = new Set(["disclosure_609", "security_freeze", "fraud_alert"]);
const AGENCY_TO = "Texas Attorney General, Child Support Division";
function linesOf(text) { return String(text || "").split("\n").map((x) => cleanName(x, 100)).filter(Boolean); }
function letterTitle(k) { return C.TABLES.letters[k].title.split(" (")[0]; }
function reportFor(d, bureau, accountId) {
  if (accountId) { const r = d.reports.find((x) => x.accounts.some((a) => a.id === accountId)); if (r) return r; }
  return d.reports.find((x) => x.bureau === bureau) || d.reports[0] || C.new_report(bureau || "unknown");
}
function priorFor(d, ids) {
  // the latest bureau dispute that carried these findings and has a result date (for a method of verification request)
  const ms = d.P.mail.filter((m) => (m.findings || []).some((id) => ids.includes(id) || (d.byId.get(id) && ids.some((x) => d.byId.get(x) && d.byId.get(x).group === d.byId.get(id).group))) && m.delivered && ["bureau_611", "obsolete_605", "personal_info", "cares_act", "bankruptcy_correction"].includes(m.letter));
  ms.sort((a, b) => String(a.delivered).localeCompare(String(b.delivered)));
  const m = ms[ms.length - 1];
  return m ? { id: m.id, delivered: m.delivered, result_date: m.result_date || "" } : null;
}
// Build the wizard's letter list from what the person chose: one letter per bureau (bureau letters)
// or per account (letters to a lender, collector or inquirer).
function wizardFromQuery(d, q) {
  const P = d.P;
  const w = { step: 0, items: [], kind: "", opts: {}, skip: {}, enclosures: {}, title: "" };
  if (q.after) {
    const m = P.mail.find((x) => x.id === q.after);
    if (m) {
      const ids = (m.findings || []).filter((id) => d.byId.has(id));
      const due = C.mail_deadlines(m)[0];
      w.items = ids;
      w.kind = "bureau_611";
      w.opts.prior = { id: m.id, delivered: m.delivered, due: due ? due.due : "", what: m.letter === "mov_611a7" ? "request for a description of how you verified the item" : "dispute" };
      w.followup = m.id;
      if (m.letter === "furnisher_623" || m.letter === "dispute_notation") w.kind = "cfpb_complaint";
    }
  } else if (q.step) {
    const plan = q.goal === "auto_soon" ? d.auto : d.plan;
    const s = plan.phases.flatMap((p) => p.steps).find((x) => String(x.order) === String(q.step));
    if (s) { w.items = s.findings.slice(); w.kind = s.letter; w.account = s.account_id; w.title = s.title; }
  } else if (q.f) { w.items = q.f.split(",").filter((id) => d.byId.has(id)); w.kind = q.kind || ""; }
  if (q.kind && !w.kind) w.kind = q.kind;
  if (q.account) { const a = d.merged.accounts.find((x) => x.name === q.account); if (a) w.account = a.id; }
  // an offer amount already set in the negotiation workspace carries over
  if (q.account && (w.kind === "pay_for_delete" || w.kind === "settlement")) { const o = (P.offers || []).find((x) => x.name === q.account && x.kind === w.kind && x.amount); if (o) w.opts.offer = o.amount; }
  if (!w.kind && w.items.length) {
    const ks = w.items.map((id) => d.byId.get(id).letter);
    w.kind = ks.every((k) => k === ks[0]) ? ks[0] : "bureau_611";
  }
  if (w.kind === "mov_611a7") { const pr = priorFor(d, w.items); if (pr) w.opts.log = pr; }
  if (!w.kind) w.kind = "bureau_611";
  return w;
}
function wizardLetters(d, w) {
  const out = [];
  const fs = w.items.map((id) => d.byId.get(id)).filter(Boolean);
  const P = d.P;
  const agencyRec = () => { const ls = linesOf(w.opts.recipientText); return ls.length >= 2 ? { name: ls[0], lines: ls.slice(1) } : null; };
  if (C.TABLES.letters[w.kind] && C.TABLES.letters[w.kind].to === "agency") {
    const o = Object.assign({}, w.opts);
    delete o.recipientText;
    const rec = agencyRec();
    if (rec) o.recipient = rec;
    out.push({ kind: w.kind, bureau: "", account_id: "", findings: [], opts: o, to: rec ? rec.name : AGENCY_TO });
  } else if (BUREAU_KINDS.has(w.kind)) {
    const bs = fs.length ? Array.from(new Set(fs.map((f) => f.bureau))) : ALL_BUREAU_KINDS.has(w.kind) ? ["transunion", "experian", "equifax"] : [d.reports[0] ? d.reports[0].bureau : "transunion"];
    for (const b of bs.sort((a, c) => BUREAU_ORDER.indexOf(a) - BUREAU_ORDER.indexOf(c))) out.push({ kind: w.kind, bureau: b, findings: fs.filter((f) => f.bureau === b).map((f) => f.id), opts: Object.assign({}, w.opts), to: bname(b) });
  } else if (w.kind === "cfpb_complaint" || w.kind === "state_ag_complaint" || w.kind === "small_claims_outline") {
    out.push({ kind: w.kind, bureau: fs[0] ? fs[0].bureau : "", findings: fs.map((f) => f.id), opts: Object.assign({}, w.opts, { logs: P.mail.map((m) => ({ id: m.id, letter: m.letter, to: m.to, delivered: m.delivered, outcome: m.outcome, result_date: m.result_date })) }), to: w.kind === "cfpb_complaint" ? "CFPB complaint portal" : w.kind === "state_ag_complaint" ? "State attorney general" : "Small claims court" });
  } else {
    const accts = fs.length ? Array.from(new Set(fs.map((f) => f.account_id || ""))) : [w.account || ""];
    for (const aid of accts) {
      const rep = reportFor(d, fs[0] ? fs[0].bureau : "", aid);
      const a = rep.accounts.find((x) => x.id === aid);
      const q = w.kind === "inquiry_removal" && fs[0] ? rep.inquiries.find((x) => x.id === fs[0].inquiry_id) : null;
      const o = Object.assign({ account_id: aid }, w.opts);
      delete o.recipientText;
      const rec = w.kind === "child_support_zero_delinquent" ? agencyRec() : null;
      if (rec) o.recipient = rec;
      out.push({ kind: w.kind, bureau: rep.bureau, account_id: aid, findings: fs.filter((f) => (f.account_id || "") === aid).map((f) => f.id), opts: o, to: rec ? rec.name : q ? titleCase(q.name) : a ? titleCase(a.name) : "Recipient" });
    }
  }
  return out.map((x, i) => Object.assign(x, { key: i }));
}
function buildLetter(d, x) {
  if (ALL_BUREAU_KINDS.has(x.kind) && !d.reports.some((r) => r.bureau === x.bureau)) return C.generate_letter(x.kind, C.new_report(x.bureau), [], d.P.profile, d.today, x.opts);
  if (C.TABLES.letters[x.kind] && C.TABLES.letters[x.kind].to === "agency") return C.generate_letter(x.kind, C.new_report("unknown"), [], d.P.profile, d.today, x.opts);
  const rep = reportFor(d, x.bureau, x.account_id);
  const fs = x.findings.map((id) => Object.assign({}, d.byId.get(id), { status: "open", group: undefined, mail: undefined }));
  return C.generate_letter(x.kind, rep, fs, d.P.profile, d.today, x.opts);
}
VIEWS.letters = (d, r) => {
  if (r.parts[1] === "build") return buildView(d, r);
  if (r.parts[1] === "new") return wizardView(d, r);
  if (r.parts[1] === "draft") return previewView(d, S.ui.draft, null);
  if (r.parts[1] === "view") { const m = d.P.mail.find((x) => x.id === r.parts[2]); return previewView(d, m ? { L: m.L } : null, m); }
  return mailView(d);
};
function wizardView(d, r) {
  const qkey = JSON.stringify(r.q);
  if (!S.ui.wiz || S.ui.wizKey !== qkey || S.ui.wizCur !== S.cur) { S.ui.wiz = wizardFromQuery(d, r.q); S.ui.wizKey = qkey; S.ui.wizCur = S.cur; }
  const w = S.ui.wiz;
  const all = wizardLetters(d, w);
  const letters = all.filter((x) => !w.skip[x.key]);
  const built = letters.map((x) => { try { return { x, L: buildLetter(d, x) }; } catch (e) { return { x, err: e.message || String(e) }; } });
  const steps = el("ol", { cls: "steps" }, WIZ_STEPS.map((s, i) => el("li", { cls: i < w.step ? "done" : "", "aria-current": i === w.step ? "step" : null, text: s })));
  const set = (fn) => { fn(w); render(); };
  let body;
  const fs = w.items.map((id) => d.byId.get(id)).filter(Boolean);
  if (w.step === 0) {
    const cands = d.findings.filter((f) => f.current && (OPEN_STATES.has(f.state) || w.items.includes(f.id)) && f.confidence !== "needs_answer");
    body = card("Which items", "findings", [cands.length ? el("div", { cls: "pick" }, cands.map((f) => {
      const on = w.items.includes(f.id);
      const cb = el("input", { type: "checkbox", checked: on, on: { change: () => set((z) => { z.items = on ? z.items.filter((x) => x !== f.id) : z.items.concat([f.id]); }) } });
      return el("label", { cls: on ? "on" : "" }, [cb, el("b", { text: f.group.label + " " + f.title }), bu(f.bureau), el("span", { cls: "sub", text: f.subject })]);
    })) : el("p", { cls: "muted", text: "No open findings. This letter does not need one." }),
    why("One issue per account and only the items you pick. Letters are kept to five accounts each so every item gets read.")]);
  } else if (w.step === 1) {
    const kinds = Object.keys(C.TABLES.letters).filter((k) => !["block_605b"].includes(k) || (d.P.profile.facts || {})["theft:confirmed"] === true);
    body = card("What kind of letter", "dispute", [el("p", { cls: "muted small", text: w.items.length ? "Picked for you from the items you chose. Change it only if you know you need a different letter." : "Pick what you want the letter to do." }),field("Letter", select(kinds.map((k) => [k, plainLetter(k, fs[0] ? fs[0].bureau : "") + " (" + C.TABLES.letters[k].title + ")"]), w.kind, { id: "wiz-kind", on: { change: (e) => set((z) => { z.kind = e.target.value; if (z.kind === "mov_611a7") { const pr = priorFor(d, z.items); if (pr) z.opts.log = pr; } }) } })),
      fs.length ? rowsList(fs.map((f) => el("li", null, [bu(f.bureau), el("span", { text: f.facts[0] || f.explain }), el("span")]))) : null,
      w.kind === "pay_for_delete" || w.kind === "settlement" ? field("Amount you offer", input({ id: "wiz-offer", mono: true, value: w.opts.offer ? C.money_text(w.opts.offer) : "", on: { change: (e) => set((z) => { z.opts.offer = C.parse_money(e.target.value) || undefined; }) } })) : null,
      w.kind === "goodwill" ? field("Your reason, in your words (optional)", el("textarea", { cls: "input", id: "wiz-reason", maxlength: 600, on: { change: (e) => set((z) => { z.opts.reason = e.target.value; }) } }, [w.opts.reason || ""])) : null,
      w.kind === "consumer_statement" ? field("Your statement (100 words or fewer)", el("textarea", { cls: "input", id: "wiz-statement", maxlength: 800, on: { change: (e) => set((z) => { z.opts.statement = e.target.value; }) } }, [w.opts.statement || ""])) : null,
      w.kind === "disclosure_609" ? note("", "info", [el("p", { text: "A 609 letter asks for your file and its sources. It is a disclosure request, not a dispute, and no wording forces a deletion." })]) : null,
      ...letterOptions(d, w, set),
      why(C.TABLES.letters[w.kind] ? C.TABLES.letters[w.kind].title + ". " + (w.kind === "bureau_611" ? "The bureau must check again and answer within 30 days of getting it." : "") : ""), cites((C.TABLES.letters[w.kind] || {}).cite || [])]);
  } else if (w.step === 2) {
    const confirms = [];
    const seen = new Set();
    for (const f of fs) for (const c of f.confirm || []) if (!seen.has(c.key)) { seen.add(c.key); confirms.push(confirmBox(f, c)); }
    body = card("Facts in these letters", "confirm", [rowsList(fs.flatMap((f) => f.facts.map((s) => el("li", null, [icon("check", "ico sm"), el("span", { text: s }), el("span", { cls: "muted small", text: f.group.label })])))),
      confirms.length ? el("h4", { cls: "lbl", text: "Facts only you can confirm" }) : null].concat(confirms, [el("p", { cls: "muted small", text: "Change a fact and every letter that uses it is redrafted before you print." })]));
  } else if (w.step === 3) {
    body = card("Who receives it", "bureau", [el("div", { cls: "pick" }, all.map((x) => {
      const on = !w.skip[x.key];
      const cb = el("input", { type: "checkbox", checked: on, on: { change: () => set((z) => { z.skip[x.key] = on; }) } });
      return el("label", { cls: on ? "on" : "" }, [cb, el("b", { text: x.to }), el("span", { cls: "chip " + (on ? "info" : "plain"), text: on ? "Included" : "Skipped" }), el("span", { cls: "sub", text: letterTitle(x.kind) + (x.findings.length ? ", " + plural(x.findings.length, "item") : "") })]);
    })), why(BUREAU_KINDS.has(w.kind) ? "Each bureau keeps its own file, so each gets its own letter about what it reports. None depends on the others." : "A letter to a lender or collector is about one account. It never includes your birth date or Social Security number.")]);
  } else if (w.step === 4) {
    body = card("Enclosures", "attach", built.filter((b) => b.L).map((b) => el("div", { cls: "stack", style: "gap:var(--s-2)" }, [el("b", { text: b.x.to }), rowsList((b.L.enclosures.length ? b.L.enclosures : ["Nothing required"]).map((e) => el("li", null, [icon("attach", "ico sm"), el("span", { text: e }), el("span")])))]))
      .concat([el("p", { cls: "muted small", text: "Send copies, never originals. Your proof can be kept in the Vault, encrypted, and printed with the packet." })]));
  } else {
    body = card("Review", "letters", built.map((b) => b.err ? note("bad", "alert", [el("b", { text: b.x.to + ": not drafted" }), el("p", { text: b.err })])
      : el("div", { cls: "row", style: "justify-content:space-between" }, [el("span", null, [el("b", { text: b.x.to }), " " + letterTitle(b.x.kind) + ", " + plural(b.L.blocks.filter((k) => k.asserts).length, "claim") + " traced"]),
        btn("Open the letter", () => { S.ui.draft = { L: b.L, x: b.x, followup: w.followup || "" }; go("#/letters/draft"); }, { cls: "sm primary", icon: "letters" })])));
    const good = built.filter((b) => b.L);
    if (good.length > 1) body.append(el("div", { cls: "row" }, [btn("All " + good.length + " letters in one PDF", () => download("letters-" + d.today + ".pdf", C.pdf_doc(good.flatMap((b) => [C.cover_sheet(b.L, ""), C.letter_paragraphs(b.L)])), "application/pdf"), { icon: "print", id: "wiz-batch" }),
      el("span", { cls: "muted small", text: "Each letter with its own cover sheet and enclosure checklist, ready to print in one go." })]));
  }
  const ok = built.filter((b) => b.L).length;
  const k = keyAnswer("Letters this creates", String(ok), ok ? built.filter((b) => b.L).map((b) => b.x.to).join(", ") + ". Each carries its own issues, the evidence and only the identifiers that recipient needs." : built.length ? built[0].err : "Pick at least one item.");
  const foot = el("div", { cls: "wiz-foot" }, [btn("Back", () => set((z) => { z.step = Math.max(0, z.step - 1); }), { icon: "chevron-left", icoCls: "ico sm", disabled: w.step === 0 }),
    el("span", { cls: "muted hide-ph", text: "Saved on this device as you go" }),
    w.step < 5 ? btn("Next: " + WIZ_STEPS[w.step + 1].toLowerCase(), () => set((z) => { z.step++; }), { cls: "primary", after: "chevron-right", id: "wiz-next" }) : btn("Open the first letter", () => { const b = built.find((x) => x.L); if (b) { S.ui.draft = { L: b.L, x: b.x, followup: w.followup || "" }; go("#/letters/draft"); } }, { cls: "primary", disabled: !ok, id: "wiz-open" })]);
  body.append(foot);
  return { title: "Write a letter yourself", crumb: "Letters / Advanced / Step " + (w.step + 1) + " of 6", body: [note("", "info", [el("p", null, ["Most people don't need this page. ", el("a", { href: "#/letters/build", text: "Build my letters" }), " picks the letters, the people they go to and their addresses for you."])]), steps, el("div", { cls: "cols" }, [body, el("div", { cls: "stack" }, [k, fs.length ? card("Findings in these letters", "findings", [rowsList(fs.map((f) => el("li", null, [bu(f.bureau), el("a", { href: "#/findings/" + f.group.label, text: f.group.label + " " + f.title }), el("span")])))]) : null])])] };
}
// The letter on legal pad paper, with every claim footnoted to where it comes from.
function traceLabel(src, map, d) {
  for (const s of src) {
    if (s === "template") continue;
    if (map.has(s)) return map.get(s);
    let lab;
    if (s.startsWith("finding:")) { const f = d.byId.get(s.slice(8)); lab = f ? f.group.label : "F"; }
    else if (s.startsWith("fact:")) lab = "C-" + (Array.from(map.values()).filter((v) => v.startsWith("C-")).length + 1);
    else if (s.startsWith("log:")) lab = "L-" + (Array.from(map.values()).filter((v) => v.startsWith("L-")).length + 1);
    else if (s === "report") lab = "R";
    else if (s === "profile") lab = "P";
    else if (s.startsWith("user:")) lab = "Y";
    else lab = "?";
    map.set(s, lab);
    return lab;
  }
  return null;
}
function traceWhat(s, d) {
  if (s.startsWith("finding:")) { const f = d.byId.get(s.slice(8)); return f ? [f.title + ": " + (f.evidence[0] ? f.evidence[0].label + " " + f.evidence[0].value : ""), "Report pages"] : ["A finding", "Report"]; }
  if (s.startsWith("fact:")) return ["A sentence you checked", "Fact you confirmed"];
  if (s.startsWith("log:")) { const m = d.P.mail.find((x) => x.id === s.slice(4)); return [m ? m.to + ", delivered " + md(m.delivered) : "Mail log entry", "Mailing log"]; }
  if (s === "report") return ["A value printed on your report", "Report pages"];
  if (s === "profile") return ["Your name, address and identifiers", "Your profile"];
  if (s.startsWith("user:")) return ["Text you typed", "You"];
  return [s, ""];
}
function paper(L, d) {
  const map = new Map();
  const blocks = [];
  for (const b of L.blocks) {
    const lab = b.asserts ? traceLabel(b.src, map, d) : null;
    if (b.kind === "item") blocks.push(el("p", { cls: "p-item", text: b.text }));
    else if (b.kind === "h") blocks.push(el("p", { cls: "p-item", text: b.text }));
    else if (b.kind === "id") blocks.push(el("p", { cls: "p-id", text: b.text }));
    else if (b.kind === "sig") blocks.push(el("p", { cls: "sig", text: b.text }));
    else if (b.kind === "li") blocks.push(el("p", { text: "• " + b.text }));
    else blocks.push(el("p", null, [b.text, lab ? el("sup", { cls: "fref", text: lab }) : null]));
  }
  const pg = el("div", { cls: "paper", "aria-label": "Letter preview", id: "letter-paper" }, [el("p", { cls: "addr" }, [L.sender.name].concat(L.sender.lines).flatMap((x, i) => (i ? [el("br"), x] : [x]))),
    L.recipient.name ? el("p", { cls: "addr" }, [L.recipient.name].concat(L.recipient.lines).flatMap((x, i) => (i ? [el("br"), x] : [x]))) : null,
    el("p", { text: longDate(L.date) }), el("p", { cls: "re", text: "Re: " + L.subject })].concat(blocks, L.enclosures.length ? [el("p", { cls: "p-item", text: "Enclosures" })].concat(L.enclosures.map((e) => el("p", { cls: "p-id", text: "• " + e }))) : []));
  return { pg, map };
}
function previewView(d, draft, mailed) {
  if (!draft || !draft.L) return { title: "Letter", crumb: "Letters", body: [keyAnswer("Facts with a source", "None", "Open a letter from Build my letters or the mailing log."), link("Mailing log", "#/letters")] };
  const L = draft.L;
  const { pg, map } = paper(L, d);
  const claims = L.blocks.filter((b) => b.asserts);
  const traced = claims.filter((b) => b.src.some((s) => s !== "template"));
  const trace = Array.from(map.entries()).map(([s, lab]) => { const [a, b2] = traceWhat(s, d); return el("li", null, [el("span", { cls: "ix", text: lab }), el("span", { text: a }), el("span", { cls: "muted small", text: b2 })]); });
  const bureauLetter = BUREAU_KINDS.has(L.kind);
  const withheld = card("What this letter keeps private", "eye-off", [el("ul", { cls: "rows withheld" }, [
    el("li", null, [icon(bureauLetter ? "check" : "eye-off", "ico sm"), el("span", { text: bureauLetter ? "Date of birth and SSN last four: included, a bureau needs them to find your file" : "Date of birth and SSN digits: left out; a lender or collector never gets them" }), el("span")]),
    el("li", null, [icon("eye-off", "ico sm"), el("span", { text: "Your full Social Security number and other people's details: never included" }), el("span")])]),
  el("p", { cls: "muted small", text: "Letters to lenders and collectors never include your date of birth or SSN." })]);
  const pdfBytes = () => C.letter_pdf(L, true, mailed ? mailed.tracking : "");
  const fname = (ext) => (L.kind + "-" + (L.recipient.name || "letter")).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60) + "." + ext;
  const printCard = card("Print and mail", "print", [el("div", { cls: "row" }, [btn("Print", () => window.print(), { cls: "primary", icon: "print", id: "print-letter" }), btn("PDF", () => download(fname("pdf"), pdfBytes(), "application/pdf"), { icon: "download", id: "dl-pdf" }),
    btn("DOCX", () => download(fname("docx"), C.docx(L), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), { icon: "download", id: "dl-docx" }), btn("Text", () => download(fname("txt"), C.letter_text(L), "text/plain"), { icon: "download" })]),
  rowsList([el("li", null, [icon("envelope", "ico sm"), el("span", { text: "Envelope with both addresses" }), btn("Envelope", () => download(fname("envelope.txt"), C.envelope_text(L), "text/plain"), { cls: "sm quiet" })]),
    el("li", null, [icon("certified", "ico sm"), el("span", { text: "Certified mail cover sheet with return receipt (in the PDF): about " + money(L.cost.certified_err) + " electronic, " + money(L.cost.certified_green) + " green card" }), el("span")]),
    el("li", null, [icon("attach", "ico sm"), el("span", { text: "Enclosure checklist: " + plural(L.enclosures.length, "item") }), el("span")])]),
  L.warnings && L.warnings.length ? note("warn", "alert", L.warnings.map((x) => el("p", { text: x }))) : null,
  mailed ? el("p", { cls: "muted small", text: "Mailed " + mdy(mailed.mailed) + (mailed.tracking ? ", tracking " + mailed.tracking : "") + ". This is the letter as it was sent." })
    : el("div", { cls: "row" }, [btn("I mailed it", () => logMailedDialog(d, draft), { cls: "primary", icon: "certified", id: "log-mailed" }), switchOn("mail") ? btn("Send by certified mail online", () => onlineMail(d, draft), { icon: "envelope" }) : null]),
  aiTailorButton(L)]);
  const k = keyAnswer("Facts with a source", traced.length + " of " + claims.length, traced.length === claims.length ? "Every fact in this letter comes from your report, your mailing log or something you confirmed. The numbers in the margin show where." : "Some sentences have no source; this letter will not print until they do.");
  return { title: "Letter preview", crumb: "Letters / " + (L.recipient.name || "") + " / " + letterTitle(L.kind), body: [el("div", { cls: "cols" }, [el("div", { style: "min-width:0" }, [pg]),
    el("div", { cls: "stack no-print" }, [k, card("Where each fact comes from", "findings", [el("ul", { cls: "rows trace" }, trace)]), withheld, printCard])])] };
}
function logMailedDialog(d, draft) {
  const date = input({ type: "date", id: "mail-date", value: d.today });
  const trk = input({ id: "mail-track", mono: true, placeholder: "9400 ..." });
  openDialog({ title: "I mailed this letter", icon: "certified", body: [field("Mailed on", date), field("Tracking number", trk, "From the certified mail receipt."),
    el("p", { cls: "muted small", text: "The legal clock starts when they receive it. Add the delivery date from the return receipt in the mailing log when it comes." })],
  actions: [{ label: "Cancel" }, { label: "Log it", primary: true, id: "mail-log-go", onClick: () => {
    const L = draft.L, x = draft.x || {};
    change("Logged the letter to " + (x.to || L.recipient.name), (P) => {
      const id = "m" + Date.now().toString(36);
      const round = P.rounds.length;
      P.mail.push({ id, letter: L.kind, bureau: x.bureau || L.bureau || "", to: x.to || L.recipient.name, round, findings: (L.findings || []).slice(), account_id: x.account_id || "", mailed: date.value || d.today,
        delivered: "", tracking: cleanName(trk.value, 40), card: false, outcome: "", L });
      P.vault.push({ id: "v-" + id, name: letterTitle(L.kind) + " to " + (x.to || L.recipient.name) + ".txt", kind: "Letter", account: "", date: date.value || d.today, type: "text/plain", text: C.letter_text(L) });
      if (draft.followup) { const m = P.mail.find((z) => z.id === draft.followup); if (m && !m.outcome) { m.outcome = "no_response"; m.completed = ""; } }
    });
    go("#/letters");
  } }] });
}
async function onlineMail(d, draft) {
  const key = await secretGet("mail");
  if (!key) { openDialog({ title: "Add your mail service key first", icon: "key", body: [el("p", { text: "Online certified mail uses your own account and key with the mail service. Add the key in Settings; it is kept in your encrypted record on this device." })], actions: [{ label: "Close" }, { label: "Open Settings", primary: true, onClick: () => go("#/settings") }] }); return; }
  let req;
  try { req = mailRequest(draft.L, key); } catch (e) { toast(e.message); return; }
  const shown = Object.assign({}, req.headers, { authorization: "Basic (your key)" });
  openDialog({ title: "Send to api.lob.com?", icon: "envelope", wide: true, body: [el("p", { text: "Exactly this goes to the mail service, with your key. Certified mail with an electronic return receipt; that service charges your account for printing and postage." }),
    el("pre", { cls: "outbox", text: "POST " + req.url + "\n" + Object.keys(shown).map((k) => k + ": " + shown[k]).join("\n") + "\n\n" + decodeURIComponent(req.body.replace(/\+/g, " ")).slice(0, 4000) })],
  actions: [{ label: "Cancel" }, { label: "Send", primary: true, id: "mail-send", onClick: () => {
    sendMail(req).then((res) => {
      change("Sent through the mail service", (P) => { const id = "m" + Date.now().toString(36); P.mail.push({ id, letter: draft.L.kind, bureau: (draft.x || {}).bureau || "", to: (draft.x || {}).to || draft.L.recipient.name, round: P.rounds.length, findings: (draft.L.findings || []).slice(), account_id: (draft.x || {}).account_id || "", mailed: d.today, delivered: "", tracking: res.tracking, card: false, outcome: "", L: draft.L, service: res.id }); });
      go("#/letters");
    }).catch((e) => toast(e.message));
  } }] });
}
function mailView(d) {
  const P = d.P;
  const delivered = d.mail.filter((m) => m.delivered).length;
  const pending = d.mail.filter((m) => m.mailed && !m.delivered);
  const drafts = draftsCard(d);
  const k = keyAnswer("Delivered", delivered + " of " + d.mail.length, d.mail.length ? "The deadline clock starts the day they receive it, so the delivery date is the one that matters." + (pending.length ? " " + plural(pending.length, "letter is", "letters are") + " still in transit." : "") : "No letters yet. Start a new dispute from a finding.",
    [link("Build my letters", "#/letters/build", { cls: "primary", icon: "letters", id: "build-go" }), link("Write one yourself", "#/letters/new", { cls: "quiet", id: "new-dispute" })]);
  const sel = select([["", "Choose a letter"]].concat(pending.map((m) => [m.id, m.to + ", mailed " + mdy(m.mailed)])), pending[0] ? pending[0].id : "", { id: "dl-which" });
  const dd = input({ id: "dl-date", type: "date" });
  const logCard = card("When did they get it?", "certified", [el("div", { cls: "grid2" }, [field("Letter", sel), field("Delivered on", dd)]),
    btn("Save the delivery date", () => { if (!sel.value || !dd.value) { toast("Choose the letter and the date."); return; } change("Delivery logged; the clock started", (Q) => { const m = Q.mail.find((x) => x.id === sel.value); if (m) m.delivered = dd.value; }); }, { cls: "primary", id: "dl-save", disabled: !pending.length }),
    el("p", { cls: "muted small", text: "Type the date from the return receipt or the green card. Checking delivery online would be a network request, so " + C.PRODUCT_NAME + " does not." })]);
  const rows = d.mail.map((m) => ({ cells: [[el("a", { href: "#/letters/view/" + m.id }, [el("b", { text: m.to })]), el("br"), el("span", { cls: "muted", text: plainLetter(m.letter, m.bureau) + ((m.findings || []).length ? ", " + (m.findings || []).map((id) => (d.byId.get(id) ? d.byId.get(id).group.label : "")).filter((x, i, a) => x && a.indexOf(x) === i).join(", ") : "") })],
    m.mailed ? num(mdy(m.mailed)) : el("span", { cls: "muted", text: "Not yet" }), el("span", { cls: "acctno", text: m.tracking || "" }), !m.mailed ? el("span", { cls: "muted", text: "Mail it first" }) : m.delivered ? num(mdy(m.delivered)) : btn("Add date", () => { sel.value = m.id; dd.focus(); }, { cls: "sm", icon: "plus", icoCls: "ico sm" }),
    m.card ? el("span", { cls: "encl" }, [icon("attach", "ico sm"), "Receipt"]) : btn("Add scan", () => addReceipt(m), { cls: "sm", icon: "plus", icoCls: "ico sm" }),
    num(m.due ? mdy(m.due) : ""), chip(m.state)] }));
  return { title: "Mailing log", crumb: "Letters / Mailing log", body: [el("div", { cls: "cols" }, [k, logCard]), drafts,
    card("Every letter sent", "letters", [table(["Recipient", "Mailed", "Tracking", "Delivered", "Receipt", "Deadline", "Outcome"], rows, { empty: "Letters you log appear here." }),
      el("p", { cls: "muted small", text: "Deadlines are conservative: day 1 is the day after delivery, so a 30-day period is due 30 days after the delivery date. The earliest reading (the day of receipt counted as day 1) is one day sooner; both are shown in the Tracker." })])] };
}
async function addReceipt(m) {
  const files = await pickFile("image/*,application/pdf");
  if (!files.length) return;
  const f = files[0];
  if (f.size > 8 * 1024 * 1024) { toast("That file is larger than 8 MB."); return; }
  const bytes = await readFile(f);
  change("Receipt added to the vault, encrypted", (P) => {
    const id = "v-" + Date.now().toString(36);
    P.vault.push({ id, name: cleanName(f.name, 80), kind: "Receipt", account: "", date: today(), type: f.type || "application/octet-stream", data: b64(bytes) });
    const e = P.mail.find((x) => x.id === m.id);
    if (e) e.card = id;
  });
}

// Inputs some letters need. Each is the person's own fact (a date, a case number, their words) or a
// sentence they confirm with the exact wording; nothing here is filled in for them.
function letterOptions(d, w, set) {
  const o = w.opts, out = [];
  const text = (id, label, key, hint, area) => field(label, area ? el("textarea", { cls: "input", id, maxlength: 1200, on: { change: (e) => set((z) => { z.opts[key] = e.target.value; }) } }, [o[key] || ""])
    : input({ id, value: o[key] || "", on: { change: (e) => set((z) => { z.opts[key] = e.target.value; }) } }), hint);
  const date = (id, label, key) => field(label, input({ id, type: "date", value: o[key] || "", on: { change: (e) => set((z) => { z.opts[key] = e.target.value; }) } }));
  const fact = (key, sentence) => confirmBox(null, { key, sentence });
  if (w.kind === "intent_to_sue") {
    out.push(note("warn", "alert", [el("p", { text: "Send this only if you mean it, and have a consumer attorney read it first. A threat you will not carry out can itself be unlawful." })]));
    out.push(fact(C.INTENT_KEY, C.INTENT_SENTENCE));
  }
  if (w.kind === "fraud_alert") { out.push(fact(C.FRAUD_KEY, C.FRAUD_SENTENCE)); out.push(text("wiz-phone", "A phone number a lender may call to check it is you (optional)", "phone")); }
  if (w.kind === "security_freeze") out.push(note("", "info", [el("p", { text: "A freeze is free. Placing it online or by phone takes effect within 1 business day; by mail, within 3 business days of receipt. Keep the PIN or password each bureau gives you." })]));
  if (w.kind === "oag_review_request" || w.kind === "child_support_records" || w.kind === "child_support_zero_delinquent") {
    out.push(text("wiz-case", "Child support case number (optional)", "case"));
    out.push(text("wiz-rec", "Send to (name, then each address line)", "recipientText", w.kind === "oag_review_request" ? "Use the address printed on your notice; the rule says the request goes there." : "Use the address on your notices or the Attorney General's site.", true));
  }
  if (w.kind === "oag_review_request") {
    out.push(el("div", { cls: "grid2" }, [date("wiz-ndate", "Date printed on the notice", "notice_date"), date("wiz-nrec", "Date you received it", "received")]));
    out.push(text("wiz-why", "What you contest, in your words", "reason", "For example: the back support it lists, and what your payment record shows.", true));
    out.push(field("You ask for", select([["both", "Informal resolution, then a hearing if needed"], ["informal", "Informal resolution"], ["hearing", "A formal hearing"]], o.review || "both",
      { id: "wiz-review", on: { change: (e) => set((z) => { z.opts.review = e.target.value; }) } })));
    if (o.notice_date && o.received) {
      try {
        const dl = C.oag_review_deadline(o.notice_date, o.received);
        out.push(note(d.today > dl.due ? "bad" : "warn", "hourglass", [el("p", null, [el("b", { text: "Postmark it by " + mdy(dl.due) + ". " }),
          "That is " + (dl.rule === "receipt" ? "30 days after you received the notice" : "45 days after the date on it") + ", whichever comes first (1 Tex. Admin. Code 55.103(c)). There is no good cause exception."])]));
      } catch (e) { out.push(note("bad", "alert", [el("p", { text: e.message })])); }
    }
  }
  if (w.kind === "validation_regf") out.push(date("wiz-vrec", "Date you received the collector's validation notice (if you have one)", "notice_received"));
  if (!["consumer_statement"].includes(w.kind)) out.push(text("wiz-note", "A paragraph in your own words (optional)", "note", "We check it like every other sentence. It can't claim things you haven't confirmed, threaten anyone, or give a lender your birth date or Social Security number.", true));
  return out;
}

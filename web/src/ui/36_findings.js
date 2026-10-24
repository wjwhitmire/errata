// ---------------------------------------------------------------- findings: list, detail, the facts only the person can confirm
const STATE_FILTERS = [["all", "All"], ["Ready", "Ready"], ["Needs answer", "Needs answer"], ["Printed", "Printed"], ["In dispute", "In dispute"], ["Removed", "Removed"]];
function groupSubject(g) { return titleCase(g.subject.replace(/\s+\S*\d\S*$/, "")) || g.subject; }
VIEWS.findings = (d, r) => {
  if (r.parts[1] === "accurate") return honestView(d, Number(r.parts[2] || 0));
  if (r.parts[1]) return findingView(d, r.parts[1]);
  const filt = r.q.state === "answers" ? "Needs answer" : (S.ui.ffilter || "all");
  const list = d.groups.filter((g) => filt === "all" || g.state === filt);
  const rows = list.map((g) => ({ attrs: { cls: "f-row" }, cells: [el("a", { href: "#/findings/" + g.label, text: g.label }),
    [el("a", { cls: "t1", href: "#/findings/" + g.label, text: plainTitle(g.rule, g.title) }), el("br"), el("span", { cls: "muted", text: groupSubject(g) })],
    el("span", { cls: "row" }, g.bureaus.map((b) => bu(b))), [conf(g.conf), el("br"), el("span", { cls: "muted small", text: g.strength })], chip(g.state)], cls: ["ix"] }));
  const seg = el("div", { cls: "seg", role: "group", "aria-label": "Show" }, STATE_FILTERS.map(([v, t]) => el("button", { type: "button", "aria-pressed": filt === v ? "true" : "false", text: t,
    on: { click: () => { S.ui.ffilter = v; go("#/findings"); render(); } } })));
  const ready = d.ready.length;
  const inDispute = d.groups.filter((g) => g.state === "In dispute").length;
  const k = keyAnswer("Ready to fix", plural(ready, "problem"), ready ? "Strongest first. " + (d.buildCount ? "One click writes every letter for them." : "") + (inDispute ? " " + plural(inDispute, "more is", "more are") + " already disputed." : "") + (d.honest.length ? " " + plural(d.honest.length, "item looks", "items look") + " correct, so " + (d.honest.length === 1 ? "it gets" : "they get") + " no dispute." : "")
    : d.groups.length ? "Nothing new to dispute. " + (inDispute ? plural(inDispute, "item is", "items are") + " already disputed." : "") : "Add your reports and " + C.PRODUCT_NAME + " checks them for you.",
    ready ? [link("Build my letters", "#/letters/build", { cls: "primary", icon: "letters", id: "findings-build" })] : null);
  const body = [k, card("All findings", "findings", [seg, table(["ID", "What's wrong", "Bureaus", "How sure", "Status"], rows, { empty: "No findings with this status." })], [icon("filter", "ico sm"), " " + STATE_FILTERS.find((x) => x[0] === filt)[1]])];
  const multi = d.tradelines.filter((t) => t.bureaus.length > 1 && t.gaps.length);
  if (multi.length) body.push(card("Accounts more than one bureau reports", "compare", [rowsList(multi.slice(0, 8).map((t) => el("li", null, [icon("bureau", "ico sm"),
    el("span", null, [el("b", { text: titleCase(t.name) }), el("br"), el("span", { cls: "muted small", text: t.gaps.map((g) => C.TABLES.rules[g.rule].title + ": found at " + g.found.map(bname).join(" and ") + "; " + g.not_found.map(bname).join(" and ") + " reports the account without it").join(". ") + "." })]),
    el("span", { cls: "row" }, t.bureaus.map((b) => bu(b, !t.findings[b].length)))]))),
    el("p", { cls: "muted small", text: "Each bureau keeps its own file, so each one only gets a letter about what its own report shows." })]));
  const cs = d.P.profile.state === "TX" || d.merged.accounts.some((a) => (a.flags || []).includes("child_support"));
  if (cs) body.push(card("Texas child support", "scale", [el("p", { text: "In Texas, the Attorney General must warn you before it reports back child support to the bureaus, and you can challenge the amount. If a court set up a payment plan for the back support and you pay on time, it must be reported as zero months late." }),
    el("div", { cls: "row" }, [link("Ask for a review of the notice", "#/letters/new?kind=oag_review_request", { cls: "sm", icon: "hourglass", id: "cs-review" }), link("Ask for the payment record", "#/letters/new?kind=child_support_records", { cls: "sm", icon: "file" })]),
    el("details", { cls: "law" }, [el("summary", { text: "Why this works (the law)" }), cites(["tac55_103", "tac55_102", "tfc231_114", "ssa666a7"])])]));
  if (d.honest.length) body.push(card("Looks correct: no dispute", "scale", [rowsList(d.honest.map((h, i) => el("li", null, [icon(h.kind === "goodwill" ? "envelope" : "clock", "ico sm"), el("a", { href: "#/findings/accurate/" + i, text: titleCase(h.name) }), chip(h.kind === "goodwill" ? "Goodwill" : "No dispute"), el("span", { cls: "sub", text: h.why })]))),
    el("p", { cls: "muted small", text: "Disputing something that is true is not allowed, and it tends to backfire. These get honest options instead." })]));
  return { title: "Findings", crumb: crumbOf(plural(d.groups.length, "finding")), body };
};
function recommended(g) {
  const f = g.members[0];
  switch (g.state) {
    case "Needs answer": return ["Answer the question below", "Only you know this. Answer yes or no; nothing is sent until you do."];
    case "Printed": return ["Mail the printed letters", "Send them by certified mail, then type the tracking numbers in Build my letters."];
    case "In dispute": { const m = f.mail[f.mail.length - 1]; const ds = m ? C.mail_deadlines(m) : []; return ["Wait for their answer", m && ds.length ? "Their answer is due " + mdy(ds[0].due) + "." : "Type the delivery date from the return receipt to start the clock."]; }
    case "Verified": return ["Ask how they checked, and ask the lender directly", "The bureau has 15 days to say how it checked. The lender gets the same dispute straight from you."];
    case "Reinserted": return ["Ask why it came back", "The bureau had to tell you in writing within 5 business days of putting it back."];
    case "Removed": return ["Nothing to do: it is gone", "Watch your next reports. If it comes back, the bureau must tell you in writing within 5 business days."];
    case "Updated": return ["Check the corrected entry", "Compare the new report line by line. Dispute again only if something new is wrong."];
    case "Set aside": return ["Set aside for now", "Reopen it if your records support a dispute."];
    default: return [plainDo(g), ""];
  }
}
// The evidence as a plain two-column table: label and value, with the values that contradict each
// other tinted and tagged.
function evidenceBlock(f) {
  const rep = D.reports.find((x) => x.bureau === f.bureau) || {};
  const rows = f.evidence.map((e) => {
    const bad = conflictRow(f, e);
    return el("tr", { cls: bad ? "clash" : null }, [el("th", { scope: "row", text: e.label }), el("td", null, [el("span", { text: e.value || "Not shown" }), bad ? el("span", { cls: "tag", text: "doesn't match" }) : null])]);
  });
  return el("div", { cls: "ev" }, [el("p", { cls: "src", text: bname(f.bureau) + (rep.source && rep.source.report_date ? ", report of " + mdy(rep.source.report_date) : "") }), el("table", { cls: "evt" }, [el("tbody", null, rows)])]);
}
// A fact only the person can confirm, asked as a plain yes or no question.
function confirmBox(f, c) {
  const q = questionFor(f, c);
  return questionCard(Object.assign({ key: c.key, sentence: c.sentence }, q), null);
}
function findingView(d, label) {
  const g = d.byLabel.get(label);
  if (!g) return { title: "Finding", crumb: "Findings", body: [keyAnswer("What we'll do", "Not found", "This finding is no longer on your reports."), link("All findings", "#/findings")] };
  const f = g.members[0];
  const [act, sub] = recommended(g);
  const ids = g.members.filter((m) => OPEN_STATES.has(m.state) && m.confidence !== "needs_answer").map((m) => m.id);
  const acts = [];
  if (ids.length) { const n = letterCount(g); acts.push(link("Write " + (n === 1 ? "this letter" : "these " + n + " letters"), "#/letters/build?f=" + ids.join(","), { cls: "primary", icon: "letters", id: "start-letters" })); }
  if (g.state === "Printed") acts.push(link("Type the tracking numbers", "#/letters/build", { cls: "primary", icon: "certified" }));
  if (g.state === "Verified") acts.push(link("Write the follow-up letters", "#/letters/build", { cls: "primary", icon: "letters" }));
  if (g.state === "Reinserted") acts.push(link("Write the letter about it", "#/letters/new?f=" + g.members.map((m) => m.id).join(",") + "&kind=reinsertion_demand", { cls: "primary", icon: "letters" }));
  if (OPEN_STATES.has(g.state)) acts.push(btn("Not now", () => change(g.label + " set aside", (P) => { P.status = P.status || {}; for (const m of g.members) P.status[m.id] = "aside"; }), { icon: "x", icoCls: "ico sm" }));
  if (g.state === "Set aside") acts.push(btn("Reopen", () => change(g.label + " reopened", (P) => { for (const m of g.members) delete P.status[m.id]; }), { icon: "undo", icoCls: "ico sm" }));
  const confirms = [];
  const seenKeys = new Set();
  for (const m of g.members) for (const c of m.confirm || []) if (!seenKeys.has(c.key)) { seenKeys.add(c.key); confirms.push(confirmBox(m, c)); }
  const whats = g.members.map(plainWhat).filter((x, i, a) => x && a.indexOf(x) === i);
  const facts = g.members.flatMap((m) => m.facts).filter((x, i, a) => a.indexOf(x) === i);
  const clash = g.members.some((m) => m.evidence.some((e) => conflictRow(m, e)));
  const lender = f.then === "furnisher_623" && f.account_id && OPEN_STATES.has(g.state);
  const body = [card(plainTitle(g.rule, g.title), null, [
    el("p", { cls: "muted" }, [el("span", { cls: "fl", text: g.label }), " " + groupSubject(g) + ". On your " + g.bureaus.map(bname).join(", ") + " report" + (g.bureaus.length > 1 ? "s" : "") + "."]),
    el("section", { cls: "sec" }, [el("h4", { cls: "lbl", text: "What's wrong" })].concat(whats.map((x) => el("p", { cls: "lead", text: x })))),
    el("section", { cls: "sec" }, [keyAnswer("What we'll do", act, sub, acts, true),
      lender ? el("p", { cls: "muted small", text: "The lender is the company that reports this account to the bureaus. The law calls it the furnisher." }) : null]),
    confirms.length ? el("section", { cls: "sec" }, [el("h4", { cls: "lbl", text: confirms.length > 1 ? "Questions only you can answer" : "A question only you can answer" })].concat(confirms)) : null,
    el("section", { cls: "sec" }, [el("h4", { cls: "lbl", text: "What your report shows" }), clash ? el("p", { cls: "clashnote" }, [icon("mismatch", "ico sm"), " The tinted values don't match each other. Both can't be right."]) : null,
      el("div", { cls: "evidence" }, g.members.map(evidenceBlock))]),
    el("section", { cls: "sec" }, [el("h4", { cls: "lbl", text: "How sure we are" }), el("p", { cls: "row" }, [conf(g.conf), el("span", { text: g.rule === "medical_policy" ? "Based on the bureaus' own policy" : CONF_WORDS[g.confidence] })])]),
    everyBureau(d, g), g.members.some((m) => m.account_id) && g.rule !== "not_mine" && g.rule !== "identity_theft" ? notMineBlock(d, g) : null, aiExplainButton(f),
    facts.length ? el("details", { cls: "law" }, [el("summary", { text: "What the letter will say" }), el("div", { cls: "stack" }, facts.map((x) => el("p", { cls: "q", text: x })))]) : null,
    el("details", { cls: "law", id: "law" }, [el("summary", { text: "Why this works (the law)" }), el("p", { text: f.explain }), cites(f.legal)])], null, { cls: "card finding", id: "finding-detail" })];
  body.push(link("All findings", "#/findings", { cls: "quiet", icon: "chevron-left", icoCls: "ico sm" }));
  return { title: plainTitle(g.rule, g.title), crumb: "Findings / " + g.label, body };
}
// The same account at every bureau: which bureaus report it, where this problem was found, and
// where the account is reported without it (each bureau is disputed only with its own report).
function everyBureau(d, g) {
  const m = g.members.find((x) => x.account_id);
  const t = m ? d.sameAccount.get(m.account_id) : null;
  if (!t || t.bureaus.length < 2) return null;
  const found = new Set(g.members.map((x) => x.bureau));
  return el("section", { cls: "sec" }, [el("h4", { cls: "lbl", text: "Every bureau that reports this account" }),
    rowsList(t.bureaus.map((b) => el("li", null, [bu(b, !found.has(b)), el("span", { text: found.has(b) ? bname(b) + " has the same problem. It gets its own letter." : bname(b) + " reports the account without this problem, so it gets no letter about it." }), el("span")])))]);
}
// "Is this account yours?" Yes needs nothing. No opens the two statements only the person can make:
// not mine, and identity theft (which needs the FTC report; a false report is a federal crime).
function notMineBlock(d, g) {
  const P = d.P, facts = P.profile.facts || {};
  const m = g.members.find((x) => x.account_id);
  const key = "acct:" + m.account_id + ":not_mine", tkey = "acct:" + m.account_id + ":identity_theft";
  const t = d.sameAccount.get(m.account_id);
  const ids = t ? Object.values(t.ids) : [m.account_id];
  const setAll = (Q, kind, on) => { Q.profile.facts = Q.profile.facts || {}; for (const id of ids) { const k = "acct:" + id + ":" + kind; if (on) Q.profile.facts[k] = true; else delete Q.profile.facts[k]; } };
  const said = facts[key] === true || facts[tkey] === true;
  const open = said || (S.ui.notMine || {})[m.account_id];
  const ask = el("div", { cls: "row" }, [
    el("button", { type: "button", cls: "btn answer", "aria-pressed": !open ? "true" : "false", id: "mine-yes-" + m.account_id, on: { click: () => { S.ui.notMine = Object.assign({}, S.ui.notMine, { [m.account_id]: false }); if (said) change("Statement removed", (Q) => { setAll(Q, "not_mine", false); setAll(Q, "identity_theft", false); }); else render(); } } }, ["Yes, it's mine"]),
    el("button", { type: "button", cls: "btn answer", "aria-pressed": open ? "true" : "false", id: "mine-no-" + m.account_id, on: { click: () => { S.ui.notMine = Object.assign({}, S.ui.notMine, { [m.account_id]: true }); render(); } } }, ["No, I don't recognize it"])]);
  const kids = [el("h4", { cls: "lbl", text: "Is this account yours?" }), el("p", { cls: "muted small", text: "Most people answer yes. Answer no only if you never opened it or let anyone open it." }), ask];
  if (open) {
    const nm = el("input", { type: "checkbox", id: "nm-" + m.account_id, checked: facts[key] === true, on: { change: (e) => change(e.target.checked ? "Saved: you never opened this account" : "Removed that statement", (Q) => setAll(Q, "not_mine", e.target.checked)) } });
    const th = el("input", { type: "checkbox", id: "th-" + m.account_id, checked: facts[tkey] === true, on: { change: (e) => change(e.target.checked ? "Saved as identity theft" : "Removed that statement", (Q) => { setAll(Q, "identity_theft", e.target.checked); if (e.target.checked) Q.profile.facts["theft:confirmed"] = true; }) } });
    const ftc = input({ id: "ftc-" + m.account_id, value: P.profile.ftc_report || "", placeholder: "Report number from IdentityTheft.gov" });
    ftc.addEventListener("change", () => change("FTC report number saved", (Q) => { Q.profile.ftc_report = cleanName(ftc.value, 40); }, { quiet: true }));
    kids.push(note("warn", "alert", [el("p", { text: "Say this only if it is true. Telling a bureau an account is not yours when it is, is a false statement that federal law (15 U.S.C. 1679b) forbids." })]),
      el("label", { cls: "check" + (facts[key] === true ? " on" : ""), for: nm.id }, [nm, el("span", null, [el("b", { text: "I never opened this account and never let anyone open it." }), el("br"), el("span", { cls: "muted small", text: "The letter will say: “I did not open this account and never authorized anyone to open it.”" })])]),
      el("label", { cls: "check" + (facts[tkey] === true ? " on" : ""), for: th.id }, [th, el("span", null, [el("b", { text: "Someone used my identity to open it (identity theft)." }), el("br"), el("span", { cls: "muted small", text: "To block it you also need a report from IdentityTheft.gov. A false report is a federal crime (18 U.S.C. 1001)." })])]),
      field("Identity theft report number (from IdentityTheft.gov)", ftc),
      ids.length > 1 ? el("p", { cls: "muted small", text: "Your answer covers this account at every bureau that reports it: " + t.bureaus.map(bname).join(", ") + "." }) : null);
  }
  return el("section", { cls: "sec", id: "mine-" + m.account_id }, kids);
}
function honestView(d, i) {
  const h = d.honest[i];
  if (!h) return { title: "Looks accurate", crumb: "Findings", body: [keyAnswer("What we'll do", "Nothing", "Nothing here.")] };
  const a = d.merged.accounts.find((x) => x.id === h.account_id) || d.merged.accounts.find((x) => x.name === h.name) || {};
  const lates = (a.history || []).filter((x) => C.is_late(x.rating)).map((x) => x.rating + " days late in " + C.us_date(x.month));
  const bs = d.reports.filter((r) => r.accounts.some((x) => x.name === h.name)).map((r) => bname(r.bureau));
  return { title: "Looks accurate", crumb: "Findings / " + titleCase(h.name), body: [card(titleCase(h.name), "scale", [
    keyAnswer("What we'll do", h.kind === "goodwill" ? "Ask nicely, don't dispute" : "No dispute: time and on-time payments fix this", h.why, h.kind === "goodwill" ? [link("Draft a goodwill letter", "#/letters/new?kind=goodwill&account=" + encodeURIComponent(h.name), { cls: "primary", icon: "envelope" })] : null, true),
    el("div", { cls: "honest" }, [el("p", null, [el("b", { text: titleCase(h.name) + (lates.length ? ", " + lates.join(", ") : "") + (bs.length ? ", on " + bs.join(", ") : "") + "." }), " This looks correct. Disputing something true is not allowed and tends to backfire, so " + C.PRODUCT_NAME + " will not write that letter."])]),
    el("p", { text: h.kind === "goodwill" ? "Better: a goodwill letter asking the lender to remove it as a favor, and time. It matters less each year" + (a.removal ? "; it leaves your reports in " + C.us_date(a.removal) + "." : ".") : "It fades with time and on-time payments" + (a.removal ? " and should leave your reports by " + C.us_date(a.removal) + "." : ".") }),
    el("details", { cls: "law" }, [el("summary", { text: "Why this works (the law)" }), cites((h.cite || []).concat(["croa1679b"]))])])] };
}

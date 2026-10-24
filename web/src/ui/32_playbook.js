// ---------------------------------------------------------------- playbook: the 90-day plan, and auto loan or mortgage soon
function stepDone(d, s) {
  const P = d.P, done = P.done || {};
  if (done[stepKey(s)]) return done[stepKey(s)];
  if (s.kind === "playbook" && s.id === "pull" && d.round) return "Done " + md(d.round.date);
  if (s.kind === "playbook" && s.id === "scores" && (P.scores || []).length) return "Done " + md(P.scores.map((x) => x.date).sort()[0]);
  if (s.kind === "letter" && s.findings.length && s.findings.every((id) => { const f = d.byId.get(id); return f && !OPEN_STATES.has(f.state); })) return "Sent";
  if (s.kind === "letter" && !s.findings.length && (P.mail || []).some((m) => m.letter === s.letter && m.account_id === s.account_id)) return "Sent";
  return "";
}
function stepKey(s) { return s.kind === "letter" ? "letter:" + s.letter + ":" + s.findings.join(",") + ":" + s.account_id : s.kind + ":" + (s.id || s.title); }
function phaseRange(p) { const m = /^(\d+) to (\d+)$/.exec(p.days || ""); return m ? [Number(m[1]), Number(m[2])] : null; }
function modeToggle(d, where) {
  const on = d.P.goal === "auto_soon";
  return el("div", { cls: "mode" + (on ? " on" : "") }, [icon(on ? "car" : "house"), el("div", null, [el("b", { text: "Auto loan or mortgage soon" })]),
    sw(on, "Auto loan or mortgage soon", (v) => change(v ? "Auto loan or mortgage soon is on" : "Back to the standard plan", (P) => { P.goal = v ? "auto_soon" : "standard"; }), { id: "mode-" + where }),
    el("span", { cls: "d", text: on ? "On: a lender will pull your credit soon. Fast score levers move to the top; the full plan is kept below." : where === "score" ? "Off. When on, this plan moves to the top of the Playbook with the rate-shopping window and which bureau each lender usually pulls." : "Off. Turn on when a lender will pull your credit within 90 days; the plan reorders toward fast levers." })]);
}
function taskRow(d, s) {
  const st = stepDone(d, s);
  const kids = [icon(st ? "removed" : "dispute", "ico " + (st ? "ok" : "todo"))];
  const title = s.kind === "letter" ? el("a", { href: "#/letters/new?step=" + s.order + "&goal=" + (d.P.goal || "standard"), text: stepTitle(s.title) }) : s.kind === "answers" ? el("a", { href: "#/findings?state=answers", text: s.title }) : el("span", { text: stepTitle(s.title) });
  kids.push(title);
  if (s.kind === "playbook" || s.kind === "auto" || s.kind === "note") {
    kids.push(btn(st ? "Undo" : "Done", () => change(st ? "Marked not done" : "Marked done", (P) => { P.done = P.done || {}; if (st) delete P.done[stepKey(s)]; else P.done[stepKey(s)] = "Done " + md(d.today); }, { quiet: true }), { cls: "sm quiet", aria: (st ? "Mark not done: " : "Mark done: ") + s.title }));
  } else kids.push(el("span"));
  const sub = [];
  if (st) sub.push(st);
  if (s.why && s.kind !== "playbook") sub.push(s.why);
  if (sub.length) kids.push(el("span", { cls: "sub", text: sub.join(". ").replace(/\.\./g, ".") }));
  if (s.moved_from) kids.push(el("span", { cls: "moved", text: "Moved up from step " + s.moved_from + "." }));
  return el("li", null, kids);
}
VIEWS.playbook = (d) => {
  const P = d.P, auto = P.goal === "auto_soon";
  const plan = auto ? d.auto : d.plan;
  const day = Math.max(0, d.day);
  let nowIdx = -1;
  plan.phases.forEach((p, i) => { const r = phaseRange(p); if (r && r[0] <= day) nowIdx = i; });
  if (auto) nowIdx = 0;
  const phases = el("ol", { cls: "phases" }, plan.phases.map((p, i) => {
    const r = phaseRange(p);
    const done = !auto && r && r[1] < day && i !== nowIdx;
    return el("li", { cls: "phase" + (done ? " done" : ""), "aria-current": i === nowIdx ? "step" : null }, [el("div", { cls: "when" }, [r ? "Days " + p.days : p.id === "auto" ? "Now" : p.days, el("b", { text: p.title.replace("Auto loan or mortgage soon: ", "") })]),
      p.steps.length ? el("ul", { cls: "tasks" }, p.steps.map((s) => taskRow(d, s))) : el("p", { cls: "muted", text: "Nothing in this phase for your reports." })]);
  }));
  const marks = [0, 10, 30, 45, 60, 75].map((x) => el("span", { style: "left:" + ((x / 90) * 100).toFixed(1) + "%", text: String(x) }));
  const where = card("Where you are", "calendar", [el("div", { cls: "daybar", role: "img", "aria-label": "Day " + day + " of 90" }, [el("i", { style: "width:" + Math.min(100, (day / 90) * 100).toFixed(1) + "%" })].concat(marks)),
    el("p", { cls: "muted small", text: P.start ? "Day 0 was your first import on " + md(P.start) + ". Steps are ordered by legal strength and speed; anything you skip stays here." : "Day 0 starts with your first import." })]);
  let k;
  const u = d.util10;
  const payBy = u ? u.cards.filter((c) => c.pay > 0).map((c) => c.pay_by).sort() : [];
  if (auto) k = keyAnswer("Playbook day", payBy.length ? "Pay by " + md(payBy[payBy.length - 1]) : "Day " + day + " of 90", payBy.length ? "Fastest lever before a loan: reported card balances. " + plural(payBy.length, "payment") + ", each before its statement closes." : "Add your cards in Score plan to get the amounts and dates.");
  else {
    const now = plan.phases[nowIdx];
    k = keyAnswer("Playbook day", "Day " + day + " of 90", now ? now.title + ": " + now.steps.filter((s) => !stepDone(d, s)).slice(0, 2).map((s) => s.title.replace(/\.$/, "").toLowerCase()).join("; ") + "." : "Import your reports to start.");
  }
  const body = [el("div", { cls: "cols" }, [el("div", { cls: "stack" }, [k, modeToggle(d, "playbook")]), where])];
  if (auto) {
    body.push(card("Which bureau a lender usually pulls", "bureau", [el("div", { cls: "pulls" }, [
      el("div", null, [icon("house"), el("b", { text: "Mortgage" }), el("span", { cls: "p-d", text: "All three bureaus, and the middle score is commonly used. Ask which model: FICO 2, 4 and 5, or VantageScore 4.0." }), el("span"), el("span", { cls: "p-d" }, [cite("freddie_models")])]),
      el("div", null, [icon("car"), el("b", { text: "Auto loan" }), el("span", { cls: "p-d", text: "Often one bureau, which varies by lender and region. Auto lenders commonly use FICO Auto Scores; ask the lender which bureau and which score." }), el("span"), el("span", { cls: "p-d" }, [el("span", { cls: "lbl-conf", text: "Varies, ask" })])]),
      el("div", null, [icon("card"), el("b", { text: "Credit card" }), el("span", { cls: "p-d", text: "Varies by issuer. FICO 8 and bankcard scores are common." }), el("span"), el("span", { cls: "p-d" }, [cite("fico_versions")])])]),
    el("p", { cls: "muted small", text: "For a mortgage, ask the loan officer about a rapid rescore after a correction or paydown. The Vault exports the packet: the change, the proof and the bureau." })]));
    const ex = plan.expect;
    if (ex) body.push(expectCard(ex, d));
  }
  body.push(phases, footer());
  return { title: "Playbook" + (auto ? ": loan soon" : ""), crumb: crumbOf("90-day plan"), body };
};
// The honest panel: what to expect at this score. Ranges from public facts, never one number.
function expectCard(ex, d) {
  const latest = ex.scores.map((s) => s.model + " " + s.value + " (" + mdy(s.date) + ")").join(", ");
  const sc = ex.ranges.scenarios.slice(0, 4).map((s) => el("li", null, [icon("range", "ico sm"), el("span", { text: s.title }), el("span", { cls: "num", text: rangeText(s.families.fico8) }), el("span", { cls: "sub", text: s.label + ". " + s.basis })]));
  return card("What to expect at this score", "scale", [el("p", { text: latest ? "Your latest scores: " + latest + "." : "Add the scores your apps show to see this against your own numbers." }),
    el("ul", { cls: "rows" }, sc), el("div", { cls: "honest" }, ex.lines.map((l) => el("p", { text: l }))), cites(ex.cite)], "ranges, not promises");
}
function rangeText(b) { if (!b) return ""; const f = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v); return b.low === b.high ? (b.low === 0 ? "no change" : f(b.low)) : f(b.low) + " to " + f(b.high); }

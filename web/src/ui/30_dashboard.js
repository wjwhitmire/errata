// ---------------------------------------------------------------- dashboard
function svgEl(tag, attrs, kids) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k of Object.keys(attrs || {})) e.setAttribute(k, String(attrs[k]));
  for (const k of kids || []) e.append(typeof k === "string" ? document.createTextNode(k) : k);
  return e;
}
// Scores the person entered, one line per model, labeled directly. the app never pulls a score.
function scoreChart(scores) {
  const models = Array.from(new Set(scores.map((s) => s.model)));
  const months = Array.from(new Set(scores.map((s) => s.date.slice(0, 7)))).sort();
  if (!months.length) return el("p", { cls: "muted", text: "No scores entered yet. Add the scores your bank or card apps show, with the model each one names." });
  const vals = scores.map((s) => s.value);
  const lo = Math.floor((Math.min.apply(null, vals) - 10) / 20) * 20, hi = Math.ceil((Math.max.apply(null, vals) + 10) / 20) * 20;
  const W = 380, H = 220, l = 34, r = 92, t = 14, b = 26;
  const x = (m) => l + (months.length === 1 ? (W - l - r) / 2 : (months.indexOf(m) * (W - l - r)) / (months.length - 1));
  const y = (v) => t + ((hi - v) * (H - t - b)) / (hi - lo || 1);
  const kids = [];
  for (let v = lo; v <= hi; v += 20) kids.push(svgEl("line", { x1: l, x2: W - r, y1: y(v).toFixed(1), y2: y(v).toFixed(1), stroke: "var(--chart-grid)" }), svgEl("text", { x: l - 8, y: (y(v) + 4).toFixed(1), "text-anchor": "end" }, [String(v)]));
  months.forEach((m) => kids.push(svgEl("text", { x: x(m).toFixed(1), y: H - 8, "text-anchor": "middle" }, [m.slice(5, 7) + "/" + m.slice(2, 4)])));
  const cols = ["--chart-1", "--chart-4", "--chart-3"];
  models.slice(0, 3).forEach((mod, i) => {
    const pts = scores.filter((s) => s.model === mod).sort((a, b2) => a.date.localeCompare(b2.date));
    const col = "var(" + cols[i] + ")";
    kids.push(svgEl("path", { d: "M" + pts.map((p) => x(p.date.slice(0, 7)).toFixed(1) + " " + y(p.value).toFixed(1)).join(" L"), fill: "none", stroke: col, "stroke-width": 2.25, "stroke-dasharray": i === 1 ? "6 4" : i === 2 ? "2 3" : "none" }));
    for (const p of pts) {
      const cx = x(p.date.slice(0, 7)), cy = y(p.value);
      kids.push(i === 1 ? svgEl("rect", { x: (cx - 4.5).toFixed(1), y: (cy - 4.5).toFixed(1), width: 9, height: 9, fill: col, stroke: "var(--surface)", "stroke-width": 2 })
        : svgEl("circle", { cx: cx.toFixed(1), cy: cy.toFixed(1), r: 4.5, fill: col, stroke: "var(--surface)", "stroke-width": 2 }));
    }
    const last = pts[pts.length - 1];
    const lx = x(last.date.slice(0, 7)) + 10, ly = y(last.value) + i * 4;
    kids.push(svgEl("text", { x: lx.toFixed(1), y: (ly - 2).toFixed(1), style: "fill:var(--fg)" }, [mod.replace("VantageScore", "Vantage")]), svgEl("text", { x: lx.toFixed(1), y: (ly + 11).toFixed(1) }, [String(last.value)]));
  });
  const label = "Scores you entered: " + models.map((m) => { const p = scores.filter((s) => s.model === m).map((s) => s.value); return m + " from " + p[0] + " to " + p[p.length - 1]; }).join(", ");
  return svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": label }, kids);
}
VIEWS.dashboard = (d) => {
  const P = d.P, na = d.next;
  const acts = [link({ overdue: "Build the follow-up letter", answer: "Answer now", ready: "Build my letters", mail: "Type the tracking numbers" }[na.kind] || "Open", na.href, { cls: "primary", icon: "letters", id: "next-go" })];
  if (na.kind === "overdue") acts.push(link("Why this is next", "#/tracker", { cls: "quiet" }));
  const k = keyAnswer("Next action", na.title, na.sub, acts, true);
  // next actions in order: overdue follow-ups, questions, the plan's letters, payments, deliveries
  const list = [];
  for (const m of d.overdue) list.push(["Follow up with " + m.to, "The " + (REPLY_NOUN[m.letter] || "reply") + " was due " + mdy(m.due) + ". The follow-up letter is already written.", "#/letters/build"]);
  const printedN = d.mail.filter((m) => m.state === "Printed").length;
  if (printedN) list.push(["Mail " + plural(printedN, "printed letter") + " and type the tracking numbers", "The legal clock starts when they receive it.", "#/letters/build"]);
  if (d.buildCount && d.next.kind !== "ready") list.push(["Build my letters (" + d.buildCount + " ready)", "Every letter written, addressed and in order.", "#/letters/build"]);
  const qn = pendingQuestions(d).length;
  if (qn) list.push(["Answer " + plural(qn, "yes or no question"), "Only you know these facts. Each answer updates your letters.", "#/letters/build"]);
  if (d.util10 && d.util10.total_pay > 0) {
    const c = d.util10.cards.filter((x) => x.pay > 0).sort((a, b) => a.pay_by.localeCompare(b.pay_by))[0];
    if (c) list.push(["Pay " + titleCase(c.name) + " " + money(c.pay) + " by " + md(c.pay_by), "Before its statement closes, so the lower balance is reported.", "#/score"]);
  }
  for (const m of d.mail.filter((x) => x.state === "In transit")) list.push(["Log the " + m.to + " delivery date", "The legal clock starts when they receive it.", "#/letters/mail"]);
  for (const h of d.honest.filter((x) => x.kind === "goodwill").slice(0, 1)) list.push(["Send the " + titleCase(h.name) + " goodwill letter", "The late payment looks accurate, so this is a request, not a dispute.", "#/letters/new?kind=goodwill&account=" + encodeURIComponent(h.name)]);
  const nextCard = card("Next actions, in order", "findings", [list.length ? el("ol", { cls: "rows", style: "list-style:none" }, list.slice(0, 6).map(([a, b2, h], i) => el("li", null, [el("span", { cls: "ix", text: String(i + 1).padStart(2, "0") }),
    el("a", { href: h, cls: "t1", text: a }), icon("chevron-right", "ico sm"), b2 ? el("span", { cls: "sub", text: b2 }) : null]))) : el("p", { cls: "muted", text: "Nothing waiting. Import a new report to check again." })], "by legal strength and speed");
  const open = d.mail.filter((m) => m.mailed && !m.outcome);
  const dl = card("Open disputes and deadlines", "hourglass", [table(["Recipient", "Deadline"], open.map((m) => ({ cells: [[el("b", { text: m.to }), el("br"), el("span", { cls: "muted", text: C.TABLES.letters[m.letter].title.split(" (")[0] })],
    dbar(m.due, m.delivered, d.today)] })), { empty: "No open disputes." })]);
  const removedCard = card("Items removed", "removed", [el("div", { cls: "stat" }, [el("span", { cls: "v" }, [String(d.removed.length), el("span", { cls: "muted", style: "font-size:18px", text: " of " + d.disputed + " disputed" })]),
    el("span", { cls: "l", text: d.corrected + " corrected, " + d.reinserted + " reinserted and challenged" })]),
  rowsList(d.removed.slice(0, 6).map((x) => el("li", { cls: "gone" }, [bu(x.bureau), el("span", { cls: "nm", text: titleCase(x.name) + (x.kind !== "account" ? " (" + x.kind + ")" : "") }), el("span", { cls: "stamp" }, [icon("removed"), "Removed"])])))],
  P.start ? "since " + md(P.start) : "");
  const u = d.util10;
  const utilCard = u ? card("Card utilization", "percent", [el("div", { cls: "stat" }, [el("span", { cls: "v", text: u.overall_before + "%" }), el("span", { cls: "l", text: money(u.cards.reduce((s, c) => s + c.balance, 0)) + " of " + money(u.cards.reduce((s, c) => s + c.limit, 0)) + " reported" })]),
    el("div", { cls: "utilbar", role: "img", "aria-label": "Now " + u.overall_before + " percent, plan " + u.overall_after + " percent" }, [el("i", { style: "width:" + Math.min(100, u.overall_before) + "%" }), el("b", { style: "width:" + Math.min(100, u.overall_after) + "%" }), el("s", { style: "left:30%" })]),
    el("p", { cls: "muted small", text: "Plan: " + u.overall_after + "% by " + md(u.cards.map((c) => c.pay_by).sort().slice(-1)[0]) + ". The tick marks 30%." })]) : null;
  const scores = card("Scores you entered", "score", [scoreChart(P.scores || []), el("p", { cls: "muted small", text: "From your bank and card apps, with the model each one names. " + C.PRODUCT_NAME + " never pulls your credit." }), link("Add a score", "#/score", { cls: "quiet" })], null, { cls: "card chart" });
  const report = card("Progress report", "packet", [el("p", { cls: "muted small", text: "One page with what came off, what is in dispute and when each answer is due, what waits for you, and the scores you entered. Made on this device." }),
    btn("Download the progress report (PDF)", () => download("progress-" + d.today + ".pdf", C.pdf_doc([progressReport(d)]), "application/pdf"), { cls: "sm", icon: "download", id: "progress-pdf" })]);
  return { title: "Dashboard", crumb: crumbOf(d.round ? d.round.label : "No reports yet"), body: [el("div", { cls: "cols" }, [el("div", { cls: "stack" }, [k, nextCard, dl]), el("div", { cls: "stack" }, [removedCard, utilCard, scores, report])])] };
};
// The progress report: paragraphs for the core's PDF writer, every line computed from the record.
function progressReport(d) {
  const P = d.P, out = [["Progress report for " + P.name, "title"], ["Made " + longDate(d.today) + " on this device. Information, not legal advice.", "plain"]];
  out.push(["Removed", "head"]);
  if (d.removed.length) for (const x of d.removed) out.push([bname(x.bureau) + ": " + titleCase(x.name) + (x.kind !== "account" ? " (" + x.kind + ")" : ""), "bullet"]);
  else out.push(["Nothing removed yet.", "plain"]);
  out.push([d.removed.length + " removed, " + d.corrected + " corrected, " + d.reinserted + " reinserted and challenged, of " + d.disputed + " findings disputed.", "plain"]);
  out.push(["In dispute", "head"]);
  const open = d.mail.filter((m) => m.mailed && !m.outcome);
  if (open.length) for (const m of open) out.push([m.to + ": " + C.TABLES.letters[m.letter].title.split(" (")[0] + ", mailed " + mdy(m.mailed) + (m.delivered ? ", delivered " + mdy(m.delivered) : ", delivery not logged") + (m.due ? ", answer due " + mdy(m.due) : "") + (m.state === "Overdue" ? " (overdue)" : ""), "bullet"]);
  else out.push(["No open disputes.", "plain"]);
  out.push(["Waiting for you", "head"]);
  out.push([d.answers.length ? plural(d.answers.length, "question") + " only you can answer." : "No questions waiting.", "plain"]);
  out.push([d.ready.length ? plural(d.ready.length, "finding is", "findings are") + " ready to dispute." : "Nothing new to dispute.", "plain"]);
  const offers = (P.offers || []).filter((o) => !o.paid && o.response !== "refused");
  if (offers.length) out.push([plural(offers.length, "goodwill request or offer is", "goodwill requests or offers are") + " open; none is paid before a signed agreement.", "plain"]);
  out.push(["Scores you entered", "head"]);
  const sc = (P.scores || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  if (sc.length) for (const s of sc) out.push([mdy(s.date) + ": " + s.model + " " + s.value + (s.source ? " (" + s.source + ")" : ""), "bullet"]);
  else out.push(["No scores entered.", "plain"]);
  if (d.util10) out.push(["Cards report " + d.util10.overall_before + "% of their limits; the plan is " + d.util10.overall_after + "%.", "plain"]);
  out.push([C.SUITE_LINE, "plain"]);
  return out;
}

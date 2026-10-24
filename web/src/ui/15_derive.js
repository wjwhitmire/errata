// ---------------------------------------------------------------- what the screens show, computed from the record
// Everything here is recomputed from the person's record by the core (findings, the three-bureau
// compare, the round diff, the plan, deadlines, utilization and the score ranges). Nothing on a
// screen is typed in by hand; the record holds only what the person imported, confirmed or logged.
let D = null;
const OPEN_STATES = new Set(["Ready", "Needs answer"]);
const FIELD_KIND = { balance: "money", credit_limit: "money", high_balance: "money", past_due: "money", monthly_payment: "money",
  opened: "date", closed: "date", paid: "date", updated: "date", last_payment: "date", dofd: "month", removal: "month" };
const FIELD_LABEL = { balance: "Balance", credit_limit: "Credit limit", high_balance: "High balance", past_due: "Past due", monthly_payment: "Monthly payment",
  opened: "Date opened", closed: "Date closed", paid: "Date paid", updated: "Last reported", last_payment: "Last payment", dofd: "Date the trouble started (first delinquency)",
  removal: "Estimated removal", original_creditor: "Original creditor", pay_status: "Pay status", name: "Creditor", number: "Account number" };
function fieldValue(field, text) {
  const k = FIELD_KIND[field];
  if (k === "money") return C.parse_money(text);
  if (k === "date") return C.parse_date(text) || "";
  if (k === "month") return C.parse_month(text) || "";
  return C.norm_space(text);
}
function fieldText(field, v) {
  const k = FIELD_KIND[field];
  if (v === null || v === undefined || v === "") return "";
  if (k === "money") return money(v);
  if (k === "date") return mdy(v);
  if (k === "month") return C.us_date(v);
  return String(v);
}
function reportKey(round, r) { return round.id + ":" + r.bureau; }
// Fields the reader was unsure of, with the person's confirmations and corrections applied.
function checksFor(P, round, r) {
  const fixes = (P.corrections || {})[reportKey(round, r)] || {};
  return (r.warnings || []).filter((w) => w.field).map((w, i) => {
    const k = w.account + "|" + w.field;
    return Object.assign({ key: k, i }, w, { fixed: Object.prototype.hasOwnProperty.call(fixes, k), fixedValue: fixes[k] });
  });
}
function applyFixes(P, round, r) {
  const fixes = (P.corrections || {})[reportKey(round, r)] || {};
  if (!Object.keys(fixes).length) return r;
  const out = JSON.parse(JSON.stringify(r));
  for (const k of Object.keys(fixes)) {
    const [name, field] = k.split("|");
    const a = out.accounts.find((x) => x.name === name);
    if (!a) continue;
    a[field] = fieldValue(field, fixes[k]);
    const cf = C.classify(a);
    a.kind = cf[0]; a.flags = cf[1];
  }
  return out;
}
function mergedReport(reports) {
  const r = C.new_report("unknown");
  const seen = new Set();
  for (const x of reports) {
    for (const a of x.accounts) { const k = C.norm_name(a.name); if (seen.has(k)) continue; seen.add(k); r.accounts.push(a); }
    r.inquiries = r.inquiries.concat(x.inquiries);
  }
  r.source.report_date = reports.length ? reports[0].source.report_date : "";
  return r;
}
function mailDeletedKeys(P, bureau) {
  return (P.mail || []).filter((m) => m.bureau === bureau).flatMap((m) => (m.results || []).filter((x) => x.outcome === "deleted").map((x) => x.key));
}
function roundFindings(P, round, as_of, prevRound) {
  const reports = round.reports.map((r) => applyFixes(P, round, r));
  const disputes = (P.mail || []).filter((m) => ["furnisher_623", "dispute_notation"].includes(m.letter) && m.delivered && m.account_id)
    .map((m) => ({ kind: "furnisher", account_id: m.account_id, delivered: m.delivered }));
  let fs = [];
  for (const r of reports) fs = fs.concat(C.find(r, { as_of, profile: P.profile, disputes }));
  // one bureau's report still gets its account list, so each account's payment grid and its
  // correction form are reachable; differences need two
  const cmp = reports.length ? C.compare_bureaus(reports) : { groups: [], differences: 0, timing: 0, findings: [] };
  fs = fs.concat(cmp.findings.map((f) => Object.assign(f, { explain: C.explain(f) })));
  const diffs = {};
  if (prevRound) {
    for (const r of reports) {
      const old = prevRound.reports.find((x) => x.bureau === r.bureau);
      if (!old) continue;
      const earlier = P.rounds.slice(0, P.rounds.indexOf(prevRound)).map((rd) => rd.reports.find((x) => x.bureau === r.bureau)).filter(Boolean);
      const d = C.diff_rounds(applyFixes(P, prevRound, old), r, { deleted_keys: mailDeletedKeys(P, r.bureau), earlier, notices: P.notices || {} });
      diffs[r.bureau] = d;
      fs = fs.concat(d.findings.map((f) => Object.assign(f, { explain: C.explain(f) })));
    }
  }
  return { reports, findings: fs, compare: cmp, diffs };
}
function derive() {
  const td = today();
  if (D && D.ver === S.ver && D.cur === S.cur && D.today === td) return D;
  const P = S.data;
  const out = { ver: S.ver, cur: S.cur, today: td, P };
  D = out;
  const rounds = P.rounds || [];
  out.round = rounds.length ? rounds[rounds.length - 1] : null;
  out.prev = rounds.length > 1 ? rounds[rounds.length - 2] : null;
  const R = rounds.map((rd, i) => roundFindings(P, rd, i === rounds.length - 1 ? td : rd.date, i ? rounds[i - 1] : null));
  const cur = R.length ? R[R.length - 1] : { reports: [], findings: [], compare: { groups: [], differences: 0, timing: 0, findings: [] }, diffs: {} };
  out.reports = cur.reports.slice().sort((a, b) => BUREAU_ORDER.indexOf(a.bureau) - BUREAU_ORDER.indexOf(b.bureau));
  out.compare = cur.compare;
  out.diffs = cur.diffs;
  out.checks = out.round ? out.round.reports.map((r) => ({ report: r, items: checksFor(P, out.round, r) })) : [];
  out.toCheck = out.checks.reduce((n, c) => n + c.items.filter((x) => !x.fixed).length, 0);
  // findings across rounds: the latest round's version wins; an earlier one that is gone was removed
  const byId = new Map(), firstSeen = new Map();
  R.forEach((rf, i) => rf.findings.forEach((f) => { if (!firstSeen.has(f.id)) firstSeen.set(f.id, i); }));
  R.slice(0, -1).forEach((rf) => rf.findings.forEach((f) => byId.set(f.id, Object.assign({}, f, { current: false }))));
  cur.findings.forEach((f) => byId.set(f.id, Object.assign({}, f, { current: true })));
  const mailOf = new Map();
  for (const m of P.mail || []) for (const id of m.findings || []) { if (!mailOf.has(id)) mailOf.set(id, []); mailOf.get(id).push(m); }
  const acctKey = new Map();
  for (const rf of R) for (const r of rf.reports) for (const a of r.accounts) acctKey.set(a.id, C.account_key(a));
  const all = [];
  for (const f of byId.values()) {
    const mm = (mailOf.get(f.id) || []).slice().sort((a, b) => String(a.mailed).localeCompare(String(b.mailed)));
    const ms = mm.filter((m) => m.mailed);
    const last = ms.length ? ms[ms.length - 1] : null;
    const printed = mm.some((m) => !m.mailed && !m.outcome);
    let st;
    const res = last && last.results ? last.results.find((x) => x.key === acctKey.get(f.account_id)) : null;
    if ((P.status || {})[f.id] === "aside") st = "Set aside";
    else if (!f.current) st = "Removed";
    else if (last && !last.outcome) st = "In dispute";
    else if (printed) st = "Printed";
    else if (f.rule === "reinserted") st = "Reinserted";
    else if (res && res.outcome === "verified") st = "Verified";
    else if (res && res.outcome === "updated") st = "Updated";
    else if (f.confidence === "needs_answer") st = "Needs answer";
    else st = "Ready";
    all.push(Object.assign(f, { state: st, mail: ms, first: firstSeen.get(f.id) || 0 }));
  }
  // group the same issue across bureaus into one row; label in a stable order
  const groups = new Map();
  // labels stay put when an answer or a letter changes a finding's state or confidence
  const order = all.slice().sort((a, b) => a.first - b.first || (b.impact - a.impact) || a.subject.localeCompare(b.subject) || BUREAU_ORDER.indexOf(a.bureau) - BUREAU_ORDER.indexOf(b.bureau) || a.id.localeCompare(b.id));
  for (const f of order) {
    const k = f.rule + "|" + C.norm_name(f.subject.replace(/\s+\S*\d\S*$/, ""));
    if (!groups.has(k)) groups.set(k, { key: k, rule: f.rule, title: f.title, subject: f.subject, members: [] });
    groups.get(k).members.push(f);
  }
  const RANK = ["Reinserted", "Needs answer", "Ready", "Printed", "In dispute", "Verified", "Updated", "Set aside", "Removed"];
  out.groups = Array.from(groups.values());
  out.groups.forEach((g, i) => {
    g.label = "F-" + String(i + 1).padStart(2, "0");
    g.bureaus = Array.from(new Set(g.members.map((f) => f.bureau))).sort((a, b) => BUREAU_ORDER.indexOf(a) - BUREAU_ORDER.indexOf(b));
    g.state = g.members.map((f) => f.state).sort((a, b) => RANK.indexOf(a) - RANK.indexOf(b))[0];
    g.conf = Math.max.apply(null, g.members.map((f) => CONF_PCT[f.confidence]));
    g.confidence = g.members.map((f) => f.confidence).sort((a, b) => confN({ confidence: a }) - confN({ confidence: b }))[0];
    g.strength = g.confidence === "high" ? "Strong" : g.confidence === "medium" ? "Moderate" : g.confidence === "needs_answer" ? "Your answer" : "Weak";
    if (g.rule === "medical_policy") g.strength = "Bureau policy";
    g.current = g.members.some((f) => f.current);
    for (const f of g.members) f.group = g;
  });
  out.findings = all;
  out.byId = new Map(all.map((f) => [f.id, f]));
  // the same account across bureaus, with each bureau's own findings (dispute every bureau that reports it)
  out.tradelines = out.reports.length ? C.tradelines(out.reports, all.filter((f) => f.current && f.account_id)) : [];
  out.sameAccount = new Map();
  for (const t of out.reports.length ? C.tradelines(out.reports, out.reports.flatMap((r) => r.accounts.map((a) => ({ id: "x-" + a.id, account_id: a.id, bureau: r.bureau, rule: "_" })))) : []) {
    const ids = Object.values(t.ids);
    for (const id of ids) out.sameAccount.set(id, t);
  }
  out.byLabel = new Map(out.groups.map((g) => [g.label, g]));
  out.ready = out.groups.filter((g) => g.state === "Ready");
  out.answers = out.groups.filter((g) => g.state === "Needs answer");
  // accurate items: no dispute, the honest panel
  const merged = mergedReport(out.reports);
  out.merged = merged;
  const openF = all.filter((f) => f.current && OPEN_STATES.has(f.state));
  const cand = C.candidates(merged, all.filter((f) => f.current));
  out.honest = cand.goodwill.map((g) => Object.assign({ kind: "goodwill" }, g)).concat(cand.leave_alone.map((g) => Object.assign({ kind: "leave" }, g)));
  out.pfd = cand.pay_for_delete;
  // cards and the paydown plan
  out.cards = (P.cards && P.cards.length) ? P.cards : C.cards_from_report(merged);
  out.util10 = out.cards.length ? C.utilization(out.cards, null, 10, false, td) : null;
  out.util30 = out.cards.length ? C.utilization(out.cards, null, 30, false, td) : null;
  out.azeo = out.cards.length ? C.utilization(out.cards, null, 10, true, td) : null;
  out.sim = C.simulate(merged, openF, out.cards, td);
  // the person's own scores, each with what changed since that model's last one, narrow the ranges
  out.cal = C.calibrate(out.sim, (P.scores || []).map((s) => ({ model: s.model, score: s.value, date: s.date, change: s.change || "" })));
  out.plan = mergedPlan(P, out, "standard");
  out.auto = mergedPlan(P, out, "auto_soon");
  // mail log, deadlines and the ladder
  out.mail = (P.mail || []).map((m) => {
    const ds = C.mail_deadlines(m);
    const step = C.next_step(m, td);
    const main = ds.length ? ds[0] : null;
    let st = m.outcome ? "Results in" : !m.mailed ? "Printed" : !m.delivered ? "In transit" : main && C.days_between(td, main.due) < 0 ? "Overdue" : main && C.days_between(td, main.due) <= 10 ? "Deadline near" : "Waiting";
    return Object.assign({}, m, { deadlines: ds, due: main ? main.due : "", earliest: main ? main.earliest : "", step, state: st });
  });
  out.reminders = C.reminders(P.mail || [], td, 10);
  out.overdue = out.mail.filter((m) => m.state === "Overdue");
  // removed items: deletions between consecutive rounds, plus personal items removed
  out.removed = [];
  R.forEach((rf) => {
    for (const b of Object.keys(rf.diffs)) {
      for (const x of rf.diffs[b].deleted) out.removed.push({ bureau: b, name: x.name, kind: "account", key: x.key });
      for (const p of rf.diffs[b].personal.removed) out.removed.push({ bureau: b, name: p.replace(/^[a-z]+:/, ""), kind: p.split(":")[0] });
    }
  });
  out.disputed = new Set((P.mail || []).flatMap((m) => (m.findings || []).map((id) => (out.byId.get(id) || {}).group).filter(Boolean).map((g) => g.label))).size;
  out.corrected = (P.mail || []).reduce((n, m) => n + (m.results || []).filter((x) => x.outcome === "updated").length, 0);
  out.reinserted = Object.values(cur.diffs).reduce((n, df) => n + df.reinserted.length, 0);
  out.day = P.start ? C.days_between(P.start, td) : 0;
  out.buildCount = 0;
  if (out.ready.length || out.overdue.length || out.groups.some((g) => g.state === "Verified" && g.current)) {
    try { out.buildCount = buildSet(out, null).length; } catch (e) { out.buildCount = out.ready.length; }
  }
  out.next = nextAction(out);
  return out;
}
function confN(f) { return { high: 0, medium: 1, low: 2, needs_answer: 3 }[f.confidence]; }

// One plan across the bureaus: the core plans each bureau's report; the steps are merged in phase
// order, playbook steps once, letter steps per bureau (each letter goes to one bureau).
function planInput(out, r) {
  return out.findings.filter((f) => f.current && f.bureau === r.bureau).map((f) => Object.assign({}, f, { status: OPEN_STATES.has(f.state) ? "open" : "done", group: undefined }));
}
function stepSig(s) { return s.kind === "letter" ? (s.findings.length ? s.letter + "|" + s.findings.join(",") + "|" + s.account_id : s.letter + "|" + s.title) : s.kind + "|" + s.title; }
function mergedPlan(P, out, goal) {
  const parts = out.reports.map((r) => C.plan(r, planInput(out, r), P.profile, goal, out.today, out.cards, P.scores || []));
  if (!parts.length) parts.push(C.plan(C.new_report("unknown"), [], P.profile, goal, out.today, out.cards, P.scores || []));
  const base = JSON.parse(JSON.stringify(parts[0]));
  const seen = new Set();
  for (const ph of base.phases) {
    let steps = [];
    let answers = null;
    parts.forEach((part, pi) => {
      const q = part.phases.find((x) => x.id === ph.id);
      if (!q) return;
      for (const s of q.steps) {
        if (s.kind === "answers") { if (!answers) { answers = Object.assign({}, s, { findings: s.findings.slice() }); steps.push(answers); } else answers.findings = answers.findings.concat(s.findings); continue; }
        const sig = stepSig(s);
        if (seen.has(sig)) continue;
        seen.add(sig);
        steps.push(Object.assign({}, s, { bureau: s.kind === "letter" && out.reports[pi] ? out.reports[pi].bureau : "" }));
      }
    });
    if (answers) {
      const n = answers.findings.length;
      answers.title = "Answer " + n + " question" + (n === 1 ? "" : "s") + " so these items can be disputed or set aside";
    }
    ph.steps = steps;
  }
  let n = 0;
  for (const ph of base.phases) for (const s of ph.steps) s.order = ++n;
  if (goal === "auto_soon") {
    const std = out.plan ? out.plan : mergedPlan(P, out, "standard");
    const ord = new Map();
    for (const ph of std.phases) for (const s of ph.steps) ord.set(stepSig(s), s.order);
    for (const s of base.phases[0].steps) { delete s.moved_from; if (ord.has(stepSig(s))) s.moved_from = ord.get(stepSig(s)); }
    base.expect = C.expectations(P.scores || [], out.merged, out.findings.filter((f) => f.current && OPEN_STATES.has(f.state)), out.cards, out.today);
  }
  base.next_action = null;
  for (const ph of base.phases) for (const s of ph.steps) if (!base.next_action && ["answers", "letter", "auto"].includes(s.kind)) base.next_action = { phase: ph.title, title: s.title, why: s.why, kind: s.kind };
  return base;
}
const REPLY_NOUN = { mov_611a7: "answer about how it checked", bureau_611: "dispute result", obsolete_605: "dispute result", personal_info: "correction result",
  furnisher_623: "answer to the direct dispute", dispute_notation: "answer", reinsertion_demand: "reply about the reinsertion", block_605b: "block" };
// The dashboard's next action: a missed legal deadline first (the silence is the next letter's fact),
// then a question only the person can answer, then the plan's first step.
function nextAction(out) {
  const od = out.overdue.slice().sort((a, b) => String(a.due).localeCompare(String(b.due)))[0];
  if (od) {
    const late = C.days_between(od.due, out.today);
    return { kind: "overdue", title: "Follow up with " + od.to, entry: od,
      sub: "Its " + (REPLY_NOUN[od.letter] || "reply") + " was due " + md(od.due) + " and is " + plural(late, "day") + " late. A follow-up with that fact goes out next.",
      href: "#/letters/build" };
  }
  const printed = out.mail.filter((m) => m.state === "Printed");
  if (printed.length) return { kind: "mail", title: "Mail them and type the tracking numbers", sub: plural(printed.length, "printed letter is", "printed letters are") + " waiting. Send each by certified mail and type its tracking number. The deadline starts when they receive it.", href: "#/letters/build" };
  const near = out.mail.filter((m) => m.state === "In transit")[0];
  if (out.buildCount) {
    const g = out.ready[0];
    return { kind: "ready", title: "Build my letters (" + out.buildCount + " ready)", sub: plural(out.ready.length, "problem") + " found" + (g ? ", starting with " + titleCase(g.subject.replace(/\s+\S*\d\S*$/, "")) + ": " + plainTitle(g.rule, g.title).toLowerCase() : "") + ". One click writes every letter, addressed and in the right order.", href: "#/letters/build" };
  }
  if (out.answers.length) {
    const g = out.answers[0];
    return { kind: "answer", title: "Answer " + plural(out.answers.length, "question"), sub: "Only you know these facts. Each yes or no updates your letters.", href: "#/letters/build" };
  }
  if (near) return { kind: "deliver", title: "Log the " + near.to + " delivery", sub: "The legal clock starts on the day they receive it. Enter the date from the return receipt.", href: "#/letters/mail" };
  return { kind: "none", title: out.round ? "Nothing due right now" : "Import your reports", sub: out.round ? "Keep payments on time and check your reports again next week." : "Start with the free reports from AnnualCreditReport.com.", href: out.round ? "#/score" : "#/reports" };
}

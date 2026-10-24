// ---------------------------------------------------------------- score plan: paydown by statement date, ranges, scores, the two clocks
const FAMILY_OF = (model) => /vantage/i.test(model) ? "vantage4" : /fico\s*(9|10)/i.test(model) ? "fico9" : "fico8";
function editCardsDialog(d) {
  const rows = (d.cards || []).map((c) => ({ id: c.id || "", name: input({ value: titleCase(c.name), "aria-label": "Card name" }), limit: input({ value: C.money_text(c.limit), mono: true, "aria-label": "Credit limit" }),
    bal: input({ value: C.money_text(c.balance), mono: true, "aria-label": "Balance" }), day: input({ value: String(c.statement_day || 1), mono: true, type: "number", min: 1, max: 31, "aria-label": "Statement closing day" }) }));
  const box = el("div", { cls: "stack" });
  const addRow = (r) => { rows.push(r); box.append(el("div", { cls: "grid3", style: "grid-template-columns:2fr 1fr 1fr 1fr" }, [field("Card", r.name), field("Limit", r.limit), field("Balance", r.bal), field("Statement day", r.day)])); };
  const list = rows.slice(); rows.length = 0; list.forEach(addRow);
  openDialog({ title: "Your cards", icon: "card", wide: true, body: [el("p", { cls: "muted small", text: "The statement closing day is on each statement. Balances here are what you expect the statement to show." }), box,
    btn("Add a card", () => addRow({ id: "", name: input({ "aria-label": "Card name" }), limit: input({ mono: true, "aria-label": "Credit limit" }), bal: input({ mono: true, "aria-label": "Balance" }), day: input({ value: "1", mono: true, type: "number", min: 1, max: 31, "aria-label": "Statement closing day" }) }), { cls: "sm", icon: "plus", icoCls: "ico sm" })],
  actions: [{ label: "Cancel" }, { label: "Save", primary: true, onClick: () => change("Cards saved", (P) => {
    P.cards = rows.filter((r) => r.name.value.trim()).map((r, i) => ({ id: r.id || "c" + i + "-" + Date.now().toString(36), name: cleanName(r.name.value, 60).toUpperCase(), limit: C.parse_money(r.limit.value) || 0, balance: C.parse_money(r.bal.value) || 0, statement_day: Math.min(31, Math.max(1, parseInt(r.day.value, 10) || 1)) }));
  }) }] });
}
function solCard(d) {
  const st = S.ui.sol || { state: d.P.profile.state || "", type: "open", last: "", dofd: "" };
  S.ui.sol = st;
  const states = Object.keys(C.TABLES.sol).sort().map((k) => [k, C.TABLES.sol[k].name]);
  const upd = (k) => (e) => { st[k] = e.target.value; render(); };
  const res = (() => { try { return st.state ? C.sol(st.state, st.type, st.last, st.dofd, d.today) : null; } catch (e) { return { error: e.message }; } })();
  const out = [];
  if (res && !res.error) {
    out.push(el("dl", { cls: "dl" }, [el("dt", { text: "Statute of limitations" }), el("dd", { text: res.years + " years in " + res.state_name + " (" + res.debt_type + ")" + (res.sol_expires ? ", ends about " + mdy(res.sol_expires) + (res.time_barred ? ": likely time-barred" : "") : "") }),
      el("dt", { text: "Reporting limit" }), el("dd", { text: res.reporting_ends ? "Until about " + C.us_date(res.reporting_ends) + (res.reportable ? "" : ": past the limit, it should be gone") : "Add the month the trouble started" })]));
    if (res.flag) out.push(note("warn", "alert", [el("p", { text: res.flag })]));
    if (res.extinguished) out.push(note("", "info", [el("p", { text: res.extinguished })]));
    out.push(el("ul", { cls: "rows" }, res.warnings.map((w) => el("li", null, [icon("info", "ico sm"), el("span", { text: w }), el("span")]))), cites(res.cite));
  } else if (res && res.error) out.push(el("p", { cls: "muted", text: res.error }));
  return card("Two clocks for an old debt", "timer", [el("div", { cls: "grid2" }, [field("State", select([["", "Choose"]].concat(states), st.state, { id: "sol-state", on: { change: upd("state") } })),
    field("Debt type", select(C.TABLES.sol_columns.map((c) => [c, { written: "Written contract", oral: "Oral agreement", promissory: "Promissory note", open: "Open account (cards)" }[c]]), st.type, { id: "sol-type", on: { change: upd("type") } })),
    field("Last payment", input({ type: "date", value: st.last, id: "sol-last", on: { change: upd("last") } })), field("Month the trouble started (first late payment)", input({ value: st.dofd, id: "sol-dofd", placeholder: "YYYY-MM", mono: true, on: { change: upd("dofd") } }))])].concat(out), "verify with your state");
}
VIEWS.score = (d) => {
  const P = d.P, u = d.util10, u30 = d.util30, az = d.azeo;
  const scen = S.ui.scen || {};
  const rows = u ? u.cards.map((c, i) => ({ cells: [[el("b", { text: titleCase(c.name) }), el("br"), el("span", { cls: "muted", text: "Limit " + money(c.limit) })], [money(c.balance), el("br"), el("span", { cls: "muted", text: c.util_before + "%" })],
    num(mdy(c.statement_close)), el("b", { cls: "num", text: mdy(c.pay_by) }), money(u30.cards[i].pay), el("b", { text: money(c.pay) }), money(az.cards[i].pay)], cls: [null, "n", null, null, "n", "n", "n"] })) : [];
  if (u) rows.push({ cells: [el("b", { text: "All cards" }), [money(u.cards.reduce((s, c) => s + c.balance, 0)), el("br"), el("span", { cls: "muted", text: u.overall_before + "%" })], "", "", money(u30.total_pay), el("b", { text: money(u.total_pay) }), money(az.total_pay)], cls: [null, "n", null, null, "n", "n", "n"] });
  const last = u ? u.cards.filter((c) => c.pay > 0).map((c) => c.pay_by).sort().slice(-1)[0] : "";
  const k = u ? keyAnswer("Utilization target", u.overall_after + "% by " + md(last || d.today), "Pay " + money(u.total_pay) + " across " + plural(u.cards.filter((c) => c.pay > 0).length, "card") + ", each before its statement closes. Today the cards report " + u.overall_before + "%.")
    : keyAnswer("Utilization target", "Add your cards", "The fastest honest way to raise a score: pay card balances down before the statement date.");
  // score ranges: the scenarios that are switched on, added up per score family, from today's score
  const latest = {};
  for (const s of (P.scores || []).slice().sort((a, b) => a.date.localeCompare(b.date))) latest[FAMILY_OF(s.model)] = s.value;
  const on = d.cal.scenarios.filter((s, i) => (Object.prototype.hasOwnProperty.call(scen, s.id) ? scen[s.id] : i < 2));
  const lo = 500, hi = 760;
  const pos = (v) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
  const ranges = d.sim.families.map((f) => {
    const a = on.reduce((s, x) => s + x.families[f.id].low, 0), b = on.reduce((s, x) => s + x.families[f.id].high, 0);
    const base = latest[f.id];
    const tr = el("div", { cls: "tr", role: "img", "aria-label": f.title + ": " + rangeText({ low: a, high: b }) + " points" + (base ? " from about " + base : "") }, base ? [el("span", { cls: "now", style: "left:" + pos(base).toFixed(1) + "%" }),
      el("span", { cls: "band", style: "left:" + pos(base + a).toFixed(1) + "%;width:" + Math.max(1, pos(base + b) - pos(base + a)).toFixed(1) + "%" })] : []);
    return el("div", { cls: "rg" }, [el("span", { cls: "l" }, [f.title, el("small", { text: base ? "From your " + base : "Enter a score to place the band" })]), tr, el("span", { cls: "v", text: rangeText({ low: a, high: b }) })]);
  });
  const LBL = { "Tool estimate": "Tool estimate", "Published direction, tool estimate size": "Published direction" };
  const tuned = (s) => Object.values(s.families).some((b) => b.how);
  const sc = d.cal.scenarios.map((s, i) => switchRow(s.title, [el("span", { cls: "lbl-conf", text: LBL[s.label] || s.label }), tuned(s) ? el("span", { cls: "lbl-conf", text: "Your scores" }) : null, " " + s.basis +
    (tuned(s) ? " " + Object.entries(s.families).filter(([, b]) => b.how).map(([k, b]) => (d.sim.families.find((f) => f.id === k) || {}).title + " " + b.how + " to " + rangeText(b) + " from " + rangeText(b.prior) + " by your " + plural(b.observed.length, "recorded change")).join("; ") + "." : "")], Object.prototype.hasOwnProperty.call(scen, s.id) ? scen[s.id] : i < 2, (v) => { S.ui.scen = Object.assign({}, scen, { [s.id]: v }); render(); }, { id: "scen-" + i }));
  const scoreForm = (() => {
    const dt = input({ type: "date", id: "sc-date", value: d.today });
    const model = select([["FICO 8", "FICO 8"], ["FICO 9", "FICO 9"], ["FICO 10", "FICO 10"], ["VantageScore 4.0", "VantageScore 4.0"], ["VantageScore 3.0", "VantageScore 3.0"], ["FICO Auto Score 8", "FICO Auto Score 8"], ["Other", "Other"]], "FICO 8", { id: "sc-model" });
    const val = input({ type: "number", id: "sc-value", min: 300, max: 900, mono: true });
    const src = input({ id: "sc-src", placeholder: "Card app, bank app" });
    const what = select(Object.entries(C.CHANGE_KINDS).map(([k, t]) => [k, t]), "none", { id: "sc-change" });
    return card("Scores you entered", "score", [el("div", { cls: "grid2" }, [field("Date", dt), field("Model (as the app names it)", model), field("Score", val), field("Where you saw it", src),
      field("What changed since your last score of this model", what)]),
      btn("Add the score", () => { const v = parseInt(val.value, 10); if (!(v >= 300 && v <= 900)) { toast("Enter the score as shown, 300 to 900."); return; } change("Score added", (P2) => { P2.scores = (P2.scores || []).concat([{ date: dt.value || d.today, model: model.value, value: v, source: cleanName(src.value, 40), change: what.value }]); }); }, { cls: "primary", icon: "plus", id: "sc-add" }),
      (P.scores || []).length ? rowsList(P.scores.slice().sort((a, b) => b.date.localeCompare(a.date)).map((s) => el("li", null, [num(mdy(s.date)), el("span", { text: s.model + ": " + s.value + (s.source ? " (" + s.source + ")" : "") }), el("span")]))) : null,
      el("p", { cls: "muted small", text: C.PRODUCT_NAME + " never pulls your credit. " + d.cal.calibration.note })]);
  })();
  // statement closing days: asked once per card, then every amount and date follows from them
  const asked = (P.cards && P.cards.length) ? null : (d.cards || []).length ? (() => {
    const ins = d.cards.map((c) => input({ type: "number", min: 1, max: 31, inputmode: "numeric", id: "sd-" + c.id, "aria-label": "Statement closing day for " + titleCase(c.name), placeholder: "Day" }));
    return card("One question per card: when does its statement close?", "calendar", [el("p", { text: "It's printed on each statement as the closing date. Type the day of the month once; " + C.PRODUCT_NAME + " works out how much to pay and by when. Until then the dates below assume the 1st." }),
      el("div", { cls: "grid2" }, d.cards.map((c, i) => field(titleCase(c.name) + " closes on day", ins[i]))),
      btn("Save statement days", () => { const days = ins.map((x) => parseInt(x.value, 10)); if (days.some((v) => !(v >= 1 && v <= 31))) { toast("Type a day from 1 to 31 for each card."); return; }
        change("Statement days saved", (Q) => { Q.cards = d.cards.map((c, i) => ({ id: c.id, name: c.name, limit: c.limit, balance: c.balance, statement_day: days[i] })); }); }, { cls: "primary", id: "sd-save" })], null, { cls: "card", id: "statement-days" });
  })() : null;
  const body = [el("div", { cls: "cols" }, [k, modeToggle(d, "score")]), asked,
    card("Pay down by statement date", "card", [u ? table(["Card", ["Balance", "n"], "Statement closes", "Pay by", ["Pay for 30%", "n"], ["Pay for 10%", "n"], ["All but one at $0", "n"]], rows) : el("p", { cls: "muted", text: "No open cards with a limit on your reports yet." }),
      el("div", { cls: "row" }, [btn(u ? "Edit cards and statement dates" : "Add your cards", () => editCardsDialog(d), { icon: "edit", id: "edit-cards" })]),
      el("p", { cls: "muted small", text: "Pay-by dates leave 3 business days for the payment to post. Issuers usually report the statement balance, so paying the due date in full still reports the higher balance. All but one at $0 is community-observed, not published by FICO." }), cites((u || { cite: ["util_timing"] }).cite)], "issuers usually report the statement balance"),
    el("div", { cls: "cols" }, [card("Score ranges if these happen", "range", [el("div", { cls: "ranges" }, ranges), note("", "info", [el("p", { text: d.sim.assumption + " Ranges are added up for the changes switched on." })]), cites(d.sim.cite)], "never one number"),
      card("What changes", "settings", sc)])];
  if (P.goal === "auto_soon" && d.auto.expect) body.push(expectCard(d.auto.expect, d));
  body.push(el("div", { cls: "cols" }, [scoreForm, solCard(d)]));
  body.push(savingsCard(d));
  return { title: "Score plan", crumb: crumbOf("Utilization and ranges"), body };
};
// What a better rate is worth, at rates the person was actually quoted (no rate tables are supplied).
function savingsCard(d) {
  const v = S.ui.sav || { amount: "", months: "60", now: "", goal: "" };
  S.ui.sav = v;
  const upd = (k) => (e) => { v[k] = e.target.value; render(); };
  const bp = (t) => { const x = parseFloat(String(t).replace(/[%\s]/g, "")); return Number.isFinite(x) ? Math.round(x * 100) : NaN; };
  let res = null, err = "";
  if (v.amount && v.months && v.now !== "" && v.goal !== "") {
    try { res = C.savings(C.parse_money(v.amount) || 0, parseInt(v.months, 10), bp(v.now), bp(v.goal)); } catch (e) { err = e.message; }
  }
  return card("What a better rate is worth", "percent", [el("p", { cls: "muted small", text: "Enter a loan you are shopping for and two rates a lender quoted you, today's and the one you expect at a better score tier. Lenders set their own tiers; ask each one." }),
    el("div", { cls: "grid2" }, [field("Loan amount", input({ id: "sv-amount", mono: true, value: v.amount, placeholder: "$25,000", on: { change: upd("amount") } })),
      field("Term in months", input({ id: "sv-months", mono: true, type: "number", min: 1, max: 480, value: v.months, on: { change: upd("months") } })),
      field("Rate quoted today (APR %)", input({ id: "sv-now", mono: true, value: v.now, placeholder: "11.99", on: { change: upd("now") } })),
      field("Rate at the better tier (APR %)", input({ id: "sv-goal", mono: true, value: v.goal, placeholder: "6.49", on: { change: upd("goal") } }))]),
    res ? el("dl", { cls: "dl" }, [el("dt", { text: "Monthly payment" }), el("dd", { text: money(res.now.payment) + " now, " + money(res.goal.payment) + " at the better rate: " + money(res.monthly_difference) + " less a month" }),
      el("dt", { text: "Total interest" }), el("dd", { text: money(res.now.interest) + " now, " + money(res.goal.interest) + " at the better rate: " + money(res.total_difference) + " less over the loan" })]) : err ? el("p", { cls: "muted", text: err }) : null,
    res ? el("p", { cls: "muted small", text: res.note }) : null]);
}

// ---------------------------------------------------------------- goodwill and negotiation: every offer in writing, nothing paid before the agreement
// For items that look accurate: goodwill requests, pay-for-delete and settlement offers, each with its
// amount, dates and the reply, and the written-agreement checklist that must pass before any payment.
// The core decides what the next step is and what to warn about (strategy.negotiation_checklist).
const OFFER_KIND = { goodwill: "Goodwill request", pay_for_delete: "Pay-for-delete offer", settlement: "Settlement offer" };
const OFFER_REPLY = [["", "No reply yet"], ["accepted", "Accepted in writing"], ["countered", "Countered"], ["refused", "Refused"]];
function offerSol(d, o) {
  if (!d.P.profile.state || !o.last_payment) return null;
  try { return C.sol(d.P.profile.state, "open", o.last_payment, "", d.today); } catch (e) { return null; }
}
function offerCard(d, o) {
  const chk = C.negotiation_checklist(o, offerSol(d, o), d.today);
  const upd = (label, fn) => change(label, (P) => { const x = (P.offers || []).find((y) => y.id === o.id); if (x) fn(x); }, { quiet: true });
  const money_in = (id, key, label) => field(label, input({ id, mono: true, value: o[key] ? C.money_text(o[key]) : "", on: { change: (e) => upd("Saved", (x) => { x[key] = C.parse_money(e.target.value) || 0; }) } }));
  const date_in = (id, key, label) => field(label, input({ id, type: "date", value: o[key] || "", on: { change: (e) => upd("Saved", (x) => { x[key] = e.target.value; }) } }));
  const items = chk.items.map((it) => {
    const cb = el("input", { type: "checkbox", id: "ag-" + o.id + "-" + it.id, checked: it.done, on: { change: (e) => upd("Saved", (x) => { x.agreement = Object.assign({}, x.agreement, { [it.id]: e.target.checked }); }) } });
    return el("label", { cls: "check" + (it.done ? " on" : ""), for: cb.id }, [cb, el("span", { text: it.text })]);
  });
  const letterKind = o.kind === "goodwill" ? "goodwill" : o.kind;
  // a starting offer from the reported balance: a common range, labeled as typical, never a rule
  const lo = o.balance ? Math.round(o.balance * 0.3 / 100) * 100 : 0, hi = o.balance ? Math.round(o.balance * 0.5 / 100) * 100 : 0;
  const suggest = o.kind !== "goodwill" && o.balance > 0 ? el("p", { cls: "muted small" }, ["Typical starting offer: " + money(lo) + " to " + money(hi) + " (30% to 50% of the " + money(o.balance) + " balance). This is a common range people report, not a rule; the company sets its own terms. ",
    !o.amount ? btn("Offer " + money(lo), () => upd("Offer set to " + money(lo), (x) => { x.amount = lo; }), { cls: "sm", id: "of-suggest-" + o.id }) : null]) : null;
  return card(OFFER_KIND[o.kind] + ": " + titleCase(o.name), o.kind === "goodwill" ? "envelope" : "scale", [
    el("p", { cls: chk.ready_to_pay ? "" : "muted", text: chk.next }),
    el("div", { cls: "grid2" }, [
      o.kind === "goodwill" ? null : money_in("of-amt-" + o.id, "amount", "Amount you offer"),
      o.kind === "goodwill" ? null : money_in("of-bal-" + o.id, "balance", "Balance they report"),
      date_in("of-sent-" + o.id, "sent", "Date you sent it"),
      field("Their reply", select(OFFER_REPLY, o.response || "", { id: "of-rep-" + o.id, on: { change: (e) => upd("Saved", (x) => { x.response = e.target.value; }) } })),
      o.response === "countered" ? money_in("of-ctr-" + o.id, "counter", "Their counteroffer") : null,
      date_in("of-rd-" + o.id, "response_date", "Date of their reply"),
      o.kind === "goodwill" ? null : date_in("of-lp-" + o.id, "last_payment", "Your last payment on this debt (for the statute of limitations)"),
      o.kind === "goodwill" ? null : date_in("of-paid-" + o.id, "paid", "Date you paid (only after the signed agreement)"),
    ]),
    suggest,
    items.length ? el("h4", { cls: "lbl", text: "Before you pay: the written agreement" }) : null,
    items.length ? el("div", { cls: "stack", style: "gap:var(--s-2)" }, items) : null,
    o.paid ? switchRow("The next reports show it as agreed", "Check every bureau the company reports to.", !!o.verified, (v) => upd("Saved", (x) => { x.verified = v; }), { id: "of-ver-" + o.id }) : null,
    chk.warnings.length ? note("warn", "alert", chk.warnings.map((w) => el("p", { text: w }))) : null,
    el("div", { cls: "row" }, [link(o.kind === "goodwill" ? "Draft the goodwill letter" : "Draft the written offer", "#/letters/new?kind=" + letterKind + "&account=" + encodeURIComponent(o.name), { cls: "sm primary", icon: "letters" }),
      btn("Remove", () => change("Removed the " + OFFER_KIND[o.kind].toLowerCase(), (P) => { P.offers = (P.offers || []).filter((x) => x.id !== o.id); }), { cls: "sm quiet" })]),
    cites(chk.cite)], chk.ready_to_pay ? [chip("Ready to pay")] : null, { cls: "card", id: "offer-" + o.id });
}
VIEWS.negotiate = (d) => {
  const P = d.P, offers = P.offers || [];
  const open = offers.filter((o) => !o.paid && o.response !== "refused");
  const ready = offers.filter((o) => C.negotiation_checklist(o, offerSol(d, o), d.today).ready_to_pay && !o.paid);
  const k = keyAnswer("Offers in writing", open.length + " open", ready.length ? plural(ready.length, "agreement passes", "agreements pass") + " every check and can be paid." :
    open.length ? "Don't pay anything until you have a signed agreement that passes every check below." : "Accurate items cannot be disputed away. A goodwill request or a written offer is the honest path for them.");
  const start = (kind, a) => change("Started a " + OFFER_KIND[kind].toLowerCase(), (Q) => {
    Q.offers = (Q.offers || []).concat([{ id: "o-" + Date.now().toString(36), kind, name: a.name, account_id: a.account_id || "", balance: a.balance || 0, amount: 0, agreement: {}, created: d.today }]);
  });
  const has = (name, kind) => offers.some((o) => o.name === name && o.kind === kind);
  const cands = [];
  for (const h of d.honest.filter((x) => x.kind === "goodwill")) if (!has(h.name, "goodwill")) cands.push(el("li", null, [icon("envelope", "ico sm"), el("span", null, [el("b", { text: titleCase(h.name) }), el("br"), el("span", { cls: "muted small", text: h.why })]), btn("Start a goodwill request", () => start("goodwill", h), { cls: "sm" })]));
  for (const p of d.pfd) if (!has(p.name, "pay_for_delete") && !has(p.name, "settlement")) cands.push(el("li", null, [icon("scale", "ico sm"), el("span", null, [el("b", { text: titleCase(p.name) + " (" + money(p.balance) + ")" }), el("br"), el("span", { cls: "muted small", text: p.why })]),
    el("span", { cls: "row" }, [btn("Pay-for-delete", () => start("pay_for_delete", p), { cls: "sm" }), btn("Settlement", () => start("settlement", p), { cls: "sm quiet" })])]));
  const other = select([["", "Choose an account"]].concat(d.merged.accounts.filter((a) => (a.flags || []).includes("adverse")).map((a) => [a.id, titleCase(a.name)])), "", { id: "of-other" });
  const otherKind = select([["goodwill", "Goodwill request"], ["pay_for_delete", "Pay-for-delete offer"], ["settlement", "Settlement offer"]], "goodwill", { id: "of-other-kind" });
  const body = [el("div", { cls: "cols" }, [k, card("Start one", "plus", [cands.length ? rowsList(cands) : el("p", { cls: "muted", text: "No goodwill or offer candidates from your reports right now." }),
    el("div", { cls: "grid2" }, [field("Another account", other), field("Kind", otherKind)]),
    btn("Start", () => { const a = d.merged.accounts.find((x) => x.id === other.value); if (!a) { toast("Choose the account."); return; } start(otherKind.value, { name: a.name, account_id: a.id, balance: a.balance || 0 }); }, { cls: "sm", id: "of-start" })])])];
  for (const o of offers.slice().sort((a, b) => String(b.created || "").localeCompare(String(a.created || "")))) body.push(offerCard(d, o));
  body.push(note("", "info", [el("p", { text: "A goodwill request is a courtesy, not a dispute. Pay-for-delete and settlement are private agreements no law requires a company to accept. Get the terms in writing, signed, before you pay anything, and keep every page in the vault." })]));
  return { title: "Goodwill and negotiation", crumb: crumbOf("Offers in writing"), body };
};

// ---------------------------------------------------------------- round compare and three-bureau compare (twin of rounds.py)
const ROUND_FIELDS = ["balance", "pay_status", "past_due", "credit_limit", "high_balance", "closed", "removal", "remarks"];
const nz = (v) => (v === undefined ? null : v);
function account_key(a) { return norm_name(a.name) + "|" + visible_digits(a.number).slice(0, 6) + "|" + (a.opened || "").slice(0, 7); }
function match_account(olds, a) {
  const k = account_key(a);
  for (const o of olds) if (account_key(o) === k) return o;
  for (const o of olds) if (names_match(o.name, a.name) && (o.opened || "").slice(0, 7) === (a.opened || "").slice(0, 7) && o.opened) return o;
  return null;
}
function rval(a, f) { const v = nz(a[f]); return f === "remarks" ? (v || []).join("; ") : v; }
function rfmt(f, v) {
  if (v === null || v === undefined || v === "") return "none";
  if (["balance", "past_due", "credit_limit", "high_balance"].includes(f)) return money_text(v);
  if (f === "closed" || f === "removal") return us_date(v);
  return String(v);
}
function diff_rounds(old, nw, ctx) {
  ctx = ctx || {};
  const logged = new Set(ctx.deleted_keys || []), deleted_before = new Set(logged);
  for (const r of ctx.earlier || []) {
    const ks = new Set((r.accounts || []).map(account_key));
    for (const k of ks) if (!(old.accounts || []).some((a) => account_key(a) === k)) deleted_before.add(k);
  }
  const out = { deleted: [], updated: [], unchanged: [], new: [], reinserted: [], inquiries: { deleted: [], new: [] }, personal: { removed: [], added: [] }, findings: [] };
  const matched = new Set(), R = TABLES.rules.reinserted;
  for (const a of nw.accounts || []) {
    const o = match_account(old.accounts || [], a);
    if (o) matched.add(o.id);
    if (o && !logged.has(account_key(a))) {
      const changes = [];
      for (const f of ROUND_FIELDS) if (rval(o, f) !== rval(a, f)) changes.push({ field: f, old: rfmt(f, rval(o, f)), new: rfmt(f, rval(a, f)) });
      const oh = {};
      for (const h of o.history || []) oh[h.month] = h.rating;
      for (const h of a.history || []) if (own(oh, h.month) && oh[h.month] !== h.rating) changes.push({ field: "history " + us_date(h.month), old: oh[h.month], new: h.rating });
      const row = { id: a.id, old_id: o.id, name: a.name, number: own(a, "number") ? a.number : "", changes };
      (changes.length ? out.updated : out.unchanged).push(row);
    } else {
      const k = account_key(a), row = { id: a.id, name: a.name, number: own(a, "number") ? a.number : "", key: k };
      if (deleted_before.has(k)) {
        out.reinserted.push(row);
        const notice = (ctx.notices || {})[k];
        if (!notice) {
          const rd = nw.source.report_date || "";
          out.findings.push({ id: "f" + stable_hash("reinserted|" + (nw.bureau || "") + "|" + k), rule: "reinserted", title: R.title, group: R.group, bureau: nw.bureau || "",
            account_id: a.id, subject: subject_of(a), confidence: "high", legal: R.legal.slice(),
            evidence: [{ label: "Deleted in an earlier round", value: "yes" }, { label: "Back on the report dated", value: us_date(rd) }, { label: "Reinsertion notice on record", value: "none" }],
            facts: ["The account " + subject_of(a) + " was deleted from my file after an earlier dispute and appears again on the report dated " + us_date(rd) + ". I have no written notice of the reinsertion."],
            request: "Please send the reinsertion notice and the furnisher's certification, or delete the item.", confirm: [], letter: "reinsertion_demand", then: "cfpb_complaint",
            impact: 5, speed: 4, status: "open", explain: "A deleted item may come back only if the furnisher certifies it, and the bureau must tell you in writing within 5 business days.",
            notice_due_if_reinserted_on: rd ? add_business_days(rd, 5) : "" });
        }
      } else out.new.push(row);
    }
  }
  for (const o of old.accounts || []) if (!matched.has(o.id)) out.deleted.push({ id: o.id, name: o.name, number: own(o, "number") ? o.number : "", key: account_key(o) });
  const iq = (r) => { const s = new Set(); for (const q of r.inquiries || []) if (q.kind === "hard") for (const d of q.dates) s.add(JSON.stringify([norm_name(q.name), d])); return s; };
  const oq = iq(old), nq = iq(nw);
  out.inquiries.deleted = sortBy([...oq].filter((x) => !nq.has(x)).map((x) => JSON.parse(x)), (x) => x).map(([name, date]) => ({ name, date }));
  out.inquiries.new = sortBy([...nq].filter((x) => !oq.has(x)).map((x) => JSON.parse(x)), (x) => x).map(([name, date]) => ({ name, date }));
  const pset = (r) => { const p = r.personal || {}, s = new Set(); for (const n of p.names || []) s.add("name:" + n.name); for (const x of p.addresses || []) s.add("address:" + x.text); for (const x of p.phones || []) s.add("phone:" + x.number); for (const x of p.employers || []) s.add("employer:" + x.name); return s; };
  const po = pset(old), pn = pset(nw);
  out.personal.removed = [...po].filter((x) => !pn.has(x)).sort();
  out.personal.added = [...pn].filter((x) => !po.has(x)).sort();
  out.counts = {};
  for (const k of ["deleted", "updated", "unchanged", "new", "reinserted"]) out.counts[k] = out[k].length;
  return out;
}
function status_class(a) {
  const st = (a.pay_status || "").toUpperCase();
  if (a.kind === "collection") return "collection";
  if ((a.flags || []).includes("charged_off")) return "charge-off";
  if (st.includes("PAID") || st.includes("CLOSED")) return "paid or closed";
  if (["PAST DUE", "LATE", "DELINQ"].some((w) => st.includes(w))) return "late";
  return "current";
}
function same_account(a, b) {
  if (!names_match(a.name, b.name)) return false;
  if (a.opened && b.opened) return a.opened.slice(0, 7) === b.opened.slice(0, 7);
  const va = visible_digits(a.number), vb = visible_digits(b.number);
  return !!(va && vb && va.slice(0, 4) === vb.slice(0, 4));
}
const CMP_FIELDS = [["balance", (a) => nz(a.balance)], ["status", status_class], ["past_due", (a) => nz(a.past_due)], ["opened", (a) => (a.opened || "").slice(0, 7) || null],
  ["closed", (a) => (a.closed || "").slice(0, 7) || null], ["credit_limit", (a) => nz(a.credit_limit)], ["high_balance", (a) => nz(a.high_balance)], ["removal", (a) => a.removal || null]];
function tradeline_groups(reports) {
  const groups = [];
  for (const r of reports) for (const a of r.accounts || []) {
    let g = groups.find((x) => !own(x.accounts, r.bureau) && Object.values(x.accounts).some((y) => same_account(a, y)));
    if (!g) { g = { name: a.name, accounts: {}, reports: {} }; groups.push(g); }
    g.accounts[r.bureau] = a;
    g.reports[r.bureau] = r;
  }
  return groups;
}
// Dispute every bureau that reports it: each bureau only with its own findings, and for each rule the
// bureaus that report the same account where it was not found (the person checks that copy first).
function tradelines(reports, findings) {
  const order = { transunion: 0, experian: 1, equifax: 2 }, ord = (b) => (own(order, b) ? order[b] : 9);
  const out = [];
  for (const g of tradeline_groups(reports)) {
    const bs = sortBy(Object.keys(g.accounts), (b) => [ord(b), b]);
    const ids = {}, per = {}, rules = {};
    for (const b of bs) ids[b] = g.accounts[b].id;
    const mine = (f, b) => f.account_id === ids[b] && (own(f, "bureau") ? f.bureau : b) === b;
    for (const b of bs) per[b] = findings.filter((f) => mine(f, b)).map((f) => f.id).sort();
    for (const b of bs) for (const f of findings) if (mine(f, b)) { if (!own(rules, f.rule)) rules[f.rule] = new Set(); rules[f.rule].add(b); }
    const gaps = Object.keys(rules).sort().filter((k) => bs.some((b) => !rules[k].has(b)))
      .map((k) => ({ rule: k, found: sortBy([...rules[k]], (b) => [ord(b)]), not_found: bs.filter((b) => !rules[k].has(b)) }));
    if (!bs.some((b) => per[b].length)) continue;
    out.push({ name: g.name, bureaus: bs, ids, findings: per, gaps, all: bs.flatMap((b) => per[b]).sort() });
  }
  return sortBy(out, (t) => [-t.all.length, t.name]);
}
function compare_bureaus(reports) {
  const groups = tradeline_groups(reports);
  const out = [], findings = [], RULE = TABLES.rules.cross_bureau_mismatch;
  for (const g of groups) {
    const bs = Object.keys(g.accounts).sort(), rows = [];
    if (bs.length < 2) { out.push({ name: g.name, bureaus: bs, rows: [], differ: 0, timing: 0, only: bs[0] }); continue; }
    const upd = {};
    for (const b of bs) upd[b] = g.accounts[b].updated || g.reports[b].source.report_date || "";
    const lagged = (field, vals) => {
      if (field !== "balance" && field !== "past_due") return false;
      const dates = bs.map((b) => upd[b]).filter((d) => d);
      if (dates.length < 2) return false;
      const lo = dates.reduce((m, d) => (d < m ? d : m)), hi = dates.reduce((m, d) => (d > m ? d : m));
      if (days_between(lo, hi) < 20 || days_between(lo, hi) > 62) return false;
      const newest = bs.reduce((m, b) => (upd[b] > upd[m] ? b : m), bs[0]);
      const key = field === "balance" ? "bal" : "past_due";
      for (const b of bs) {
        if (b === newest || vals[b] === vals[newest]) continue;
        const m = upd[b].slice(0, 7);
        const h = (g.accounts[newest].history || []).find((x) => x.month === m);
        if (!h || h[key] === null || h[key] === undefined || h[key] !== vals[b]) return false;
      }
      return true;
    };
    for (const [field, getter] of CMP_FIELDS) {
      const vals = {};
      for (const b of bs) vals[b] = getter(g.accounts[b]);
      const known = bs.filter((b) => vals[b] !== null);
      if (new Set(known.map((b) => String(vals[b]))).size <= 1) { rows.push({ field, values: vals, state: "same" }); continue; }
      const state = lagged(field, vals) ? "timing" : "differ";
      const counts = {};
      for (const b of known) counts[String(vals[b])] = (counts[String(vals[b])] || 0) + 1;
      const odd = known.filter((b) => counts[String(vals[b])] === 1 && known.length >= 3);
      rows.push({ field, values: vals, state, odd });
    }
    const months = {};
    for (const b of bs) for (const h of g.accounts[b].history || []) (months[h.month] = months[h.month] || {})[b] = h.rating;
    const hist_diff = [];
    for (const m of Object.keys(months).sort()) {
      const rs = months[m];
      if (Object.keys(rs).length < 2) continue;
      const lates = Object.keys(rs).filter((b) => is_late(rs[b])), oks = Object.keys(rs).filter((b) => rs[b] === "OK");
      if (lates.length && oks.length) hist_diff.push({ month: m, values: rs });
    }
    if (hist_diff.length) {
      let odd = new Set(bs);
      for (const x of hist_diff) {
        const cnt = {};
        for (const v of Object.values(x.values)) cnt[v] = (cnt[v] || 0) + 1;
        const n = Object.keys(x.values).length;
        const mine = new Set(Object.keys(x.values).filter((b) => cnt[x.values[b]] === 1 && n >= 3));
        odd = new Set([...odd].filter((b) => mine.has(b)));
      }
      rows.push({ field: "history", values: {}, state: "differ", months: hist_diff, odd: [...odd].sort() });
    }
    const ids = {};
    for (const b of bs) ids[b] = g.accounts[b].id;
    out.push({ name: g.name, bureaus: bs, rows, differ: rows.filter((r) => r.state === "differ").length, timing: rows.filter((r) => r.state === "timing").length, ids });
    for (const row of rows) {
      if (row.state !== "differ") continue;
      const targets = row.odd && row.odd.length ? row.odd : bs;
      for (const b of targets) {
        const a = g.accounts[b];
        let desc, fact;
        if (row.field === "history") {
          desc = row.months.map((x) => us_date(x.month) + ": " + Object.keys(x.values).sort().map((k) => BUREAU_NAMES[k] + " " + x.values[k]).join(", ")).join("; ");
          fact = "The bureaus report different payment ratings for the same months on this account (" + desc + ").";
        } else {
          desc = Object.keys(row.values).sort().map((k) => BUREAU_NAMES[k] + " " + rfmt(row.field !== "status" ? row.field : "pay_status", row.values[k])).join(", ");
          fact = "The bureaus report this account's " + row.field.replace(/_/g, " ") + " differently: " + desc + ".";
        }
        findings.push({ id: "f" + stable_hash("xb|" + b + "|" + a.id + "|" + row.field), rule: "cross_bureau_mismatch", title: RULE.title, group: "Cross-bureau", bureau: b, account_id: a.id,
          subject: subject_of(a), confidence: row.odd && row.odd.length ? "high" : "medium", legal: RULE.legal.slice(), evidence: [{ label: row.field, value: desc }], facts: [fact],
          request: "Please verify this field with the furnisher and correct it so it matches the accurate value.", confirm: [], letter: "bureau_611", then: "furnisher_623",
          impact: 3, speed: 4, status: "open", explain: "Two bureaus cannot both be right about the same field. Dispute with the bureau whose value your records contradict." });
      }
    }
  }
  return { groups: out, differences: out.reduce((s, g) => s + g.differ, 0), timing: out.reduce((s, g) => s + g.timing, 0), findings };
}

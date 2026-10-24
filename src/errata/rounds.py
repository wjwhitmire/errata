"""Round compare and the three-bureau compare.

Round compare: a new report against the previous one from the same bureau: deleted, updated,
unchanged, new, and reinserted (an item that was deleted in an earlier round, or logged as
deleted, and is back). A reinserted item needs the bureau's written notice within 5 business
days (FCRA 611(a)(5)(B)); with no notice on record it becomes a finding.

Three-bureau compare: the same account across bureaus, field by field. A difference that is only
a reporting lag (one bureau's copy is older by about a month and the values match the other
bureau's earlier month) is marked as timing, shown, and not counted. Twin: web/src/core/11_rounds.js.
"""

from .findings import RULES, names_match, subject_of
from .model import BUREAU_NAMES, is_late, visible_digits
from .util import add_business_days, days_between, money_text, month_index, norm_name, stable_hash, us_date

FIELDS = ["balance", "pay_status", "past_due", "credit_limit", "high_balance", "closed", "removal", "remarks"]


def account_key(a):
    return norm_name(a.get("name")) + "|" + visible_digits(a.get("number"))[:6] + "|" + (a.get("opened") or "")[:7]


def _match(olds, a):
    k = account_key(a)
    for o in olds:
        if account_key(o) == k:
            return o
    for o in olds:
        if names_match(o["name"], a["name"]) and (o.get("opened") or "")[:7] == (a.get("opened") or "")[:7] and o.get("opened"):
            return o
    return None


def _val(a, f):
    v = a.get(f)
    if f == "remarks":
        return "; ".join(v or [])
    return v


def _fmt(f, v):
    if v is None or v == "":
        return "none"
    if f in ("balance", "past_due", "credit_limit", "high_balance"):
        return money_text(v)
    if f in ("closed", "removal"):
        return us_date(v)
    return str(v)


def diff(old, new, ctx=None):
    """old, new: normalized reports. ctx: {deleted_keys: [account keys logged as deleted],
    earlier: [older reports], notices: {account key: date of a reinsertion notice}}."""
    ctx = ctx or {}
    logged = set(ctx.get("deleted_keys") or [])
    deleted_before = set(logged)
    for r in ctx.get("earlier") or []:
        ks = {account_key(a) for a in r.get("accounts", [])}
        for k in ks:
            if not any(account_key(a) == k for a in old.get("accounts", [])):
                deleted_before.add(k)
    out = {"deleted": [], "updated": [], "unchanged": [], "new": [], "reinserted": [], "inquiries": {"deleted": [], "new": []},
           "personal": {"removed": [], "added": []}, "findings": []}
    matched = set()
    for a in new.get("accounts", []):
        o = _match(old.get("accounts", []), a)
        if o:
            matched.add(o["id"])
        # an item logged as deleted (from a results letter) that is on the new report came back, even
        # when the older report, pulled before the deletion, still showed it
        if o and account_key(a) not in logged:
            changes = []
            for f in FIELDS:
                if _val(o, f) != _val(a, f):
                    changes.append({"field": f, "old": _fmt(f, _val(o, f)), "new": _fmt(f, _val(a, f))})
            oh = {h["month"]: h["rating"] for h in o.get("history", [])}
            for h in a.get("history", []):
                if h["month"] in oh and oh[h["month"]] != h["rating"]:
                    changes.append({"field": "history " + us_date(h["month"]), "old": oh[h["month"]], "new": h["rating"]})
            row = {"id": a["id"], "old_id": o["id"], "name": a["name"], "number": a.get("number", ""), "changes": changes}
            (out["updated"] if changes else out["unchanged"]).append(row)
        else:
            k = account_key(a)
            row = {"id": a["id"], "name": a["name"], "number": a.get("number", ""), "key": k}
            if k in deleted_before:
                out["reinserted"].append(row)
                notice = (ctx.get("notices") or {}).get(k)
                if not notice:
                    rd = new["source"].get("report_date") or ""
                    f = {
                        "id": "f" + stable_hash("reinserted|" + new.get("bureau", "") + "|" + k), "rule": "reinserted",
                        "title": RULES["reinserted"]["title"], "group": RULES["reinserted"]["group"], "bureau": new.get("bureau", ""),
                        "account_id": a["id"], "subject": subject_of(a), "confidence": "high", "legal": list(RULES["reinserted"]["legal"]),
                        "evidence": [{"label": "Deleted in an earlier round", "value": "yes"}, {"label": "Back on the report dated", "value": us_date(rd)},
                                     {"label": "Reinsertion notice on record", "value": "none"}],
                        "facts": [f"The account {subject_of(a)} was deleted from my file after an earlier dispute and appears again on the report dated {us_date(rd)}. "
                                  "I have no written notice of the reinsertion."],
                        "request": "Please send the reinsertion notice and the furnisher's certification, or delete the item.",
                        "confirm": [], "letter": "reinsertion_demand", "then": "cfpb_complaint", "impact": 5, "speed": 4, "status": "open",
                        "explain": "A deleted item may come back only if the furnisher certifies it, and the bureau must tell you in writing within 5 business days.",
                        "notice_due_if_reinserted_on": add_business_days(rd, 5) if rd else "",
                    }
                    out["findings"].append(f)
            else:
                out["new"].append(row)
    for o in old.get("accounts", []):
        if o["id"] not in matched:
            out["deleted"].append({"id": o["id"], "name": o["name"], "number": o.get("number", ""), "key": account_key(o)})
    oq = {(norm_name(q["name"]), d) for q in old.get("inquiries", []) for d in q["dates"] if q["kind"] == "hard"}
    nq = {(norm_name(q["name"]), d) for q in new.get("inquiries", []) for d in q["dates"] if q["kind"] == "hard"}
    out["inquiries"]["deleted"] = [{"name": n, "date": d} for n, d in sorted(oq - nq)]
    out["inquiries"]["new"] = [{"name": n, "date": d} for n, d in sorted(nq - oq)]

    def pset(r):
        p = r.get("personal", {})
        return ({"name:" + n["name"] for n in p.get("names", [])} | {"address:" + x["text"] for x in p.get("addresses", [])} |
                {"phone:" + x["number"] for x in p.get("phones", [])} | {"employer:" + x["name"] for x in p.get("employers", [])})
    po, pn = pset(old), pset(new)
    out["personal"]["removed"] = sorted(po - pn)
    out["personal"]["added"] = sorted(pn - po)
    out["counts"] = {k: len(out[k]) for k in ("deleted", "updated", "unchanged", "new", "reinserted")}
    return out


# ---------------------------------------------------------------- three-bureau compare
def _status_class(a):
    st = (a.get("pay_status") or "").upper()
    if a.get("kind") == "collection":
        return "collection"
    if "charged_off" in a.get("flags", []):
        return "charge-off"
    if "PAID" in st or "CLOSED" in st:
        return "paid or closed"
    if any(w in st for w in ("PAST DUE", "LATE", "DELINQ")):
        return "late"
    return "current"


def _same_account(a, b):
    if not names_match(a["name"], b["name"]):
        return False
    if a.get("opened") and b.get("opened"):
        return a["opened"][:7] == b["opened"][:7]
    va, vb = visible_digits(a.get("number")), visible_digits(b.get("number"))
    return bool(va and vb and (va[:4] == vb[:4]))


def _groups(reports):
    """The same tradeline across bureaus: one group per account, at most one copy per bureau."""
    groups = []
    for r in reports:
        for a in r.get("accounts", []):
            g = next((g for g in groups if r["bureau"] not in g["accounts"] and any(_same_account(a, x) for x in g["accounts"].values())), None)
            if g is None:
                g = {"name": a["name"], "accounts": {}, "reports": {}}
                groups.append(g)
            g["accounts"][r["bureau"]] = a
            g["reports"][r["bureau"]] = r
    return groups


def tradelines(reports, findings):
    """Dispute every bureau that reports it: for each tradeline, the bureaus that report it, the account
    id at each, the findings at each, and for each rule found somewhere the bureaus that report the same
    account where that rule was not found (their copy may be right, or read differently; the person
    checks it before disputing there). Each bureau is disputed only with its own findings."""
    order = {"transunion": 0, "experian": 1, "equifax": 2}
    out = []
    for g in _groups(reports):
        bs = sorted(g["accounts"], key=lambda b: (order.get(b, 9), b))
        ids = {b: g["accounts"][b]["id"] for b in bs}
        per = {b: sorted(f["id"] for f in findings if f.get("account_id") == ids[b] and f.get("bureau", b) == b) for b in bs}
        rules = {}
        for b in bs:
            for f in findings:
                if f.get("account_id") == ids[b] and f.get("bureau", b) == b:
                    rules.setdefault(f["rule"], set()).add(b)
        gaps = [{"rule": k, "found": sorted(v, key=lambda b: order.get(b, 9)), "not_found": [b for b in bs if b not in v]}
                for k, v in sorted(rules.items()) if any(b not in v for b in bs)]
        if not any(per.values()):
            continue
        out.append({"name": g["name"], "bureaus": bs, "ids": ids, "findings": per, "gaps": gaps,
                    "all": sorted(x for b in bs for x in per[b])})
    out.sort(key=lambda t: (-len(t["all"]), t["name"]))
    return out


def compare(reports):
    """reports: one per bureau. Returns groups with per-field rows marked same, timing or differ."""
    groups = _groups(reports)
    out = []
    findings = []
    for g in groups:
        bs = sorted(g["accounts"])
        rows = []
        if len(bs) < 2:
            out.append({"name": g["name"], "bureaus": bs, "rows": [], "differ": 0, "timing": 0, "only": bs[0]})
            continue
        upd = {b: g["accounts"][b].get("updated") or g["reports"][b]["source"].get("report_date", "") for b in bs}

        def lagged(field, vals):
            """True when the values differ only because one copy is older: the older copy's value matches
            what the newer copy's own history shows for that older month."""
            if field not in ("balance", "past_due"):
                return False
            dates = [upd[b] for b in bs if upd[b]]
            if len(dates) < 2 or days_between(min(dates), max(dates)) < 20 or days_between(min(dates), max(dates)) > 62:
                return False
            newest = max(bs, key=lambda b: upd[b])
            key = {"balance": "bal", "past_due": "past_due"}[field]
            for b in bs:
                if b == newest or vals[b] == vals[newest]:
                    continue
                m = upd[b][:7]
                h = next((x for x in g["accounts"][newest].get("history", []) if x["month"] == m), None)
                if not h or h.get(key) is None or h.get(key) != vals[b]:
                    return False
            return True

        for field, getter in (("balance", lambda a: a.get("balance")), ("status", _status_class), ("past_due", lambda a: a.get("past_due")),
                              ("opened", lambda a: (a.get("opened") or "")[:7] or None), ("closed", lambda a: (a.get("closed") or "")[:7] or None),
                              ("credit_limit", lambda a: a.get("credit_limit")), ("high_balance", lambda a: a.get("high_balance")),
                              ("removal", lambda a: a.get("removal") or None)):
            vals = {b: getter(g["accounts"][b]) for b in bs}
            known = {b: v for b, v in vals.items() if v is not None}
            if len(set(map(str, known.values()))) <= 1:
                rows.append({"field": field, "values": vals, "state": "same"})
                continue
            state = "timing" if lagged(field, vals) else "differ"
            counts = {}
            for v in known.values():
                counts[str(v)] = counts.get(str(v), 0) + 1
            odd = [b for b, v in known.items() if counts[str(v)] == 1 and len(known) >= 3]
            rows.append({"field": field, "values": vals, "state": state, "odd": odd})
        # payment history months both bureaus report, late at one and current at another
        months = {}
        for b in bs:
            for h in g["accounts"][b].get("history", []):
                months.setdefault(h["month"], {})[b] = h["rating"]
        hist_diff = []
        for m, rs in sorted(months.items()):
            if len(rs) < 2:
                continue
            lates = {b for b, x in rs.items() if is_late(x)}
            oks = {b for b, x in rs.items() if x == "OK"}
            if lates and oks:
                hist_diff.append({"month": m, "values": rs})
        if hist_diff:
            odd = set(bs)
            for x in hist_diff:
                cnt = {}
                for v in x["values"].values():
                    cnt[v] = cnt.get(v, 0) + 1
                odd &= {b for b, v in x["values"].items() if cnt[v] == 1 and len(x["values"]) >= 3}
            rows.append({"field": "history", "values": {}, "state": "differ", "months": hist_diff, "odd": sorted(odd)})
        n_diff = sum(1 for r_ in rows if r_["state"] == "differ")
        n_tim = sum(1 for r_ in rows if r_["state"] == "timing")
        out.append({"name": g["name"], "bureaus": bs, "rows": rows, "differ": n_diff, "timing": n_tim,
                    "ids": {b: g["accounts"][b]["id"] for b in bs}})
        for row in rows:
            if row["state"] != "differ":
                continue
            targets = row.get("odd") or bs
            for b in targets:
                a = g["accounts"][b]
                if row["field"] == "history":
                    desc = "; ".join(us_date(x["month"]) + ": " + ", ".join(f"{BUREAU_NAMES[k]} {v}" for k, v in sorted(x["values"].items())) for x in row["months"])
                    fact = f"The bureaus report different payment ratings for the same months on this account ({desc})."
                else:
                    desc = ", ".join(f"{BUREAU_NAMES[k]} {_fmt(row['field'] if row['field'] != 'status' else 'pay_status', v)}" for k, v in sorted(row["values"].items()))
                    fact = f"The bureaus report this account's {row['field'].replace('_', ' ')} differently: {desc}."
                findings.append({
                    "id": "f" + stable_hash("xb|" + b + "|" + a["id"] + "|" + row["field"]), "rule": "cross_bureau_mismatch",
                    "title": RULES["cross_bureau_mismatch"]["title"], "group": "Cross-bureau", "bureau": b, "account_id": a["id"],
                    "subject": subject_of(a), "confidence": "medium" if not row.get("odd") else "high",
                    "legal": list(RULES["cross_bureau_mismatch"]["legal"]),
                    "evidence": [{"label": row["field"], "value": desc}], "facts": [fact],
                    "request": "Please verify this field with the furnisher and correct it so it matches the accurate value.",
                    "confirm": [], "letter": "bureau_611", "then": "furnisher_623", "impact": 3, "speed": 4, "status": "open",
                    "explain": "Two bureaus cannot both be right about the same field. Dispute with the bureau whose value your records contradict.",
                })
    return {"groups": out, "differences": sum(g["differ"] for g in out), "timing": sum(g["timing"] for g in out), "findings": findings}

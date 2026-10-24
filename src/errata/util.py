"""Small shared helpers: money in integer cents, ISO dates and months, business days, text
normalization and name similarity. Every function here has a twin in web/src/core/01_util.js
and the parity vectors check that both give the same answers."""

import re
from datetime import date, timedelta


class CreditError(ValueError):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message


# ---------------------------------------------------------------- money (integer cents)
_MONEY = re.compile(r"^\(?-?\$?\s*-?[0-9][0-9,]*(\.[0-9]+)?\)?$")


def parse_money(s):
    """'$1,234' -> 123400, '$0' -> 0, '.00000' -> 0, '---' or '' -> None."""
    if s is None:
        return None
    t = str(s).strip().replace(" ", "")
    if not t or t in ("---", "--", "-", "N/A", "n/a"):
        return None
    if t.startswith(".") and re.fullmatch(r"\.[0-9]+", t):
        t = "0" + t
    if not _MONEY.match(t):
        return None
    neg = t.startswith("-") or t.startswith("(") or "$-" in t
    digits = re.sub(r"[^0-9.]", "", t)
    if digits.count(".") > 1 or not digits.strip("."):
        return None
    whole, _, frac = digits.partition(".")
    frac = (frac + "00")[:2]
    v = int(whole or "0") * 100 + int(frac)
    return -v if neg else v


def money_text(c, cents=False):
    if c is None:
        return ""
    neg = c < 0
    c = abs(int(c))
    d, r = divmod(c, 100)
    s = f"{d:,}"
    if cents or r:
        s += f".{r:02d}"
    return ("-$" if neg else "$") + s


# ---------------------------------------------------------------- dates and months
_MDY = re.compile(r"^(\d{1,2})/(\d{1,2})/(\d{4})$")
_MY = re.compile(r"^(\d{1,2})/(\d{4})$")
_ISO = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _valid(y, m, d):
    try:
        date(y, m, d)
        return True
    except ValueError:
        return False


def parse_date(s):
    """'10/23/2026' -> '2026-10-23'; ISO passes through; anything else -> None."""
    if s is None:
        return None
    t = str(s).strip()
    m = _MDY.match(t)
    if m:
        mo, d, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return f"{y:04d}-{mo:02d}-{d:02d}" if _valid(y, mo, d) else None
    m = _ISO.match(t)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return t if _valid(y, mo, d) else None
    return None


def parse_month(s):
    """'05/2031' -> '2031-05'; 'Sep 2025' -> '2025-09'; '2031-05' passes; a full date gives its month."""
    if s is None:
        return None
    t = str(s).strip()
    m = _MY.match(t)
    if m:
        mo, y = int(m.group(1)), int(m.group(2))
        return f"{y:04d}-{mo:02d}" if 1 <= mo <= 12 else None
    m = re.match(r"^([A-Z][a-z]{2})\s+(\d{4})$", t)
    if m and m.group(1) in MONTHS:
        return f"{int(m.group(2)):04d}-{MONTHS.index(m.group(1)) + 1:02d}"
    if re.match(r"^\d{4}-\d{2}$", t) and 1 <= int(t[5:7]) <= 12:
        return t
    d = parse_date(t)
    return d[:7] if d else None


def to_date(iso):
    return date(int(iso[0:4]), int(iso[5:7]), int(iso[8:10]))


def iso(d):
    return f"{d.year:04d}-{d.month:02d}-{d.day:02d}"


def add_days(iso_s, n):
    return iso(to_date(iso_s) + timedelta(days=n))


def days_between(a, b):
    """Days from a to b (b - a)."""
    return (to_date(b) - to_date(a)).days


def month_index(ym):
    return int(ym[0:4]) * 12 + int(ym[5:7]) - 1


def month_from_index(i):
    return f"{i // 12:04d}-{i % 12 + 1:02d}"


def add_months(ym, n):
    return month_from_index(month_index(ym) + n)


def months_between(a, b):
    """Whole months from month a to month b (b - a)."""
    return month_index(b) - month_index(a)


def add_months_date(iso_s, n):
    """A date n months later, clamped to the end of a shorter month."""
    y, m, d = int(iso_s[0:4]), int(iso_s[5:7]), int(iso_s[8:10])
    i = y * 12 + m - 1 + n
    y2, m2 = i // 12, i % 12 + 1
    last = [31, 29 if (y2 % 4 == 0 and (y2 % 100 != 0 or y2 % 400 == 0)) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m2 - 1]
    return f"{y2:04d}-{m2:02d}-{min(d, last):02d}"


def month_label(ym):
    return MONTHS[int(ym[5:7]) - 1] + " " + ym[0:4] if ym else ""


def us_date(iso_s):
    if not iso_s:
        return ""
    if len(iso_s) == 7:
        return iso_s[5:7] + "/" + iso_s[0:4]
    return iso_s[5:7] + "/" + iso_s[8:10] + "/" + iso_s[0:4]


def long_date(iso_s):
    names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
             "November", "December"]
    return f"{names[int(iso_s[5:7]) - 1]} {int(iso_s[8:10])}, {iso_s[0:4]}"


# ---------------------------------------------------------------- business days
# Legal public holidays (5 U.S.C. 6103), observed on the Friday before a Saturday holiday and the
# Monday after a Sunday holiday. Reg F counts "excluding legal public holidays, Saturdays and
# Sundays" (12 CFR 1006.34); the FCRA's "business days" are counted the same way here.

def _nth_weekday(y, m, weekday, n):
    d = date(y, m, 1)
    d += timedelta(days=(weekday - d.weekday()) % 7)
    return d + timedelta(days=7 * (n - 1))


def _last_weekday(y, m, weekday):
    d = date(y, m + 1, 1) - timedelta(days=1) if m < 12 else date(y, 12, 31)
    return d - timedelta(days=(d.weekday() - weekday) % 7)


def _observed(d):
    if d.weekday() == 5:
        return d - timedelta(days=1)
    if d.weekday() == 6:
        return d + timedelta(days=1)
    return d


def holidays(y):
    out = [
        _observed(date(y, 1, 1)), _nth_weekday(y, 1, 0, 3), _nth_weekday(y, 2, 0, 3), _last_weekday(y, 5, 0),
        _observed(date(y, 6, 19)), _observed(date(y, 7, 4)), _nth_weekday(y, 9, 0, 1), _nth_weekday(y, 10, 0, 2),
        _observed(date(y, 11, 11)), _nth_weekday(y, 11, 3, 4), _observed(date(y, 12, 25)),
    ]
    # New Year's Day of the next year observed on Friday, December 31
    if date(y + 1, 1, 1).weekday() == 5:
        out.append(date(y, 12, 31))
    return sorted(iso(d) for d in out)


def is_business_day(iso_s):
    d = to_date(iso_s)
    return d.weekday() < 5 and iso_s not in holidays(d.year)


def add_business_days(iso_s, n):
    d = iso_s
    k = 0
    while k < n:
        d = add_days(d, 1)
        if is_business_day(d):
            k += 1
    return d


# ---------------------------------------------------------------- text
def norm_space(s):
    return re.sub(r"\s+", " ", str(s or "")).strip()


def norm_name(s):
    """Upper case letters and digits only, single spaces: for matching creditor and person names."""
    t = re.sub(r"[^A-Z0-9 ]+", " ", str(s or "").upper())
    return re.sub(r"\s+", " ", t).strip()


def edit_distance(a, b):
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def slug(s):
    t = re.sub(r"[^a-z0-9]+", "-", str(s or "").lower()).strip("-")
    return t[:40] or "x"


def stable_hash(s):
    """FNV-1a 32-bit as 8 hex digits: short stable ids that both languages compute alike."""
    h = 0x811C9DC5
    for ch in str(s).encode("utf-8"):
        h ^= ch
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f"{h:08x}"

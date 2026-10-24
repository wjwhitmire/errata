"""Build src/errata/nanp.py, the table of North American Numbering Plan area codes.

The authority is the North American Numbering Plan Administrator (NANPA), whose NPA report lists
every area code and its status. Its site does not allow automated downloads, so the table is
derived from the per-area-code data in Google's libphonenumber, which tracks NANPA assignments,
through its Python release `phonenumbers` (Apache License 2.0), pinned by version and SHA-256:

    pip download --no-deps --no-binary :all: phonenumbers==9.0.40
    python tools/nanp.py phonenumbers-9.0.40.tar.gz

The archive is read as data: its geodata and region files are parsed as text and its number
patterns are compiled with Python's own re module; none of its code is imported or run.
The output lists each area code in service with its kind and place. A code that is not listed is
not in service in the plan as of the pinned release (it may be planned, reserved or unassigned).
"""

import hashlib
import io
import json
import re
import sys
import tarfile
from pathlib import Path

VERSION = "9.0.40"
ARCHIVE_SHA256 = "a0dd1bc98efa0b6f5839c7b1fface2ebdf0a811645dd8211ae3f037a17ec07ac"
OUT = Path(__file__).resolve().parent.parent / "src" / "errata" / "nanp.py"

STATES = {"AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California", "CO": "Colorado",
          "CT": "Connecticut", "DE": "Delaware", "DC": "District of Columbia", "FL": "Florida", "GA": "Georgia",
          "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
          "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland", "MA": "Massachusetts",
          "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri", "MT": "Montana",
          "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico",
          "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
          "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina", "SD": "South Dakota",
          "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont", "VA": "Virginia", "WA": "Washington",
          "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
          "AB": "Alberta", "BC": "British Columbia", "MB": "Manitoba", "NB": "New Brunswick",
          "NL": "Newfoundland and Labrador", "NS": "Nova Scotia", "ON": "Ontario", "PE": "Prince Edward Island",
          "QC": "Quebec", "SK": "Saskatchewan"}
REGIONS = {"AG": "Antigua and Barbuda", "AI": "Anguilla", "AS": "American Samoa", "BB": "Barbados", "BM": "Bermuda",
           "BS": "Bahamas", "DM": "Dominica", "DO": "Dominican Republic", "GD": "Grenada", "GU": "Guam",
           "JM": "Jamaica", "KN": "Saint Kitts and Nevis", "KY": "Cayman Islands", "LC": "Saint Lucia",
           "MP": "Northern Mariana Islands", "MS": "Montserrat", "PR": "Puerto Rico", "SX": "Sint Maarten",
           "TC": "Turks and Caicos Islands", "TT": "Trinidad and Tobago", "VC": "Saint Vincent and the Grenadines",
           "VG": "British Virgin Islands", "VI": "U.S. Virgin Islands", "US": "", "CA": ""}
PLACE_FIX = {"Washington D.C.": "District of Columbia", "Washington State": "Washington", "Philadelphia": "Pennsylvania",
             "Nova Scotia/Prince Edward Island": "Nova Scotia and Prince Edward Island",
             "Northwest Territories/Nunavut/Yukon": "Northwest Territories, Nunavut and Yukon"}
SAMPLE_NXX = ["201", "234", "256", "312", "345", "389", "412", "456", "478", "523", "567", "589", "623", "678",
              "690", "712", "789", "801", "823", "890", "912", "987", "998"]


def place_name(raw):
    raw = PLACE_FIX.get(raw, raw)
    m = re.match(r"^.*,\s*([A-Z]{2})$", raw)
    if m and m.group(1) in STATES:
        return STATES[m.group(1)]
    return raw


def build(archive):
    data = Path(archive).read_bytes()
    got = hashlib.sha256(data).hexdigest()
    if got != ARCHIVE_SHA256:
        raise SystemExit(f"{archive}: SHA-256 {got} does not match the pin {ARCHIVE_SHA256}")
    files = {}
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tf:
        for m in tf.getmembers():
            if m.isfile() and re.search(r"/phonenumbers/(geodata/data\d+|data/region_[A-Z]{2})\.py$", m.name):
                files[m.name.rsplit("/", 2)[-2] + "/" + m.name.rsplit("/", 1)[-1]] = tf.extractfile(m).read().decode("utf-8")
    # place names: the area-code entry, or else the most common state among its exchange entries
    place, votes = {}, {}
    for name, text in files.items():
        if not name.startswith("geodata/"):
            continue
        for m in re.finditer(r"'1([2-9]\d\d)(\d*)':\{([^}]*)\}", text):
            en = re.search(r"'en':\s*u?'([^']*)'", m.group(3))
            if not en:
                continue
            if not m.group(2):
                place[m.group(1)] = place_name(en.group(1))
            else:
                p = place_name(en.group(1))
                if p in STATES.values():
                    votes.setdefault(m.group(1), {}).setdefault(p, 0)
                    votes[m.group(1)][p] += 1
    kinds = {}
    for name, text in files.items():
        if not name.startswith("data/") or "country_code=1," not in text:
            continue
        region = name[len("data/region_"):-3]
        for kind in ("fixed_line", "mobile", "toll_free", "premium_rate", "personal_number", "voip", "uan"):
            m = re.search(kind + r"=PhoneNumberDesc\(national_number_pattern='([^']*)'", text)
            if not m:
                continue
            pat = re.compile(m.group(1).replace("\\\\", "\\"))
            for npa in range(200, 1000):
                s = str(npa)
                if any(pat.fullmatch(s + x + ln) for x in SAMPLE_NXX for ln in ("1234", "5678", "0199", "9876")):
                    kinds.setdefault(s, {}).setdefault(kind, set()).add(region)
    table = {}
    for npa, ks in sorted(kinds.items()):
        regions = sorted(set().union(*ks.values()))
        if "fixed_line" in ks or "mobile" in ks:
            where = place.get(npa) or (max(votes[npa].items(), key=lambda kv: (kv[1], kv[0]))[0] if npa in votes else "")
            if not where:
                where = "; ".join(REGIONS.get(r, r) for r in regions if REGIONS.get(r, r))
            table[npa] = ["geographic", where]
        elif "toll_free" in ks:
            table[npa] = ["toll_free", ""]
        elif "premium_rate" in ks:
            table[npa] = ["premium", ""]
        elif "personal_number" in ks:
            table[npa] = ["personal", ""]
        else:
            table[npa] = ["non_geographic", ""]
    return table


def write(table):
    body = json.dumps(table, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(body.encode("utf-8")).hexdigest()
    text = (
        '"""North American Numbering Plan area codes in service: written by tools/nanp.py. Do not edit by hand.\n\n'
        "Source: NANPA assignments as carried in Google libphonenumber, Python release phonenumbers "
        f"{VERSION} (archive SHA-256 {ARCHIVE_SHA256}).\n"
        "Kinds: geographic (with its state, province or country), toll_free, personal (5XX personal\n"
        "communications services), premium (900) and non_geographic. A code that is not listed is not in\n"
        "service in the plan as of that release. TABLE_SHA256 is the SHA-256 of TABLE as compact sorted JSON.\n"
        '"""\n\n'
        f'SOURCE = {{"name": "NANPA area code assignments via Google libphonenumber (phonenumbers {VERSION})", '
        f'"version": "{VERSION}", "archive_sha256": "{ARCHIVE_SHA256}", '
        '"url": "https://www.nationalnanpa.com/reports/reports_npa.html", '
        f'"data_url": "https://pypi.org/project/phonenumbers/{VERSION}/"}}\n'
        f'TABLE_SHA256 = "{digest}"\n'
        "TABLE = " + body + "\n"
    )
    OUT.write_text(text, encoding="utf-8")
    print(f"wrote {OUT} with {len(table)} area codes, table SHA-256 {digest}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    write(build(sys.argv[1]))

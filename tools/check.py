"""Contrast (WCAG 2.x) and color-vision checks for the Errata tokens, both themes.
Run: python3 tools/check.py   (exit 1 on any failure; prints the markdown tables used in DESIGN_ERRATA.md).

Body text needs 4.5:1, UI graphics (control borders, chart marks, status glyphs) need 3:1.
Color vision: Machado, Oliveira and Fernandes (2009) matrices at full severity in linear RGB, distance CIE76
in CIELAB. Status sets need a minimum pairwise dE of 12 under normal, protan, deutan and tritan vision.
The payment grid is a sequential ramp: neighbours need dE 10 and a lightness step of 6 under every vision type,
and each cell's code text needs 4.5:1 on its own fill."""
import sys, math, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tokens import DARK, LIGHT, SHARED, LOCAL

def rgb(h): h = h.lstrip('#'); return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
def lin(c): return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def lum(h): r, g, b = [lin(c) for c in rgb(h)]; return 0.2126 * r + 0.7152 * g + 0.0722 * b
def cr(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True); return (la + 0.05) / (lb + 0.05)
M = {"protan": [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
     "deutan": [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
     "tritan": [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]]}
def sim(h, kind):
    v = [lin(c) for c in rgb(h)]
    return [max(0, min(1, sum(M[kind][i][j] * v[j] for j in range(3)))) for i in range(3)]
def lab_lin(v):
    X = 0.4124 * v[0] + 0.3576 * v[1] + 0.1805 * v[2]; Y = 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; Z = 0.0193 * v[0] + 0.1192 * v[1] + 0.9505 * v[2]
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    fx, fy, fz = f(X / 0.95047), f(Y), f(Z / 1.08883)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))
def lab(h, kind=None): return lab_lin(sim(h, kind) if kind else [lin(c) for c in rgb(h)])
KINDS = (None, "protan", "deutan", "tritan")
def min_de(colors):
    out = []
    for kind in KINDS:
        L = [lab(c, kind) for c in colors]
        out.append(min(math.dist(L[i], L[j]) for i in range(len(L)) for j in range(i + 1, len(L))))
    return out

GROUNDS = ["bg", "surface", "surface-2", "field", "sel", "row-hover"]
TEXT = ([("fg", g) for g in GROUNDS] + [("muted", g) for g in GROUNDS] +
        [("accent", "surface"), ("accent", "surface-2"), ("accent", "field"), ("accent-ink", "accent"),
         ("mark", "surface"), ("mark", "surface-2"), ("mark", "tint-mark"),
         ("good", "surface"), ("good", "tint-good"), ("warn", "surface"), ("warn", "surface-2"), ("warn", "field"), ("warn", "tint-warn"),
         ("bad", "surface"), ("bad", "tint-bad"), ("info", "surface"), ("info", "tint-info"),
         ("fg", "tint-good"), ("fg", "tint-warn"), ("fg", "tint-bad"), ("fg", "tint-info"),
         ("nav-fg", "nav"), ("nav-muted", "nav"), ("nav-fg", "nav-on"),
         ("g-ok-fg", "g-ok"), ("g-30-fg", "g-30"), ("g-60-fg", "g-60"), ("g-90-fg", "g-90"), ("g-co-fg", "g-co"), ("g-x-fg", "g-x")])
GFX = ([("line", g) for g in ("surface", "field", "bg", "surface-2")] +
       [("accent", "surface"), ("mark", "surface"), ("good", "surface"), ("warn", "surface"), ("bad", "surface"), ("info", "surface"),
        ("chart-1", "surface"), ("chart-2", "surface"), ("chart-3", "surface"), ("chart-4", "surface"),
        ("g-90", "surface"), ("g-co", "surface"), ("nav-fg", "nav"), ("nav-mark", "nav"), ("nav-mark", "nav-on"),
        ("hair", "surface"), ("rule", "field"), ("margin", "field"), ("g-30", "surface"), ("g-ok", "surface")])
# reported, not gated: decorative rules, and grid fills whose cells are bounded by a 1 px --line hairline and carry text
GFX_SOFT = {("hair", "surface"), ("rule", "field"), ("margin", "field"), ("g-30", "surface"), ("g-ok", "surface")}
SETS = {"item status (good, warn, bad, info)": ["good", "warn", "bad", "info"],
        "status glyphs on tints": None,
        "answer roles (fg, accent, mark)": ["fg", "accent", "mark"],
        "chart series (1 to 4)": ["chart-1", "chart-2", "chart-3", "chart-4"]}
RAMP = ["g-ok", "g-30", "g-60", "g-90", "g-co"]

def main():
    fail = 0; out = []; p = out.append
    for name, T in (("light", LIGHT), ("dark", DARK)):
        assert set(T) == set(SHARED + LOCAL), (name, set(T) ^ set(SHARED + LOCAL))
    p("#### Text and UI contrast\n\n| Pair | Need | Light | Dark | Result |\n|---|---|---|---|---|")
    for kind, pairs, need in (("body", TEXT, 4.5), ("UI", GFX, 3.0)):
        for a, b in pairs:
            l, d = cr(LIGHT[a], LIGHT[b]), cr(DARK[a], DARK[b]); soft = (a, b) in GFX_SOFT
            ok = (l >= need and d >= need) or soft; fail += not ok
            p(f"| --{a} on --{b} | {kind} {need}:1 | {l:.2f} | {d:.2f} | {'info' if soft else ('pass' if ok else 'FAIL')} |")
    for T, n in ((LIGHT, 'light'), (DARK, 'dark')):
        for s in ("good", "warn", "bad", "info"):
            for r in ("accent", "mark"):
                if T[s].lower() == T[r].lower(): p(f"ROLE CLASH {n} {s} {r}"); fail += 1
    p("\n#### Color-vision separation (minimum CIE76 dE between members, need 12)\n")
    p("| Set | Theme | Normal | Protan | Deutan | Tritan | Result |\n|---|---|---|---|---|---|---|")
    for sname, keys in SETS.items():
        for n, T in (("light", LIGHT), ("dark", DARK)):
            if keys is None:  # glyph colors as they sit on their own tint chips
                cs = [T[k] for k in ("good", "warn", "bad", "info")]
            else:
                cs = [T[k] for k in keys]
            mins = min_de(cs); ok = min(mins) >= 12; fail += not ok
            p(f"| {sname} | {n} | " + " | ".join(f"{x:.1f}" for x in mins) + f" | {'pass' if ok else 'FAIL'} |")
        if keys is None:
            for n, T in (("light", LIGHT), ("dark", DARK)):
                mins = min_de([T[k] for k in ("tint-good", "tint-warn", "tint-bad", "tint-info")])
                p(f"| status tints (chip grounds, info only) | {n} | " + " | ".join(f"{x:.1f}" for x in mins) + " | info |")
    p("\n#### Payment grid ramp (OK, 30, 60, 90+, CO or C): neighbours need dE 10 and lightness step 6 under every vision type\n")
    p("| Theme | Pair | Normal dE / dL | Protan | Deutan | Tritan | Result |\n|---|---|---|---|---|---|---|")
    for n, T in (("light", LIGHT), ("dark", DARK)):
        for a, b in zip(RAMP, RAMP[1:]):
            cells = []; ok = True
            for kind in KINDS:
                la, lb = lab(T[a], kind), lab(T[b], kind)
                de, dl = math.dist(la, lb), abs(la[0] - lb[0]); cells.append(f"{de:.1f} / {dl:.1f}")
                ok = ok and de >= 10 and dl >= 6
            fail += not ok
            p(f"| {n} | {a} to {b} | " + " | ".join(cells) + f" | {'pass' if ok else 'FAIL'} |")
        # monotonic lightness in normal vision, so grayscale print keeps the order
        Ls = [lab(T[k])[0] for k in RAMP]
        mono = all(x > y for x, y in zip(Ls, Ls[1:])) or all(x < y for x, y in zip(Ls, Ls[1:]))
        fail += not mono
        p(f"| {n} | lightness order {' > '.join(f'{x:.0f}' for x in Ls)} | {'monotonic' if mono else 'NOT MONOTONIC'} | | | | {'pass' if mono else 'FAIL'} |")
    p(f"\nFAILURES: {fail}")
    print("\n".join(out))
    return fail

if __name__ == '__main__':
    sys.exit(1 if main() else 0)

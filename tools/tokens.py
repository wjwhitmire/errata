"""Errata design tokens: the single source of truth for DESIGN_ERRATA.md, specimen.html and the checks.

Concept: Statement and Legal Pad. Chrome is statement paper and pine ink. Color is reserved for the
status of an item (removed, in dispute, deadline, reported late) and for one answer per view, set in
copper ink over an accountant's double rule."""

SHARED = ["bg", "surface", "surface-2", "hair", "line", "fg", "muted", "accent", "accent-ink", "mark", "good", "warn", "bad",
          "field", "chart-1", "chart-2", "chart-3", "chart-4", "chart-grid"]
LOCAL = ["info", "tint-good", "tint-warn", "tint-bad", "tint-info", "tint-mark", "sel", "row-hover",
         "nav", "nav-fg", "nav-muted", "nav-on", "nav-mark", "rule", "margin",
         "g-ok", "g-ok-fg", "g-30", "g-30-fg", "g-60", "g-60-fg", "g-90", "g-90-fg", "g-co", "g-co-fg", "g-x", "g-x-fg"]

# Light: "Statement paper". Cool paper with a breath of green, pine ink, copper for the one answer.
LIGHT = {
    "bg": "#eaede8", "surface": "#fcfcfa", "surface-2": "#f1f3ee", "hair": "#dbe0d8", "line": "#717a72",
    "fg": "#17201c", "muted": "#4b5550", "accent": "#1e5048", "accent-ink": "#ffffff", "mark": "#8c3a0e",
    "good": "#007a44", "warn": "#8b6500", "bad": "#962527", "field": "#ffffff",
    "chart-1": "#1e5048", "chart-2": "#8c3a0e", "chart-3": "#868d87", "chart-4": "#3d5ea6", "chart-grid": "#e1e5df",
    "info": "#004696", "tint-good": "#e3f1e7", "tint-warn": "#f7ecd6", "tint-bad": "#f8e5ea", "tint-info": "#e4ebf7",
    "tint-mark": "#f8e9df", "sel": "#e2e9e4", "row-hover": "#f4f6f2",
    "nav": "#173a35", "nav-fg": "#f1f5f2", "nav-muted": "#b5c6c0", "nav-on": "#24524b", "nav-mark": "#f1a477",
    "rule": "#dfe6ee", "margin": "#d9a48a",
    # payment grid: one warm ramp from paper to oxblood; every cell also carries its code in text
    "g-ok": "#eef3ee", "g-ok-fg": "#3c4a42", "g-30": "#f1d48f", "g-30-fg": "#4a3200", "g-60": "#eba877", "g-60-fg": "#3d1a00",
    "g-90": "#b14e2d", "g-90-fg": "#ffffff", "g-co": "#6e1d2c", "g-co-fg": "#ffffff", "g-x": "#f1f3ee", "g-x-fg": "#5a635d",
}
# Dark: "Night ledger". Deep green-black desk, chalk ink, lit copper; status brightened, never neon.
DARK = {
    "bg": "#0e1311", "surface": "#151b18", "surface-2": "#1c2420", "hair": "#29322d", "line": "#7a857e",
    "fg": "#e5ebe7", "muted": "#a5b0a9", "accent": "#8fd1c0", "accent-ink": "#0e1714", "mark": "#f1a477",
    "good": "#77c489", "warn": "#fcc571", "bad": "#ff97c0", "field": "#111714",
    "chart-1": "#8fd1c0", "chart-2": "#f1a477", "chart-3": "#7c8680", "chart-4": "#cab5ff", "chart-grid": "#232b27",
    "info": "#cab5ff", "tint-good": "#16301f", "tint-warn": "#33280f", "tint-bad": "#3a1a23", "tint-info": "#231e3b",
    "tint-mark": "#38221a", "sel": "#22302b", "row-hover": "#1a211e",
    "nav": "#0a0f0d", "nav-fg": "#e5ebe7", "nav-muted": "#9fb0a8", "nav-on": "#1f3a34", "nav-mark": "#f1a477",
    "rule": "#1f2a33", "margin": "#6b3f2c",
    "g-ok": "#1c2621", "g-ok-fg": "#c4d0c8", "g-30": "#4d3c0e", "g-30-fg": "#fbe9bf", "g-60": "#8c4f22", "g-60-fg": "#ffe6d4",
    "g-90": "#c56a48", "g-90-fg": "#1a0a05", "g-co": "#f0a3b2", "g-co-fg": "#2a0710", "g-x": "#1a211e", "g-x-fg": "#98a39c",
}

# Item states: a glyph and a word first, color second.
STATUS = {
    "Removed": ("good", "check in a circle; name struck through with a single rule; Literata italic stamp"),
    "In dispute": ("info", "open circle with a clock hand"),
    "Deadline near": ("warn", "hourglass"),
    "Reported late": ("bad", "small filled square; neutral words, never 'bad' or 'derogatory'"),
    "Reinserted": ("bad", "return arrow in a square; always with the 5 business day note"),
    "Verified": ("muted", "check without circle, muted; not a failure, a next step"),
}
GRID = [("OK", "g-ok"), ("30", "g-30"), ("60", "g-60"), ("90+", "g-90"), ("CO / C", "g-co"), ("X", "g-x")]

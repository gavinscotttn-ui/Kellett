#!/usr/bin/env python3
"""Bundle the workspace into one self-contained HTML file.

Reads index.html, inlines every stylesheet and script in order, turns every
image into a data URI, and writes dist/KellettHoldings.html — a single file
that opens offline with nothing beside it.

The Content Security Policy is rebuilt as it goes: the inlined scripts are
hashed and the policy names those hashes, so the bundle keeps a strict
script policy rather than falling back to 'unsafe-inline'.

    python3 build.py
"""

import base64
import hashlib
import mimetypes
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "index.html"
OUT_DIR = ROOT / "dist"
OUT = OUT_DIR / "KellettHoldings.html"

CSS_RE = re.compile(r'[ \t]*<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>\s*\n?')
JS_RE = re.compile(r'[ \t]*<script src="([^"]+)"></script>\s*\n?')
IMG_RE = re.compile(r'(?:src|href)="((?:assets|css|js)/[^"]+)"')
CSP_RE = re.compile(r'<meta http-equiv="Content-Security-Policy" content="[^"]*">')


def read(rel: str) -> str:
    path = ROOT / rel
    if not path.is_file():
        sys.exit(f"build: missing {rel}")
    return path.read_text(encoding="utf-8")


def data_uri(rel: str) -> str:
    path = ROOT / rel
    if not path.is_file():
        sys.exit(f"build: missing asset {rel}")
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def main() -> None:
    html = SRC.read_text(encoding="utf-8")

    css_files = CSS_RE.findall(html)
    js_files = JS_RE.findall(html)
    if not css_files or not js_files:
        sys.exit("build: found no stylesheets or scripts to inline")

    css_bodies = [f"/* ===== {f} ===== */\n{read(f)}" for f in css_files]
    js_bodies = [f"\n/* ===== {f} ===== */\n{read(f)}\n" for f in js_files]

    # Strip the tags that are being replaced, so an asset path left in a
    # <link> or <script> href cannot be mistaken for a real reference.
    html = CSS_RE.sub("", html)
    html = JS_RE.sub("", html)

    # Inline every asset FIRST, across the page and the scripts alike, so the
    # script hashes below are taken from the bytes the browser will actually
    # execute. Getting this order wrong silently breaks the whole bundle.
    referenced = set(IMG_RE.findall(html))
    for body in js_bodies + css_bodies:
        referenced.update(IMG_RE.findall(body))

    uris = {rel: data_uri(rel) for rel in referenced}
    for rel in sorted(referenced, key=len, reverse=True):
        html = html.replace(rel, uris[rel])
        js_bodies = [b.replace(rel, uris[rel]) for b in js_bodies]
        css_bodies = [b.replace(rel, uris[rel]) for b in css_bodies]

    style_block = "<style>\n" + "\n\n".join(css_bodies) + "\n</style>"

    # One <script> per source file, in dependency order, so a stack trace
    # still names the module it came from.
    hashes = []
    script_blocks = []
    for body in js_bodies:
        digest = base64.b64encode(hashlib.sha256(body.encode("utf-8")).digest()).decode("ascii")
        hashes.append(f"'sha256-{digest}'")
        script_blocks.append("<script>" + body + "</script>")

    html = html.replace("</head>", style_block + "\n</head>", 1)
    html = html.replace("</body>", "\n".join(script_blocks) + "\n</body>", 1)

    csp = (
        "default-src 'none'; "
        "script-src " + " ".join(hashes) + "; "
        "style-src 'unsafe-inline'; "
        "img-src data:; "
        "font-src data:; "
        "connect-src 'none'; "
        "base-uri 'none'; "
        "form-action 'none'"
    )
    html = CSP_RE.sub(
        '<meta http-equiv="Content-Security-Policy" content="' + csp + '">', html, count=1
    )

    OUT_DIR.mkdir(exist_ok=True)
    OUT.write_text(html, encoding="utf-8")

    print(f"built {OUT.relative_to(ROOT)}  \u2014  {OUT.stat().st_size / 1024 / 1024:.2f} MB")
    print(f"  {len(css_files)} stylesheets, {len(js_files)} scripts, "
          f"{len(referenced)} assets inlined")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Assemble les morceaux en un index.html autonome, polices comprises."""
import base64, pathlib, datetime
H = pathlib.Path(__file__).parent
FONTS = {"__FONT_JUNGLEDISE__":"jungledise.woff2","__FONT_CAPRASIMO_LAT__":"caprasimo-latin.woff2",
         "__FONT_CAPRASIMO_EXT__":"caprasimo-latin-ext.woff2","__FONT_FIGTREE_LAT__":"figtree-latin.woff2",
         "__FONT_FIGTREE_EXT__":"figtree-latin-ext.woff2"}
head = (H/"part1_head.html").read_text(encoding="utf-8")
for k,n in FONTS.items():
    head = head.replace(k, "data:font/woff2;base64," + base64.b64encode((H/"fonts"/n).read_bytes()).decode())
parts = ["part2_body.html","part3_data.js","part4_logic.js","part5_sync.js"]
qr = '<script>/*! qrcode-generator 2.0.4 — Kazuhiko Arase — licence MIT */\n' + (H/"qrcode.min.js").read_text(encoding="utf-8") + '\n</scr'+'ipt>\n'
parts_after = ["part6_share.js","part7_pwa.js"]
out = head + "".join((H/p).read_text(encoding="utf-8") for p in parts) + qr + "".join((H/p).read_text(encoding="utf-8") for p in parts_after)
build = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d-%H%M")
out = out.replace("__APP_BUILD__", build)
(H/"index.html").write_text(out, encoding="utf-8")
print("build :", build)
print("index.html :", len(out.encode()) // 1024, "Ko")

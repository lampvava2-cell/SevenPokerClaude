#!/bin/sh
# Build the lab page: artifact body (lab.html) and standalone page (index.html)
cd "$(dirname "$0")"
OUT=${1:-.}
{ cat lab_head.html lab_body.html physics3d.js lab_app.js; echo '</script>'; } > "$OUT/lab.html"
{ echo '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'; cat lab_head.html; echo '</head><body>'; cat lab_body.html physics3d.js lab_app.js; echo '</script></body></html>'; } > "$OUT/index.html"

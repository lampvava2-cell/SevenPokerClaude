#!/bin/sh
# Build the 2D physics lab: artifact body (lab2d.html) and standalone page (index.html)
cd "$(dirname "$0")"
{ cat lab2d_head.html lab2d_body.html physics3d.js sound_clacks.js lab2d_app.js; echo '</script>'; } > lab2d.html
{ echo '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'; cat lab2d_head.html; echo '</head><body>'; cat lab2d_body.html physics3d.js sound_clacks.js lab2d_app.js; echo '</script></body></html>'; } > index.html

#!/usr/bin/env bash
# Regenerate README screenshots from the _*.html source mockups.
# Requires Google Chrome installed in /Applications.
set -euo pipefail
cd "$(dirname "$0")"

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ ! -x "$CHROME" ]; then
  echo "Chrome not found at $CHROME"
  exit 1
fi

render() {
  local src="$1" out="$2" w="$3" h="$4"
  echo "  $out  ($w x $h)"
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --screenshot="$PWD/$out" \
    --window-size="$w,$h" \
    "file://$PWD/$src" > /dev/null 2>&1
}

echo "Rendering screenshots..."
render _floating-demo.html       floating-on-desktop.png 800 450
render _floating-multi-demo.html floating-multi.png      800 450
render _trend-demo.html          trend-chart.png         640 380
render _settings-demo.html       settings.png            520 720

echo "Done. Output:"
ls -la *.png

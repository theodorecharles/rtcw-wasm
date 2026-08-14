#!/usr/bin/env bash
set -euo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
"$ROOT/scripts/build-web-sp.sh"
"$ROOT/scripts/build-web-mp.sh"
"$ROOT/scripts/test-web.sh"

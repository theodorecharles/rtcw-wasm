#!/usr/bin/env bash
set -euo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SITE="$ROOT/web/sp"

required=(
	index.html launcher.js asset-spec.js
	client/sp/iowolfsp.js client/sp/iowolfsp.wasm
	client/sp/main/vm/cgame.sp.qvm client/sp/main/vm/qagame.sp.qvm client/sp/main/vm/ui.sp.qvm
	client/mp/iowolfmp.js client/mp/iowolfmp.wasm
	client/mp/main/vm/cgame.mp.qvm client/mp/main/vm/qagame.mp.qvm client/mp/main/vm/ui.mp.qvm
)
for path in "${required[@]}"; do
	[[ -s "$SITE/$path" ]] || { echo "Missing RTCW web artifact: $path" >&2; exit 1; }
done

if find "$SITE" -type f \( -iname '*.pk3' -o -iname '*.pak' -o -iname '*.data' \) -print -quit | grep -q .; then
	echo "Retail-bearing file found under $SITE" >&2
	exit 1
fi

node --check "$SITE/asset-spec.js"
node --check "$SITE/launcher.js"
node --check "$SITE/client/sp/iowolfsp.js"
node --check "$SITE/client/mp/iowolfmp.js"

for wasm in "$SITE/client/sp/iowolfsp.wasm" "$SITE/client/mp/iowolfmp.wasm"; do
	[[ "$(od -An -tx1 -N4 "$wasm" | tr -d ' \n')" == '0061736d' ]] || {
		echo "Invalid WebAssembly magic: $wasm" >&2
		exit 1
	}
done

for qvm in "$SITE"/client/{sp,mp}/main/vm/*.qvm; do
	[[ "$(od -An -tx1 -N4 "$qvm" | tr -d ' \n')" == '45147212' ]] || {
		echo "Invalid QVM magic: $qvm" >&2
		exit 1
	}
done

rg -q 'loopbackHosts' "$SITE/launcher.js"
rg -q 'SHA-256 verification failed' "$SITE/launcher.js"
rg -q 'module\.callMain' "$SITE/launcher.js"
rg -q 'sp_pak4\.pk3' "$SITE/asset-spec.js"

echo "RTCW SP+MP static browser artifact checks passed."

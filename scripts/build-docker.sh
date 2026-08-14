#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
image="${IMAGE_REPO:-theodorecharles/rtcw-wasm}:${IMAGE_TAG:-dev}"

for artifact in \
  web/sp/index.html \
  web/sp/asset-manifest.json \
  web/sp/client/iowolfsp.js \
  web/sp/client/iowolfsp.wasm \
  web/sp/client/main/vm/cgame.sp.qvm \
  web/sp/client/main/vm/qagame.sp.qvm \
  web/sp/client/main/vm/ui.sp.qvm \
  SP/build/release-linux-x86_64/iowolfsp.x86_64 \
  MP/build/release-linux-x86_64/iowolfded.x86_64 \
  MP/build/release-linux-x86_64/iowolfmp.x86_64; do
  test -s "$repo_root/$artifact" || {
    echo "Missing $artifact; run scripts/build-web-sp.sh and scripts/build-server.sh first." >&2
    exit 1
  }
done

docker build --platform linux/amd64 \
  --build-arg "VCS_REF=$(git -C "$repo_root" rev-parse HEAD)" \
  --tag "$image" "$repo_root"
echo "Built $image"

#!/usr/bin/env bash
set -euo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
JOBS=${JOBS:-8}
NATIVE_BUILD=build
WEB_BUILD=build/web
NATIVE_OUT="$ROOT/MP/$NATIVE_BUILD/release-linux-x86_64"
WEB_OUT="$ROOT/MP/$WEB_BUILD/release-emscripten-wasm32"
CLIENT_OUT="$ROOT/web/sp/client/mp"

if ! command -v emcc >/dev/null 2>&1 || ! command -v emmake >/dev/null 2>&1; then
	EMSDK_ENV=${EMSDK_ENV:-}
	if [ -z "$EMSDK_ENV" ] && [ -n "${EMSDK_DIR:-}" ]; then
		EMSDK_ENV="$EMSDK_DIR/emsdk_env.sh"
	fi
	if [ -z "$EMSDK_ENV" ] || [ ! -f "$EMSDK_ENV" ]; then
		echo "Activate Emscripten first, or set EMSDK_ENV/EMSDK_DIR to an emsdk checkout." >&2
		exit 1
	fi
	# shellcheck disable=SC1090
	. "$EMSDK_ENV" >/dev/null
fi

# Build MP cgame/qagame/UI QVMs with native tools before invoking Emscripten.
make -C "$ROOT/MP" -j"$JOBS" \
	BUILD_DIR="$NATIVE_BUILD" \
	BUILD_CLIENT=0 BUILD_SERVER=0 BUILD_GAME_SO=0 \
	BUILD_GAME_QVM=1 BUILD_BASEGAME=1 \
	TOOLS_CC='gcc -std=gnu17'

emmake make -C "$ROOT/MP" -j"$JOBS" \
	PLATFORM=emscripten ARCH=wasm32 BUILD_DIR="$WEB_BUILD" \
	BUILD_SERVER=0 BUILD_CLIENT=1 BUILD_GAME_SO=0 BUILD_GAME_QVM=0 \
	BUILD_RENDERER_REND2=0 USE_RENDERER_DLOPEN=0 \
	USE_OPENGLES=1 \
	USE_OPENAL=0 USE_CURL=0 USE_MUMBLE=0 USE_VOIP=0 \
	USE_CODEC_VORBIS=0 USE_CODEC_OPUS=0 USE_FREETYPE=0

mkdir -p "$CLIENT_OUT/main/vm"
install -m 0644 "$WEB_OUT/iowolfmp.js" "$CLIENT_OUT/iowolfmp.js"
install -m 0644 "$WEB_OUT/iowolfmp.wasm" "$CLIENT_OUT/iowolfmp.wasm"
install -m 0644 "$NATIVE_OUT/main/vm/cgame.mp.qvm" "$CLIENT_OUT/main/vm/cgame.mp.qvm"
install -m 0644 "$NATIVE_OUT/main/vm/qagame.mp.qvm" "$CLIENT_OUT/main/vm/qagame.mp.qvm"
install -m 0644 "$NATIVE_OUT/main/vm/ui.mp.qvm" "$CLIENT_OUT/main/vm/ui.mp.qvm"

echo "RTCW MP browser artifacts written to $CLIENT_OUT"

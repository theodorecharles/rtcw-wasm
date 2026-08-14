#!/usr/bin/env bash
set -euo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
EMSDK_ENV=${EMSDK_ENV:-/home/ted/emsdk/emsdk_env.sh}
JOBS=${JOBS:-8}
NATIVE_BUILD=build
WEB_BUILD=build/web
NATIVE_OUT="$ROOT/SP/$NATIVE_BUILD/release-linux-x86_64"
WEB_OUT="$ROOT/SP/$WEB_BUILD/release-emscripten-wasm32"
CLIENT_OUT="$ROOT/web/sp/client"

if [ ! -f "$EMSDK_ENV" ]; then
	echo "Emscripten environment not found: $EMSDK_ENV" >&2
	echo "Set EMSDK_ENV to the absolute path of emsdk_env.sh." >&2
	exit 1
fi

# QVM tools must remain native executables. GNU C17 also avoids GCC 15's C23
# constexpr keyword collision in ioRTCW's historical lcc sources.
make -C "$ROOT/SP" -j"$JOBS" \
	BUILD_DIR="$NATIVE_BUILD" \
	BUILD_CLIENT=0 BUILD_SERVER=0 BUILD_GAME_SO=0 \
	BUILD_GAME_QVM=1 BUILD_BASEGAME=1 \
	TOOLS_CC='gcc -std=gnu17'

# shellcheck disable=SC1090
. "$EMSDK_ENV" >/dev/null
emmake make -C "$ROOT/SP" -j"$JOBS" \
	PLATFORM=emscripten ARCH=wasm32 BUILD_DIR="$WEB_BUILD" \
	BUILD_SERVER=0 BUILD_CLIENT=1 BUILD_GAME_SO=0 BUILD_GAME_QVM=0 \
	BUILD_RENDERER_REND2=0 USE_RENDERER_DLOPEN=0 \
	USE_OPENAL=0 USE_CURL=0 USE_MUMBLE=0 USE_VOIP=0 \
	USE_CODEC_VORBIS=0 USE_CODEC_OPUS=0 USE_FREETYPE=0

mkdir -p "$CLIENT_OUT/main/vm"
install -m 0644 "$WEB_OUT/iowolfsp.js" "$CLIENT_OUT/iowolfsp.js"
install -m 0644 "$WEB_OUT/iowolfsp.wasm" "$CLIENT_OUT/iowolfsp.wasm"
install -m 0644 "$NATIVE_OUT/main/vm/cgame.sp.qvm" "$CLIENT_OUT/main/vm/cgame.sp.qvm"
install -m 0644 "$NATIVE_OUT/main/vm/qagame.sp.qvm" "$CLIENT_OUT/main/vm/qagame.sp.qvm"
install -m 0644 "$NATIVE_OUT/main/vm/ui.sp.qvm" "$CLIENT_OUT/main/vm/ui.sp.qvm"

echo "RTCW SP browser artifacts written to $CLIENT_OUT"

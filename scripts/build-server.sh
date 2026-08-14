#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
JOBS=${JOBS:-8}

make -C "$ROOT/MP" -j"$JOBS" \
	BUILD_CLIENT=0 BUILD_SERVER=1 BUILD_GAME_SO=1 BUILD_GAME_QVM=0 BUILD_BASEGAME=1 \
	USE_OPENAL=0 USE_CURL=0 USE_MUMBLE=0 USE_VOIP=0 \
	USE_CODEC_VORBIS=0 USE_CODEC_OPUS=0 USE_FREETYPE=0

echo "RTCW dedicated server written under $ROOT/MP/build/release-linux-x86_64"

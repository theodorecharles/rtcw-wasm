#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SOURCE_MAIN=${1:-${RTCW_MAIN_DIR:-}}
MANIFEST="$ROOT/runtime/asset-manifest.json"

SP_FILES='pak0.pk3 sp_pak1.pk3 sp_pak2.pk3 sp_pak3.pk3'
MP_FILES='mp_bin.pk3 mp_pak0.pk3 mp_pak1.pk3 mp_pak2.pk3 mp_pak3.pk3 mp_pak4.pk3 mp_pak5.pk3 mp_pakmaps0.pk3 mp_pakmaps1.pk3 mp_pakmaps2.pk3 mp_pakmaps3.pk3 mp_pakmaps4.pk3 mp_pakmaps5.pk3 mp_pakmaps6.pk3'

if [ -z "$SOURCE_MAIN" ]; then
	echo "usage: RTCW_MAIN_DIR=/path/to/RTCW/Main $0" >&2
	echo "   or: $0 /path/to/RTCW/Main" >&2
	exit 2
fi

if [ ! -d "$SOURCE_MAIN" ]; then
	echo "RTCW Main directory not found: $SOURCE_MAIN" >&2
	echo "Set RTCW_MAIN_DIR to a legally installed RTCW Main directory." >&2
	exit 1
fi

missing=0
for file in $SP_FILES $MP_FILES; do
	if [ ! -s "$SOURCE_MAIN/$file" ]; then
		echo "Missing required retail data: Main/$file" >&2
		missing=1
	fi
done
if [ "$missing" -ne 0 ]; then
	exit 1
fi

mkdir -p "$ROOT/runtime"
node "$ROOT/scripts/write-data-manifest.mjs" "$SOURCE_MAIN" $SP_FILES $MP_FILES > "$MANIFEST"
echo "Validated RTCW SP and MP retail data at $SOURCE_MAIN"
echo "Wrote ignored local manifest: $MANIFEST"
echo "No retail file or symlink was placed in the web tree."

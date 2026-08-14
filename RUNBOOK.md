# RTCW WebAssembly runbook

Read `/home/ted/Development/wasm/RUNBOOK.md` before changing this repository. This is a downstream-only browser port of the native ioRTCW SP and MP source trees. Do not copy an existing browser/WASM port, submit changes upstream, open upstream issues, or push to the `upstream` remote.

## Verified checkpoint (2026-08-14)

The real SP and MP engines now compile with Emscripten and run in Chromium through the shared loopback portal.

- SP: authentic title/main menu renders; `spmap escape1` starts the native integrated server, loads the qagame/cgame/UI QVMs, initializes BotLib plus both AAS worlds, connects the loopback client, receives an active snapshot, and renders the authentic mission briefing.
- MP: authentic animated multiplayer title/main menu renders from the real MP engine and UI QVM.
- Both clients use a cooperative `requestAnimationFrame` main loop. The browser event loop is never blocked.
- The native fixed-function renderer runs through Emscripten's GLES/WebGL 2 legacy-GL bridge.
- SDL2 keyboard events, absolute menu mouse input, and explicit pointer-lock capture are wired. The launcher does not steal browser shortcuts before capture.
- The launcher captures player name, SP/MP mode, Low/Medium/High/Ultra ceiling, and 30/60/120 FPS target before engine startup.
- Config/save state is mounted at `/persist` with IDBFS. Retail PK3s are streamed into transient MEMFS at `/game/main`, marked read-only, and are not written to browser persistence.
- Adaptive quality is deliberately shown as a disabled next milestone; the manual profiles and FPS cvars are active.
- Optional browser audio codecs/OpenAL, external MP transport/dedicated-server lifecycle, cinematics, save/reload persistence testing, and a full renderer/input regression pass remain unfinished.

The checked-in output path used by the portfolio portal is:

```text
/home/ted/Development/wasm/rtcw-wasm/web/sp
```

Generated client artifacts live below ignored paths:

```text
web/sp/client/sp/iowolfsp.{js,wasm}
web/sp/client/sp/main/vm/{cgame.sp,qagame.sp,ui.sp}.qvm
web/sp/client/mp/iowolfmp.{js,wasm}
web/sp/client/mp/main/vm/{cgame.mp,qagame.mp,ui.mp}.qvm
```

## Native-only provenance and repository boundaries

Source authority, in order:

1. owner-installed Return to Castle Wolfenstein data and native game behavior;
2. this repository's native ioRTCW SP and MP trees;
3. the original id source documents already present in those trees;
4. `wolfet-wasm` only as an architectural reference for generic id Tech 3 browser mechanics.

No third-party RTCW WebAssembly/browser port was used. All browser changes are bounded with `__EMSCRIPTEN__` or the Emscripten Makefile target so native builds remain intact. Keep proprietary data outside Git, build outputs, Docker images, and public static roots.

The `upstream` push URL is intentionally disabled. `origin` is the downstream repository. Do not contact upstream.

## Owner data contract

The staged owner data is outside this repository:

```text
/home/ted/Development/wasm/data/rtcw/Main
```

The portal mounts `/home/ted/Development/wasm/data/rtcw` read-only at `/owner-data` and exposes it only through the loopback-bound `/local-data/` route. The launcher refuses owner-data import unless the page hostname is `localhost`, `127.0.0.1`, or `::1`.

Before import, every expected path is checked by HEAD for exact length. During streaming import, every file is checked for its expected length, ZIP/PK3 signature, and pinned SHA-256 from `web/sp/asset-spec.js`. A mismatch aborts startup. Generated QVMs are separately checked for VM2 magic before being mounted read-only.

SP requires:

```text
Main/pak0.pk3
Main/sp_pak1.pk3
Main/sp_pak2.pk3
Main/sp_pak3.pk3
Main/sp_pak4.pk3
```

MP requires `Main/pak0.pk3`, `Main/mp_bin.pk3`, `Main/mp_pak0.pk3` through `Main/mp_pak5.pk3`, and `Main/mp_pakmaps0.pk3` through `Main/mp_pakmaps6.pk3`.

Validate an owner install without copying anything:

```bash
cd /home/ted/Development/wasm/rtcw-wasm
RTCW_MAIN_DIR=/home/ted/Development/wasm/data/rtcw/Main ./scripts/setup-data.sh
```

This writes only the ignored `runtime/asset-manifest.json`; it never links or copies retail files into `web/`.

## Build

The verified Emscripten checkout is `/home/ted/emsdk`. Build both clients and both sets of QVMs with:

```bash
cd /home/ted/Development/wasm/rtcw-wasm
EMSDK_DIR=/home/ted/emsdk JOBS=8 ./scripts/build-web.sh
```

The wrapper runs `build-web-sp.sh`, `build-web-mp.sh`, and `test-web.sh`. Native host tools build the QVMs with GNU C17; Emscripten builds the engine clients with SDL2, WebGL 2, legacy fixed-function GL emulation, memory growth, IDBFS support, and exported `Module.callMain`/`FS`/`IDBFS`. Optional OpenAL, curl, Mumble, VoIP, Vorbis, Opus, FreeType, renderer dlopen, and native game shared objects are disabled for this milestone.

Run static validation independently with:

```bash
./scripts/test-web.sh
```

It checks required artifacts, JavaScript syntax, WASM and QVM magic, strict asset/import contracts, and that no retail-bearing file exists under the served tree.

## Run through the portfolio portal

```bash
cd /home/ted/Development/wasm/portal
docker compose up -d rtcw
```

Open exactly:

```text
http://127.0.0.1:8085/
```

Do not use a non-loopback hostname: owner-data import is intentionally denied there.

### Exact Chromium handoff: SP

1. Open `http://127.0.0.1:8085/`.
2. Select **Single Player**, enter a player name, choose a quality ceiling and FPS target, then select **Play**.
3. Wait while the page validates and hashes approximately 636 MB of owner data. The authentic RTCW main menu should appear.
4. To exercise the current deep smoke quickly, focus the canvas, press `~` to open the in-engine console, enter `spmap escape1`, and press Enter.
5. Wait for the mission briefing. Move the in-engine pointer to the lower-right arrow and click it to begin the level.
6. Select **Capture mouse** only after gameplay is visible; Escape releases pointer lock. Browser copy/find/hard-refresh shortcuts remain available while capture is off.

Observed automated milestone: authentic menu, native `escape1` server/QVM/AAS initialization, active client snapshot, and mission briefing. The final briefing-arrow-to-live-3D transition still needs a manual pointer check; automation highlighted the authentic control but did not activate it reliably.

### Exact Chromium handoff: MP

1. Reload `http://127.0.0.1:8085/`.
2. Select **Multiplayer** and **Play**.
3. Wait while the page validates and hashes approximately 463 MB of owner data.
4. Confirm the animated authentic RTCW multiplayer title/menu appears.

The MP browser client is real, but WebSocket-to-UDP transport, native dedicated-server wake/idle lifecycle, server connection, and bots are not yet implemented. Do not claim network play yet.

Stop the local lane after testing:

```bash
cd /home/ted/Development/wasm/portal
docker compose stop rtcw
```

## Important implementation details

- `Com_Frame` skips the native sleep loop under Emscripten. `emscripten_set_main_loop` schedules one frame per browser animation frame.
- Native code used the sleep window to drain fragmented loopback netchan packets. The browser path explicitly calls `SV_SendQueuedPackets()` once per frame so large gamestate messages complete.
- Local and bot clients bypass rate throttling. Nonpositive startup rates are clamped, preventing a WebAssembly divide-by-zero during connection setup.
- `Sys_ConsoleInput` never invokes a browser prompt. The engine's own console remains the command surface.
- The renderer binds linked legacy-GL shims for fixed-function calls that WebGL's proc lookup does not advertise. Unsupported single-buffer and immediate-mode helpers are narrowly replaced for this renderer.
- Menu input remains absolute until the explicit **Capture mouse** gesture obtains pointer lock. Only then does SDL enter relative mode and grab the canvas.
- The launcher sets one 4:3 canvas transform and lets the native UI/HUD render into it, avoiding independent HTML HUD geometry.

## Next blockers, in order

1. Manually verify/fix activation of the SP pregame arrow and prove rendered, controllable live 3D gameplay; then complete keyboard/mouse/pause/console/save/reload regression tests.
2. Enable an SDL/Web Audio-compatible sound path and verify owner audio assets.
3. Add native MP dedicated server plus same-origin WebSocket-to-UDP bridge, connection status, eight-player bot backfill, and wake/idle shutdown.
4. Implement measured 30/60/120 FPS adaptive quality hysteresis; do not enable the launcher toggle before it is real.
5. Verify cinematics and provide a browser codec fallback only if the native path cannot play them.
6. Run focused visual tests for fog, sky, lightmaps, particles, models, HUD, loading screens, widescreen transforms, and menu cinematics.

Upstream contacted: no. Upstream submissions: prohibited.

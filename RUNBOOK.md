# rtcw-wasm implementation runbook

Read `/home/ted/Development/wasm/RUNBOOK.md` first. It defines shared browser-shell, input, graphics, data, lifecycle, Docker, test, and coordination rules. This file defines the RTCW-specific path.

## Objective

Ship Return to Castle Wolfenstein's real single-player campaign and multiplayer client/server in the browser. Use ioRTCW's separate SP and MP codebases, original menus/HUD/loading screens, campaign AI, cinematics, renderer, sound, saves, console, multiplayer classes/objectives/chat/scoreboard, and compatible bots. Reuse the browser mechanics proven in `wolfet-wasm` without pretending RTCW and Enemy Territory are identical.

## Current checkpoint

- Downstream repository: `theodorecharles/rtcw-wasm`.
- Implementation base: `iortcw/iortcw`.
- Work branch: `devel`.
- Original references belong in ignored `references/rtcw-sp-source/` and `references/rtcw-mp-source/`.
- Steam app 9010 is fully installed at `/home/ted/.steam/debian-installation/steamapps/common/Return to Castle Wolfenstein`.
- Single-player and multiplayer PK3 sets are present under `Main/`.
- ioRTCW builds separate `iowolfsp`, `iowolfmp`, and dedicated-server paths. Preserve that separation internally even if the web launcher presents one coherent product.
- No Emscripten target is assumed. Port the known-good id Tech 3 platform changes from `wolfet-wasm` selectively and compile early.

## Wave 1 compile checkpoint

- Native `iowolfsp`, its OpenGL renderers, and SP cgame/qagame/UI modules build on Linux.
- Native `iowolfmp`, `iowolfded`, MP cgame/qagame/UI modules, and MP QVMs build on Linux. GCC 15 requires the host QVM tools to use GNU C17 because their historical `constexpr` function name conflicts with C23.
- `scripts/build-web-sp.sh` deterministically builds the real SP engine and OpenGL 1 renderer as `iowolfsp.js` plus `iowolfsp.wasm`, and packages freshly built SP cgame/qagame/UI QVMs beside them.
- The Emscripten client uses SDL2, WebGL 2 legacy-GL emulation, an animation-frame main loop, and no OpenAL/curl/Mumble/VoIP/renderer dlopen for this first compile checkpoint.
- `scripts/setup-data.sh` validates the separately documented SP and MP PK3 sets, writes an ignored local size/SHA-256 manifest, and exposes the owner-installed `Main` directory only through an ignored symlink. `sp_pak4.pk3` remains outside the required SP manifest because ioRTCW's documented copy list does not require it.
- Browser title/menu execution is not yet claimed. The first runtime blocker is mounting the ignored PK3s and generated QVMs into Emscripten's filesystem before `callMain`; the tracked diagnostics page reports this boundary explicitly.

### Docker checkpoint (2026-08-14)

- `scripts/build-docker.sh` builds `theodorecharles/rtcw-wasm:dev` for `linux/amd64` from the real SP WASM/QVM artifacts and native SP/MP/dedicated baselines.
- The image serves the diagnostic page and `/health` on port 8088, mounts owner data at `/data`, and contains zero retail PK3 files. Title/menu execution remains unclaimed.

### Chrome checkpoint (2026-08-14)

- A clean `scripts/setup-data.sh && scripts/build-web-sp.sh` rebuild passed with Emscripten 6.0.6 and staged the SP engine, renderer, and three freshly built QVMs.
- Chrome loaded the tracked diagnostic launcher over HTTP and reported valid engine JavaScript, WebAssembly, and QVM artifacts with no browser-console warnings or errors.
- This is an artifact/launcher milestone, not an engine-start milestone. The next blocking task is to mount owner-selected PK3s and the generated QVMs into Emscripten's filesystem before starting the authentic SP engine.
- No retail PK3 was copied into the tracked web output or served by the diagnostic page.

## Downstream-only rule

Do not submit anything upstream. Do not open or comment on ioRTCW or id Software pull requests, issues, discussions, or releases. Do not message maintainers. Never push to `upstream`. All generated work stays in `theodorecharles/rtcw-wasm`.

## Source authority

Use this order:

1. the Steam RTCW client in actual SP and MP play;
2. ignored id references for original RTCW behavior;
3. ioRTCW for maintained implementation;
4. `wolfet-wasm` for browser mechanics and known id Tech 3/Emscripten solutions.

When copying from `wolfet-wasm`, identify the original problem and verify RTCW's corresponding code. Do not blindly copy ET-specific UI allocation sizes, cvars, entity types, protocol assumptions, HUD coordinates, or gameplay changes.

## Retail data manifests

ioRTCW documents these campaign files:

```text
Main/pak0.pk3
Main/sp_pak1.pk3
Main/sp_pak2.pk3
Main/sp_pak3.pk3
```

The local Steam install also contains `sp_pak4.pk3`; inspect version/patch behavior before deciding whether it is required.

Multiplayer files present and documented include:

```text
Main/mp_bin.pk3
Main/mp_pak0.pk3 ... Main/mp_pak5.pk3
Main/mp_pakmaps0.pk3 ... Main/mp_pakmaps6.pk3
```

Build separate ordered SP and MP manifests from the actual install, with path, size, and local checksum. Never track or publish the PK3s. Owner-mounted Docker data normalizes to `/data/Main`; custom PK3s use writable `/data/custom_maps` and are never mixed into the immutable retail manifest.

## Native baselines and first web compile

Prove both native trees first using ioRTCW's documented make flow. Then establish independent Emscripten targets:

```text
scripts/build-web-sp.sh   -> iowolfsp.js + iowolfsp.wasm
scripts/build-web-mp.sh   -> iowolfmp.js + iowolfmp.wasm
scripts/build-server.sh   -> native iowolfded
scripts/setup-data.sh     -> ignored, validated Main data
```

Start from the simplest renderer and statically linked SP/MP game/UI modules. For initial web builds disable optional native-only OpenAL, curl/dlopen, Mumble, VoIP capture, renderer dlopen, crash handlers, and process spawning. Re-enable browser-compatible audio after the main loop and renderer work.

Use `__EMSCRIPTEN__` boundaries. Keep native ioRTCW builds working.

## One product, two engine clients

The original product separates SP and MP executables. The browser must expose both through authentic engine UI without spawning a native process.

Implement a small module router:

1. The outer launcher validates the profile and common data.
2. Starting the SP module shows the authentic RTCW main menu.
3. Its Single Player choices remain in-engine.
4. Its Multiplayer menu action requests a clean transition: sync saves/config, shut down SP main loop, reset canvas/input/audio state, validate MP data, wake the dedicated server, and load the MP module.
5. MP can return to the common launcher or load SP through the inverse clean transition.

Do not load both multi-megabyte clients simultaneously. Do not fake their menus in HTML. Preserve visible transition/loading status.

## Single-player acceptance

- Start a new campaign at multiple difficulties.
- Render introductory movies or document a temporary browser codec fallback.
- Verify AI actors, scripted sequences, doors, movers, weapons, particles, fog, sky, dynamic lights, models, decals, and objectives.
- Complete a map transition.
- Save, reload the page, restore persistent storage, and load the save.
- Verify pause/menu, death/reload, cutscene input release, and campaign completion state.

SP uses IDBFS/OPFS for saves/configs and never wakes the multiplayer dedicated process.

## Multiplayer transport and lifecycle

Reuse the proven same-origin boundary:

```text
iowolfmp WASM <-> /ws <-> bounded UDP bridge <-> native iowolfded
```

Port the existing WolfET bridge only after comparing RTCW protocol framing. Wake on confirmed Multiplayer intent before engine connection. Show connecting, awaiting challenge/gamestate, map loading, and awaiting snapshot text.

Default maintained population is eight if compatible ioRTCW bots work reliably. The ioRTCW command surface includes bot commands, but a worker must prove bots navigate stock maps and are distinguishable from humans. Reserve one transient slot, remove bots as humans connect, and count only humans for idle shutdown.

Test classes/teams, objective play, limbo/spawn UI where applicable, chat, scoreboard, voice-menu UI, voting/admin surfaces, death/respawn, spectating, map restart/change, and reconnect.

## Renderer port priorities

Compare `wolfet-wasm` patches for:

- SDL Emscripten window/canvas creation;
- statically linked renderer and VM/game/UI modules;
- WebGL 2/GLES translation and unsupported GL extension reporting;
- alpha test/blend correctness;
- lightmap texture coordinates and flicker;
- sky stages and far clip;
- model/entity visibility in first-person and spectator views;
- UI allocation capacity;
- 640x480 virtual UI aspect and cursor transforms;
- non-blocking Emscripten main loop;
- browser audio initialization;
- bounded diagnostic logging.

Apply the smallest RTCW-specific change and test it. Expected visual surfaces include castle/interior lightmaps, foliage/grates, smoke/flame particles, weapon effects, lamps/flares, skies/fog, player models, HUD face/head view, loading screens, console, and menu cinematics.

## Input contract

Port the proven WolfET keyboard pipeline only after mapping RTCW key catcher and UI state. Explicitly test:

- WASD/arrows and mouselook;
- Escape main/pause/back navigation;
- console toggle, `/`, Backspace, Enter, and Up/Down history;
- Tab scoreboard and Ctrl bindings;
- global/team chat keys and voice menu if supported;
- absolute in-engine cursor and correct single-cursor behavior;
- SP cutscenes, death/reload, MP death/respawn, team/class menus, and module switching;
- browser Ctrl+Shift+R/copy/find outside capture.

Never cancel a DOM key and also expect SDL to receive it implicitly.

## Graphics and profiles

Begin at maximum faithful settings supported by WebGL 2. Build Low/Medium/High/Ultra profiles from verified RTCW cvars for texture detail/filtering, anisotropy, dynamic lights, shadows, marks, particles, model LOD, geometry detail, and render scale. Follow shared 30/60/120 FPS hysteresis.

Use one authoritative viewport/UI transform. Menus and loading art letterbox or crop without nonuniform stretch. World-space labels, crosshair, HUD, engine cursor, and 3D projection must align.

## Docker defaults

The image includes two web clients, native dedicated server, bridge, and no retail PK3s:

```text
HTTP_PORT=8088
GAME_SLOTS=8
KEEP_ALIVE=false
IDLE_TIMEOUT=15m
GAME_MODE=vanilla
```

Use `/data/Main` and `/data/custom_maps`. Add trusted-proxy and RCON/admin settings only with conservative defaults. Single-player activity never keeps `iowolfded` awake.

## First worker assignment

1. Finish/verify the ioRTCW checkout and ignored original SP/MP references.
2. Record native SP, MP, and dedicated build commands.
3. Diff the relevant platform/build files against `wolfet-wasm` and identify the minimal first Emscripten target.
4. Compile immediately; fix the first error and repeat until a substantial SP client links.
5. Add deterministic scripts and a missing-data runtime diagnostic.
6. Return the exact SP title/menu browser test handoff to Luna; do not use Chrome.
7. Commit and push the `devel` checkpoint.

## Status handoff

Report SP and MP milestones separately, exact build commands, assets found, artifacts, browser test request, first blocker, and `Upstream contacted: no`.

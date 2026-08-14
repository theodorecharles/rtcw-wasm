const status = document.querySelector("#status");
const engineFiles = [
  "client/iowolfsp.js",
  "client/iowolfsp.wasm",
  "client/main/vm/cgame.sp.qvm",
  "client/main/vm/qagame.sp.qvm",
  "client/main/vm/ui.sp.qvm",
];
const requiredSP = ["Main/pak0.pk3", "Main/sp_pak1.pk3", "Main/sp_pak2.pk3", "Main/sp_pak3.pk3"];

async function exists(path) {
  const response = await fetch(path, { method: "HEAD", cache: "no-store" });
  return response.ok;
}

async function check() {
  let manifest;
  try {
    const response = await fetch("asset-manifest.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    manifest = await response.json();
  } catch (error) {
    throw new Error(`Retail data is not prepared (${error.message}). Run scripts/setup-data.sh.`);
  }

  const declared = new Set(manifest.entries?.map((entry) => entry.path));
  const missingManifest = requiredSP.filter((path) => !declared.has(path));
  const checks = await Promise.all(engineFiles.map(async (path) => [path, await exists(path)]));
  const missingEngine = checks.filter(([, ok]) => !ok).map(([path]) => path);
  if (missingManifest.length || missingEngine.length) {
    throw new Error([
      missingManifest.length ? `Manifest missing: ${missingManifest.join(", ")}` : "",
      missingEngine.length ? `Build missing: ${missingEngine.join(", ")}. Run scripts/build-web-sp.sh.` : "",
    ].filter(Boolean).join("\n"));
  }

  status.textContent = [
    "PASS: RTCW SP engine and renderer WebAssembly artifacts are present.",
    "PASS: cgame, qagame, and UI QVM artifacts are present.",
    "PASS: the ignored local retail-data manifest declares all required SP PK3 paths.",
    "NEXT: mount the PK3/QVM files into Emscripten FS before invoking iowolfsp; title/menu execution is not claimed yet.",
  ].join("\n");
}

check().catch((error) => {
  status.textContent = `BLOCKED: ${error.message}`;
});

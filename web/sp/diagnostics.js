const status = document.querySelector("#status");
const engineFiles = [
  "client/iowolfsp.js",
  "client/iowolfsp.wasm",
  "client/main/vm/cgame.sp.qvm",
  "client/main/vm/qagame.sp.qvm",
  "client/main/vm/ui.sp.qvm",
];
async function exists(path) {
  const response = await fetch(path, { method: "HEAD", cache: "no-store" });
  return response.ok;
}

async function check() {
  const checks = await Promise.all(engineFiles.map(async (path) => [path, await exists(path)]));
  const missingEngine = checks.filter(([, ok]) => !ok).map(([path]) => path);
  if (missingEngine.length) {
    throw new Error(`Build missing: ${missingEngine.join(", ")}. Run scripts/build-web-sp.sh.`);
  }

  status.textContent = [
    "PASS: RTCW SP engine and renderer WebAssembly artifacts are present.",
    "PASS: cgame, qagame, and UI QVM artifacts are present.",
    "PASS: this static site contains engine code only and does not expose mounted retail data.",
    "NEXT: add browser-local PK3 selection, validation, and private storage before invoking iowolfsp; title/menu execution is not claimed yet.",
  ].join("\n");
}

check().catch((error) => {
  status.textContent = `BLOCKED: ${error.message}`;
});

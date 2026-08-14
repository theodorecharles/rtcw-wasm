(() => {
  "use strict";

  const launcher = document.querySelector("#launcher");
  const runtime = document.querySelector("#runtime");
  const canvas = document.querySelector("#canvas");
  const playButton = document.querySelector("#play");
  const captureButton = document.querySelector("#capture");
  const consoleButton = document.querySelector("#show-console");
  const consoleView = document.querySelector("#console");
  const statusView = document.querySelector("#status");
  const progressView = document.querySelector("#progress");
  const modeSelect = document.querySelector("#mode");
  const nameInput = document.querySelector("#player-name");
  const qualitySelect = document.querySelector("#quality");
  const fpsSelect = document.querySelector("#fps");
  const dynamicToggle = document.querySelector("#dynamic-quality");

  const engines = Object.freeze({
    sp: Object.freeze({
      label: "single-player",
      script: "client/sp/iowolfsp.js",
      wasm: "client/sp/iowolfsp.wasm",
      qvms: Object.freeze(["cgame.sp.qvm", "qagame.sp.qvm", "ui.sp.qvm"])
    }),
    mp: Object.freeze({
      label: "multiplayer",
      script: "client/mp/iowolfmp.js",
      wasm: "client/mp/iowolfmp.wasm",
      qvms: Object.freeze(["cgame.mp.qvm", "qagame.mp.qvm", "ui.mp.qvm"])
    })
  });

  const qualityCvars = Object.freeze({
    low: Object.freeze({ r_picmip: "2", r_lodbias: "2", r_subdivisions: "20", r_dynamiclight: "0" }),
    medium: Object.freeze({ r_picmip: "1", r_lodbias: "1", r_subdivisions: "12", r_dynamiclight: "1" }),
    high: Object.freeze({ r_picmip: "0", r_lodbias: "0", r_subdivisions: "8", r_dynamiclight: "1" }),
    ultra: Object.freeze({ r_picmip: "0", r_lodbias: "0", r_subdivisions: "4", r_dynamiclight: "1" })
  });

  const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  let launching = false;
  let totalBytes = 0;
  let completedBytes = 0;

  class Sha256 {
    constructor() {
      this.state = new Uint32Array([
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
      ]);
      this.buffer = new Uint8Array(64);
      this.words = new Uint32Array(64);
      this.bufferLength = 0;
      this.bytesHashed = 0;
      this.finished = false;
    }

    static rotateRight(value, shift) {
      return (value >>> shift) | (value << (32 - shift));
    }

    update(input) {
      if (this.finished) throw new Error("SHA-256 digest is already finalized");
      const data = input instanceof Uint8Array ? input : new Uint8Array(input);
      this.bytesHashed += data.length;
      let offset = 0;

      if (this.bufferLength) {
        const needed = 64 - this.bufferLength;
        const take = Math.min(needed, data.length);
        this.buffer.set(data.subarray(0, take), this.bufferLength);
        this.bufferLength += take;
        offset += take;
        if (this.bufferLength === 64) {
          this.transform(this.buffer, 0);
          this.bufferLength = 0;
        }
      }

      while (offset + 64 <= data.length) {
        this.transform(data, offset);
        offset += 64;
      }

      if (offset < data.length) {
        this.buffer.set(data.subarray(offset), 0);
        this.bufferLength = data.length - offset;
      }
      return this;
    }

    transform(data, offset) {
      const words = this.words;
      const k = Sha256.constants;
      for (let index = 0; index < 16; index += 1) {
        const start = offset + index * 4;
        words[index] = ((data[start] << 24) | (data[start + 1] << 16) |
          (data[start + 2] << 8) | data[start + 3]) >>> 0;
      }
      for (let index = 16; index < 64; index += 1) {
        const x = words[index - 15];
        const y = words[index - 2];
        const sigma0 = Sha256.rotateRight(x, 7) ^ Sha256.rotateRight(x, 18) ^ (x >>> 3);
        const sigma1 = Sha256.rotateRight(y, 17) ^ Sha256.rotateRight(y, 19) ^ (y >>> 10);
        words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
      }

      let [a, b, c, d, e, f, g, h] = this.state;
      for (let index = 0; index < 64; index += 1) {
        const upper1 = Sha256.rotateRight(e, 6) ^ Sha256.rotateRight(e, 11) ^ Sha256.rotateRight(e, 25);
        const choice = (e & f) ^ (~e & g);
        const temp1 = (h + upper1 + choice + k[index] + words[index]) >>> 0;
        const upper0 = Sha256.rotateRight(a, 2) ^ Sha256.rotateRight(a, 13) ^ Sha256.rotateRight(a, 22);
        const majority = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (upper0 + majority) >>> 0;
        h = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
      }

      this.state[0] = (this.state[0] + a) >>> 0;
      this.state[1] = (this.state[1] + b) >>> 0;
      this.state[2] = (this.state[2] + c) >>> 0;
      this.state[3] = (this.state[3] + d) >>> 0;
      this.state[4] = (this.state[4] + e) >>> 0;
      this.state[5] = (this.state[5] + f) >>> 0;
      this.state[6] = (this.state[6] + g) >>> 0;
      this.state[7] = (this.state[7] + h) >>> 0;
    }

    hex() {
      if (!this.finished) {
        const bytesHashed = this.bytesHashed;
        this.buffer[this.bufferLength++] = 0x80;
        if (this.bufferLength > 56) {
          this.buffer.fill(0, this.bufferLength, 64);
          this.transform(this.buffer, 0);
          this.bufferLength = 0;
        }
        this.buffer.fill(0, this.bufferLength, 56);
        const high = Math.floor(bytesHashed / 0x20000000);
        const low = (bytesHashed * 8) >>> 0;
        for (let index = 0; index < 4; index += 1) {
          this.buffer[56 + index] = (high >>> (24 - index * 8)) & 0xff;
          this.buffer[60 + index] = (low >>> (24 - index * 8)) & 0xff;
        }
        this.transform(this.buffer, 0);
        this.finished = true;
      }
      return Array.from(this.state, word => word.toString(16).padStart(8, "0")).join("");
    }
  }

  Sha256.constants = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);

  function appendLog(message, isError = false) {
    const line = String(message);
    consoleView.textContent += `${line}\n`;
    consoleView.scrollTop = consoleView.scrollHeight;
    (isError ? console.error : console.log)("[RTCW WASM]", line);
  }

  function setStatus(message) {
    statusView.textContent = message;
  }

  function updateProgress(fileName, fileBytes) {
    const current = completedBytes + fileBytes;
    progressView.value = totalBytes ? current / totalBytes : 0;
    setStatus(`Preparing ${fileName}… ${Math.floor(progressView.value * 100)}%`);
  }

  function localDataUrl(path) {
    return `/local-data/${path.split("/").map(encodeURIComponent).join("/")}`;
  }

  function validZipHeader(bytes) {
    return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b &&
      ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
       (bytes[2] === 0x05 && bytes[3] === 0x06) ||
       (bytes[2] === 0x07 && bytes[3] === 0x08));
  }

  async function validateAvailability(entries, engine) {
    if (!loopbackHosts.has(location.hostname)) {
      throw new Error("Owner-mounted development import is restricted to loopback URLs");
    }
    const checks = [engine.script, engine.wasm, ...engine.qvms.map(name => `client/${modeSelect.value}/main/vm/${name}`)];
    for (const path of checks) {
      const response = await fetch(path, { method: "HEAD", cache: "no-store" });
      if (!response.ok) throw new Error(`Build artifact is missing: ${path}`);
    }
    for (const entry of entries) {
      const response = await fetch(localDataUrl(entry.path), { method: "HEAD", cache: "no-store" });
      if (!response.ok) throw new Error(`Owner file is missing: ${entry.path}`);
      const length = Number(response.headers.get("Content-Length"));
      if (length !== entry.size) throw new Error(`${entry.path}: expected ${entry.size} bytes, received ${length}`);
    }
  }

  function loadEngine(engine) {
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Engine runtime initialization timed out")), 30000);
      window.Module = {
        canvas,
        noInitialRun: true,
        locateFile: path => new URL(path, new URL(engine.script, location.href)).href,
        print: (...args) => appendLog(args.join(" ")),
        printErr: (...args) => appendLog(args.join(" "), true),
        setStatus,
        onAbort: reason => reject(new Error(`Engine aborted: ${reason}`)),
        onRuntimeInitialized: () => {
          window.clearTimeout(timeout);
          appendLog("Engine runtime initialized; native main remains deferred");
          resolve(window.Module);
        }
      };
      const script = document.createElement("script");
      script.src = engine.script;
      script.async = true;
      script.onerror = () => reject(new Error(`Could not load ${engine.script}`));
      document.body.append(script);
    });
  }

  async function writeResponseToFs(module, response, destination, entry) {
    const parent = destination.slice(0, destination.lastIndexOf("/"));
    module.FS.mkdirTree(parent);
    const stream = module.FS.open(destination, "w+");
    const digest = new Sha256();
    let written = 0;
    let firstBytes = null;
    try {
      if (response.body && response.body.getReader) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
          if (!firstBytes) firstBytes = chunk.slice(0, 4);
          digest.update(chunk);
          module.FS.write(stream, chunk, 0, chunk.length, written);
          written += chunk.length;
          updateProgress(entry.path, written);
          await new Promise(resolve => window.setTimeout(resolve, 0));
        }
      } else {
        const bytes = new Uint8Array(await response.arrayBuffer());
        firstBytes = bytes.slice(0, 4);
        digest.update(bytes);
        module.FS.write(stream, bytes, 0, bytes.length, 0);
        written = bytes.length;
        updateProgress(entry.path, written);
      }
    } finally {
      module.FS.close(stream);
    }

    if (written !== entry.size) throw new Error(`${entry.path}: streamed ${written} bytes, expected ${entry.size}`);
    if (!validZipHeader(firstBytes || new Uint8Array())) throw new Error(`${entry.path}: invalid ZIP/PK3 header`);
    const actualHash = digest.hex();
    if (actualHash !== entry.sha256) throw new Error(`${entry.path}: SHA-256 verification failed`);
    module.FS.chmod(destination, 0o444);
    completedBytes += written;
    updateProgress(entry.path, 0);
    appendLog(`Verified ${entry.path} (${written} bytes)`);
  }

  async function importOwnerData(module, entries) {
    module.FS.mkdirTree("/game/main");
    for (const entry of entries) {
      const response = await fetch(localDataUrl(entry.path), { cache: "no-store" });
      if (!response.ok) throw new Error(`Could not read ${entry.path}: HTTP ${response.status}`);
      const length = Number(response.headers.get("Content-Length"));
      if (length !== entry.size) throw new Error(`${entry.path}: size changed during import`);
      const name = entry.path.slice(entry.path.lastIndexOf("/") + 1).toLowerCase();
      await writeResponseToFs(module, response, `/game/main/${name}`, entry);
    }
  }

  async function importQvms(module, engine, mode) {
    module.FS.mkdirTree("/game/main/vm");
    for (const name of engine.qvms) {
      const path = `client/${mode}/main/vm/${name}`;
      const response = await fetch(path, { cache: "no-store" });
      if (!response.ok) throw new Error(`Could not load generated QVM: ${path}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length < 4 || bytes[0] !== 0x45 || bytes[1] !== 0x14 || bytes[2] !== 0x72 || bytes[3] !== 0x12) {
        throw new Error(`${name}: invalid QVM header`);
      }
      module.FS.writeFile(`/game/main/vm/${name}`, bytes);
      module.FS.chmod(`/game/main/vm/${name}`, 0o444);
      appendLog(`Mounted generated ${name} (${bytes.length} bytes)`);
    }
    module.FS.chmod("/game/main/vm", 0o555);
    module.FS.chmod("/game/main", 0o555);
    module.FS.chmod("/game", 0o555);
  }

  async function mountPersistence(module) {
    module.FS.mkdirTree("/persist");
    module.FS.mount(module.IDBFS, {}, "/persist");
    await new Promise((resolve, reject) => module.FS.syncfs(true, error => error ? reject(error) : resolve()));
    module.FS.mkdirTree("/persist/main");
    window.addEventListener("pagehide", () => module.FS.syncfs(false, () => {}), { once: true });
    appendLog("Restored browser-private configuration/save storage");
  }

  function engineArguments(mode) {
    const width = Math.max(640, Math.round(canvas.getBoundingClientRect().width * devicePixelRatio));
    const height = Math.max(480, Math.round(canvas.getBoundingClientRect().height * devicePixelRatio));
    canvas.width = width;
    canvas.height = height;
    const args = [
      "+set", "fs_basepath", "/game",
      "+set", "fs_homepath", "/persist",
      "+set", "fs_cdpath", "",
      "+set", "fs_game", "",
      "+set", "vm_cgame", "2",
      "+set", "vm_game", "2",
      "+set", "vm_ui", "2",
      "+set", "r_fullscreen", "0",
      "+set", "r_mode", "-1",
      "+set", "r_customwidth", String(width),
      "+set", "r_customheight", String(height),
      "+set", "r_colorbits", "32",
      "+set", "r_texturebits", "32",
      "+set", "r_textureMode", "GL_LINEAR_MIPMAP_LINEAR",
      "+set", "r_primitives", "2",
	  "+set", "r_norefresh", "0",
	  "+set", "r_skipBackEnd", "0",
	  "+set", "cg_norender", "0",
      "+set", "com_maxfps", fpsSelect.value,
      "+set", "com_introplayed", "1",
      "+set", "name", nameInput.value.trim() || "Agent"
    ];
    for (const [name, value] of Object.entries(qualityCvars[qualitySelect.value])) {
      args.push("+set", name, value);
    }
    if (mode === "sp") args.push("+set", "model", "bj2");
    if (mode === "mp") args.push("+set", "cl_motd", "0");
    return args;
  }

  async function launch() {
    if (launching) return;
    launching = true;
    playButton.disabled = true;
    progressView.hidden = false;
    consoleView.textContent = "";
    completedBytes = 0;
    try {
      const mode = modeSelect.value;
      const engine = engines[mode];
      const entries = window.RTCW_ASSET_SPEC[mode];
      totalBytes = entries.reduce((sum, entry) => sum + entry.size, 0);
      localStorage.setItem("rtcw.launch", JSON.stringify({
        mode,
        name: nameInput.value,
        quality: qualitySelect.value,
        fps: fpsSelect.value,
        dynamic: false
      }));

      setStatus(`Checking ${engine.label} engine and owner data…`);
      await validateAvailability(entries, engine);
      appendLog(`Validated ${entries.length} ${engine.label} owner-file paths and sizes`);

      launcher.hidden = true;
      runtime.hidden = false;
      setStatus("Loading engine code…");
      const module = await loadEngine(engine);
      await mountPersistence(module);
      await importOwnerData(module, entries);
      await importQvms(module, engine, mode);

      setStatus(`Starting authentic RTCW ${engine.label} engine…`);
      progressView.value = 1;
      module.callMain(engineArguments(mode));
      canvas.focus();
      appendLog("Native main entered; cooperative browser frame loop scheduled");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendLog(message, true);
      setStatus(`Startup failed: ${message}`);
      launcher.hidden = false;
      runtime.hidden = true;
      playButton.disabled = false;
      progressView.hidden = true;
      launching = false;
    }
  }

  try {
    const saved = JSON.parse(localStorage.getItem("rtcw.launch"));
    if (saved && engines[saved.mode]) modeSelect.value = saved.mode;
    if (saved && typeof saved.name === "string") nameInput.value = saved.name;
    if (saved && qualityCvars[saved.quality]) qualitySelect.value = saved.quality;
    if (saved && ["30", "60", "120"].includes(String(saved.fps))) fpsSelect.value = String(saved.fps);
    dynamicToggle.checked = false;
  } catch (_) {
    // Keep launcher defaults when stored preferences are absent or stale.
  }

  playButton.addEventListener("click", launch);
  captureButton.addEventListener("click", () => {
    canvas.focus();
    if (!document.pointerLockElement) canvas.requestPointerLock();
  });
  consoleButton.addEventListener("click", () => {
    launcher.hidden = false;
    consoleView.scrollIntoView({ block: "end" });
  });
  canvas.addEventListener("contextmenu", event => event.preventDefault());
  document.addEventListener("pointerlockchange", () => {
    captureButton.textContent = document.pointerLockElement === canvas ? "Mouse captured" : "Capture mouse";
  });
  window.addEventListener("error", event => appendLog(event.message, true));
  window.addEventListener("unhandledrejection", event => appendLog(event.reason, true));
})();

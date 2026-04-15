import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import fs from "fs";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = parseInt(process.env.PORT || "3001", 10);
const ROMS_DIR = process.env.ROMS_PATH || path.join(import.meta.dirname, "roms");

const ALLOWED_ORIGINS = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : ["*"];

// CORS
app.use((_req, res, next) => {
  const origin = _req.headers.origin || "*";
  if (ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// --- ROM Hosting ---
// ROMs are organized in folders by system core name:
//   roms/nes/game.zip, roms/arcade/game.zip, etc.
// The folder name IS the core identifier.

const VALID_CORES = new Set([
  "nes",
  "snes",
  "n64",
  "gb",
  "gba",
  "nds",
  "psx",
  "psp",
  "segaMD",
  "segaMS",
  "segaGG",
  "segaSaturn",
  "segaCD",
  "sega32x",
  "mame2003",
  "mame2003_plus",
  "arcade",
  "fbneo",
  "atari2600",
  "atari7800",
  "lynx",
  "jaguar",
  "3do",
  "coleco",
  "vb",
  "dosbox",
]);

app.use("/roms", express.static(ROMS_DIR));

// Core remapping: use better-compatible cores where available
const CORE_REMAP: Record<string, string> = {
  mame2003: "mame2003_plus", // mame2003_plus is a superset with better romset compatibility
  arcade: "fbneo", // 'arcade' CDN core doesn't exist; EmulatorJS maps to fbneo
};

// Serve emulator page — iframe points here so everything is same-origin
app.get("/emulator", (req, res) => {
  const rawCore = String(req.query.core || "nes");
  const ejsCore = CORE_REMAP[rawCore] || rawCore;
  const rom = String(req.query.rom || "");
  const bios = req.query.bios ? String(req.query.bios) : "";
  const role = req.query.role ? String(req.query.role) : "";
  const isNetplay = role === "host" || role === "guest";
  const localPlayer = role === "guest" ? 1 : 0;
  const remotePlayer = role === "guest" ? 0 : 1;

  const html =
    `<!DOCTYPE html>
<html><head>
<style>body{margin:0;background:#111;overflow:hidden}#game{width:100vw;height:100vh}
#error-overlay{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);
color:#ff6b6b;font-family:monospace;padding:40px;box-sizing:border-box;z-index:99999;
white-space:pre-wrap;overflow-y:auto;font-size:14px}
#error-overlay h2{color:#ff6b6b;margin:0 0 16px}
[data-btn="playPause"],[data-btn="play"],[data-btn="pause"],[data-btn="restart"],[data-btn="mute"],[data-btn="unmute"],[data-btn="screenshot"],[data-btn="saveState"],[data-btn="loadState"],[data-btn="quickSave"],[data-btn="quickLoad"],[data-btn="screenRecord"],[data-btn="saveSavFiles"],[data-btn="loadSavFiles"],[data-btn="cacheManager"],[data-btn="cheat"],[data-btn="exitEmulation"],[data-btn="volume"]{display:none!important}
</style>
</head><body>
<div id="game"></div>
<div id="error-overlay"></div>
<script>
  Object.defineProperty(navigator, 'wakeLock', {
    value: { request: function() { return Promise.resolve({ released: false, release: function() { return Promise.resolve(); }, addEventListener: function(){}, removeEventListener: function(){}, onrelease: null, type: 'screen' }); } },
    writable: true, configurable: true
  });
  // Show errors on screen instead of just console
  window.addEventListener('error', function(e) {
    var el = document.getElementById('error-overlay');
    if (el) { el.style.display='block'; el.innerHTML='<h2>Emulator Error</h2>'+
      '<p>Core: ${ejsCore} (requested: ${rawCore})</p>'+
      '<p>ROM: ${rom}</p>'+(e.message||'')+
      '<br><br>'+((e.error&&e.error.stack)||'')+'<br><br>'+
      '<span style="color:#4a6fa5">Tip: ROM이 코어와 호환되지 않을 수 있습니다.</span>'; }
  });
  window.EJS_player = "#game";
  window.EJS_core = "${ejsCore}";
  window.EJS_pathtodata = "https://cdn.emulatorjs.org/stable/data/";
  window.EJS_gameUrl = "/roms/${rom}";
  ${bios ? `window.EJS_biosUrl = "/roms/${bios}";` : ""}
  window.EJS_color = "#00d4ff";
  window.EJS_startOnLoaded = true;
  window.EJS_language = "en";
  window.EJS_gameID = 1;

  window.EJS_Buttons = {
    playPause: false,
    play: false,
    pause: false,
    restart: false,
    mute: false,
    unmute: false,
    settings: true,
    fullscreen: true,
    saveState: false,
    loadState: false,
    screenRecord: false,
    gamepad: true,
    cheat: false,
    volume: false,
    saveSavFiles: false,
    loadSavFiles: false,
    quickSave: false,
    quickLoad: false,
    screenshot: false,
    cacheManager: false,
    exitEmulation: false
  };

  var _isNetplay = ${isNetplay};
  var _localPlayer = ${localPlayer};
  var _remotePlayer = ${remotePlayer};
  var _gameRunning = false;

  // --- Netplay sync: pause on game start, wait for both sides ready ---
  if (_isNetplay) {
    window.EJS_onGameStart = function() {
      if (window.EJS_emulator) {
        console.log("[NETPLAY] EJS_onGameStart fired, pausing...");
        window.EJS_emulator.pause();
        // MAME cores need more time to stabilize internal state after first frame
        // Run a few frames then pause again to ensure stable state
        var _readyAttempt = 0;
        function tryReady() {
          _readyAttempt++;
          console.log("[NETPLAY] Ready attempt", _readyAttempt);
          // Run 2 frames then re-pause to let core stabilize
          if (window.EJS_emulator && window.EJS_emulator.gameManager) {
            try {
              // Try getState to check if serialization works
              var testState = window.EJS_emulator.gameManager.getState();
              if (testState && testState.byteLength > 0) {
                console.log("[NETPLAY] getState() works, state size:", testState.byteLength);
                window.EJS_emulator.pause();
                parent.postMessage({ type: "emulator-ready" }, "*");
                return;
              }
            } catch(e) {
              console.warn("[NETPLAY] getState() failed:", e);
            }
          }
          if (_readyAttempt < 10) {
            // Let the emulator run a bit more and try again
            if (window.EJS_emulator) window.EJS_emulator.play();
            setTimeout(function() {
              if (window.EJS_emulator) window.EJS_emulator.pause();
              setTimeout(tryReady, 200);
            }, 200);
          } else {
            // Give up on state verification, send ready anyway
            console.warn("[NETPLAY] Max attempts reached, sending ready without state check");
            window.EJS_emulator.pause();
            parent.postMessage({ type: "emulator-ready" }, "*");
          }
        }
        setTimeout(tryReady, 500);
      }
    };
  }

  var KEY_TO_BUTTON = {
    "ArrowUp": 4, "ArrowDown": 5, "ArrowLeft": 6, "ArrowRight": 7,
    "KeyA": 0, "KeyS": 8, "KeyD": 1, "KeyF": 9,
    "Digit1": 3, "Digit5": 2, "KeyQ": 10, "KeyE": 11
  };
  window.addEventListener("keydown", function(e) {
    if (_isNetplay && _gameRunning) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
    var btn = KEY_TO_BUTTON[e.code];
    if (btn === undefined || !_gameRunning && _isNetplay) return;
    if (_isNetplay) {
      if (window.EJS_emulator && window.EJS_emulator.gameManager) {
        window.EJS_emulator.gameManager.simulateInput(_localPlayer, btn, 1);
      }
    }
    parent.postMessage({ type: "localInput", button: btn, down: true }, "*");
  }, true);
  window.addEventListener("keyup", function(e) {
    if (_isNetplay && _gameRunning) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
    var btn = KEY_TO_BUTTON[e.code];
    if (btn === undefined || !_gameRunning && _isNetplay) return;
    if (_isNetplay) {
      if (window.EJS_emulator && window.EJS_emulator.gameManager) {
        window.EJS_emulator.gameManager.simulateInput(_localPlayer, btn, 0);
      }
    }
    parent.postMessage({ type: "localInput", button: btn, down: false }, "*");
  }, true);
  window.addEventListener("message", function(e) {
    if (!e.data) return;
    if (e.data.type === "remoteInput") {
      if (window.EJS_emulator && window.EJS_emulator.gameManager) {
        var val = e.data.down ? 1 : 0;
        window.EJS_emulator.gameManager.simulateInput(${remotePlayer}, e.data.button, val);
      }
    }
    if (e.data.type === "start-game") {
      _gameRunning = true;
      console.log("[NETPLAY] Game started");
      if (window.EJS_emulator) window.EJS_emulator.play();
    }
    // HOST: extract save state and send to parent
    if (e.data.type === "get-save-state") {
      console.log("[NETPLAY] get-save-state requested");
      var _stateRetry = 0;
      function tryGetState() {
        _stateRetry++;
        try {
          if (!window.EJS_emulator || !window.EJS_emulator.gameManager) {
            throw new Error("gameManager not available");
          }
          var state = window.EJS_emulator.gameManager.getState();
          var buf = state.buffer || state;
          console.log("[NETPLAY] getState() success, size:", buf.byteLength);
          if (buf.byteLength === 0) throw new Error("empty state");
          parent.postMessage({ type: "save-state", state: buf }, "*", [buf]);
        } catch(err) {
          console.warn("[NETPLAY] getState() attempt", _stateRetry, "failed:", err);
          if (_stateRetry < 5) {
            // Let emulator run a bit more
            if (window.EJS_emulator) window.EJS_emulator.play();
            setTimeout(function() {
              if (window.EJS_emulator) window.EJS_emulator.pause();
              setTimeout(tryGetState, 300);
            }, 300);
          } else {
            console.error("[NETPLAY] getState() failed after all retries");
            parent.postMessage({ type: "save-state-error", error: String(err) }, "*");
          }
        }
      }
      tryGetState();
    }
    // GUEST: load save state from HOST
    if (e.data.type === "load-save-state") {
      console.log("[NETPLAY] load-save-state, size:", e.data.state.byteLength);
      try {
        var arr = new Uint8Array(e.data.state);
        window.EJS_emulator.gameManager.loadState(arr);
        console.log("[NETPLAY] loadState() success");
        parent.postMessage({ type: "state-loaded" }, "*");
      } catch(err) {
        console.error("[NETPLAY] loadState() failed:", err);
        parent.postMessage({ type: "save-state-error", error: String(err) }, "*");
      }
    }
    // Fire-and-forget resync: HOST extracts state with micro-pause
    if (e.data.type === "resync-get-state") {
      try {
        if (!window.EJS_emulator || !window.EJS_emulator.gameManager) throw new Error("no gm");
        window.EJS_emulator.pause();
        var state = window.EJS_emulator.gameManager.getState();
        var buf = state.buffer || state;
        window.EJS_emulator.play();
        if (buf.byteLength === 0) throw new Error("empty");
        console.log("[NETPLAY] Resync getState ok:", buf.byteLength);
        parent.postMessage({ type: "resync-state", state: buf }, "*", [buf]);
      } catch(err) {
        console.warn("[NETPLAY] Resync getState failed:", err);
        if (window.EJS_emulator) window.EJS_emulator.play();
        parent.postMessage({ type: "resync-failed" }, "*");
      }
    }
    // Fire-and-forget resync: GUEST loads state with micro-pause
    if (e.data.type === "resync-load-state") {
      try {
        if (!window.EJS_emulator || !window.EJS_emulator.gameManager) throw new Error("no gm");
        window.EJS_emulator.pause();
        var arr = new Uint8Array(e.data.state);
        window.EJS_emulator.gameManager.loadState(arr);
        window.EJS_emulator.play();
        console.log("[NETPLAY] Resync loadState ok");
        parent.postMessage({ type: "resync-loaded" }, "*");
      } catch(err) {
        console.warn("[NETPLAY] Resync loadState failed:", err);
        if (window.EJS_emulator) window.EJS_emulator.play();
        parent.postMessage({ type: "resync-failed" }, "*");
      }
    }
  });
  // Catch unhandled promise rejections (EmulatorJS uses many promises)
  window.addEventListener('unhandledrejection', function(e) {
    var el = document.getElementById('error-overlay');
    if (el && e.reason) { el.style.display='block'; el.innerHTML='<h2>Emulator Error</h2>'+
      '<p>Core: ${ejsCore} (requested: ${rawCore})</p>'+
      '<p>ROM: ${rom}</p>'+(e.reason.message||String(e.reason))+
      '<br><br>'+(e.reason.stack||'')+'<br><br>'+
      '<span style="color:#4a6fa5">Tip: ROM이 코어와 호환되지 않을 수 있습니다.</span>'; }
  });
<` +
    `/script>
<script src="https://cdn.emulatorjs.org/stable/data/loader.js"><` +
    `/script>
</body></html>`;
  res.type("html").send(html);
});

app.get("/api/roms", (_req, res) => {
  if (!fs.existsSync(ROMS_DIR)) {
    res.json([]);
    return;
  }
  const roms: { filename: string; core: string; path: string; bios?: string }[] = [];
  const coreDirs = fs.readdirSync(ROMS_DIR, { withFileTypes: true });
  for (const dir of coreDirs) {
    if (!dir.isDirectory() || dir.name.startsWith(".")) continue;
    const core = dir.name;
    if (!VALID_CORES.has(core)) continue;
    const files = fs.readdirSync(path.join(ROMS_DIR, core));
    const BIOS_FILES = new Set(["neogeo.zip", "pgm.zip", "skns.zip", "decocass.zip", "neocdz.zip"]);
    // Detect bios file in this core folder
    const biosFile = files.find((f) => BIOS_FILES.has(f.toLowerCase()));
    for (const f of files) {
      if (f.startsWith(".") || BIOS_FILES.has(f.toLowerCase())) continue;
      const rom: { filename: string; core: string; path: string; bios?: string } = {
        filename: f,
        core,
        path: `${core}/${f}`,
      };
      if (biosFile) rom.bios = `${core}/${biosFile}`;
      roms.push(rom);
    }
  }
  res.json(roms);
});

// --- Signaling ---

interface Room {
  code: string;
  host: WebSocket;
  guest: WebSocket | null;
  romFilename: string;
  core: string;
  bios?: string;
  hostNickname?: string;
  hostAvatar?: string;
}

const rooms = new Map<string, Room>();

function generateCode(): string {
  let code: string;
  do {
    code = String(Math.floor(100000 + Math.random() * 900000));
  } while (rooms.has(code));
  return code;
}

function send(ws: WebSocket, data: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

wss.on("connection", (ws) => {
  let myRoom: Room | null = null;
  let role: "host" | "guest" | null = null;

  ws.on("message", (raw) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }

    switch (msg.type) {
      case "create-room": {
        const code = generateCode();
        const room: Room = {
          code,
          host: ws,
          guest: null,
          romFilename: String(msg.romFilename || ""),
          core: String(msg.core || "nes"),
          bios: msg.bios ? String(msg.bios) : undefined,
          hostNickname: msg.nickname ? String(msg.nickname) : undefined,
          hostAvatar: msg.avatar ? String(msg.avatar) : undefined,
        };
        rooms.set(code, room);
        myRoom = room;
        role = "host";
        send(ws, { type: "room-created", code });
        break;
      }

      case "join-room": {
        const room = rooms.get(String(msg.code));
        if (!room) {
          send(ws, { type: "error", message: "방을 찾을 수 없습니다." });
          return;
        }
        if (room.guest) {
          send(ws, { type: "error", message: "방이 이미 가득 찼습니다." });
          return;
        }
        room.guest = ws;
        myRoom = room;
        role = "guest";
        send(ws, {
          type: "room-joined",
          code: room.code,
          romFilename: room.romFilename,
          core: room.core,
          bios: room.bios,
          hostNickname: room.hostNickname,
          hostAvatar: room.hostAvatar,
        });
        send(room.host, {
          type: "guest-joined",
          guestNickname: msg.nickname ? String(msg.nickname) : undefined,
          guestAvatar: msg.avatar ? String(msg.avatar) : undefined,
        });
        break;
      }

      // WebRTC signaling relay
      case "offer":
      case "answer":
      case "ice-candidate": {
        if (!myRoom) return;
        const target = role === "host" ? myRoom.guest : myRoom.host;
        if (target) send(target, msg);
        break;
      }
    }
  });

  ws.on("close", () => {
    if (!myRoom) return;
    if (role === "host") {
      if (myRoom.guest) send(myRoom.guest, { type: "peer-disconnected" });
      rooms.delete(myRoom.code);
    } else if (role === "guest") {
      send(myRoom.host, { type: "peer-disconnected" });
      myRoom.guest = null;
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`ROM directory: ${ROMS_DIR}`);
  console.log(`Put ROM files in server/roms/ to serve them.`);
});

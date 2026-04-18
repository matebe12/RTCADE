import type { Express } from "express";

const CORE_REMAP: Record<string, string> = {
  mame2003: "mame2003_plus",
  arcade: "fbneo",
};

interface EmulatorRequestOptions {
  bios: string;
  rawCore: string;
  role: string;
  rom: string;
}

function buildEmulatorHtml({ bios, rawCore, role, rom }: EmulatorRequestOptions) {
  const ejsCore = CORE_REMAP[rawCore] || rawCore;
  const isNetplay = role === "host" || role === "guest";
  const localPlayer = role === "guest" ? 1 : 0;
  const remotePlayer = role === "guest" ? 0 : 1;

  return (
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
  var _gameRunning = !_isNetplay;

  if (_isNetplay) {
    window.EJS_onGameStart = function() {
      if (window.EJS_emulator) {
        console.log("[NETPLAY] EJS_onGameStart fired, pausing...");
        window.EJS_emulator.pause();
        var _readyAttempt = 0;
        function tryReady() {
          _readyAttempt++;
          console.log("[NETPLAY] Ready attempt", _readyAttempt);
          if (window.EJS_emulator && window.EJS_emulator.gameManager) {
            try {
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
            if (window.EJS_emulator) window.EJS_emulator.play();
            setTimeout(function() {
              if (window.EJS_emulator) window.EJS_emulator.pause();
              setTimeout(tryReady, 200);
            }, 200);
          } else {
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
  function applyLocalInput(button, value) {
    if (window.EJS_emulator && window.EJS_emulator.gameManager) {
      window.EJS_emulator.gameManager.simulateInput(_localPlayer, button, value);
    }
  }
  window.addEventListener("keydown", function(e) {
    if (_isNetplay && e.code === "Enter" && !e.repeat && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      e.stopImmediatePropagation();
      e.preventDefault();
      parent.postMessage({ type: "chat-shortcut" }, "*");
      return;
    }
    var btn = KEY_TO_BUTTON[e.code];
    if (btn !== undefined) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
    if (btn === undefined || !_gameRunning && _isNetplay) return;
    applyLocalInput(btn, 1);
    parent.postMessage({ type: "localInput", button: btn, down: true }, "*");
  }, true);
  window.addEventListener("keyup", function(e) {
    var btn = KEY_TO_BUTTON[e.code];
    if (btn !== undefined) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
    if (btn === undefined || !_gameRunning && _isNetplay) return;
    applyLocalInput(btn, 0);
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
</body></html>`
  );
}

export function registerEmulatorRoute(app: Express) {
  app.get("/emulator", (req, res) => {
    const rawCore = String(req.query.core || "nes");
    const rom = String(req.query.rom || "");
    const bios = req.query.bios ? String(req.query.bios) : "";
    const role = req.query.role ? String(req.query.role) : "";

    res.type("html").send(buildEmulatorHtml({ bios, rawCore, role, rom }));
  });
}

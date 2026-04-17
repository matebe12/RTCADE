import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";

import { buildBackendUrl } from "@/lib/backend-url";

export type SystemCore =
  | "nes"
  | "snes"
  | "n64"
  | "gb"
  | "gba"
  | "nds"
  | "psx"
  | "psp"
  | "segaMD"
  | "segaMS"
  | "segaGG"
  | "segaSaturn"
  | "segaCD"
  | "sega32x"
  | "mame2003"
  | "mame2003_plus"
  | "arcade"
  | "fbneo"
  | "atari2600"
  | "atari7800"
  | "lynx"
  | "jaguar"
  | "3do"
  | "coleco"
  | "vb"
  | "dosbox";

interface EmulatorPlayerProps {
  romSource: File | string; // File (local) or URL string (server)
  core: SystemCore;
  role?: "host" | "guest"; // undefined = solo mode
  romPath?: string; // e.g. "mame2003/mslug3.zip" for server-served emulator page
  biosPath?: string; // e.g. "mame2003/neogeo.zip"
  onLocalInput?: (button: number, down: boolean) => void;
  onEmulatorReady?: () => void;
  onSaveState?: (state: ArrayBuffer) => void;
  onStateLoaded?: () => void;
  onSaveStateError?: (error: string) => void;
  onResyncState?: (state: ArrayBuffer) => void;
  onResyncLoaded?: () => void;
  onResyncFailed?: () => void;
  onChatShortcut?: () => void;
}

const EmulatorPlayer = forwardRef<HTMLIFrameElement, EmulatorPlayerProps>(function EmulatorPlayer(
  {
    romSource,
    core,
    role,
    romPath,
    biosPath,
    onLocalInput,
    onEmulatorReady,
    onSaveState,
    onStateLoaded,
    onSaveStateError,
    onResyncState,
    onResyncLoaded,
    onResyncFailed,
    onChatShortcut,
  },
  ref,
) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useImperativeHandle(ref, () => iframeRef.current!, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    if (romPath) {
      // Server mode: use /emulator endpoint (same-origin with ROMs)
      const params = new URLSearchParams({ core, rom: romPath });
      if (role) params.set("role", role);
      if (biosPath) params.set("bios", biosPath);
      iframe.src = buildBackendUrl("/emulator", params);
      return undefined;
    } else {
      // Local file mode: use blob iframe + postMessage
      const html = buildLocalEmulatorHTML(core);
      const blob = new Blob([html], { type: "text/html" });
      const blobUrl = URL.createObjectURL(blob);
      iframe.src = blobUrl;

      const onLoad = () => {
        if (typeof romSource !== "string") {
          romSource.arrayBuffer().then((buffer) => {
            iframe.contentWindow?.postMessage({ type: "romData", buffer }, "*", [buffer]);
          });
        }
      };
      iframe.addEventListener("load", onLoad, { once: true });

      return () => {
        iframe.removeEventListener("load", onLoad);
        URL.revokeObjectURL(blobUrl);
      };
    }
  }, [romSource, core, role, romPath, biosPath]);

  // Listen for events forwarded from inside the iframe via postMessage
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "localInput" && onLocalInput) {
        onLocalInput(e.data.button, e.data.down);
      }
      if (e.data?.type === "emulator-ready" && onEmulatorReady) {
        onEmulatorReady();
      }
      if (e.data?.type === "save-state" && onSaveState) {
        onSaveState(e.data.state);
      }
      if (e.data?.type === "state-loaded" && onStateLoaded) {
        onStateLoaded();
      }
      if (e.data?.type === "save-state-error" && onSaveStateError) {
        onSaveStateError(e.data.error);
      }
      if (e.data?.type === "resync-state" && onResyncState) {
        onResyncState(e.data.state);
      }
      if (e.data?.type === "resync-loaded" && onResyncLoaded) {
        onResyncLoaded();
      }
      if (e.data?.type === "resync-failed" && onResyncFailed) {
        onResyncFailed();
      }
      if (e.data?.type === "chat-shortcut" && onChatShortcut) {
        onChatShortcut();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [
    onLocalInput,
    onEmulatorReady,
    onSaveState,
    onStateLoaded,
    onSaveStateError,
    onResyncState,
    onResyncLoaded,
    onResyncFailed,
    onChatShortcut,
  ]);

  return (
    <iframe
      ref={iframeRef}
      title="emulator"
      tabIndex={0}
      className="w-[800px] h-[600px] max-w-[95vw] max-h-[70vh] bg-neutral-900 rounded-lg border-none"
    />
  );
});

// Minimal blob HTML for local file mode only (solo play with local ROM file)
function buildLocalEmulatorHTML(core: string): string {
  return `<!DOCTYPE html>
<html><head>
<style>body{margin:0;background:#111;overflow:hidden}#game{width:100vw;height:100vh}</style>
</head><body>
<div id="game"></div>
<script>
  Object.defineProperty(navigator, 'wakeLock', {
    value: { request: function() { return Promise.resolve({ released: false, release: function() { return Promise.resolve(); }, addEventListener: function(){}, removeEventListener: function(){}, onrelease: null, type: 'screen' }); } },
    writable: true, configurable: true
  });
  window.EJS_player = "#game";
  window.EJS_core = "${core}";
  window.EJS_pathtodata = "https://cdn.emulatorjs.org/stable/data/";
  window.EJS_color = "#00d4ff";
  window.EJS_startOnLoaded = true;
  window.EJS_language = "en";
  window.EJS_gameID = 1;
  var KEY_TO_BUTTON = {
    "ArrowUp": 4, "ArrowDown": 5, "ArrowLeft": 6, "ArrowRight": 7,
    "KeyA": 0, "KeyS": 8, "KeyD": 1, "KeyF": 9,
    "Digit1": 3, "Digit5": 2, "KeyQ": 10, "KeyE": 11
  };
  window.addEventListener("keydown", function(e) {
    var btn = KEY_TO_BUTTON[e.code];
    if (btn !== undefined) parent.postMessage({ type: "localInput", button: btn, down: true }, "*");
  }, true);
  window.addEventListener("keyup", function(e) {
    var btn = KEY_TO_BUTTON[e.code];
    if (btn !== undefined) parent.postMessage({ type: "localInput", button: btn, down: false }, "*");
  }, true);
  function startEmulator(url) {
    window.EJS_gameUrl = url;
    var s = document.createElement("script");
    s.src = "https://cdn.emulatorjs.org/stable/data/loader.js";
    document.body.appendChild(s);
  }
  window.addEventListener("message", function(e) {
    if (e.data && e.data.type === "romData") {
      var blob = new Blob([e.data.buffer]);
      startEmulator(URL.createObjectURL(blob));
    }
  });
<\\/script>
</body></html>`;
}

export default EmulatorPlayer;

// Send a remote input event into the iframe (button = libretro button index)
export function sendRemoteInput(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  button: number,
  down: boolean,
) {
  iframeRef.current?.contentWindow?.postMessage({ type: "remoteInput", button, down }, "*");
}

// Tell the iframe to unpause and start the game (netplay sync)
export function sendStartGame(iframeRef: React.RefObject<HTMLIFrameElement | null>) {
  iframeRef.current?.contentWindow?.postMessage({ type: "start-game" }, "*");
}

export function focusEmulator(iframeRef: React.RefObject<HTMLIFrameElement | null>) {
  iframeRef.current?.focus();

  try {
    iframeRef.current?.contentWindow?.focus();
  } catch {
    // Ignore focus errors across browser implementations.
  }
}

// Ask the iframe to extract a save state (HOST)
export function requestSaveState(iframeRef: React.RefObject<HTMLIFrameElement | null>) {
  iframeRef.current?.contentWindow?.postMessage({ type: "get-save-state" }, "*");
}

// Send a save state into the iframe to load (GUEST)
export function loadSaveState(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  state: ArrayBuffer,
) {
  iframeRef.current?.contentWindow?.postMessage({ type: "load-save-state", state }, "*", [state]);
}

// Coordinated resync helpers
export function requestResyncGetState(iframeRef: React.RefObject<HTMLIFrameElement | null>) {
  iframeRef.current?.contentWindow?.postMessage({ type: "resync-get-state" }, "*");
}

export function requestResyncLoadState(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  state: ArrayBuffer,
) {
  iframeRef.current?.contentWindow?.postMessage({ type: "resync-load-state", state }, "*", [state]);
}

export const SYSTEM_OPTIONS: { value: SystemCore; label: string; extensions: string }[] = [
  { value: "nes", label: "NES", extensions: ".nes,.zip" },
  { value: "snes", label: "SNES", extensions: ".smc,.sfc,.zip" },
  { value: "n64", label: "N64", extensions: ".z64,.n64,.v64,.zip" },
  { value: "gb", label: "Game Boy", extensions: ".gb,.gbc,.zip" },
  { value: "gba", label: "GBA", extensions: ".gba,.zip" },
  { value: "nds", label: "NDS", extensions: ".nds,.zip" },
  { value: "psx", label: "PS1", extensions: ".bin,.cue,.iso,.pbp,.chd,.zip" },
  { value: "psp", label: "PSP", extensions: ".iso,.cso,.pbp" },
  { value: "segaMD", label: "Mega Drive", extensions: ".md,.gen,.bin,.zip" },
  { value: "segaMS", label: "Master System", extensions: ".sms,.zip" },
  { value: "segaGG", label: "Game Gear", extensions: ".gg,.zip" },
  { value: "segaSaturn", label: "Saturn", extensions: ".bin,.cue,.iso,.chd" },
  { value: "segaCD", label: "Sega CD", extensions: ".bin,.cue,.iso,.chd" },
  { value: "sega32x", label: "32X", extensions: ".32x,.zip" },
  { value: "mame2003", label: "MAME 2003+", extensions: ".zip" },
  { value: "arcade", label: "FBNeo (아케이드)", extensions: ".zip" },
  { value: "atari2600", label: "Atari 2600", extensions: ".a26,.zip" },
  { value: "atari7800", label: "Atari 7800", extensions: ".a78,.zip" },
  { value: "lynx", label: "Atari Lynx", extensions: ".lnx,.zip" },
  { value: "jaguar", label: "Atari Jaguar", extensions: ".j64,.jag,.zip" },
  { value: "3do", label: "3DO", extensions: ".iso,.bin,.cue,.chd" },
  { value: "coleco", label: "ColecoVision", extensions: ".col,.zip" },
  { value: "vb", label: "Virtual Boy", extensions: ".vb,.vboy,.zip" },
  { value: "dosbox", label: "DOS", extensions: ".zip,.exe,.com" },
];

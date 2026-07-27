/**
 * MamePlayer — EmulatorJS MAME 2003+ (FBNeoPlayer와 동일 UI/UX)
 * EmulatorJS 공식 문서 기준: https://emulatorjs.org/docs/options
 */
import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from "react";
import { Maximize2, Minimize2, Volume2, VolumeX, RotateCcw } from "lucide-react";
import { KEY_TO_BUTTON, BLOCKED_KEYS } from "@rtcade/shared";

const EJS_CDN = "https://cdn.emulatorjs.org/stable/data/";
const CORE_REMAP: Record<string, string> = { mame2003: "mame2003_plus" };
const OUR_GLOBALS = ["EJS_player","EJS_core","EJS_pathtodata","EJS_color","EJS_startOnLoaded","EJS_language","EJS_gameID","EJS_Buttons","EJS_volume","EJS_noAutoFocus","EJS_ready","EJS_onGameStart","EJS_gameUrl","EJS_biosUrl"];

// EJS 문서 기준 버튼 전부 숨김 (공식 옵션)
const EJS_BUTTONS: Record<string, boolean> = { playPause:false,play:false,pause:false,restart:false,mute:false,unmute:false,saveState:false,loadState:false,settings:false,fullscreen:false,gamepad:false,cheat:false,volume:false,saveSavFiles:false,loadSavFiles:false,quickSave:false,quickLoad:false,screenshot:false,screenRecord:false,cacheManager:false,exitEmulation:false };
const MENU_HIDE_CSS = `.ejs_menu_bar{display:none!important}.ejs_start{display:none!important}.ejs_start_button{display:none!important}canvas{pointer-events:none!important}`;

interface Props { romSource: File|string; variant?:string; role?:"host"|"guest"; romPath?:string; biosPath?:string; onLocalInput?:(b:number,d:boolean)=>void; onEmulatorReady?:()=>void; onChatShortcut?:()=>void; onCanvasStreamReady?:(s:MediaStream,p?:boolean)=>void; }

let _mameRemoteHandler: ((btn:number,down:boolean)=>void)|null = null;
export function sendRemoteInputMame(_ref:any, btn:number, down:boolean) { _mameRemoteHandler?.(btn, down); }
export function resetMameGame() { try { ((window as any).EJS_emulator as any)?.gameManager?.restart?.(); } catch {} }

const MamePlayer = forwardRef<HTMLDivElement, Props>(function MamePlayer(
  { romSource, role, biosPath, onLocalInput, onEmulatorReady, onChatShortcut, onCanvasStreamReady }, ref
) {
  const cRef = useRef<HTMLDivElement>(null); const wRef = useRef<HTMLDivElement>(null);
  const scriptRef = useRef<HTMLScriptElement|null>(null); const styleRef = useRef<HTMLStyleElement|null>(null);
  const streamFiredRef = useRef(false); const pressedRef = useRef(new Set<number>());
  const gainRef = useRef<GainNode|null>(null); const audioDestRef = useRef<MediaStreamAudioDestinationNode|null>(null);
  const [fs,setFs]=useState(false); const [mu,setMu]=useState(false); const [vol,setVol]=useState(1); const [ctl,setCtl]=useState(false);
  const rRef = useRef(onEmulatorReady); rRef.current = onEmulatorReady;
  const sRef = useRef(onCanvasStreamReady); sRef.current = onCanvasStreamReady;
  useImperativeHandle(ref,()=>cRef.current!,[]);
  const isNetplay = role === "host" || role === "guest";
  const localPlayer = role === "guest" ? 1 : 0;
  const isHost = role === "host";

  // ── EJS 메뉴바 CSS 숨김 ────────────────────────────────
  useEffect(() => {
    const s = document.createElement("style"); s.id = "mame-hide-menu";
    s.textContent = MENU_HIDE_CSS; document.head.appendChild(s); styleRef.current = s;
    return () => { s.remove(); styleRef.current = null; };
  }, []);

  // ── Audio: AudioNode.prototype.connect 패치 + GainNode ──
  useEffect(() => {
    if ((window as any).__ac_patched) return;
    (window as any).__ac_patched = true;
    const origConnect = AudioNode.prototype.connect as Function;

    // Try to find existing AudioContexts and hook them
    const hookCtx = (ac: AudioContext) => {
      if ((ac as any).__hooked) return;
      (ac as any).__hooked = true;
      try {
        const gn = ac.createGain(); gn.gain.value = vol;
        origConnect.call(gn, ac.destination);
        (ac as any).__gainNode = gn;
        if (!gainRef.current) gainRef.current = gn;
        if (isHost) {
          const strGn = ac.createGain(); strGn.gain.value = 1; // always full volume for guest
          const ad = ac.createMediaStreamDestination(); origConnect.call(strGn, ad);
          (ac as any).__streamGn = strGn; audioDestRef.current = ad;
        }
      } catch {}
    };

    // Patch prototype — same-context only
    AudioNode.prototype.connect = function(this: AudioNode, ...args: any[]) {
      const dest = args[0];
      if (dest && dest === (this.context as any).destination) {
        const ctx = this.context as AudioContext;
        hookCtx(ctx);
        const gn = (ctx as any).__gainNode as GainNode|undefined;
        if (gn) {
          origConnect.call(this, gn); // → speakers (vol controlled)
          // Also connect to stream destination (always gain=1)
          if (isHost && (ctx as any).__streamGn) {
            origConnect.call(this, (ctx as any).__streamGn);
          }
          return gn; // return GainNode
        }
        return origConnect.apply(this, args);
      }
      return origConnect.apply(this, args);
    } as any;

    // Also poll for EJS AudioContext
    const iv = setInterval(() => {
      try {
        const ejs = (window as any).EJS_emulator;
        const ac = ejs?.Module?.AL?.currentCtx as AudioContext|undefined;
        if (ac) hookCtx(ac);
      } catch {}
    }, 1000);
    return () => { clearInterval(iv); /* keep prototype patch */ };
  }, [isHost]);

  useEffect(() => {
    const v = mu ? 0 : vol;
    if (gainRef.current) gainRef.current.gain.value = v;
    try { const ejs=(window as any).EJS_emulator; const ac=ejs?.Module?.AL?.currentCtx; if(ac?.__gainNode)ac.__gainNode.gain.value=v; } catch {}
  }, [mu, vol]);

  // Sync volume to GainNode
  useEffect(() => {
    const v = mu ? 0 : vol;
    if (gainRef.current) gainRef.current.gain.value = v;
    try { const ejs=(window as any).EJS_emulator; const ac=ejs?.Module?.AL?.currentCtx; if(ac?.__gainNode)ac.__gainNode.gain.value=v; } catch {}
  }, [mu, vol]);

  // ── EJS Init ──────────────────────────────────────────
  useEffect(() => {
    const c = cRef.current; if (!c) return;
    let aborted = false; let objUrl: string|null = null; let initTimerId: number|null = null;
    const w = window as any;

    const gameDiv = document.createElement("div");
    const gameId = `game-${Math.random().toString(36).slice(2,10)}`;
    gameDiv.id = gameId; gameDiv.style.width = "100%"; gameDiv.style.height = "100%";
    c.appendChild(gameDiv);

    const ejsCore = CORE_REMAP["mame2003"] || "mame2003";
    w.EJS_player = `#${gameId}`; w.EJS_core = ejsCore; w.EJS_pathtodata = EJS_CDN;
    w.EJS_color = "#00d4ff"; w.EJS_startOnLoaded = true; w.EJS_language = "en-US";
    w.EJS_gameID = 1; w.EJS_volume = 1;
    w.EJS_Buttons = { ...EJS_BUTTONS };
    // RetroArch mouse→button 차단 (Emscripten 콜백 무효화)
    (w as any).Module = { preRun: [(mod:any)=>{try{mod.emscripten_set_mousedown_callback=()=>{};mod.emscripten_set_mouseup_callback=()=>{};mod.emscripten_set_mousemove_callback=()=>{};}catch{}}] };

    if (typeof romSource === "string" && romSource.length > 0) { w.EJS_gameUrl = romSource; if (biosPath) w.EJS_biosUrl = biosPath; }
    else if (romSource instanceof File) { romSource.arrayBuffer().then(b=>{if(!aborted){objUrl=URL.createObjectURL(new Blob([b]));w.EJS_gameUrl=objUrl;}}); }

    // onEmulatorReady + capture stream (direct from EJS WebGL canvas)
    const doReady = () => {
      let n = 0;
      const iv = setInterval(() => { if(aborted||n++>30){clearInterval(iv);return}
        const cv = c.querySelector("canvas"); if(!cv)return;
        try {
          const st = (cv as HTMLCanvasElement).captureStream(60);
          for (const t of st.getVideoTracks()) t.contentHint = "motion";
          if (audioDestRef.current) { for (const t of audioDestRef.current.stream.getAudioTracks()) { t.contentHint = "music"; st.addTrack(t); } }
          sRef.current?.(st, true);
        } catch {}
        rRef.current?.(); clearInterval(iv);
      }, 500);
    };

    if (isNetplay) {
      // Netplay: wait for gameManager
      let ready = false; let attempt = 0;
      function tryReady() { if(aborted||ready)return;attempt++;
        const ejs = w.EJS_emulator as { gameManager?:unknown }|undefined;
        if(ejs?.gameManager){ready=true;c?.focus();doReady();return;}
        if(attempt<30)setTimeout(tryReady,200);else{ready=true;doReady();}
      }
      setTimeout(tryReady, 500);
    } else {
      w.EJS_onGameStart = () => { if(!aborted){ w.__rtcade_game_running = true; c?.focus(); doReady(); } };
    }

    function loadScript() {
      if (aborted) return;
      if (w.EJS_STORAGE && typeof w.EmulatorJS === "function") {
        w.EJS_emulator = new w.EmulatorJS(String(w.EJS_player), { gameUrl:w.EJS_gameUrl,dataPath:w.EJS_pathtodata,system:w.EJS_core,biosUrl:w.EJS_biosUrl,color:w.EJS_color,buttonOpts:w.EJS_Buttons,startOnLoad:true,gameId:w.EJS_gameID });
        const emu = w.EJS_emulator as { on?:(e:string,h:()=>void)=>void }|undefined;
        if(emu?.on){if(typeof w.EJS_ready==="function")emu.on("ready",w.EJS_ready);if(typeof w.EJS_onGameStart==="function")emu.on("start",w.EJS_onGameStart);}
        return;
      }
      const s = document.createElement("script"); s.src = EJS_CDN+"loader.js"; s.async = true;
      document.body.appendChild(s); scriptRef.current = s;
    }
    initTimerId = window.setTimeout(()=>{initTimerId=null;if(!aborted)loadScript();},0);

    return () => {
      aborted = true; if(initTimerId!==null)window.clearTimeout(initTimerId);
      if(objUrl)URL.revokeObjectURL(objUrl);
      scriptRef.current?.remove(); scriptRef.current = null;
      streamFiredRef.current = false;
      const emu = w.EJS_emulator as { callEvent?:(n:string)=>void;gameManager?:unknown }|undefined;
      if(emu?.gameManager){try{emu.callEvent?.("exit")}catch{}}
      delete w.EJS_emulator;
      OUR_GLOBALS.forEach(k=>{try{delete w[k]}catch{}});
      if(c)c.innerHTML = ""; w.__rtcade_game_running = false; pressedRef.current.clear();
      gainRef.current = null; audioDestRef.current = null;
    };
  }, []);

  // ── Remote MAME input ─────────────────────────────────
  useEffect(() => {
    if (role === "host") { _mameRemoteHandler = (b,d)=>{try{(window as any).EJS_emulator?.gameManager?.simulateInput?.(1,b,d?1:0)}catch{}}; }
    else { _mameRemoteHandler = null; }
    return () => { _mameRemoteHandler = null; };
  }, [role]);

  // ── Keyboard (옛날 패턴: solo도 window 캡처) ──────────────
  useEffect(() => {
    const c = cRef.current; if (!c) return;
    const release = () => {
      if (pressedRef.current.size === 0) return;
      const btns = Array.from(pressedRef.current); pressedRef.current.clear();
      const ejs = (window as any).EJS_emulator as { gameManager?:{simulateInput:(p:number,b:number,v:number)=>void} }|undefined;
      for (const b of btns) { ejs?.gameManager?.simulateInput(localPlayer, b, 0); if (isNetplay) onLocalInput?.(b, false); }
    };

    // Netplay: window listener, exclude text inputs. Solo: container listener, focus required.
    const listenerTarget = isNetplay ? window : c;
    const kd = (e: KeyboardEvent) => {
      if (!e.isTrusted) return;
      if (isNetplay) { const el=document.activeElement; if(el&&(el.tagName==="INPUT"||el.tagName==="TEXTAREA"||(el as HTMLElement).isContentEditable))return; }
      else if (!c.contains(document.activeElement)) return;
      // Chat
      if (e.code==="Enter" && !e.repeat && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) { e.stopImmediatePropagation();e.preventDefault();onChatShortcut?.();return; }
      const btn = KEY_TO_BUTTON[e.code];
      if (btn===undefined) { if(BLOCKED_KEYS.has(e.code)){e.stopImmediatePropagation();e.preventDefault();} return; }
      e.stopImmediatePropagation();e.preventDefault();
      if (e.repeat||pressedRef.current.has(btn)) return;
      pressedRef.current.add(btn);
      try { ((window as any).EJS_emulator)?.gameManager?.simulateInput?.(localPlayer, btn, 1); } catch {}
      if (isNetplay) onLocalInput?.(btn, true);
    };
    const ku = (e: KeyboardEvent) => {
      if (!e.isTrusted) return;
      if (isNetplay) { const el=document.activeElement; if(el&&(el.tagName==="INPUT"||el.tagName==="TEXTAREA"||(el as HTMLElement).isContentEditable))return; }
      else if (!c.contains(document.activeElement)) return;
      const btn = KEY_TO_BUTTON[e.code];
      if (btn===undefined) { if(BLOCKED_KEYS.has(e.code)){e.stopImmediatePropagation();e.preventDefault();} return; }
      e.stopImmediatePropagation();e.preventDefault();
      if (!pressedRef.current.has(btn)) return;
      pressedRef.current.delete(btn);
      try { ((window as any).EJS_emulator)?.gameManager?.simulateInput?.(localPlayer, btn, 0); } catch {}
      if (isNetplay) onLocalInput?.(btn, false);
    };

    const kdw: EventListener = (e) => kd(e as KeyboardEvent);
    const kuw: EventListener = (e) => ku(e as KeyboardEvent);
    listenerTarget.addEventListener("keydown", kdw, true); listenerTarget.addEventListener("keyup", kuw, true);
    window.addEventListener("blur", release);
    return () => { listenerTarget.removeEventListener("keydown",kdw,true);listenerTarget.removeEventListener("keyup",kuw,true);window.removeEventListener("blur",release);release(); };
  }, [isNetplay, localPlayer, onLocalInput, onChatShortcut]);

  // ── Volume control (EJS_volume + GainNode fallback) ─────
  const tm = useCallback(() => setMu(p=>!p), []);
  const tv = useCallback((val:number) => { setVol(val); if(val>0&&mu)setMu(false); }, [mu]);

  // ── Fullscreen ─────────────────────────────────────────
  useEffect(()=>{const w=wRef.current;if(!w)return;const h=()=>setFs(document.fullscreenElement===w);w.addEventListener("fullscreenchange",h);return()=>w.removeEventListener("fullscreenchange",h)},[]);
  const tf=useCallback(()=>{const w=wRef.current;if(!w)return;document.fullscreenElement?void document.exitFullscreen():void w.requestFullscreen()},[]);

  return (
    <div ref={wRef} className="relative w-full" onMouseEnter={()=>setCtl(true)} onMouseLeave={()=>setCtl(false)}>
      <div ref={cRef} className="relative aspect-4/3 w-full overflow-hidden rounded-lg bg-black outline-none focus:ring-2 focus:ring-primary/60" tabIndex={0} onContextMenu={(e)=>e.preventDefault()} />
      <div className={`absolute bottom-0 left-0 right-0 z-10 transition-opacity duration-200 ${ctl||fs?"opacity-100":"opacity-0"}`}>
        <div className="flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-8">
          <button type="button" onClick={tm} title={mu?"소리 켜기":"소리 끄기"} className="flex h-7 w-7 items-center justify-center rounded-md text-white hover:bg-white/20">{mu?<VolumeX className="size-4"/>:<Volume2 className="size-4"/>}</button>
          <input type="range" min="0" max="1" step="0.05" value={mu?0:vol} onChange={e=>tv(parseFloat(e.target.value))} className="h-1 w-20 cursor-pointer accent-white" title={`볼륨 ${Math.round((mu?0:vol)*100)}%`} />
          {(!role || isHost) && (<button type="button" onClick={()=>resetMameGame()} title="게임 리셋" className="flex h-7 w-7 items-center justify-center rounded-md text-white hover:bg-white/20"><RotateCcw className="size-4"/></button>)}
          <div className="flex-1" />
          <button type="button" onClick={tf} title={fs?"전체화면 종료":"전체화면"} className="flex h-7 w-7 items-center justify-center rounded-md text-white hover:bg-white/20" aria-label={fs?"전체화면 종료":"전체화면"}>{fs?<Minimize2 className="size-4"/>:<Maximize2 className="size-4"/>}</button>
        </div>
      </div>
    </div>
  );
});

export default MamePlayer;

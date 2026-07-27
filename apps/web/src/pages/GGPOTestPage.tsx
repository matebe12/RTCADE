/**
 * FBNeo + 비디오 스트리밍 하이브리드 넷플레이
 * http://localhost:5173/ggpo-test           → 솔로
 * http://localhost:5173/ggpo-test#host      → HOST (방 생성 + 스트리밍)
 * http://localhost:5173/ggpo-test#guest=CODE → GUEST (비디오 수신 + 입력 전송)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import init from "@mantou/fbneo/fbneo-neogeo";
import wasmURL from "@mantou/fbneo/fbneo-neogeo.wasm?url";
import { ArcadeWrapper } from "@rtcade/emulator";
import { keyToButtonMask } from "@rtcade/emulator";
import { renderFrameToCanvas, fitCanvasToContainer } from "@rtcade/emulator";
import type { ArcadeGameInfo } from "@rtcade/emulator";
import { GGPONetplayPeer } from "@/netplay-ggpo/GGPONetplayPeer";

const ROM_SERVER = "http://localhost:3001";
const SIGNALING_URL = "ws://localhost:3001";
const GAME_ROM = "kof97";
const BIOS_ROM = "neogeo";

type Role = "solo" | "host" | "guest";

export default function GGPOTestPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const arcadeRef = useRef<ArcadeWrapper | null>(null);
  const peerRef = useRef<GGPONetplayPeer | null>(null);
  const rafRef = useRef<number | null>(null);
  const localMaskRef = useRef(0);

  const [role, setRole] = useState<Role>("solo");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("FBNeo 비디오 스트리밍 테스트");
  const [, setGameInfo] = useState<ArcadeGameInfo | null>(null);
  const [frameCount, setFrameCount] = useState(0);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [nickname] = useState("Player");
  const [connected, setConnected] = useState(false);
  const [streamReady, setStreamReady] = useState(false);
  const [showJoinInput, setShowJoinInput] = useState(false);

  const frameCountRef = useRef(0);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#host")) setRole("host");
    else if (hash.startsWith("#guest=")) { setRole("guest"); setJoinCode(hash.slice(7)); }
  }, []);

  // ───── HOST / SOLO 게임 루프 ─────
  const startSoloLoop = useCallback(() => {
    if (rafRef.current !== null) return;
    const arcade = arcadeRef.current;
    const canvas = canvasRef.current;
    if (!arcade || !canvas) return;

    fitCanvasToContainer(canvas, arcade.width, arcade.height);

    const loop = () => {
      arcade.clockFrame();
      const buf = arcade.getFrameBuffer();
      if (buf.length > 0) {
        renderFrameToCanvas(canvas, buf, arcade.width, arcade.height, { smooth: false, autoResize: false });
      }
      frameCountRef.current++;
      if (frameCountRef.current % 60 === 0) setFrameCount(frameCountRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    setStatus("playing");
    setMessage(role === "solo" ? "솔로 플레이" : "HOST — 스트리밍 중");
  }, [role]);

  // ───── HOST: Canvas + Audio capture → WebRTC ─────
  const startHostStreaming = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Canvas 비디오 트랙 (60fps)
    const videoStream = canvas.captureStream(60);
    const videoTrack = videoStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.contentHint = "detail";
    }

    // AudioContext에서 오디오 캡처 시도
    try {
      const audioCtx = new AudioContext({ sampleRate: 44100 });
      const dest = audioCtx.createMediaStreamDestination();
      const audioTrack = dest.stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.contentHint = "music";
        videoStream.addTrack(audioTrack);
      }
    } catch {
      // Audio capture not available, just video
    }

    peerRef.current?.startVideoStreaming(videoStream);
    setStreamReady(true);
    startSoloLoop();
  }, [startSoloLoop]);

  const handleStart = useCallback(async () => {
    try {
      setStatus("loading"); setMessage("WASM + ROM 로딩 중...");
      const arcade = new ArcadeWrapper({ variant: "neogeo" });
      arcade.setInit(init, wasmURL);
      arcadeRef.current = arcade;

      const [biosRes, romRes] = await Promise.all([
        fetch(`${ROM_SERVER}/roms/fbneo/${BIOS_ROM}.zip`),
        fetch(`${ROM_SERVER}/roms/fbneo/${GAME_ROM}.zip`),
      ]);
      arcade.loadBios(new Uint8Array(await biosRes.arrayBuffer()), BIOS_ROM);
      const info = await arcade.loadRom(new Uint8Array(await romRes.arrayBuffer()), GAME_ROM);
      setGameInfo(info);

      if (role === "solo") {
        startSoloLoop();
        return;
      }

      // ───── HOST / GUEST ─────
      const peer = new GGPONetplayPeer({
        onConnected: () => {
          setConnected(true);
          if (role === "host") startHostStreaming();
        },
        onVideoStream: (stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
          setStreamReady(true);
          setStatus("playing");
          setMessage("GUEST — 스트리밍 시청 중");
        },
        onDisconnected: () => { setStatus("error"); setMessage("연결 끊김"); },
        onInput: (msg) => {
          // GUEST 입력 → HOST 에뮬레이터에 직접 반영
          if (role === "host") {
            // inputMask를 바로 FBNeo에 적용
            // 호스트는 player 1이 자기 자신이므로, GUEST 입력은 player 1에 매핑
            arcade.setInput(1, msg.inputMask);
          }
        },
        onRoomCreated: (code) => { setRoomCode(code); setStatus("waiting"); setMessage(`방: ${code}`); },
        onRoomJoined: () => { peerRef.current!.setRoomReady(true); },
        onLobbyUpdated: (info) => { if (info.canStart && role === "host") peerRef.current!.markSessionStarted(); },
        onGuestJoined: () => setMessage("GUEST 입장!"),
        onError: (msg) => console.error("[Peer error]", msg),
      });
      peerRef.current = peer;

      await peer.connect(SIGNALING_URL);

      if (role === "host") {
        peer.createRoom("kof97.zip", "fbneo", nickname);
      } else if (joinCode) {
        peer.joinRoom(joinCode, nickname);
        setStatus("waiting");
      }
    } catch (err) {
      console.error("[FBNeo]", err);
      setStatus("error");
      setMessage(`에러: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [role, joinCode, nickname, startHostStreaming, startSoloLoop]);

  // 키보드
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mask = keyToButtonMask(e.code); if (!mask) return; e.preventDefault();
      localMaskRef.current |= mask;
      if (role === "host" || role === "solo") {
        arcadeRef.current?.setInput(0, localMaskRef.current);
      } else if (role === "guest") {
        // GUEST 입력 → HOST로 DataChannel 전송
        peerRef.current?.sendInput(0, localMaskRef.current);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const mask = keyToButtonMask(e.code); if (!mask) return; e.preventDefault();
      localMaskRef.current &= ~mask;
      if (role === "host" || role === "solo") {
        arcadeRef.current?.setInput(0, localMaskRef.current);
      } else if (role === "guest") {
        peerRef.current?.sendInput(0, localMaskRef.current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  }, [role]);

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    peerRef.current?.close();
    arcadeRef.current?.destroy();
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col items-center bg-black text-white">
      <div className="flex w-full items-center justify-between px-4 py-2 text-sm">
        <span>{status === "playing" ? `Frame: ${frameCount}` : status}{roomCode && ` | 방: ${roomCode}`}{connected && " | P2P ✓"}{streamReady && " | 📡"}</span>
        <span className="font-bold">{message}</span>
        <span className="flex gap-2">
          <button onClick={() => { window.location.hash = ""; setRole("solo"); setStatus("idle"); }} className={role === "solo" ? "text-white" : "text-muted-foreground"}>Solo</button>
          <button onClick={() => { window.location.hash = "host"; setRole("host"); setStatus("idle"); }} className={role === "host" ? "text-white" : "text-muted-foreground"}>Host</button>
          <button onClick={() => setShowJoinInput(true)} className={role === "guest" ? "text-white" : "text-muted-foreground"}>Guest</button>
        </span>
      </div>
      {showJoinInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="rounded-lg bg-gray-800 p-6 text-center">
            <p className="mb-4 text-lg">GUEST 방 코드 입력</p>
            <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="6자리 방 코드" maxLength={6} className="mb-4 w-48 rounded bg-gray-700 px-4 py-2 text-center text-xl tracking-widest text-white" autoFocus onKeyDown={(e) => { if (e.key === "Enter" && joinCode.length === 6) { window.location.hash = `guest=${joinCode}`; setRole("guest"); setStatus("idle"); setShowJoinInput(false); } }} />
            <div className="flex justify-center gap-2">
              <button onClick={() => { if (joinCode.length === 6) { window.location.hash = `guest=${joinCode}`; setRole("guest"); setStatus("idle"); setShowJoinInput(false); } }} className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-500">접속</button>
              <button onClick={() => { setShowJoinInput(false); setJoinCode(""); }} className="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-500">취소</button>
            </div>
          </div>
        </div>
      )}
      <div className="flex-1 w-full relative bg-black overflow-hidden">
        {status === "idle" && <button onClick={handleStart} className="rounded-lg bg-green-600 px-8 py-4 text-xl font-bold text-white hover:bg-green-500">{role === "solo" ? "GAME START" : role === "host" ? "CREATE ROOM" : "JOIN ROOM"}</button>}
        {status === "loading" && <div className="text-center"><div className="mb-4 text-4xl animate-pulse">⏳</div><p className="text-lg">{message}</p></div>}
        {status === "waiting" && <div className="text-center"><div className="mb-4 text-4xl animate-pulse">⌛</div><p className="text-lg">{message}</p>{roomCode && <div className="mt-6"><p className="text-sm">방 코드</p><p className="text-5xl font-bold tracking-widest text-yellow-400">{roomCode}</p></div>}</div>}
        {status === "error" && <div className="text-center"><div className="mb-4 text-4xl">❌</div><p className="text-lg text-red-400">{message}</p><button onClick={handleStart} className="mt-4 rounded bg-red-700 px-4 py-2 text-white hover:bg-red-600">다시 시도</button></div>}
        {/* HOST/SOLO: Canvas */}
        <canvas ref={canvasRef} className={(status === "playing" && role !== "guest") ? "block" : "hidden"} style={{ imageRendering: "pixelated" }} />
        {/* GUEST: Video */}
        <video ref={videoRef} className={(status === "playing" && role === "guest") ? "block w-full h-full object-contain" : "hidden"} autoPlay playsInline muted />
      </div>
      <div className="w-full px-4 py-2 text-center text-xs text-muted-foreground/70">방향키 · A/S(약P/약K) · D/F(강P/강K) · 5(Coin) · 1(Start)</div>
    </div>
  );
}
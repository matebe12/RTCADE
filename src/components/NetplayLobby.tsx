import { useState, useEffect, useRef, useCallback } from "react";
import EmulatorPlayer, {
  sendRemoteInput,
  sendStartGame,
  requestSaveState,
  loadSaveState,
  requestResyncGetState,
  requestResyncLoadState,
  type SystemCore,
  SYSTEM_OPTIONS,
} from "./EmulatorPlayer";
import { NetplayPeer, type InputMessage } from "../netplay/peer";
import { getUserProfile } from "@/lib/user-profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { GameCard } from "@/components/GameCard";
import { UserBadge } from "@/components/UserBadge";
import { RoomCodeDisplay } from "@/components/RoomCodeDisplay";
import { CodeInput } from "@/components/CodeInput";
import { parseRomName } from "@/lib/game-names";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Wifi, WifiOff, Search } from "lucide-react";

const SERVER_URL = import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:3001`;
const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;

interface RomInfo {
  filename: string;
  core: string;
  path: string;
  bios?: string;
}

type LobbyState =
  | { step: "menu" }
  | { step: "browse"; roms: RomInfo[] }
  | {
      step: "waiting";
      code: string;
      romFilename: string;
      romPath: string;
      core: SystemCore;
      biosPath?: string;
    }
  | { step: "join-input" }
  | {
      step: "playing";
      romPath: string;
      core: SystemCore;
      role: "host" | "guest";
      biosPath?: string;
    };

export default function NetplayLobby() {
  const [state, setState] = useState<LobbyState>({ step: "menu" });
  const [joinCode, setJoinCode] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [dcState, setDcState] = useState("");
  const [gameStarted, setGameStarted] = useState(false);
  const [opponentProfile, setOpponentProfile] = useState<{
    nickname: string;
    avatar: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // Save-state sync: HOST extracts state → sends to GUEST → GUEST loads → both start
  const localReadyRef = useRef(false); // emulator loaded
  const remoteReadyRef = useRef(false); // peer's emulator loaded
  const pendingStateRef = useRef<ArrayBuffer | null>(null); // state waiting for GUEST emulator
  const syncStatusRef = useRef(""); // for display
  const [syncDisplay, setSyncDisplay] = useState(""); // triggers re-render
  const peerRef = useRef<NetplayPeer | null>(null);
  const emulatorRef = useRef<HTMLIFrameElement>(null);
  const roleRef = useRef<"host" | "guest" | null>(null);
  const gameStartedRef = useRef(false);
  const resyncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resyncInProgressRef = useRef(false);
  const resyncActiveRef = useRef(false);

  const RESYNC_INTERVAL_MS = 500;
  const RESYNC_TIMEOUT_MS = 3000; // Safety: reset resyncInProgress if no response
  const lastInputTimeRef = useRef(0);
  const resyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      peerRef.current?.close();
      resyncActiveRef.current = false;
      if (resyncIntervalRef.current) clearTimeout(resyncIntervalRef.current);
      if (resyncTimeoutRef.current) clearTimeout(resyncTimeoutRef.current);
    };
  }, []);

  const handleRemoteInput = useCallback((msg: InputMessage) => {
    lastInputTimeRef.current = Date.now();
    sendRemoteInput(emulatorRef, msg.button, msg.down);
  }, []);

  const handleLocalInput = useCallback((button: number, down: boolean) => {
    lastInputTimeRef.current = Date.now();
    peerRef.current?.sendInput(button, down);
  }, []);

  const updateSync = (msg: string) => {
    syncStatusRef.current = msg;
    setSyncDisplay(msg);
  };

  const createPeer = useCallback((): NetplayPeer => {
    const peer = new NetplayPeer({
      onConnected: () => setStatus("P2P 연결됨!"),
      onDisconnected: () => {
        // Stop resync loop
        resyncActiveRef.current = false;
        if (resyncIntervalRef.current) {
          clearTimeout(resyncIntervalRef.current);
          resyncIntervalRef.current = null;
        }
        resyncInProgressRef.current = false;
        // Show toast and go back to menu
        toast.error("상대방이 나갔습니다.");
        peerRef.current?.close();
        peerRef.current = null;
        localReadyRef.current = false;
        remoteReadyRef.current = false;
        pendingStateRef.current = null;
        roleRef.current = null;
        gameStartedRef.current = false;
        setGameStarted(false);
        setDcState("");
        setSyncDisplay("");
        setStatus("");
        setError("");
        setJoinCode("");
        setState({ step: "menu" });
      },
      onInput: handleRemoteInput,
      onError: (msg) => setError(msg),
      onDataChannelState: (s) => setDcState(s),
      onPeerReady: () => {
        // GUEST's emulator is loaded → HOST can now send save state
        console.log(
          "[LOBBY] onPeerReady, role:",
          roleRef.current,
          "localReady:",
          localReadyRef.current,
        );
        remoteReadyRef.current = true;
        if (roleRef.current === "host" && localReadyRef.current) {
          updateSync("세이브 스테이트 추출 중...");
          requestSaveState(emulatorRef);
        }
      },
      // GUEST receives HOST's save state via DataChannel (initial sync only)
      onSaveState: (state: ArrayBuffer) => {
        console.log(
          "[LOBBY] onSaveState, role:",
          roleRef.current,
          "size:",
          state.byteLength,
          "localReady:",
          localReadyRef.current,
        );
        if (roleRef.current === "guest") {
          if (localReadyRef.current) {
            // Initial sync: load and send ACK
            updateSync("세이브 스테이트 로드 중...");
            loadSaveState(emulatorRef, state);
          } else {
            // Emulator not ready yet, store for later
            pendingStateRef.current = state;
            updateSync("세이브 스테이트 수신 완료, 에뮬레이터 대기 중...");
          }
        }
      },
      // HOST hears GUEST finished loading state → start both
      onStateLoaded: () => {
        if (roleRef.current === "host") {
          console.log("[LOBBY] HOST: GUEST state loaded, starting both!");
          updateSync("양쪽 동기화 완료! 게임 시작!");
          setGameStarted(true);
          gameStartedRef.current = true;
          sendStartGame(emulatorRef);
          // Tell GUEST to start too via dedicated start signal
          peerRef.current?.sendStartSignal();
          // Start periodic coordinated resync
          startPeriodicResync();
        }
      },
      // GUEST receives "go" signal from HOST after state sync
      onStartSignal: () => {
        if (roleRef.current === "guest" && !gameStartedRef.current) {
          console.log("[LOBBY] GUEST: received start signal from HOST!");
          updateSync("양쪽 동기화 완료! 게임 시작!");
          setGameStarted(true);
          gameStartedRef.current = true;
          sendStartGame(emulatorRef);
        }
      },
      // --- Fire-and-forget resync callbacks ---
      onResyncState: (state: ArrayBuffer) => {
        if (roleRef.current === "guest") {
          requestResyncLoadState(emulatorRef, state);
          peerRef.current?.resetRemoteSeq();
        }
      },
      onResyncFailed: () => {
        resyncInProgressRef.current = false;
        console.warn("[LOBBY] Resync failed");
      },
      // Input sequence gap detection (logged for diagnostics, resync is continuous)
      onInputSeqGap: (expected: number, got: number) => {
        console.warn(`[LOBBY] Input seq gap: expected ${expected}, got ${got}`);
      },
      onRoomCreated: (_code) => {
        setState((prev) => {
          if (prev.step === "browse" || prev.step === "menu") {
            return prev;
          }
          return prev;
        });
      },
      onGuestJoined: (info) => {
        if (info.guestNickname) {
          setOpponentProfile({ nickname: info.guestNickname, avatar: info.guestAvatar || "🎮" });
        }
        setStatus("상대방 접속! 게임 로딩 중...");
        setState((prev) => {
          if (prev.step === "waiting") {
            roleRef.current = "host";
            return {
              step: "playing",
              romPath: prev.romPath,
              core: prev.core,
              role: "host",
              biosPath: prev.biosPath,
            };
          }
          return prev;
        });
      },
      onRoomJoined: (info) => {
        if (info.hostNickname) {
          setOpponentProfile({ nickname: info.hostNickname, avatar: info.hostAvatar || "🎮" });
        }
        setStatus("방 참가 완료! 연결 중...");
        roleRef.current = "guest";
        setState({
          step: "playing",
          romPath: info.romFilename,
          core: info.core as SystemCore,
          role: "guest",
          biosPath: info.bios,
        });
      },
    });
    peerRef.current = peer;
    return peer;
  }, [handleRemoteInput]);

  // --- Emulator ready: save-state-based sync ---
  const handleEmulatorReady = useCallback(() => {
    localReadyRef.current = true;
    console.log(
      "[LOBBY] handleEmulatorReady, role:",
      roleRef.current,
      "remoteReady:",
      remoteReadyRef.current,
    );

    if (roleRef.current === "host") {
      updateSync("에뮬레이터 로딩 완료 (HOST). 상대방 대기 중...");
      // If GUEST already sent peer-ready, extract state now
      if (remoteReadyRef.current) {
        updateSync("세이브 스테이트 추출 중...");
        requestSaveState(emulatorRef);
      }
    } else {
      // GUEST: tell HOST we're ready
      updateSync("에뮬레이터 로딩 완료 (GUEST). HOST 대기 중...");
      peerRef.current?.sendPeerReady();
      // If state was already received before emulator loaded
      if (pendingStateRef.current) {
        updateSync("세이브 스테이트 로드 중...");
        loadSaveState(emulatorRef, pendingStateRef.current);
        pendingStateRef.current = null;
      }
    }
  }, []);

  // HOST: when save state is extracted from emulator → send to GUEST via DC (initial only)
  const handleSaveState = useCallback((state: ArrayBuffer) => {
    if (roleRef.current === "host") {
      updateSync(`세이브 스테이트 전송 중... (${(state.byteLength / 1024).toFixed(0)}KB)`);
      peerRef.current?.sendSaveState(state);
    }
  }, []);

  // GUEST: when save state is loaded → tell HOST, then wait for start signal
  const handleStateLoaded = useCallback(() => {
    console.log("[LOBBY] handleStateLoaded, role:", roleRef.current);
    if (roleRef.current === "guest" && !gameStartedRef.current) {
      updateSync("세이브 스테이트 로드 완료! HOST 시작 대기...");
      peerRef.current?.sendStateLoaded();
    }
  }, []);

  // Fallback: if save state fails, just start both simultaneously (no state sync)
  const handleSaveStateError = useCallback((error: string) => {
    console.warn("[NETPLAY] Save state error:", error);
    updateSync(`세이브 스테이트 실패 (${error}). 동시 시작으로 폴백...`);
    // If HOST: tell GUEST to just start
    if (roleRef.current === "host") {
      setTimeout(() => {
        if (!gameStartedRef.current) {
          console.log("[LOBBY] HOST: fallback start (no state sync)");
          updateSync("동시 시작! (스테이트 동기화 없음)");
          setGameStarted(true);
          gameStartedRef.current = true;
          sendStartGame(emulatorRef);
          peerRef.current?.sendStartSignal();
        }
      }, 500);
    }
  }, []);

  // --- Continuous fire-and-forget resync (HOST only) ---
  const scheduleNextResync = useCallback(() => {
    if (!resyncActiveRef.current || roleRef.current !== "host" || !gameStartedRef.current) return;
    if (resyncIntervalRef.current) clearTimeout(resyncIntervalRef.current);
    resyncIntervalRef.current = setTimeout(() => {
      if (resyncActiveRef.current && gameStartedRef.current && !resyncInProgressRef.current) {
        resyncInProgressRef.current = true;
        // Safety timeout: if no response in 3s, unlock for next attempt
        resyncTimeoutRef.current = setTimeout(() => {
          if (resyncInProgressRef.current) {
            console.warn("[LOBBY] Resync timeout, unlocking");
            resyncInProgressRef.current = false;
            scheduleNextResync();
          }
        }, RESYNC_TIMEOUT_MS);
        requestResyncGetState(emulatorRef);
      } else {
        scheduleNextResync();
      }
    }, RESYNC_INTERVAL_MS);
  }, []);

  const startPeriodicResync = useCallback(() => {
    resyncActiveRef.current = true;
    console.log("[LOBBY] Starting continuous resync pipeline");
    scheduleNextResync();
  }, [scheduleNextResync]);

  const handleResyncState = useCallback(
    (state: ArrayBuffer) => {
      if (roleRef.current === "host") {
        console.log(`[LOBBY] Sending resync state (${(state.byteLength / 1024).toFixed(0)}KB)`);
        peerRef.current?.sendResyncState(state);
        resyncInProgressRef.current = false;
        if (resyncTimeoutRef.current) {
          clearTimeout(resyncTimeoutRef.current);
          resyncTimeoutRef.current = null;
        }
        scheduleNextResync();
      }
    },
    [scheduleNextResync],
  );

  const handleResyncLoaded = useCallback(() => {
    console.log("[LOBBY] GUEST resync load complete");
  }, []);

  const handleResyncFailed = useCallback(() => {
    resyncInProgressRef.current = false;
    if (resyncTimeoutRef.current) {
      clearTimeout(resyncTimeoutRef.current);
      resyncTimeoutRef.current = null;
    }
    console.warn("[LOBBY] Resync failed locally, scheduling retry");
    scheduleNextResync();
  }, [scheduleNextResync]);

  // (Removed fragile useEffect override of onPeerReady — now using dedicated onStartSignal handler)

  // When DC opens after emulator is already ready (GUEST), resend peer-ready
  useEffect(() => {
    if (
      dcState === "open" &&
      localReadyRef.current &&
      roleRef.current === "guest" &&
      !gameStarted
    ) {
      peerRef.current?.sendPeerReady();
    }
  }, [dcState, gameStarted]);

  const fetchRoms = async () => {
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/roms`);
      const roms: RomInfo[] = await res.json();
      if (roms.length === 0) {
        setError("서버에 ROM 파일이 없습니다. server/roms/에 파일을 넣어주세요.");
        return;
      }
      setState({ step: "browse", roms });
    } catch {
      setError("서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.");
    }
  };

  const handleCreateRoom = async (rom: RomInfo) => {
    setError("");
    setStatus("방 생성 중...");
    const peer = createPeer();
    try {
      await peer.connect(SERVER_URL);
    } catch {
      setError("시그널링 서버 연결 실패");
      return;
    }

    // Listen for room-created to get code
    const origHandler = peer["handler"];
    const origOnRoomCreated = origHandler.onRoomCreated;
    origHandler.onRoomCreated = (code: string) => {
      origOnRoomCreated?.(code);
      setState({
        step: "waiting",
        code,
        romFilename: rom.filename,
        romPath: rom.path,
        core: rom.core as SystemCore,
        biosPath: rom.bios,
      });
      setStatus("대기 중... 상대방에게 코드를 알려주세요.");
    };

    peer.createRoom(
      rom.path,
      rom.core,
      rom.bios,
      getUserProfile()?.nickname,
      getUserProfile()?.avatar,
    );
  };

  const handleJoinRoom = async () => {
    if (joinCode.length !== 6) {
      setError("6자리 코드를 입력하세요.");
      return;
    }
    setError("");
    setStatus("방 참가 중...");
    const peer = createPeer();
    try {
      await peer.connect(SERVER_URL);
    } catch {
      setError("시그널링 서버 연결 실패");
      return;
    }
    peer.joinRoom(joinCode, getUserProfile()?.nickname, getUserProfile()?.avatar);
  };

  const handleBack = () => {
    peerRef.current?.close();
    peerRef.current = null;
    resyncActiveRef.current = false;
    if (resyncIntervalRef.current) {
      clearTimeout(resyncIntervalRef.current);
      resyncIntervalRef.current = null;
    }
    resyncInProgressRef.current = false;
    setDcState("");
    localReadyRef.current = false;
    remoteReadyRef.current = false;
    pendingStateRef.current = null;
    roleRef.current = null;
    setGameStarted(false);
    gameStartedRef.current = false;
    setSyncDisplay("");
    setState({ step: "menu" });
    setStatus("");
    setError("");
    setJoinCode("");
  };

  const myProfile = getUserProfile();

  // --- MENU ---
  if (state.step === "menu") {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="font-[family-name:var(--font-arcade)] text-sm text-primary">
            🌐 NETPLAY
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button variant="outline" className="w-full" onClick={fetchRoms}>
            방 만들기
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setState({ step: "join-input" })}
          >
            방 참가
          </Button>
          {error && <p className="text-xs text-destructive-foreground text-center">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  // --- BROWSE ROMS ---
  if (state.step === "browse") {
    const filteredRoms = state.roms.filter((rom) => {
      if (!searchQuery) return true;
      const displayName = parseRomName(rom.filename, rom.core).toLowerCase();
      const q = searchQuery.toLowerCase();
      return displayName.includes(q) || rom.filename.toLowerCase().includes(q);
    });

    return (
      <Card className="w-full max-w-lg">
        <CardHeader className="flex flex-row items-center gap-3 pb-3">
          <Button variant="ghost" size="icon" className="size-8" onClick={handleBack}>
            <ArrowLeft className="size-4" />
          </Button>
          <CardTitle className="text-sm">게임을 선택하세요</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="게임 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <ScrollArea className="h-72">
            <div className="flex flex-col gap-2 pr-3">
              {filteredRoms.map((rom) => {
                const sys = SYSTEM_OPTIONS.find((s) => s.value === rom.core);
                return (
                  <GameCard
                    key={rom.path}
                    filename={rom.filename}
                    core={rom.core}
                    systemLabel={sys?.label || rom.core}
                    onClick={() => handleCreateRoom(rom)}
                  />
                );
              })}
              {filteredRoms.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">
                  검색 결과가 없습니다
                </p>
              )}
            </div>
          </ScrollArea>
          {error && <p className="text-xs text-destructive-foreground text-center">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  // --- WAITING FOR GUEST ---
  if (state.step === "waiting") {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader className="flex flex-row items-center gap-3">
          <Button variant="ghost" size="icon" className="size-8" onClick={handleBack}>
            <ArrowLeft className="size-4" />
          </Button>
          <CardTitle className="text-sm">대기 중</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <p className="text-xs text-muted-foreground">방 코드를 상대방에게 알려주세요</p>
          <RoomCodeDisplay code={state.code} />
          <div className="flex items-center gap-2">
            <Loader2 className="size-3 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{status || "상대방 대기 중..."}</span>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            {parseRomName(state.romFilename, state.core)}
          </Badge>
        </CardContent>
      </Card>
    );
  }

  // --- JOIN INPUT ---
  if (state.step === "join-input") {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader className="flex flex-row items-center gap-3">
          <Button variant="ghost" size="icon" className="size-8" onClick={handleBack}>
            <ArrowLeft className="size-4" />
          </Button>
          <CardTitle className="text-sm">방 참가</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <p className="text-xs text-muted-foreground">6자리 방 코드를 입력하세요</p>
          <CodeInput value={joinCode} onChange={setJoinCode} onSubmit={handleJoinRoom} />
          <Button className="w-full" onClick={handleJoinRoom} disabled={joinCode.length !== 6}>
            참가
          </Button>
          {status && <p className="text-xs text-muted-foreground">{status}</p>}
          {error && <p className="text-xs text-destructive-foreground">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  // --- PLAYING ---
  if (state.step === "playing") {
    return (
      <div className="flex flex-col items-center gap-3 w-full">
        {/* Header bar */}
        <div className="flex items-center gap-3 w-full max-w-[800px]">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs">
                <ArrowLeft className="size-3 mr-1" />
                나가기
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>게임 나가기</AlertDialogTitle>
                <AlertDialogDescription>
                  정말 나가시겠습니까? 현재 진행 중인 게임이 종료됩니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={handleBack}>나가기</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex items-center gap-2 ml-auto">
            {/* My profile */}
            {myProfile && (
              <UserBadge nickname={myProfile.nickname} avatar={myProfile.avatar} size="sm" />
            )}
            <span className="text-xs text-muted-foreground font-medium">VS</span>
            {/* Opponent profile */}
            {opponentProfile ? (
              <UserBadge
                nickname={opponentProfile.nickname}
                avatar={opponentProfile.avatar}
                size="sm"
              />
            ) : (
              <span className="text-xs text-muted-foreground">상대방</span>
            )}
          </div>

          {/* Connection status */}
          <Badge
            variant={dcState === "open" ? "default" : "destructive"}
            className="text-[10px] gap-1"
          >
            {dcState === "open" ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
            {dcState || "연결 안 됨"}
          </Badge>
        </div>

        {/* Sync status */}
        {!gameStarted && (
          <div className="flex items-center gap-2">
            <Loader2 className="size-3 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {syncDisplay || "동기화 준비 중..."}
            </span>
          </div>
        )}

        <EmulatorPlayer
          ref={emulatorRef}
          romSource=""
          core={state.core}
          role={state.role}
          romPath={state.romPath}
          biosPath={state.biosPath}
          onLocalInput={handleLocalInput}
          onEmulatorReady={handleEmulatorReady}
          onSaveState={handleSaveState}
          onStateLoaded={handleStateLoaded}
          onSaveStateError={handleSaveStateError}
          onResyncState={handleResyncState}
          onResyncLoaded={handleResyncLoaded}
          onResyncFailed={handleResyncFailed}
        />
      </div>
    );
  }

  return null;
}

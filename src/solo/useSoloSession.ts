import { useCallback, useEffect, useRef, useState } from "react";

import type { SystemCore } from "@/components/EmulatorPlayer";
import { parseRomName } from "@/lib/game-names";
import {
  endActivePlaySession,
  endActivePlaySessionWithBeacon,
  notifyOperationsStatsRefresh,
  recordGameSession,
  upsertActivePlaySession,
} from "@/lib/operations-api";
import { incrementTotalPlayedCount, type RecentGame, upsertRecentGame } from "@/lib/user-profile";
import type { LobbyState, RomInfo } from "@/stores/useNetplayLobbyStore";

type SetLobbyState = (next: LobbyState | ((previous: LobbyState) => LobbyState)) => void;

interface UseSoloSessionOptions {
  currentStep: LobbyState["step"];
  setLobbyState: SetLobbyState;
  setRecentGames: (recentGames: RecentGame[]) => void;
  fetchSoloRoms: () => Promise<void>;
}

const SOLO_HEARTBEAT_MS = 15_000;
const SOLO_START_DELAY_MS = 180;

function getRomFilename(romPath: string) {
  return romPath.split("/").pop() ?? romPath;
}

function createSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useSoloSession({
  currentStep,
  fetchSoloRoms,
  setLobbyState,
  setRecentGames,
}: UseSoloSessionOptions) {
  const emulatorRef = useRef<HTMLDivElement>(null);
  const activeSoloSessionIdRef = useRef<string | null>(null);
  const pendingStartTimeoutRef = useRef<number | null>(null);
  const activeSessionRef = useRef<{
    biosPath?: string;
    core: SystemCore;
    mode: "solo";
    romPath: string;
  } | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  const previousStepRef = useRef<LobbyState["step"]>(currentStep);
  const [startingRomPath, setStartingRomPath] = useState<string | null>(null);

  const clearPendingStart = useCallback(() => {
    if (pendingStartTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(pendingStartTimeoutRef.current);
    pendingStartTimeoutRef.current = null;
    setStartingRomPath(null);
  }, []);

  const stopSoloTracking = useCallback(() => {
    const activeSessionId = activeSoloSessionIdRef.current;
    activeSoloSessionIdRef.current = null;

    if (!activeSessionId) {
      return;
    }

    void endActivePlaySession(activeSessionId).catch(() => undefined);
  }, []);

  const stopSoloTrackingImmediately = useCallback(() => {
    const activeSessionId = activeSoloSessionIdRef.current;
    activeSoloSessionIdRef.current = null;

    if (!activeSessionId) {
      return;
    }

    const beaconSent = endActivePlaySessionWithBeacon(activeSessionId);

    if (!beaconSent) {
      void endActivePlaySession(activeSessionId).catch(() => undefined);
    }
  }, []);

  const resetSoloRuntime = useCallback(() => {
    clearPendingStart();
    stopSoloTracking();
    activeSessionRef.current = null;
    sessionStartedAtRef.current = null;
  }, [clearPendingStart, stopSoloTracking]);

  const startSoloGame = useCallback(
    (rom: RomInfo) => {
      if (pendingStartTimeoutRef.current !== null || startingRomPath !== null) {
        return;
      }

      stopSoloTracking();
      setStartingRomPath(rom.path);

      pendingStartTimeoutRef.current = window.setTimeout(() => {
        pendingStartTimeoutRef.current = null;

        const startedAt = Date.now();
        const nextSessionId = createSessionId();
        const gameName = parseRomName(getRomFilename(rom.path), rom.core);

        activeSessionRef.current = {
          mode: "solo",
          romPath: rom.path,
          core: rom.core as SystemCore,
          biosPath: rom.bios,
        };
        activeSoloSessionIdRef.current = nextSessionId;
        sessionStartedAtRef.current = startedAt;

        const nextRecentGames = upsertRecentGame({
          romPath: rom.path,
          core: rom.core,
          displayName: gameName,
          playedAt: startedAt,
        });
        setRecentGames(nextRecentGames);
        incrementTotalPlayedCount();

        void recordGameSession({
          core: rom.core,
          gameName,
          romPath: rom.path,
        }).catch(() => undefined);

        void upsertActivePlaySession({
          core: rom.core,
          gameName,
          mode: "solo",
          romPath: rom.path,
          sessionId: nextSessionId,
        }).catch(() => undefined);

        notifyOperationsStatsRefresh();
        setStartingRomPath(null);

        setLobbyState({
          step: "solo-playing",
          romPath: rom.path,
          core: rom.core as SystemCore,
          biosPath: rom.bios,
        });
      }, SOLO_START_DELAY_MS);
    },
    [pendingStartTimeoutRef, setLobbyState, setRecentGames, startingRomPath, stopSoloTracking],
  );

  const resetToMenu = useCallback(() => {
    resetSoloRuntime();
    setLobbyState({ step: "menu" });
  }, [resetSoloRuntime, setLobbyState]);

  const handleChooseAnotherGame = useCallback(() => {
    resetSoloRuntime();
    setLobbyState({ step: "solo-browse", roms: [] });
    void fetchSoloRoms();
  }, [fetchSoloRoms, resetSoloRuntime, setLobbyState]);

  const handleBack = useCallback(() => {
    const activeSession = activeSessionRef.current;
    const endedAt = Date.now();
    const startedAt = sessionStartedAtRef.current;

    if (!activeSession) {
      setLobbyState({ step: "menu" });
      return;
    }

    resetSoloRuntime();
    setLobbyState({
      step: "session-summary",
      mode: "solo",
      romPath: activeSession.romPath,
      core: activeSession.core,
      biosPath: activeSession.biosPath,
      gameName: parseRomName(getRomFilename(activeSession.romPath), activeSession.core),
      startedAt,
      endedAt,
      durationMs: startedAt ? Math.max(0, endedAt - startedAt) : 0,
      endReason: "self-left",
      opponentProfile: null,
    });
  }, [resetSoloRuntime, setLobbyState]);

  useEffect(() => {
    return () => {
      stopSoloTrackingImmediately();
    };
  }, [stopSoloTrackingImmediately]);

  useEffect(() => {
    const previousStep = previousStepRef.current;
    previousStepRef.current = currentStep;

    if (previousStep === "solo-playing" && currentStep !== "solo-playing") {
      stopSoloTrackingImmediately();
      activeSessionRef.current = null;
      sessionStartedAtRef.current = null;
      clearPendingStart();
    }
  }, [clearPendingStart, currentStep, stopSoloTrackingImmediately]);

  useEffect(() => {
    if (currentStep !== "solo-playing") {
      return undefined;
    }

    const handlePageHide = () => {
      stopSoloTrackingImmediately();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopSoloTrackingImmediately();
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [currentStep, stopSoloTrackingImmediately]);

  useEffect(() => {
    if (currentStep !== "solo-playing") {
      return undefined;
    }

    const activeSessionId = activeSoloSessionIdRef.current;
    const activeSession = activeSessionRef.current;

    if (!activeSessionId || !activeSession) {
      return undefined;
    }

    const gameName = parseRomName(getRomFilename(activeSession.romPath), activeSession.core);

    const sendHeartbeat = () => {
      void upsertActivePlaySession({
        core: activeSession.core,
        gameName,
        mode: "solo",
        romPath: activeSession.romPath,
        sessionId: activeSessionId,
      }).catch(() => undefined);
    };

    sendHeartbeat();
    const intervalId = window.setInterval(sendHeartbeat, SOLO_HEARTBEAT_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentStep]);

  return {
    emulatorRef,
    handleBack,
    handleChooseAnotherGame,
    resetToMenu,
    startingRomPath,
    startSoloGame,
  };
}

import { useCallback } from "react";

import type { SystemCore } from "@/components/EmulatorPlayer";
import { appEnvironment } from "@/config/environment";
import { getUserProfile, type RecentOpponent } from "@/lib/user-profile";
import { NETPLAY_COPY } from "@/netplay/netplayCopy";
import type { NetplayPeer } from "@/netplay/peer";
import { type LobbyState, type RomInfo, type RoomVisibility } from "@/stores/useNetplayLobbyStore";
import { toast } from "sonner";

const SERVER_URL = appEnvironment.wsUrl;

type SetLobbyState = (next: LobbyState | ((previous: LobbyState) => LobbyState)) => void;

function getRomFilename(romPath: string) {
  return romPath.split("/").pop() ?? romPath;
}

interface UseNetplayRoomEntryOptions {
  state: LobbyState;
  joinCode: string;
  roomVisibility: RoomVisibility;
  setLobbyState: SetLobbyState;
  setStatus: (status: string) => void;
  setError: (error: string) => void;
  setReplayOpponentTarget: (replayOpponentTarget: RecentOpponent | null) => void;
  resetSessionRuntime: () => void;
  createPeer: () => NetplayPeer;
}

export function useNetplayRoomEntry({
  state,
  joinCode,
  roomVisibility,
  setLobbyState: setState,
  setStatus,
  setError,
  setReplayOpponentTarget,
  resetSessionRuntime,
  createPeer,
}: UseNetplayRoomEntryOptions) {
  const startHostingRoom = useCallback(
    async ({
      romFilename,
      romPath,
      core,
      biosPath,
      isPublic = false,
    }: {
      romFilename: string;
      romPath: string;
      core: SystemCore;
      biosPath?: string;
      isPublic?: boolean;
    }) => {
      resetSessionRuntime();
      setError("");
      setStatus(NETPLAY_COPY.roomCreating);
      const peer = createPeer();
      try {
        await peer.connect(SERVER_URL);
      } catch {
        const message = NETPLAY_COPY.connectionStartFailed;
        setError(message);
        toast.error(message);
        return;
      }

      const originalHandler = peer["handler"];
      const originalOnRoomCreated = originalHandler.onRoomCreated;
      originalHandler.onRoomCreated = (code: string) => {
        originalOnRoomCreated?.(code);
        setState({
          step: "waiting",
          code,
          romFilename,
          romPath,
          core,
          biosPath,
          isPublic,
        });
        setStatus(NETPLAY_COPY.waitingForOpponent);
      };

      peer.createRoom(
        romPath,
        core,
        biosPath,
        getUserProfile()?.nickname,
        getUserProfile()?.avatar,
        isPublic,
      );
    },
    [createPeer, resetSessionRuntime, setError, setState, setStatus],
  );

  const handleCreateRoom = useCallback(
    async (rom: RomInfo) => {
      await startHostingRoom({
        romFilename: rom.filename,
        romPath: rom.path,
        core: rom.core as SystemCore,
        biosPath: rom.bios,
        isPublic: roomVisibility === "public",
      });
    },
    [roomVisibility, startHostingRoom],
  );

  const joinRoomWithCode = useCallback(
    async (roomCode: string) => {
      if (roomCode.length !== 6) {
        setError(NETPLAY_COPY.invalidRoomCode);
        return;
      }

      resetSessionRuntime();
      setError("");
      setStatus(NETPLAY_COPY.joiningRoom);
      const peer = createPeer();
      try {
        await peer.connect(SERVER_URL);
      } catch {
        const message = NETPLAY_COPY.connectionStartFailed;
        setError(message);
        toast.error(message);
        return;
      }
      peer.joinRoom(roomCode, getUserProfile()?.nickname, getUserProfile()?.avatar);
    },
    [createPeer, resetSessionRuntime, setError, setStatus],
  );

  const handleJoinRoom = useCallback(async () => {
    if (joinCode.length !== 6) {
      setError(NETPLAY_COPY.invalidRoomCode);
      return;
    }

    await joinRoomWithCode(joinCode);
  }, [joinCode, joinRoomWithCode, setError]);

  const handleJoinPublicRoom = useCallback(
    async (roomCode: string) => {
      await joinRoomWithCode(roomCode);
    },
    [joinRoomWithCode],
  );

  const handleReplayRecentOpponent = useCallback(
    async (opponent: RecentOpponent, isPublic: boolean) => {
      setReplayOpponentTarget(null);
      await startHostingRoom({
        romFilename: getRomFilename(opponent.romPath),
        romPath: opponent.romPath,
        core: opponent.core as SystemCore,
        biosPath: opponent.biosPath,
        isPublic,
      });
    },
    [setReplayOpponentTarget, startHostingRoom],
  );

  const handleSummaryRematch = useCallback(() => {
    if (state.step !== "session-summary") return;

    void startHostingRoom({
      romFilename: getRomFilename(state.romPath),
      romPath: state.romPath,
      core: state.core,
      biosPath: state.biosPath,
      isPublic: state.isPublic,
    });
  }, [startHostingRoom, state]);

  return {
    handleCreateRoom,
    handleJoinPublicRoom,
    handleJoinRoom,
    handleReplayRecentOpponent,
    handleSummaryRematch,
  };
}

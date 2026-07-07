import { useCallback } from "react";

import type { SystemCore } from "@/components/EmulatorPlayer";
import { appEnvironment } from "@/config/environment";
import { trackEvent } from "@/lib/analytics";
import { parseRomName } from "@/lib/game-names";
import { fetchNetplayRtcConfiguration } from "@/lib/operations-api";
import { getUserProfile } from "@/lib/user-profile";
import { NETPLAY_COPY } from "@/netplay/netplayCopy";
import type { NetplayPeer } from "@/netplay/peer";
import { type LobbyState, type RomInfo, type RoomVisibility } from "@/stores/useNetplayLobbyStore";
import { toast } from "sonner";
import { MAX_SPECTATORS_PER_ROOM } from "../../shared/emulator-protocol";

const SERVER_URL = appEnvironment.wsUrl;

type SetLobbyState = (next: LobbyState | ((previous: LobbyState) => LobbyState)) => void;

function getRomFilename(romPath: string) {
  return romPath.split("/").pop() ?? romPath;
}

/** {@link useNetplayRoomEntry} hook 옵션 인터페이스. */
interface UseNetplayRoomEntryOptions {
  state: LobbyState;
  joinCode: string;
  roomVisibility: RoomVisibility;
  setLobbyState: SetLobbyState;
  setStatus: (status: string) => void;
  setError: (error: string) => void;
  resetSessionRuntime: () => void;
  createPeer: (rtcConfiguration?: RTCConfiguration) => NetplayPeer;
}

/**
 * 넷플레이 방 생성/입장/관전 로직을 담당하는 hook.
 * ICE 서버 설정을 가져와 Peer를 생성하고, 시그널링 서버에 연결한다.
 */
export function useNetplayRoomEntry({
  state,
  joinCode,
  roomVisibility,
  setLobbyState: setState,
  setStatus,
  setError,
  resetSessionRuntime,
  createPeer,
}: UseNetplayRoomEntryOptions) {
  const createConfiguredPeer = useCallback(async () => {
    const rtcConfiguration = await fetchNetplayRtcConfiguration();
    return createPeer(rtcConfiguration);
  }, [createPeer]);

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
      const peer = await createConfiguredPeer();
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
        trackEvent("netplay_room_created", {
          core,
          game_name: parseRomName(romFilename, core),
          visibility: isPublic ? "public" : "private",
        });
        setState({
          step: "waiting",
          code,
          participantId: "host",
          role: "host",
          romFilename,
          romPath,
          core,
          biosPath,
          isPublic,
          participants: [],
          canStart: false,
          isReady: true,
          spectatorSlotsRemaining: MAX_SPECTATORS_PER_ROOM,
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
    [createConfiguredPeer, resetSessionRuntime, setError, setState, setStatus],
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
      const peer = await createConfiguredPeer();
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
    [createConfiguredPeer, resetSessionRuntime, setError, setStatus],
  );

  const spectateRoomWithCode = useCallback(
    async (roomCode: string) => {
      if (roomCode.length !== 6) {
        setError(NETPLAY_COPY.invalidRoomCode);
        return;
      }

      resetSessionRuntime();
      setError("");
      setStatus(NETPLAY_COPY.spectatingRoom);
      const peer = await createConfiguredPeer();
      try {
        await peer.connect(SERVER_URL);
      } catch {
        const message = NETPLAY_COPY.connectionStartFailed;
        setError(message);
        toast.error(message);
        return;
      }
      peer.spectateRoom(roomCode, getUserProfile()?.nickname, getUserProfile()?.avatar);
    },
    [createConfiguredPeer, resetSessionRuntime, setError, setStatus],
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

  const handleSpectateRoom = useCallback(async () => {
    if (joinCode.length !== 6) {
      setError(NETPLAY_COPY.invalidRoomCode);
      return;
    }

    await spectateRoomWithCode(joinCode);
  }, [joinCode, setError, spectateRoomWithCode]);

  const handleSpectatePublicRoom = useCallback(
    async (roomCode: string) => {
      await spectateRoomWithCode(roomCode);
    },
    [spectateRoomWithCode],
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
    handleSpectatePublicRoom,
    handleSpectateRoom,
    handleSummaryRematch,
  };
}

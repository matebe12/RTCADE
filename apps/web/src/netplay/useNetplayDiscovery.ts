import { useCallback, useEffect } from "react";

import { buildBackendUrl } from "@/lib/backend-url";
import type {
  LobbyState,
  PlayingRoomInfo,
  PublicRoomInfo,
  RomInfo,
} from "@/stores/useNetplayLobbyStore";
import { NETPLAY_COPY } from "@/netplay/netplayCopy";
import { toast } from "sonner";

type SetLobbyState = (next: LobbyState | ((previous: LobbyState) => LobbyState)) => void;

/** {@link useNetplayDiscovery} hook 옵션 인터페이스. */
interface UseNetplayDiscoveryOptions {
  currentStep: LobbyState["step"];
  setLobbyState: SetLobbyState;
  setError: (error: string) => void;
  setMenuPublicRooms: (rooms: PublicRoomInfo[]) => void;
}

type DiscoveryMode = "netplay" | "solo";

/**
 * ROM 목록, 공개 방 목록, 플레이 중인 방 목록을 서버 API에서 가져오는 hook.
 * 메뉴 화면에서는 10초 주기로, 공개 방 화면에서는 5초 주기로 자동 새로고침된다.
 */
export function useNetplayDiscovery({
  currentStep,
  setLobbyState,
  setError,
  setMenuPublicRooms,
}: UseNetplayDiscoveryOptions) {
  const fetchRoms = useCallback(
    async (mode: DiscoveryMode = "netplay") => {
      setError("");
      try {
        const response = await fetch(buildBackendUrl("/api/roms"));
        const roms: RomInfo[] = await response.json();
        if (roms.length === 0) {
          const message = NETPLAY_COPY.romsUnavailable;
          setError(message);
          toast.error(message);
          return;
        }
        setLobbyState({ step: mode === "solo" ? "solo-browse" : "browse", roms });
      } catch {
        const message = NETPLAY_COPY.romsLoadFailed;
        setError(message);
        toast.error(message);
      }
    },
    [setError, setLobbyState],
  );

  const fetchPublicRooms = useCallback(
    async (openScreen = false, announceFailure = openScreen) => {
      setError("");

      try {
        const response = await fetch(buildBackendUrl("/api/rooms"));
        if (!response.ok) {
          throw new Error("failed");
        }

        const rooms: PublicRoomInfo[] = await response.json();
        setMenuPublicRooms(rooms.slice(0, 2));
        setLobbyState((previous) => {
          if (
            previous.step === "playing" ||
            previous.step === "watching" ||
            previous.step === "waiting" ||
            previous.step === "session-summary"
          ) {
            return previous;
          }

          if (openScreen || previous.step === "public-rooms") {
            return { step: "public-rooms", rooms };
          }

          return previous;
        });
      } catch {
        const message = NETPLAY_COPY.publicRoomsLoadFailed;
        setError(message);
        if (openScreen) {
          setLobbyState({ step: "public-rooms", rooms: [] });
        }
        if (announceFailure) {
          toast.error(message);
        }
      }
    },
    [setError, setLobbyState, setMenuPublicRooms],
  );

  const fetchPlayingRooms = useCallback(
    async (openScreen = false, announceFailure = openScreen) => {
      setError("");

      try {
        const response = await fetch(buildBackendUrl("/api/rooms/playing"));
        if (!response.ok) {
          throw new Error("failed");
        }

        const rooms: PlayingRoomInfo[] = await response.json();
        setLobbyState((previous) => {
          if (
            previous.step === "playing" ||
            previous.step === "watching" ||
            previous.step === "waiting" ||
            previous.step === "session-summary"
          ) {
            return previous;
          }

          if (openScreen || previous.step === "watch-rooms") {
            return { step: "watch-rooms", rooms };
          }

          return previous;
        });
      } catch {
        const message = NETPLAY_COPY.playingRoomsLoadFailed;
        setError(message);
        if (openScreen) {
          setLobbyState({ step: "watch-rooms", rooms: [] });
        }
        if (announceFailure) {
          toast.error(message);
        }
      }
    },
    [setError, setLobbyState],
  );

  const fetchMenuPublicRooms = useCallback(async () => {
    try {
      const response = await fetch(buildBackendUrl("/api/rooms"));
      if (!response.ok) return;
      const rooms: PublicRoomInfo[] = await response.json();
      setMenuPublicRooms(rooms.slice(0, 2));
    // 메뉴 예고 파내역: 실패 시 조용히 무시
    } catch {
    }
  }, [setMenuPublicRooms]);

  useEffect(() => {
    if (currentStep !== "menu") return;

    void fetchMenuPublicRooms();
    const intervalId = setInterval(() => {
      void fetchMenuPublicRooms();
    }, 10000);

    return () => clearInterval(intervalId);
  }, [currentStep, fetchMenuPublicRooms]);

  useEffect(() => {
    if (currentStep !== "public-rooms") return;

    const intervalId = setInterval(() => {
      void fetchPublicRooms(false, false);
    }, 5000);

    return () => clearInterval(intervalId);
  }, [currentStep, fetchPublicRooms]);

  useEffect(() => {
    if (currentStep !== "watch-rooms") return;

    const intervalId = setInterval(() => {
      void fetchPlayingRooms(false, false);
    }, 5000);

    return () => clearInterval(intervalId);
  }, [currentStep, fetchPlayingRooms]);

  return {
    fetchPlayingRooms,
    fetchPublicRooms,
    fetchRoms,
  };
}

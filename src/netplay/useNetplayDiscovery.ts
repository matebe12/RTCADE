import { useCallback, useEffect } from "react";

import { buildBackendUrl } from "@/lib/backend-url";
import type { LobbyState, PublicRoomInfo, RomInfo } from "@/stores/useNetplayLobbyStore";
import { NETPLAY_COPY } from "@/netplay/netplayCopy";
import { toast } from "sonner";

type SetLobbyState = (next: LobbyState | ((previous: LobbyState) => LobbyState)) => void;

interface UseNetplayDiscoveryOptions {
  currentStep: LobbyState["step"];
  setLobbyState: SetLobbyState;
  setError: (error: string) => void;
  setMenuPublicRooms: (rooms: PublicRoomInfo[]) => void;
}

type DiscoveryMode = "netplay" | "solo";

export function useNetplayDiscovery({
  currentStep,
  setLobbyState,
  setError,
  setMenuPublicRooms,
}: UseNetplayDiscoveryOptions) {
  const fetchRoms = useCallback(async (mode: DiscoveryMode = "netplay") => {
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
  }, [setError, setLobbyState]);

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

  const fetchMenuPublicRooms = useCallback(async () => {
    try {
      const response = await fetch(buildBackendUrl("/api/rooms"));
      if (!response.ok) return;
      const rooms: PublicRoomInfo[] = await response.json();
      setMenuPublicRooms(rooms.slice(0, 2));
    } catch {
      // Menu preview should fail silently.
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

  return {
    fetchPublicRooms,
    fetchRoms,
  };
}

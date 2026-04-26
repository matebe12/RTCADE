import { useLocation } from "react-router-dom";

import { appEnvironment } from "@/config/environment";
import { useNetplayLobbyStore } from "@/stores/useNetplayLobbyStore";

const CONTENT_AD_PATHS = new Set(["/", "/notices", "/settings"]);
const HIDDEN_STEPS = new Set(["playing", "watching", "solo-playing", "session-summary"]);

export function useAdVisibility() {
  const location = useLocation();
  const step = useNetplayLobbyStore((store) => store.state.step);
  const provider = appEnvironment.sideAds.provider;
  const enabled = appEnvironment.sideAds.enabled && provider !== "none";
  const allowedPath = CONTENT_AD_PATHS.has(location.pathname);
  const hiddenByStep = HIDDEN_STEPS.has(step);
  const showRails = enabled && allowedPath && !hiddenByStep;

  return {
    showLeftRail: showRails,
    showRightRail: showRails,
  } as const;
}
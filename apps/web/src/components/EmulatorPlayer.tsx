import { useEffect, forwardRef } from "react";

import type { FBNeoVariant } from "@rtcade/shared";
import { buildBackendUrl } from "@/lib/backend-url";
import { FBNeoPlayer, preloadWasmVariant } from "@rtcade/emulator";

/** ROM 경로에서 FBNeo variant 추론 */
function inferVariant(romPath?: string): FBNeoVariant {
  if (!romPath) return "neogeo";
  if (romPath.startsWith("fbneo/")) return "neogeo";
  return "arcade";
}

export type SystemCore = "arcade" | "fbneo";

interface EmulatorPlayerProps {
  romSource: File | string;
  core: SystemCore;
  role?: "host" | "guest";
  romPath?: string;
  biosPath?: string;
  onLocalInput?: (button: number, down: boolean) => void;
  onEmulatorReady?: () => void;
  onChatShortcut?: () => void;
  onCanvasStreamReady?: (stream: MediaStream, pixelArt?: boolean) => void;
}

/**
 * FBNeoPlayer 래퍼 — ROM URL 구성 + WASM variant 프리로드를 담당한다.
 */
const EmulatorPlayer = forwardRef<HTMLDivElement, EmulatorPlayerProps>(
  function EmulatorPlayer(
    {
      romSource,
      core: _core,
      role,
      romPath,
      biosPath,
      onLocalInput,
      onEmulatorReady,
      onChatShortcut,
      onCanvasStreamReady,
    },
    ref,
  ) {
    const variant = inferVariant(romPath);

    // FBNeo WASM preload
    useEffect(() => {
      preloadWasmVariant(variant).catch(console.error);
    }, [variant]);

    const romUrl = romPath
      ? buildBackendUrl(`/roms/${romPath}`)
      : (typeof romSource === "string" ? romSource : "");
    const biosUrl = biosPath ? buildBackendUrl(`/roms/${biosPath}`) : undefined;

    return (
      <FBNeoPlayer
        ref={ref as React.Ref<HTMLDivElement>}
        romSource={romUrl}
        variant={variant}
        role={role}
        romPath={romPath}
        biosPath={biosUrl}
        onLocalInput={onLocalInput}
        onEmulatorReady={onEmulatorReady}
        onChatShortcut={onChatShortcut}
        onCanvasStreamReady={onCanvasStreamReady}
      />
    );
  },
);

export default EmulatorPlayer;

export const SYSTEM_OPTIONS: { value: SystemCore; label: string; extensions: string }[] = [
  { value: "arcade", label: "Arcade (CPS1/2/3)", extensions: ".zip" },
  { value: "fbneo", label: "Neo Geo / FBNeo", extensions: ".zip" },
];

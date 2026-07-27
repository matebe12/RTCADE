/* eslint-disable react-refresh/only-export-components */
import { useEffect, forwardRef } from "react";

import type { FBNeoVariant } from "@rtcade/shared";
import { buildBackendUrl } from "@/lib/backend-url";
import { FBNeoPlayer, preloadWasmVariant, MamePlayer } from "@rtcade/emulator";

/** ROM 경로에서 FBNeo variant 추론 */
function inferVariant(romPath?: string): FBNeoVariant {
  if (!romPath) return "neogeo";
  if (romPath.startsWith("fbneo/")) return "neogeo";
  return "arcade";
}

export type SystemCore = "arcade" | "fbneo" | "mame2003";

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

const EmulatorPlayer = forwardRef<HTMLDivElement, EmulatorPlayerProps>(
  function EmulatorPlayer(props, ref) {
    const { romSource, core, role, romPath, biosPath, onLocalInput, onEmulatorReady, onChatShortcut, onCanvasStreamReady } = props;
    const variant = inferVariant(romPath);
    const useMame = core === "mame2003";

    // FBNeo WASM preload (when not MAME)
    useEffect(() => { if (!useMame) preloadWasmVariant(variant).catch(console.error); }, [useMame, variant]);

    const romUrl = romPath ? buildBackendUrl(`/roms/${romPath}`) : (typeof romSource === "string" ? romSource : "");
    const biosUrl = biosPath ? buildBackendUrl(`/roms/${biosPath}`)
      : useMame ? buildBackendUrl("/roms/mame2003/neogeo.zip")  // MAME 2003+ 기본 BIOS
      : undefined;

    return useMame ? (
      <MamePlayer
        ref={ref as React.Ref<HTMLDivElement>}
        romSource={romUrl} variant={variant} role={role}
        romPath={romPath} biosPath={biosUrl}
        onLocalInput={onLocalInput} onEmulatorReady={onEmulatorReady}
        onChatShortcut={onChatShortcut} onCanvasStreamReady={onCanvasStreamReady}
      />
    ) : (
      <FBNeoPlayer
        ref={ref as React.Ref<HTMLDivElement>}
        romSource={romUrl} variant={variant} role={role}
        romPath={romPath} biosPath={biosUrl}
        onLocalInput={onLocalInput} onEmulatorReady={onEmulatorReady}
        onChatShortcut={onChatShortcut} onCanvasStreamReady={onCanvasStreamReady}
      />
    );
  },
);

export default EmulatorPlayer;

export const SYSTEM_OPTIONS: { value: SystemCore; label: string; extensions: string }[] = [
  { value: "arcade", label: "Arcade (CPS1/2/3)", extensions: ".zip" },
  { value: "fbneo", label: "Neo Geo / FBNeo", extensions: ".zip" },
  { value: "mame2003", label: "MAME 2003+", extensions: ".zip" },
];

import type { RefObject } from "react";

import {
  EMULATOR_MESSAGE_TYPE,
  type GetSaveStateCommand,
  type IframeToReactMessage,
  isIframeToReactMessage,
  type LoadSaveStateCommand,
  type ReactToIframeMessage,
  type RemoteInputCommand,
  type ResyncGetStateCommand,
  type ResyncLoadStateCommand,
  type StartGameCommand,
  type StartVideoCaptureCommand,
  type StopVideoCaptureCommand,
} from "../../shared/emulator-protocol";

function postToEmulator(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  message: ReactToIframeMessage,
  transferable?: Transferable[],
) {
  const targetWindow = iframeRef.current?.contentWindow;
  if (!targetWindow) {
    return;
  }

  if (transferable && transferable.length > 0) {
    targetWindow.postMessage(message, "*", transferable);
    return;
  }

  targetWindow.postMessage(message, "*");
}

export interface EmulatorRuntimeBridge {
  events: {
    isMessageFromFrame: (event: MessageEvent) => event is MessageEvent<IframeToReactMessage>;
  };
  input: {
    sendRemoteInput: (button: number, down: boolean) => void;
  };
  sync: {
    loadInitialState: (state: ArrayBuffer) => void;
    loadResyncState: (state: ArrayBuffer) => void;
    requestInitialState: () => void;
    requestResyncState: () => void;
    startGame: () => void;
    startVideoCapture: () => void;
    stopVideoCapture: () => void;
  };
  ui: {
    focus: () => void;
  };
}

export function createEmulatorRuntimeBridge(
  iframeRef: RefObject<HTMLIFrameElement | null>,
): EmulatorRuntimeBridge {
  return {
    events: {
      isMessageFromFrame(event: MessageEvent): event is MessageEvent<IframeToReactMessage> {
        if (event.source !== iframeRef.current?.contentWindow) {
          return false;
        }

        return isIframeToReactMessage(event.data);
      },
    },
    input: {
      sendRemoteInput(button: number, down: boolean) {
        const message: RemoteInputCommand = {
          type: EMULATOR_MESSAGE_TYPE.REMOTE_INPUT,
          button,
          down,
        };
        postToEmulator(iframeRef, message);
      },
    },
    sync: {
      loadInitialState(state: ArrayBuffer) {
        const message: LoadSaveStateCommand = {
          type: EMULATOR_MESSAGE_TYPE.LOAD_SAVE_STATE,
          state,
        };
        postToEmulator(iframeRef, message, [state]);
      },
      loadResyncState(state: ArrayBuffer) {
        const message: ResyncLoadStateCommand = {
          type: EMULATOR_MESSAGE_TYPE.RESYNC_LOAD_STATE,
          state,
        };
        postToEmulator(iframeRef, message, [state]);
      },
      requestInitialState() {
        const message: GetSaveStateCommand = { type: EMULATOR_MESSAGE_TYPE.GET_SAVE_STATE };
        postToEmulator(iframeRef, message);
      },
      requestResyncState() {
        const message: ResyncGetStateCommand = { type: EMULATOR_MESSAGE_TYPE.RESYNC_GET_STATE };
        postToEmulator(iframeRef, message);
      },
      startGame() {
        const message: StartGameCommand = { type: EMULATOR_MESSAGE_TYPE.START_GAME };
        postToEmulator(iframeRef, message);
      },
      startVideoCapture() {
        const message: StartVideoCaptureCommand = {
          type: EMULATOR_MESSAGE_TYPE.START_VIDEO_CAPTURE,
        };
        postToEmulator(iframeRef, message);
      },
      stopVideoCapture() {
        const message: StopVideoCaptureCommand = {
          type: EMULATOR_MESSAGE_TYPE.STOP_VIDEO_CAPTURE,
        };
        postToEmulator(iframeRef, message);
      },
    },
    ui: {
      focus() {
        iframeRef.current?.focus();

        try {
          iframeRef.current?.contentWindow?.focus();
        } catch {
          // Ignore focus errors across browser implementations.
        }
      },
    },
  };
}

export function isMessageFromEmulatorFrame(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  event: MessageEvent,
): event is MessageEvent<IframeToReactMessage> {
  return createEmulatorRuntimeBridge(iframeRef).events.isMessageFromFrame(event);
}

export const EMULATOR_MESSAGE_TYPE = {
  CHAT_SHORTCUT: "chat-shortcut",
  EMULATOR_PUBLIC_READY: "emulator-public-ready",
  EMULATOR_READY: "emulator-ready",
  GET_SAVE_STATE: "get-save-state",
  LOAD_SAVE_STATE: "load-save-state",
  LOCAL_INPUT: "localInput",
  REMOTE_INPUT: "remoteInput",
  RESYNC_FAILED: "resync-failed",
  RESYNC_GET_STATE: "resync-get-state",
  RESYNC_LOAD_STATE: "resync-load-state",
  RESYNC_LOADED: "resync-loaded",
  RESYNC_STATE: "resync-state",
  ROM_DATA: "romData",
  SAVE_STATE: "save-state",
  SAVE_STATE_ERROR: "save-state-error",
  START_GAME: "start-game",
  START_VIDEO_CAPTURE: "start-video-capture",
  STATE_LOADED: "state-loaded",
  STOP_VIDEO_CAPTURE: "stop-video-capture",
  VIDEO_FRAME: "video-frame",
} as const;

export type EmulatorMessageType =
  (typeof EMULATOR_MESSAGE_TYPE)[keyof typeof EMULATOR_MESSAGE_TYPE];

export interface RemoteInputCommand {
  type: typeof EMULATOR_MESSAGE_TYPE.REMOTE_INPUT;
  button: number;
  down: boolean;
}

export interface StartGameCommand {
  type: typeof EMULATOR_MESSAGE_TYPE.START_GAME;
}

export interface GetSaveStateCommand {
  type: typeof EMULATOR_MESSAGE_TYPE.GET_SAVE_STATE;
}

export interface LoadSaveStateCommand {
  type: typeof EMULATOR_MESSAGE_TYPE.LOAD_SAVE_STATE;
  state: ArrayBuffer;
}

export interface ResyncGetStateCommand {
  type: typeof EMULATOR_MESSAGE_TYPE.RESYNC_GET_STATE;
}

export interface ResyncLoadStateCommand {
  type: typeof EMULATOR_MESSAGE_TYPE.RESYNC_LOAD_STATE;
  state: ArrayBuffer;
}

export interface RomDataCommand {
  type: typeof EMULATOR_MESSAGE_TYPE.ROM_DATA;
  buffer: ArrayBuffer;
}

export interface StartVideoCaptureCommand {
  type: typeof EMULATOR_MESSAGE_TYPE.START_VIDEO_CAPTURE;
}

export interface StopVideoCaptureCommand {
  type: typeof EMULATOR_MESSAGE_TYPE.STOP_VIDEO_CAPTURE;
}

export type ReactToIframeMessage =
  | GetSaveStateCommand
  | LoadSaveStateCommand
  | RemoteInputCommand
  | ResyncGetStateCommand
  | ResyncLoadStateCommand
  | RomDataCommand
  | StartGameCommand
  | StartVideoCaptureCommand
  | StopVideoCaptureCommand;

export interface LocalInputEvent {
  type: typeof EMULATOR_MESSAGE_TYPE.LOCAL_INPUT;
  button: number;
  down: boolean;
}

export interface EmulatorReadyEvent {
  type: typeof EMULATOR_MESSAGE_TYPE.EMULATOR_READY;
}

export interface EmulatorPublicReadyEvent {
  type: typeof EMULATOR_MESSAGE_TYPE.EMULATOR_PUBLIC_READY;
}

export interface SaveStateEvent {
  type: typeof EMULATOR_MESSAGE_TYPE.SAVE_STATE;
  state: ArrayBuffer;
}

export interface StateLoadedEvent {
  type: typeof EMULATOR_MESSAGE_TYPE.STATE_LOADED;
}

export interface SaveStateErrorEvent {
  type: typeof EMULATOR_MESSAGE_TYPE.SAVE_STATE_ERROR;
  error: string;
}

export interface ResyncStateEvent {
  type: typeof EMULATOR_MESSAGE_TYPE.RESYNC_STATE;
  state: ArrayBuffer;
}

export interface ResyncLoadedEvent {
  type: typeof EMULATOR_MESSAGE_TYPE.RESYNC_LOADED;
}

export interface ResyncFailedEvent {
  type: typeof EMULATOR_MESSAGE_TYPE.RESYNC_FAILED;
}

export interface ChatShortcutEvent {
  type: typeof EMULATOR_MESSAGE_TYPE.CHAT_SHORTCUT;
}

export interface VideoFrameEvent {
  type: typeof EMULATOR_MESSAGE_TYPE.VIDEO_FRAME;
  bitmap: ImageBitmap;
}

export type IframeToReactMessage =
  | ChatShortcutEvent
  | EmulatorPublicReadyEvent
  | EmulatorReadyEvent
  | LocalInputEvent
  | ResyncFailedEvent
  | ResyncLoadedEvent
  | ResyncStateEvent
  | SaveStateErrorEvent
  | SaveStateEvent
  | StateLoadedEvent
  | VideoFrameEvent;

export function isIframeToReactMessage(value: unknown): value is IframeToReactMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeMessage = value as { type?: unknown };
  return typeof maybeMessage.type === "string";
}

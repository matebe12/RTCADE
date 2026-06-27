/** 넷플레이 히어로 섹션에 표시되는 마케팅 문구 모음. */
export const NETPLAY_HERO_COPY = {
  badge: "온라인 대전",
  title: "친구와 바로 연결해 같은 게임을 시작하세요.",
  description:
    "공개 방 둘러보기부터 코드 초대, 대기, 플레이, 마무리까지 한곳에서 자연스럽게 이어집니다.",
  highlights: [
    "공개 방에서 바로 합류하거나 초대 코드로 친구를 불러올 수 있습니다.",
    "연결이 준비되면 대화와 플레이가 끊기지 않게 이어집니다.",
  ],
} as const;

/** 넷플레이 흐름 전반에 사용되는 UI 문구 상수 모음. */
export const NETPLAY_COPY = {
  roomCreating: "방을 만들고 있습니다...",
  waitingForOpponent: "상대방을 기다리는 중... 코드를 공유해 주세요.",
  waitingForRoomReady: "모든 참가자의 준비 완료를 기다리는 중...",
  joiningRoom: "방에 들어가는 중...",
  spectatingRoom: "관전 연결을 준비하는 중...",
  roomLobbyJoined: "대기실에 들어왔어요. 준비 완료 후 시작을 기다리는 중입니다.",
  spectatorLobbyJoined: "관전자 대기실에 들어왔어요. 준비 완료를 눌러 주세요.",
  roomReadyEnabled: "준비 완료로 표시되었습니다.",
  roomReadyDisabled: "준비 상태를 해제했습니다.",
  roomReadyToStart: "모든 참가자 준비가 끝났습니다. 게임을 시작할 수 있습니다.",
  roomGameChangeRequested: "대기실 게임을 변경하는 중...",
  roomGameUpdated: "대기실 게임이 변경되었습니다.",
  roomGameChangedByHost: "방장이 게임을 변경했습니다. 준비 상태를 다시 맞춰 주세요.",
  roomKickRequested: "선택한 참가자를 대기실에서 내보내는 중...",
  roomStartRequested: "모든 준비가 끝났는지 확인하고 게임을 시작하는 중...",
  invalidRoomCode: "참가 코드는 6자리로 입력해 주세요.",
  connectionStartFailed: "연결을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  romsUnavailable: "지금은 선택할 수 있는 게임이 없습니다.",
  romsLoadFailed: "게임 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
  publicRoomsLoadFailed: "공개 방 목록을 불러오지 못했습니다.",
  playingRoomsLoadFailed: "플레이 중인 관전 가능 방 목록을 불러오지 못했습니다.",
  peerConnected: "상대방과 연결되었습니다.",
  peerJoined: "상대방이 들어왔어요. 게임을 준비하고 있습니다.",
  roomJoined: "방에 들어왔어요. 연결을 준비하고 있습니다.",
  spectatorJoined: "관전 방에 들어왔어요. 화면을 받는 중입니다.",
  peerLeft: "상대방 연결이 종료되었습니다.",
  roomKicked: "방장이 대기실에서 내보냈습니다. 다시 참여하려면 방에 재입장해 주세요.",
  chatNotReady: "채팅이 곧 열립니다. 잠시만 기다려 주세요.",
  chatReadyHint: "Enter로 바로 보낼 수 있습니다.",
  chatPendingHint: "연결이 준비되면 바로 대화할 수 있습니다.",
  chatEmptyTitle: "대화가 아직 없습니다",
  chatEmptyDescription: "상대방에게 먼저 말을 걸어보세요.",
  syncPreparing: "게임 시작을 준비하고 있습니다...",
  syncWaitingForOpponent: "게임 화면을 준비했습니다. 상대방을 기다리는 중...",
  syncWaitingForStart: "게임 화면을 준비했습니다. 시작을 기다리는 중...",
  syncStateReceived: "상대방 준비를 받았습니다. 화면을 마무리하는 중...",
  syncFinishingSetup: "게임 시작을 마무리하는 중...",
  syncReadyToStart: "준비가 끝났습니다. 곧 게임이 시작됩니다.",
  syncStartNow: "준비 완료! 게임을 시작합니다.",
  syncFallbackStart: "준비 중 문제가 있어 바로 게임을 시작합니다.",
  defaultSyncStatus: "게임 준비 중...",
  sessionEndedBeforeStart: "게임이 시작되기 전에 마무리됨",
  sessionEndedBySelfEarly: "게임이 시작되기 전에 나갔습니다.",
  sessionEndedByPeerEarly: "상대방이 게임이 시작되기 전에 나갔습니다.",
  sessionEndedBySelf: "플레이를 마무리했습니다. 같은 게임으로 바로 다시 시작할 수 있어요.",
  sessionEndedByPeer: "상대방이 세션을 종료했습니다. 같은 게임으로 다시 이어갈 수 있어요.",
  sessionReasonSelf: "내가 종료함",
  sessionReasonPeer: "상대방이 종료함",
  sessionHint: "같은 게임으로 새 방을 만들면 바로 다시 초대할 수 있습니다.",
} as const;

/**
 * DataChannel 상태값을 화면 표시용 한국어 라벨로 변환한다.
 * @param dcState - RTCDataChannel 상태 문자열 (`open`, `connecting`, `closing`, 등)
 * @returns 한국어 라벨 문자열
 */
export function getConnectionStatusLabel(dcState: string) {
  switch (dcState) {
    case "open":
      return "연결됨";
    case "connecting":
      return "연결 중";
    case "closing":
      return "연결 종료 중";
    default:
      return "연결 대기 중";
  }
}

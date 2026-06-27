import { parseRomName } from "@/lib/game-names";

/** 사용자 프로필 데이터. localStorage에 저장된다. */
export type UserProfile = {
  /** 표시될 닉네임. */
  nickname: string;
  /** 이모지 아바타 문자열. */
  avatar: string;
};

/** 최근 플레이한 게임 이력 항목. */
export type RecentGame = {
  /** ROM 파일 경로 (ex: `arcade/1942.zip`). */
  romPath: string;
  /** 에뮬레이터 코어 (ex: `arcade`). */
  core: string;
  /** 화면에 표시되는 게임명. */
  displayName: string;
  /** 마지막으로 플레이한 시각 (Unix ms). */
  playedAt: number;
};

/** 넷플레이 세션 종료 원인. */
export type RecentOpponentEndReason = "self-left" | "peer-left";

/** 최근 마맼한 상대 플레이어 정보. */
export type RecentOpponent = {
  nickname: string;
  avatar: string;
  romPath: string;
  core: string;
  biosPath?: string;
  gameName: string;
  /** 마지막으로 마맼한 시각 (Unix ms). */
  playedAt: number;
  /** 이 상대와 마맼한 전체 횟수. */
  playCount: number;
  /** 마지막 세션 종료 원인. */
  lastEndReason: RecentOpponentEndReason;
};

const STORAGE_KEY = "retro-user-profile";
const RECENT_GAMES_STORAGE_KEY = "retro-recent-games";
const FAVORITE_GAMES_STORAGE_KEY = "retro-favorite-games";
const RECENT_OPPONENTS_STORAGE_KEY = "retro-recent-opponents";
const TOTAL_PLAY_COUNT_STORAGE_KEY = "retro-total-play-count";
const MAX_RECENT_GAMES = 10;
const MAX_RECENT_OPPONENTS = 8;

/** 선택 가능한 아바타 이모지 목록. */
export const AVATAR_OPTIONS = [
  "🎮",
  "🕹️",
  "👾",
  "🤖",
  "🎯",
  "🏆",
  "🔥",
  "⚡",
  "🎲",
  "🃏",
  "🐉",
  "🦊",
  "🎸",
  "🚀",
  "💀",
  "🌟",
];

/**
 * localStorage에서 사용자 프로필을 읽어온다.
 * @returns 저장된 {@link UserProfile} 또는 `null`
 */
export function getUserProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    if (parsed.nickname && parsed.avatar) return parsed;
    return null;
  } catch {
    return null;
  }
}

/**
 * 사용자 프로필을 localStorage에 저장한다.
 * @param profile - 저장할 프로필
 */
export function saveUserProfile(profile: UserProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

function readJsonArray<T>(storageKey: string): T[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeJsonArray<T>(storageKey: string, value: T[]): void {
  localStorage.setItem(storageKey, JSON.stringify(value));
}

function readNumber(storageKey: string): number | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return typeof parsed === "number" && Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  } catch {
    return null;
  }
}

function writeNumber(storageKey: string, value: number): void {
  localStorage.setItem(storageKey, JSON.stringify(value));
}

function getRomFilename(romPath: string) {
  return romPath.split("/").pop() ?? romPath;
}

function getNormalizedRecentGameDisplayName(romPath: string, core: string) {
  return parseRomName(getRomFilename(romPath), core);
}

/**
 * 최근 플레이 게임 목록을 반환한다 (localStorage 기준, 최대 10개).
 * @returns 날짜 내림차순으로 정렬된 {@link RecentGame} 배열
 */
export function getRecentGames(): RecentGame[] {
  return readJsonArray<RecentGame>(RECENT_GAMES_STORAGE_KEY)
    .filter(
      (game) =>
        typeof game?.romPath === "string" &&
        typeof game?.core === "string" &&
        typeof game?.playedAt === "number",
    )
    .map((game) => ({
      ...game,
      displayName: getNormalizedRecentGameDisplayName(game.romPath, game.core),
    }))
    .sort((left, right) => right.playedAt - left.playedAt)
    .slice(0, MAX_RECENT_GAMES);
}

/**
 * 최근 게임 목록에 항목을 추가하거나 업데이트한다.
 * 동일 ROM이 이미 있으면 새 것으로 교체한다.
 * @param game - 추가할 게임 정보
 * @returns 업데이트된 {@link RecentGame} 배열
 */
export function upsertRecentGame(game: RecentGame): RecentGame[] {
  const normalizedGame = {
    ...game,
    displayName: getNormalizedRecentGameDisplayName(game.romPath, game.core),
  };
  const nextGames = [
    normalizedGame,
    ...getRecentGames().filter((entry) => entry.romPath !== normalizedGame.romPath),
  ].slice(0, MAX_RECENT_GAMES);
  writeJsonArray(RECENT_GAMES_STORAGE_KEY, nextGames);
  return nextGames;
}

/**
 * 전체 누적 플레이 횟수를 반환한다.
 * localStorage에 저장된 값이 없으면 최근 상대 기록에서 유도한다.
 * @returns 누적 플레이 횟수
 */
export function getTotalPlayedCount(): number {
  const storedCount = readNumber(TOTAL_PLAY_COUNT_STORAGE_KEY);
  if (storedCount !== null) {
    return storedCount;
  }

  const derivedOpponentCount = getRecentOpponents().reduce(
    (total, opponent) => total + opponent.playCount,
    0,
  );

  if (derivedOpponentCount > 0) {
    return derivedOpponentCount;
  }

  return getRecentGames().length;
}

/**
 * 누적 플레이 횟수를 1 증가시키고 저장한다.
 * @returns 증가 후 누적 피룰이 횟수
 */
export function incrementTotalPlayedCount(): number {
  const nextCount = getTotalPlayedCount() + 1;
  writeNumber(TOTAL_PLAY_COUNT_STORAGE_KEY, nextCount);
  return nextCount;
}

/**
 * 즐겨찾기한 게임 ROM 경로 목록을 반환한다.
 * @returns ROM 경로 데열 배열
 */
export function getFavoriteGames(): string[] {
  return readJsonArray<string>(FAVORITE_GAMES_STORAGE_KEY).filter(
    (romPath): romPath is string => typeof romPath === "string" && romPath.length > 0,
  );
}

/**
 * 특정 ROM이 즐겨찾기에 등록되어 있는지 확인한다.
 * @param romPath - 확인할 ROM 경로
 * @returns 즐겨찾기 등록 여부
 */
export function isFavoriteGame(romPath: string): boolean {
  return getFavoriteGames().includes(romPath);
}

/**
 * 특정 ROM의 즐겨찾기 등록 상태를 토글한다.
 * 등록되어 있으면 제거, 없으면 추가한다.
 * @param romPath - 토글할 ROM 경로
 * @returns 업데이트된 즐겨찾기 목록
 */
export function toggleFavoriteGame(romPath: string): string[] {
  const favorites = getFavoriteGames();
  const nextFavorites = favorites.includes(romPath)
    ? favorites.filter((favoriteRomPath) => favoriteRomPath !== romPath)
    : [romPath, ...favorites];
  writeJsonArray(FAVORITE_GAMES_STORAGE_KEY, nextFavorites);
  return nextFavorites;
}

/**
 * 최근 마맼 상대 목록을 반환한다 (localStorage 기준, 최대 8명).
 * @returns 날짜 내림차순으로 정렬된 {@link RecentOpponent} 배열
 */
export function getRecentOpponents(): RecentOpponent[] {
  return readJsonArray<RecentOpponent>(RECENT_OPPONENTS_STORAGE_KEY)
    .filter(
      (opponent) =>
        typeof opponent?.nickname === "string" &&
        opponent.nickname.length > 0 &&
        typeof opponent?.avatar === "string" &&
        opponent.avatar.length > 0 &&
        typeof opponent?.romPath === "string" &&
        typeof opponent?.core === "string" &&
        typeof opponent?.gameName === "string" &&
        typeof opponent?.playedAt === "number" &&
        (opponent.biosPath === undefined || typeof opponent.biosPath === "string"),
    )
    .map((opponent) => ({
      ...opponent,
      playCount:
        typeof opponent.playCount === "number" && opponent.playCount > 0 ? opponent.playCount : 1,
      lastEndReason:
        opponent.lastEndReason === "self-left" || opponent.lastEndReason === "peer-left"
          ? opponent.lastEndReason
          : "peer-left",
    }))
    .sort((left, right) => right.playedAt - left.playedAt)
    .slice(0, MAX_RECENT_OPPONENTS);
}

/**
 * 최근 상대 목록에 상대를 추가하거나 업데이트한다.
 * 닉네임+아바타 조합으로 중복 제거하며, 마맼 횟수를 누적한다.
 * @param opponent - 추가할 상대 정보
 * @returns 업데이트된 상대 목록
 */
export function upsertRecentOpponent(opponent: RecentOpponent): RecentOpponent[] {
  const dedupeKey = `${opponent.nickname}::${opponent.avatar}`;
  const existingOpponent = getRecentOpponents().find(
    (entry) => `${entry.nickname}::${entry.avatar}` === dedupeKey,
  );
  const nextOpponents = [
    {
      ...opponent,
      playCount: (existingOpponent?.playCount ?? 0) + 1,
      lastEndReason: opponent.lastEndReason,
    },
    ...getRecentOpponents().filter((entry) => `${entry.nickname}::${entry.avatar}` !== dedupeKey),
  ].slice(0, MAX_RECENT_OPPONENTS);

  writeJsonArray(RECENT_OPPONENTS_STORAGE_KEY, nextOpponents);
  return nextOpponents;
}

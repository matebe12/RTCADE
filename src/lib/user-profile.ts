export type UserProfile = {
  nickname: string;
  avatar: string;
};

export type RecentGame = {
  romPath: string;
  core: string;
  displayName: string;
  playedAt: number;
};

export type RecentOpponentEndReason = "self-left" | "peer-left";

export type RecentOpponent = {
  nickname: string;
  avatar: string;
  romPath: string;
  core: string;
  biosPath?: string;
  gameName: string;
  playedAt: number;
  playCount: number;
  lastEndReason: RecentOpponentEndReason;
};

const STORAGE_KEY = "retro-user-profile";
const RECENT_GAMES_STORAGE_KEY = "retro-recent-games";
const FAVORITE_GAMES_STORAGE_KEY = "retro-favorite-games";
const RECENT_OPPONENTS_STORAGE_KEY = "retro-recent-opponents";
const TOTAL_PLAY_COUNT_STORAGE_KEY = "retro-total-play-count";
const MAX_RECENT_GAMES = 10;
const MAX_RECENT_OPPONENTS = 8;

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

export function getRecentGames(): RecentGame[] {
  return readJsonArray<RecentGame>(RECENT_GAMES_STORAGE_KEY)
    .filter(
      (game) =>
        typeof game?.romPath === "string" &&
        typeof game?.core === "string" &&
        typeof game?.displayName === "string" &&
        typeof game?.playedAt === "number",
    )
    .sort((left, right) => right.playedAt - left.playedAt)
    .slice(0, MAX_RECENT_GAMES);
}

export function upsertRecentGame(game: RecentGame): RecentGame[] {
  const nextGames = [
    game,
    ...getRecentGames().filter((entry) => entry.romPath !== game.romPath),
  ].slice(0, MAX_RECENT_GAMES);
  writeJsonArray(RECENT_GAMES_STORAGE_KEY, nextGames);
  return nextGames;
}

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

export function incrementTotalPlayedCount(): number {
  const nextCount = getTotalPlayedCount() + 1;
  writeNumber(TOTAL_PLAY_COUNT_STORAGE_KEY, nextCount);
  return nextCount;
}

export function getFavoriteGames(): string[] {
  return readJsonArray<string>(FAVORITE_GAMES_STORAGE_KEY).filter(
    (romPath): romPath is string => typeof romPath === "string" && romPath.length > 0,
  );
}

export function isFavoriteGame(romPath: string): boolean {
  return getFavoriteGames().includes(romPath);
}

export function toggleFavoriteGame(romPath: string): string[] {
  const favorites = getFavoriteGames();
  const nextFavorites = favorites.includes(romPath)
    ? favorites.filter((favoriteRomPath) => favoriteRomPath !== romPath)
    : [romPath, ...favorites];
  writeJsonArray(FAVORITE_GAMES_STORAGE_KEY, nextFavorites);
  return nextFavorites;
}

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

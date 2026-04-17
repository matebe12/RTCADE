import { buildBackendUrl } from "@/lib/backend-url";

export interface PopularGameSummary {
  gameName: string;
  playCount: number;
}

export interface OperationsStats {
  activeRooms: number;
  connectedPlayers: number;
  dbEnabled: boolean;
  monthlyPopularGame: PopularGameSummary | null;
  openRooms: number;
  todayGames: number;
  todayVisitors: number;
  totalVisitors: number;
  waitingRooms: number;
  weeklyPopularGame: PopularGameSummary | null;
}

export interface RecordGameSessionInput {
  core: string;
  gameName: string;
  romPath: string;
}

export interface NoticeItem {
  body: string;
  createdAt: string;
  id: number;
  isPinned: boolean;
  isPublished: boolean;
  publishedAt: string;
  title: string;
  updatedAt: string;
}

interface NoticeResponse {
  items: NoticeItem[];
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toPopularGameSummary(value: unknown): PopularGameSummary | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as { gameName?: unknown; playCount?: unknown };

  if (typeof candidate.gameName !== "string" || candidate.gameName.trim().length === 0) {
    return null;
  }

  return {
    gameName: candidate.gameName,
    playCount: toNumber(candidate.playCount),
  };
}

function normalizeOperationsStats(value: unknown): OperationsStats {
  const candidate = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    activeRooms: toNumber(candidate.activeRooms),
    connectedPlayers: toNumber(candidate.connectedPlayers),
    dbEnabled: candidate.dbEnabled === true,
    monthlyPopularGame: toPopularGameSummary(candidate.monthlyPopularGame),
    openRooms: toNumber(candidate.openRooms),
    todayGames: toNumber(candidate.todayGames),
    todayVisitors: toNumber(candidate.todayVisitors),
    totalVisitors: toNumber(candidate.totalVisitors),
    waitingRooms: toNumber(candidate.waitingRooms),
    weeklyPopularGame: toPopularGameSummary(candidate.weeklyPopularGame),
  };
}

async function request(pathname: string, init?: RequestInit) {
  const response = await fetch(buildBackendUrl(pathname), init);

  if (!response.ok) {
    throw new Error("잠시 후 다시 시도해 주세요.");
  }

  return response;
}

async function fetchJson<T>(pathname: string, init?: RequestInit): Promise<T> {
  const response = await request(pathname, init);

  return (await response.json()) as T;
}

export function fetchOperationsStats() {
  return fetchJson<unknown>("/api/stats").then(normalizeOperationsStats);
}

export async function recordGameSession(input: RecordGameSessionInput) {
  await request("/api/game-sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function fetchNotices() {
  const response = await fetchJson<NoticeResponse>("/api/notices");
  return response.items;
}

import { buildBackendUrl } from "@/lib/backend-url";

export interface OperationsStats {
  activeRooms: number;
  connectedPlayers: number;
  dbEnabled: boolean;
  openRooms: number;
  todayVisitors: number;
  totalVisitors: number;
  waitingRooms: number;
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

async function fetchJson<T>(pathname: string): Promise<T> {
  const response = await fetch(buildBackendUrl(pathname));

  if (!response.ok) {
    throw new Error("요청을 처리하지 못했습니다.");
  }

  return (await response.json()) as T;
}

export function fetchOperationsStats() {
  return fetchJson<OperationsStats>("/api/stats");
}

export async function fetchNotices() {
  const response = await fetchJson<NoticeResponse>("/api/notices");
  return response.items;
}

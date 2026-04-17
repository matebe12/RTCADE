import { appEnvironment } from "@/config/environment";

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

function buildApiUrl(pathname: string) {
  const baseUrl = appEnvironment.apiBaseUrl.endsWith("/")
    ? appEnvironment.apiBaseUrl
    : `${appEnvironment.apiBaseUrl}/`;

  return new URL(pathname.replace(/^\//, ""), baseUrl).toString();
}

async function fetchJson<T>(pathname: string): Promise<T> {
  const response = await fetch(buildApiUrl(pathname));

  if (!response.ok) {
    throw new Error(`API ${response.status} ${response.statusText}`);
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
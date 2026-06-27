import { appEnvironment } from "@/config/environment";

/** 방문자 ID를 localStorage에 저장하는 키. */
const VISITOR_STORAGE_KEY = "rtcade_visitor_id";

function createVisitorId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getVisitorId() {
  if (typeof window === "undefined") {
    return createVisitorId();
  }

  try {
    const existingVisitorId = window.localStorage.getItem(VISITOR_STORAGE_KEY);
    if (existingVisitorId) {
      return existingVisitorId;
    }

    const nextVisitorId = createVisitorId();
    window.localStorage.setItem(VISITOR_STORAGE_KEY, nextVisitorId);
    return nextVisitorId;
  } catch {
    return createVisitorId();
  }
}

/**
 * 백엔드 API URL을 생성한다.
 * 경로와 선택적 쿼리 파라미터를 박았을 때 기본 API URL에 합친다.
 * 방문자 ID가 `visitorId` 쿼리 파라미터로 자동 첨부된다.
 * @param pathname - API 경로 (ex: `/api/rooms`)
 * @param searchParams - 추가 쿼리 파라미터 (optional)
 * @returns 완성된 API URL 문자열
 */
export function buildBackendUrl(pathname: string, searchParams?: URLSearchParams) {
  const baseUrl = appEnvironment.apiBaseUrl.endsWith("/")
    ? appEnvironment.apiBaseUrl
    : `${appEnvironment.apiBaseUrl}/`;

  const url = new URL(pathname.replace(/^\//, ""), baseUrl);

  if (searchParams) {
    for (const [key, value] of searchParams.entries()) {
      url.searchParams.set(key, value);
    }
  }

  url.searchParams.set("visitorId", getVisitorId());
  return url.toString();
}

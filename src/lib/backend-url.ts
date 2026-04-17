import { appEnvironment } from "@/config/environment";

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

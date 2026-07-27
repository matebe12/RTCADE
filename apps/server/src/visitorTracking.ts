import { randomUUID } from "crypto";
import type { RequestHandler } from "express";

import type { OperationsDatabase } from "./operationsDatabase";

/** 방문자 쿠키 이름. */
const VISITOR_COOKIE_NAME = "rtcade_visitor_id";
/** 쿠키 만료 시간 (1년). */
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;
/** 쿠키를 사용하지 못하는 클라이언트를 위한 쿼리파라미터 이름. */
const VISITOR_QUERY_PARAM = "visitorId";

function isValidVisitorId(value: string) {
  return /^[a-zA-Z0-9-]{8,128}$/.test(value);
}

function isSecureRequest(requestHeaders: Record<string, string | string[] | undefined>) {
  return requestHeaders["x-forwarded-proto"] === "https";
}

function parseCookies(cookieHeader: string | undefined) {
  if (!cookieHeader) {
    return new Map<string, string>();
  }

  return new Map(
    cookieHeader
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separatorIndex = entry.indexOf("=");

        if (separatorIndex === -1) {
          return [entry, ""] as const;
        }

        return [entry.slice(0, separatorIndex), entry.slice(separatorIndex + 1)] as const;
      }),
  );
}

function serializeVisitorCookie(visitorId: string, secure: boolean) {
  const parts = [
    `${VISITOR_COOKIE_NAME}=${visitorId}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${ONE_YEAR_IN_SECONDS}`,
  ];

  if (secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function readVisitorIdFromQuery(rawValue: unknown) {
  if (typeof rawValue !== "string") {
    return null;
  }

  const visitorId = rawValue.trim();
  return isValidVisitorId(visitorId) ? visitorId : null;
}

function shouldTrackPath(pathname: string) {
  return !pathname.startsWith("/roms/");
}

/**
 * 방문자 식별 미들웨어를 생성한다.
 * GET 요청에서 식별자를 쿠키 또는 쿼리파라미터로 추출하고, DB에 방문을 기록한다.
 * DB가 비활성화된 경우 추적 없이 다음 미들웨어로 넘어간다.
 * @param operationsDatabase - DB 인터페이스
 * @returns Express 요청 핸들러
 */
export function createVisitorTrackingMiddleware(
  operationsDatabase: OperationsDatabase,
): RequestHandler {
  return (req, res, next) => {
    if (!operationsDatabase.isEnabled || req.method !== "GET" || !shouldTrackPath(req.path)) {
      next();
      return;
    }

    const cookies = parseCookies(req.headers.cookie);
    const existingVisitorId = cookies.get(VISITOR_COOKIE_NAME);
    const queryVisitorId = readVisitorIdFromQuery(req.query[VISITOR_QUERY_PARAM]);
    const visitorId = queryVisitorId || existingVisitorId || randomUUID();

    if (!existingVisitorId) {
      res.append(
        "Set-Cookie",
        serializeVisitorCookie(visitorId, req.secure || isSecureRequest(req.headers)),
      );
    }

    void operationsDatabase.recordVisit(visitorId);
    next();
  };
}

import { randomUUID } from "crypto";
import type { RequestHandler } from "express";

import type { OperationsDatabase } from "./operationsDatabase";

const VISITOR_COOKIE_NAME = "rtcade_visitor_id";
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

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

function shouldTrackPath(pathname: string) {
  return !pathname.startsWith("/roms/");
}

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
    const visitorId = existingVisitorId || randomUUID();

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

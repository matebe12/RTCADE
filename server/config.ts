import type { RequestHandler } from "express";
import path from "path";

/** 서버 실행에 필요한 설정값 모음. 환경변수에서 읽어 임포트된다. */
export interface ServerConfig {
  port: number;
  romsDir: string;
  allowedOrigins: string[];
  databaseUrl: string | null;
  noticeAdminToken: string | null;
  emulatorJsDataUrl: string;
  iceServers: IceServerDefinition[];
}

/** 단일 ICE 서버 정의. STUN 또는 TURN 서버 URL과 인증 정보를 포함한다. */
export interface IceServerDefinition {
  urls: string[];
  username?: string;
  credential?: string;
}

const DEFAULT_STUN_SERVER_URLS = ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"];

/** EmulatorJS data URL 끝에 '/'가 없으면 추가한다. */
function normalizeEmulatorJsDataUrl(url: string) {
  return url.endsWith("/") ? url : `${url}/`;
}

/**
 * 환경변수에서 PostgreSQL 연결 URL을 구성한다.
 * `DATABASE_PRIVATE_URL` → `DATABASE_URL` → `DATABASE_PUBLIC_URL` → PG* 개별 변수 순으로 탐색한다.
 * @returns 연결 URL 문자열, 구성 불가 시 `null`
 */
function buildDatabaseUrlFromEnv() {
  const directUrl =
    process.env.DATABASE_PRIVATE_URL ||
    process.env.DATABASE_URL ||
    process.env.DATABASE_PUBLIC_URL ||
    null;

  if (directUrl) {
    return directUrl;
  }

  const host = process.env.PGHOST || null;
  const port = process.env.PGPORT || null;
  const database = process.env.PGDATABASE || null;
  const user = process.env.PGUSER || null;
  const password = process.env.PGPASSWORD || null;
  const sslMode = process.env.PGSSLMODE || "require";

  if (!host || !port || !database || !user || !password) {
    return null;
  }

  const url = new URL("postgresql://localhost");
  url.hostname = host;
  url.port = port;
  url.pathname = `/${database}`;
  url.username = user;
  url.password = password;
  url.searchParams.set("sslmode", sslMode);

  return url.toString();
}

/** 환경변수 값이 비어있거나 공백만 있으면 `undefined`를 반환한다. */
function normalizeOptionalEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

/** 쉼표로 구분된 URL 목록 환경변수를 배열로 파싱한다. */
function parseUrlList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * 환경변수에서 ICE 서버 목록을 구성한다.
 * STUN/TURN URL이 없으면 구글 기본 STUN 서버를 사용한다.
 * @returns {@link IceServerDefinition} 배열
 */
function getIceServersFromEnv(): IceServerDefinition[] {
  const stunUrls = parseUrlList(process.env.STUN_SERVER_URLS);
  const turnUrls = parseUrlList(process.env.TURN_SERVER_URLS);
  const turnUsername = normalizeOptionalEnv(process.env.TURN_USERNAME);
  const turnCredential = normalizeOptionalEnv(process.env.TURN_CREDENTIAL);
  const iceServers: IceServerDefinition[] = [
    {
      urls: stunUrls.length > 0 ? stunUrls : DEFAULT_STUN_SERVER_URLS,
    },
  ];

  if (turnUrls.length > 0) {
    iceServers.push({
      urls: turnUrls,
      username: turnUsername,
      credential: turnCredential,
    });
  }

  return iceServers;
}

/**
 * 환경변수에서 서버 설정을 읽어 {@link ServerConfig}를 반환한다.
 * `PORT`, `ROMS_PATH`, `CORS_ORIGIN`, `DATABASE_*`, `EMULATORJS_DATA_URL` 등을 읽는다.
 * @returns 설정값 객체
 */
export function getServerConfig(): ServerConfig {
  return {
    port: Number.parseInt(process.env.PORT || "3001", 10),
    romsDir: process.env.ROMS_PATH || path.join(import.meta.dirname, "roms"),
    allowedOrigins: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : ["*"],
    databaseUrl: buildDatabaseUrlFromEnv(),
    noticeAdminToken: process.env.NOTICE_ADMIN_TOKEN || null,
    emulatorJsDataUrl: normalizeEmulatorJsDataUrl(
      process.env.EMULATORJS_DATA_URL || "https://cdn.emulatorjs.org/stable/data/",
    ),
    iceServers: getIceServersFromEnv(),
  };
}

/**
 * CORS 마들웨어를 생성한다.
 * `allowedOrigins`가 `["*"]`이면 모든 오리진에서의 요청을 허용한다.
 * @param allowedOrigins - 허용할 오리진 배열
 * @returns Express 마들웨어 함수
 */
export function createCorsMiddleware(allowedOrigins: string[]): RequestHandler {
  return (req, res, next) => {
    const origin = req.headers.origin || "*";

    if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
    }

    res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }

    next();
  };
}

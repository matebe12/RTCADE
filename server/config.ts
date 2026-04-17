import type { RequestHandler } from "express";
import path from "path";

export interface ServerConfig {
  port: number;
  romsDir: string;
  allowedOrigins: string[];
  databaseUrl: string | null;
}

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

export function getServerConfig(): ServerConfig {
  return {
    port: Number.parseInt(process.env.PORT || "3001", 10),
    romsDir: process.env.ROMS_PATH || path.join(import.meta.dirname, "roms"),
    allowedOrigins: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : ["*"],
    databaseUrl: buildDatabaseUrlFromEnv(),
  };
}

export function createCorsMiddleware(allowedOrigins: string[]): RequestHandler {
  return (req, res, next) => {
    const origin = req.headers.origin || "*";

    if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
    }

    res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
  };
}

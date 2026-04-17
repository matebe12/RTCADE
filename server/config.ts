import type { RequestHandler } from "express";
import path from "path";

export interface ServerConfig {
  port: number;
  romsDir: string;
  allowedOrigins: string[];
}

export function getServerConfig(): ServerConfig {
  return {
    port: Number.parseInt(process.env.PORT || "3001", 10),
    romsDir: process.env.ROMS_PATH || path.join(import.meta.dirname, "roms"),
    allowedOrigins: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : ["*"],
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

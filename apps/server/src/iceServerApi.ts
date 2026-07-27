import type { Express } from "express";

import type { IceServerDefinition } from "./config";

/**
 * ICE 서버 목록을 제공하는 라우트를 등록한다.
 * `GET /api/ice-servers` 응답으로 서버 설정의 ICE 서버 배열을 반환한다.
 * @param app - Express 앱 인스턴스
 * @param iceServers - 서버 기동 시 로드된 ICE 서버 리스트
 */
export function registerIceServerRoutes(app: Express, iceServers: IceServerDefinition[]) {
  app.get("/api/ice-servers", (_req, res) => {
    res.json({ iceServers });
  });
}
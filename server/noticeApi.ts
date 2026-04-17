import type { Express } from "express";

import type {
  CreateNoticeInput,
  OperationsDatabase,
  UpdateNoticeInput,
} from "./operationsDatabase";

function extractBearerToken(authorizationHeader: string | undefined) {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice("Bearer ".length).trim();
}

function requireAdminToken(
  configuredToken: string | null,
  authorizationHeader: string | undefined,
) {
  if (!configuredToken) {
    return { ok: false as const, status: 503, message: "관리자 공지 API가 비활성화되어 있습니다." };
  }

  const requestToken = extractBearerToken(authorizationHeader);
  if (!requestToken || requestToken !== configuredToken) {
    return { ok: false as const, status: 401, message: "관리자 토큰이 올바르지 않습니다." };
  }

  return { ok: true as const };
}

function validateCreateNoticeInput(body: unknown): CreateNoticeInput | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Record<string, unknown>;
  if (typeof candidate.title !== "string" || typeof candidate.body !== "string") {
    return null;
  }

  return {
    title: candidate.title.trim(),
    body: candidate.body.trim(),
    isPinned: typeof candidate.isPinned === "boolean" ? candidate.isPinned : undefined,
    isPublished: typeof candidate.isPublished === "boolean" ? candidate.isPublished : undefined,
    publishedAt: typeof candidate.publishedAt === "string" ? candidate.publishedAt : undefined,
  };
}

function validateUpdateNoticeInput(body: unknown): UpdateNoticeInput | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Record<string, unknown>;
  const nextInput: UpdateNoticeInput = {};

  if (typeof candidate.title === "string") {
    nextInput.title = candidate.title.trim();
  }
  if (typeof candidate.body === "string") {
    nextInput.body = candidate.body.trim();
  }
  if (typeof candidate.isPinned === "boolean") {
    nextInput.isPinned = candidate.isPinned;
  }
  if (typeof candidate.isPublished === "boolean") {
    nextInput.isPublished = candidate.isPublished;
  }
  if (typeof candidate.publishedAt === "string") {
    nextInput.publishedAt = candidate.publishedAt;
  }

  return Object.keys(nextInput).length > 0 ? nextInput : null;
}

export function registerNoticeRoutes(
  app: Express,
  operationsDatabase: OperationsDatabase,
  noticeAdminToken: string | null,
) {
  app.get("/api/notices", async (_req, res) => {
    const notices = await operationsDatabase.listNotices();
    res.json({ items: notices });
  });

  app.post("/api/admin/notices", async (req, res) => {
    const authResult = requireAdminToken(noticeAdminToken, req.headers.authorization);
    if (!authResult.ok) {
      res.status(authResult.status).json({ message: authResult.message });
      return;
    }

    const input = validateCreateNoticeInput(req.body);
    if (!input?.title || !input.body) {
      res.status(400).json({ message: "title과 body는 필수입니다." });
      return;
    }

    const notice = await operationsDatabase.createNotice(input);
    if (!notice) {
      res.status(500).json({ message: "공지 생성에 실패했습니다." });
      return;
    }

    res.status(201).json({ item: notice });
  });

  app.patch("/api/admin/notices/:id", async (req, res) => {
    const authResult = requireAdminToken(noticeAdminToken, req.headers.authorization);
    if (!authResult.ok) {
      res.status(authResult.status).json({ message: authResult.message });
      return;
    }

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ message: "유효한 공지 id가 필요합니다." });
      return;
    }

    const input = validateUpdateNoticeInput(req.body);
    if (!input) {
      res.status(400).json({ message: "수정할 필드가 필요합니다." });
      return;
    }

    const notice = await operationsDatabase.updateNotice(id, input);
    if (!notice) {
      res.status(404).json({ message: "공지를 찾을 수 없거나 수정에 실패했습니다." });
      return;
    }

    res.json({ item: notice });
  });
}

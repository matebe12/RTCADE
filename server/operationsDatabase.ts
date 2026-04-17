import { Pool } from "pg";

export interface NoticeRecord {
  id: number;
  title: string;
  body: string;
  isPinned: boolean;
  isPublished: boolean;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoticeInput {
  body: string;
  isPinned?: boolean;
  isPublished?: boolean;
  publishedAt?: string;
  title: string;
}

export interface UpdateNoticeInput {
  body?: string;
  isPinned?: boolean;
  isPublished?: boolean;
  publishedAt?: string;
  title?: string;
}

export interface VisitorCounts {
  todayVisitors: number;
  totalVisitors: number;
}

export interface OperationsDatabase {
  createNotice: (input: CreateNoticeInput) => Promise<NoticeRecord | null>;
  isEnabled: boolean;
  getVisitorCounts: () => Promise<VisitorCounts>;
  initialize: () => Promise<void>;
  listNotices: (limit?: number) => Promise<NoticeRecord[]>;
  recordVisit: (visitorId: string) => Promise<void>;
  updateNotice: (id: number, input: UpdateNoticeInput) => Promise<NoticeRecord | null>;
}

const DEFAULT_COUNTS: VisitorCounts = {
  todayVisitors: 0,
  totalVisitors: 0,
};

const DEFAULT_NOTICES = [
  {
    title: "RTCADE 운영 센터 오픈",
    body: "홈에서 총 방문자, 오늘 방문자, 현재 게임중 수를 바로 확인할 수 있고, 공지사항 페이지에서 운영 공지를 읽기 전용으로 확인할 수 있습니다.",
    isPinned: true,
  },
  {
    title: "Railway PostgreSQL 연동 완료",
    body: "서버는 visitors, daily_visitors, notices 테이블을 자동 초기화합니다. 데이터베이스 연결이 없을 때도 서비스는 폴백 모드로 계속 동작합니다.",
    isPinned: false,
  },
] as const;

function shouldUseSsl(databaseUrl: string) {
  try {
    const parsedUrl = new URL(databaseUrl);
    const sslMode = parsedUrl.searchParams.get("sslmode");

    if (sslMode === "disable") {
      return false;
    }

    if (sslMode) {
      return true;
    }

    return !parsedUrl.hostname.endsWith(".railway.internal");
  } catch {
    return !databaseUrl.includes("sslmode=disable");
  }
}

const CREATE_VISITORS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS visitors (
    visitor_id TEXT PRIMARY KEY,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

const CREATE_DAILY_VISITORS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS daily_visitors (
    visit_date DATE NOT NULL,
    visitor_id TEXT NOT NULL,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (visit_date, visitor_id),
    FOREIGN KEY (visitor_id) REFERENCES visitors(visitor_id) ON DELETE CASCADE
  )
`;

const CREATE_NOTICES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS notices (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

const CREATE_NOTICE_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS notices_published_at_idx
  ON notices (is_published, is_pinned, published_at DESC)
`;

function mapNoticeRow(row: {
  id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  is_published: boolean;
  published_at: Date;
  created_at: Date;
  updated_at: Date;
}): NoticeRecord {
  return {
    id: Number(row.id),
    title: row.title,
    body: row.body,
    isPinned: row.is_pinned,
    isPublished: row.is_published,
    publishedAt: row.published_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function normalizePublishedAt(value: string | undefined) {
  return value ? new Date(value) : new Date();
}

async function seedDefaultNotices(pool: Pool) {
  const existingNoticesResult = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM notices",
  );

  if (Number(existingNoticesResult.rows[0]?.count || "0") > 0) {
    return;
  }

  for (const notice of DEFAULT_NOTICES) {
    await pool.query(
      `
        INSERT INTO notices (title, body, is_pinned, is_published, published_at)
        VALUES ($1, $2, $3, TRUE, NOW())
      `,
      [notice.title, notice.body, notice.isPinned],
    );
  }
}

export function createOperationsDatabase(databaseUrl: string | null): OperationsDatabase {
  let pool =
    databaseUrl !== null
      ? new Pool({
          connectionString: databaseUrl,
          ssl: shouldUseSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
        })
      : null;

  async function runSafely<T>(task: () => Promise<T>, fallback: T) {
    if (!pool) {
      return fallback;
    }

    try {
      return await task();
    } catch (error) {
      console.error("[DB] Operation failed:", error);
      return fallback;
    }
  }

  return {
    createNotice: async (input) =>
      runSafely(async () => {
        if (input.isPinned) {
          await pool!.query("UPDATE notices SET is_pinned = FALSE WHERE is_pinned = TRUE");
        }

        const result = await pool!.query<{
          id: string;
          title: string;
          body: string;
          is_pinned: boolean;
          is_published: boolean;
          published_at: Date;
          created_at: Date;
          updated_at: Date;
        }>(
          `
            INSERT INTO notices (title, body, is_pinned, is_published, published_at)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, title, body, is_pinned, is_published, published_at, created_at, updated_at
          `,
          [
            input.title,
            input.body,
            input.isPinned ?? false,
            input.isPublished ?? true,
            normalizePublishedAt(input.publishedAt),
          ],
        );

        return mapNoticeRow(result.rows[0]);
      }, null),
    get isEnabled() {
      return pool !== null;
    },
    getVisitorCounts: async () =>
      runSafely(async () => {
        const totalVisitorsResult = await pool!.query<{ count: string }>(
          "SELECT COUNT(*)::text AS count FROM visitors",
        );
        const todayVisitorsResult = await pool!.query<{ count: string }>(
          "SELECT COUNT(*)::text AS count FROM daily_visitors WHERE visit_date = CURRENT_DATE",
        );

        return {
          todayVisitors: Number(todayVisitorsResult.rows[0]?.count || "0"),
          totalVisitors: Number(totalVisitorsResult.rows[0]?.count || "0"),
        };
      }, DEFAULT_COUNTS),
    initialize: async () => {
      if (!pool) {
        return;
      }

      try {
        await pool.query(CREATE_VISITORS_TABLE_SQL);
        await pool.query(CREATE_DAILY_VISITORS_TABLE_SQL);
        await pool.query(CREATE_NOTICES_TABLE_SQL);
        await pool.query(CREATE_NOTICE_INDEX_SQL);
        await seedDefaultNotices(pool);
      } catch (error) {
        console.error("[DB] Initialization failed, disabling DB-backed features:", error);
        await pool.end().catch(() => undefined);
        pool = null;
      }
    },
    listNotices: async (limit = 20) =>
      runSafely(async () => {
        const result = await pool!.query<{
          id: string;
          title: string;
          body: string;
          is_pinned: boolean;
          is_published: boolean;
          published_at: Date;
          created_at: Date;
          updated_at: Date;
        }>(
          `
            SELECT id, title, body, is_pinned, is_published, published_at, created_at, updated_at
            FROM notices
            WHERE is_published = TRUE
            ORDER BY is_pinned DESC, published_at DESC
            LIMIT $1
          `,
          [limit],
        );

        return result.rows.map(mapNoticeRow);
      }, []),
    recordVisit: async (visitorId) => {
      await runSafely(async () => {
        await pool!.query(
          `
            INSERT INTO visitors (visitor_id)
            VALUES ($1)
            ON CONFLICT (visitor_id)
            DO UPDATE SET last_seen_at = NOW()
          `,
          [visitorId],
        );
        await pool!.query(
          `
            INSERT INTO daily_visitors (visit_date, visitor_id)
            VALUES (CURRENT_DATE, $1)
            ON CONFLICT (visit_date, visitor_id)
            DO NOTHING
          `,
          [visitorId],
        );
      }, undefined);
    },
    updateNotice: async (id, input) =>
      runSafely(async () => {
        if (input.isPinned) {
          await pool!.query("UPDATE notices SET is_pinned = FALSE WHERE is_pinned = TRUE AND id <> $1", [
            id,
          ]);
        }

        const result = await pool!.query<{
          id: string;
          title: string;
          body: string;
          is_pinned: boolean;
          is_published: boolean;
          published_at: Date;
          created_at: Date;
          updated_at: Date;
        }>(
          `
            UPDATE notices
            SET
              title = COALESCE($2, title),
              body = COALESCE($3, body),
              is_pinned = COALESCE($4, is_pinned),
              is_published = COALESCE($5, is_published),
              published_at = COALESCE($6, published_at),
              updated_at = NOW()
            WHERE id = $1
            RETURNING id, title, body, is_pinned, is_published, published_at, created_at, updated_at
          `,
          [
            id,
            input.title ?? null,
            input.body ?? null,
            input.isPinned ?? null,
            input.isPublished ?? null,
            input.publishedAt ? normalizePublishedAt(input.publishedAt) : null,
          ],
        );

        return result.rows[0] ? mapNoticeRow(result.rows[0]) : null;
      }, null),
  };
}

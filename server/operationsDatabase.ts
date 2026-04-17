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

export interface VisitorCounts {
  todayVisitors: number;
  totalVisitors: number;
}

export interface OperationsDatabase {
  isEnabled: boolean;
  getVisitorCounts: () => Promise<VisitorCounts>;
  initialize: () => Promise<void>;
  listNotices: (limit?: number) => Promise<NoticeRecord[]>;
  recordVisit: (visitorId: string) => Promise<void>;
}

const DEFAULT_COUNTS: VisitorCounts = {
  todayVisitors: 0,
  totalVisitors: 0,
};

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

        return result.rows.map((row) => ({
          id: Number(row.id),
          title: row.title,
          body: row.body,
          isPinned: row.is_pinned,
          isPublished: row.is_published,
          publishedAt: row.published_at.toISOString(),
          createdAt: row.created_at.toISOString(),
          updatedAt: row.updated_at.toISOString(),
        }));
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
  };
}

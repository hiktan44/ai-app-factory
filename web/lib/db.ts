import { Pool, type PoolClient } from "pg";

// Singleton pool — HMR safe
const globalForDb = globalThis as unknown as { dbPool: Pool | undefined };

function createPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // No DB configured — return a "dummy" that always errors gracefully
    console.warn("[DB] DATABASE_URL not set — persistence disabled");
  }
  return new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 3000,
    ssl: url?.includes("sslmode=require") ? { rejectUnauthorized: false } : false,
  });
}

export function getPool(): Pool {
  if (!globalForDb.dbPool) {
    globalForDb.dbPool = createPool();
  }
  return globalForDb.dbPool;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id           TEXT PRIMARY KEY,
  category     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'queued',
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  pid          INTEGER,
  exit_code    INTEGER,
  queue_pos    INTEGER DEFAULT 0,
  has_spec     BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline_queue (
  id            TEXT PRIMARY KEY,
  run_id        TEXT NOT NULL,
  category      TEXT NOT NULL,
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  position      INTEGER NOT NULL DEFAULT 0
);
`;

export async function ensureSchema(): Promise<void> {
  const pool = getPool();
  if (!process.env.DATABASE_URL) return;
  try {
    const client = await pool.connect();
    try {
      await client.query(SCHEMA_SQL);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[DB] Schema init error:", err);
  }
}

// ─── Run helpers ─────────────────────────────────────────────────────────────

export interface DbRun {
  id: string;
  category: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  pid: number | null;
  exit_code: number | null;
  queue_pos: number;
  has_spec: boolean;
  created_at: string;
}

export interface DbQueueItem {
  id: string;
  run_id: string;
  category: string;
  requested_at: string;
  position: number;
}

export async function dbUpsertRun(run: Partial<DbRun> & { id: string; category: string }): Promise<void> {
  const pool = getPool();
  if (!process.env.DATABASE_URL) return;
  try {
    await pool.query(
      `INSERT INTO pipeline_runs (id, category, status, started_at, pid, has_spec, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (id) DO UPDATE SET
         status       = EXCLUDED.status,
         started_at   = COALESCE(EXCLUDED.started_at, pipeline_runs.started_at),
         pid          = COALESCE(EXCLUDED.pid, pipeline_runs.pid),
         has_spec     = EXCLUDED.has_spec`,
      [
        run.id,
        run.category,
        run.status ?? "queued",
        run.started_at ?? null,
        run.pid ?? null,
        run.has_spec ?? false,
      ],
    );
  } catch (err) {
    console.error("[DB] upsertRun error:", err);
  }
}

export async function dbUpdateRun(id: string, updates: Partial<DbRun>): Promise<void> {
  const pool = getPool();
  if (!process.env.DATABASE_URL) return;
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (updates.status !== undefined)       { fields.push(`status=$${idx++}`);        values.push(updates.status); }
  if (updates.completed_at !== undefined) { fields.push(`completed_at=$${idx++}`);  values.push(updates.completed_at); }
  if (updates.exit_code !== undefined)    { fields.push(`exit_code=$${idx++}`);      values.push(updates.exit_code); }
  if (updates.pid !== undefined)          { fields.push(`pid=$${idx++}`);            values.push(updates.pid); }
  if (updates.started_at !== undefined)   { fields.push(`started_at=$${idx++}`);     values.push(updates.started_at); }

  if (fields.length === 0) return;
  values.push(id);

  try {
    await pool.query(`UPDATE pipeline_runs SET ${fields.join(",")} WHERE id=$${idx}`, values);
  } catch (err) {
    console.error("[DB] updateRun error:", err);
  }
}

export async function dbGetRunningRun(): Promise<DbRun | null> {
  const pool = getPool();
  if (!process.env.DATABASE_URL) return null;
  try {
    const res = await pool.query<DbRun>(
      `SELECT * FROM pipeline_runs WHERE status='running' ORDER BY started_at DESC LIMIT 1`,
    );
    return res.rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function dbGetQueue(): Promise<DbQueueItem[]> {
  const pool = getPool();
  if (!process.env.DATABASE_URL) return [];
  try {
    const res = await pool.query<DbQueueItem>(
      `SELECT * FROM pipeline_queue ORDER BY position ASC, requested_at ASC`,
    );
    return res.rows;
  } catch {
    return [];
  }
}

export async function dbEnqueue(item: { id: string; run_id: string; category: string }): Promise<void> {
  const pool = getPool();
  if (!process.env.DATABASE_URL) return;
  try {
    // Get max position
    const posRes = await pool.query<{ max: number | null }>(
      `SELECT MAX(position) as max FROM pipeline_queue`,
    );
    const pos = (posRes.rows[0]?.max ?? -1) + 1;
    await pool.query(
      `INSERT INTO pipeline_queue (id, run_id, category, position)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [item.id, item.run_id, item.category, pos],
    );
  } catch (err) {
    console.error("[DB] enqueue error:", err);
  }
}

export async function dbDequeue(): Promise<DbQueueItem | null> {
  const pool = getPool();
  if (!process.env.DATABASE_URL) return null;
  try {
    const res = await pool.query<DbQueueItem>(
      `DELETE FROM pipeline_queue
       WHERE id = (
         SELECT id FROM pipeline_queue ORDER BY position ASC, requested_at ASC LIMIT 1
       )
       RETURNING *`,
    );
    return res.rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function dbRemoveFromQueue(runId: string): Promise<void> {
  const pool = getPool();
  if (!process.env.DATABASE_URL) return;
  try {
    await pool.query(`DELETE FROM pipeline_queue WHERE run_id=$1`, [runId]);
  } catch {
    // ignore
  }
}

export async function dbClearQueue(): Promise<void> {
  const pool = getPool();
  if (!process.env.DATABASE_URL) return;
  try {
    await pool.query(`DELETE FROM pipeline_queue`);
  } catch {
    // ignore
  }
}

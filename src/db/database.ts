import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';

let pgPool: Pool | null = null;
let pgliteDb: PGlite | null = null;
let isInitialized = false;

async function initPglite(): Promise<PGlite> {
  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbDir = path.join(dataDir, 'timeline.db');

  // Remove stale postmaster.pid if present from previous ungraceful shutdown
  const pidFile = path.join(dbDir, 'postmaster.pid');
  if (fs.existsSync(pidFile)) {
    try {
      fs.unlinkSync(pidFile);
    } catch {
      // ignore
    }
  }

  // Attempt to open the persisted database
  try {
    const instance = new PGlite(dbDir);
    await instance.waitReady;
    await instance.query('SELECT 1 as alive');
    return instance;
  } catch (err: any) {
    console.warn(`⚠️ PGlite storage at ${dbDir} interrupted/unusable: ${err.message}. Recovering...`);
    try {
      fs.rmSync(dbDir, { recursive: true, force: true });
    } catch (rmErr) {
      console.error('Failed to remove corrupted db directory:', rmErr);
    }

    try {
      const freshInstance = new PGlite(dbDir);
      await freshInstance.waitReady;
      await freshInstance.query('SELECT 1 as alive');
      console.log('✅ Fresh PGlite storage initialized at', dbDir);
      return freshInstance;
    } catch (fallbackErr: any) {
      console.warn(`⚠️ Filesystem PGlite failed (${fallbackErr.message}). Using in-memory PGlite instance.`);
      const memInstance = new PGlite();
      await memInstance.waitReady;
      return memInstance;
    }
  }
}

export async function getDb() {
  const connectionString =
    process.env.DATABASE_URL ||
    (process.env.DB_HOST
      ? `postgresql://${process.env.DB_USER || 'postgres'}:${encodeURIComponent(process.env.DB_PASSWORD || '')}@${process.env.DB_HOST}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'jobless_empire'}`
      : undefined);

  if (connectionString) {
    if (!pgPool) {
      pgPool = new Pool({
        connectionString,
        max: 10,
        connectionTimeoutMillis: 10000,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      });
      pgPool.on('error', (err) => {
        console.error('Unexpected error on idle PostgreSQL client', err);
      });
    }
    return {
      type: 'pg' as const,
      pool: pgPool,
      async query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
        const res = await pgPool!.query(text, params);
        return { rows: res.rows as T[], rowCount: res.rowCount ?? res.rows.length };
      },
    };
  }

  // Fallback to embedded PGlite for self-contained execution
  if (!pgliteDb) {
    pgliteDb = await initPglite();
  }

  return {
    type: 'pglite' as const,
    db: pgliteDb,
    async query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
      const res = await pgliteDb!.query(text, params);
      return { rows: res.rows as T[], rowCount: res.rows.length };
    },
  };
}

export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
  try {
    const db = await getDb();
    return await db.query<T>(text, params);
  } catch (err: any) {
    const errMsg = err?.message || '';
    if (errMsg.includes('Aborted') || errMsg.includes('closed') || errMsg.includes('PANIC')) {
      console.error('Database connection aborted or closed. Re-initializing database...', err);
      pgliteDb = null;
      isInitialized = false;
      await initDatabase(true);
      const db = await getDb();
      return await db.query<T>(text, params);
    }
    throw err;
  }
}

export async function initDatabase(force = false): Promise<void> {
  if (isInitialized && !force) return;
  try {
    const schemaPath = path.resolve(process.cwd(), 'src/db/schema.sql');
    let schemaSql = '';
    if (fs.existsSync(schemaPath)) {
      schemaSql = fs.readFileSync(schemaPath, 'utf8');
    } else {
      schemaSql = `
        CREATE TABLE IF NOT EXISTS members (
          id VARCHAR(64) PRIMARY KEY,
          jemp_id VARCHAR(32) UNIQUE NOT NULL,
          discord_user_id VARCHAR(32) UNIQUE NOT NULL,
          handle VARCHAR(100) NOT NULL,
          status VARCHAR(32) DEFAULT 'ACTIVE',
          joined_at TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS timeline_events (
          id VARCHAR(64) PRIMARY KEY,
          event_id VARCHAR(64) UNIQUE NOT NULL,
          member_id VARCHAR(64) NOT NULL,
          jemp_id VARCHAR(32) NOT NULL,
          event_type VARCHAR(64) NOT NULL,
          authority VARCHAR(32) DEFAULT 'OFFICIAL',
          title VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          occurred_at TIMESTAMPTZ NOT NULL,
          recorded_at TIMESTAMPTZ DEFAULT NOW(),
          source_system VARCHAR(64) NOT NULL,
          source_event_id VARCHAR(128) NOT NULL,
          source_entity_type VARCHAR(64),
          source_entity_id VARCHAR(64),
          source_entity_name VARCHAR(255),
          project_id VARCHAR(64),
          project_name VARCHAR(255),
          brainstorm_id VARCHAR(64),
          brainstorm_name VARCHAR(255),
          opportunity_id VARCHAR(64),
          opportunity_name VARCHAR(255),
          metadata JSONB DEFAULT '{}'::jsonb,
          visibility VARCHAR(32) DEFAULT 'MEMBER_VISIBLE',
          immutable BOOLEAN DEFAULT TRUE,
          corrected_by_event_id VARCHAR(64),
          correction_reason TEXT,
          created_by VARCHAR(64) DEFAULT 'SYSTEM',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT uq_source_system_event UNIQUE (source_system, source_event_id)
        );
        CREATE TABLE IF NOT EXISTS timeline_shares (
          id VARCHAR(64) PRIMARY KEY,
          share_id VARCHAR(64) UNIQUE NOT NULL,
          member_id VARCHAR(64) NOT NULL,
          jemp_id VARCHAR(32) NOT NULL,
          token_hash VARCHAR(64) UNIQUE NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          expires_at TIMESTAMPTZ NOT NULL,
          revoked_at TIMESTAMPTZ,
          created_by VARCHAR(64) NOT NULL,
          access_count INT DEFAULT 0,
          last_accessed_at TIMESTAMPTZ
        );
        CREATE TABLE IF NOT EXISTS timeline_exports (
          id VARCHAR(64) PRIMARY KEY,
          export_id VARCHAR(64) UNIQUE NOT NULL,
          member_id VARCHAR(64) NOT NULL,
          jemp_id VARCHAR(32) NOT NULL,
          format VARCHAR(32) NOT NULL,
          scope VARCHAR(32) NOT NULL,
          filter_val VARCHAR(128),
          event_count INT NOT NULL,
          generated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS timeline_audit_log (
          id VARCHAR(64) PRIMARY KEY,
          timestamp TIMESTAMPTZ DEFAULT NOW(),
          action VARCHAR(64) NOT NULL,
          actor VARCHAR(64) NOT NULL,
          source_system VARCHAR(64) NOT NULL,
          jemp_id VARCHAR(32),
          details JSONB DEFAULT '{}'::jsonb,
          ip_address VARCHAR(64)
        );
      `;
    }

    // Split statements if needed or execute directly
    const statements = schemaSql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      await query(stmt);
    }

    isInitialized = true;
    console.log('PostgreSQL database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database schema:', error);
    throw error;
  }
}

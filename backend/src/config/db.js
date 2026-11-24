import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

let mode = null; // 'pglite' | 'pg'
let pgliteInstance = null;
let pgPool = null;
let txMutex = Promise.resolve();

function runSerialized(fn) {
  const prev = txMutex;
  let release;
  txMutex = new Promise((resolve) => {
    release = resolve;
  });
  return prev.then(fn).finally(() => release());
}

export async function initDb(options = {}) {
  if (pgliteInstance || pgPool) {
    return { mode };
  }

  const useMemory = options.memory ?? (env.NODE_ENV === 'test' || env.DB_MEMORY === 'true');
  const databaseUrl = options.databaseUrl ?? env.DATABASE_URL;

  if (databaseUrl && !useMemory) {
    mode = 'pg';
    pgPool = new Pool({ connectionString: databaseUrl });
    await pgPool.query('SELECT 1');
    return { mode };
  }

  mode = 'pglite';
  if (useMemory) {
    pgliteInstance = new PGlite();
  } else {
    const dataDir = options.dataDir ?? env.pgliteDataDir;
    fs.mkdirSync(dataDir, { recursive: true });
    pgliteInstance = new PGlite(dataDir);
  }
  await pgliteInstance.waitReady;
  return { mode };
}

export function getDbMode() {
  return mode;
}

export async function query(sql, params = []) {
  if (!pgliteInstance && !pgPool) {
    await initDb();
  }
  if (mode === 'pg') {
    return pgPool.query(sql, params);
  }
  return pgliteInstance.query(sql, params);
}

export async function exec(sql) {
  if (!pgliteInstance && !pgPool) {
    await initDb();
  }
  if (mode === 'pg') {
    return pgPool.query(sql);
  }
  return pgliteInstance.exec(sql);
}

/**
 * Runs a callback inside a single database transaction.
 * For PGlite (single-connection WASM), calls are serialized through an async mutex
 * so concurrent HTTP requests safely wait for row locks instead of interleaving BEGIN/COMMIT.
 */
export async function withTransaction(fn, { actorUserId = null } = {}) {
  if (!pgliteInstance && !pgPool) {
    await initDb();
  }

  if (mode === 'pg') {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      if (actorUserId !== null && actorUserId !== undefined) {
        await client.query("SELECT set_config('app.user_id', $1, true)", [String(actorUserId)]);
      }
      const result = await fn({
        query: (sql, params = []) => client.query(sql, params)
      });
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  return runSerialized(async () => {
    await pgliteInstance.query('BEGIN');
    try {
      if (actorUserId !== null && actorUserId !== undefined) {
        await pgliteInstance.query("SELECT set_config('app.user_id', $1, true)", [String(actorUserId)]);
      }
      const result = await fn({
        query: (sql, params = []) => pgliteInstance.query(sql, params)
      });
      await pgliteInstance.query('COMMIT');
      return result;
    } catch (err) {
      await pgliteInstance.query('ROLLBACK').catch(() => {});
      throw err;
    }
  });
}

export async function closeDb() {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
  if (pgliteInstance) {
    await pgliteInstance.close();
    pgliteInstance = null;
  }
  mode = null;
}

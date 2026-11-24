import * as db from '../src/config/db.js';
import { createApp } from '../src/app.js';
import { runMigrations } from '../../db/scripts/migrate.js';
import { runSeed } from '../../db/scripts/seed.js';

export async function setupTestEnv() {
  process.env.NODE_ENV = 'test';
  process.env.DB_MEMORY = 'true';
  await db.closeDb();
  await db.initDb({ memory: true });
  await runMigrations(db);
  await runSeed(db, { force: true });
  return createApp({ enableRateLimit: false });
}

export async function teardownTestEnv() {
  await db.closeDb();
}

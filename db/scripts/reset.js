import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as defaultDb from '../../backend/src/config/db.js';
import { env } from '../../backend/src/config/env.js';
import { runMigrations } from './migrate.js';
import { runSeed } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function reset() {
  if (!env.DATABASE_URL && fs.existsSync(env.pgliteDataDir)) {
    fs.rmSync(env.pgliteDataDir, { recursive: true, force: true });
  }
  const info = await defaultDb.initDb();
  if (info.mode === 'pg') {
    const downDir = path.resolve(__dirname, '../migrations/down');
    const downFiles = fs.readdirSync(downDir).filter((f) => f.endsWith('.sql')).sort().reverse();
    for (const f of downFiles) {
      await defaultDb.exec(fs.readFileSync(path.join(downDir, f), 'utf8'));
    }
    await defaultDb.exec('DROP TABLE IF EXISTS schema_migrations');
  }
  await runMigrations(defaultDb);
  await runSeed(defaultDb, { force: true });
  console.log(`[reset:${info.mode}] Database reset, migrated, and re-seeded.`);
  await defaultDb.closeDb();
}

reset().catch((err) => {
  console.error(err);
  process.exit(1);
});

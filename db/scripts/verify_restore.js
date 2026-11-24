import path from 'node:path';
import { createRequire } from 'node:module';
import * as sourceDb from '../../backend/src/config/db.js';
import { createBackup, BACKUP_TABLES } from './backup.js';
import { restoreBackup } from './restore.js';
import { runMigrations } from './migrate.js';

const require = createRequire(import.meta.url);
const { PGlite } = require('../../backend/node_modules/@electric-sql/pglite');

async function verify() {
  const t0 = performance.now();
  await sourceDb.initDb();
  const backup = await createBackup(sourceDb);

  // Restore into a completely fresh throwaway in-memory PostgreSQL instance
  const mem = new PGlite();
  await mem.waitReady;

  const targetDb = {
    query: (sql, params = []) => mem.query(sql, params),
    exec: (sql) => mem.exec(sql),
    withTransaction: async (fn) => {
      await mem.query('BEGIN');
      try {
        const res = await fn({ query: (sql, params = []) => mem.query(sql, params) });
        await mem.query('COMMIT');
        return res;
      } catch (err) {
        await mem.query('ROLLBACK').catch(() => {});
        throw err;
      }
    }
  };

  await runMigrations(targetDb);
  const { expectedCounts, restoredCounts } = await restoreBackup(targetDb, backup.filePath);

  const mismatches = [];
  for (const table of BACKUP_TABLES) {
    if (expectedCounts[table] !== restoredCounts[table]) {
      mismatches.push(`${table}: expected ${expectedCounts[table]}, got ${restoredCounts[table]}`);
    }
  }

  const elapsedMs = Math.round(performance.now() - t0);
  await mem.close();
  await sourceDb.closeDb();

  if (mismatches.length > 0) {
    console.error('[verify-backup] FAILED:', mismatches);
    process.exit(1);
  }

  console.log(`[verify-backup] PASSED in ${elapsedMs}ms`);
  console.log(`Dump file: ${path.basename(backup.filePath)} (${backup.bytes} bytes, sha256=${backup.sha256})`);
  console.log('Verified table row counts:', restoredCounts);
}

verify().catch((err) => {
  console.error(err);
  process.exit(1);
});

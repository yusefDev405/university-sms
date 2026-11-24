import { createApp } from './app.js';
import { closeDb, initDb } from './config/db.js';
import { env } from './config/env.js';
import { logInfo } from './utils/logger.js';
import { runMigrations } from '../../db/scripts/migrate.js';
import { runSeed } from '../../db/scripts/seed.js';

async function start() {
  const { mode } = await initDb();
  await runMigrations();
  await runSeed();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logInfo('server.started', { port: env.PORT, dbMode: mode, env: env.NODE_ENV });
    console.log(`USMS API listening on http://localhost:${env.PORT} (db=${mode})`);
    console.log(`Swagger docs at http://localhost:${env.PORT}/api/docs`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await closeDb();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

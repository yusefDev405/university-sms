import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../..');

dotenv.config({ path: path.join(projectRoot, '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(16).default('dev-only-change-me-in-production-32chars'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  PGLITE_DATA_DIR: z.string().default(path.join(projectRoot, 'data', 'pgdata')),
  DATABASE_URL: z.string().optional(),
  DB_MEMORY: z.string().optional(),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true')
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  projectRoot,
  pgliteDataDir: path.isAbsolute(parsed.PGLITE_DATA_DIR)
    ? parsed.PGLITE_DATA_DIR
    : path.resolve(projectRoot, 'backend', parsed.PGLITE_DATA_DIR)
};

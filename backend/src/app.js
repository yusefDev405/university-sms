import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import { getDbMode, query } from './config/db.js';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import adminRouter from './modules/admin/routes.js';
import attendanceRouter from './modules/attendance/routes.js';
import { createAuthRouter } from './modules/auth/routes.js';
import coursesRouter from './modules/courses/routes.js';
import departmentsRouter from './modules/departments/routes.js';
import enrollmentsRouter from './modules/enrollments/routes.js';
import gradesRouter from './modules/grades/routes.js';
import offeringsRouter from './modules/offerings/routes.js';
import studentsRouter from './modules/students/routes.js';
import termsRouter from './modules/terms/routes.js';
import usersRouter from './modules/users/routes.js';

export function createApp({ enableRateLimit = env.NODE_ENV !== 'test' } = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestIdMiddleware);

  // Strict security headers with Swagger UI inline allowance scoped only to /api/docs
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/docs')) {
      return helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:']
          }
        }
      })(req, res, next);
    }
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"]
        }
      }
    })(req, res, next);
  });

  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  if (enableRateLimit) {
    app.use(
      '/api',
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 400,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests, please try again later',
            details: []
          }
        }
      })
    );
  }

  const authLimiter = enableRateLimit
    ? rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 30,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many authentication attempts, please try again later',
            details: []
          }
        }
      })
    : undefined;

  // Swagger API Docs
  const openapiPath = path.join(env.projectRoot, 'docs', 'openapi.yaml');
  if (fs.existsSync(openapiPath)) {
    const spec = YAML.parse(fs.readFileSync(openapiPath, 'utf8'));
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'USMS API Docs' }));
  }

  // Healthcheck
  app.get('/api/v1/health', async (_req, res, next) => {
    try {
      await query('SELECT 1 AS ok');
      res.json({
        data: {
          status: 'ok',
          database: getDbMode() || 'connected',
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  });

  const api = express.Router();
  api.use(createAuthRouter({ authLimiter }));
  api.use(usersRouter);
  api.use(studentsRouter);
  api.use(departmentsRouter);
  api.use(coursesRouter);
  api.use(termsRouter);
  api.use(offeringsRouter);
  api.use(enrollmentsRouter);
  api.use(gradesRouter);
  api.use(attendanceRouter);
  api.use(adminRouter);

  app.use('/api/v1', api);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './common/utils/logger.js';
import { rateLimiter } from './common/middlewares/rateLimiter.js';
import { errorHandler } from './common/middlewares/errorHandler.js';
import { notFound } from './common/middlewares/notFound.js';
import apiRoutes from './routes/index.js';

export function createApp(): Application {
  const app = express();

  // Trust the first proxy (needed for correct req.ip behind nginx/Cloudflare).
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins.length > 0 ? env.corsOrigins : true,
      credentials: true,
    }),
  );
  // The Razorpay webhook needs the raw body for signature verification, so the global
  // JSON parser skips it (the route applies express.raw itself).
  const jsonParser = express.json({ limit: '1mb' });
  app.use((req, res, next) => {
    if (req.originalUrl.endsWith('/payments/webhook')) return next();
    return jsonParser(req, res, next);
  });
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));

  // Global per-IP rate limit (defense in depth; routes add their own tighter limits).
  app.use(
    rateLimiter({
      prefix: 'global',
      windowSeconds: 60,
      max: 300,
    }),
  );

  app.use(env.apiPrefix, apiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

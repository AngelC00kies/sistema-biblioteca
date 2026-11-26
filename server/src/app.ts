import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { env } from './config/env.js';
import { clientIp } from './middleware/auth.js';
import {
  errorHandler,
  notFoundHandler,
} from './middleware/errorHandler.js';
import auditRoutes from './modules/audit/routes.js';
import authRoutes from './modules/auth/routes.js';
import booksRoutes from './modules/books/routes.js';
import categoriesRoutes from './modules/categories/routes.js';
import copiesRoutes from './modules/copies/routes.js';
import finesRoutes from './modules/fines/routes.js';
import loansRoutes from './modules/loans/routes.js';
import reportsRoutes from './modules/reports/routes.js';
import reservationsRoutes from './modules/reservations/routes.js';
import usersRoutes from './modules/users/routes.js';

/** Crea la aplicación Express sin escuchar puertos (facilita las pruebas). */
export function createApp(): express.Express {
  const app = express();

  // --- Seguridad de base ---
  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(','),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(clientIp);

  // --- Limitación global de tasa (protección contra abuso y DoS ligero) ---
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: env.nodeEnv === 'test' ? 1_000_000 : 500,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        ok: false,
        code: 'RATE_LIMITED',
        message: 'Demasiadas peticiones. Intenta de nuevo en unos minutos.',
      },
    }),
  );

  // --- Rutas de salud y raíz ---
  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      ok: true,
      data: {
        service: 'biblioteca-api',
        status: 'up',
        timestamp: new Date().toISOString(),
      },
    });
  });

  // --- Módulos funcionales ---
  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/categories', categoriesRoutes);
  app.use('/api/books', booksRoutes);
  app.use('/api/copies', copiesRoutes);
  app.use('/api/loans', loansRoutes);
  app.use('/api/reservations', reservationsRoutes);
  app.use('/api/fines', finesRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/audit', auditRoutes);

  // --- SPA estática (producción: sirve el build del frontend) ---
  // En desarrollo local con `npm run dev` no existe ../client/dist y se omite.
  const clientDist =
    process.env.CLIENT_DIST_PATH ?? resolve(process.cwd(), '..', 'client', 'dist');
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    // Fallback: cualquier GET que no sea /api/* devuelve index.html
    // para que las rutas de React funcionen al recargar la página.
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(join(clientDist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

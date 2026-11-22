import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError.js';
import { logError } from '../utils/logger.js';

/** Manejador centralizado de errores: un solo punto de salida para todos los fallos. */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.status).json({
      ok: false,
      code: err.code,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'Datos de entrada inválidos',
      details: err.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    });
    return;
  }

  // Restricción de unicidad / integridad de SQLite
  const sqliteCode = (err as { code?: string })?.code ?? '';
  if (typeof sqliteCode === 'string' && sqliteCode.startsWith('SQLITE_CONSTRAINT')) {
    res.status(409).json({
      ok: false,
      code: 'CONSTRAINT_VIOLATION',
      message: 'La operación viola una restricción de integridad de datos',
    });
    return;
  }

  logError(`Error no controlado en ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({
    ok: false,
    code: 'INTERNAL_ERROR',
    message: 'Error interno del servidor',
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    ok: false,
    code: 'ROUTE_NOT_FOUND',
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
}

/** Envuelve controladores async para propagar errores al errorHandler. */
export function asyncHandler<
  T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
>(fn: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void fn(req, res, next).catch(next);
  };
}

import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { errors } from '../errors/AppError.js';

function run(schema: ZodSchema, value: unknown, label: string): unknown {
  const result = schema.safeParse(value);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      campo: issue.path.join('.') || label,
      mensaje: issue.message,
    }));
    throw errors.badRequest('Datos de entrada inválidos', details);
  }
  return result.data;
}

/** Valida y reemplaza req.body con el resultado del esquema Zod. */
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = run(schema, req.body, 'body');
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Valida req.query sin reemplazarlo (se conservan los strings originales). */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      run(schema, req.query, 'query');
      next();
    } catch (error) {
      next(error);
    }
  };
}

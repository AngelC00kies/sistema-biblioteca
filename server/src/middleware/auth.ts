import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError, errors } from '../errors/AppError.js';

export type Role = 'admin' | 'librarian' | 'member';

export type AuthUser = {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  status: string;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      clientIp?: string;
    }
  }
}

export type TokenPayload = {
  sub: number;
  username: string;
  role: Role;
};

export function signToken(user: AuthUser): string {
  const payload: TokenPayload = {
    sub: user.id,
    username: user.username,
    role: user.role,
  };
  return jwt.sign(payload, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });
}

/** Extrae y verifica el token JWT de la cabecera Authorization. */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(errors.tokenInvalid('Falta el token de autenticación'));
  }

  const token = header.slice('Bearer '.length).trim();
  try {
    const decoded = jwt.verify(token, env.jwt.secret) as jwt.JwtPayload;
    req.user = {
      id: Number(decoded.sub),
      username: String(decoded.username),
      fullName: String(decoded.name ?? decoded.username),
      role: decoded.role as Role,
      status: 'active',
    };
    next();
  } catch {
    next(errors.tokenInvalid());
  }
}

/** Control de acceso basado en roles (RBAC). */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(errors.tokenInvalid());
    if (!roles.includes(req.user.role)) {
      return next(errors.forbidden());
    }
    next();
  };
}

/** Perfiles con acceso a operación de catálogo y préstamos. */
export const STAFF_ROLES: Role[] = ['admin', 'librarian'];

/** Captura la IP del cliente para la auditoría. */
export function clientIp(req: Request, _res: Response, next: NextFunction): void {
  const forwarded = req.headers['x-forwarded-for'];
  req.clientIp = Array.isArray(forwarded)
    ? forwarded[0]
    : (forwarded ?? req.socket.remoteAddress ?? 'unknown');
  next();
}

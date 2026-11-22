import { join } from 'node:path';

const rootDir = process.cwd();

function required(name: string, fallback: string): string {
  const value = process.env[name];
  if (value && value.trim().length > 0) return value;
  return fallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databasePath: required('DATABASE_PATH', join(rootDir, 'data', 'biblioteca.db')),
  jwt: {
    secret: required('JWT_SECRET', 'dev-secret-change-me-in-production-0123456789abcdef'),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  },
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? 12),
  corsOrigin: required('CORS_ORIGIN', 'http://localhost:5173'),
  /** Préstamo en días */
  loanDays: Number(process.env.LOAN_DAYS ?? 14),
  /** Multa por día de atraso (moneda local) */
  finePerDay: Number(process.env.FINE_PER_DAY ?? 0.5),
  /** Máximo de préstamos activos por miembro */
  maxActiveLoans: Number(process.env.MAX_ACTIVE_LOANS ?? 5),
  /** Máximo de reservas activas por miembro */
  maxActiveReservations: Number(process.env.MAX_ACTIVE_RESERVATIONS ?? 3),
  /** Días de vigencia de una reserva */
  reservationDays: Number(process.env.RESERVATION_DAYS ?? 7),
  /** Días de gracia antes de generar multa automática */
  graceDays: Number(process.env.GRACE_DAYS ?? 0),
} as const;

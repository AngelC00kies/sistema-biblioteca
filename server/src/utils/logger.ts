import { getDb } from '../db/connection.js';

export type AuditInput = {
  userId?: number | null;
  action: string;
  entity: string;
  entityId?: number | null;
  details?: string;
  ip?: string | null;
};

/**
 * Registra un evento de auditoría. Nunca interrumpe el flujo principal
 * si la escritura del log falla (la trazabilidad no debe romper el negocio).
 */
export function audit(input: AuditInput): void {
  try {
    getDb()
      .prepare(
        `INSERT INTO audit_logs (user_id, action, entity, entity_id, details, ip)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.userId ?? null,
        input.action,
        input.entity,
        input.entityId ?? null,
        input.details ?? null,
        input.ip ?? null,
      );
  } catch (error) {
    console.error('[audit] no se pudo registrar el evento:', error);
  }
}

export function logInfo(message: string, meta?: unknown): void {
  console.log(`[info] ${message}`, meta ?? '');
}

export function logError(message: string, error?: unknown): void {
  console.error(`[error] ${message}`, error ?? '');
}

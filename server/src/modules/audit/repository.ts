import { getDb } from '../../db/connection.js';

export type AuditRow = {
  id: number;
  user_id: number | null;
  action: string;
  entity: string;
  entity_id: number | null;
  details: string | null;
  ip: string | null;
  created_at: string;
};

export type AuditView = AuditRow & { username: string | null };

export const auditRepository = {
  findAll(filters: { action?: string; entity?: string; limit?: number } = {}): AuditView[] {
    const clauses: string[] = [];
    const params: (string | number)[] = [];

    if (filters.action) {
      clauses.push('a.action = ?');
      params.push(filters.action);
    }
    if (filters.entity) {
      clauses.push('a.entity = ?');
      params.push(filters.entity);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);

    return getDb()
      .prepare<(string | number)[], AuditView>(
        `SELECT a.id, a.user_id, a.action, a.entity, a.entity_id, a.details, a.ip, a.created_at,
                u.username
           FROM audit_logs a
           LEFT JOIN users u ON u.id = a.user_id
           ${where}
          ORDER BY a.id DESC
          LIMIT ?`,
      )
      .all(...params, limit);
  },

  countAll(): number {
    const row = getDb()
      .prepare<[], { total: number }>(`SELECT COUNT(*) AS total FROM audit_logs`)
      .get();
    return row?.total ?? 0;
  },
};

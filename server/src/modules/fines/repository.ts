import { getDb } from '../../db/connection.js';

export type FineRow = {
  id: number;
  loan_id: number;
  user_id: number;
  amount: number;
  reason: string;
  status: 'pending' | 'paid';
  created_at: string;
  paid_at: string | null;
};

export type FineView = FineRow & {
  member_name: string;
  book_title: string;
  inventory_code: string;
};

const FINE_SELECT = `
  SELECT f.id, f.loan_id, f.user_id, f.amount, f.reason, f.status, f.created_at, f.paid_at,
         u.full_name AS member_name,
         b.title    AS book_title,
         c.inventory_code
    FROM fines f
    JOIN users u  ON u.id = f.user_id
    JOIN loans l  ON l.id = f.loan_id
    JOIN copies c ON c.id = l.copy_id
    JOIN books b  ON b.id = c.book_id`;

export const finesRepository = {
  findAll(filters: { status?: 'pending' | 'paid'; userId?: number } = {}): FineView[] {
    const clauses: string[] = [];
    const params: (string | number)[] = [];

    if (filters.status) {
      clauses.push('f.status = ?');
      params.push(filters.status);
    }
    if (filters.userId) {
      clauses.push('f.user_id = ?');
      params.push(filters.userId);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    return getDb()
      .prepare<(string | number)[], FineView>(`${FINE_SELECT} ${where} ORDER BY f.id DESC`)
      .all(...params);
  },

  findById(id: number): FineView | undefined {
    return getDb().prepare<[number], FineView>(`${FINE_SELECT} WHERE f.id = ?`).get(id);
  },

  countPendingByUser(userId: number): number {
    const row = getDb()
      .prepare<[number], { total: number }>(
        `SELECT COUNT(*) AS total FROM fines WHERE user_id = ? AND status = 'pending'`,
      )
      .get(userId);
    return row?.total ?? 0;
  },

  sumPendingByUser(userId: number): number {
    const row = getDb()
      .prepare<[number], { total: number }>(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM fines WHERE user_id = ? AND status = 'pending'`,
      )
      .get(userId);
    return row?.total ?? 0;
  },

  insert(data: { loanId: number; userId: number; amount: number; reason: string }): number {
    const result = getDb()
      .prepare(`INSERT INTO fines (loan_id, user_id, amount, reason) VALUES (?, ?, ?, ?)`)
      .run(data.loanId, data.userId, data.amount, data.reason);
    return Number(result.lastInsertRowid);
  },

  markPaid(id: number): number {
    return getDb()
      .prepare(`UPDATE fines SET status = 'paid', paid_at = datetime('now') WHERE id = ?`)
      .run(id).changes;
  },
};

import { getDb } from '../../db/connection.js';

export type LoanRow = {
  id: number;
  copy_id: number;
  user_id: number;
  loan_date: string;
  due_date: string;
  return_date: string | null;
  status: 'active' | 'returned' | 'overdue';
  fine_amount: number;
  notes: string | null;
};

export type LoanView = LoanRow & {
  inventory_code: string;
  condition: string;
  book_id: number;
  book_title: string;
  book_author: string;
  member_name: string;
  member_username: string;
  days_late: number;
};

const LOAN_SELECT = `
  SELECT l.id, l.copy_id, l.user_id, l.loan_date, l.due_date, l.return_date,
         l.status, l.fine_amount, l.notes,
         c.inventory_code, c.condition, c.book_id,
         b.title AS book_title, b.author AS book_author,
         u.full_name AS member_name, u.username AS member_username,
         CASE
           WHEN l.return_date IS NOT NULL AND date(l.return_date) > date(l.due_date)
             THEN CAST(julianday(l.return_date) - julianday(l.due_date) AS INTEGER)
           WHEN l.return_date IS NULL AND date('now') > date(l.due_date)
             THEN CAST(julianday('now') - julianday(l.due_date) AS INTEGER)
           ELSE 0
         END AS days_late
    FROM loans l
    JOIN copies c     ON c.id   = l.copy_id
    JOIN books b      ON b.id   = c.book_id
    JOIN users u      ON u.id   = l.user_id`;

export type LoanFilters = {
  status?: 'active' | 'returned' | 'overdue';
  userId?: number;
  search?: string;
  overdueOnly?: boolean;
};

export const loansRepository = {
  findAll(filters: LoanFilters = {}): LoanView[] {
    const clauses: string[] = [];
    const params: (string | number)[] = [];

    if (filters.status) {
      clauses.push('l.status = ?');
      params.push(filters.status);
    }
    if (filters.userId) {
      clauses.push('l.user_id = ?');
      params.push(filters.userId);
    }
    if (filters.overdueOnly) {
      clauses.push(`l.return_date IS NULL AND date(l.due_date) < date('now')`);
    }
    if (filters.search) {
      clauses.push('(b.title LIKE ? OR u.full_name LIKE ? OR c.inventory_code LIKE ?)');
      const like = `%${filters.search}%`;
      params.push(like, like, like);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    return getDb()
      .prepare<(string | number)[], LoanView>(`${LOAN_SELECT} ${where} ORDER BY l.id DESC`)
      .all(...params);
  },

  findById(id: number): LoanView | undefined {
    return getDb().prepare<[number], LoanView>(`${LOAN_SELECT} WHERE l.id = ?`).get(id);
  },

  findActiveByCopy(copyId: number): LoanRow | undefined {
    return getDb()
      .prepare<[number], LoanRow>(
        `SELECT * FROM loans WHERE copy_id = ? AND status IN ('active','overdue')`,
      )
      .get(copyId);
  },

  countActiveByUser(userId: number): number {
    const row = getDb()
      .prepare<[number], { total: number }>(
        `SELECT COUNT(*) AS total FROM loans WHERE user_id = ? AND status IN ('active','overdue')`,
      )
      .get(userId);
    return row?.total ?? 0;
  },

  insert(data: {
    copyId: number;
    userId: number;
    dueDate: string;
    notes?: string | null;
  }): number {
    const result = getDb()
      .prepare(
        `INSERT INTO loans (copy_id, user_id, due_date, notes) VALUES (?, ?, ?, ?)`,
      )
      .run(data.copyId, data.userId, data.dueDate, data.notes ?? null);
    return Number(result.lastInsertRowid);
  },

  markReturned(
    id: number,
    returnDate: string,
    status: 'returned',
    fineAmount: number,
  ): number {
    return getDb()
      .prepare(
        `UPDATE loans
            SET return_date = ?, status = ?, fine_amount = ?
          WHERE id = ?`,
      )
      .run(returnDate, status, fineAmount, id).changes;
  },

  /** Marca como vencidos los préstamos activos cuya fecha límite ya pasó. */
  refreshOverdueStatus(): number {
    return getDb()
      .prepare(
        `UPDATE loans
            SET status = 'overdue'
          WHERE status = 'active' AND date(due_date) < date('now')`,
      ).run().changes;
  },
};

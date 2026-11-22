import { getDb } from '../../db/connection.js';

export type Summary = {
  books: number;
  copies: number;
  availableCopies: number;
  members: number;
  activeLoans: number;
  overdueLoans: number;
  activeReservations: number;
  pendingFinesAmount: number;
  pendingFinesCount: number;
};

export type TopBook = {
  book_id: number;
  title: string;
  author: string;
  loan_count: number;
};

export type OverdueLoan = {
  id: number;
  book_title: string;
  inventory_code: string;
  member_name: string;
  due_date: string;
  days_late: number;
};

export const reportsRepository = {
  summary(): Summary {
    const scalar = (sql: string): number => {
      const row = getDb().prepare<[], { value: number }>(sql).get();
      return row?.value ?? 0;
    };

    return {
      books: scalar(`SELECT COUNT(*) AS value FROM books`),
      copies: scalar(`SELECT COUNT(*) AS value FROM copies`),
      availableCopies: scalar(
        `SELECT COUNT(*) AS value FROM copies WHERE status = 'available'`,
      ),
      members: scalar(`SELECT COUNT(*) AS value FROM users WHERE status = 'active'`),
      activeLoans: scalar(
        `SELECT COUNT(*) AS value FROM loans WHERE status IN ('active','overdue')`,
      ),
      overdueLoans: scalar(
        `SELECT COUNT(*) AS value FROM loans
          WHERE return_date IS NULL AND date(due_date) < date('now')`,
      ),
      activeReservations: scalar(
        `SELECT COUNT(*) AS value FROM reservations WHERE status IN ('pending','ready')`,
      ),
      pendingFinesCount: scalar(
        `SELECT COUNT(*) AS value FROM fines WHERE status = 'pending'`,
      ),
      pendingFinesAmount: scalar(
        `SELECT COALESCE(SUM(amount), 0) AS value FROM fines WHERE status = 'pending'`,
      ),
    };
  },

  topBooks(limit = 10): TopBook[] {
    return getDb()
      .prepare<[number], TopBook>(
        `SELECT b.id AS book_id, b.title, b.author, COUNT(l.id) AS loan_count
           FROM books b
           JOIN copies c ON c.book_id = b.id
           JOIN loans l  ON l.copy_id = c.id
          GROUP BY b.id
          ORDER BY loan_count DESC, b.title ASC
          LIMIT ?`,
      )
      .all(limit);
  },

  overdueLoans(): OverdueLoan[] {
    return getDb()
      .prepare<[], OverdueLoan>(
        `SELECT l.id, b.title AS book_title, c.inventory_code, u.full_name AS member_name,
                l.due_date,
                CAST(julianday('now') - julianday(l.due_date) AS INTEGER) AS days_late
           FROM loans l
           JOIN copies c ON c.id = l.copy_id
           JOIN books b  ON b.id = c.book_id
           JOIN users u  ON u.id = l.user_id
          WHERE l.return_date IS NULL AND date(l.due_date) < date('now')
          ORDER BY days_late DESC`,
      )
      .all();
  },

  loansByMonth(months = 6): { month: string; total: number }[] {
    return getDb()
      .prepare<[number], { month: string; total: number }>(
        `SELECT strftime('%Y-%m', loan_date) AS month, COUNT(*) AS total
           FROM loans
          GROUP BY month
          ORDER BY month DESC
          LIMIT ?`,
      )
      .all(months);
  },
};

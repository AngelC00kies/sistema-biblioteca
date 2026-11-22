import { getDb } from '../../db/connection.js';

export type ReservationRow = {
  id: number;
  book_id: number;
  user_id: number;
  status: 'pending' | 'ready' | 'fulfilled' | 'cancelled';
  created_at: string;
  expires_at: string;
};

export type ReservationView = ReservationRow & {
  book_title: string;
  book_author: string;
  isbn: string;
  member_name: string;
  available_copies: number;
};

const RESERVATION_SELECT = `
  SELECT r.id, r.book_id, r.user_id, r.status, r.created_at, r.expires_at,
         b.title  AS book_title,
         b.author AS book_author,
         b.isbn,
         u.full_name AS member_name,
         (SELECT COUNT(*) FROM copies c WHERE c.book_id = b.id AND c.status = 'available')
           AS available_copies
    FROM reservations r
    JOIN books b ON b.id = r.book_id
    JOIN users u ON u.id = r.user_id`;

export const reservationsRepository = {
  findAll(filters: { status?: string; userId?: number } = {}): ReservationView[] {
    const clauses: string[] = [];
    const params: (string | number)[] = [];

    if (filters.status) {
      clauses.push('r.status = ?');
      params.push(filters.status);
    }
    if (filters.userId) {
      clauses.push('r.user_id = ?');
      params.push(filters.userId);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    return getDb()
      .prepare<(string | number)[], ReservationView>(
        `${RESERVATION_SELECT} ${where} ORDER BY r.created_at DESC`,
      )
      .all(...params);
  },

  findById(id: number): ReservationView | undefined {
    return getDb().prepare<[number], ReservationView>(`${RESERVATION_SELECT} WHERE r.id = ?`).get(id);
  },

  findActiveByBookAndUser(bookId: number, userId: number): ReservationRow | undefined {
    return getDb()
      .prepare<[number, number], ReservationRow>(
        `SELECT * FROM reservations
          WHERE book_id = ? AND user_id = ? AND status IN ('pending','ready')`,
      )
      .get(bookId, userId);
  },

  countActiveByUser(userId: number): number {
    const row = getDb()
      .prepare<[number], { total: number }>(
        `SELECT COUNT(*) AS total FROM reservations
          WHERE user_id = ? AND status IN ('pending','ready')`,
      )
      .get(userId);
    return row?.total ?? 0;
  },

  insert(bookId: number, userId: number, expiresAt: string): number {
    const result = getDb()
      .prepare(
        `INSERT INTO reservations (book_id, user_id, expires_at) VALUES (?, ?, ?)`,
      )
      .run(bookId, userId, expiresAt);
    return Number(result.lastInsertRowid);
  },

  setStatus(id: number, status: ReservationRow['status']): number {
    return getDb().prepare(`UPDATE reservations SET status = ? WHERE id = ?`).run(status, id).changes;
  },

  /**
   * Pasa una reserva a `ready` y renueva la ventana de recogida:
   * el ejemplar quedó disponible y debe esperar al socio más antiguo.
   */
  markReady(id: number, expiresAt: string): number {
    return getDb()
      .prepare(`UPDATE reservations SET status = 'ready', expires_at = ? WHERE id = ?`)
      .run(expiresAt, id).changes;
  },

  /** Reservas pendientes más antiguas de un libro concreto. */
  findPendingByBook(bookId: number): ReservationView[] {
    return getDb()
      .prepare<[number], ReservationView>(
        `${RESERVATION_SELECT}
          WHERE r.book_id = ? AND r.status = 'pending'
          ORDER BY r.created_at ASC`,
      )
      .all(bookId);
  },

  /** Vencimiento perezoso: cancela reservas cuya fecha límite ya pasó. */
  expireStale(): number {
    return getDb()
      .prepare(
        `UPDATE reservations
            SET status = 'cancelled'
          WHERE status IN ('pending','ready') AND datetime(expires_at) < datetime('now')`,
      ).run().changes;
  },
};

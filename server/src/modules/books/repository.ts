import { getDb } from '../../db/connection.js';

export type BookRow = {
  id: number;
  isbn: string;
  title: string;
  author: string;
  publisher: string | null;
  publication_year: number | null;
  category_id: number | null;
  description: string | null;
  created_at: string;
};

export type BookWithStats = BookRow & {
  category_name: string | null;
  total_copies: number;
  available_copies: number;
};

export type CopyRow = {
  id: number;
  book_id: number;
  inventory_code: string;
  status: 'available' | 'loaned' | 'lost' | 'maintenance';
  condition: string;
  created_at: string;
};

export type BookFilters = {
  search?: string;
  categoryId?: number;
  available?: boolean;
  page?: number;
  pageSize?: number;
};

const BOOK_SELECT = `
  SELECT b.id, b.isbn, b.title, b.author, b.publisher, b.publication_year,
         b.category_id, b.description, b.created_at,
         c.name AS category_name,
         (SELECT COUNT(*) FROM copies cp WHERE cp.book_id = b.id) AS total_copies,
         (SELECT COUNT(*) FROM copies cp WHERE cp.book_id = b.id AND cp.status = 'available')
           AS available_copies
    FROM books b
    LEFT JOIN categories c ON c.id = b.category_id`;

export const booksRepository = {
  findAll(filters: BookFilters = {}): { items: BookWithStats[]; total: number } {
    const clauses: string[] = [];
    const params: (string | number)[] = [];

    if (filters.search) {
      clauses.push('(b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ?)');
      const like = `%${filters.search}%`;
      params.push(like, like, like);
    }
    if (filters.categoryId) {
      clauses.push('b.category_id = ?');
      params.push(filters.categoryId);
    }
    if (filters.available) {
      clauses.push(
        `EXISTS (SELECT 1 FROM copies cp WHERE cp.book_id = b.id AND cp.status = 'available')`,
      );
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const pageSize = Math.min(Math.max(filters.pageSize ?? 10, 1), 100);
    const page = Math.max(filters.page ?? 1, 1);

    const countRow = getDb()
      .prepare<(string | number)[], { total: number }>(
        `SELECT COUNT(*) AS total FROM books b ${where}`,
      )
      .get(...params);

    const items = getDb()
      .prepare<(string | number)[], BookWithStats>(
        `${BOOK_SELECT} ${where} ORDER BY b.title LIMIT ? OFFSET ?`,
      )
      .all(...params, pageSize, (page - 1) * pageSize);

    return { items, total: countRow?.total ?? 0 };
  },

  findById(id: number): BookWithStats | undefined {
    return getDb()
      .prepare<[number], BookWithStats>(`${BOOK_SELECT} WHERE b.id = ?`)
      .get(id);
  },

  findByIsbn(isbn: string): BookRow | undefined {
    return getDb()
      .prepare<[string], BookRow>(`SELECT * FROM books WHERE isbn = ?`)
      .get(isbn);
  },

  insert(data: {
    isbn: string;
    title: string;
    author: string;
    publisher?: string | null;
    publicationYear?: number | null;
    categoryId?: number | null;
    description?: string | null;
  }): number {
    const result = getDb()
      .prepare(
        `INSERT INTO books (isbn, title, author, publisher, publication_year, category_id, description)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        data.isbn,
        data.title,
        data.author,
        data.publisher ?? null,
        data.publicationYear ?? null,
        data.categoryId ?? null,
        data.description ?? null,
      );
    return Number(result.lastInsertRowid);
  },

  update(
    id: number,
    data: {
      isbn: string;
      title: string;
      author: string;
      publisher?: string | null;
      publicationYear?: number | null;
      categoryId?: number | null;
      description?: string | null;
    },
  ): number {
    return getDb()
      .prepare(
        `UPDATE books
            SET isbn = ?, title = ?, author = ?, publisher = ?,
                publication_year = ?, category_id = ?, description = ?
          WHERE id = ?`,
      )
      .run(
        data.isbn,
        data.title,
        data.author,
        data.publisher ?? null,
        data.publicationYear ?? null,
        data.categoryId ?? null,
        data.description ?? null,
        id,
      ).changes;
  },

  remove(id: number): number {
    return getDb().prepare(`DELETE FROM books WHERE id = ?`).run(id).changes;
  },

  // ---------- Ejemplares ----------

  findCopies(bookId?: number): CopyRow[] {
    if (bookId) {
      return getDb()
        .prepare<[number], CopyRow>(
          `SELECT * FROM copies WHERE book_id = ? ORDER BY inventory_code`,
        )
        .all(bookId);
    }
    return getDb().prepare<[], CopyRow>(`SELECT * FROM copies ORDER BY inventory_code`).all();
  },

  findCopyById(id: number): CopyRow | undefined {
    return getDb().prepare<[number], CopyRow>(`SELECT * FROM copies WHERE id = ?`).get(id);
  },

  findCopyByCode(code: string): CopyRow | undefined {
    return getDb().prepare<[string], CopyRow>(`SELECT * FROM copies WHERE inventory_code = ?`).get(code);
  },

  insertCopy(bookId: number, inventoryCode: string, condition: string): number {
    const result = getDb()
      .prepare(
        `INSERT INTO copies (book_id, inventory_code, condition) VALUES (?, ?, ?)`,
      )
      .run(bookId, inventoryCode, condition);
    return Number(result.lastInsertRowid);
  },

  updateCopyStatus(id: number, status: CopyRow['status'], condition?: string): number {
    if (condition) {
      return getDb()
        .prepare(`UPDATE copies SET status = ?, condition = ? WHERE id = ?`)
        .run(status, condition, id).changes;
    }
    return getDb().prepare(`UPDATE copies SET status = ? WHERE id = ?`).run(status, id).changes;
  },

  removeCopy(id: number): number {
    return getDb().prepare(`DELETE FROM copies WHERE id = ?`).run(id).changes;
  },

  countActiveLoansOfCopy(copyId: number): number {
    const row = getDb()
      .prepare<[number], { total: number }>(
        `SELECT COUNT(*) AS total FROM loans WHERE copy_id = ? AND status IN ('active','overdue')`,
      )
      .get(copyId);
    return row?.total ?? 0;
  },

  countAvailableCopies(bookId: number): number {
    const row = getDb()
      .prepare<[number], { total: number }>(
        `SELECT COUNT(*) AS total FROM copies WHERE book_id = ? AND status = 'available'`,
      )
      .get(bookId);
    return row?.total ?? 0;
  },
};

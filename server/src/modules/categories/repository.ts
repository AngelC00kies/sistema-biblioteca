import { getDb } from '../../db/connection.js';

export type CategoryRow = {
  id: number;
  name: string;
  description: string | null;
};

export const categoriesRepository = {
  findAll(): CategoryRow[] {
    return getDb()
      .prepare<[], CategoryRow>(`SELECT id, name, description FROM categories ORDER BY name`)
      .all();
  },

  findById(id: number): CategoryRow | undefined {
    return getDb()
      .prepare<[number], CategoryRow>(`SELECT id, name, description FROM categories WHERE id = ?`)
      .get(id);
  },

  findByName(name: string): CategoryRow | undefined {
    return getDb()
      .prepare<[string], CategoryRow>(`SELECT id, name, description FROM categories WHERE name = ?`)
      .get(name);
  },

  insert(name: string, description: string | null): number {
    const result = getDb()
      .prepare(`INSERT INTO categories (name, description) VALUES (?, ?)`)
      .run(name, description);
    return Number(result.lastInsertRowid);
  },

  update(id: number, name: string, description: string | null): number {
    return getDb()
      .prepare(`UPDATE categories SET name = ?, description = ? WHERE id = ?`)
      .run(name, description, id).changes;
  },

  remove(id: number): number {
    return getDb().prepare(`DELETE FROM categories WHERE id = ?`).run(id).changes;
  },

  countBooks(id: number): number {
    const row = getDb()
      .prepare<[number], { total: number }>(
        `SELECT COUNT(*) AS total FROM books WHERE category_id = ?`,
      )
      .get(id);
    return row?.total ?? 0;
  },
};

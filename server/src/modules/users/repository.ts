import { getDb } from '../../db/connection.js';
import type { Role } from '../../middleware/auth.js';

export type UserRow = {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: Role;
  status: string;
  created_at: string;
};

export type PublicUser = Omit<UserRow, 'password_hash'>;

export function toPublicUser(row: UserRow): PublicUser {
  const { password_hash: _hash, ...rest } = row;
  return rest;
}

const COLUMNS = `id, username, email, password_hash, full_name, role, status, created_at`;

export const userRepository = {
  findByUsername(username: string): UserRow | undefined {
    return getDb()
      .prepare<[string], UserRow>(`SELECT ${COLUMNS} FROM users WHERE username = ?`)
      .get(username);
  },

  findById(id: number): UserRow | undefined {
    return getDb()
      .prepare<[number], UserRow>(`SELECT ${COLUMNS} FROM users WHERE id = ?`)
      .get(id);
  },

  findByEmail(email: string): UserRow | undefined {
    return getDb()
      .prepare<[string], UserRow>(`SELECT ${COLUMNS} FROM users WHERE email = ?`)
      .get(email);
  },

  findAll(filters: { role?: Role; status?: string; search?: string } = {}): PublicUser[] {
    const clauses: string[] = [];
    const params: (string | number)[] = [];

    if (filters.role) {
      clauses.push('role = ?');
      params.push(filters.role);
    }
    if (filters.status) {
      clauses.push('status = ?');
      params.push(filters.status);
    }
    if (filters.search) {
      clauses.push('(full_name LIKE ? OR username LIKE ? OR email LIKE ?)');
      const like = `%${filters.search}%`;
      params.push(like, like, like);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    return getDb()
      .prepare<typeof params, PublicUser>(
        `SELECT id, username, email, full_name, role, status, created_at
           FROM users ${where}
          ORDER BY full_name`,
      )
      .all(...params);
  },

  countAll(): number {
    const row = getDb().prepare<[], { total: number }>(`SELECT COUNT(*) AS total FROM users`).get();
    return row?.total ?? 0;
  },

  insert(data: {
    username: string;
    email: string;
    passwordHash: string;
    fullName: string;
    role: Role;
    status?: string;
  }): number {
    const result = getDb()
      .prepare(
        `INSERT INTO users (username, email, password_hash, full_name, role, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        data.username,
        data.email,
        data.passwordHash,
        data.fullName,
        data.role,
        data.status ?? 'active',
      );
    return Number(result.lastInsertRowid);
  },

  update(
    id: number,
    data: Partial<{
      email: string;
      fullName: string;
      role: Role;
      status: string;
      passwordHash: string;
    }>,
  ): void {
    const fields: string[] = [];
    const params: (string | number)[] = [];

    if (data.email !== undefined) {
      fields.push('email = ?');
      params.push(data.email);
    }
    if (data.fullName !== undefined) {
      fields.push('full_name = ?');
      params.push(data.fullName);
    }
    if (data.role !== undefined) {
      fields.push('role = ?');
      params.push(data.role);
    }
    if (data.status !== undefined) {
      fields.push('status = ?');
      params.push(data.status);
    }
    if (data.passwordHash !== undefined) {
      fields.push('password_hash = ?');
      params.push(data.passwordHash);
    }
    if (fields.length === 0) return;

    params.push(id);
    getDb()
      .prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`)
      .run(...params);
  },

  remove(id: number): number {
    return getDb().prepare(`DELETE FROM users WHERE id = ?`).run(id).changes;
  },

  /** Baja lógica: conserva el histórico de préstamos y auditoría. */
  deactivate(id: number): number {
    return getDb()
      .prepare(`UPDATE users SET status = 'inactive' WHERE id = ?`)
      .run(id).changes;
  },

  countLoans(id: number): number {
    const row = getDb()
      .prepare<[number], { total: number }>(`SELECT COUNT(*) AS total FROM loans WHERE user_id = ?`)
      .get(id);
    return row?.total ?? 0;
  },
};

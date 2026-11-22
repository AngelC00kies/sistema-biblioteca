import bcrypt from 'bcryptjs';
import { afterAll, beforeAll } from 'vitest';
import { createApp } from '../src/app.js';
import { closeDb, getDb, initDb } from '../src/db/connection.js';
import { addDays } from '../src/utils/date.js';

export type TestUser = {
  id: number;
  username: string;
  password: string;
  role: 'admin' | 'librarian' | 'member';
};

export const app = createApp();

const hash = (password: string): string => bcrypt.hashSync(password, 4);

/** Base en memoria con los usuarios, categorías, libros y ejemplares mínimos. */
export function seedTestDb(): void {
  const db = getDb();

  const insertUser = db.prepare(
    `INSERT INTO users (id, username, email, password_hash, full_name, role, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  insertUser.run(1, 'admin', 'admin@test.dev', hash('Admin1234'), 'Admin Test', 'admin', 'active');
  insertUser.run(
    2,
    'librarian',
    'lib@test.dev',
    hash('Librarian1234'),
    'Librarian Test',
    'librarian',
    'active',
  );
  insertUser.run(3, 'member', 'member@test.dev', hash('Member1234'), 'Member Test', 'member', 'active');
  insertUser.run(4, 'debtor', 'debtor@test.dev', hash('Member1234'), 'Debtor Test', 'member', 'active');
  insertUser.run(5, 'inactive', 'off@test.dev', hash('Member1234'), 'Off Test', 'member', 'inactive');

  db.prepare(`INSERT INTO categories (id, name, description) VALUES (1, 'Ficción', 'Ficción')`).run();
  db.prepare(`INSERT INTO categories (id, name, description) VALUES (2, 'Ciencia', 'Ciencia')`).run();

  const insertBook = db.prepare(
    `INSERT INTO books (id, isbn, title, author, publisher, publication_year, category_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  insertBook.run(1, '978-84-376-0494-7', 'Cien años de soledad', 'GGM', 'Sudamericana', 1967, 1);
  insertBook.run(2, '978-0-13-468599-1', 'Clean Code', 'Robert C. Martin', 'PH', 2008, 2);

  const insertCopy = db.prepare(
    `INSERT INTO copies (id, book_id, inventory_code, status, condition) VALUES (?, ?, ?, ?, ?)`,
  );
  // Libro 1: 4 ejemplares · Libro 2: 3 ejemplares
  insertCopy.run(1, 1, 'EJ-001-1', 'available', 'good');
  insertCopy.run(2, 1, 'EJ-001-2', 'available', 'good');
  insertCopy.run(3, 1, 'EJ-001-3', 'available', 'good');
  insertCopy.run(4, 1, 'EJ-001-4', 'available', 'regular');
  insertCopy.run(5, 2, 'EJ-002-1', 'available', 'good');
  insertCopy.run(6, 2, 'EJ-002-2', 'available', 'good');
  insertCopy.run(7, 2, 'EJ-002-3', 'available', 'good');
}

/** Inserta un préstamo directamente (evita depender de datos previos entre tests). */
export function insertLoanRow(data: {
  id?: number;
  copyId: number;
  userId: number;
  loanDate?: string;
  dueDate: string;
  returnDate?: string | null;
  status?: 'active' | 'returned' | 'overdue';
}): number {
  const db = getDb();

  // Coherencia temporal: el préstamo siempre comienza antes que la devolución.
  let loanDate = data.loanDate ?? addDays(data.dueDate, -14);
  if (data.returnDate && data.returnDate < loanDate) {
    loanDate = addDays(data.returnDate, -14);
  }

  const result = db
    .prepare(
      `INSERT INTO loans (id, copy_id, user_id, loan_date, due_date, return_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.id ?? null,
      data.copyId,
      data.userId,
      loanDate,
      data.dueDate,
      data.returnDate ?? null,
      data.status ?? 'active',
    );
  return Number(result.lastInsertRowid);
}

/** Inserta una multa pendiente directamente (requiere un préstamo existente). */
export function insertFineRow(loanId: number, userId: number, amount: number): number {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO fines (loan_id, user_id, amount, reason, status)
       VALUES (?, ?, ?, 'Multa de prueba', 'pending')`,
    )
    .run(loanId, userId, amount);
  return Number(result.lastInsertRowid);
}

export async function login(
  username: string,
  password: string,
): Promise<{ token: string; role: string }> {
  const request = (await import('supertest')).default;
  const res = await request(app).post('/api/auth/login').send({ username, password });
  if (res.status !== 200) {
    throw new Error(`Login fallido (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return { token: res.body.data.token as string, role: res.body.data.user.role as string };
}

export async function asAdmin(): Promise<string> {
  return `Bearer ${(await login('admin', 'Admin1234')).token}`;
}

export async function asLibrarian(): Promise<string> {
  return `Bearer ${(await login('librarian', 'Librarian1234')).token}`;
}

export async function asMember(): Promise<string> {
  return `Bearer ${(await login('member', 'Member1234')).token}`;
}

/** Ciclo de vida común: memoria por suite y datos frescos por archivo. */
export function useTestDatabase(): void {
  beforeAll(() => {
    initDb(':memory:');
    seedTestDb();
  });

  afterAll(() => {
    closeDb();
  });
}

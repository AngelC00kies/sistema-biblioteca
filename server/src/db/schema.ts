/**
 * Esquema relacional del Sistema de Gestión de Biblioteca.
 * Diseño en 3FN: cada tabla depende solo de su clave primaria
 * y no existen dependencias transitivas entre atributos no clave.
 */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  full_name     TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'member'
                  CHECK (role IN ('admin','librarian','member')),
  status        TEXT    NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','inactive')),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS books (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  isbn            TEXT    NOT NULL UNIQUE,
  title           TEXT    NOT NULL,
  author          TEXT    NOT NULL,
  publisher       TEXT,
  publication_year INTEGER,
  category_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  description     TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS copies (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id        INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  inventory_code TEXT    NOT NULL UNIQUE,
  status         TEXT    NOT NULL DEFAULT 'available'
                   CHECK (status IN ('available','loaned','lost','maintenance')),
  condition      TEXT    NOT NULL DEFAULT 'good',
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS loans (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  copy_id     INTEGER NOT NULL REFERENCES copies(id) ON DELETE RESTRICT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  loan_date   TEXT    NOT NULL DEFAULT (datetime('now')),
  due_date    TEXT    NOT NULL,
  return_date TEXT,
  status      TEXT    NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','returned','overdue')),
  fine_amount REAL    NOT NULL DEFAULT 0,
  notes       TEXT,
  CHECK (return_date IS NULL OR date(return_date) >= date(loan_date))
);

CREATE TABLE IF NOT EXISTS reservations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT    NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','ready','fulfilled','cancelled')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT    NOT NULL,
  UNIQUE (book_id, user_id, status)
);

CREATE TABLE IF NOT EXISTS fines (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  loan_id    INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount     REAL    NOT NULL CHECK (amount > 0),
  reason     TEXT    NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','paid')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  paid_at    TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT    NOT NULL,
  entity     TEXT    NOT NULL,
  entity_id  INTEGER,
  details    TEXT,
  ip         TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_books_title       ON books(title);
CREATE INDEX IF NOT EXISTS idx_books_author      ON books(author);
CREATE INDEX IF NOT EXISTS idx_books_category    ON books(category_id);
CREATE INDEX IF NOT EXISTS idx_copies_book       ON copies(book_id);
CREATE INDEX IF NOT EXISTS idx_copies_status     ON copies(status);
CREATE INDEX IF NOT EXISTS idx_loans_user        ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_copy        ON loans(copy_id);
CREATE INDEX IF NOT EXISTS idx_loans_status      ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_due         ON loans(due_date);
CREATE INDEX IF NOT EXISTS idx_reservations_book ON reservations(book_id);
CREATE INDEX IF NOT EXISTS idx_reservations_user ON reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_fines_user        ON fines(user_id);
CREATE INDEX IF NOT EXISTS idx_fines_status      ON fines(status);
CREATE INDEX IF NOT EXISTS idx_audit_user        ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created     ON audit_logs(created_at);
`;

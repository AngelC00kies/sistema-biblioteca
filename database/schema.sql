-- =====================================================================
-- Sistema de Gestion de Biblioteca (SGB) — Biblioteca Municipal Ricardo Gomez
-- Script DDL completo (espejo verbatim de server/src/db/schema.ts)
--
-- Motor  : SQLite (better-sqlite3)
-- Uso    : sqlite3 biblioteca.db < database/schema.sql
--          (el backend tambien lo ejecuta al iniciar via db.exec(SCHEMA))
-- Formato: 8 tablas + 16 indices (15 idx_* + 1 unico parcial)
-- Diseño : 3FN — ver docs/06-base-de-datos.md
-- =====================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;

-- ---------------------------------------------------------------------
-- 1. categories — Categorias tematicas del catalogo
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE,
  description TEXT
);

-- ---------------------------------------------------------------------
-- 2. users — Usuarios del sistema (RBAC: admin | librarian | member)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,                    -- bcrypt, 12 rondas
  full_name     TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'member'
                  CHECK (role IN ('admin','librarian','member')),
  status        TEXT    NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','inactive')),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- 3. books — Obras del catalogo
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS books (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  isbn            TEXT    NOT NULL UNIQUE,
  title           TEXT    NOT NULL,
  author          TEXT    NOT NULL,
  publisher       TEXT,
  publication_year INTEGER,                          -- rango 1400..ano+1: Zod (RS-04)
  category_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  description     TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- 4. copies — Ejemplares fisicos (unidad prestable)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS copies (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id        INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  inventory_code TEXT    NOT NULL UNIQUE,            -- ej. EJ-001-1
  status         TEXT    NOT NULL DEFAULT 'available'
                   CHECK (status IN ('available','loaned','lost','maintenance')),
  condition      TEXT    NOT NULL DEFAULT 'good',    -- dominio Zod: good|regular|damaged
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- 5. loans — Prestamos (14 dias de plazo, multa 0.50/dia)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loans (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  copy_id     INTEGER NOT NULL REFERENCES copies(id) ON DELETE RESTRICT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  loan_date   TEXT    NOT NULL DEFAULT (datetime('now')),
  due_date    TEXT    NOT NULL,                      -- hoy + 14 dias (servicio)
  return_date TEXT,
  status      TEXT    NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','returned','overdue')),
  fine_amount REAL    NOT NULL DEFAULT 0,
  notes       TEXT,
  -- Solo la parte de fecha: ERR-01 (date() evita comparar fecha con fecha+hora)
  CHECK (return_date IS NULL OR date(return_date) >= date(loan_date))
);

-- ---------------------------------------------------------------------
-- 6. reservations — Reservas de titulo (caducidad 7 dias)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT    NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','ready','fulfilled','cancelled')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT    NOT NULL                        -- created_at + 7 dias (servicio)
);

-- Una sola reserva activa por (libro, socio); canceladas/atendidas no bloquean.
CREATE UNIQUE INDEX IF NOT EXISTS uq_reservations_active
  ON reservations (book_id, user_id)
  WHERE status = 'pending' OR status = 'ready';

-- ---------------------------------------------------------------------
-- 7. fines — Multas por atraso (maximo una por prestamo, la garantiza el servicio)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 8. audit_logs — Bitacora append-only (se escribe tras el COMMIT)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT    NOT NULL,   -- LOGIN_SUCCESS, LOAN_CREATED, LOAN_RETURNED, FINE_PAID, ...
  entity     TEXT    NOT NULL,   -- tabla afectada: loans, users, books, ...
  entity_id  INTEGER,
  details    TEXT,
  ip         TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- =====================================================================
-- Indices de rendimiento (15 idx_* + 1 unico parcial = 16)
-- users y categories no llevan indices: sus busquedas van por UNIQUE.
-- =====================================================================
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

import Database from 'better-sqlite3';
import type { Database as SQLiteInstance } from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { SCHEMA } from './schema.js';

let instance: SQLiteInstance | null = null;
let currentPath = '';

/**
 * Abre (o reabre) la conexión a la base de datos.
 * Permite que las pruebas usen una base en memoria aislada por suite.
 */
export function initDb(path: string): SQLiteInstance {
  closeDb();

  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }

  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec(SCHEMA);

  instance = db;
  currentPath = path;
  return db;
}

/** Devuelve la conexión activa, abriendola si es necesario. */
export function getDb(): SQLiteInstance {
  if (!instance) {
    return initDb(process.env.DATABASE_PATH ?? `${process.cwd()}/data/biblioteca.db`);
  }
  return instance;
}

export function getCurrentPath(): string {
  return currentPath;
}

export function closeDb(): void {
  if (instance) {
    try {
      instance.close();
    } catch {
      /* la base ya estaba cerrada */
    }
    instance = null;
    currentPath = '';
  }
}

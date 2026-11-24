# 06 — Base de datos

**Proyecto:** Sistema de Gestión de Biblioteca (SGB)
**Documento:** Entidades, atributos, relaciones, diagrama entidad-relación, script DDL, justificación de 3FN y políticas de integridad.

**Motor:** SQLite (better-sqlite3), archivo `biblioteca.db`, `PRAGMA foreign_keys = ON`, `journal_mode = WAL`.

---

## 1. Inventario de entidades

### 1.1 `users` — Usuarios del sistema

| Atributo | Tipo | Restricción | Rol en la entidad |
|---|---|---|---|
| `id` | INTEGER | **PK**, `AUTOINCREMENT` | Identificador |
| `username` | TEXT | **UNIQUE**, NOT NULL, 3–50 (validación Zod) | Credencial de acceso |
| `email` | TEXT | **UNIQUE**, NOT NULL | Contacto |
| `password_hash` | TEXT | NOT NULL | Hash bcrypt (12 rondas), nunca texto plano |
| `full_name` | TEXT | NOT NULL | Nombre completo |
| `role` | TEXT | NOT NULL, DEFAULT `'member'`, CHECK ∈ {admin, librarian, member} | RBAC |
| `status` | TEXT | NOT NULL, DEFAULT `'active'`, CHECK ∈ {active, inactive} | Borrado lógico / bloqueo |
| `created_at` | TEXT/DATETIME | NOT NULL, DEFAULT `datetime('now')` | Alta |

### 1.2 `categories` — Categorías temáticas

| Atributo | Tipo | Restricción |
|---|---|---|
| `id` | INTEGER | **PK**, `AUTOINCREMENT` |
| `name` | TEXT | **UNIQUE**, NOT NULL |
| `description` | TEXT | NULL permitido |

### 1.3 `books` — Obras del catálogo

| Atributo | Tipo | Restricción |
|---|---|---|
| `id` | INTEGER | **PK**, `AUTOINCREMENT` |
| `isbn` | TEXT | **UNIQUE**, NOT NULL |
| `title` | TEXT | NOT NULL |
| `author` | TEXT | NOT NULL |
| `publisher` | TEXT | NULL |
| `publication_year` | INTEGER | NULL; **sin CHECK en la BD** — el rango 1400…año actual+1 lo valida Zod en el servidor (RS-04) |
| `category_id` | INTEGER | **FK → categories(id)**, anulable, `ON DELETE SET NULL` |
| `description` | TEXT | NULL |
| `created_at` | DATETIME | NOT NULL, DEFAULT `datetime('now')` |

### 1.4 `copies` — Ejemplares físicos

| Atributo | Tipo | Restricción |
|---|---|---|
| `id` | INTEGER | **PK**, `AUTOINCREMENT` |
| `book_id` | INTEGER | **FK → books(id)**, NOT NULL, `ON DELETE CASCADE` |
| `inventory_code` | TEXT | **UNIQUE**, NOT NULL |
| `status` | TEXT | CHECK ∈ {available, loaned, lost, maintenance}, DEFAULT `'available'` |
| `condition` | TEXT | DEFAULT `'good'`; dominio Zod ∈ {good, regular, damaged} |
| `created_at` | DATETIME | NOT NULL, DEFAULT `datetime('now')` |

### 1.5 `loans` — Préstamos

| Atributo | Tipo | Restricción |
|---|---|---|
| `id` | INTEGER | **PK**, `AUTOINCREMENT` |
| `copy_id` | INTEGER | **FK → copies(id)**, NOT NULL, `ON DELETE RESTRICT` |
| `user_id` | INTEGER | **FK → users(id)**, NOT NULL, `ON DELETE RESTRICT` |
| `loan_date` | DATE | NOT NULL, DEFAULT `datetime('now')` (se guarda fecha y hora ISO) |
| `due_date` | DATE | NOT NULL (loan_date + 14, calculado en el servicio) |
| `return_date` | DATE | NULL (pendiente de devolución) |
| `status` | TEXT | CHECK ∈ {active, returned, overdue}, DEFAULT `'active'` |
| `fine_amount` | REAL | NOT NULL, DEFAULT 0 |
| `notes` | TEXT | NULL |
| — | — | CHECK `date(return_date) >= date(loan_date)` y CHECK `return_date IS NULL OR …` (ERR-01) |

### 1.6 `reservations` — Reservas

| Atributo | Tipo | Restricción |
|---|---|---|
| `id` | INTEGER | **PK**, `AUTOINCREMENT` |
| `book_id` | INTEGER | **FK → books(id)**, NOT NULL, `ON DELETE CASCADE` |
| `user_id` | INTEGER | **FK → users(id)**, NOT NULL, `ON DELETE CASCADE` |
| `status` | TEXT | CHECK ∈ {pending, ready, fulfilled, cancelled}, DEFAULT `'pending'` |
| `created_at` | DATETIME | NOT NULL, DEFAULT `datetime('now')` |
| `expires_at` | DATETIME | NOT NULL (`created_at + 7 días`, calculado en el servicio; sin CHECK en la BD) |
| — | — | **Índice único parcial** `uq_reservations_active` sobre `(book_id, user_id) WHERE status IN ('pending','ready')`: solo una reserva activa por socio y libro |

### 1.7 `fines` — Multas

| Atributo | Tipo | Restricción |
|---|---|---|
| `id` | INTEGER | **PK**, `AUTOINCREMENT` |
| `loan_id` | INTEGER | **FK → loans(id)**, NOT NULL, `ON DELETE CASCADE` |
| `user_id` | INTEGER | **FK → users(id)**, NOT NULL, `ON DELETE RESTRICT` |
| `amount` | REAL | NOT NULL, CHECK > 0 (0,50/día) |
| `reason` | TEXT | NOT NULL |
| `status` | TEXT | CHECK ∈ {pending, paid}, DEFAULT `'pending'` |
| `created_at` | DATETIME | NOT NULL, DEFAULT `datetime('now')` |
| `paid_at` | DATETIME | NULL |

> La unicidad "una multa por préstamo" (R9) **no** es un constraint de la BD: la garantiza el servicio, porque un préstamo solo puede devolverse una vez (`status='returned'` → 422) y la multa se inserta en esa misma transacción.

### 1.8 `audit_logs` — Bitácora (append-only)

| Atributo | Tipo | Restricción |
|---|---|---|
| `id` | INTEGER | **PK**, `AUTOINCREMENT` |
| `user_id` | INTEGER | **FK → users(id)**, `ON DELETE SET NULL` (NULL para intentos de login fallidos con usuario desconocido) |
| `action` | TEXT | NOT NULL, ej. `LOGIN_SUCCESS`, `LOAN_CREATED` |
| `entity` | TEXT | NOT NULL, ej. `loans`, `users` |
| `entity_id` | INTEGER | NULL permitido |
| `details` | TEXT | JSON/resumen legible |
| `ip` | TEXT | IP del cliente |
| `created_at` | DATETIME | NOT NULL, DEFAULT `datetime('now')` |

---

## 2. Relaciones

| # | Relación | Tipo (en el dominio) | Cardinalidad | FK | Justificación |
|---|---|---|---|---|---|
| R1 | users → loans | Un usuario realiza muchos préstamos | **1–N** | `loans.user_id` | Cada préstamo pertenece a un solo usuario |
| R2 | users → reservations | Un usuario solicita muchas reservas | **1–N** | `reservations.user_id` | — |
| R3 | users → fines | Un usuario adeuda muchas multas | **1–N** | `fines.user_id` | Se duplica el dato (redundante con `loans.user_id`) para consultar "mis multas" con un índice simple, sin JOIN |
| R4 | users → audit_logs | Un usuario origina muchos eventos | **1–N** | `audit_logs.user_id` | — |
| R5 | categories → books | Una categoría agrupa muchos libros | **1–N** | `books.category_id` | Un libro tiene **una** categoría (normalización: evita columna multivaluada) |
| R6 | books → copies | Un libro posee muchos ejemplares | **1–N** | `copies.book_id` | El ejemplar es la unidad física prestable |
| R7 | books → reservations | Un libro acumula reservas | **1–N** | `reservations.book_id` | La reserva es sobre el **título**, no sobre una copia |
| R8 | copies → loans | Un ejemplar acumula préstamos en el tiempo | **1–N** | `loans.copy_id` | Histórico de circulación |
| R9 | loans → fines | Un préstamo origina 0..1 multa | **1–0..1** | `fines.loan_id` | Solo si hubo atraso (máximo una multa por préstamo en esta versión) |
| R10 | loans → reservations | Un préstamo puede satisfacer una reserva | **1–0..1** (lógica, sin FK) | — | Se resuelve en el servicio al pasar la reserva a `ready` |
| R11 | books ⇄ categories *n–m* (hypotética) | — | **N–M** | — | **No aplica**: un libro tiene una sola categoría; si en el futuro se requirieran múltiples etiquetas, se crearía la tabla puente `book_tags`. Se documenta para dejar constancia de que se evaluó. |

**Nota sobre N-M:** en el SGB las relaciones N–M se modelaron de forma **descompuesta en 1–N** mediante la clave foránea correspondiente (por ejemplo, `loans` actúa como tabla asociativa entre `copies` y `users` y además almacena atributos propios del evento: fechas, estado y multa; `reservations` hace lo propio entre `books` y `users`). Esta es la razón por la que no existe una tabla puente explícita.

---

## 3. Diagrama entidad-relación

```mermaid
erDiagram
  users ||--o{ loans : "realiza"
  users ||--o{ reservations : "solicita"
  users ||--o{ fines : "adeuda"
  users ||--o{ audit_logs : "origina"
  categories ||--o{ books : "agrupa"
  books ||--o{ copies : "posee"
  books ||--o{ reservations : "recibe"
  copies ||--o{ loans : "historial"
  loans ||--o| fines : "genera"

  users {
    int id PK
    string username UK
    string email UK
    string password_hash
    string full_name
    string role "admin | librarian | member"
    string status "active | inactive"
    datetime created_at
  }

  categories {
    int id PK
    string name UK
    string description
  }

  books {
    int id PK
    string isbn UK
    string title
    string author
    string publisher
    int publication_year
    int category_id FK
    string description
    datetime created_at
  }

  copies {
    int id PK
    int book_id FK
    string inventory_code UK
    string status "available | loaned | lost | maintenance"
    string condition
    datetime created_at
  }

  loans {
    int id PK
    int copy_id FK
    int user_id FK
    date loan_date
    date due_date
    date return_date
    string status "active | returned | overdue"
    decimal fine_amount
    string notes
  }

  reservations {
    int id PK
    int book_id FK
    int user_id FK
    string status "pending | ready | fulfilled | cancelled"
    datetime created_at
    datetime expires_at
  }

  fines {
    int id PK
    int loan_id FK
    int user_id FK
    decimal amount
    string reason
    string status "pending | paid"
    datetime created_at
    datetime paid_at
  }

  audit_logs {
    int id PK
    int user_id FK
    string action
    string entity
    int entity_id
    string details
    string ip
    datetime created_at
  }
```

### Explicación del diagrama ER

El diagrama representa las ocho entidades persistentes del SGB con sus atributos, claves primarias (`PK`), claves foráneas (`FK`) y restricciones de unicidad (`UK`), más las cardinalidades: todas las relaciones son **uno-a-muchos** marcadas con `||--o{`, donde el lado "muchos" siempre porta la FK. La única relación con participación obligatoria parcial es `loans ||--o| fines` (un préstamo genera **como máximo una** multa), lo que se traduce en que `fines.loan_id` pueda referenciar un préstamo pero no todo préstamo tenga multa.

Se eligió la notación ER (y no un diagrama de clases) para este documento porque su propósito es **el diseño físico de la base de datos**: sirve de puente directo entre el modelo de dominio del documento 04 y el script DDL de la sección 4. Nótese que `reservations` se asocia a `books` (título) y no a `copies`, lo que materializa la regla de negocio "la reserva es sobre el libro cuando **todos** sus ejemplares están prestados"; y que `audit_logs` referencia a `users` de forma anulable para poder registrar intentos de login fallidos de usuarios desconocidos o inactivos sin perder la bitácora.

---

## 4. Script DDL completo

```sql
-- =====================================================================
-- Sistema de Gestion de Biblioteca (SGB)
-- Base de datos: SQLite (better-sqlite3)
-- Script DDL completo - version 1.0 (verbatim de server/src/db/schema.ts)
-- El backend lo ejecuta con db.exec(SCHEMA) al abrir la conexion
-- =====================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;

-- ---------------------------------------------------------------------
-- 1. categories
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE,
  description TEXT
);

-- ---------------------------------------------------------------------
-- 2. users
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 3. books
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 4. copies
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS copies (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id        INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  inventory_code TEXT    NOT NULL UNIQUE,
  status         TEXT    NOT NULL DEFAULT 'available'
                   CHECK (status IN ('available','loaned','lost','maintenance')),
  condition      TEXT    NOT NULL DEFAULT 'good',
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- 5. loans
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 6. reservations
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT    NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','ready','fulfilled','cancelled')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT    NOT NULL
);

-- Solo puede existir UNA reserva activa por (libro, socio);
-- las canceladas/atendidas no bloquean reservas futuras.
CREATE UNIQUE INDEX IF NOT EXISTS uq_reservations_active
  ON reservations (book_id, user_id)
  WHERE status = 'pending' OR status = 'ready';

-- ---------------------------------------------------------------------
-- 7. fines
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
-- 8. audit_logs  (append-only)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Indices de rendimiento (15 + 1 unico parcial = 16; doc. 05, §4.3)
-- ---------------------------------------------------------------------
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
```

> **Nota de implementación:** este bloque es literalmente la constante `SCHEMA` de `server/src/db/schema.ts`; `initDb()` fija los `PRAGMA` (`foreign_keys = ON`, `journal_mode = WAL`, `busy_timeout = 5000`) y ejecuta `db.exec(SCHEMA)` al abrir la conexión (RNF-07). **Los datos de inserción no forman parte del DDL**: el sembrado vive en un script aparte, `server/src/db/seed.ts` (`npm run seed`), que crea 12 libros, 5 usuarios, ejemplares, préstamos, una reserva, multas y la auditoría inicial de demostración.

---

## 5. Justificación de la normalización hasta 3FN

**Reglas recordadas:** 1FN = atributos atómicos sin grupos repetitivos; 2FN = 1FN + todos los no clave dependen de **la clave completa**; 3FN = 2FN + ningún atributo no clave depende de **otro no clave** (ausencia de dependencias transitivas).

### 5.1 Primera forma normal (1FN)
- Cada tabla almacena **una sola cosa** y **un solo valor por atributo**: no existen listas de autores, categorías múltiples ni campos "libros_prestados=3" como texto compuesto.
- Los atributos son atómicos: `role` guarda un único valor de un dominio cerrado (CHECK), `status` igual, `amount` es numérico y `notes` es el único campo libre justificado (comentario humano, no estructurado).
- No hay tablas de cabecera/detalle desnormalizadas: cada préstamo es **una fila**, no un cuaderno con N ítems.

### 5.2 Segunda forma normal (2FN)
Todas las tablas tienen **clave primaria de un solo atributo** (`id` autoincremental), por lo que la dependencia parcial de un atributo no clave respecto de una parte de la clave compuesta es **imposible por construcción**. Por ejemplo, en `loans` los atributos `due_date`, `status` y `fine_amount` dependen de `id` (la clave completa), no de un fragmento de ella. Se cumplen 1FN y 2FN simultáneamente.

### 5.3 Tercera forma normal (3FN) — análisis atributo por atributo

La comprobación se hace identificando dependencias transitivas **no clave → no clave**:

| Tabla | Dependencia transitiva detectada | Acción tomada | ¿3FN? |
|---|---|---|---|
| `users` | Podría existir `role_description` o `city_name/city_zip` | No se almacena ninguna descripción del rol (el rol es el dominio) ni datos geográficos del usuario | ✔ |
| `categories` | `name` y `description` dependen de `id` | Sin transitivas | ✔ |
| `books` | `publisher_city`, `publisher_phone` dependerían de `publisher` (no clave) | No se almacenan datos del editorial; solo el nombre. `category_id` es FK (dependencia de clave ajena, permitida) y de él **no** depende ningún otro atributo (no se guarda `category_name` en `books`) | ✔ |
| `copies` | `book_title`, `book_author` dependerían de `book_id` | **No** se duplica la información del libro en `copies`; se recupera por JOIN (RF-18/RF-22) | ✔ |
| `loans` | `username`, `user_email`, `isbn`, `inventory_code`, `category_name` dependerían de `user_id`/`copy_id` (FK) | No se copia ningún dato del usuario, del ejemplar ni del libro; `fine_amount` **sí** depende de `id` (dato propio del préstamo, no de la multa) | ✔ |
| `reservations` | `book_title`, `user_name` | No duplicados; se recuperan por JOIN | ✔ |
| `fines` | `username`, `loan_due_date` | No duplicados: solo `user_id` (FK). `reason` e `amount` dependen del `id` de la multa | ✔ |
| `audit_logs` | `username`, `email` | No se almacena el nombre del usuario, solo su `user_id` | ✔ |

**Conclusión:** ninguna tabla contiene un atributo no clave que dependa de otro no clave; todos los campos dependen funcionalmente de la PK `id` o son claves foráneas (dependencias de clave ajena, que la 3FN permite). Se elimina toda redundancia estructural y solo persisten duplicaciones **deliberadas y controladas**:

- `fines.user_id` junto a `fines.loan_id`: redundante respecto de `loans.user_id`, pero necesaria para consultar "multas por usuario" con un índice simple y no perder el vínculo si el préstamo se archiva; está justificado como decisión consciente de rendimiento documentada en AD-… (doc. 05).
- `reservations.user_id/book_id`: dado que la reserva **no** referencia un préstamo concreto (se crea cuando no hay ejemplares disponibles), no existe transitiva posible.

### 5.4 Conformidad de Boyce-Codd (nota)
La única zona a vigilar es `users`: si un mismo `email` pudiera tener dos `username` distintos invertiría la determinación. Se evita creando **UNIQUE** tanto en `username` como en `email`, de modo que ambos determinan funcionalmente a la fila y la tabla permanece en BCNF.

---

## 6. Políticas de integridad de datos

### 6.1 Integridad de entidad
- **PK** `INTEGER PRIMARY KEY AUTOINCREMENT` en las 8 tablas: imposible nulos ni duplicados.
- **UNIQUE** en `users.username`, `users.email`, `categories.name`, `books.isbn`, `copies.inventory_code`.
- `NOT NULL` en todos los campos que participan en reglas de negocio.

### 6.2 Integridad referencial
- `PRAGMA foreign_keys = ON` en cada conexión (obligatorio en SQLite, que por defecto **no** las activa).
- Acciones explícitas por tipo de relación (verbatim de `schema.ts`):
  - `ON DELETE RESTRICT` donde el borrado rompería el histórico: `loans.copy_id`, `loans.user_id` y `fines.user_id` (no se borra un ejemplar, un socio o una multa con vínculos vivos) → refuerza RF-14/RF-19.
  - `ON DELETE CASCADE` donde el detalle sin cabecera no tiene sentido: `copies.book_id`, `reservations.book_id`, `reservations.user_id` y `fines.loan_id`.
  - `ON DELETE SET NULL` en `audit_logs.user_id` (la bitácora debe sobrevivir) y en `books.category_id` (el libro no se borra si se da de baja su categoría).
  - Sin `ON UPDATE CASCADE`: las PK son enteros autoincrementales que nunca se actualizan.
- **0 filas huérfanas** es el criterio de aceptación: se comprueba con `PRAGMA foreign_key_check` (sin resultados) y de forma continua porque `foreign_keys = ON` rechazaría la inserción de cualquier fila sin cabecera.

### 6.3 Integridad de dominio
- `CHECK` para todos los enums (`role`, `status` de users/copies/loans/reservations/fines) — espejo de los `z.enum(...)` del servidor.
- `CHECK` numérico real: `amount > 0` en `fines`. `fine_amount` no tiene CHECK (se calcula en el servicio y siempre ≥ 0) y `publication_year` **no tiene CHECK en la BD**: el rango 1400…año actual+1 lo impone Zod en el servidor (RS-04).
- `CHECK` temporal real: `date(return_date) >= date(loan_date)` en `loans` (comparación **solo de la parte de fecha**, ERR-01). El resto de las reglas temporales (`dueDate` futuro, `expires_at = created_at + 7 días`, `paid_at` al marcar `paid`) se aplican en las capas de servicio y de validación, no en constraints.

### 6.4 Integridad de usuario / concurrente
- better-sqlite3 ejecuta cada `run()` con **prepared statements** (SQL parametrizado, sin concatenación → inmune a SQLi, RS-05).
- Las operaciones multi-tabla (préstamo + cambio de ejemplar + multa + reserva) se envuelven en `db.transaction(…)` de better-sqlite3 (`BEGIN … COMMIT` con `ROLLBACK` automático ante cualquier excepción).
- El bloqueo doble de un mismo ejemplar (préstamo concurrente) se resuelve en el servicio con la verificación `status='available'` **dentro** de la transacción; el índice único de `inventory_code` y el CHECK de estado del ejemplar actúan como última barrera.
- La unicidad de la reserva activa por `(book_id, user_id)` la garantiza el índice parcial `uq_reservations_active`.
- `busy_timeout = 5000` ms para esperar escrituras en lugar de fallar.

### 6.5 Integridad temporal
- Todas las fechas del dominio se manejan en **UTC** con utilidades propias (`todayISO`, `addDays`, `daysBetween` de `server/src/utils/date.ts`): `loan_date`, `due_date`, `return_date` y `expires_at` guardan `YYYY-MM-DD` y las marcas usan `datetime('now')` de SQLite (también UTC), de modo que no hay mezcla de husos.
- El cálculo de atraso usa **solo la parte de fecha** (`daysBetween`), lo que hace irrelevante la hora de inserción (precisamente la causa del error ERR-01 del doc. 10).
- `due_date` se calcula en la capa de servicios (hoy + 14 días) y se almacena, evitando que el vencimiento dependa del huso del cliente.

### 6.6 Respaldo y recuperación (resumen; detalle en doc. 08)
- Copia diaria consistente con `VACUUM INTO` o `sqlite3 biblioteca.db ".backup ..."`, retención de 7 días.
- Antes de cada copia se fuerza `PRAGMA wal_checkpoint(TRUNCATE)` para que el archivo principal esté completo.

```sql
-- Comando de copia de seguridad recomendado
sqlite3 biblioteca.db "VACUUM INTO 'backups/biblioteca_$(date +%F).db';"
```

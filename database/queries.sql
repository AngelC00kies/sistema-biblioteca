-- =====================================================================
-- Sistema de Gestion de Biblioteca (SGB)
-- Consultas SQL reales del sistema, organizadas por modulo.
--
-- Todas son las sentencias efectivamente ejecutadas por los repositorios
-- de server/src/modules/*/repository.ts (SQL parametrizado con `?`).
-- Los parametros se muestran como :nombre para legibilidad, en el codigo
-- se pasan posicionamente a db.prepare(...).run(...)/.get(...)/.all(...).
--
-- Uso: sqlite3 server/data/biblioteca.db < database/queries.sql
-- =====================================================================

PRAGMA foreign_keys = ON;

-- =====================================================================
-- MODULO 1 · AUTENTICACION Y USUARIOS (users/repository.ts)
-- =====================================================================

-- [AU-1] Login: buscar usuario por nombre de usuario (trae password_hash)
SELECT id, username, email, password_hash, full_name, role, status, created_at
  FROM users WHERE username = :username;

-- [AU-2] Verificar unicidad de correo antes de crear/actualizar
SELECT id FROM users WHERE email = :email;

-- [USR-1] Listado con filtros dinamicos (role/status/search) SIN password_hash
--         El bibliotecario solo puede invocarlo con role='member' AND status='active'
SELECT id, username, email, full_name, role, status, created_at
  FROM users
 WHERE (role = :role OR :role IS NULL)
   AND (status = :status OR :status IS NULL)
   AND (full_name LIKE :like OR username LIKE :like OR email LIKE :like)
 ORDER BY full_name;

-- [USR-2] Alta de usuario (password_hash = bcrypt de 12 rondas)
INSERT INTO users (username, email, password_hash, full_name, role, status)
VALUES (:username, :email, :password_hash, :full_name, :role, 'active');

-- [USR-3] Actualizacion parcial: el servicio arma solo los campos enviados
UPDATE users SET email = :email, full_name = :full_name,
                 role = :role, status = :status, password_hash = :password_hash
 WHERE id = :id;

-- [USR-4] Baja logica (conserva historico de prestamos y auditoria)
UPDATE users SET status = 'inactive' WHERE id = :id;

-- [USR-5] Baja fisica (solo si no tiene historico)
DELETE FROM users WHERE id = :id;

-- [USR-6] Contar prestamos de un usuario (para decidir baja vs. borrado)
SELECT COUNT(*) AS total FROM loans WHERE user_id = :id;

-- =====================================================================
-- MODULO 2 · CATEGORIAS (categories/repository.ts)
-- =====================================================================

-- [CAT-1] Listado completo ( cualquier rol autenticado )
SELECT id, name, description FROM categories ORDER BY name;

-- [CAT-2] Buscar por nombre exacto (control de duplicados -> 409)
SELECT id, name, description FROM categories WHERE name = :name;

-- [CAT-3] Alta / modificacion
INSERT INTO categories (name, description) VALUES (:name, :description);
UPDATE categories SET name = :name, description = :description WHERE id = :id;

-- [CAT-4] Eliminar solo si no tiene libros asociados (422 en caso contrario)
SELECT COUNT(*) AS total FROM books WHERE category_id = :id;
DELETE FROM categories WHERE id = :id;

-- =====================================================================
-- MODULO 3 · CATALOGO Y EJEMPLARES (books/repository.ts)
-- =====================================================================

-- [LIB-1] Listado con paginacion + estadisticos por libro (subconsultas COUNT)
SELECT b.id, b.isbn, b.title, b.author, b.publisher, b.publication_year,
       b.category_id, b.description, b.created_at,
       c.name AS category_name,
       (SELECT COUNT(*) FROM copies cp WHERE cp.book_id = b.id) AS total_copies,
       (SELECT COUNT(*) FROM copies cp WHERE cp.book_id = b.id AND cp.status = 'available')
         AS available_copies
  FROM books b
  LEFT JOIN categories c ON c.id = b.category_id
 WHERE (b.title LIKE :like OR b.author LIKE :like OR b.isbn LIKE :like)  -- busqueda libre
   AND b.category_id = :category_id                                       -- filtro opcional
   AND EXISTS (SELECT 1 FROM copies cp                                   -- solo disponibles
               WHERE cp.book_id = b.id AND cp.status = 'available')
 ORDER BY b.title
 LIMIT :pageSize OFFSET :offset;

-- [LIB-2] Contador para la paginacion
SELECT COUNT(*) AS total FROM books b
 WHERE (b.title LIKE :like OR b.author LIKE :like OR b.isbn LIKE :like);

-- [LIB-3] Ficha de libro por id / por ISBN (control de duplicados -> 409)
SELECT * FROM books WHERE id = :id;
SELECT * FROM books WHERE isbn = :isbn;

-- [LIB-4] Alta, edicion y baja de libro
INSERT INTO books (isbn, title, author, publisher, publication_year, category_id, description)
VALUES (:isbn, :title, :author, :publisher, :publication_year, :category_id, :description);

UPDATE books SET isbn = :isbn, title = :title, author = :author, publisher = :publisher,
                 publication_year = :publication_year, category_id = :category_id,
                 description = :description
 WHERE id = :id;

DELETE FROM books WHERE id = :id;   -- RESTRICT en copies lo protege si hay ejemplares

-- [EJ-1] Ejemplares de un libro (o todos), ordenados por codigo
SELECT * FROM copies WHERE book_id = :bookId ORDER BY inventory_code;
SELECT * FROM copies ORDER BY inventory_code;

-- [EJ-2] Alta y cambio de estado de ejemplar
INSERT INTO copies (book_id, inventory_code, condition)
VALUES (:book_id, :inventory_code, :condition);        -- status toma 'available'

UPDATE copies SET status = :status, condition = :condition WHERE id = :id;

-- [EJ-3] Disponibilidad de un libro (regla: reservar solo sin disponibilidad)
SELECT COUNT(*) AS total FROM copies
 WHERE book_id = :bookId AND status = 'available';

-- [EJ-4] Préstamos vivos de un ejemplar (bloqueo de doble prestamo -> 422)
SELECT COUNT(*) AS total FROM loans
 WHERE copy_id = :copyId AND status IN ('active','overdue');

-- =====================================================================
-- MODULO 4 · PRESTAMOS (loans/repository.ts)
-- =====================================================================

-- [PRE-1] Listado enriquecido: 4 JOINs + calculo de dias de atraso en SQL
SELECT l.id, l.copy_id, l.user_id, l.loan_date, l.due_date, l.return_date,
       l.status, l.fine_amount, l.notes,
       c.inventory_code, c.condition, c.book_id,
       b.title AS book_title, b.author AS book_author,
       u.full_name AS member_name, u.username AS member_username,
       CASE
         WHEN l.return_date IS NOT NULL AND date(l.return_date) > date(l.due_date)
           THEN CAST(julianday(l.return_date) - julianday(l.due_date) AS INTEGER)
         WHEN l.return_date IS NULL AND date('now') > date(l.due_date)
           THEN CAST(julianday('now') - julianday(l.due_date) AS INTEGER)
         ELSE 0
       END AS days_late
  FROM loans l
  JOIN copies c ON c.id = l.copy_id
  JOIN books  b ON b.id = c.book_id
  JOIN users  u ON u.id = l.user_id
 WHERE (l.status = :status OR :status IS NULL)
   AND (l.user_id = :userId OR :userId IS NULL)          -- filtro propio del socio
   AND l.return_date IS NULL AND date(l.due_date) < date('now')   -- solo vencidos
   AND (b.title LIKE :like OR u.full_name LIKE :like OR c.inventory_code LIKE :like)
 ORDER BY l.id DESC;

-- [PRE-2] Detalle por id (control IDOR: member solo el propio -> ERR-10)
SELECT l.id, l.copy_id, l.user_id, l.loan_date, l.due_date, l.return_date,
       l.status, l.fine_amount, l.notes,
       c.inventory_code, c.condition, c.book_id,
       b.title AS book_title, b.author AS book_author,
       u.full_name AS member_name, u.username AS member_username,
       CASE
         WHEN l.return_date IS NOT NULL AND date(l.return_date) > date(l.due_date)
           THEN CAST(julianday(l.return_date) - julianday(l.due_date) AS INTEGER)
         WHEN l.return_date IS NULL AND date('now') > date(l.due_date)
           THEN CAST(julianday('now') - julianday(l.due_date) AS INTEGER)
         ELSE 0
       END AS days_late
  FROM loans l
  JOIN copies c ON c.id = l.copy_id
  JOIN books  b ON b.id = c.book_id
  JOIN users  u ON u.id = l.user_id
 WHERE l.id = :id;

-- [PRE-3] Reglas de negocio previas al alta
SELECT * FROM loans WHERE copy_id = :copyId AND status IN ('active','overdue');
SELECT COUNT(*) AS total FROM loans
 WHERE user_id = :userId AND status IN ('active','overdue');   -- limite 5 activos
SELECT COUNT(*) AS total FROM fines
 WHERE user_id = :userId AND status = 'pending';               -- bloqueo por deuda
SELECT COUNT(*) AS total FROM fines
 WHERE user_id = :userId AND status = 'pending' AND amount > 0;

-- [PRE-4] Alta del prestamo (loan_date = ahora, due_date = hoy+14 en el servicio)
INSERT INTO loans (copy_id, user_id, due_date, notes)
VALUES (:copyId, :userId, :dueDate, :notes);

-- [PRE-5] Marcar ejemplar como prestado (misma transaccion que PRE-4)
UPDATE copies SET status = 'loaned' WHERE id = :copyId;

-- [PRE-6] Devolucion: fecha, estado y multa en una sola sentencia
UPDATE loans
   SET return_date = :returnDate, status = 'returned', fine_amount = :fineAmount
 WHERE id = :id;

-- [PRE-7] Refresco perezoso de vencidos (se llama antes de cada listado)
UPDATE loans
   SET status = 'overdue'
 WHERE status = 'active' AND date(due_date) < date('now');

-- =====================================================================
-- MODULO 5 · RESERVAS (reservations/repository.ts)
-- =====================================================================

-- [RES-1] Listado enriquecido con disponibilidad actual del titulo
SELECT r.id, r.book_id, r.user_id, r.status, r.created_at, r.expires_at,
       b.title AS book_title, b.author AS book_author, b.isbn,
       u.full_name AS member_name,
       (SELECT COUNT(*) FROM copies c WHERE c.book_id = b.id AND c.status = 'available')
         AS available_copies
  FROM reservations r
  JOIN books b ON b.id = r.book_id
  JOIN users u ON u.id = r.user_id
 WHERE (r.status = :status OR :status IS NULL)
   AND (r.user_id = :userId OR :userId IS NULL)
 ORDER BY r.created_at DESC;

-- [RES-2] Reserva activa previa del mismo socio sobre el mismo libro -> 409
SELECT * FROM reservations
 WHERE book_id = :bookId AND user_id = :userId
   AND status IN ('pending','ready');

-- [RES-3] Limite de 3 reservas activas por socio
SELECT COUNT(*) AS total FROM reservations
 WHERE user_id = :userId AND status IN ('pending','ready');

-- [RES-4] Alta (expires_at = hoy + 7 dias, calculado en el servicio)
INSERT INTO reservations (book_id, user_id, expires_at)
VALUES (:bookId, :userId, :expiresAt);

-- [RES-5] Cancelar / cumplir
UPDATE reservations SET status = :status WHERE id = :id;

-- [RES-6] Al devolver un libro: reserva mas antigua pasa a 'ready' y renueva plazo
UPDATE reservations SET status = 'ready', expires_at = :expiresAt WHERE id = :id;

SELECT * FROM reservations
 WHERE book_id = :bookId AND status = 'pending'
 ORDER BY created_at ASC;                      -- cola: primero el mas antiguo

-- [RES-7] Expiracion perezosa (se ejecuta al listar/crear reservas)
UPDATE reservations
   SET status = 'cancelled'
 WHERE status IN ('pending','ready') AND datetime(expires_at) < datetime('now');

-- =====================================================================
-- MODULO 6 · MULTAS (fines/repository.ts)
-- =====================================================================

-- [MUL-1] Listado con el libro y el socio (4 JOINs)
SELECT f.id, f.loan_id, f.user_id, f.amount, f.reason, f.status, f.created_at, f.paid_at,
       u.full_name AS member_name, b.title AS book_title, c.inventory_code
  FROM fines f
  JOIN users  u ON u.id = f.user_id
  JOIN loans  l ON l.id = f.loan_id
  JOIN copies c ON c.id = l.copy_id
  JOIN books  b ON b.id = c.book_id
 WHERE (f.status = :status OR :status IS NULL)
   AND (f.user_id = :userId OR :userId IS NULL)
 ORDER BY f.id DESC;

-- [MUL-2] Totales pendientes del socio (bloquea nuevo prestamo si > 0)
SELECT COUNT(*) AS total FROM fines WHERE user_id = :userId AND status = 'pending';
SELECT COALESCE(SUM(amount), 0) AS total
  FROM fines WHERE user_id = :userId AND status = 'pending';

-- [MUL-3] Alta de la multa al devolver con atraso (monto = dias * 0.50)
INSERT INTO fines (loan_id, user_id, amount, reason)
VALUES (:loanId, :userId, :amount, :reason);

-- [MUL-4] Pago (doble pago bloqueado por el servicio: 422 si ya esta pagada)
UPDATE fines SET status = 'paid', paid_at = datetime('now') WHERE id = :id;

-- =====================================================================
-- MODULO 7 · REPORTES (reports/repository.ts)
-- =====================================================================

-- [REP-1] Resumen operativo (KPIs del dashboard)
SELECT COUNT(*) AS value FROM books;
SELECT COUNT(*) AS value FROM copies;
SELECT COUNT(*) AS value FROM copies WHERE status = 'available';
SELECT COUNT(*) AS value FROM users WHERE status = 'active';
SELECT COUNT(*) AS value FROM loans WHERE status IN ('active','overdue');
SELECT COUNT(*) AS value FROM loans
 WHERE return_date IS NULL AND date(due_date) < date('now');
SELECT COUNT(*) AS value FROM reservations WHERE status IN ('pending','ready');
SELECT COUNT(*) AS value FROM fines WHERE status = 'pending';
SELECT COALESCE(SUM(amount), 0) AS value FROM fines WHERE status = 'pending';

-- [REP-2] Ranking de libros mas prestados (GROUP BY + ORDER BY contador)
SELECT b.id AS book_id, b.title, b.author, COUNT(l.id) AS loan_count
  FROM books b
  JOIN copies c ON c.book_id = b.id
  JOIN loans  l ON l.copy_id = c.id
 GROUP BY b.id
 ORDER BY loan_count DESC, b.title ASC
 LIMIT :limit;                                   -- validado por Zod: 1..50

-- [REP-3] Prestamos vencidos ordenados por atraso
SELECT l.id, b.title AS book_title, c.inventory_code, u.full_name AS member_name,
       l.due_date,
       CAST(julianday('now') - julianday(l.due_date) AS INTEGER) AS days_late
  FROM loans l
  JOIN copies c ON c.id = l.copy_id
  JOIN books  b ON b.id = c.book_id
  JOIN users  u ON u.id = l.user_id
 WHERE l.return_date IS NULL AND date(l.due_date) < date('now')
 ORDER BY days_late DESC;

-- [REP-4] Prestamos por mes (serie del dashboard)
SELECT strftime('%Y-%m', loan_date) AS month, COUNT(*) AS total
  FROM loans
 GROUP BY month
 ORDER BY month DESC
 LIMIT :months;

-- =====================================================================
-- MODULO 8 · AUDITORIA (audit/repository.ts)
-- =====================================================================

-- [AUD-1] Bitacora con filtros de accion/entidad (LEFT JOIN: user_id anulable)
SELECT a.id, a.user_id, a.action, a.entity, a.entity_id, a.details, a.ip, a.created_at,
       u.username
  FROM audit_logs a
  LEFT JOIN users u ON u.id = a.user_id
 WHERE (a.action = :action OR :action IS NULL)
   AND (a.entity = :entity OR :entity IS NULL)
 ORDER BY a.id DESC
 LIMIT :limit;                                   -- 1..500, por defecto 100

-- [AUD-2] Escritura (se ejecuta DESPUES del COMMIT, un fallo no revierte el negocio)
INSERT INTO audit_logs (user_id, action, entity, entity_id, details, ip)
VALUES (:user_id, :action, :entity, :entity_id, :details, :ip);

-- =====================================================================
-- CONSULTAS DE INTEGRIDAD (uso administrativo / verificacion)
-- =====================================================================

-- [CHK-1] Filas huerfanas (debe devolver 0 filas; PRAGMA foreign_keys = ON)
PRAGMA foreign_key_check;

-- [CHK-2] Estado general de la base
SELECT (SELECT COUNT(*) FROM users)       AS usuarios,
       (SELECT COUNT(*) FROM books)       AS libros,
       (SELECT COUNT(*) FROM copies)      AS ejemplares,
       (SELECT COUNT(*) FROM loans)       AS prestamos,
       (SELECT COUNT(*) FROM reservations) AS reservas,
       (SELECT COUNT(*) FROM fines)       AS multas,
       (SELECT COUNT(*) FROM audit_logs)  AS eventos_auditoria;

-- [CHK-3] Prestamos activos con multa pendiente (inconsistencia potencial)
SELECT l.id, u.full_name, f.amount
  FROM loans l
  JOIN users u ON u.id = l.user_id
  JOIN fines f ON f.loan_id = l.id AND f.status = 'pending'
 WHERE l.status = 'returned';

import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { closeDb, getDb, initDb } from './connection.js';

/**
 * Carga un conjunto de datos de demostración.
 * Idempotente: si ya existen usuarios no vuelve a sembrar.
 */
async function seed(): Promise<void> {
  initDb(env.databasePath);
  const db = getDb();

  const existing = db
    .prepare<[], { total: number }>(`SELECT COUNT(*) AS total FROM users`)
    .get();
  if ((existing?.total ?? 0) > 0) {
    console.log('La base ya contiene datos. No se ejecuta el seed.');
    closeDb();
    return;
  }

  const hash = (password: string) => bcrypt.hashSync(password, env.bcryptRounds);

  const insertUser = db.prepare(
    `INSERT INTO users (username, email, password_hash, full_name, role, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const insertCategory = db.prepare(
    `INSERT INTO categories (name, description) VALUES (?, ?)`,
  );
  const insertBook = db.prepare(
    `INSERT INTO books (isbn, title, author, publisher, publication_year, category_id, description)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertCopy = db.prepare(
    `INSERT INTO copies (book_id, inventory_code, condition) VALUES (?, ?, ?)`,
  );

  const run = db.transaction(() => {
    // --- Usuarios ---
    const adminId = Number(
      insertUser.run(
        'admin',
        'admin@biblioteca.gob',
        hash('Admin1234'),
        'Ana Torres',
        'admin',
        'active',
      ).lastInsertRowid,
    );
    const librarianId = Number(
      insertUser.run(
        'bibliotecario',
        'personal@biblioteca.gob',
        hash('Biblio1234'),
        'Luis Mendoza',
        'librarian',
        'active',
      ).lastInsertRowid,
    );
    const memberIds = [
      insertUser.run(
        'maria.garcia',
        'maria.garcia@mail.com',
        hash('Socio1234'),
        'María García',
        'member',
        'active',
      ),
      insertUser.run(
        'juan.perez',
        'juan.perez@mail.com',
        hash('Socio1234'),
        'Juan Pérez',
        'member',
        'active',
      ),
      insertUser.run(
        'lucia.fernandez',
        'lucia.fernandez@mail.com',
        hash('Socio1234'),
        'Lucía Fernández',
        'member',
        'active',
      ),
      insertUser.run(
        'carlos.ruiz',
        'carlos.ruiz@mail.com',
        hash('Socio1234'),
        'Carlos Ruiz',
        'member',
        'inactive',
      ),
    ].map((r) => Number(r.lastInsertRowid));

    // --- Categorías ---
    const categoryIds: Record<string, number> = {};
    const categories: [string, string][] = [
      ['Ficción', 'Novelas y relatos de ficción literaria'],
      ['Ciencia', 'Divulgación y literatura científica'],
      ['Historia', 'Obras sobre historia universal y local'],
      ['Infantil', 'Lecturas para niños y jóvenes'],
      ['Tecnología', 'Programación, ingeniería y sistemas'],
    ];
    for (const [name, description] of categories) {
      categoryIds[name] = Number(insertCategory.run(name, description).lastInsertRowid);
    }

    // --- Libros y ejemplares ---
    const books: [string, string, string, string, number, number, string][] = [
      ['978-84-376-0494-7', 'Cien años de soledad', 'Gabriel García Márquez', 'Editorial Sudamericana', 1967, categoryIds['Ficción'], 'Obra cumbre del realismo mágico.'],
      ['978-84-204-1234-5', 'El amor en los tiempos del cólera', 'Gabriel García Márquez', 'Editorial Sudamericana', 1985, categoryIds['Ficción'], 'Historia de amor prolongada en el tiempo.'],
      ['978-84-9759-278-3', 'El nombre de la rosa', 'Umberto Eco', 'Lumen', 1980, categoryIds['Ficción'], 'Novela policial en una abadía medieval.'],
      ['978-84-206-6547-3', 'Breve historia del tiempo', 'Stephen Hawding', 'Crítica', 1988, categoryIds['Ciencia'], 'Introducción al cosmos para el lector general.'],
      ['978-84-345-6789-1', 'El hombre que calculaba', 'Malba Tahan', 'Nova', 1938, categoryIds['Ciencia'], 'Relatos matemáticos ambientados en el Medio Oriente.'],
      ['978-84-9970-123-4', 'Sapiens', 'Yuval Noah Harari', 'Debate', 2011, categoryIds['Historia'], 'De animales a dioses: historia de la humanidad.'],
      ['978-84-663-3456-7', 'Historia de España para jóvenes', 'José María Álvarez', 'SM', 2005, categoryIds['Historia'], 'Síntesis histórica para estudiantes.'],
      ['978-84-667-5678-9', 'El principito', 'Antoine de Saint-Exupéry', 'Salamandra', 1943, categoryIds['Infantil'], 'Clásico universal de la literatura infantil.'],
      ['978-84-667-8901-2', 'Matilda', 'Roald Dahl', 'Alfaguara', 1988, categoryIds['Infantil'], 'Aventuras de una niña prodigio.'],
      ['978-0-13-468599-1', 'Clean Code', 'Robert C. Martin', 'Prentice Hall', 2008, categoryIds['Tecnología'], 'Manual de buenas prácticas de programación.'],
      ['978-0-201-63361-0', 'Design Patterns', 'Erich Gamma', 'Addison-Wesley', 1994, categoryIds['Tecnología'], 'Patrones de diseño orientado a objetos.'],
      ['978-84-415-3855-6', 'Refactoring', 'Martin Fowler', 'Addison-Wesley', 2018, categoryIds['Tecnología'], 'Mejora del diseño del código existente.'],
    ];

    const copyCounters: Record<number, number> = {};
    for (const [isbn, title, author, publisher, year, categoryId, description] of books) {
      const bookId = Number(
        insertBook.run(isbn, title, author, publisher, year, categoryId, description)
          .lastInsertRowid,
      );
      const quantity = 2 + (bookId % 2); // 2 o 3 ejemplares
      copyCounters[bookId] = quantity;
      for (let i = 1; i <= quantity; i += 1) {
        insertCopy.run(bookId, `EJ-${String(bookId).padStart(3, '0')}-${i}`, 'good');
      }
    }

    return { adminId, librarianId, memberIds };
  });

  const { adminId, librarianId, memberIds } = run();

  // --- Préstamos, reservas y multas de demostración ---
  const loans = db.transaction(() => {
    const insertLoan = db.prepare(
      `INSERT INTO loans (copy_id, user_id, loan_date, due_date, status, fine_amount)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const setCopy = db.prepare(`UPDATE copies SET status = ? WHERE id = ?`);
    const insertFine = db.prepare(
      `INSERT INTO fines (loan_id, user_id, amount, reason, status) VALUES (?, ?, ?, ?, ?)`,
    );

    const copy = (code: string) =>
      db
        .prepare<[string], { id: number }>(`SELECT id FROM copies WHERE inventory_code = ?`)
        .get(code)!;

    // Préstamo activo en tiempo
    const c1 = copy('EJ-001-1');
    insertLoan.run(c1.id, memberIds[0], '2026-11-10', '2026-11-24', 'active', 0);
    setCopy.run('loaned', c1.id);

    // Préstamo vencido con multa pendiente
    const c2 = copy('EJ-004-1');
    const lateLoanId = Number(
      insertLoan.run(c2.id, memberIds[1], '2026-10-01', '2026-10-15', 'overdue', 5.5).lastInsertRowid,
    );
    setCopy.run('loaned', c2.id);
    insertFine.run(lateLoanId, memberIds[1], 5.5, 'Atraso de 11 día(s) en la devolución', 'pending');

    // Préstamo devuelto sin multa
    const c3 = copy('EJ-008-1');
    insertLoan.run(c3.id, memberIds[2], '2026-10-05', '2026-10-19', 'returned', 0);
    db.prepare(`UPDATE loans SET return_date = '2026-10-18' WHERE id = last_insert_rowid()`).run();

    // Título totalmente prestado: habilita el flujo de reservas del sistema.
    for (const [code, memberId] of [
      ['EJ-008-1', memberIds[0]],
      ['EJ-008-2', memberIds[2]],
    ] as const) {
      const c = copy(code);
      insertLoan.run(c.id, memberId, '2026-11-15', '2026-11-29', 'active', 0);
      setCopy.run('loaned', c.id);
    }

    // Reserva pendiente (el libro está totalmente prestado)
    const fullyLoanedBook = db
      .prepare<[], { book_id: number }>(
        `SELECT book_id FROM copies GROUP BY book_id
          HAVING COUNT(*) = SUM(CASE WHEN status = 'loaned' THEN 1 ELSE 0 END)
          LIMIT 1`,
      )
      .get();
    if (fullyLoanedBook) {
      db.prepare(
        `INSERT INTO reservations (book_id, user_id, status, expires_at)
         VALUES (?, ?, 'pending', datetime('now', '+7 days'))`,
      ).run(fullyLoanedBook.book_id, memberIds[2]);
    }

    // Eventos de auditoría iniciales
    const insertAudit = db.prepare(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, details, ip)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    insertAudit.run(adminId, 'SEED_EXECUTED', 'system', null, 'Datos de demostración cargados', '127.0.0.1');
    insertAudit.run(librarianId, 'BOOK_CREATED', 'books', null, 'Catálogo inicial importado', '127.0.0.1');
  });

  loans();

  console.log('Seed ejecutado correctamente.');
  console.log('Credenciales de prueba:');
  console.log('  admin          / Admin1234     (rol: administrador)');
  console.log('  bibliotecario  / Biblio1234    (rol: bibliotecario)');
  console.log('  maria.garcia   / Socio1234     (rol: socio)');
  console.log('  juan.perez     / Socio1234     (rol: socio, con multa pendiente)');
  closeDb();
}

seed().catch((error) => {
  console.error('Error al ejecutar el seed:', error);
  closeDb();
  process.exit(1);
});

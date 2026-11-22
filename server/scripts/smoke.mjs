/**
 * Prueba de humo de extremo a extremo contra la API en ejecución.
 * Uso: node scripts/smoke.mjs   (requiere el servidor levantado en :4000)
 */
const BASE = process.env.API_URL ?? 'http://localhost:4000';
const results = [];

async function step(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail ?? '' });
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    results.push({ name, ok: false, detail: error.message });
    console.log(`  ✗ ${name} — ${error.message}`);
  }
}

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.ok) {
    throw new Error(`${res.status} ${payload?.message ?? 'sin mensaje'}`);
  }
  return payload.data;
}

async function main() {
  console.log('\n=== Prueba de humo · Sistema de Gestión de Biblioteca ===\n');

  let adminToken;
  let staffToken;
  let memberToken;
  let loanId;
  let reservationId;

  await step('GET /api/health', async () => {
    const data = await call('GET', '/api/health');
    return `status=${data.status}`;
  });

  await step('Login de administrador', async () => {
    const data = await call('POST', '/api/auth/login', {
      body: { username: 'admin', password: 'Admin1234' },
    });
    adminToken = data.token;
    return `rol=${data.user.role}`;
  });

  await step('Login de bibliotecario', async () => {
    const data = await call('POST', '/api/auth/login', {
      body: { username: 'bibliotecario', password: 'Biblio1234' },
    });
    staffToken = data.token;
    return `rol=${data.user.role}`;
  });

  await step('Login de socio', async () => {
    const data = await call('POST', '/api/auth/login', {
      body: { username: 'maria.garcia', password: 'Socio1234' },
    });
    memberToken = data.token;
    return `rol=${data.user.role}`;
  });

  await step('Rechazo de contraseña inválida', async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'claveIncorrecta' }),
    });
    if (res.status !== 401) throw new Error(`se esperaba 401 y llegó ${res.status}`);
    return '401 correcto';
  });

  await step('Consulta del catálogo (socio)', async () => {
    const data = await call('GET', '/api/books?search=soledad', { token: memberToken });
    return `${data.length} resultado(s)`;
  });

  await step('Reserva de un libro sin disponibilidad', async () => {
    // El seed deja el título "El principito" totalmente prestado.
    const books = await call('GET', '/api/books?available=false&pageSize=50', { token: staffToken });
    const target = books.find((b) => b.total_copies > 0 && b.available_copies === 0);
    if (!target) throw new Error('no hay títulos agotados en el seed');
    const data = await call('POST', '/api/reservations', {
      token: memberToken,
      body: { bookId: target.id },
    });
    reservationId = data.id;
    return `"${target.title}" → ${data.status}`;
  });

  await step('Reserva duplicada rechazada (409)', async () => {
    const books = await call('GET', '/api/books?available=false&pageSize=50', { token: staffToken });
    const target = books.find((b) => b.total_copies > 0 && b.available_copies === 0);
    const res = await fetch(`${BASE}/api/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` },
      body: JSON.stringify({ bookId: target.id }),
    });
    if (res.status !== 409) throw new Error(`se esperaba 409 y llegó ${res.status}`);
    return '409 correcto';
  });

  await step('Registro de préstamo (bibliotecario)', async () => {
    const books = await call('GET', '/api/books?available=true&pageSize=50', {
      token: staffToken,
    });
    const book = books.find((b) => b.available_copies > 0);
    const copies = await call('GET', `/api/books/${book.id}/copies`, { token: staffToken });
    const copy = copies.find((c) => c.status === 'available');
    const members = await call('GET', '/api/users?role=member&status=active', {
      token: adminToken,
    });
    const target = members.find((m) => m.username === 'maria.garcia');
    const loan = await call('POST', '/api/loans', {
      token: staffToken,
      body: { copyId: copy.id, memberId: target.id },
    });
    loanId = loan.id;
    return `préstamo #${loan.id}, vence ${loan.due_date}`;
  });

  await step('Préstamo duplicado rechazado (422)', async () => {
    const loans = await call('GET', '/api/loans?status=active', { token: staffToken });
    const current = loans.find((l) => l.id === loanId);
    const res = await fetch(`${BASE}/api/loans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({ copyId: current.copy_id, memberId: current.user_id }),
    });
    if (res.status !== 422) throw new Error(`se esperaba 422 y llegó ${res.status}`);
    return '422 correcto';
  });

  await step('Socio no puede registrar préstamos (403)', async () => {
    const res = await fetch(`${BASE}/api/loans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` },
      body: JSON.stringify({ copyId: 1, memberId: 1 }),
    });
    if (res.status !== 403) throw new Error(`se esperaba 403 y llegó ${res.status}`);
    return '403 correcto';
  });

  await step('Devolución del préstamo', async () => {
    const data = await call('POST', `/api/loans/${loanId}/return`, { token: staffToken });
    return `estado=${data.loan.status}, multa=${data.fineAmount}`;
  });

  await step('Reporte de resumen (admin)', async () => {
    const data = await call('GET', '/api/reports/summary', { token: adminToken });
    return `libros=${data.books}, activos=${data.activeLoans}, vencidos=${data.overdueLoans}`;
  });

  await step('Auditoría registrada (admin)', async () => {
    const data = await call('GET', '/api/audit?limit=10', { token: adminToken });
    return `${data.length} eventos recientes`;
  });

  await step('Socio sin acceso a auditoría (403)', async () => {
    const res = await fetch(`${BASE}/api/audit`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    if (res.status !== 403) throw new Error(`se esperaba 403 y llegó ${res.status}`);
    return '403 correcto';
  });

  await step('Cancelación de reserva', async () => {
    if (!reservationId) throw new Error('no se creó reserva previa');
    const data = await call('POST', `/api/reservations/${reservationId}/cancel`, {
      token: memberToken,
    });
    return `estado=${data.status}`;
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\nResultado: ${results.length - failed.length}/${results.length} pasos correctos.`);
  if (failed.length > 0) {
    console.log('Pasos fallidos:');
    failed.forEach((f) => console.log(`  - ${f.name}: ${f.detail}`));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Error inesperado en la prueba de humo:', error);
  process.exitCode = 1;
});

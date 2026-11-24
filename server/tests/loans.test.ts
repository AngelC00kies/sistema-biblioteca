import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { addDays, todayISO } from '../src/utils/date.js';
import {
  app,
  asLibrarian,
  asMember,
  insertFineRow,
  insertLoanRow,
  login,
  useTestDatabase,
} from './helpers.js';

useTestDatabase();

describe('POST /api/loans', () => {
  it('FC-PRE-01: el bibliotecario registra un préstamo y el ejemplar pasa a prestado', async () => {
    const res = await request(app)
      .post('/api/loans')
      .set('Authorization', await asLibrarian())
      .send({ copyId: 1, memberId: 3 });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('active');
    expect(res.body.data.book_title).toBe('Cien años de soledad');
    expect(res.body.data.days_late).toBe(0);

    const copies = await request(app)
      .get('/api/books/1/copies')
      .set('Authorization', await asLibrarian());

    const loaned = copies.body.data.find((c: { id: number }) => c.id === 1);
    expect(loaned.status).toBe('loaned');
  });

  it('FC-PRE-02: no permite prestar un ejemplar que ya está prestado', async () => {
    const res = await request(app)
      .post('/api/loans')
      .set('Authorization', await asLibrarian())
      .send({ copyId: 1, memberId: 4 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('BUSINESS_RULE_VIOLATION');
  });

  it('RB-PRE-03: un socio no puede registrar préstamos', async () => {
    const res = await request(app)
      .post('/api/loans')
      .set('Authorization', await asMember())
      .send({ copyId: 2, memberId: 3 });

    expect(res.status).toBe(403);
  });

  it('FC-PRE-04: rechaza una fecha de devolución no futura', async () => {
    const res = await request(app)
      .post('/api/loans')
      .set('Authorization', await asLibrarian())
      .send({ copyId: 2, memberId: 3, dueDate: '2020-01-01' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('devolución');
  });

  it('FC-PRE-05: bloquea el préstamo a un socio con multas pendientes', async () => {
    // Préstamo histórico ya devuelto + multa impaga del socio 4.
    const historicalLoan = insertLoanRow({
      copyId: 4,
      userId: 4,
      dueDate: addDays(todayISO(), -30),
      returnDate: addDays(todayISO(), -31),
      status: 'returned',
    });
    insertFineRow(historicalLoan, 4, 3.5);

    const res = await request(app)
      .post('/api/loans')
      .set('Authorization', await asLibrarian())
      .send({ copyId: 6, memberId: 4 });

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('multas pendientes');
  });

  it('FC-PRE-06: respeta el límite máximo de préstamos activos por socio', async () => {
    // El socio 3 ya tiene 1 préstamo activo (copy 1); se completan los 5 permitidos.
    for (const copyId of [2, 3, 4, 5]) {
      insertLoanRow({ copyId, userId: 3, dueDate: addDays(todayISO(), 14) });
    }

    const res = await request(app)
      .post('/api/loans')
      .set('Authorization', await asLibrarian())
      .send({ copyId: 6, memberId: 3 });

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('límite');
  });

  it('RB-PRE-07: el socio solo ve sus propios préstamos', async () => {
    const res = await request(app).get('/api/loans/my').set('Authorization', await asMember());

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(
      res.body.data.every((loan: { user_id: number }) => loan.user_id === 3),
    ).toBe(true);
  });

  it('FC-PRE-08: el bibliotecario consulta el total de préstamos con filtros', async () => {
    const res = await request(app)
      .get('/api/loans')
      .query({ status: 'active' })
      .set('Authorization', await asLibrarian());

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(5);
  });
});

describe('POST /api/loans/:id/return', () => {
  it('FC-DEV-09: registra una devolución en tiempo sin generar multa', async () => {
    const loans = await request(app)
      .get('/api/loans')
      .query({ status: 'active' })
      .set('Authorization', await asLibrarian());
    const target = loans.body.data.find((l: { copy_id: number }) => l.copy_id === 1);

    const res = await request(app)
      .post(`/api/loans/${target.id}/return`)
      .set('Authorization', await asLibrarian());

    expect(res.status).toBe(200);
    expect(res.body.data.loan.status).toBe('returned');
    expect(res.body.data.fineAmount).toBe(0);

    const copies = await request(app)
      .get('/api/books/1/copies')
      .set('Authorization', await asLibrarian());
    const returned = copies.body.data.find((c: { id: number }) => c.id === 1);
    expect(returned.status).toBe('available');
  });

  it('FC-DEV-10: no permite devolver dos veces el mismo préstamo', async () => {
    const loans = await request(app)
      .get('/api/loans')
      .query({ status: 'returned' })
      .set('Authorization', await asLibrarian());
    const target = loans.body.data[0];

    const res = await request(app)
      .post(`/api/loans/${target.id}/return`)
      .set('Authorization', await asLibrarian());

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('ya fue devuelto');
  });

  it('FC-DEV-11: calcula la multa proporcional a los días de atraso', async () => {
    const overdueLoan = insertLoanRow({
      copyId: 7,
      userId: 4,
      dueDate: addDays(todayISO(), -10),
    });

    const res = await request(app)
      .post(`/api/loans/${overdueLoan}/return`)
      .set('Authorization', await asLibrarian());

    expect(res.status).toBe(200);
    expect(res.body.data.fineAmount).toBe(5); // 10 días × 0.50
  });

  it('FC-DEV-12: la multa generada queda registrada como pendiente', async () => {
    const { token } = await login('debtor', 'Member1234');

    const res = await request(app).get('/api/fines/my').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.meta.summary.count).toBeGreaterThanOrEqual(2);
    expect(res.body.meta.summary.total).toBeGreaterThan(0);
  });

  it('RB-DEV-13: un socio no puede registrar devoluciones', async () => {
    const loans = await request(app)
      .get('/api/loans')
      .query({ status: 'active' })
      .set('Authorization', await asLibrarian());
    const target = loans.body.data[0];

    const res = await request(app)
      .post(`/api/loans/${target.id}/return`)
      .set('Authorization', await asMember());

    expect(res.status).toBe(403);
  });
});

describe('GET /api/loans/:id', () => {
  it('RB-PRE-14: un socio no puede leer el detalle de un préstamo ajeno', async () => {
    const foreignLoan = insertLoanRow({
      copyId: 6,
      userId: 4,
      dueDate: addDays(todayISO(), 14),
    });

    const denied = await request(app)
      .get(`/api/loans/${foreignLoan}`)
      .set('Authorization', await asMember());

    expect(denied.status).toBe(403);

    const own = await request(app)
      .get('/api/loans')
      .query({ status: 'active' })
      .set('Authorization', await asLibrarian());
    const mine = own.body.data.find((l: { user_id: number }) => l.user_id === 3);

    const allowed = await request(app)
      .get(`/api/loans/${mine.id}`)
      .set('Authorization', await asMember());

    expect(allowed.status).toBe(200);
    expect(allowed.body.data.user_id).toBe(3);
  });
});

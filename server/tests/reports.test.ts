import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { addDays, todayISO } from '../src/utils/date.js';
import {
  app,
  asAdmin,
  asLibrarian,
  asMember,
  insertLoanRow,
  useTestDatabase,
} from './helpers.js';

useTestDatabase();

describe('GET /api/health', () => {
  it('RP-SAL-01: responde sin autenticación para el monitoreo', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.data ?? res.body).toBeTruthy();
    expect(res.body.status ?? res.body.data?.status).toBe('up');
  });
});

describe('GET /api/reports/*', () => {
  it('RB-REP-02: un socio no tiene acceso a los reportes', async () => {
    const res = await request(app)
      .get('/api/reports/summary')
      .set('Authorization', await asMember());

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('SE-REP-03: los reportes exigen autenticación', async () => {
    const res = await request(app).get('/api/reports/summary');
    expect(res.status).toBe(401);
  });

  it('FC-REP-04: el administrador obtiene el resumen operativo', async () => {
    const res = await request(app)
      .get('/api/reports/summary')
      .set('Authorization', await asAdmin());

    expect(res.status).toBe(200);
    expect(res.body.data.books).toBe(2);
    expect(res.body.data.copies).toBe(7);
    expect(res.body.data.availableCopies).toBe(7);
    expect(res.body.data.members).toBe(4);
    expect(res.body.data.activeLoans).toBe(0);
    expect(Array.isArray(res.body.data.loansByMonth)).toBe(true);
  });

  it('FC-REP-05: el bibliotecario también puede consultar reportes', async () => {
    const res = await request(app)
      .get('/api/reports/summary')
      .set('Authorization', await asLibrarian());

    expect(res.status).toBe(200);
  });

  it('FC-REP-06: ranking de libros más prestados', async () => {
    insertLoanRow({
      copyId: 1,
      userId: 3,
      dueDate: addDays(todayISO(), 14),
      returnDate: addDays(todayISO(), -1),
      status: 'returned',
    });
    insertLoanRow({
      copyId: 5,
      userId: 4,
      dueDate: addDays(todayISO(), 14),
      returnDate: addDays(todayISO(), -1),
      status: 'returned',
    });
    insertLoanRow({
      copyId: 2,
      userId: 4,
      dueDate: addDays(todayISO(), 14),
    });

    const res = await request(app)
      .get('/api/reports/top-books')
      .query({ limit: 5 })
      .set('Authorization', await asLibrarian());

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('loan_count');
    expect(res.body.data[0].loan_count).toBeGreaterThanOrEqual(1);
  });

  it('FC-REP-07: listado de préstamos vencidos ordenado por atraso', async () => {
    insertLoanRow({
      copyId: 6,
      userId: 3,
      dueDate: addDays(todayISO(), -4),
    });

    const res = await request(app)
      .get('/api/reports/overdue')
      .set('Authorization', await asLibrarian());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].days_late).toBe(4);
    expect(res.body.data[0].member_name).toBe('Member Test');
  });

  it('FC-REP-08: el resumen refleja el préstamo vencido registrado', async () => {
    const res = await request(app)
      .get('/api/reports/summary')
      .set('Authorization', await asAdmin());

    expect(res.body.data.overdueLoans).toBe(1);
    expect(res.body.data.activeLoans).toBe(2);
  });
});

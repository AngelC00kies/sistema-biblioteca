import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { addDays, todayISO } from '../src/utils/date.js';
import {
  app,
  asLibrarian,
  insertFineRow,
  insertLoanRow,
  login,
  useTestDatabase,
} from './helpers.js';

useTestDatabase();

let firstFineId = 0;
let secondFineId = 0;

async function memberToken(): Promise<string> {
  return (await login('member', 'Member1234')).token;
}

async function debtorToken(): Promise<string> {
  return (await login('debtor', 'Member1234')).token;
}

describe('GET /api/fines', () => {
  it('MUL-01: prepara dos multas pendientes de socios distintos', () => {
    const loanA = insertLoanRow({
      copyId: 1,
      userId: 3,
      dueDate: addDays(todayISO(), -5),
      returnDate: addDays(todayISO(), -2),
      status: 'returned',
    });
    const loanB = insertLoanRow({
      copyId: 2,
      userId: 4,
      dueDate: addDays(todayISO(), -8),
      returnDate: addDays(todayISO(), -6),
      status: 'returned',
    });

    firstFineId = insertFineRow(loanA, 3, 2.5);
    secondFineId = insertFineRow(loanB, 4, 4);

    expect(firstFineId).toBeGreaterThan(0);
    expect(secondFineId).toBeGreaterThan(0);
  });

  it('MUL-02: el socio ve solo sus multas y el total pendiente', async () => {
    const res = await request(app)
      .get('/api/fines/my')
      .set('Authorization', `Bearer ${await memberToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.summary).toEqual({ count: 1, total: 2.5 });
    expect(res.body.data[0]).not.toHaveProperty('password_hash');
  });

  it('RB-MUL-03: un socio no puede listar el padrón completo de multas', async () => {
    const res = await request(app)
      .get('/api/fines')
      .set('Authorization', `Bearer ${await memberToken()}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('MUL-04: el bibliotecario consulta todas las multas con filtro de estado', async () => {
    const res = await request(app)
      .get('/api/fines')
      .query({ status: 'pending' })
      .set('Authorization', await asLibrarian());

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.data[0]).toHaveProperty('member_name');
  });
});

describe('POST /api/fines/:id/pay', () => {
  it('MUL-05: el socio liquida su propia multa', async () => {
    const res = await request(app)
      .post(`/api/fines/${firstFineId}/pay`)
      .set('Authorization', `Bearer ${await memberToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('paid');
    expect(res.body.data.paid_at).toBeTruthy();
  });

  it('MUL-06: no permite pagar dos veces la misma multa', async () => {
    const res = await request(app)
      .post(`/api/fines/${firstFineId}/pay`)
      .set('Authorization', `Bearer ${await memberToken()}`);

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('ya fue pagada');
  });

  it('RB-MUL-07: un socio no puede pagar la multa de otro', async () => {
    const res = await request(app)
      .post(`/api/fines/${secondFineId}/pay`)
      .set('Authorization', `Bearer ${await memberToken()}`);

    expect(res.status).toBe(403);
  });

  it('MUL-08: el bibliotecario liquida en ventanilla una multa ajena', async () => {
    const res = await request(app)
      .post(`/api/fines/${secondFineId}/pay`)
      .set('Authorization', await asLibrarian());

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('paid');
  });

  it('MUL-09: devuelve 404 ante una multa inexistente', async () => {
    const res = await request(app)
      .post('/api/fines/99999/pay')
      .set('Authorization', await asLibrarian());

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { addDays, todayISO } from '../src/utils/date.js';
import {
  app,
  asLibrarian,
  asMember,
  insertLoanRow,
  login,
  useTestDatabase,
} from './helpers.js';
import { getDb } from '../src/db/connection.js';

useTestDatabase();

/** Pone el libro 2 (3 ejemplares) totalmente prestado para habilitar reservas. */
function sellOutBookTwo(): void {
  for (const copyId of [5, 6, 7]) {
    insertLoanRow({ copyId, userId: 3, dueDate: addDays(todayISO(), 14) });
    // El estado del ejemplar debe reflejar el préstamo (regla de negocio).
    getDb().prepare(`UPDATE copies SET status = 'loaned' WHERE id = ?`).run(copyId);
  }
}

async function memberToken(): Promise<string> {
  return (await login('member', 'Member1234')).token;
}

async function debtorToken(): Promise<string> {
  return (await login('debtor', 'Member1234')).token;
}

describe('POST /api/reservations', () => {
  it('FC-RES-01: el socio reserva un libro sin ejemplares disponibles', async () => {
    sellOutBookTwo();

    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${await debtorToken()}`)
      .send({ bookId: 2 });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.book_title).toBe('Clean Code');
  });

  it('FC-RES-02: impide reservar dos veces el mismo libro', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${await debtorToken()}`)
      .send({ bookId: 2 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
  });

  it('FC-RES-03: no permite reservar un libro con ejemplares disponibles', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${await debtorToken()}`)
      .send({ bookId: 1 });

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('disponibles');
  });

  it('FC-RES-04: no permite reservar un libro sin ejemplares registrados', async () => {
    const created = await request(app)
      .post('/api/books')
      .set('Authorization', await asLibrarian())
      .send({ isbn: '978-1-55-555555-5', title: 'Libro sin ejemplares', author: 'Autor sin obra' });

    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${await debtorToken()}`)
      .send({ bookId: created.body.data.id });

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('ejemplares');
  });

  it('SE-RES-05: exige autenticación para reservar', async () => {
    const res = await request(app).post('/api/reservations').send({ bookId: 2 });
    expect(res.status).toBe(401);
  });
});

describe('Gestión de reservas', () => {
  it('FC-RES-06: el socio ve únicamente sus propias reservas', async () => {
    const res = await request(app)
      .get('/api/reservations/my')
      .set('Authorization', `Bearer ${await memberToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('RB-RES-07: el bibliotecario consulta todas las reservas', async () => {
    const res = await request(app)
      .get('/api/reservations')
      .set('Authorization', await asLibrarian());

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
  });

  it('RB-RES-08: un socio no puede cancelar la reserva de otro', async () => {
    const all = await request(app)
      .get('/api/reservations')
      .set('Authorization', await asLibrarian());
    const target = all.body.data[0];

    const res = await request(app)
      .post(`/api/reservations/${target.id}/cancel`)
      .set('Authorization', `Bearer ${await memberToken()}`);

    expect(res.status).toBe(403);
  });

  it('FC-RES-09: el propietario cancela su reserva', async () => {
    const all = await request(app)
      .get('/api/reservations')
      .set('Authorization', await asLibrarian());
    const target = all.body.data.find(
      (r: { user_id: number; status: string }) => r.user_id === 4 && r.status === 'pending',
    );

    const res = await request(app)
      .post(`/api/reservations/${target.id}/cancel`)
      .set('Authorization', `Bearer ${await debtorToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
  });

  it('FC-RES-10: una reserva cerrada no admite nuevas acciones', async () => {
    const all = await request(app)
      .get('/api/reservations')
      .set('Authorization', await asLibrarian());
    const target = all.body.data.find((r: { status: string }) => r.status === 'cancelled');

    const res = await request(app)
      .post(`/api/reservations/${target.id}/cancel`)
      .set('Authorization', `Bearer ${await debtorToken()}`);

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('cerrada');
  });

  it('RB-RES-11: un socio no puede marcar una reserva como entregada', async () => {
    const all = await request(app)
      .get('/api/reservations')
      .set('Authorization', await asLibrarian());
    const target = all.body.data[0];

    const res = await request(app)
      .post(`/api/reservations/${target.id}/fulfill`)
      .set('Authorization', `Bearer ${await memberToken()}`);

    expect(res.status).toBe(403);
  });

  it('FC-RES-12: al devolver un libro con reserva, la reserva pasa a "ready"', async () => {
    // 1) Se prestan los 4 ejemplares del libro 1 para dejarlo sin disponibilidad.
    const copies = await request(app)
      .get('/api/books/1/copies')
      .set('Authorization', await asLibrarian());

    const loanIds: number[] = [];
    for (const copy of copies.body.data as { id: number; status: string }[]) {
      if (copy.status !== 'available') continue;
      const loan = await request(app)
        .post('/api/loans')
        .set('Authorization', await asLibrarian())
        .send({ copyId: copy.id, memberId: 4 });
      expect(loan.status).toBe(201);
      loanIds.push(loan.body.data.id as number);
    }
    expect(loanIds).toHaveLength(4);

    // 2) Con el libro agotado, otro socio puede reservarlo.
    const created = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${await memberToken()}`)
      .send({ bookId: 1 });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('pending');

    // 3) Al devolver un ejemplar, la reserva más antigua queda lista para entrega.
    const returned = await request(app)
      .post(`/api/loans/${loanIds[0]}/return`)
      .set('Authorization', await asLibrarian());
    expect(returned.status).toBe(200);

    const updated = await request(app)
      .get('/api/reservations/my')
      .set('Authorization', `Bearer ${await memberToken()}`);

    const reservation = updated.body.data.find(
      (r: { id: number }) => r.id === created.body.data.id,
    );
    expect(reservation.status).toBe('ready');
  });
});

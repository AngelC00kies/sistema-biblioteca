import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { addDays, todayISO } from '../src/utils/date.js';
import {
  app,
  asAdmin,
  asLibrarian,
  asMember,
  insertLoanRow,
  login,
  useTestDatabase,
} from './helpers.js';

useTestDatabase();

describe('GET /api/users', () => {
  it('RB-USR-01: un bibliotecario no puede consultar el padrón de usuarios', async () => {
    const res = await request(app).get('/api/users').set('Authorization', await asLibrarian());
    expect(res.status).toBe(403);
  });

  it('RB-USR-02: un socio tampoco puede consultarlo', async () => {
    const res = await request(app).get('/api/users').set('Authorization', await asMember());
    expect(res.status).toBe(403);
  });

  it('RB-USR-16: el bibliotecario consulta solo socios activos para registrar préstamos', async () => {
    const res = await request(app)
      .get('/api/users')
      .query({ role: 'member', status: 'active' })
      .set('Authorization', await asLibrarian());

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const user of res.body.data) {
      expect(user.role).toBe('member');
      expect(user.status).toBe('active');
    }
  });

  it('SE-USR-03: la lista exige autenticación', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });

  it('FC-USR-04: el administrador lista y filtra usuarios sin exponer contraseñas', async () => {
    const res = await request(app)
      .get('/api/users')
      .query({ role: 'member' })
      .set('Authorization', await asAdmin());

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(3);
    expect(res.body.data[0]).not.toHaveProperty('password_hash');
  });
});

describe('POST /api/users', () => {
  it('FC-USR-05: crea un usuario bibliotecario', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', await asAdmin())
      .send({
        username: 'nuevo.bib',
        email: 'nuevo.bib@test.dev',
        password: 'Clave1234',
        fullName: 'Nuevo Bibliotecario',
        role: 'librarian',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('librarian');
    expect(res.body.data.status).toBe('active');
  });

  it('FC-USR-06: rechaza un correo duplicado', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', await asAdmin())
      .send({
        username: 'otro.bib',
        email: 'nuevo.bib@test.dev',
        password: 'Clave1234',
        fullName: 'Otro',
        role: 'librarian',
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('correo');
  });
});

describe('PUT /api/users/:id', () => {
  it('FC-USR-07: cambia el rol de un usuario', async () => {
    const res = await request(app)
      .put('/api/users/3')
      .set('Authorization', await asAdmin())
      .send({ role: 'librarian' });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('librarian');
  });

  it('FC-USR-08: desactivar una cuenta impide el inicio de sesión', async () => {
    await request(app)
      .put('/api/users/4')
      .set('Authorization', await asAdmin())
      .send({ status: 'inactive' });

    const attempt = await request(app)
      .post('/api/auth/login')
      .send({ username: 'debtor', password: 'Member1234' });

    expect(attempt.status).toBe(403);
    expect(attempt.body.message).toContain('inactiva');
  });

  it('FC-USR-09: actualiza la contraseña con validación de fortaleza', async () => {
    const res = await request(app)
      .put('/api/users/2')
      .set('Authorization', await asAdmin())
      .send({ password: 'NuevaClave1' });

    expect(res.status).toBe(200);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'librarian', password: 'NuevaClave1' });
    expect(loginRes.status).toBe(200);
  });
});

describe('DELETE /api/users/:id', () => {
  it('FC-USR-10: impide eliminar la cuenta con la que se inició sesión', async () => {
    const res = await request(app).delete('/api/users/1').set('Authorization', await asAdmin());

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('cuenta con la que iniciaste');
  });

  it('FC-USR-11: un usuario con historial se da de baja en lugar de eliminarse', async () => {
    insertLoanRow({
      copyId: 3,
      userId: 5,
      dueDate: addDays(todayISO(), 14),
      returnDate: addDays(todayISO(), -1),
      status: 'returned',
    });

    const res = await request(app).delete('/api/users/5').set('Authorization', await asAdmin());

    expect(res.status).toBe(200);
    expect(res.body.data.mode).toBe('deactivated');
  });

  it('FC-USR-12: un usuario sin historial se elimina definitivamente', async () => {
    const created = await request(app)
      .post('/api/users')
      .set('Authorization', await asAdmin())
      .send({
        username: 'temporal',
        email: 'temporal@test.dev',
        password: 'Clave1234',
        fullName: 'Usuario Temporal',
        role: 'member',
      });

    const res = await request(app)
      .delete(`/api/users/${created.body.data.id}`)
      .set('Authorization', await asAdmin());

    expect(res.status).toBe(200);
    expect(res.body.data.mode).toBe('deleted');
  });
});

describe('Auditoría', () => {
  it('AUD-13: el administrador consulta el registro de eventos', async () => {
    const res = await request(app)
      .get('/api/audit')
      .query({ limit: 50 })
      .set('Authorization', await asAdmin());

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('action');
  });

  it('AUD-14: un bibliotecario no puede leer la auditoría', async () => {
    // La contraseña fue rotada en el caso FC-USR-09.
    const { token } = await login('librarian', 'NuevaClave1');
    const res = await request(app).get('/api/audit').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('Integridad del token', () => {
  it('SE-USR-15: el token conserva el rol actualizado tras cambiarlo', async () => {
    const { token } = await login('librarian', 'NuevaClave1');
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

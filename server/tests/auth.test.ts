import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, asAdmin, asMember, useTestDatabase } from './helpers.js';

useTestDatabase();

describe('POST /api/auth/login', () => {
  it('FC-AU-01: autentica a un administrador con credenciales válidas', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'Admin1234' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user).not.toHaveProperty('password_hash');
    expect(res.body.data.user.role).toBe('admin');
  });

  it('FC-AU-02: rechaza una contraseña incorrecta con 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'clave-mala' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
    expect(res.body.data).toBeUndefined();
  });

  it('FC-AU-03: rechaza un usuario inexistente sin revelar cuál falló', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'no-existe', password: 'Admin1234' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Usuario o contraseña incorrectos');
  });

  it('FC-AU-04: bloquea el acceso de una cuenta inactiva', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'inactive', password: 'Member1234' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect(res.body.message).toContain('inactiva');
  });

  it('SE-AU-05: valida el formato de las entradas antes de tocar la BD', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'ab', password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
    expect(Array.isArray(res.body.details)).toBe(true);
  });
});

describe('GET /api/auth/me', () => {
  it('SE-AU-06: exige token de autenticación', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('SE-AU-07: rechaza un token manipulado', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer token-falso-para-pruebas');

    expect(res.status).toBe(401);
  });

  it('FC-AU-08: devuelve el perfil del usuario autenticado', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', await asMember());

    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe('member');
    expect(res.body.data).not.toHaveProperty('password_hash');
  });
});

describe('POST /api/auth/register', () => {
  it('RB-AU-09: prohíbe a un socio crear usuarios', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', await asMember())
      .send({
        username: 'nuevo',
        email: 'nuevo@test.dev',
        password: 'Nueva1234',
        fullName: 'Nuevo Usuario',
        role: 'admin',
      });

    expect(res.status).toBe(403);
  });

  it('FC-AU-10: el administrador crea un socio y puede iniciar sesión', async () => {
    const create = await request(app)
      .post('/api/auth/register')
      .set('Authorization', await asAdmin())
      .send({
        username: 'nuevo.socio',
        email: 'nuevo.socio@test.dev',
        password: 'Nueva1234',
        fullName: 'Nuevo Socio',
        role: 'member',
      });

    expect(create.status).toBe(201);
    expect(create.body.data.role).toBe('member');

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nuevo.socio', password: 'Nueva1234' });

    expect(login.status).toBe(200);
  });

  it('FC-AU-11: rechaza un nombre de usuario duplicado', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', await asAdmin())
      .send({
        username: 'admin',
        email: 'otro@test.dev',
        password: 'Otra12345',
        fullName: 'Otro Admin',
        role: 'admin',
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
  });

  it('SE-AU-12: exige contraseña con mayúscula y número', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', await asAdmin())
      .send({
        username: 'debil.user',
        email: 'debil@test.dev',
        password: 'sololetras',
        fullName: 'Usuario Débil',
        role: 'member',
      });

    expect(res.status).toBe(400);
  });
});

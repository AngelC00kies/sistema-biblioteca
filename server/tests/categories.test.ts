import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, asAdmin, asLibrarian, asMember, useTestDatabase } from './helpers.js';

useTestDatabase();

describe('GET /api/categories', () => {
  it('CAT-01: cualquier usuario autenticado puede listar las categorías', async () => {
    const res = await request(app)
      .get('/api/categories')
      .set('Authorization', await asMember());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].name).toBe('Ciencia'); // orden alfabético
  });

  it('CAT-02: la lista exige autenticación', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/categories', () => {
  it('CAT-03: el bibliotecario crea una categoría', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', await asLibrarian())
      .send({ name: 'Filosofía', description: 'Obras de pensamiento' });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeGreaterThan(0);
  });

  it('CAT-04: rechaza nombres duplicados', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', await asLibrarian())
      .send({ name: 'Filosofía' });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('existe una categoría');
  });

  it('RB-CAT-05: un socio no puede crear categorías', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', await asMember())
      .send({ name: 'Deportes' });

    expect(res.status).toBe(403);
  });

  it('CAT-06: valida la longitud mínima del nombre', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', await asLibrarian())
      .send({ name: 'X' });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/categories/:id', () => {
  it('RB-CAT-07: solo un administrador puede eliminar categorías', async () => {
    const res = await request(app)
      .delete('/api/categories/3')
      .set('Authorization', await asLibrarian());

    expect(res.status).toBe(403);
  });

  it('CAT-08: impide eliminar una categoría con libros asociados', async () => {
    const res = await request(app)
      .delete('/api/categories/1')
      .set('Authorization', await asAdmin());

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('libros asociados');
  });

  it('CAT-09: elimina una categoría sin contenido', async () => {
    const res = await request(app)
      .delete('/api/categories/3')
      .set('Authorization', await asAdmin());

    expect(res.status).toBe(200);
    expect(res.body.data.eliminated).toBe(true);
  });

  it('CAT-10: devuelve 404 ante una categoría inexistente', async () => {
    const res = await request(app)
      .delete('/api/categories/999')
      .set('Authorization', await asAdmin());

    expect(res.status).toBe(404);
  });
});

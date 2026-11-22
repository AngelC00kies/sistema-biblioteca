import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, asAdmin, asLibrarian, asMember, useTestDatabase } from './helpers.js';

useTestDatabase();

describe('GET /api/books', () => {
  it('FC-CAT-01: lista el catálogo con paginación y totales', async () => {
    const res = await request(app).get('/api/books').set('Authorization', await asMember());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.data[0]).toHaveProperty('available_copies');
  });

  it('FC-CAT-02: busca por título, autor o ISBN', async () => {
    const res = await request(app)
      .get('/api/books')
      .query({ search: 'clean' })
      .set('Authorization', await asMember());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Clean Code');
  });

  it('FC-CAT-03: filtra por categoría', async () => {
    const res = await request(app)
      .get('/api/books')
      .query({ categoryId: 2 })
      .set('Authorization', await asMember());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].category_name).toBe('Ciencia');
  });

  it('FC-CAT-04: la búsqueda no admite inyección SQL', async () => {
    const res = await request(app)
      .get('/api/books')
      .query({ search: "' OR 1=1 --" })
      .set('Authorization', await asMember());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('SE-CAT-05: exige autenticación para consultar el catálogo', async () => {
    const res = await request(app).get('/api/books');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/books', () => {
  it('FC-CAT-06: el bibliotecario registra un libro nuevo', async () => {
    const res = await request(app)
      .post('/api/books')
      .set('Authorization', await asLibrarian())
      .send({
        isbn: '978-84-9759-278-3',
        title: 'El nombre de la rosa',
        author: 'Umberto Eco',
        publisher: 'Lumen',
        publicationYear: 1980,
        categoryId: 1,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeGreaterThan(0);
  });

  it('FC-CAT-07: rechaza un ISBN duplicado', async () => {
    const res = await request(app)
      .post('/api/books')
      .set('Authorization', await asLibrarian())
      .send({
        isbn: '978-84-376-0494-7',
        title: 'Repetido',
        author: 'Otro',
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
  });

  it('SE-CAT-08: un socio no puede dar de alta libros', async () => {
    const res = await request(app)
      .post('/api/books')
      .set('Authorization', await asMember())
      .send({ isbn: '978-1-11-111111-1', title: 'Hackeo', author: 'X' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('FC-CAT-09: valida el año de publicación', async () => {
    const res = await request(app)
      .post('/api/books')
      .set('Authorization', await asLibrarian())
      .send({ isbn: '978-1-22-222222-2', title: 'Futuro', author: 'X', publicationYear: 3000 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });

  it('FC-CAT-10: rechaza una categoría inexistente', async () => {
    const res = await request(app)
      .post('/api/books')
      .set('Authorization', await asLibrarian())
      .send({ isbn: '978-1-33-333333-3', title: 'Sin categoría', author: 'Autor X', categoryId: 999 });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('categoría');
  });
});

describe('PUT /api/books/:id', () => {
  it('FC-CAT-11: actualiza los datos de un libro', async () => {
    const res = await request(app)
      .put('/api/books/1')
      .set('Authorization', await asAdmin())
      .send({
        isbn: '978-84-376-0494-7',
        title: 'Cien años de soledad (ed. aniversario)',
        author: 'Gabriel García Márquez',
        categoryId: 1,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toContain('aniversario');
  });

  it('FC-CAT-12: devuelve 404 ante un libro inexistente', async () => {
    const res = await request(app)
      .put('/api/books/9999')
      .set('Authorization', await asAdmin())
      .send({ isbn: '978-1-44-444444-4', title: 'Nada', author: 'Autor Fantasma' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

describe('Gestión de ejemplares', () => {
  it('FC-EJ-13: agrega un ejemplar a un libro', async () => {
    const res = await request(app)
      .post('/api/books/1/copies')
      .set('Authorization', await asLibrarian())
      .send({ inventoryCode: 'EJ-001-9', condition: 'good' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('available');
  });

  it('FC-EJ-14: rechaza códigos de inventario duplicados', async () => {
    const res = await request(app)
      .post('/api/books/1/copies')
      .set('Authorization', await asLibrarian())
      .send({ inventoryCode: 'EJ-001-1' });

    expect(res.status).toBe(409);
  });

  it('FC-EJ-15: lista los ejemplares de un libro', async () => {
    const res = await request(app)
      .get('/api/books/1/copies')
      .set('Authorization', await asMember());

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
  });
});

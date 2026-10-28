import request from 'supertest';
import app from '../app';
import { prisma } from '../config/database';

let adminToken: string;

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@agendacaucana.co', password: 'Admin2024!' });

  adminToken = res.body.tokens?.accessToken ?? '';
  expect(adminToken).toBeTruthy();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/eventos (público)', () => {
  it('Devuelve lista paginada', async () => {
    const res = await request(app).get('/api/eventos');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('eventos');
    expect(res.body).toHaveProperty('paginacion');
    expect(Array.isArray(res.body.eventos)).toBe(true);
  });

  it('Filtra por categoría ?categoriaSlug=musica', async () => {
    const res = await request(app).get('/api/eventos?categoriaSlug=musica');
    expect(res.status).toBe(200);
    res.body.eventos.forEach((e: any) => {
      expect(e.categoria.slug).toBe('musica');
    });
  });
});

describe('GET /api/eventos/admin/todos (protegido)', () => {
  it('Sin token → 401', async () => {
    const res = await request(app).get('/api/eventos/admin/todos');
    expect(res.status).toBe(401);
  });

  it('Con token admin → 200', async () => {
    const res = await request(app)
      .get('/api/eventos/admin/todos')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/eventos/admin/pendientes (protegido)', () => {
  it('Con token admin devuelve pendientes', async () => {
    const res = await request(app)
      .get('/api/eventos/admin/pendientes')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
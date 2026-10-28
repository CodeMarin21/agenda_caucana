import request from 'supertest';
import app from '../app';
import { prisma } from '../config/database';

const emailPrueba = `test_${Date.now()}@agendacaucana.co`;
const passwordPrueba = 'Test1234!';
let tokenGuardado: string;

// Registrar el usuario una sola vez antes de todos los tests
beforeAll(async () => {
  await request(app)
    .post('/api/auth/registro')
    .send({ nombre: 'Usuario de Prueba', email: emailPrueba, password: passwordPrueba });

  // Hacer login una sola vez y guardar el token
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: emailPrueba, password: passwordPrueba });

  tokenGuardado = loginRes.body.tokens?.accessToken ?? '';
});

// Limpiar al terminar
afterAll(async () => {
  await prisma.refreshToken.deleteMany({
    where: { usuario: { email: emailPrueba } },
  });
  await prisma.usuario.deleteMany({ where: { email: emailPrueba } });
  await prisma.$disconnect();
});

describe('POST /api/auth/registro', () => {
  it('Rechaza email duplicado → 400', async () => {
    const res = await request(app)
      .post('/api/auth/registro')
      .send({ nombre: 'Duplicado', email: emailPrueba, password: passwordPrueba });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Ya existe');
  });

  it('Rechaza contraseña débil → 400', async () => {
    const res = await request(app)
      .post('/api/auth/registro')
      .send({ nombre: 'Test', email: `otro_${Date.now()}@test.co`, password: '123' });

    expect(res.status).toBe(400);
  });

  it('Registra un usuario nuevo correctamente', async () => {
    const nuevoEmail = `nuevo_${Date.now()}@agendacaucana.co`;
    const res = await request(app)
      .post('/api/auth/registro')
      .send({ nombre: 'Nuevo Usuario', email: nuevoEmail, password: passwordPrueba });

    expect(res.status).toBe(201);
    expect(res.body.usuario).toHaveProperty('id');
    expect(res.body.usuario.email).toBe(nuevoEmail);
    expect(res.body.usuario.rol).toBe('USUARIO');
    expect(res.body.usuario.passwordHash).toBeUndefined();

    // Limpiar este usuario también
    await prisma.usuario.deleteMany({ where: { email: nuevoEmail } });
  });
});

describe('POST /api/auth/login', () => {
  it('Login exitoso devuelve tokens', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: emailPrueba, password: passwordPrueba });

    expect(res.status).toBe(200);
    expect(res.body.tokens).toHaveProperty('accessToken');
    expect(res.body.tokens).toHaveProperty('refreshToken');
  });

  it('Credenciales incorrectas → 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: emailPrueba, password: 'WrongPassword1!' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/perfil', () => {
  it('Sin token → 401', async () => {
    const res = await request(app).get('/api/auth/perfil');
    expect(res.status).toBe(401);
  });

  it('Con token válido devuelve el perfil', async () => {
    // Usar el token guardado en beforeAll — sin hacer login de nuevo
    expect(tokenGuardado).toBeDefined();

    const res = await request(app)
      .get('/api/auth/perfil')
      .set('Authorization', `Bearer ${tokenGuardado}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(emailPrueba);
  });
});
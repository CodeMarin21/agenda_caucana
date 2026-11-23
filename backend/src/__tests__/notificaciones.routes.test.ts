import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';

const mockListarPorUsuario = jest.fn();
const mockMarcarLeida = jest.fn();
const mockMarcarTodasLeidas = jest.fn();

jest.mock('../modules/notificaciones/notificaciones.repository', () => ({
  NotificacionesRepository: jest.fn().mockImplementation(() => ({
    listarPorUsuario: mockListarPorUsuario,
    marcarLeida: mockMarcarLeida,
    marcarTodasLeidas: mockMarcarTodasLeidas,
  })),
}));

import notificacionesRoutes from '../modules/notificaciones/notificaciones.routes';

const app = express();
app.use(express.json(), notificacionesRoutes);

function token(rol: 'ADMIN' | 'ORGANIZADOR', usuarioId: number): string {
  return jwt.sign(
    { rol, usuarioId, type: 'access' },
    process.env.JWT_SECRET!,
    { expiresIn: '5m' }
  );
}

describe('Rutas de notificaciones', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListarPorUsuario.mockResolvedValue({
      notificaciones: [],
      paginacion: { total: 0, pagina: 1, limite: 20, totalPaginas: 0 },
      noLeidas: 0,
    });
    mockMarcarLeida.mockResolvedValue(true);
    mockMarcarTodasLeidas.mockResolvedValue(0);
  });

  it('requiere autenticación y restringe el módulo a organizadores', async () => {
    await request(app).get('/').expect(401);
    await request(app)
      .get('/')
      .set('Authorization', `Bearer ${token('ADMIN', 9)}`)
      .expect(403);
    expect(mockListarPorUsuario).not.toHaveBeenCalled();
  });

  it('obtiene el listado usando el usuario autenticado, no un id enviado por el cliente', async () => {
    const response = await request(app)
      .get('/?pagina=2&limite=10&usuarioId=999')
      .set('Authorization', `Bearer ${token('ORGANIZADOR', 42)}`)
      .expect(200);

    expect(response.body.noLeidas).toBe(0);
    expect(mockListarPorUsuario).toHaveBeenCalledWith(42, 2, 10);
  });

  it('marca como leída únicamente mediante la ruta autenticada del organizador', async () => {
    await request(app)
      .patch('/leidas')
      .set('Authorization', `Bearer ${token('ORGANIZADOR', 42)}`)
      .expect(200);
    expect(mockMarcarTodasLeidas).toHaveBeenCalledWith(42);

    await request(app)
      .patch('/15/leida')
      .set('Authorization', `Bearer ${token('ORGANIZADOR', 42)}`)
      .expect(200);
    expect(mockMarcarLeida).toHaveBeenCalledWith(42, 15);
  });
});

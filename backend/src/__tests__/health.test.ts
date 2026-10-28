import request from 'supertest';
import app from '../app';

describe('Health Check', () => {
  it('GET /health → 200 con status OK', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.proyecto).toBe('Agenda Caucana');
  });

  it('GET /ruta-inexistente → 404', async () => {
    const res = await request(app).get('/ruta-que-no-existe');
    expect(res.status).toBe(404);
  });
});
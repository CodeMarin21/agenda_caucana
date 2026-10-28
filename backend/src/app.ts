import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { i18nMiddleware }                    from './middlewares/i18n.middleware';
import { errorHandler, setupUncaughtHandlers } from './middlewares/error.middleware';
import { prisma }                            from './config/database';
import authRoutes                            from './modules/auth/auth.routes';
import eventosRoutes                         from './modules/eventos/eventos.routes';
import aiRoutes                              from './modules/ai/ai.routes';
import categoriasRoutes                      from './modules/categorias/categorias.routes';
import ciudadesRoutes                        from './modules/ciudades/ciudades.routes';
import organizadoresRoutes                   from './modules/organizadores/organizadores.routes';
import suscripcionesRoutes                   from './modules/usuarios/usuarios.routes';
import { eventoAprobadoSubject }             from './patterns/observer/EventoAprobadoSubject';
import { NotificacionSuscriptoresObserver }  from './modules/notificaciones/notificaciones.service';
import gamificacionRoutes                    from './modules/gamificacion/gamificacion.routes';
setupUncaughtHandlers();
import uploadRoutes from './modules/upload/upload.routes';
import negociosRoutes from './modules/negocios/negocios.routes';

const app = express();

// ── 0. Orígenes permitidos (dev + prod) ─────────────────────────
// Lista blanca reutilizable. En dev acepta localhost y 127.0.0.1 en
// cualquier puerto (para que funcione sin importar el servidor de
// archivos que uses). En prod usa solo lo que venga en FRONTEND_URL.
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5000';
const ES_DEV = process.env.NODE_ENV !== 'production';

// ── 1. Trust proxy ──────────────────────────────────────────────
// Railway/Fly/Heroku están detrás de un proxy inverso. Sin esta línea,
// req.ip devuelve la IP del proxy (misma para todos), lo que rompe el
// rate-limiting por IP y falsea los logs. `1` = confiar en el primer proxy.
app.set('trust proxy', 1);

// ── 2. Helmet con políticas cross-origin correctas para API ─────
// Por defecto, Helmet bloquea cross-origin. Como el frontend vive en
// otro dominio (Netlify/Vercel en prod, localhost:5000 en dev),
// hay que relajar esas dos políticas sin desactivar la seguridad CSP.
const CSP_CONNECT_SRC = ES_DEV
  ? ["'self'", 'http://localhost:5000', 'http://127.0.0.1:5000', FRONTEND_URL]
  : ["'self'", FRONTEND_URL];

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:      ["'self'"],
      scriptSrc:       ["'self'"],
      styleSrc:        ["'self'", "'unsafe-inline'"],
      imgSrc:          ["'self'", 'data:', 'https:'],
      connectSrc:      CSP_CONNECT_SRC,
      fontSrc:         ["'self'", 'https:', 'data:'],
      objectSrc:       ["'none'"],
      frameAncestors:  ["'none'"],
      baseUri:         ["'self'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
  referrerPolicy:            { policy: 'no-referrer' },
}));

// ── 3. CORS ─────────────────────────────────────────────────────
// Acepta:
//   - Sin origin (Postman, curl, apps móviles)
//   - En dev: cualquier http://localhost:PUERTO o http://127.0.0.1:PUERTO
//   - En prod: exactamente el FRONTEND_URL configurado
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    // Dev: acepta localhost y 127.0.0.1 en cualquier puerto
    const esLocalDev = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

    if (ES_DEV && esLocalDev) {
      return callback(null, true);
    }
    if (origin === FRONTEND_URL) {
      return callback(null, true);
    }
    callback(new Error('Bloqueado por la política de CORS'));
  },
  credentials: true,
}));

// ── 4. Rate limit global ────────────────────────────────────────
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      100,
  message:  { error: 'Demasiadas peticiones. Intenta en unos minutos.' },
  standardHeaders: true,
  legacyHeaders:   false,
}));

// ── 5. Body parsers ─────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── 6. i18n ─────────────────────────────────────────────────────
app.use(i18nMiddleware);

// ── 7. Health & Ready ───────────────────────────────────────────
// /health  → liveness: ¿el proceso está vivo? (no toca la BD)
// /ready   → readiness: ¿puede recibir tráfico? (verifica la BD)
app.get('/health', (_req, res) => {
  res.json({
    status:    'OK',
    proyecto:  'Agenda Caucana',
    version:   '1.0.0',
    ambiente:  process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

app.get('/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'READY', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'NOT_READY', timestamp: new Date().toISOString() });
  }
});

// ── 8. Observer de eventos aprobados ────────────────────────────
eventoAprobadoSubject.registrar(new NotificacionSuscriptoresObserver());

// ── 9. Rutas de negocio ─────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/eventos',       eventosRoutes);
app.use('/api/chat',          aiRoutes);
app.use('/api/categorias',    categoriasRoutes);
app.use('/api/ciudades',      ciudadesRoutes);
app.use('/api/organizadores', organizadoresRoutes);
app.use('/api/suscripciones', suscripcionesRoutes);
app.use('/api/gamificacion',  gamificacionRoutes);
app.use('/api/upload',        uploadRoutes);
app.use('/api/negocios',      negociosRoutes);

// ── 10. 404 ─────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.url}` });
});

// ── 11. Error handler (siempre al final) ────────────────────────
app.use(errorHandler);

export default app;
import { prisma } from '../../config/database';
import { Prisma } from '@prisma/client';

export class GamificacionRepository {
  // ── Rutas ──────────────────────────────────────────────
  async findRutasActivas() {
    return prisma.ruta.findMany({
      where: { activa: true },
      include: {
        puntos: {
          orderBy: { orden: 'asc' },
          include: {
            lugar: {
              select: {
                id: true,
                nombre: true,
                direccion: true,
                latitud: true,
                longitud: true,
                radioMetros: true,
              },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  async findRutaById(id: number) {
    return prisma.ruta.findUnique({
      where: { id },
      include: {
        puntos: {
          orderBy: { orden: 'asc' },
          include: {
            lugar: {
              select: {
                id: true,
                nombre: true,
                direccion: true,
                descripcion: true,
                latitud: true,
                longitud: true,
                radioMetros: true,
              },
            },
          },
        },
      },
    });
  }

  // ── Progreso del jugador en una ruta ──────────────────
  async findProgresosByJugador(jugadorId: number) {
    return prisma.progresoRuta.findMany({
      where: { jugadorId },
    });
  }

  async findProgresoRuta(jugadorId: number, rutaId: number) {
    return prisma.progresoRuta.findUnique({
      where: { jugadorId_rutaId: { jugadorId, rutaId } },
    });
  }

  async upsertProgresoRuta(
    tx: Prisma.TransactionClient,
    jugadorId: number,
    rutaId: number,
    porcentaje: number,
    completada: boolean
  ) {
    return tx.progresoRuta.upsert({
      where: { jugadorId_rutaId: { jugadorId, rutaId } },
      create: { jugadorId, rutaId, porcentaje, completada },
      update: { porcentaje, completada },
    });
  }

  // ── Jugador ────────────────────────────────────────────
  async findJugadorByUsuarioId(usuarioId: number) {
    return prisma.jugador.findUnique({
      where: { usuarioId },
      include: {
        usuario: {
          select: {
            id: true,
            username: true,
            nombre: true,
          },
        },
      },
    });
  }

  async findJugadorById(jugadorId: number) {
    return prisma.jugador.findUnique({
      where: { id: jugadorId },
      include: {
        usuario: {
          select: { username: true, nombre: true },
        },
      },
    });
  }

  // ── Lugar / Punto de interés ─────────────────────────
  async findLugarParaCheckIn(lugarId: number) {
    return prisma.lugar.findFirst({
      where: { id: lugarId, activo: true },
      select: {
        id: true,
        nombre: true,
        latitud: true,
        longitud: true,
        radioMetros: true,
      },
    });
  }

  // ── Visitas ────────────────────────────────────────────
  async findVisitaEnSemana(jugadorId: number, lugarId: number, semanaIso: string) {
    return prisma.visitaJugador.findUnique({
      where: { jugadorId_lugarId_semanaIso: { jugadorId, lugarId, semanaIso } },
    });
  }

  async findPrimeraVisitaHistorica(jugadorId: number, lugarId: number) {
    return prisma.visitaJugador.findFirst({
      where: { jugadorId, lugarId },
      orderBy: { creadoEn: 'asc' },
    });
  }

  async findVisitasByJugador(jugadorId: number) {
    return prisma.visitaJugador.findMany({
      where: { jugadorId },
      select: { lugarId: true, creadoEn: true },
    });
  }

  async countVisitasByJugador(jugadorId: number): Promise<number> {
    return prisma.visitaJugador.count({ where: { jugadorId } });
  }

  /**
   * Cuenta cuántos lugares visitó el jugador, agrupados por categoría de ruta.
   * Se usa para evaluar logros del tipo "visita N iglesias".
   */
  async contarVisitasPorCategoria(jugadorId: number): Promise<Record<string, number>> {
    const visitas = await prisma.visitaJugador.findMany({
      where: { jugadorId },
      include: {
        lugar: {
          include: {
            rutas: {
              include: { ruta: { select: { categoria: true } } },
            },
          },
        },
      },
    });

    const conteo: Record<string, number> = {};
    for (const v of visitas) {
      // Cada lugar puede estar en varias rutas; contamos cada categoría una vez por visita
      const categorias = new Set(
        v.lugar.rutas
          .map((rp) => rp.ruta.categoria)
          .filter((c): c is string => Boolean(c))
      );
      for (const cat of categorias) {
        conteo[cat] = (conteo[cat] ?? 0) + 1;
      }
    }
    return conteo;
  }

  // ── Logros ─────────────────────────────────────────────
  async findLogrosActivos() {
    return prisma.logro.findMany({
      where: { activo: true },
      orderBy: [{ categoria: 'asc' }, { meta: 'asc' }],
    });
  }

  async findLogrosByJugador(jugadorId: number) {
    return prisma.logroJugador.findMany({
      where: { jugadorId },
      include: { logro: true },
      orderBy: { desbloqueadoEn: 'desc' },
    });
  }

  async findLogrosJugadorIds(jugadorId: number): Promise<number[]> {
    const filas = await prisma.logroJugador.findMany({
      where: { jugadorId },
      select: { logroId: true },
    });
    return filas.map((f) => f.logroId);
  }

  // ── Leaderboard ────────────────────────────────────────
  async findTopJugadores(limite = 50) {
    return prisma.jugador.findMany({
      orderBy: [{ puntajeSemanal: 'desc' }, { puntajeTotal: 'desc' }],
      take: limite,
      include: {
        usuario: {
          select: { username: true, nombre: true },
        },
      },
    });
  }

  async findPosicionJugador(jugadorId: number) {
    const jugador = await prisma.jugador.findUnique({
      where: { id: jugadorId },
      select: { puntajeSemanal: true, puntajeTotal: true },
    });
    if (!jugador) return null;

    const arriba = await prisma.jugador.count({
      where: {
        OR: [
          { puntajeSemanal: { gt: jugador.puntajeSemanal } },
          {
            puntajeSemanal: jugador.puntajeSemanal,
            puntajeTotal: { gt: jugador.puntajeTotal },
          },
        ],
      },
    });

    return arriba + 1;
  }

  // ── Leaderboard de temporada ───────────────────────────
  async findTopJugadoresTemporada(limite = 50) {
    return prisma.jugador.findMany({
      where: { puntajeTemporada: { gt: 0 } },
      orderBy: [{ puntajeTemporada: 'desc' }, { puntajeTotal: 'desc' }],
      take: limite,
      include: {
        usuario: { select: { username: true, nombre: true } },
      },
    });
  }

  // ── Temporadas y Hall of Fame ──────────────────────────
  async findTemporadaActiva() {
    return prisma.temporada.findFirst({
      where: { cerrada: false },
      orderBy: { numero: 'desc' },
    });
  }

  async findTemporadasCerradas() {
    return prisma.temporada.findMany({
      where: { cerrada: true },
      orderBy: { numero: 'desc' },
    });
  }

  async findHallOfFameByTemporada(temporadaId: number) {
    return prisma.hallOfFame.findMany({
      where: { temporadaId },
      orderBy: { posicion: 'asc' },
      include: {
        jugador: {
          select: {
            avatarUrl: true,
            nivel: true,
            usuario: { select: { username: true, nombre: true } },
          },
        },
      },
    });
  }
}
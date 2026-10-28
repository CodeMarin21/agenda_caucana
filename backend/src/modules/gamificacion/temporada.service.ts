import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { Logro, Temporada } from '@prisma/client';

const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export class TemporadaService {
  /**
   * Devuelve la temporada activa. Si no existe ninguna abierta,
   * crea la primera con los parámetros actuales.
   */
  async obtenerTemporadaActiva(): Promise<Temporada> {
    const activa = await prisma.temporada.findFirst({
      where: { cerrada: false },
      orderBy: { numero: 'desc' },
    });
    if (activa) return activa;
    return this.crearSiguienteTemporada(1, new Date());
  }

  /**
   * Cierra la temporada activa y abre la siguiente.
   * Toda la operación va en una transacción atómica (RNF4).
   *
   * Pasos:
   *   1. Top 50 por puntajeTemporada
   *   2. Archivar en HallOfFame
   *   3. Crear 3 logros temporales únicos (Campeón / Leyenda / Explorador)
   *   4. Asignar logros a los jugadores correspondientes
   *   5. Reset puntajeTemporada a 0
   *   6. Marcar temporada como cerrada
   *   7. Crear la siguiente temporada
   */
  async cerrarTemporadaActual(): Promise<{ cerrada: Temporada; siguiente: Temporada }> {
    const actual = await this.obtenerTemporadaActiva();

    if (actual.cerrada) {
      throw new Error('La temporada ya está cerrada');
    }

    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Top 50
      const top50 = await tx.jugador.findMany({
        where: { puntajeTemporada: { gt: 0 } },
        orderBy: [{ puntajeTemporada: 'desc' }, { puntajeTotal: 'desc' }],
        take: 50,
        select: {
          id: true,
          puntajeTemporada: true,
        },
      });

      if (top50.length === 0) {
        // Nadie jugó este mes — no archivamos nada pero sí cerramos
        const cerrada = await tx.temporada.update({
          where: { id: actual.id },
          data: { cerrada: true },
        });
        const siguiente = await this.crearSiguienteTemporadaTx(tx, actual.numero + 1, actual.fechaFin);
        return { cerrada, siguiente };
      }

      // Contar visitas de cada uno en esta temporada (por rango de fechas)
      const visitasPorJugador = await tx.visitaJugador.groupBy({
        by: ['jugadorId'],
        where: {
          jugadorId: { in: top50.map((j) => j.id) },
          creadoEn: { gte: actual.fechaInicio, lte: actual.fechaFin },
        },
        _count: { id: true },
      });
      const visitasMap = new Map(visitasPorJugador.map((v) => [v.jugadorId, v._count.id]));

      // 2. Archivar en HallOfFame
      await tx.hallOfFame.createMany({
        data: top50.map((j, idx) => ({
          temporadaId: actual.id,
          jugadorId: j.id,
          posicion: idx + 1,
          puntajeTemporada: j.puntajeTemporada,
          visitasTemporada: visitasMap.get(j.id) ?? 0,
        })),
      });

      // 3. Crear los 3 logros temporales únicos de esta temporada
      const nombreMes = this.nombreMes(actual.fechaFin);

      const logroCampeon = await tx.logro.create({
        data: {
          nombre: `Campeón de Popayán — ${nombreMes}`,
          descripcion: `Obtuviste el 1er lugar en el ranking de ${nombreMes}`,
          icono: '🥇',
          categoria: 'Temporada',
          meta: 1,
          activo: true,
          esTemporal: true,
        },
      });

      const logroLeyenda = await tx.logro.create({
        data: {
          nombre: `Leyenda Urbana — ${nombreMes}`,
          descripcion: `Top 5 del ranking de ${nombreMes}`,
          icono: '🥈',
          categoria: 'Temporada',
          meta: 1,
          activo: true,
          esTemporal: true,
        },
      });

      const logroExplorador = await tx.logro.create({
        data: {
          nombre: `Explorador Destacado — ${nombreMes}`,
          descripcion: `Top 50 del ranking de ${nombreMes}`,
          icono: '🥉',
          categoria: 'Temporada',
          meta: 1,
          activo: true,
          esTemporal: true,
        },
      });

      // 4. Asignar logros según la posición
      const asignaciones: Array<{
        jugadorId: number;
        logroId: number;
        temporadaId: number;
        descripcionExtra: string;
      }> = [];

      top50.forEach((j, idx) => {
        const posicion = idx + 1;
        let logroId: number;
        if (posicion === 1) logroId = logroCampeon.id;
        else if (posicion <= 5) logroId = logroLeyenda.id;
        else logroId = logroExplorador.id;

        asignaciones.push({
          jugadorId: j.id,
          logroId,
          temporadaId: actual.id,
          descripcionExtra: nombreMes,
        });
      });

      await tx.logroJugador.createMany({ data: asignaciones });

      // 5. Reset puntajeTemporada
      await tx.jugador.updateMany({
        data: { puntajeTemporada: 0 },
      });

      // 6. Marcar la temporada como cerrada
      const cerrada = await tx.temporada.update({
        where: { id: actual.id },
        data: { cerrada: true },
      });

      // 7. Crear la siguiente
      const siguiente = await this.crearSiguienteTemporadaTx(
        tx,
        actual.numero + 1,
        actual.fechaFin
      );

      return { cerrada, siguiente };
    });

    logger.info({
      tipo: 'temporadaCerrada',
      temporadaId: resultado.cerrada.id,
      nombre: resultado.cerrada.nombre,
      siguientesTemporadaId: resultado.siguiente.id,
    });

    return resultado;
  }

  async listarTemporadasCerradas(): Promise<Temporada[]> {
    return prisma.temporada.findMany({
      where: { cerrada: true },
      orderBy: { numero: 'desc' },
    });
  }

  async obtenerHallOfFame(temporadaId: number) {
    const temporada = await prisma.temporada.findUnique({
      where: { id: temporadaId },
    });
    if (!temporada) throw new Error('Temporada no encontrada');

    const top = await prisma.hallOfFame.findMany({
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

    return {
      temporada: {
        id: temporada.id,
        numero: temporada.numero,
        nombre: temporada.nombre,
        fechaInicio: temporada.fechaInicio,
        fechaFin: temporada.fechaFin,
      },
      top: top.map((h) => ({
        posicion: h.posicion,
        jugadorId: h.jugadorId,
        username: h.jugador.usuario.username,
        nombre: h.jugador.usuario.nombre,
        avatarUrl: h.jugador.avatarUrl,
        nivel: h.jugador.nivel,
        puntajeTemporada: h.puntajeTemporada,
        visitasTemporada: h.visitasTemporada,
      })),
    };
  }

  // ── Helpers privados ────────────────────────────────────
  private nombreMes(fecha: Date): string {
    return `${MESES_ES[fecha.getMonth()]} ${fecha.getFullYear()}`;
  }

  private async crearSiguienteTemporada(
    numero: number,
    desde: Date
  ): Promise<Temporada> {
    return this.crearSiguienteTemporadaTx(prisma, numero, desde);
  }

  private async crearSiguienteTemporadaTx(
    tx: any,
    numero: number,
    desde: Date
  ): Promise<Temporada> {
    const fechaInicio = new Date(desde);
    fechaInicio.setDate(fechaInicio.getDate() + 1);
    fechaInicio.setHours(0, 0, 0, 0);

    const fechaFin = new Date(fechaInicio);
    fechaFin.setMonth(fechaFin.getMonth() + 1);
    fechaFin.setDate(0); // último día del mes
    fechaFin.setHours(23, 59, 59, 999);

    return tx.temporada.create({
      data: {
        numero,
        nombre: `Temporada ${numero} — ${this.nombreMes(fechaInicio)}`,
        fechaInicio,
        fechaFin,
        cerrada: false,
      },
    });
  }
}
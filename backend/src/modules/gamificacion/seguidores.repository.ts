import { prisma } from '../../config/database';

export type TipoListado = 'seguidores' | 'siguiendo';

// Select reutilizable — expone solo lo necesario para el listado.
// Se declara una sola vez para mantener consistencia.
const USUARIO_PUBLICO_SELECT = {
  id: true,
  username: true,
  nombre: true,
  jugador: {
    select: {
      avatarUrl: true,
      descripcion: true,
      nivel: true,
      puntajeTotal: true,
    },
  },
} as const;

export class SeguidoresRepository {

  // ── Mutaciones ────────────────────────────────────────

  async existeFollow(seguidorId: number, seguidoId: number): Promise<boolean> {
    const f = await prisma.follow.findUnique({
      where: { seguidorId_seguidoId: { seguidorId, seguidoId } },
      select: { id: true },
    });
    return f !== null;
  }

  async crearFollow(seguidorId: number, seguidoId: number) {
    return prisma.follow.create({
      data: { seguidorId, seguidoId },
    });
  }

  async eliminarFollow(seguidorId: number, seguidoId: number) {
    return prisma.follow.deleteMany({
      where: { seguidorId, seguidoId },
    });
  }

  // ── Consultas de usuario ──────────────────────────────

  async buscarUsuarioConJugador(usuarioId: number) {
    return prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        username: true,
        nombre: true,
        rol: true,
        activo: true,
        jugador: {
          select: {
            id: true,
            avatarUrl: true,
            descripcion: true,
            nivel: true,
            puntajeTotal: true,
          },
        },
      },
    });
  }

  // ── Listados (con include fijo → tipado limpio) ───────
  // Cada método tiene su propio `include`, no se parametriza.
  // Razón: Prisma devuelve tipos complejos cuando `include`
  // es dinámico, y TypeScript no puede inferir `f.seguidor`
  // vs `f.seguido` sin casts. Separar los métodos elimina
  // el problema en origen.

  async listarSeguidores(miUsuarioId: number, skip: number, take: number) {
    return prisma.follow.findMany({
      where: { seguidoId: miUsuarioId },
      include: { seguidor: { select: USUARIO_PUBLICO_SELECT } },
      orderBy: { creadoEn: 'desc' },
      skip,
      take,
    });
  }

  async listarSiguiendo(miUsuarioId: number, skip: number, take: number) {
    return prisma.follow.findMany({
      where: { seguidorId: miUsuarioId },
      include: { seguido: { select: USUARIO_PUBLICO_SELECT } },
      orderBy: { creadoEn: 'desc' },
      skip,
      take,
    });
  }

  // ── Contadores ────────────────────────────────────────
  // Usamos count(*) con índice. Claude detectó bien: los
  // índices compuestos con creadoEn ya están en el schema.

  async contarSeguidores(usuarioId: number): Promise<number> {
    return prisma.follow.count({ where: { seguidoId: usuarioId } });
  }

  async contarSiguiendo(usuarioId: number): Promise<number> {
    return prisma.follow.count({ where: { seguidorId: usuarioId } });
  }

  // ── Follows mutuos ────────────────────────────────────
  // Dado un conjunto de IDs (los "otros" de la página actual),
  // devuelve cuáles de ellos también me siguen.
  // Optimización: 1 query en vez de N.

  async idsMutuosCon(miUsuarioId: number, otrosIds: number[]): Promise<Set<number>> {
    if (otrosIds.length === 0) return new Set();
    const mutuos = await prisma.follow.findMany({
      where: {
        seguidorId: miUsuarioId,
        seguidoId: { in: otrosIds },
      },
      select: { seguidoId: true },
    });
    return new Set(mutuos.map((m) => m.seguidoId));
  }
}
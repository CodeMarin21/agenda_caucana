import { SeguidoresRepository, TipoListado } from './seguidores.repository';

const LIMITE_POR_PAGINA = 20;

export class SeguidoresService {
  private repo: SeguidoresRepository;

  constructor(repo?: SeguidoresRepository) {
    this.repo = repo ?? new SeguidoresRepository();
  }

  // ── Seguir ────────────────────────────────────────────
  async seguir(miUsuarioId: number, objetivoUsuarioId: number) {
    if (miUsuarioId === objetivoUsuarioId) {
      throw new Error('No puedes seguirte a ti mismo');
    }

    const objetivo = await this.repo.buscarUsuarioConJugador(objetivoUsuarioId);
    if (!objetivo || !objetivo.activo) {
      throw new Error('Usuario no encontrado');
    }
    if (objetivo.rol !== 'JUGADOR' || !objetivo.jugador) {
      throw new Error('Solo puedes seguir jugadores de Popayán Go');
    }

    const yaSigue = await this.repo.existeFollow(miUsuarioId, objetivoUsuarioId);
    if (yaSigue) {
      throw new Error('Ya sigues a este jugador');
    }

    await this.repo.crearFollow(miUsuarioId, objetivoUsuarioId);

    const totalSeguidores = await this.repo.contarSeguidores(objetivoUsuarioId);

    return {
      mensaje: `Ahora sigues a ${objetivo.nombre ?? objetivo.username}`,
      totalSeguidores,
    };
  }

  // ── Dejar de seguir ───────────────────────────────────
  async dejarDeSeguir(miUsuarioId: number, objetivoUsuarioId: number) {
    const resultado = await this.repo.eliminarFollow(miUsuarioId, objetivoUsuarioId);

    if (resultado.count === 0) {
      return { mensaje: 'No seguías a este jugador' };
    }

    const totalSeguidores = await this.repo.contarSeguidores(objetivoUsuarioId);
    return {
      mensaje: 'Dejaste de seguir a este jugador',
      totalSeguidores,
    };
  }

  // ── Listado (dispatch por tipo) ───────────────────────
  async listar(miUsuarioId: number, tipo: TipoListado, page: number) {
    if (!['seguidores', 'siguiendo'].includes(tipo)) {
      throw new Error('Tipo inválido. Usa "seguidores" o "siguiendo"');
    }
    if (!Number.isInteger(page) || page < 1) {
      throw new Error('Página inválida');
    }

    const skip = (page - 1) * LIMITE_POR_PAGINA;

    if (tipo === 'seguidores') {
      return this.listarSeguidores(miUsuarioId, skip, page);
    }
    return this.listarSiguiendo(miUsuarioId, skip, page);
  }

  // ── Privados ──────────────────────────────────────────

  private async listarSeguidores(miUsuarioId: number, skip: number, page: number) {
    const [total, filas] = await Promise.all([
      this.repo.contarSeguidores(miUsuarioId),
      this.repo.listarSeguidores(miUsuarioId, skip, LIMITE_POR_PAGINA),
    ]);

    const otrosIds = filas.map((f) => f.seguidorId);
    const mutuosSet = await this.repo.idsMutuosCon(miUsuarioId, otrosIds);

    const data = filas.map((f) => ({
      usuarioId: f.seguidorId,
      username: f.seguidor.username,
      nombre: f.seguidor.nombre,
      avatarUrl: f.seguidor.jugador?.avatarUrl ?? null,
      descripcion: f.seguidor.jugador?.descripcion ?? null,
      nivel: f.seguidor.jugador?.nivel ?? 1,
      puntajeTotal: f.seguidor.jugador?.puntajeTotal ?? 0,
      loSigo: mutuosSet.has(f.seguidorId),
      meSigue: true,
      desde: f.creadoEn,
    }));

    return {
      tipo: 'seguidores' as const,
      page,
      total,
      totalPages: Math.ceil(total / LIMITE_POR_PAGINA),
      data,
    };
  }

  private async listarSiguiendo(miUsuarioId: number, skip: number, page: number) {
    const [total, filas] = await Promise.all([
      this.repo.contarSiguiendo(miUsuarioId),
      this.repo.listarSiguiendo(miUsuarioId, skip, LIMITE_POR_PAGINA),
    ]);

    const otrosIds = filas.map((f) => f.seguidoId);
    const mutuosSet = await this.repo.idsMutuosCon(miUsuarioId, otrosIds);

    const data = filas.map((f) => ({
      usuarioId: f.seguidoId,
      username: f.seguido.username,
      nombre: f.seguido.nombre,
      avatarUrl: f.seguido.jugador?.avatarUrl ?? null,
      descripcion: f.seguido.jugador?.descripcion ?? null,
      nivel: f.seguido.jugador?.nivel ?? 1,
      puntajeTotal: f.seguido.jugador?.puntajeTotal ?? 0,
      loSigo: true,
      meSigue: mutuosSet.has(f.seguidoId),
      desde: f.creadoEn,
    }));

    return {
      tipo: 'siguiendo' as const,
      page,
      total,
      totalPages: Math.ceil(total / LIMITE_POR_PAGINA),
      data,
    };
  }

  // ── Público ───────────────────────────────────────────
  async contadores(usuarioId: number) {
    const [seguidores, siguiendo] = await Promise.all([
      this.repo.contarSeguidores(usuarioId),
      this.repo.contarSiguiendo(usuarioId),
    ]);
    return { seguidores, siguiendo };
  }
}
import { prisma } from '../../config/database';
import { Prisma } from '@prisma/client';
import { logger } from '../../config/logger';
import { GamificacionRepository } from './gamificacion.repository';
import { LogrosEngine, ContextoLogros } from './logros.engine';
import { ProgresoCalculator } from './progreso.calculator';
import { LeaderboardService } from './leaderboard.service';
import { semanaIsoActual } from './semana.util';
import {
  IValidadorUbicacion,
} from '../../patterns/strategy/IValidadorUbicacion';
import { ValidadorRadioGPS } from '../../patterns/strategy/ValidadorRadioGPS';
import {
  VisitaInput,
  ResultadoVisita,
  LogroDesbloqueado,
  EntradaLeaderboard,
} from './gamificacion.types';

export class GamificacionService {
  constructor(
    private readonly repo: GamificacionRepository = new GamificacionRepository(),
    private readonly logrosEngine: LogrosEngine = new LogrosEngine(),
    private readonly progresoCalc: ProgresoCalculator = new ProgresoCalculator(),
    private readonly leaderboardSvc: LeaderboardService = new LeaderboardService(),
    private readonly validadorUbicacion: IValidadorUbicacion = new ValidadorRadioGPS()
  ) {}

  // ═══════════════════════════════════════════════════════
  // CATÁLOGO DE RUTAS (RF4.4)
  // ═══════════════════════════════════════════════════════
  async listarRutasConProgreso(usuarioId: number) {
    const jugador = await this.repo.findJugadorByUsuarioId(usuarioId);
    if (!jugador) throw new Error('Solo los jugadores pueden ver el catálogo de rutas');

    const [rutas, progresos, visitas] = await Promise.all([
      this.repo.findRutasActivas(),
      this.repo.findProgresosByJugador(jugador.id),
      this.repo.findVisitasByJugador(jugador.id),
    ]);

    const lugaresVisitados = new Set(visitas.map((v) => v.lugarId));
    const progresoMap = new Map(progresos.map((p) => [p.rutaId, p]));

    return rutas.map((ruta) => {
      const puntosTotales = ruta.puntos.length;
      const puntosVisitados = ruta.puntos.filter((p) =>
        lugaresVisitados.has(p.lugarId)
      ).length;

      const pct = this.progresoCalc.calcularPorcentajeRuta(
        puntosVisitados,
        puntosTotales
      );

      const progresoGuardado = progresoMap.get(ruta.id);

      return {
        id: ruta.id,
        nombre: ruta.nombre,
        descripcion: ruta.descripcion,
        colorTema: ruta.colorTema,
        categoria: ruta.categoria,
        puntosTotales,
        puntosVisitados,
        porcentaje: progresoGuardado?.porcentaje ?? pct,
        completada: progresoGuardado?.completada ?? pct === 100,
      };
    });
  }

  async detalleRuta(usuarioId: number, rutaId: number) {
    const jugador = await this.repo.findJugadorByUsuarioId(usuarioId);
    if (!jugador) throw new Error('Solo los jugadores pueden ver rutas');

    const ruta = await this.repo.findRutaById(rutaId);
    if (!ruta || !ruta.activa) throw new Error('Ruta no encontrada');

    const visitas = await this.repo.findVisitasByJugador(jugador.id);
    const lugaresVisitados = new Set(visitas.map((v) => v.lugarId));

    const puntos = ruta.puntos.map((p) => ({
      lugarId: p.lugar.id,
      nombre: p.lugar.nombre,
      direccion: p.lugar.direccion,
      descripcion: p.lugar.descripcion,
      latitud: p.lugar.latitud,
      longitud: p.lugar.longitud,
      radioMetros: p.lugar.radioMetros,
      orden: p.orden,
      visitado: lugaresVisitados.has(p.lugar.id),
    }));

    const puntosVisitados = puntos.filter((p) => p.visitado).length;
    const porcentaje = this.progresoCalc.calcularPorcentajeRuta(
      puntosVisitados,
      puntos.length
    );

    return {
      id: ruta.id,
      nombre: ruta.nombre,
      descripcion: ruta.descripcion,
      colorTema: ruta.colorTema,
      categoria: ruta.categoria,
      porcentaje,
      completada: porcentaje === 100,
      puntos,
    };
  }

  // ═══════════════════════════════════════════════════════
  // CHECK-IN DE VISITA (RF4.5 + RF4.6 + RNF4)
  // ═══════════════════════════════════════════════════════
  async registrarVisita(input: VisitaInput): Promise<ResultadoVisita> {
    const { jugadorId, lugarId, coordenada } = input;

    // 1. Validar existencia del lugar
    const lugar = await this.repo.findLugarParaCheckIn(lugarId);
    if (!lugar) throw new Error('El punto de interés no existe o está inactivo');

    // 2. Validar GPS con Strategy
    const validacion = this.validadorUbicacion.validar(coordenada, lugar);
    if (!validacion.valido) {
      throw new Error(validacion.razon ?? 'No estás dentro del radio permitido');
    }

    // 3. Determinar la semana ISO actual (permite re-visitas semanales)
    const semanaIso = semanaIsoActual();

    // 3.1 ¿Ya visitó este lugar ESTA SEMANA? → bloqueo (idempotencia semanal)
    const visitaEstaSemana = await this.repo.findVisitaEnSemana(
      jugadorId,
      lugarId,
      semanaIso
    );
    if (visitaEstaSemana) {
      throw new Error('Ya registraste una visita en este lugar esta semana');
    }

    // 3.2 ¿Es la primera vez histórica? → define los puntos
    //     10 = primera vez en el lugar | 5 = re-visita en semana nueva
      const primeraVisita = await this.repo.findPrimeraVisitaHistorica(jugadorId, lugarId);
      const esPrimeraVisita = primeraVisita === null;
      const puntosVisita = esPrimeraVisita ? 10 : 5;
      const esRevisita = !esPrimeraVisita;
    // 4. Transacción atómica (RNF4):
    //    VisitaJugador + LogroJugador + ProgresoRuta + Jugador
    const resultado = await prisma.$transaction(async (tx) => {
      // 4.1 Crear la visita
      const visita = await tx.visitaJugador.create({
        data: {
          jugadorId,
          lugarId,
          semanaIso,
          puntosOtorgados: puntosVisita,
          accuracyGps: coordenada.accuracy ?? null,
          distanciaValidada:
            validacion.distanciaMetros >= 0 ? validacion.distanciaMetros : null,
        },
      });

      // 4.2 Recalcular contexto de logros (dentro de la tx para consistencia)
      const totalVisitas = await tx.visitaJugador.count({ where: { jugadorId } });
      const visitasPorCategoria = await this.contarVisitasPorCategoriaTx(tx, jugadorId);

      const logros = await tx.logro.findMany({
        where: { activo: true, esTemporal: false }, // solo logros regulares
      });
      const logrosPrevios = await tx.logroJugador.findMany({
        where: { jugadorId },
        select: { logroId: true },
      });
      const desbloqueadosSet = new Set(logrosPrevios.map((l) => l.logroId));

      const ctx: ContextoLogros = {
        totalVisitas,
        visitasPorCategoria,
        rutasCompletadas: 0, // se recalcula más abajo
      };

      // 4.3 Evaluar logros
      const logrosADesbloquear = this.logrosEngine.evaluar(
        logros,
        desbloqueadosSet,
        ctx
      );

      if (logrosADesbloquear.length > 0) {
        await tx.logroJugador.createMany({
          data: logrosADesbloquear.map((l) => ({
            jugadorId,
            logroId: l.id,
          })),
        });
      }

      // 4.4 Calcular progreso de rutas afectadas
      const rutasAfectadas = await tx.rutaPunto.findMany({
        where: { lugarId },
        include: {
          ruta: {
            include: {
              puntos: { select: { lugarId: true } },
            },
          },
        },
      });

      const visitasAhora = await tx.visitaJugador.findMany({
        where: { jugadorId },
        select: { lugarId: true },
      });
      const lugaresVisitadosSet = new Set(visitasAhora.map((v) => v.lugarId));

      const rutasResultado: ResultadoVisita['rutasAfectadas'] = [];
      const porcentajes: number[] = [];

      for (const rp of rutasAfectadas) {
        const ruta = rp.ruta;
        const totalPuntos = ruta.puntos.length;
        const visitados = ruta.puntos.filter((p) =>
          lugaresVisitadosSet.has(p.lugarId)
        ).length;

        const pct = this.progresoCalc.calcularPorcentajeRuta(visitados, totalPuntos);
        const completada = pct === 100;

        await tx.progresoRuta.upsert({
          where: { jugadorId_rutaId: { jugadorId, rutaId: ruta.id } },
          create: {
            jugadorId,
            rutaId: ruta.id,
            porcentaje: pct,
            completada,
          },
          update: { porcentaje: pct, completada },
        });

        rutasResultado.push({
          rutaId: ruta.id,
          rutaNombre: ruta.nombre,
          porcentaje: pct,
          completada,
        });
        porcentajes.push(pct);
      }

      // 4.5 Sumar puntos y recalcular progreso global + nivel
      const jugadorActual = await tx.jugador.findUnique({
        where: { id: jugadorId },
        select: {
          puntajeTotal: true,
          puntajeSemanal: true,
          puntajeTemporada: true,
        },
      });

      const nuevoPuntajeTotal = (jugadorActual?.puntajeTotal ?? 0) + puntosVisita;
      const nuevoPuntajeSemanal = (jugadorActual?.puntajeSemanal ?? 0) + puntosVisita;
      const nuevoPuntajeTemporada =
        (jugadorActual?.puntajeTemporada ?? 0) + puntosVisita;

      const progresoGlobal = this.progresoCalc.calcularProgresoGlobal(porcentajes);
      const nuevoNivel = this.progresoCalc.calcularNivel(nuevoPuntajeTotal);

      await tx.jugador.update({
        where: { id: jugadorId },
        data: {
          puntajeTotal: nuevoPuntajeTotal,
          puntajeSemanal: nuevoPuntajeSemanal,
          puntajeTemporada: nuevoPuntajeTemporada,
          progresoGlobal,
          nivel: nuevoNivel,
        },
      });

      return {
        visitaId: visita.id,
        lugarNombre: lugar.nombre,
        puntosGanados: puntosVisita,
        esRevisita,
        logrosDesbloqueados: this.logrosEngine.formatearDesbloqueados(
          logrosADesbloquear
        ) as LogroDesbloqueado[],
        progresoGlobal,
        rutasAfectadas: rutasResultado,
      };
    });

    logger.info({
      tipo: 'visitaRegistrada',
      jugadorId,
      lugarId,
      semanaIso,
      puntos: resultado.puntosGanados,
      esRevisita,
      logros: resultado.logrosDesbloqueados.length,
    });

    return resultado;
  }

  private async contarVisitasPorCategoriaTx(
    tx: Prisma.TransactionClient,
    jugadorId: number
  ): Promise<Record<string, number>> {
    const visitas = await tx.visitaJugador.findMany({
      where: { jugadorId },
      include: {
        lugar: {
          include: {
            rutas: { include: { ruta: { select: { categoria: true } } } },
          },
        },
      },
    });

    const conteo: Record<string, number> = {};
    for (const v of visitas) {
      const cats = new Set(
        v.lugar.rutas
          .map((rp) => rp.ruta.categoria)
          .filter((c): c is string => Boolean(c))
      );
      for (const c of cats) conteo[c] = (conteo[c] ?? 0) + 1;
    }
    return conteo;
  }

  // ═══════════════════════════════════════════════════════
  // LOGROS (RF4.6)
  // ═══════════════════════════════════════════════════════
  async listarLogros(usuarioId: number) {
    const jugador = await this.repo.findJugadorByUsuarioId(usuarioId);
    if (!jugador) throw new Error('Solo los jugadores tienen logros');

    const [catalogo, obtenidosIds] = await Promise.all([
      this.repo.findLogrosActivos(),
      this.repo.findLogrosJugadorIds(jugador.id),
    ]);

    const obtenidosSet = new Set(obtenidosIds);

    return catalogo.map((l) => ({
      id: l.id,
      nombre: l.nombre,
      descripcion: l.descripcion,
      icono: l.icono,
      categoria: l.categoria,
      meta: l.meta,
      desbloqueado: obtenidosSet.has(l.id),
    }));
  }

  // ═══════════════════════════════════════════════════════
  // PERFIL DEL JUGADOR
  // ═══════════════════════════════════════════════════════
  async obtenerPerfil(usuarioId: number) {
    const jugador = await this.repo.findJugadorByUsuarioId(usuarioId);
    if (!jugador) throw new Error('Solo los jugadores tienen perfil');

    const [totalVisitas, logros, posicion] = await Promise.all([
      this.repo.countVisitasByJugador(jugador.id),
      this.repo.findLogrosByJugador(jugador.id),
      this.leaderboardSvc.obtenerPosicionJugador(jugador.id),
    ]);

    return {
      jugadorId: jugador.id,
      username: jugador.usuario.username,
      nombre: jugador.usuario.nombre,
      avatarUrl: jugador.avatarUrl,
      descripcion: jugador.descripcion,
      nivel: jugador.nivel,
      puntajeTotal: jugador.puntajeTotal,
      puntajeSemanal: jugador.puntajeSemanal,
      puntajeTemporada: jugador.puntajeTemporada,
      progresoGlobal: jugador.progresoGlobal,
      totalVisitas,
      posicionRanking: posicion,
      logrosRecientes: logros.slice(0, 6).map((lj) => ({
        id: lj.logro.id,
        nombre: lj.logro.nombre,
        icono: lj.logro.icono,
        categoria: lj.logro.categoria,
        descripcionExtra: lj.descripcionExtra,
        desbloqueadoEn: lj.desbloqueadoEn,
      })),
    };
  }

  async actualizarPerfil(
    usuarioId: number,
    data: { avatarUrl?: string; descripcion?: string }
  ) {
    const jugador = await this.repo.findJugadorByUsuarioId(usuarioId);
    if (!jugador) throw new Error('Solo los jugadores pueden actualizar este perfil');

    return prisma.jugador.update({
      where: { id: jugador.id },
      data: {
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
        ...(data.descripcion !== undefined && { descripcion: data.descripcion }),
      },
      select: {
        id: true,
        avatarUrl: true,
        descripcion: true,
        nivel: true,
        puntajeTotal: true,
      },
    });
  }

  // ═══════════════════════════════════════════════════════
  // LEADERBOARD (RF4.7)
  // ═══════════════════════════════════════════════════════
    async obtenerLeaderboard(): Promise<EntradaLeaderboard[]> {
    return this.leaderboardSvc.obtenerTop50Semanal();
  }

  async obtenerJugadorIdPorUsuario(usuarioId: number): Promise<number | null> {
    const jugador = await this.repo.findJugadorByUsuarioId(usuarioId);
    return jugador?.id ?? null;
  }
    // ═══════════════════════════════════════════════════════
  // LEADERBOARDS PARALELOS (semanal + temporada)
  // ═══════════════════════════════════════════════════════
  async obtenerLeaderboardSemanal() {
    return this.leaderboardSvc.obtenerTop50Semanal();
  }

  async obtenerLeaderboardTemporada() {
    return this.leaderboardSvc.obtenerTop50Temporada();
  }

  // ═══════════════════════════════════════════════════════
  // HALL OF FAME
  // ═══════════════════════════════════════════════════════
  async listarTemporadasCerradas() {
    return this.repo.findTemporadasCerradas();
  }

  async obtenerHallOfFame(temporadaId: number) {
    const [temporada, top] = await Promise.all([
      this.repo.findTemporadasCerradas().then((ts) => ts.find((t) => t.id === temporadaId)),
      this.repo.findHallOfFameByTemporada(temporadaId),
    ]);

    if (!temporada) throw new Error('Temporada no encontrada o no cerrada');

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
}


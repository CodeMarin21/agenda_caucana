import { GamificacionRepository } from './gamificacion.repository';
import { EntradaLeaderboard } from './gamificacion.types';

const NIVEL_FALLBACK = 1;

export class LeaderboardService {
  constructor(
    private readonly repo: GamificacionRepository = new GamificacionRepository()
  ) {}

  async obtenerTop50Semanal(): Promise<EntradaLeaderboard[]> {
    const jugadores = await this.repo.findTopJugadores(50);
    return jugadores.map((j, idx) => ({
      posicion: idx + 1,
      jugadorId: j.id,
      username: j.usuario.username,
      nombre: j.usuario.nombre,
      avatarUrl: j.avatarUrl,
      nivel: j.nivel ?? NIVEL_FALLBACK,
      puntajeSemanal: j.puntajeSemanal,
      puntajeTotal: j.puntajeTotal,
    }));
  }

  async obtenerTop50Temporada() {
    const jugadores = await this.repo.findTopJugadoresTemporada(50);
    return jugadores.map((j, idx) => ({
      posicion: idx + 1,
      jugadorId: j.id,
      username: j.usuario.username,
      nombre: j.usuario.nombre,
      avatarUrl: j.avatarUrl,
      nivel: j.nivel ?? NIVEL_FALLBACK,
      puntajeTemporada: j.puntajeTemporada,
      puntajeTotal: j.puntajeTotal,
    }));
  }

  async obtenerPosicionJugador(jugadorId: number): Promise<number | null> {
    return this.repo.findPosicionJugador(jugadorId);
  }
}
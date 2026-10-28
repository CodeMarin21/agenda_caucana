export interface CoordenadaInput {
  latitud: number;
  longitud: number;
  accuracy?: number; // margen de error GPS reportado por el navegador (metros)
}
export interface VisitaInput {
  jugadorId: number;
  lugarId: number;
  coordenada: CoordenadaInput;
}

export interface LogroDesbloqueado {
  id: number;
  nombre: string;
  descripcion: string;
  icono: string | null;
  categoria: string;
}

export interface ResultadoVisita {
  visitaId: number;
  lugarNombre: string;
  puntosGanados: number;
  esRevisita: boolean; // true si el jugador ya había estado aquí antes
  logrosDesbloqueados: LogroDesbloqueado[];
  progresoGlobal: number;
  rutasAfectadas: Array<{
    rutaId: number;
    rutaNombre: string;
    porcentaje: number;
    completada: boolean;
  }>;
}

export interface EntradaLeaderboard {
  posicion: number;
  jugadorId: number;
  username: string | null;
  nombre: string | null;
  avatarUrl: string | null;
  nivel: number;
  puntajeSemanal: number;
  puntajeTotal: number;
}
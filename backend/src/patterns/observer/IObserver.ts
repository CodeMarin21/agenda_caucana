// Patrón Observer — Interfaz base
export interface IObserver {
  notificar(data: EventoAprobadoData): Promise<void>;
}

export interface EventoAprobadoData {
  eventoId: number;
  titulo: string;
  categoriaId: number;
  categoriaNombre: string;
  fechaInicio: Date;
  lugarNombre: string;
}
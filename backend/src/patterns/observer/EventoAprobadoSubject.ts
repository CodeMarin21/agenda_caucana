import { IObserver, EventoAprobadoData } from './IObserver';

// Patrón Observer — Subject
// Mantiene la lista de observadores y los notifica cuando se aprueba un evento
export class EventoAprobadoSubject {
  private observadores: IObserver[] = [];

  registrar(observador: IObserver): void {
    this.observadores.push(observador);
  }

  async notificarTodos(data: EventoAprobadoData): Promise<void> {
    for (const obs of this.observadores) {
      await obs.notificar(data);
    }
  }
}

// Instancia global única (Singleton del Subject)
export const eventoAprobadoSubject = new EventoAprobadoSubject();
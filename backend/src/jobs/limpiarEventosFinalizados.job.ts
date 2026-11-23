import { EventosService } from '../modules/eventos/eventos.service';

const eventosService = new EventosService();

export async function limpiarEventosFinalizados(): Promise<void> {
  await eventosService.eliminarFinalizados();
}

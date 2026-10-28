import { PrivacidadRepository } from './privacidad.repository';

export interface ActualizarPrivacidadDTO {
  cuentaPrivada?: boolean;
  recomendarAOtros?: boolean;
  mostrarEnRanking?: boolean;
  permitirMensajes?: boolean;
}

export class PrivacidadService {
  private repo: PrivacidadRepository;

  constructor(repo?: PrivacidadRepository) {
    this.repo = repo ?? new PrivacidadRepository();
  }

  async obtener(usuarioId: number) {
    const config = await this.repo.obtenerPorUsuarioId(usuarioId);
    if (!config) throw new Error('Jugador no encontrado');
    return config;
  }

  async actualizar(usuarioId: number, data: ActualizarPrivacidadDTO) {
    // Filtrar solo campos enviados (undefined se ignora)
    const cambios: ActualizarPrivacidadDTO = {};
    if (data.cuentaPrivada    !== undefined) cambios.cuentaPrivada    = data.cuentaPrivada;
    if (data.recomendarAOtros !== undefined) cambios.recomendarAOtros = data.recomendarAOtros;
    if (data.mostrarEnRanking !== undefined) cambios.mostrarEnRanking = data.mostrarEnRanking;
    if (data.permitirMensajes !== undefined) cambios.permitirMensajes = data.permitirMensajes;

    if (Object.keys(cambios).length === 0) {
      throw new Error('No hay campos para actualizar');
    }

    return this.repo.actualizarPorUsuarioId(usuarioId, cambios);
  }
}
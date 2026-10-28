import { prisma } from '../../config/database';

/**
 * Repository de privacidad del jugador.
 *
 * Solo accede a los campos de configuración de privacidad del modelo `Jugador`.
 * No mezcla responsabilidades con el resto del módulo gamificación.
 *
 * Campos gestionados:
 *   - cuentaPrivada      → perfil visible solo para seguidores
 *   - recomendarAOtros   → aparecer en recomendaciones
 *   - mostrarEnRanking   → aparecer en leaderboards
 *   - permitirMensajes   → aceptar mensajes de otros jugadores
 */
export class PrivacidadRepository {

  async obtenerPorUsuarioId(usuarioId: number) {
    return prisma.jugador.findUnique({
      where: { usuarioId },
      select: {
        cuentaPrivada: true,
        recomendarAOtros: true,
        mostrarEnRanking: true,
        permitirMensajes: true,
      },
    });
  }

  async actualizarPorUsuarioId(
    usuarioId: number,
    data: {
      cuentaPrivada?: boolean;
      recomendarAOtros?: boolean;
      mostrarEnRanking?: boolean;
      permitirMensajes?: boolean;
    }
  ) {
    return prisma.jugador.update({
      where: { usuarioId },
      data,
      select: {
        cuentaPrivada: true,
        recomendarAOtros: true,
        mostrarEnRanking: true,
        permitirMensajes: true,
      },
    });
  }
}
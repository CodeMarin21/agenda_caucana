import { prisma } from '../../config/database';

/**
 * Repository de recuperación de contraseña.
 *
 * Encapsula TODO el acceso a datos de:
 *   - PasswordResetToken (recuperación vía email)
 *   - RecoveryCode       (recuperación de jugadores sin email)
 *   - Usuario            (solo lecturas/escrituras relevantes al flujo)
 *   - RefreshToken       (invalidación masiva al cambiar contraseña)
 *
 * El service (password-reset.service.ts) usa este repo. Nunca toca Prisma directo.
 */
export class PasswordResetRepository {

  // ── Usuario ────────────────────────────────────────────
  async buscarUsuarioPorEmail(email: string) {
    return prisma.usuario.findUnique({ where: { email } });
  }

  async buscarUsuarioPorUsernameConJugador(username: string) {
    return prisma.usuario.findUnique({
      where: { username },
      include: { jugador: true },
    });
  }

  async buscarUsuarioPorId(id: number) {
    return prisma.usuario.findUnique({ where: { id } });
  }

  async actualizarPasswordHash(usuarioId: number, passwordHash: string) {
    return prisma.usuario.update({
      where: { id: usuarioId },
      data:  { passwordHash },
    });
  }

  // ── PasswordResetToken ─────────────────────────────────
  async crearTokenReset(data: {
    tokenHash: string;
    usuarioId: number;
    expiresAt: Date;
    ipSolicitante?: string;
  }) {
    return prisma.passwordResetToken.create({ data });
  }

  async buscarTokenResetPorHash(tokenHash: string) {
    return prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { usuario: true },
    });
  }

  async marcarTokenResetUsado(id: number) {
    return prisma.passwordResetToken.update({
      where: { id },
      data:  { usado: true },
    });
  }

  async eliminarTokensResetDeUsuario(usuarioId: number) {
    return prisma.passwordResetToken.deleteMany({ where: { usuarioId } });
    
  }
  /**
   * Rate limit por email: ¿existe un token NO usado y NO expirado
   * creado en los últimos `dentroDeMs` milisegundos?
   * Sirve para cumplir la regla de negocio "1 solicitud por minuto por email".
   */
  async hayTokenResetReciente(usuarioId: number, dentroDeMs: number): Promise<boolean> {
    const threshold = new Date(Date.now() - dentroDeMs);
    const count = await prisma.passwordResetToken.count({
      where: {
        usuarioId,
        usado: false,
        creadoEn: { gte: threshold },
      },
    });
    return count > 0;
  }
  async eliminarTokensResetExpirados() {
    return prisma.passwordResetToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }

  // ── RecoveryCode ───────────────────────────────────────
  async crearRecoveryCodes(codes: Array<{ codeHash: string; jugadorId: number }>) {
    return prisma.recoveryCode.createMany({ data: codes });
  }

  async buscarRecoveryCodePorHash(codeHash: string) {
    return prisma.recoveryCode.findUnique({ where: { codeHash } });
  }

  async marcarRecoveryCodeUsado(id: number) {
    return prisma.recoveryCode.update({
      where: { id },
      data:  { usado: true, usadoEn: new Date() },
    });
  }

  async contarRecoveryCodesDisponibles(jugadorId: number) {
    return prisma.recoveryCode.count({
      where: { jugadorId, usado: false },
    });
  }

  async eliminarRecoveryCodesDeJugador(jugadorId: number) {
    return prisma.recoveryCode.deleteMany({ where: { jugadorId } });
  }

  // ── RefreshToken (invalidación masiva) ─────────────────
  /**
   * Borra TODOS los refresh tokens del usuario.
   * Se invoca después de un reset exitoso para cerrar sesiones
   * activas en otros dispositivos. Es el estándar de seguridad.
   */
  async invalidarTodosLosRefreshTokens(usuarioId: number) {
    return prisma.refreshToken.deleteMany({ where: { usuarioId } });
  }
}
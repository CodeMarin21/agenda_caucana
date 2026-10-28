import bcrypt from 'bcryptjs';
import { PasswordResetRepository } from './password-reset.repository';
import { enviarMail } from '../../config/mailer';
import { plantillaResetPassword } from './password-reset.mailer';
import {
  generarTokenReset,
  hashToken,
  generarRecoveryCodes,
} from './password-reset.util';
import { logger } from '../../config/logger';

// ── Configuración ────────────────────────────────────────
const TTL_TOKEN_MINUTOS = 30;
const TTL_TOKEN_MS = TTL_TOKEN_MINUTOS * 60 * 1000;
const RATE_LIMIT_EMAIL_MS = 60 * 1000; // 1 min entre solicitudes al mismo email
const CODIGOS_POR_JUGADOR = 8;

export class PasswordResetService {
  private repo: PasswordResetRepository;

  constructor(repo?: PasswordResetRepository) {
    this.repo = repo ?? new PasswordResetRepository();
  }

  // ───────────────────────────────────────────────────────
  // FLUJO 1: Solicitud por email (usuarios y organizadores)
  // ───────────────────────────────────────────────────────
  /**
   * Respuesta OPACA por diseño: si el email no existe, retorna sin error.
   * El controller siempre responde el mismo mensaje (anti-enumeración).
   */
  async solicitarResetPorEmail(email: string, ip: string): Promise<void> {
    const usuario = await this.repo.buscarUsuarioPorEmail(email);

    // No revelamos si existe. Salida silenciosa.
    if (!usuario) return;

    // No revelamos si está inactivo. Salida silenciosa.
    if (!usuario.activo) return;

    // Rate limit por email: 1 solicitud por minuto.
    // Si hay un token reciente, salimos sin crear otro.
    const hayReciente = await this.repo.hayTokenResetReciente(usuario.id, RATE_LIMIT_EMAIL_MS);
    if (hayReciente) return;

    // Invalidar tokens anteriores del usuario (higiene: solo 1 token activo).
    await this.repo.eliminarTokensResetDeUsuario(usuario.id);

    // Generar token y guardarlo hasheado.
    const tokenPlano = generarTokenReset();
    const tokenHash = hashToken(tokenPlano);
    const expiresAt = new Date(Date.now() + TTL_TOKEN_MS);

    await this.repo.crearTokenReset({
      tokenHash,
      usuarioId: usuario.id,
      expiresAt,
      ipSolicitante: ip,
    });

    // Construir URL. El token va en claro SOLO en la URL del email.
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5500';
    const url = `${frontendUrl}/reset.html?token=${tokenPlano}`;

    const { html, text } = plantillaResetPassword({
      nombreUsuario: usuario.nombre ?? usuario.username ?? 'usuario',
      url,
      minutosValidez: TTL_TOKEN_MINUTOS,
    });

    try {
      await enviarMail({
        to: email,
        subject: 'Restablecer tu contraseña — Agenda Caucana',
        html,
        text,
      });
    } catch (error) {
      // Log local, pero NO propagamos al cliente. La respuesta sigue opaca.
      logger.error(`Error enviando email de reset: ${(error as Error).message}`);
    }
  }

  // ───────────────────────────────────────────────────────
  // FLUJO 2: Solicitud con username + código (jugadores)
  // ───────────────────────────────────────────────────────
  /**
   * Valida el código de recuperación y devuelve un `resetToken` en claro.
   * El cliente lo manda luego a `confirmarReset()`.
   *
   * Si algo falla, lanza error con mensaje GENÉRICO
   * ("Usuario o código inválido") para no revelar si el username existe.
   */
  async solicitarResetPorCodigo(username: string, codigo: string): Promise<string> {
    const usuario = await this.repo.buscarUsuarioPorUsernameConJugador(username);

    if (!usuario || !usuario.jugador) {
      throw new Error('Usuario o código inválido');
    }

    const codeHash = hashToken(codigo.trim().toUpperCase());
    const recoveryCode = await this.repo.buscarRecoveryCodePorHash(codeHash);

    // Mismo mensaje para: código no existe / código de otro jugador.
    if (!recoveryCode || recoveryCode.jugadorId !== usuario.jugador.id) {
      throw new Error('Usuario o código inválido');
    }

    if (recoveryCode.usado) {
      throw new Error('Este código ya fue utilizado');
    }

    // Marcar el código como consumido (un solo uso).
    await this.repo.marcarRecoveryCodeUsado(recoveryCode.id);

    // Invalidar tokens de reset anteriores.
    await this.repo.eliminarTokensResetDeUsuario(usuario.id);

    // Generar token temporal (mismo mecanismo que flujo email).
    const tokenPlano = generarTokenReset();
    const tokenHash = hashToken(tokenPlano);
    const expiresAt = new Date(Date.now() + TTL_TOKEN_MS);

    await this.repo.crearTokenReset({
      tokenHash,
      usuarioId: usuario.id,
      expiresAt,
    });

    return tokenPlano;
  }

  // ───────────────────────────────────────────────────────
  // FLUJO 3: Confirmar reset (común a ambos flujos)
  // ───────────────────────────────────────────────────────
  /**
   * Cambia la contraseña, invalida el token y cierra TODAS las sesiones
   * activas del usuario (borra refresh tokens). Es el estándar de seguridad.
   */
  async confirmarReset(tokenPlano: string, nuevaPassword: string): Promise<void> {
    const tokenHash = hashToken(tokenPlano);
    const tokenGuardado = await this.repo.buscarTokenResetPorHash(tokenHash);

    if (!tokenGuardado) throw new Error('Token inválido o expirado');
    if (tokenGuardado.usado) throw new Error('Este enlace ya fue utilizado');
    if (tokenGuardado.expiresAt < new Date()) throw new Error('Token inválido o expirado');
    if (!tokenGuardado.usuario.activo) throw new Error('Usuario inactivo');

    const passwordHash = await bcrypt.hash(nuevaPassword, 10);

    // 3 operaciones atómicas:
    //   1) Cambiar contraseña
    //   2) Marcar token usado
    //   3) Invalidar TODAS las sesiones (refresh tokens)
    await this.repo.actualizarPasswordHash(tokenGuardado.usuarioId, passwordHash);
    await this.repo.marcarTokenResetUsado(tokenGuardado.id);
    await this.repo.invalidarTodosLosRefreshTokens(tokenGuardado.usuarioId);
  }

  // ───────────────────────────────────────────────────────
  // UTILIDAD: generación de códigos al registrar jugador
  // ───────────────────────────────────────────────────────
  /**
   * Se invoca desde auth.service.ts al registrar un JUGADOR.
   * Devuelve los códigos EN CLARO (para mostrarlos UNA SOLA VEZ).
   * En BD quedan hasheados.
   */
  async generarCodigosParaJugador(jugadorId: number): Promise<string[]> {
    await this.repo.eliminarRecoveryCodesDeJugador(jugadorId);

    const codigosPlano = generarRecoveryCodes(CODIGOS_POR_JUGADOR);
    const codesData = codigosPlano.map((codigo) => ({
      codeHash: hashToken(codigo.toUpperCase()),
      jugadorId,
    }));

    await this.repo.crearRecoveryCodes(codesData);

    return codigosPlano;
  }
}
import { Request, Response } from 'express';
import { Rol } from '@prisma/client';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { logger } from '../../config/logger';

const authService = new AuthService();
const passwordResetService = new PasswordResetService();

const ROLES_PUBLICOS: ReadonlyArray<Rol> = [Rol.USUARIO, Rol.ORGANIZADOR, Rol.JUGADOR];

// ─────────────────────────────────────────────
// POST /api/auth/registro
// ─────────────────────────────────────────────
export async function registro(req: Request, res: Response): Promise<void> {
  try {
    const { nombre, email, username, descripcion, password, rol } = req.body as {
      nombre?: string;
      email?: string;
      username?: string;
      descripcion?: string;
      password: string;
      rol?: Rol;
    };

    if (!password || password.length < 8) {
      res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
      return;
    }
    if (!email && !username) {
      res.status(400).json({ error: 'Debes enviar email o username' });
      return;
    }

    const rolSolicitado: Rol = rol ?? Rol.USUARIO;
    if (!ROLES_PUBLICOS.includes(rolSolicitado)) {
      res.status(403).json({ error: 'No tienes permiso para registrar este tipo de cuenta' });
      return;
    }

    const resultado = await authService.registrar({
      nombre, email, username, descripcion, password, rol: rolSolicitado,
    });

    // Si es JUGADOR, resultado incluye recoveryCodes (SOLO esta vez)
    const respuesta: Record<string, unknown> = {
      mensaje: 'Cuenta creada exitosamente',
      usuario: resultado.usuario,
    };

    if (resultado.recoveryCodes) {
      respuesta.recoveryCodes = resultado.recoveryCodes;
      respuesta.advertencia =
        'Guarda estos códigos en un lugar seguro. NO se volverán a mostrar. ' +
        'Son la ÚNICA forma de recuperar tu cuenta si olvidas tu contraseña.';
    }

    res.status(201).json(respuesta);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al registrar';
    res.status(400).json({ error: mensaje });
  }
}

// ─────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, username, password } = req.body as {
      email?: string;
      username?: string;
      password: string;
    };

    const identificador = email ?? username;
    if (!identificador || !password) {
      res.status(400).json({ error: 'Credenciales incompletas' });
      return;
    }

    const resultado = await authService.login(identificador, password);
    res.json({ mensaje: 'Sesión iniciada', ...resultado });
  } catch {
    res.status(401).json({ error: 'Credenciales incorrectas' });
  }
}

// ─────────────────────────────────────────────
// POST /api/auth/refresh
// ─────────────────────────────────────────────
export async function refreshToken(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token requerido' });
      return;
    }
    const tokens = await authService.refrescarToken(refreshToken);
    res.json(tokens);
  } catch {
    res.status(401).json({ error: 'Refresh token inválido o expirado' });
  }
}

// ─────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────
export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    res.json({ mensaje: 'Sesión cerrada exitosamente' });
  } catch {
    res.json({ mensaje: 'Sesión cerrada' });
  }
}

// ─────────────────────────────────────────────
// GET /api/auth/perfil
// ─────────────────────────────────────────────
export async function perfil(req: Request, res: Response): Promise<void> {
  try {
    const usuario = await authService.obtenerPerfil(req.usuarioId!);
    if (!usuario) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }
    res.json(usuario);
  } catch {
    res.status(500).json({ error: 'Error al obtener el perfil' });
  }
}

// ═════════════════════════════════════════════
// A.5.2 — Recuperación de contraseña
// ═════════════════════════════════════════════

// ─────────────────────────────────────────────
// POST /api/auth/solicitar-reset
// Respuesta OPACA — no revela si el email existe
// ─────────────────────────────────────────────
export async function solicitarReset(req: Request, res: Response): Promise<void> {
  const MENSAJE_OPACO =
    'Si el email está registrado, recibirás un enlace de recuperación en los próximos minutos.';

  try {
    const { email } = req.body as { email: string };
    const ip = req.ip ?? 'unknown';
    await passwordResetService.solicitarResetPorEmail(email, ip);
    res.json({ mensaje: MENSAJE_OPACO });
  } catch (error) {
    // Aun si falla, respondemos igual (no revelar nada al cliente).
    logger.error(`Error en solicitarReset: ${(error as Error).message}`);
    res.json({ mensaje: MENSAJE_OPACO });
  }
}

// ─────────────────────────────────────────────
// POST /api/auth/jugador/solicitar-reset
// Valida código de recuperación → devuelve resetToken
// ─────────────────────────────────────────────
export async function solicitarResetJugador(req: Request, res: Response): Promise<void> {
  try {
    const { username, codigo } = req.body as { username: string; codigo: string };
    const resetToken = await passwordResetService.solicitarResetPorCodigo(username, codigo);
    res.json({
      mensaje: 'Código válido. Ingresa tu nueva contraseña.',
      resetToken,
    });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Código inválido';
    res.status(400).json({ error: mensaje });
  }
}

// ─────────────────────────────────────────────
// POST /api/auth/confirmar-reset
// Común a ambos flujos (email y jugador)
// ─────────────────────────────────────────────
export async function confirmarReset(req: Request, res: Response): Promise<void> {
  try {
    const { token, nuevaPassword } = req.body as { token: string; nuevaPassword: string };
    await passwordResetService.confirmarReset(token, nuevaPassword);
    res.json({
      mensaje: 'Contraseña actualizada. Todas las sesiones anteriores fueron cerradas.',
    });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Token inválido';
    res.status(400).json({ error: mensaje });
  }
}
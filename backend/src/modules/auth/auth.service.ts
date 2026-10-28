import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Rol } from '@prisma/client';
import { prisma } from '../../config/database';
import { generarRecoveryCodes, hashToken } from './password-reset.util';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface RegistroDTO {
  nombre?: string;
  email?: string;
  username?: string;
  descripcion?: string;
  password: string;
  rol?: Rol;
}

interface ResultadoRegistro {
  usuario: object;
  recoveryCodes?: string[];
}

// Select reutilizable: respuesta consistente en todos los flujos
const USUARIO_PUBLICO_SELECT = {
  id: true,
  nombre: true,
  email: true,
  username: true,
  rol: true,
  creadoEn: true,
  jugador: {
    select: {
      id: true,
      avatarUrl: true,
      descripcion: true,
      nivel: true,
      puntajeTotal: true,
    },
  },
} as const;

const CODIGOS_POR_JUGADOR = 8;

export class AuthService {
  // ── Registro de nuevo usuario ──────────────────────────
  async registrar({
    nombre,
    email,
    username,
    descripcion,
    password,
    rol,
  }: RegistroDTO): Promise<ResultadoRegistro> {
    const rolFinal: Rol = rol ?? Rol.USUARIO;

    // ── Validaciones por tipo de cuenta ──
    if (rolFinal === Rol.JUGADOR) {
      if (!username || username.trim().length < 3) {
        throw new Error('El nombre de usuario es obligatorio (mínimo 3 caracteres)');
      }
      if (email) {
        throw new Error('Los jugadores de Popayán Go no requieren correo electrónico');
      }
    } else {
      if (!email) {
        throw new Error('El correo electrónico es obligatorio para este tipo de cuenta');
      }
    }

    // ── Unicidad ──
    if (email) {
      const existeEmail = await prisma.usuario.findUnique({ where: { email } });
      if (existeEmail) throw new Error('Ya existe una cuenta con ese email');
    }
    if (username) {
      const existeUsername = await prisma.usuario.findUnique({ where: { username } });
      if (existeUsername) throw new Error('Ese nombre de usuario ya está en uso');
    }

    // ── Hash de contraseña ──
    const passwordHash = await bcrypt.hash(password, 10);

    // ── JUGADOR: transacción atómica Usuario + Jugador + RecoveryCodes ──
    if (rolFinal === Rol.JUGADOR) {
      return prisma.$transaction(async (tx) => {
        // 1) Crear el Usuario (sin include del jugador, todavía no existe)
        const usuarioCreado = await tx.usuario.create({
          data: {
            nombre: nombre ?? username!,
            email: null,
            username: username!,
            passwordHash,
            rol: Rol.JUGADOR,
          },
          select: { id: true },
        });

        // 2) Crear el perfil de Jugador asociado
        const jugador = await tx.jugador.create({
          data: {
            usuarioId: usuarioCreado.id,
            descripcion: descripcion?.trim() || null,
          },
          select: { id: true },
        });

        // 3) Generar 8 códigos de recuperación (hasheados en BD).
        //    Se devuelven en claro SOLO en esta respuesta, UNA VEZ.
        const codigosPlano = generarRecoveryCodes(CODIGOS_POR_JUGADOR);
        await tx.recoveryCode.createMany({
          data: codigosPlano.map((codigo) => ({
            codeHash: hashToken(codigo.toUpperCase()),
            jugadorId: jugador.id,
          })),
        });

        // 4) Re-consultar para traer el usuario CON su perfil de Jugador.
        //    Sin este re-fetch, `usuario.jugador` aparecería null porque
        //    Prisma evalúa las relaciones anidadas en el momento del create,
        //    y el Jugador se creó después.
        const usuarioCompleto = await tx.usuario.findUnique({
          where: { id: usuarioCreado.id },
          select: USUARIO_PUBLICO_SELECT,
        });

        return { usuario: usuarioCompleto!, recoveryCodes: codigosPlano };
      });
    }

    // ── ORGANIZADOR / USUARIO: sin perfil de Jugador ──
    const usuario = await prisma.usuario.create({
      data: {
        nombre: nombre!,
        email: email!,
        username: null,
        passwordHash,
        rol: rolFinal,
      },
      select: USUARIO_PUBLICO_SELECT,
    });

    return { usuario };
  }

  // ── Login (email o username) ───────────────────────────
  async login(
    identificador: string,
    password: string
  ): Promise<{ usuario: object; tokens: TokenPair }> {
    const esEmail = identificador.includes('@');

    const usuario = await prisma.usuario.findFirst({
      where: esEmail ? { email: identificador } : { username: identificador },
    });

    if (!usuario || !usuario.activo) {
      throw new Error('Credenciales incorrectas');
    }

    const passwordValida = await bcrypt.compare(password, usuario.passwordHash);
    if (!passwordValida) {
      throw new Error('Credenciales incorrectas');
    }

    const tokens = await this.generarTokens(usuario.id, usuario.rol);

    return {
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        username: usuario.username,
        rol: usuario.rol,
      },
      tokens,
    };
  }

  // ── Refresh Token ──────────────────────────────────────
  async refrescarToken(refreshToken: string): Promise<TokenPair> {
    const tokenGuardado = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { usuario: true },
    });

    if (!tokenGuardado || tokenGuardado.expiresAt < new Date()) {
      if (tokenGuardado) {
        await prisma.refreshToken.delete({ where: { token: refreshToken } });
      }
      throw new Error('Refresh token inválido o expirado');
    }

    if (!tokenGuardado.usuario.activo) {
      throw new Error('Usuario inactivo');
    }

    await prisma.refreshToken.delete({ where: { token: refreshToken } });
    return this.generarTokens(tokenGuardado.usuario.id, tokenGuardado.usuario.rol);
  }

  // ── Logout ─────────────────────────────────────────────
  async logout(refreshToken: string): Promise<void> {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }

  // ── Obtener perfil ─────────────────────────────────────
  async obtenerPerfil(usuarioId: number) {
    return prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        ...USUARIO_PUBLICO_SELECT,
        activo: true,
        organizador: {
          select: { id: true, nombreEntidad: true, estado: true },
        },
      },
    });
  }

  // ── Generador de tokens (privado) ──────────────────────
  private async generarTokens(usuarioId: number, rol: Rol): Promise<TokenPair> {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET no está definido en las variables de entorno');
    }

    const expAccess = process.env.JWT_EXPIRES_IN || '7d';

    const accessToken = jwt.sign(
      { usuarioId, rol, type: 'access' as const },
      secret,
      { expiresIn: expAccess } as jwt.SignOptions
    );

    const refreshToken = jwt.sign(
      { usuarioId, type: 'refresh' as const, rand: Math.random().toString(36) },
      secret,
      { expiresIn: '30d' } as jwt.SignOptions
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await prisma.refreshToken.create({
      data: { token: refreshToken, usuarioId, expiresAt },
    });

    return { accessToken, refreshToken };
  }
}
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Rol } from '@prisma/client';
import { prisma } from '../../config/database';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface RegistroDTO {
  nombre: string;
  email: string;
  password: string;
  rol?: Rol;
}

// Select reutilizable: respuesta consistente en todos los flujos
const USUARIO_PUBLICO_SELECT = {
  id: true,
  nombre: true,
  email: true,
  rol: true,
  creadoEn: true,
} as const;

export class AuthService {
  // ── Registro de nuevo usuario ──────────────────────────
  async registrar({
    nombre,
    email,
    password,
    rol,
  }: RegistroDTO): Promise<object> {
    const rolFinal: Rol = rol ?? Rol.USUARIO;

    if (rolFinal !== Rol.USUARIO && rolFinal !== Rol.ORGANIZADOR) {
      throw new Error('No se permite registrar este tipo de cuenta');
    }

    // ── Unicidad ──
    const existeEmail = await prisma.usuario.findUnique({ where: { email } });
    if (existeEmail) throw new Error('Ya existe una cuenta con ese email');

    // ── Hash de contraseña ──
    const passwordHash = await bcrypt.hash(password, 10);

    return prisma.usuario.create({
      data: {
        nombre,
        email,
        passwordHash,
        rol: rolFinal,
      },
      select: USUARIO_PUBLICO_SELECT,
    });
  }

  // ── Login por email ────────────────────────────────────
  async login(
    email: string,
    password: string
  ): Promise<{ usuario: object; tokens: TokenPair }> {
    const usuario = await prisma.usuario.findUnique({ where: { email } });

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
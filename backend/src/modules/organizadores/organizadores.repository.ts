import {
  EstadoOrganizador,
  MotivoEstado,
  MotivoReactivacion,
  Prisma,
  TipoNotificacion,
} from '@prisma/client';
import { prisma } from '../../config/database';

export class OrganizadoresRepository {

  async buscarPorId(id: number) {
    return prisma.organizador.findUnique({ where: { id } });
  }

  async buscarPorUsuarioId(usuarioId: number) {
    return prisma.organizador.findUnique({ where: { usuarioId } });
  }

  async buscarPorUsuarioIdConUsuario(usuarioId: number) {
    return prisma.organizador.findUnique({
      where: { usuarioId },
      include: {
        usuario: {
          select: {
            id: true,
            nombre: true,
            email: true,
            notificaciones: {
              where: {
                tipo: {
                  in: [
                    'VERIFICACION_APROBADA',
                    'VERIFICACION_RECHAZADA',
                    'SUSPENSION',
                    'REACTIVACION',
                  ],
                },
              },
              orderBy: { creadoEn: 'desc' },
              take: 1,
            },
          },
        },
        ciudadBase: { select: { id: true, nombre: true, departamento: true } },
      },
    });
  }

  // ── Listados ──────────────────────────────────────────
  async listarTodos() {
    return prisma.organizador.findMany({
      include: {
        usuario: { select: { id: true, nombre: true, email: true, activo: true } },
        ciudadBase: { select: { id: true, nombre: true } },
        _count: { select: { eventos: true } },
      },
      orderBy: { creadoEn: 'desc' },
    });
  }

  async listarPorEstado(estado: EstadoOrganizador) {
    return prisma.organizador.findMany({
      where: { estado, vetado: false },
      include: {
        usuario: { select: { nombre: true, email: true } },
        ciudadBase: { select: { id: true, nombre: true } },
      },
      orderBy: { creadoEn: 'asc' },
    });
  }

  async listarParaRevision() {
    return prisma.organizador.findMany({
      where: { estado: { in: ['PENDIENTE', 'EN_REVISION'] }, vetado: false },
      include: {
        usuario: { select: { nombre: true, email: true } },
        ciudadBase: { select: { id: true, nombre: true } },
      },
      orderBy: { creadoEn: 'asc' },
    });
  }

  // ── Unicidad de documento ──────────────────────────────
  async buscarPorDocumentoHash(hash: string) {
    return prisma.organizador.findFirst({
      where: { documentoIdentidadHash: hash },
      select: { id: true, vetado: true, usuarioId: true },
    });
  }

  // ── Veto ───────────────────────────────────────────────
  async buscarVetadoPorEmail(email: string) {
    return prisma.organizador.findFirst({
      where: {
        vetado: true,
        usuario: { email },
      },
      select: { id: true, motivoVeto: true, vetadoEn: true },
    });
  }

  async actualizarVeto(id: number, motivo: string, vetadoPorId: number) {
    return prisma.$transaction(async (tx) => {
      const org = await tx.organizador.findUnique({ where: { id } });
      if (!org) throw new Error('Organizador no encontrado');
      if (org.vetado) throw new Error('El organizador ya está vetado');
      const organizador = await tx.organizador.update({
        where: { id },
        data: {
          vetado: true,
          motivoVeto: motivo,
          vetadoEn: new Date(),
          vetadoPorId,
          estado: 'SUSPENDIDO',
        },
      });
      await tx.evento.updateMany({
        where: {
          organizadorId: id,
          estadoPublicacion: { in: ['APROBADO', 'PENDIENTE'] },
        },
        data: {
          estadoPublicacion: 'RECHAZADO',
          motivoRechazo: `Anulado por sanción al organizador: ${motivo}`,
        },
      });
      await tx.notificacion.create({
        data: {
          usuarioId: org.usuarioId,
          tipo: 'SUSPENSION',
          mensaje: `Tu cuenta fue vetada permanentemente. Motivo: ${motivo}`,
        },
      });
      return organizador;
    });
  }

  async cambiarEstadoConNotificacion(
    id: number,
    estadosPermitidos: EstadoOrganizador[],
    estado: EstadoOrganizador,
    motivo: MotivoEstado,
    detalle: string | null,
    motivoLegibleParaEvento: string,
    tipo: TipoNotificacion,
    mensaje: string
  ) {
    return prisma.$transaction(async (tx) => {
      const org = await tx.organizador.findUnique({ where: { id } });
      if (!org) throw new Error('Organizador no encontrado');
      if (org.vetado) throw new Error('No se puede cambiar el estado de un organizador vetado');
      if (!estadosPermitidos.includes(org.estado)) {
        throw new Error('El estado actual del organizador no permite esta acción');
      }
      const organizador = await tx.organizador.update({
        where: { id },
        data: {
          estado,
          motivoEstado: motivo,
          detalleMotivoEstado: detalle,
        },
        include: { usuario: { select: { nombre: true, email: true } } },
      });
      await tx.evento.updateMany({
        where: {
          organizadorId: id,
          estadoPublicacion: { in: ['APROBADO', 'PENDIENTE'] },
        },
        data: {
          estadoPublicacion: 'RECHAZADO',
          motivoRechazo: `Anulado por sanción al organizador: ${motivoLegibleParaEvento}`,
        },
      });
      await tx.notificacion.create({
        data: { usuarioId: org.usuarioId, tipo, mensaje },
      });
      return organizador;
    });
  }

  async verificarConNotificacion(id: number) {
    return prisma.$transaction(async (tx) => {
      const org = await tx.organizador.findUnique({ where: { id } });
      if (!org) throw new Error('Organizador no encontrado');
      if (org.vetado) throw new Error('No se puede verificar un organizador vetado');
      if (!['PENDIENTE', 'EN_REVISION', 'SUSPENDIDO'].includes(org.estado)) {
        throw new Error('El estado actual del organizador no permite verificarlo');
      }
      const organizador = await tx.organizador.update({
        where: { id },
        data: { estado: 'VERIFICADO', motivoEstado: null, detalleMotivoEstado: null },
        include: { usuario: { select: { nombre: true, email: true } } },
      });
      await tx.notificacion.create({
        data: {
          usuarioId: org.usuarioId,
          tipo: 'VERIFICACION_APROBADA',
          mensaje: 'Tu cuenta de organizador fue verificada. Ya puedes publicar eventos.',
        },
      });
      return organizador;
    });
  }

  async reactivarConNotificacion(
    id: number,
    motivo: MotivoReactivacion,
    detalle: string | null,
    reactivadoPorId: number,
    notificar: boolean,
    mensaje: string
  ) {
    return prisma.$transaction(async (tx) => {
      const org = await tx.organizador.findUnique({ where: { id } });
      if (!org) throw new Error('Organizador no encontrado');
      if (!org.vetado) throw new Error('El organizador no está vetado');
      const organizador = await tx.organizador.update({
        where: { id },
        data: {
          vetado: false,
          motivoVeto: null,
          vetadoEn: null,
          vetadoPorId: null,
          estado: 'EN_REVISION',
          motivoEstado: null,
          detalleMotivoEstado: null,
          motivoReactivacion: motivo,
          detalleReactivacion: detalle,
          reactivadoEn: new Date(),
          reactivadoPorId,
        },
      });
      if (notificar) {
        await tx.notificacion.create({
          data: {
            usuarioId: org.usuarioId,
            tipo: 'REACTIVACION',
            mensaje,
          },
        });
      }
      return organizador;
    });
  }

  // ── Creación ───────────────────────────────────────────
  async crearConUsuario(data: {
    usuario: {
      nombre: string;
      email: string;
      passwordHash: string;
    };
    organizador: {
      nombreEntidad: string;
      descripcion?: string | null;
      telefono?: string | null;
      redesSociales?: Prisma.InputJsonValue;
      direccion?: string | null;
      ciudadBaseId?: number | null;
      anioFundacion?: number | null;
      tipoEntidad?: string | null;
      documentoIdentidadCifrado?: string | null;
      documentoIdentidadHash?: string | null;
    };
  }) {
    return prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          nombre: data.usuario.nombre,
          email: data.usuario.email,
          passwordHash: data.usuario.passwordHash,
          rol: 'ORGANIZADOR',
        },
      });

      const organizador = await tx.organizador.create({
        data: {
          nombreEntidad: data.organizador.nombreEntidad,
          descripcion: data.organizador.descripcion,
          telefono: data.organizador.telefono,
          redesSociales: data.organizador.redesSociales,
          direccion: data.organizador.direccion,
          anioFundacion: data.organizador.anioFundacion,
          tipoEntidad: data.organizador.tipoEntidad as any,
          documentoIdentidadCifrado: data.organizador.documentoIdentidadCifrado,
          documentoIdentidadHash: data.organizador.documentoIdentidadHash,
          ...(data.organizador.ciudadBaseId && {
            ciudadBase: { connect: { id: data.organizador.ciudadBaseId } },
          }),
          estado: 'PENDIENTE',
          usuario: { connect: { id: usuario.id } },
        },
      });

      return { usuario, organizador };
    });
  }

  // ── Actualización ──────────────────────────────────────
  async actualizar(id: number, data: Prisma.OrganizadorUpdateInput) {
    return prisma.organizador.update({ where: { id }, data });
  }

  async actualizarEstado(id: number, estado: EstadoOrganizador) {
    return prisma.organizador.update({
      where: { id },
      data: { estado },
      include: { usuario: { select: { nombre: true, email: true } } },
    });
  }

  async existeUsuarioConEmail(email: string): Promise<boolean> {
    const u = await prisma.usuario.findUnique({
      where: { email },
      select: { id: true },
    });
    return u !== null;
  }
}
import bcrypt from 'bcryptjs';
import { MotivoEstado, MotivoReactivacion, Prisma } from '@prisma/client';
import { OrganizadoresRepository } from './organizadores.repository';
import { cifrar, descifrar, hashDocumento, enmascararDocumento } from '../../utils/crypto.util';
import {
  MOTIVOS_REACTIVACION,
  MOTIVOS_RECHAZO,
  MOTIVOS_SUSPENSION,
  MOTIVOS_VETO,
} from './organizadores.motivos';

export interface RegistroOrganizadorDTO {
  nombre: string;
  email: string;
  password: string;
  nombreEntidad: string;
  descripcion?: string | null;
  telefono?: string | null;
  redesSociales?: Prisma.InputJsonValue;
  direccion?: string | null;
  ciudadBaseId?: number | null;
  anioFundacion?: number | null;
  tipoEntidad?: string | null;
  documentoIdentidad?: string | null;
}

export interface ActualizarPerfilDTO {
  nombreEntidad?: string;
  descripcion?: string | null;
  telefono?: string | null;
  nit?: string | null;
  avatarUrl?: string | null;
  redesSociales?: Record<string, string> | null;
  direccion?: string | null;
  ciudadBaseId?: number | null;
  anioFundacion?: number | null;
  tipoEntidad?: string | null;
  documentoIdentidad?: string | null;
}

export class OrganizadoresService {
  private repo: OrganizadoresRepository;

  constructor(repo?: OrganizadoresRepository) {
    this.repo = repo ?? new OrganizadoresRepository();
  }

  // ── Registro ───────────────────────────────────────────
  async registrar(data: RegistroOrganizadorDTO) {
    // 1. Email vetado → bloquear
    const vetadoPorEmail = await this.repo.buscarVetadoPorEmail(data.email);
    if (vetadoPorEmail) {
      throw new Error(
        'Este correo está vetado en la plataforma. Contacta a soporte si consideras que es un error.'
      );
    }

    // 2. Email duplicado → bloquear
    const duplicado = await this.repo.existeUsuarioConEmail(data.email);
    if (duplicado) throw new Error('Ya existe una cuenta con ese email');

    // 3. Documento: validar unicidad + veto
    let documentoIdentidadCifrado: string | null = null;
    let documentoIdentidadHash: string | null = null;
    if (data.documentoIdentidad) {
      documentoIdentidadHash = hashDocumento(data.documentoIdentidad);
      const existente = await this.repo.buscarPorDocumentoHash(documentoIdentidadHash);
      if (existente) {
        if (existente.vetado) {
          throw new Error(
            'Este documento está vetado en la plataforma. Contacta a soporte si consideras que es un error.'
          );
        }
        throw new Error('Ya existe un organizador registrado con ese documento de identidad');
      }
      documentoIdentidadCifrado = cifrar(data.documentoIdentidad);
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    return this.repo.crearConUsuario({
      usuario: {
        nombre: data.nombre,
        email: data.email,
        passwordHash,
      },
      organizador: {
        nombreEntidad: data.nombreEntidad,
        descripcion: data.descripcion ?? null,
        telefono: data.telefono ?? null,
        redesSociales: data.redesSociales,
        direccion: data.direccion ?? null,
        ciudadBaseId: data.ciudadBaseId ?? null,
        anioFundacion: data.anioFundacion ?? null,
        tipoEntidad: data.tipoEntidad ?? null,
        documentoIdentidadCifrado,
        documentoIdentidadHash,
      },
    });
  }

  // ── Listados ───────────────────────────────────────────
  async listarTodos() {
    return this.repo.listarTodos();
  }

  async listarPendientes() {
    return this.repo.listarParaRevision();
  }

  // ── Acciones admin ─────────────────────────────────────
  async verificar(id: number) {
    return this.repo.verificarConNotificacion(id);
  }

  async cambiarEstado(id: number, motivo: MotivoEstado, detalle?: string) {
    const org = await this.repo.buscarPorId(id);
    if (!org) throw new Error('Organizador no encontrado');
    if (org.vetado) throw new Error('No se puede cambiar el estado de un organizador vetado');

    const esRechazo = org.estado === 'PENDIENTE' || org.estado === 'EN_REVISION';
    const esSuspension = org.estado === 'VERIFICADO';
    if (!esRechazo && !esSuspension) {
      throw new Error('El organizador no está pendiente ni verificado');
    }

    const motivos = esRechazo ? MOTIVOS_RECHAZO : MOTIVOS_SUSPENSION;
    const motivoBase = motivos[motivo];
    if (!motivoBase) throw new Error('El motivo no aplica al estado actual del organizador');
    if (motivo === 'OTRO' && (!detalle || detalle.trim().length < 5)) {
      throw new Error('Especifica el motivo (mínimo 5 caracteres)');
    }
    const mensajeMotivo = motivo === 'OTRO' ? detalle?.trim() : motivoBase;
    if (!mensajeMotivo) throw new Error('Especifica el motivo');

    return this.repo.cambiarEstadoConNotificacion(
      id,
      [org.estado],
      esRechazo ? 'RECHAZADO' : 'SUSPENDIDO',
      motivo,
      detalle?.trim() || null,
      mensajeMotivo,
      esRechazo ? 'VERIFICACION_RECHAZADA' : 'SUSPENSION',
      esRechazo
        ? `Tu solicitud de verificación fue rechazada. ${mensajeMotivo}`
        : `Tu cuenta fue suspendida. ${mensajeMotivo}`
    );
  }

  async vetar(id: number, motivo: MotivoEstado, detalle: string | undefined, vetadoPorId: number) {
    const org = await this.repo.buscarPorId(id);
    if (!org) throw new Error('Organizador no encontrado');
    if (org.vetado) throw new Error('El organizador ya está vetado');
    const motivoBase = MOTIVOS_VETO[motivo];
    if (!motivoBase) throw new Error('El motivo no aplica para vetar a un organizador');
    if (motivo === 'OTRO' && (!detalle || detalle.trim().length < 5)) {
      throw new Error('Especifica el motivo (mínimo 5 caracteres)');
    }
    const mensajeMotivo = motivo === 'OTRO' ? detalle?.trim() : motivoBase;
    if (!mensajeMotivo) throw new Error('Especifica el motivo');
    const mensaje = `${mensajeMotivo}${detalle && motivo !== 'OTRO' ? ` ${detalle.trim()}` : ''}`;
    return this.repo.actualizarVeto(id, `Veto permanente: ${mensaje}`, vetadoPorId);
  }

  async reactivar(
    id: number,
    motivo: MotivoReactivacion,
    detalle: string | undefined,
    reactivadoPorId: number,
    notificar = true
  ) {
    const motivoBase = MOTIVOS_REACTIVACION[motivo];
    if (!motivoBase) throw new Error('Selecciona un motivo de reactivación válido');
    if (motivo === 'OTRO' && (!detalle || detalle.trim().length < 5)) {
      throw new Error('Especifica el motivo de reactivación (mínimo 5 caracteres)');
    }
    const mensajeMotivo = motivo === 'OTRO' ? detalle?.trim() : motivoBase;
    if (!mensajeMotivo) throw new Error('Especifica el motivo de reactivación');
    const mensaje = `Tu cuenta fue reactivada y está en revisión. Un administrador la verificará en las próximas 24 horas. Motivo: ${mensajeMotivo}${detalle && motivo !== 'OTRO' ? ` Nota: ${detalle.trim()}` : ''}`;
    return this.repo.reactivarConNotificacion(
      id,
      motivo,
      detalle?.trim() || null,
      reactivadoPorId,
      notificar,
      mensaje
    );
  }

  // ── Perfil (organizador logueado) ──────────────────────
  async obtenerPerfil(usuarioId: number) {
    const org = await this.repo.buscarPorUsuarioIdConUsuario(usuarioId);
    if (!org) throw new Error('Organizador no encontrado');

    return {
      id: org.id,
      nombreEntidad: org.nombreEntidad,
      descripcion: org.descripcion,
      telefono: org.telefono,
      nit: org.nit,
      avatarUrl: org.avatarUrl,
      redesSociales: org.redesSociales,
      direccion: org.direccion,
      anioFundacion: org.anioFundacion,
      tipoEntidad: org.tipoEntidad,
      // El documento NO se devuelve completo. Solo enmascarado.
      documentoIdentidadEnmascarado: org.documentoIdentidadCifrado
        ? enmascararDocumento(descifrar(org.documentoIdentidadCifrado))
        : null,
      tieneDocumento: Boolean(org.documentoIdentidadHash),
      estado: org.estado,
      motivoEstado: org.motivoEstado
        ? org.detalleMotivoEstado ||
          MOTIVOS_RECHAZO[org.motivoEstado] ||
          MOTIVOS_SUSPENSION[org.motivoEstado] ||
          MOTIVOS_VETO[org.motivoEstado] ||
          null
        : null,
      vetado: org.vetado,
      motivoVeto: org.motivoVeto,
      motivoReactivacion: org.motivoReactivacion
        ? MOTIVOS_REACTIVACION[org.motivoReactivacion]
        : null,
      detalleReactivacion: org.detalleReactivacion,
      notificacionReciente: org.usuario.notificaciones[0] ?? null,
      ciudadBase: org.ciudadBase
        ? { id: org.ciudadBase.id, nombre: org.ciudadBase.nombre }
        : null,
      creadoEn: org.creadoEn,
      actualizadoEn: org.actualizadoEn,
      usuario: {
        nombre: org.usuario.nombre,
        email: org.usuario.email,
      },
    };
  }

  async actualizarPerfil(usuarioId: number, data: ActualizarPerfilDTO) {
    const org = await this.repo.buscarPorUsuarioId(usuarioId);
    if (!org) throw new Error('Organizador no encontrado');
    if (org.vetado) throw new Error('Tu cuenta está vetada. Contacta a soporte técnico.');

    const updateData: Prisma.OrganizadorUpdateInput = {};

    if (data.nombreEntidad !== undefined) updateData.nombreEntidad = data.nombreEntidad;
    if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;
    if (data.telefono !== undefined) updateData.telefono = data.telefono;
    if (data.nit !== undefined) updateData.nit = data.nit;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (data.direccion !== undefined) updateData.direccion = data.direccion;
    if (data.anioFundacion !== undefined) updateData.anioFundacion = data.anioFundacion;
    if (data.tipoEntidad !== undefined) updateData.tipoEntidad = data.tipoEntidad as any;

    if (org.estado === 'RECHAZADO') {
      updateData.estado = 'PENDIENTE';
      updateData.motivoEstado = null;
      updateData.detalleMotivoEstado = null;
    }

    if (data.ciudadBaseId !== undefined) {
      updateData.ciudadBase = data.ciudadBaseId === null
        ? { disconnect: true }
        : { connect: { id: data.ciudadBaseId } };
    }

    if (data.redesSociales !== undefined) {
      updateData.redesSociales =
        data.redesSociales === null
          ? Prisma.DbNull
          : (data.redesSociales as Prisma.InputJsonValue);
    }

    // Documento: cifrar + validar unicidad
    if (data.documentoIdentidad !== undefined && data.documentoIdentidad !== null) {
      const nuevoHash = hashDocumento(data.documentoIdentidad);
      const existente = await this.repo.buscarPorDocumentoHash(nuevoHash);
      if (existente && existente.id !== org.id) {
        if (existente.vetado) {
          throw new Error('Ese documento está vetado en la plataforma');
        }
        throw new Error('Ya existe otro organizador con ese documento de identidad');
      }
      updateData.documentoIdentidadCifrado = cifrar(data.documentoIdentidad);
      updateData.documentoIdentidadHash = nuevoHash;
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error('No hay campos para actualizar');
    }

    const actualizado = await this.repo.actualizar(org.id, updateData);

    return {
      id: actualizado.id,
      nombreEntidad: actualizado.nombreEntidad,
      descripcion: actualizado.descripcion,
      telefono: actualizado.telefono,
      nit: actualizado.nit,
      avatarUrl: actualizado.avatarUrl,
      redesSociales: actualizado.redesSociales,
      direccion: actualizado.direccion,
      anioFundacion: actualizado.anioFundacion,
      tipoEntidad: actualizado.tipoEntidad,
      estado: actualizado.estado,
      motivoEstado: actualizado.detalleMotivoEstado,
      vetado: actualizado.vetado,
      motivoVeto: actualizado.motivoVeto,
      documentoIdentidadEnmascarado: actualizado.documentoIdentidadHash && actualizado.documentoIdentidadCifrado
        ? enmascararDocumento(descifrar(actualizado.documentoIdentidadCifrado))
        : null,
      tieneDocumento: Boolean(actualizado.documentoIdentidadHash),
      creadoEn: actualizado.creadoEn,
      actualizadoEn: actualizado.actualizadoEn,
    };
  }
}
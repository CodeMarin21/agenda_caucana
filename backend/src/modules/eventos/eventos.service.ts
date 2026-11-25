import { Prisma } from '@prisma/client';
import { EventosRepository } from './eventos.repository';
import { eventoAprobadoSubject } from '../../patterns/observer/EventoAprobadoSubject';
import { FiltroPorCategoria } from '../../patterns/strategy/FiltroPorCategoria';
import { FiltroPorFecha }     from '../../patterns/strategy/FiltroPorFecha';
import { FiltroPorPrecio }    from '../../patterns/strategy/FiltroPorPrecio';
import { IEstrategiaFiltro }  from '../../patterns/strategy/IEstrategiaFiltro';
import { logger } from '../../config/logger';
import { CacheKeyBuilder, getCacheService } from '../../cache';
import { UploadService } from '../upload/upload.service';

const repo = new EventosRepository();
const uploadService = new UploadService();

function generarSlug(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    + '-' + Date.now();
}

interface CrearEventoDTO {
  titulo: string;
  descripcion: string;
  fechaInicio: string;
  fechaFin?: string;
  horaApertura?: string;
  horaCierre?: string;
  direccion?: string;
  precioReferencial?: number;
  esMayorDeEdad?: boolean;
  imagenUrl?: string;
  publicIdImagen?: string;
  categoriaId: number;
  lugarId: number;
  ciudadId: number;
  organizadorId?: number;
  organizadorEstado?: string;
}

export class EventosService {
  private invalidarCacheIA(): void {
    getCacheService().delByPrefix(
      CacheKeyBuilder.create().ns('ia').entity('chat').prefix(),
    );
  }

  // ── Vista pública: solo eventos aprobados con filtros (Strategy)
  async listarAprobados(filtros: {
    categoriaSlug?: string;
    desde?: string;
    hasta?: string;
    precioMin?: number;
    precioMax?: number;
    q?: string;
    pagina?: number;
    limite?: number;
    orden?: 'fecha' | 'recientes';
  }) {
    const estrategias: IEstrategiaFiltro[] = [];

    if (filtros.categoriaSlug) {
      estrategias.push(new FiltroPorCategoria(filtros.categoriaSlug));
    }
    if (filtros.desde || filtros.hasta) {
      const inicio = filtros.desde
        ? new Date(`${filtros.desde}T00:00:00-05:00`)
        : undefined;
      const fin = filtros.hasta
        ? new Date(`${filtros.hasta}T23:59:59.999-05:00`)
        : undefined;
      if (inicio && fin) {
        estrategias.push(new FiltroPorFecha(inicio, fin));
      } else if (inicio) {
        estrategias.push({
          aplicar: () => ({ fechaInicio: { gte: inicio } }),
        });
      } else {
        estrategias.push({
          aplicar: () => ({ fechaInicio: { lte: fin } }),
        });
      }
    }
    if (!filtros.desde && !filtros.hasta && (filtros.orden || 'fecha') === 'fecha') {
      const ahora = new Date();
      estrategias.push({
        aplicar: () => ({
          OR: [
            { fechaFin: { gte: ahora } },
            { fechaFin: null, fechaInicio: { gte: ahora } },
          ],
        }),
      });
    }
    if (filtros.precioMin !== undefined || filtros.precioMax !== undefined) {
      estrategias.push(new FiltroPorPrecio(filtros.precioMin, filtros.precioMax));
    }

    const whereCombinado: Prisma.EventoWhereInput = estrategias.length > 0
      ? { AND: estrategias.map(e => e.aplicar()) }
      : {};

    return repo.findAprobados(
      whereCombinado,
      filtros.pagina || 1,
      filtros.limite || 12,
      filtros.orden || 'fecha',
      filtros.q,
    );
  }

  async obtenerPorSlug(slug: string) {
    const evento = await repo.findBySlug(slug);
    if (!evento) throw new Error('Evento no encontrado');
    if (evento.estadoPublicacion !== 'APROBADO' ||
      (evento.organizador && (evento.organizador.estado !== 'VERIFICADO' || evento.organizador.vetado))) {
      throw new Error('Evento no encontrado');
    }
    return evento;
  }

  async listarTodos() {
    return repo.findTodos();
  }

  async listarPendientes() {
    return repo.findPendientes();
  }

  // ── Crear evento (con horaCierre y direccion) ──
  async crear(data: CrearEventoDTO) {
    const slug = generarSlug(data.titulo);
    const esOrganizadorVerificado = data.organizadorEstado === 'VERIFICADO';
    const estadoPublicacion = esOrganizadorVerificado ? 'APROBADO' : 'PENDIENTE';

    const evento = await repo.create({
      titulo:                 data.titulo,
      descripcion:            data.descripcion,
      fechaInicio:            new Date(data.fechaInicio),
      fechaFin:               data.fechaFin ? new Date(data.fechaFin) : undefined,
      horaApertura:           data.horaApertura,
      horaCierre:             data.horaCierre,
      direccion:              data.direccion,
      precioReferencial:      data.precioReferencial,
      esMayorDeEdad:          data.esMayorDeEdad ?? false,
      imagenUrl:              data.imagenUrl,
      publicIdImagen:         data.publicIdImagen,
      slug,
      estadoPublicacion,
      categoria:  { connect: { id: data.categoriaId } },
      lugar:      { connect: { id: data.lugarId } },
      ciudad:     { connect: { id: data.ciudadId } },
      organizador: data.organizadorId
        ? { connect: { id: data.organizadorId } }
        : undefined,
    }, data.organizadorId);
    this.invalidarCacheIA();

    if (estadoPublicacion === 'APROBADO') {
      await eventoAprobadoSubject.notificarTodos({
        eventoId:        evento.id,
        titulo:          evento.titulo,
        categoriaId:     evento.categoria.id,
        categoriaNombre: evento.categoria.nombre,
        fechaInicio:     evento.fechaInicio,
        lugarNombre:     evento.lugar.nombre,
      });
    }

    return evento;
  }

  // ── Admin: aprobar evento pendiente → dispara Observer ──
  async aprobar(id: number) {
    const evento = await repo.findById(id);
    if (!evento) throw new Error('Evento no encontrado');
    if (evento.estadoPublicacion === 'APROBADO') {
      throw new Error('El evento ya está aprobado');
    }

    const aprobado = await repo.aprobar(id);
    this.invalidarCacheIA();

    await eventoAprobadoSubject.notificarTodos({
      eventoId:        aprobado.id,
      titulo:          aprobado.titulo,
      categoriaId:     aprobado.categoria.id,
      categoriaNombre: aprobado.categoria.nombre,
      fechaInicio:     aprobado.fechaInicio,
      lugarNombre:     aprobado.lugar.nombre,
    });

    return aprobado;
  }

  // ── Admin: rechazar evento ──
  async rechazar(id: number, motivo: string) {
    const evento = await repo.findById(id);
    if (!evento) throw new Error('Evento no encontrado');
    if (!motivo || motivo.trim().length === 0) {
      throw new Error('Debes indicar el motivo del rechazo');
    }
    const rechazado = await repo.rechazar(id, motivo.trim());
    this.invalidarCacheIA();
    return rechazado;
  }

  // ── Admin: destacar o quitar destacado ──
  async destacar(id: number, destacado: boolean) {
    const evento = await repo.findById(id);
    if (!evento) throw new Error('Evento no encontrado');

    const actualizado = await repo.updateDestacado(id, destacado);
    this.invalidarCacheIA();
    return actualizado;
  }

  // ── Eliminar ──
  async eliminar(id: number, motivo: string) {
    const evento = await repo.findById(id);
    if (!evento) throw new Error('Evento no encontrado');
    await repo.delete(id, motivo);
    await this.eliminarImagen(evento.id, evento.publicIdImagen);
    this.invalidarCacheIA();
  }

  async eliminarFinalizados(now = new Date()): Promise<number> {
    const eliminados = await repo.deleteFinalizedEvents(now);
    for (const evento of eliminados) {
      await this.eliminarImagen(evento.id, evento.publicIdImagen);
    }
    if (eliminados.length > 0) {
      this.invalidarCacheIA();
      logger.info({ job: 'eventos-finalizados', eliminados: eliminados.length });
    }
    return eliminados.length;
  }

  private async eliminarImagen(eventoId: number, publicIdImagen: string | null): Promise<void> {
    if (!publicIdImagen) return;
    try {
      const resultado = await uploadService.eliminarImagen(publicIdImagen);
      if (resultado.result !== 'ok') {
        logger.warn({
          mensaje: 'No se pudo eliminar la imagen del evento',
          eventoId,
          publicIdImagen,
          resultado: resultado.result,
        });
      }
    } catch (error) {
      logger.warn({
        mensaje: 'Falló la eliminación de la imagen del evento',
        eventoId,
        publicIdImagen,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
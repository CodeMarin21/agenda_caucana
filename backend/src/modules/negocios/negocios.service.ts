import {
  CategoriaNegocio,
  EstadoNegocio,
  Prisma,
} from '@prisma/client';
import { NegociosRepository, FiltrosNegocios } from './negocios.repository';
import {
  withCache,
  CacheKeyBuilder,
  getCacheService,
} from '../../cache';

export interface PlatoDTO {
  nombre: string;
  precio: number;
  imagenUrl: string;
}

export interface CrearNegocioDTO {
  nombre: string;
  descripcion: string;
  direccion: string;
  ciudadId: number;
  telefono?: string;
  whatsapp?: string;
  instagram?: string;
  horarioAtencion?: string;
  categoria: CategoriaNegocio;
  precioPromedio?: number;
  imagenPrincipalUrl?: string;
  imagenesAdicionales?: string[];
  platos?: PlatoDTO[];
}

const repo = new NegociosRepository();

function generarSlug(nombre: string): string {
  return `${nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')}-${Date.now()}`;
}

/**
 * Versión cacheable del listado. Solo se invoca cuando el llamador
 * ya decidió que la petición es cacheable (pagina 1, sin búsqueda q).
 * La clave incluye TODOS los filtros para evitar colisiones.
 */
const listarAprobadosCached = withCache(
  (filtros: FiltrosNegocios) => repo.findAll(filtros),
  {
    key: (filtros: FiltrosNegocios) =>
      CacheKeyBuilder.create()
        .ns('negocios')
        .entity('list')
        .attr('cat', filtros.categoria ?? '_')
        .attr('ciud', filtros.ciudadId ?? '_')
        .attr('precio', filtros.precioMax ?? '_')
        .attr('orden', filtros.orden)
        .attr('pag', filtros.pagina)
        .attr('lim', filtros.limite)
        .build(),
    ttlMs: 300_000,
  },
);

export class NegociosService {
  /**
   * Invalida el listado cacheado tras una mutación para evitar datos obsoletos.
   */
  private invalidarCacheListado(): void {
    getCacheService().delByPrefix(
      CacheKeyBuilder.create().ns('negocios').entity('list').prefix(),
    );
  }

  async listarAprobados(filtros: FiltrosNegocios) {
    // Bypass de cache cuando la petición no es cacheable:
    //  - paginación > 1 (muchas variantes)
    //  - búsqueda de texto (espacio de claves no acotado)
    const esPrimeraPaginaSinBusqueda = filtros.pagina === 1 && !filtros.q;
    if (!esPrimeraPaginaSinBusqueda) {
      return repo.findAll(filtros);
    }
    return listarAprobadosCached(filtros);
  }

  async obtenerPorSlug(slug: string) {
    const negocio = await repo.findBySlug(slug);
    if (!negocio) throw new Error('Negocio no encontrado');
    return negocio;
  }

  async listarDelOrganizador(organizadorId: number) {
    return repo.findByOrganizadorId(organizadorId);
  }

  async crear(data: CrearNegocioDTO, usuarioId: number) {
    const organizador = await repo.findOrganizadorByUsuarioId(usuarioId);
    if (!organizador) throw new Error('No tienes perfil de organizador');
    if (organizador.vetado) throw new Error('La cuenta del organizador está vetada');

    const estadoPublicacion = organizador.estado === 'VERIFICADO'
      ? EstadoNegocio.APROBADO
      : EstadoNegocio.PENDIENTE;
    const datos: Prisma.NegocioCreateInput = {
      nombre: data.nombre.trim(),
      descripcion: data.descripcion.trim(),
      direccion: data.direccion.trim(),
      telefono: data.telefono,
      whatsapp: data.whatsapp,
      instagram: data.instagram,
      horarioAtencion: data.horarioAtencion,
      categoria: data.categoria,
      precioPromedio: data.precioPromedio,
      imagenPrincipalUrl: data.imagenPrincipalUrl,
      imagenesAdicionales: data.imagenesAdicionales,
      ...(data.platos && data.platos.length > 0
        ? { platos: data.platos.map((plato) => ({
          nombre: plato.nombre,
          precio: plato.precio,
          imagenUrl: plato.imagenUrl,
        })) }
        : {}),
      slug: generarSlug(data.nombre),
      estadoPublicacion,
      ciudad: { connect: { id: data.ciudadId } },
      organizador: { connect: { id: organizador.id } },
    };
    const negocio = await repo.create(datos);
    this.invalidarCacheListado();
    return negocio;
  }

  async misNegocios(usuarioId: number) {
    const organizador = await repo.findOrganizadorByUsuarioId(usuarioId);
    if (!organizador) throw new Error('No tienes perfil de organizador');
    return repo.findByOrganizadorId(organizador.id);
  }

  async eliminar(id: number, usuarioId?: number, esAdmin = false, motivo?: string) {
    const negocio = await repo.findById(id);
    if (!negocio) throw new Error('Negocio no encontrado');
    if (!esAdmin) {
      if (!usuarioId) throw new Error('No autenticado');
      const organizador = await repo.findOrganizadorByUsuarioId(usuarioId);
      if (!organizador || negocio.organizadorId !== organizador.id) {
        throw new Error('No tienes permiso para eliminar este negocio');
      }
    }
    const resultado = await repo.delete(id, esAdmin ? motivo : undefined);
    this.invalidarCacheListado();
    return resultado;
  }

  async destacar(id: number, destacado: boolean) {
    const negocio = await repo.findById(id);
    if (!negocio) throw new Error('Negocio no encontrado');
    const actualizado = await repo.update(id, { destacado });
    this.invalidarCacheListado();
    return actualizado;
  }

  async calificar(negocioId: number, ipHash: string, estrellas: number, comentario?: string) {
    const negocio = await repo.findById(negocioId);
    if (!negocio || negocio.estadoPublicacion !== EstadoNegocio.APROBADO || !negocio.activo) {
      throw new Error('Negocio no encontrado');
    }

    const hace24Horas = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const calificacionesRecientes = await repo.countCalificacionesRecientes(
      negocioId,
      ipHash,
      hace24Horas
    );
    if (calificacionesRecientes > 0) {
      throw new Error('Ya calificaste este negocio en las últimas 24 horas.');
    }

    const calificacion = await repo.crearCalificacion({
      negocioId,
      ipHash,
      estrellas,
      comentario: comentario?.trim() || null,
    });
    this.invalidarCacheListado();
    return calificacion;
  }

  async aprobar(id: number) {
    const negocio = await repo.findById(id);
    if (!negocio) throw new Error('Negocio no encontrado');
    if (negocio.estadoPublicacion === EstadoNegocio.APROBADO) {
      throw new Error('El negocio ya está aprobado');
    }
    const resultado = await repo.aprobar(id);
    this.invalidarCacheListado();
    return resultado;
  }

  async rechazar(id: number, motivo: string) {
    const negocio = await repo.findById(id);
    if (!negocio) throw new Error('Negocio no encontrado');
    if (motivo.trim().length < 5) {
      throw new Error('Debes indicar el motivo del rechazo (mínimo 5 caracteres)');
    }
    const resultado = await repo.rechazar(id, motivo.trim());
    this.invalidarCacheListado();
    return resultado;
  }

  async listarTodos() {
    return repo.findTodos();
  }

  async listarPendientes() {
    return repo.findPendientes();
  }
}

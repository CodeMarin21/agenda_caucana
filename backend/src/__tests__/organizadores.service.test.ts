import { Prisma } from '@prisma/client';
import { OrganizadoresRepository } from '../modules/organizadores/organizadores.repository';
import { OrganizadoresService } from '../modules/organizadores/organizadores.service';

type PerfilConUsuario = NonNullable<
  Awaited<ReturnType<OrganizadoresRepository['buscarPorUsuarioIdConUsuario']>>
>;

const crearPerfil = (vetado = false): PerfilConUsuario => {
  const ahora = new Date('2026-11-20T12:00:00.000Z');
  return {
    id: 8,
    usuarioId: 12,
    nombreEntidad: 'Entidad de prueba',
    descripcion: null,
    telefono: null,
    redesSociales: null,
    nit: null,
    avatarUrl: null,
    estado: 'PENDIENTE',
    especialidad: 'POR_DEFINIR',
    motivoEstado: null,
    detalleMotivoEstado: null,
    creadoEn: ahora,
    actualizadoEn: ahora,
    negocioCreado: false,
    direccion: null,
    ciudadBaseId: null,
    anioFundacion: null,
    tipoEntidad: null,
    documentoIdentidadCifrado: 'cifrado-existente',
    documentoIdentidadHash: 'hash-existente',
    vetado,
    motivoVeto: vetado ? 'Veto permanente: prueba' : null,
    vetadoEn: vetado ? ahora : null,
    vetadoPorId: null,
    motivoReactivacion: null,
    detalleReactivacion: null,
    reactivadoEn: null,
    reactivadoPorId: null,
    usuario: {
      id: 12,
      nombre: 'Contacto de prueba',
      email: 'contacto@example.test',
      notificaciones: [],
    },
    ciudadBase: null,
    negocio: null,
    _count: { eventos: 0 },
  };
};

class PerfilRepositoryFake extends OrganizadoresRepository {
  perfil = crearPerfil();
  actualizaciones = 0;

  override async buscarPorUsuarioIdConUsuario() {
    return this.perfil;
  }

  override async buscarPorUsuarioId() {
    return this.perfil;
  }

  override async actualizar(_id: number, data: Prisma.OrganizadorUpdateInput) {
    this.actualizaciones += 1;
    if (typeof data.nombreEntidad === 'string') this.perfil.nombreEntidad = data.nombreEntidad;
    return this.perfil;
  }
}

describe('OrganizadoresService perfil con clave de identidad inválida', () => {
  const claveOriginal = process.env.IDENTIDAD_ENCRYPTION_KEY;
  let repo: PerfilRepositoryFake;
  let service: OrganizadoresService;

  beforeEach(() => {
    process.env.IDENTIDAD_ENCRYPTION_KEY = 'clave-invalida';
    repo = new PerfilRepositoryFake();
    service = new OrganizadoresService(repo);
  });

  afterAll(() => {
    if (claveOriginal === undefined) {
      delete process.env.IDENTIDAD_ENCRYPTION_KEY;
    } else {
      process.env.IDENTIDAD_ENCRYPTION_KEY = claveOriginal;
    }
  });

  it('carga los datos no sensibles e informa que conserva el documento cifrado', async () => {
    const perfil = await service.obtenerPerfil(12);

    expect(perfil.nombreEntidad).toBe('Entidad de prueba');
    expect(perfil.tieneDocumento).toBe(true);
    expect(perfil.documentoIdentidadEnmascarado).toBeNull();
    expect(perfil.advertenciaDocumento).toContain('clave de cifrado');
  });

  it('permite actualizar datos generales sin tocar el documento cifrado', async () => {
    const perfil = await service.actualizarPerfil(12, {
      nombreEntidad: 'Entidad actualizada',
    });

    expect(perfil.nombreEntidad).toBe('Entidad actualizada');
    expect(perfil.advertenciaDocumento).toContain('clave de cifrado');
    expect(repo.perfil.documentoIdentidadCifrado).toBe('cifrado-existente');
    expect(repo.perfil.documentoIdentidadHash).toBe('hash-existente');
    expect(repo.actualizaciones).toBe(1);
  });

  it('no modifica documentos cuando la clave de identidad es inválida', async () => {
    await expect(
      service.actualizarPerfil(12, { documentoIdentidad: '12345678' })
    ).rejects.toThrow('64 caracteres hex');
    expect(repo.actualizaciones).toBe(0);
    expect(repo.perfil.documentoIdentidadCifrado).toBe('cifrado-existente');
  });

  it('mantiene bloqueadas las actualizaciones de cuentas vetadas', async () => {
    repo.perfil = crearPerfil(true);

    await expect(
      service.actualizarPerfil(12, { nombreEntidad: 'No debe cambiar' })
    ).rejects.toThrow('Tu cuenta está vetada');
    expect(repo.actualizaciones).toBe(0);
  });
});

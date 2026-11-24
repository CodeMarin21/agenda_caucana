import { CategoriaNegocio, EstadoOrganizador, EspecialidadOrganizador } from '@prisma/client';
import { NegociosRepository } from '../modules/negocios/negocios.repository';
import { ActualizarNegocioDTO, CrearNegocioDTO, NegociosService } from '../modules/negocios/negocios.service';

type OrganizadorNegocio = NonNullable<
  Awaited<ReturnType<NegociosRepository['findOrganizadorByUsuarioId']>>
>;

const crearOrganizador = (
  negocioId: number | null,
  negocioCreado = negocioId !== null,
): OrganizadorNegocio => ({
  id: 8,
  estado: EstadoOrganizador.VERIFICADO,
  vetado: false,
  especialidad: EspecialidadOrganizador.GASTRONOMIA,
  nombreEntidad: 'Restaurante de prueba',
  descripcion: null,
  negocioCreado,
  negocio: negocioId === null ? null : { id: negocioId },
  _count: { eventos: 0 },
});

const datosCrear: CrearNegocioDTO = {
  nombre: 'Restaurante de prueba',
  descripcion: 'Descripción de prueba suficientemente extensa.',
  direccion: 'Calle 5 # 4-30',
  ciudadId: 1,
  categoria: CategoriaNegocio.TRADICIONAL_CAUCANA,
};

const datosActualizar: ActualizarNegocioDTO = {
  ...datosCrear,
  platos: [],
};

describe('NegociosService organizer publication limits', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('prevents an organizer from creating a second business', async () => {
    const findOrganizer = jest.spyOn(NegociosRepository.prototype, 'findOrganizadorByUsuarioId')
      .mockResolvedValue(crearOrganizador(25));
    const create = jest.spyOn(NegociosRepository.prototype, 'create');
    const service = new NegociosService();

    await expect(service.crear(datosCrear, 12))
      .rejects.toThrow('Ya tienes un negocio registrado');

    expect(findOrganizer).toHaveBeenCalledWith(12);
    expect(create).not.toHaveBeenCalled();
  });

  it('does not allow creating another business after an administrator removed the first one', async () => {
    jest.spyOn(NegociosRepository.prototype, 'findOrganizadorByUsuarioId')
      .mockResolvedValue(crearOrganizador(null, true));
    const create = jest.spyOn(NegociosRepository.prototype, 'create');
    const service = new NegociosService();

    await expect(service.crear(datosCrear, 12))
      .rejects.toThrow('Ya tienes un negocio registrado');

    expect(create).not.toHaveBeenCalled();
  });

  it('does not allow editing another organizer business', async () => {
    const findOrganizer = jest.spyOn(NegociosRepository.prototype, 'findOrganizadorByUsuarioId')
      .mockResolvedValue(crearOrganizador(25));
    const findOwnedBusiness = jest.spyOn(NegociosRepository.prototype, 'findByIdAndOrganizador')
      .mockResolvedValue(null);
    const update = jest.spyOn(NegociosRepository.prototype, 'update');
    const service = new NegociosService();

    await expect(service.actualizar(44, datosActualizar, 12))
      .rejects.toThrow('No tienes permiso para modificar este negocio');

    expect(findOrganizer).toHaveBeenCalledWith(12);
    expect(findOwnedBusiness).toHaveBeenCalledWith(44, 8);
    expect(update).not.toHaveBeenCalled();
  });

  it('updates the owner business menu from the submitted dish list', async () => {
    jest.spyOn(NegociosRepository.prototype, 'findOrganizadorByUsuarioId')
      .mockResolvedValue(crearOrganizador(25));
    jest.spyOn(NegociosRepository.prototype, 'findByIdAndOrganizador')
      .mockResolvedValue({ id: 25 });
    const update = jest.spyOn(NegociosRepository.prototype, 'update')
      .mockResolvedValue({ id: 25 } as never);
    const service = new NegociosService();
    const platos = [
      { nombre: 'Empanada de pipián', precio: 5000, imagenUrl: 'https://example.com/empanada.jpg' },
      { nombre: 'Tamal de pipián', precio: 10000, imagenUrl: 'https://example.com/tamal.jpg' },
    ];

    await service.actualizar(25, { ...datosActualizar, platos }, 12);

    expect(update).toHaveBeenCalledWith(
      25,
      expect.objectContaining({ platos }),
    );
  });

  it('lets an organizer delete only their own business and releases their creation slot', async () => {
    jest.spyOn(NegociosRepository.prototype, 'findById')
      .mockResolvedValue({ id: 25, organizadorId: 8 } as never);
    jest.spyOn(NegociosRepository.prototype, 'findOrganizadorByUsuarioId')
      .mockResolvedValue(crearOrganizador(25));
    const remove = jest.spyOn(NegociosRepository.prototype, 'delete')
      .mockResolvedValue({ id: 25 } as never);
    const service = new NegociosService();

    await service.eliminar(25, 12, false);

    expect(remove).toHaveBeenCalledWith(25, undefined, true);
  });

  it('does not allow an organizer to delete someone else’s business', async () => {
    jest.spyOn(NegociosRepository.prototype, 'findById')
      .mockResolvedValue({ id: 25, organizadorId: 99 } as never);
    jest.spyOn(NegociosRepository.prototype, 'findOrganizadorByUsuarioId')
      .mockResolvedValue(crearOrganizador(25));
    const remove = jest.spyOn(NegociosRepository.prototype, 'delete');
    const service = new NegociosService();

    await expect(service.eliminar(25, 12, false))
      .rejects.toThrow('No tienes permiso para eliminar este negocio');

    expect(remove).not.toHaveBeenCalled();
  });
});

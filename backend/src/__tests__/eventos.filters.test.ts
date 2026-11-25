import { FiltroPorFecha } from '../patterns/strategy/FiltroPorFecha';
import { FiltroPorPrecio } from '../patterns/strategy/FiltroPorPrecio';

describe('Filtros públicos de eventos', () => {
  it('solo incluye eventos cuya fecha de inicio está dentro del rango seleccionado', () => {
    const desde = new Date('2026-11-10T05:00:00.000Z');
    const hasta = new Date('2026-11-12T04:59:59.999Z');

    expect(new FiltroPorFecha(desde, hasta).aplicar()).toEqual({
      fechaInicio: { gte: desde, lte: hasta },
    });
  });

  it('incluye los eventos sin precio en los filtros de precio, igual que la etiqueta Gratis', () => {
    expect(new FiltroPorPrecio(undefined, 0).aplicar()).toEqual({
      OR: [
        { precioReferencial: { lte: 0 } },
        { precioReferencial: null },
      ],
    });
  });

  it('matches an exact ticket price without including events with an unknown price', () => {
    expect(new FiltroPorPrecio(15000, 15000).aplicar()).toEqual({
      precioReferencial: { gte: 15000, lte: 15000 },
    });
  });
});

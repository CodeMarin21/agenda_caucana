import { Prisma } from '@prisma/client';
import { detectIntent } from '../modules/ai/ai.intent';
import {
  responderComoLlegarNegocio,
  responderEventoNoEncontrado,
  responderPrecioEntradaEvento,
  responderEventosPorPeriodo,
  responderRecomendacionNegocios,
  responderNegocios,
} from '../modules/ai/catalogo.responses';
import { NegocioContexto } from '../modules/ai/ai.types';
import { EventoContexto } from '../modules/ai/ai.types';

const negocio: NegocioContexto = {
  id: 1,
  slug: 'suculentas-de-juanita',
  nombre: 'Suculentas de Juanita',
  descripcion: 'Comida rápida en Popayán',
  direccion: 'Cl. 25 #15-05',
  telefono: null,
  whatsapp: null,
  horarioAtencion: null,
  categoria: 'COMIDA_RAPIDA',
  precioPromedio: 12000,
  platos: [{ nombre: 'Salchipapa sencilla', precio: 12000 }] as Prisma.JsonValue,
  ciudad: { nombre: 'Popayán' },
};

describe('respuestas de negocios', () => {
  it('classifies a group-size follow-up as a business recommendation', () => {
    expect(detectIntent('somos 4 personas cual me recomiendas?')).toMatchObject({
      type: 'NEGOCIO_RECOMENDACION',
      personas: 4,
    });
  });

  it('distinguishes a requested target price from a maximum budget and suggests nearby prices', () => {
    const intent = detectIntent('Quisiera una salchipapa de 20 mil pesos');
    expect(intent).toMatchObject({
      type: 'NEGOCIO_BUSQUEDA',
      presupuesto: 20000,
      tipoPresupuesto: 'objetivo',
    });

    const respuesta = responderNegocios(
      [negocio],
      ['salchipapa'],
      'es',
      20000,
      undefined,
      'objetivo',
    );
    expect(respuesta).toContain('No encontré una opción de aproximadamente');
    expect(respuesta).toContain('Suculentas de Juanita');
    expect(respuesta).toContain('$12.000 COP');
    expect(respuesta).not.toContain('Encontré:');
  });

  it('keeps explicit less-than budgets as a maximum', () => {
    expect(detectIntent('salchipapa por menos de 5 mil pesos')).toMatchObject({
      presupuesto: 5000,
      tipoPresupuesto: 'maximo',
    });
  });

  describe('respuestas de eventos por periodo', () => {
    const periodo = {
      desde: new Date('2026-11-28T05:00:00.000Z'),
      hasta: new Date('2026-11-30T05:00:00.000Z'),
      rangoDias: true,
    };

    it('states the requested event topic when there are no matching publications', () => {
      const respuesta = responderEventosPorPeriodo([], 'es', periodo, false, ['musica']);

      expect(respuesta).toContain('No encontré eventos publicados de música');
      expect(respuesta).toContain('28 de noviembre de 2026');
      expect(respuesta).toContain('29 de noviembre de 2026');
    });

    describe('respuestas sobre el precio de entrada', () => {
      const eventoBase: EventoContexto = {
        id: 15,
        titulo: 'Popayán Música de Cámara Festival Internacional',
        slug: 'popayan-musica-camara',
        descripcion: 'Concierto de prueba.',
        fechaInicio: new Date('2026-11-23T23:24:00.000Z'),
        fechaFin: new Date('2026-11-28T23:20:00.000Z'),
        horaApertura: null,
        direccion: null,
        precioReferencial: 0,
        esMayorDeEdad: false,
        categoria: { nombre: 'Música' },
        lugar: { nombre: 'Teatro', direccion: 'Centro' },
        ciudad: { nombre: 'Popayán' },
      };

      it('confirms free entry only when the published price is zero', () => {
        expect(responderPrecioEntradaEvento(eventoBase, 'es'))
          .toContain('Sí. La publicación indica que la entrada es libre');
      });

      it('does not interpret an unspecified price as free entry', () => {
        expect(responderPrecioEntradaEvento({ ...eventoBase, precioReferencial: null }, 'es'))
          .toContain('no puedo confirmar si es libre');
      });

      it('returns the exact published ticket price for paid events', () => {
        expect(responderPrecioEntradaEvento({ ...eventoBase, precioReferencial: 25000 }, 'es'))
          .toContain('cuesta $25.000 COP');
      });
    });

    it('states the requested music topic when a non-period search has no matches', () => {
      expect(responderEventoNoEncontrado(['musica'], 'es'))
        .toBe('No encontré eventos publicados de música en la agenda.');
    });

    it('lists only the supplied matching events under the requested topic', () => {
      const evento: EventoContexto = {
        id: 15,
        titulo: 'Popayán Música de Cámara Festival Internacional',
        slug: 'musica-de-camara',
        descripcion: 'Concierto de artistas locales.',
        fechaInicio: new Date('2026-11-23T23:24:00.000Z'),
        fechaFin: new Date('2026-11-28T23:20:00.000Z'),
        horaApertura: null,
        direccion: null,
        precioReferencial: 0,
        esMayorDeEdad: false,
        categoria: { nombre: 'Música' },
        lugar: { nombre: 'Teatro Municipal Guillermo Valencia', direccion: 'Centro' },
        ciudad: { nombre: 'Popayán' },
      };

      const respuesta = responderEventosPorPeriodo([evento], 'es', periodo, false, ['musica']);

      expect(respuesta).toContain('eventos publicados de música');
      expect(respuesta).toContain('durante el periodo del 28 de noviembre de 2026 al 29 de noviembre de 2026');
      expect(respuesta).not.toContain('para del');
      expect(respuesta).toContain('Popayán Música de Cámara');
      expect(respuesta).not.toContain('SalchiFest');
    });
  });

  it('returns a direct map link using the published business address', () => {
    const respuesta = responderComoLlegarNegocio(negocio, 'es');
    expect(respuesta).toContain('google.com/maps/search/?api=1');
    expect(respuesta).toContain(encodeURIComponent('Cl. 25 #15-05'));
  });

  it('localizes nearby-price recommendations', () => {
    expect(responderNegocios([negocio], ['salchipapa'], 'en', 20000, undefined, 'objetivo'))
      .toContain("I couldn't find an option at about");
    expect(responderNegocios([negocio], ['salchipapa'], 'fr', 20000, undefined, 'objetivo'))
      .toContain('Je n’ai trouvé aucune option autour de');
  });

  it('recommends only a dish whose published description matches the group size', () => {
    const pizza: NegocioContexto = {
      ...negocio,
      id: 14,
      slug: 'forno-urbano-pizza',
      nombre: 'Forno Urbano Pizza',
      platos: [
        { nombre: 'Pizza Hawaiana', precio: 23, descripcion: 'Para dos personas' },
        { nombre: 'Pizza Pepperoni Grande', precio: 24, descripcion: 'Pizza grande de pepperoni' },
        { nombre: 'Pizza Pollo y Champiñones', precio: 30, descripcion: 'Pizza familiar. Para 4 personas' },
      ] as Prisma.JsonValue,
    };

    const respuesta = responderRecomendacionNegocios([pizza], 4, 'es');

    expect(respuesta).toContain('Pizza Pollo y Champiñones');
    expect(respuesta).toContain('$30 COP');
    expect(respuesta).toContain('indica que alcanza para 4');
    expect(respuesta).not.toContain('Pizza Hawaiana');
    expect(respuesta).not.toContain('evento.html');
  });

  it('does not claim a serving size that is absent from the published menu', () => {
    const respuesta = responderRecomendacionNegocios([negocio], 4, 'es');

    expect(respuesta).toContain('No encontré un plato cuya ficha indique');
    expect(respuesta).not.toContain('te recomiendo');
  });
});

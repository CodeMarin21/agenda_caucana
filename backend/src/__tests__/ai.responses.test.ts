import { Prisma } from '@prisma/client';
import { detectIntent } from '../modules/ai/ai.intent';
import {
  responderComoLlegarNegocio,
  responderNegocios,
} from '../modules/ai/catalogo.responses';
import { NegocioContexto } from '../modules/ai/ai.types';

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
});

import {
  detectIntent,
  esPreguntaPrecioEntradaEvento,
  esPreguntaSeguimientoEvento,
} from '../modules/ai/ai.intent';
import { extraerFiltroTemporal } from '../modules/ai/ai.temporal';

describe('Interpretación temporal del chat', () => {
  const ahora = new Date('2026-11-20T15:00:00.000Z');

  it('entiende el día solicitado aunque el nombre del mes tenga un error de escritura', () => {
    const intent = detectIntent(
      'que eventos hay disponibles para el este 20 de nvoeimbre',
      undefined,
      ahora,
    );

    expect(intent.type).toBe('EVENTO_BUSQUEDA');
    if (intent.type !== 'EVENTO_BUSQUEDA') return;
    expect(intent.periodo).toEqual({
      desde: new Date('2026-11-20T05:00:00.000Z'),
      hasta: new Date('2026-11-21T05:00:00.000Z'),
      diaCompleto: true,
    });
    expect(intent.terminos).toEqual([]);
  });

  it('combines a month with a request for events that have already ended', () => {
    const intent = detectIntent('y en octubre y los que ya pasaron', undefined, ahora);

    expect(intent.type).toBe('EVENTO_BUSQUEDA');
    if (intent.type !== 'EVENTO_BUSQUEDA') return;
    expect(intent.periodo?.desde).toEqual(new Date('2026-10-01T05:00:00.000Z'));
    expect(intent.periodo?.hasta).toEqual(new Date('2026-11-01T05:00:00.000Z'));
    expect(intent.soloFinalizados).toBe(true);
    expect(intent.terminos).toEqual([]);
  });

  it('does not treat “día” as an event search term in date questions', () => {
    const hoy = detectIntent('que eventos hay el dia de hoy?', undefined, ahora);
    const fechaEspecifica = detectIntent('que eventos hay el dia 1 de noviembre', undefined, ahora);

    expect(hoy).toMatchObject({
      type: 'EVENTO_BUSQUEDA',
      terminos: [],
      periodo: {
        desde: new Date('2026-11-20T05:00:00.000Z'),
        hasta: new Date('2026-11-21T05:00:00.000Z'),
        diaCompleto: true,
        soloVigentes: true,
      },
    });
    expect(fechaEspecifica).toMatchObject({
      type: 'EVENTO_BUSQUEDA',
      terminos: [],
      periodo: {
        desde: new Date('2026-11-01T05:00:00.000Z'),
        hasta: new Date('2026-11-02T05:00:00.000Z'),
        diaCompleto: true,
      },
    });
  });

  it('detects requests for ended events without requiring the word evento', () => {
    const intent = detectIntent('muéstrame los que ya pasaron', undefined, ahora);

    expect(intent.type).toBe('EVENTO_BUSQUEDA');
    if (intent.type !== 'EVENTO_BUSQUEDA') return;
    expect(intent.soloFinalizados).toBe(true);
    expect(intent.periodo).toBeUndefined();
  });

  it('interprets this weekend as the upcoming Saturday and Sunday in Bogotá', () => {
    const periodo = extraerFiltroTemporal('hay eventos este fin de semana', ahora).periodo;

    expect(periodo).toEqual({
      desde: new Date('2026-11-21T05:00:00.000Z'),
      hasta: new Date('2026-11-23T05:00:00.000Z'),
      rangoDias: true,
    });
  });

  it('recognizes event-detail follow-ups without mistaking a new category search for one', () => {
    expect(esPreguntaSeguimientoEvento('cuando inicia y cuando termina el evento?')).toBe(true);
    expect(esPreguntaSeguimientoEvento('no hay eventos de musica?')).toBe(false);
    expect(esPreguntaSeguimientoEvento('la entrada es libre?')).toBe(true);
    expect(esPreguntaSeguimientoEvento('que eventos gratis hay hoy?')).toBe(false);
    expect(esPreguntaSeguimientoEvento('eventos gratis en Teatro Municipal')).toBe(false);
    expect(esPreguntaPrecioEntradaEvento('la entrada es libre?')).toBe(true);
  });

  it('treats “finde de semana” as a weekend and removes it from event search terms', () => {
    const intent = detectIntent(
      'que eventos de musica hay para este finde de semana?',
      undefined,
      new Date('2026-11-23T19:22:00-05:00'),
    );

    expect(intent.type).toBe('EVENTO_BUSQUEDA');
    if (intent.type !== 'EVENTO_BUSQUEDA') return;
    expect(intent.terminos).toEqual(['musica']);
    expect(intent.periodo).toEqual({
      desde: new Date('2026-11-28T05:00:00.000Z'),
      hasta: new Date('2026-11-30T05:00:00.000Z'),
      rangoDias: true,
    });
  });

  it('understands a misspelled Saturday and filters to its night hours', () => {
    const periodo = extraerFiltroTemporal(
      'eventos de musica para este sabadi en la noche',
      new Date('2026-11-23T19:22:00-05:00'),
    ).periodo;

    expect(periodo).toEqual({
      desde: new Date('2026-11-28T23:00:00.000Z'),
      hasta: new Date('2026-11-29T05:00:00.000Z'),
      diaCompleto: true,
    });
  });

  it('does not interpret “mañana en Popayán” as the morning time of day', () => {
    const periodo = extraerFiltroTemporal(
      'eventos para mañana en Popayan',
      new Date('2026-11-23T19:22:00-05:00'),
    ).periodo;

    expect(periodo?.desde).toEqual(new Date('2026-11-24T05:00:00.000Z'));
    expect(periodo?.hasta).toEqual(new Date('2026-11-25T05:00:00.000Z'));
  });

  it('marks today queries as currently available rather than already-finished events', () => {
    const periodo = extraerFiltroTemporal('eventos para hoy', new Date('2026-11-23T19:22:00-05:00')).periodo;

    expect(periodo?.soloVigentes).toBe(true);
  });

  it('keeps only the music topic when the user corrects a food/event mix-up', () => {
    expect(detectIntent('pero te pedi evento de musica no de comidas')).toMatchObject({
      type: 'EVENTO_BUSQUEDA',
      terminos: ['musica'],
    });
  });

  it('does not redirect a restaurant query with a month to event search', () => {
    expect(detectIntent('quiero comer en octubre', undefined, ahora).type).toBe('NEGOCIO_BUSQUEDA');
  });

  it('detects total budget and party size for food questions', () => {
    const intent = detectIntent(
      'Tengo 30 mil pesos, somos 4 personas, dónde hay salchipapas',
      undefined,
      ahora,
    );
    expect(intent.type).toBe('NEGOCIO_BUSQUEDA');
    if (intent.type !== 'NEGOCIO_BUSQUEDA') return;
    expect(intent.presupuesto).toBe(30000);
    expect(intent.personas).toBe(4);
  });

  it('routes broad food recommendations to the published-menu recommendation flow', () => {
    expect(detectIntent('dame recomendaciones de comidas')).toMatchObject({
      type: 'NEGOCIO_RECOMENDACION',
      criterio: 'recomendados',
      global: true,
      terminos: [],
    });
    expect(detectIntent('dame recomendaciones de comidas basadas en las reseñas')).toMatchObject({
      type: 'NEGOCIO_RECOMENDACION',
      criterio: 'recomendados',
      global: true,
      terminos: [],
    });
  });

  it('recognizes cheapest and recently published food requests without treating modifiers as search terms', () => {
    expect(detectIntent('cuáles son los platos más baratos?')).toMatchObject({
      type: 'NEGOCIO_RECOMENDACION',
      criterio: 'baratos',
      global: true,
      terminos: [],
    });
    expect(detectIntent('muéstrame los últimos platillos que fueron subidos')).toMatchObject({
      type: 'NEGOCIO_RECOMENDACION',
      criterio: 'recientes',
      global: true,
      terminos: [],
    });
  });

  it('ranks best events separately and applies free-entry and venue filters', () => {
    expect(detectIntent('¿Cuáles son los mejores eventos?')).toMatchObject({
      type: 'EVENTO_BUSQUEDA',
      orden: 'recomendados',
      terminos: [],
    });
    expect(detectIntent('¿Qué eventos quedan en el Teatro Municipal y son gratis?')).toMatchObject({
      type: 'EVENTO_BUSQUEDA',
      soloGratuitos: true,
      terminos: ['teatro', 'municipal'],
    });
  });
});

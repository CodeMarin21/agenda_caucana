import { detectIntent } from '../modules/ai/ai.intent';

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

  it('detects requests for ended events without requiring the word evento', () => {
    const intent = detectIntent('muéstrame los que ya pasaron', undefined, ahora);

    expect(intent.type).toBe('EVENTO_BUSQUEDA');
    if (intent.type !== 'EVENTO_BUSQUEDA') return;
    expect(intent.soloFinalizados).toBe(true);
    expect(intent.periodo).toBeUndefined();
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
});

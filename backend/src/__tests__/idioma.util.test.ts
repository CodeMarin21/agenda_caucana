import { inferirIdiomaPregunta } from '../modules/ai/idioma.util';

describe('inferirIdiomaPregunta', () => {
  it.each([
    ['¿Dónde puedo comer algo rico?', 'es'],
    ['Where can I find good food?', 'en'],
    ['Où puis-je trouver un bon restaurant ?', 'fr'],
  ] as const)('detects %s as %s', (pregunta, idioma) => {
    expect(inferirIdiomaPregunta(pregunta)).toBe(idioma);
  });

  it('returns null when the question has no language clues', () => {
    expect(inferirIdiomaPregunta('Popayán 2026')).toBeNull();
  });
});

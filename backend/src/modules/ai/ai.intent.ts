export type Intent =
  | { type: 'EVENTO_ESPECIFICO'; eventoId: number }
  | { type: 'GRATIS' }
  | { type: 'CATEGORIA'; categoria: string }
  | { type: 'GENERAL' };

const CATEGORIAS_CONOCIDAS = [
  'musica', 'musical', 'concierto', 'teatro', 'arte', 'gastronomia',
  'cultural', 'deportivo', 'danza', 'cine', 'literatura',
] as const;

/**
 * Detecta la intención de la pregunta para traer sólo los eventos
 * relevantes desde PostgreSQL (pre-filtrado del RAG).
 */
export function detectIntent(pregunta: string, eventoId?: number): Intent {
  if (eventoId) return { type: 'EVENTO_ESPECIFICO', eventoId };

  const q = pregunta
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (/\b(gratis|libre|free|sin costo|sin pagar|no pagar)\b/.test(q)) {
    return { type: 'GRATIS' };
  }

  const cat = CATEGORIAS_CONOCIDAS.find((c) => q.includes(c));
  if (cat) return { type: 'CATEGORIA', categoria: cat };

  return { type: 'GENERAL' };
}
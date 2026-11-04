export type Intent =
  | { type: 'EVENTO_ESPECIFICO'; eventoId: number }
  | { type: 'EVENTO_BUSQUEDA'; terminos: string[] }
  | { type: 'NEGOCIO_BUSQUEDA'; terminos: string[]; presupuesto?: number; personas?: number }
  | { type: 'GRATIS' }
  | { type: 'CATEGORIA'; categoria: string }
  | { type: 'GENERAL' };

const CATEGORIAS_CONOCIDAS = [
  'musica', 'musical', 'concierto', 'teatro', 'arte', 'gastronomia',
  'cultural', 'deportivo', 'danza', 'cine', 'literatura',
] as const;

const PALABRAS_VACIAS = new Set([
  'a', 'al', 'algun', 'algunos', 'algunas', 'alguien', 'algun', 'alrededor',
  'alguien', 'como', 'con', 'cual', 'cuales', 'cuando', 'cuanto', 'cuanta',
  'de', 'del', 'dime', 'donde', 'el', 'ella', 'en', 'es', 'esta', 'este',
  'estoy', 'hay', 'ir', 'la', 'las', 'lo', 'los', 'me', 'mi', 'mis', 'por',
  'para', 'que', 'quiero', 'quisiera', 'saber', 'ser', 'si', 'sobre', 'un',
  'una', 'unos', 'unas', 'ubicada', 'ubicado', 'ubicacion', 'visitar',
  'queda', 'quedo', 'pueda', 'puedo', 'gustaria', 'favor', 'gracias', 'hoy',
  'mañana', 'manana', 'personas', 'persona', 'pesos', 'cop', 'mil', 'k',
  'comer', 'comida', 'restaurante', 'lugar', 'lugares', 'negocio', 'negocios',
  'evento', 'eventos', 'agenda', 'popayan', 'cauca',
]);

const TERMINOS_EVENTO_EXPLICITO = /\b(feria|festival|concierto|exposicion|obra|teatro|evento|eventos|torneo|conferencia|libro|literatura|musica|danza|cine)\b/;
const TERMINOS_NEGOCIO = /\b(comer|comida|restaurante|negocio|salchipapa|salchipapas|salchippa|pizza|pizzeria|hamburguesa|hamburguesas|plato|platos|almuerzo|cena|desayuno|cafe|cafeteria|antojo|presupuesto|pesos|cop)\b/;

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}.,$ ]/gu, ' ');
}

function extraerTerminos(texto: string): string[] {
  const terminos = normalizar(texto)
    .split(/\s+/)
    .map((termino) => termino.replace(/[.,$]/g, ''))
    .filter((termino) =>
      termino.length > 2 &&
      !/^\d+$/.test(termino) &&
      !PALABRAS_VACIAS.has(termino)
    );
  return [...new Set(terminos)].slice(0, 5);
}

function extraerPresupuesto(texto: string): number | undefined {
  const normalizado = normalizar(texto);
  const enMiles = normalizado.match(/\b(\d+(?:[.,]\d+)?)\s*(?:mil|k)\b/);
  if (enMiles) {
    return Math.round(Number(enMiles[1].replace(',', '.')) * 1000);
  }

  const enPesos = normalizado.match(/(?:\$|cop\s*)(\d{1,3}(?:[. ]\d{3})+|\d{5,8})\b/);
  if (!enPesos) return undefined;
  const presupuesto = Number(enPesos[1].replace(/[. ]/g, ''));
  return Number.isFinite(presupuesto) ? presupuesto : undefined;
}

function extraerPersonas(texto: string): number | undefined {
  const numerico = normalizar(texto).match(/\b(\d{1,2})\s+personas?\b/);
  if (numerico) return Number(numerico[1]);
  if (/\btres\s+personas?\b/.test(normalizar(texto))) return 3;
  if (/\bdos\s+personas?\b/.test(normalizar(texto))) return 2;
  if (/\bcuatro\s+personas?\b/.test(normalizar(texto))) return 4;
  return undefined;
}

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

  const buscaNegocio = TERMINOS_NEGOCIO.test(q);
  if (buscaNegocio && !TERMINOS_EVENTO_EXPLICITO.test(q)) {
    return {
      type: 'NEGOCIO_BUSQUEDA',
      terminos: extraerTerminos(pregunta),
      presupuesto: extraerPresupuesto(pregunta),
      personas: extraerPersonas(pregunta),
    };
  }

  if (
    TERMINOS_EVENTO_EXPLICITO.test(q) ||
    (!buscaNegocio && /\b(cuando|donde|ubicacion|direccion)\b/.test(q))
  ) {
    return { type: 'EVENTO_BUSQUEDA', terminos: extraerTerminos(pregunta) };
  }

  if (/\b(gratis|libre|free|sin costo|sin pagar|no pagar)\b/.test(q)) {
    return { type: 'GRATIS' };
  }

  const cat = CATEGORIAS_CONOCIDAS.find((c) => q.includes(c));
  if (cat) return { type: 'CATEGORIA', categoria: cat };

  return { type: 'GENERAL' };
}
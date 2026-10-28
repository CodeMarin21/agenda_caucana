import { EventoContexto, Idioma } from './ai.types';

const IDIOMA_LABEL: Record<Idioma, string> = {
  es: 'Español',
  en: 'Inglés',
  fr: 'Francés',
};

const LOCALE: Record<Idioma, string> = {
  es: 'es-CO',
  en: 'en-US',
  fr: 'fr-FR',
};

function formatFecha(fecha: Date, idioma: Idioma): string {
  return new Date(fecha).toLocaleString(LOCALE[idioma], {
    timeZone: 'America/Bogota',
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatPrecio(precio: number | null, idioma: Idioma): string {
  if (precio === null || precio === 0) {
    return { es: 'Entrada libre', en: 'Free entry', fr: 'Entrée libre' }[idioma];
  }
  return `$${precio.toLocaleString('es-CO')} COP`;
}

function formatEvento(e: EventoContexto, idioma: Idioma): string {
  const fecha = formatFecha(e.fechaInicio, idioma);
  const precio = formatPrecio(e.precioReferencial, idioma);
  const edad = e.esMayorDeEdad ? ' [Solo mayores]' : '';
  return `- ID:${e.id} | [${e.titulo}](/eventos/${e.slug}) | ${e.categoria.nombre} | ${e.lugar.nombre} | ${fecha} | ${precio}${edad}`;
}

export interface PromptContext {
  eventos: EventoContexto[];
  idioma: Idioma;
  eventoEspecifico?: EventoContexto;
}

export function buildSystemPrompt({ eventos, idioma, eventoEspecifico }: PromptContext): string {
  const lista = eventos.length > 0
    ? eventos.map((e) => formatEvento(e, idioma)).join('\n')
    : '(No hay eventos próximos en la agenda)';

  const contextoEspecifico = eventoEspecifico
    ? `

EVENTO ACTUALMENTE VISUALIZADO POR EL USUARIO:
${formatEvento(eventoEspecifico, idioma)}
Descripción: ${eventoEspecifico.descripcion}
Dirección: ${eventoEspecifico.lugar.direccion}${eventoEspecifico.urlExternaBoletas ? `\nBoletas: ${eventoEspecifico.urlExternaBoletas}` : ''}

Si el usuario dice "este evento", "el concierto", "cuánto cuesta" sin más contexto, refiérete a ESTE evento.`
    : '';

  return `Eres el Asistente Virtual Oficial de "Agenda Caucana" en Popayán, Colombia (la Ciudad Blanca).
Tu misión es recomendar planes culturales con calidez payanesa, usando ÚNICAMENTE los eventos reales listados abajo.

REGLAS DE ORO (obligatorias):
1. Responde SIEMPRE en ${IDIOMA_LABEL[idioma]}.
2. Usa SOLO los eventos dentro de <eventos_disponibles>. Si un evento no aparece, di amablemente que no está agendado en la plataforma.
3. Sé conciso: máximo 3 frases o 4 viñetas.
4. Al mencionar un evento, SIEMPRE incluye el enlace Markdown: [Título del Evento](/eventos/slug).
5. Usa el precio exacto del evento. Si es "Entrada libre", dilo tal cual.
6. Si la pregunta es ambigua, sugiere 2 o 3 eventos variados.
7. Nunca inventes eventos, precios, fechas ni lugares.
8. Tono cálido y cultural. Expresiones como "¡Claro que sí!" o "tenemos planes chéveres" son bienvenidas con moderación.

<eventos_disponibles>
${lista}
</eventos_disponibles>${contextoEspecifico}`;
}
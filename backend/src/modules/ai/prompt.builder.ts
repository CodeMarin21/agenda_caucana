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
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatRangoFecha(evento: EventoContexto, idioma: Idioma): string {
  const inicio = formatFecha(evento.fechaInicio, idioma);
  if (!evento.fechaFin || evento.fechaFin.getTime() <= evento.fechaInicio.getTime()) return inicio;
  return `${inicio} — ${formatFecha(evento.fechaFin, idioma)}`;
}

function formatEstadoTemporal(evento: EventoContexto, ahora: Date, idioma: Idioma): string {
  const etiquetas = {
    es: { proximo: 'Próximo', curso: 'En curso', finalizado: 'Finalizado' },
    en: { proximo: 'Upcoming', curso: 'Ongoing', finalizado: 'Ended' },
    fr: { proximo: 'À venir', curso: 'En cours', finalizado: 'Terminé' },
  }[idioma];
  if (evento.fechaInicio > ahora) return etiquetas.proximo;
  if (evento.fechaFin && evento.fechaFin >= ahora) return etiquetas.curso;
  return etiquetas.finalizado;
}

function formatPrecio(precio: number | null, idioma: Idioma): string {
  if (precio === 0) {
    return { es: 'Entrada libre', en: 'Free entry', fr: 'Entrée libre' }[idioma];
  }
  if (precio === null) {
    return { es: 'Precio no informado', en: 'Price not listed', fr: 'Prix non indiqué' }[idioma];
  }
  return `$${precio.toLocaleString('es-CO')} COP`;
}

function formatEvento(e: EventoContexto, idioma: Idioma): string {
  const fecha = formatRangoFecha(e, idioma);
  const precio = formatPrecio(e.precioReferencial, idioma);
  const edad = e.esMayorDeEdad ? ' [Solo mayores]' : '';
  return `- ID:${e.id} | [${e.titulo}](/eventos/${e.slug}) | ${e.categoria.nombre} | ${e.lugar.nombre} | ${fecha} | ${idioma === 'es' ? 'Estado' : idioma === 'en' ? 'Status' : 'État'}: ${formatEstadoTemporal(e, new Date(), idioma)} | ${precio}${edad}`;
}

export interface PromptContext {
  eventos: EventoContexto[];
  idioma: Idioma;
  eventoEspecifico?: EventoContexto;
}

export function buildSystemPrompt({ eventos, idioma, eventoEspecifico }: PromptContext): string {
  const ahora = new Date();
  const fechaActual = ahora.toLocaleString(LOCALE[idioma], {
    timeZone: 'America/Bogota',
    dateStyle: 'full',
    timeStyle: 'short',
  });
  const lista = eventos.length > 0
    ? eventos.map((e) => formatEvento(e, idioma)).join('\n')
    : '(No hay eventos en el contexto consultado)';

  const contextoEspecifico = eventoEspecifico
    ? `

EVENTO ACTUALMENTE VISUALIZADO POR EL USUARIO:
${formatEvento(eventoEspecifico, idioma)}
Descripción: ${eventoEspecifico.descripcion}
Dirección: ${eventoEspecifico.lugar.direccion}

Si el usuario dice "este evento", "el concierto", "cuánto cuesta" sin más contexto, refiérete a ESTE evento.`
    : '';

  return `Eres el Asistente Virtual Oficial de "Agenda Caucana" en Popayán, Colombia (la Ciudad Blanca).
Tu misión es recomendar planes culturales con calidez payanesa, usando ÚNICAMENTE los eventos reales listados abajo.
Fecha y hora actual en Popayán: ${fechaActual}.

REGLAS DE ORO (obligatorias):
1. Responde SIEMPRE en ${IDIOMA_LABEL[idioma]}.
2. Usa SOLO los eventos dentro de <eventos_disponibles>. Si un evento no aparece, di amablemente que no está agendado en la plataforma.
3. Sé conciso: máximo 3 frases o 4 viñetas.
4. Al mencionar un evento, SIEMPRE incluye el enlace Markdown: [Título del Evento](/eventos/slug).
5. Usa el precio exacto del evento. Solo afirma que la entrada es libre si el precio publicado es 0. Si el precio es null o no está informado, indícalo sin asumir que es gratis.
6. Si la pregunta es ambigua, sugiere 2 o 3 eventos variados.
7. Nunca inventes eventos, precios, fechas ni lugares.
8. Tono cálido y cultural. Expresiones como "¡Claro que sí!" o "tenemos planes chéveres" son bienvenidas con moderación.
9. No presentes como futuro un evento cuya fecha de inicio ya pasó: distingue entre "En curso" y "Finalizado" con el estado indicado.
10. Cuando pregunten por una fecha o periodo, responde solo con eventos que se crucen con ese periodo; no sustituyas la fecha solicitada por el siguiente evento disponible.
11. Responde la pregunta concreta antes de añadir contexto. Si preguntan cuándo empieza o termina, da las fechas y horas de inicio y fin disponibles.
12. Si el usuario hace una pregunta de seguimiento, conserva el evento indicado en el contexto específico; no cambies a otro evento ni a una lista general.
13. Si un dato no está publicado en el contexto, dilo claramente y no lo deduzcas de la descripción.

<eventos_disponibles>
${lista}
</eventos_disponibles>${contextoEspecifico}`;
}
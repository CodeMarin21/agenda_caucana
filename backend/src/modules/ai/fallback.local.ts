import { EventoContexto, Idioma } from './ai.types';

const T = {
  es: {
    intro: '¡Hola! Aquí tienes algunos planes disponibles en Popayán:',
    noEventos: 'Por el momento no hay eventos próximos programados en Popayán. ¡Vuelve pronto!',
    gratis: 'Estos son los planes gratuitos de la semana en Popayán:',
    categoria: (c: string) => `Encontré estos planes de ${c} en Popayán:`,
    cierre: '¿Quieres que te cuente más de alguno?',
    eventoNoEncontrado: 'Lo siento, ese evento no está disponible. Puede que ya haya pasado o no esté aprobado todavía.',
  },
  en: {
    intro: 'Hi! Here are some events available in Popayán:',
    noEventos: 'There are no upcoming events in Popayán right now. Check back soon!',
    gratis: "These are this week's free plans in Popayán:",
    categoria: (c: string) => `I found these ${c} plans in Popayán:`,
    cierre: 'Would you like more details about any of them?',
    eventoNoEncontrado: "Sorry, that event isn't available. It may have passed or isn't approved yet.",
  },
  fr: {
    intro: 'Bonjour ! Voici quelques événements disponibles à Popayán :',
    noEventos: "Il n'y a pas d'événements à venir à Popayán pour le moment. Revenez bientôt !",
    gratis: 'Voici les plans gratuits de la semaine à Popayán :',
    categoria: (c: string) => `J'ai trouvé ces plans de ${c} à Popayán :`,
    cierre: "Voulez-vous plus de détails sur l'un d'eux ?",
    eventoNoEncontrado: "Désolé, cet événement n'est pas disponible. Il est peut-être passé ou non approuvé.",
  },
} as const;

const LOCALE: Record<Idioma, string> = { es: 'es-CO', en: 'en-US', fr: 'fr-FR' };

function formatearPrecio(precio: number | null, idioma: Idioma): string {
  if (precio === null || precio === 0) {
    return { es: 'Entrada libre', en: 'Free entry', fr: 'Entrée libre' }[idioma];
  }
  return `$${precio.toLocaleString('es-CO')} COP`;
}

function formatearEvento(e: EventoContexto, idioma: Idioma): string {
  const precio = formatearPrecio(e.precioReferencial, idioma);
  return `• [${e.titulo}](/eventos/${e.slug}) — ${e.lugar.nombre} — ${precio}`;
}

export interface FallbackContexto {
  eventos: EventoContexto[];
  idioma: Idioma;
  tipo: 'GRATIS' | 'CATEGORIA' | 'GENERAL' | 'EVENTO_ESPECIFICO';
  categoria?: string;
  eventoEspecifico?: EventoContexto;
  eventoNoEncontrado?: boolean;
}

export function generarFallback(ctx: FallbackContexto): string {
  const { eventos, idioma, tipo, categoria, eventoEspecifico, eventoNoEncontrado } = ctx;
  const t = T[idioma];

  if (eventoNoEncontrado) {
    return t.eventoNoEncontrado;
  }

  if (eventoEspecifico) {
    const e = eventoEspecifico;
    const precio = formatearPrecio(e.precioReferencial, idioma);
    const fecha = new Date(e.fechaInicio).toLocaleString(LOCALE[idioma], {
      timeZone: 'America/Bogota',
      dateStyle: 'long',
      timeStyle: 'short',
    });

    const etiquetas = {
      es: { ver: 'Ver detalles' },
      en: { ver: 'See full details' },
      fr: { ver: 'Voir les détails' },
    }[idioma];

    return `${e.titulo}
📍 ${e.lugar.nombre}, ${e.lugar.direccion}
🕐 ${fecha}
💰 ${precio}

${e.descripcion}

[${etiquetas.ver}](/eventos/${e.slug})`;
  }

  if (eventos.length === 0) return t.noEventos;

  const intro =
    tipo === 'GRATIS' ? t.gratis :
    tipo === 'CATEGORIA' && categoria ? t.categoria(categoria) :
    t.intro;

  const lista = eventos.slice(0, 3).map((e) => formatearEvento(e, idioma)).join('\n');
  return `${intro}\n\n${lista}\n\n${t.cierre}`;
}
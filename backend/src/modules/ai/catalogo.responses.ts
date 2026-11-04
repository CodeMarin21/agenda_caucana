import { EventoContexto, Idioma, NegocioContexto } from './ai.types';

const LOCALE: Record<Idioma, string> = {
  es: 'es-CO',
  en: 'en-US',
  fr: 'fr-FR',
};

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatearPrecio(precio: number): string {
  return `$${precio.toLocaleString('es-CO')} COP`;
}

function formatearFecha(fecha: Date, idioma: Idioma): string {
  return new Date(fecha).toLocaleString(LOCALE[idioma], {
    timeZone: 'America/Bogota',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function coincidencias(terminos: string[], texto: string): number {
  const normalizado = normalizar(texto);
  return terminos.reduce((total, termino) => {
    const palabra = termino.startsWith('salchip') ? 'salchipapa' : normalizar(termino);
    return total + (palabra.length >= 3 && normalizado.includes(palabra) ? 1 : 0);
  }, 0);
}

export function responderEvento(evento: EventoContexto, idioma: Idioma): string {
  const fecha = formatearFecha(evento.fechaInicio, idioma);
  const direccion = evento.direccion || evento.lugar.direccion;
  const enlace = `[${evento.titulo}](evento.html?slug=${encodeURIComponent(evento.slug)})`;

  if (idioma === 'en') {
    return `${enlace} is listed at ${evento.lugar.nombre}, ${direccion}, ${evento.ciudad.nombre}. Date: ${fecha}`;
  }
  if (idioma === 'fr') {
    return `${enlace} est indiqué à ${evento.lugar.nombre}, ${direccion}, ${evento.ciudad.nombre}. Date : ${fecha}`;
  }
  return `${enlace}: ${evento.lugar.nombre}, ${direccion}, ${evento.ciudad.nombre}. Fecha: ${fecha}`;
}

export function responderEventoNoEncontrado(terminos: string[], idioma: Idioma): string {
  const busqueda = terminos.join(' ');
  if (idioma === 'en') return `I couldn't find a published event matching “${busqueda}” in the agenda.`;
  if (idioma === 'fr') return `Je n’ai trouvé aucun événement publié correspondant à « ${busqueda} » dans l’agenda.`;
  return `No encuentro un evento publicado que coincida con « ${busqueda} » en la agenda.`;
}

interface PlatoContexto {
  nombre: string;
  precio: number;
}

function extraerPlatos(negocio: NegocioContexto): PlatoContexto[] {
  if (!Array.isArray(negocio.platos)) return [];
  return negocio.platos.flatMap((plato) => {
    if (
      typeof plato !== 'object' ||
      plato === null ||
      !('nombre' in plato) ||
      !('precio' in plato) ||
      typeof plato.nombre !== 'string' ||
      typeof plato.precio !== 'number'
    ) {
      return [];
    }
    return [{ nombre: plato.nombre, precio: plato.precio }];
  });
}

interface OpcionNegocio {
  negocio: NegocioContexto;
  plato?: PlatoContexto;
  puntos: number;
  precio: number | null;
}

function buscarOpciones(
  negocios: NegocioContexto[],
  terminos: string[],
  presupuesto?: number,
): OpcionNegocio[] {
  return negocios.flatMap((negocio) => {
    const platos = extraerPlatos(negocio);
    const opciones = platos.length > 0
      ? platos.map((plato) => ({
        negocio,
        plato,
        puntos: coincidencias(terminos, `${plato.nombre} ${negocio.nombre}`) * 3 +
          coincidencias(terminos, negocio.descripcion),
        precio: plato.precio,
      }))
      : [{
        negocio,
        puntos: coincidencias(terminos, negocio.nombre) * 3 +
          coincidencias(terminos, negocio.descripcion),
        precio: negocio.precioPromedio,
      }];

    return opciones.filter((opcion) =>
      opcion.puntos > 0 &&
      (presupuesto === undefined || opcion.precio === null || opcion.precio <= presupuesto)
    );
  }).sort((a, b) =>
    b.puntos - a.puntos ||
    (a.precio ?? Number.MAX_SAFE_INTEGER) - (b.precio ?? Number.MAX_SAFE_INTEGER)
  ).slice(0, 3);
}

export function responderNegocios(
  negocios: NegocioContexto[],
  terminos: string[],
  idioma: Idioma,
  presupuesto?: number,
  personas?: number,
): string {
  const opciones = buscarOpciones(negocios, terminos, presupuesto);
  if (opciones.length === 0) {
    if (idioma === 'en') return 'I couldn’t find a published business matching that request and budget.';
    if (idioma === 'fr') return 'Je n’ai trouvé aucun commerce publié correspondant à cette demande et à ce budget.';
    return presupuesto === undefined
      ? 'No encontré un negocio publicado que coincida con esa búsqueda.'
      : `No encontré una opción publicada dentro de ${formatearPrecio(presupuesto)}.`;
  }

  const opcionesTexto = opciones.map(({ negocio, plato, precio }) => {
    const nombre = plato ? `${negocio.nombre} — ${plato.nombre}` : negocio.nombre;
    const precioTexto = precio === null ? '' : ` · ${formatearPrecio(precio)}`;
    const enlace = `[${nombre}](negocio.html?slug=${encodeURIComponent(negocio.slug)})`;
    return `${enlace}${precioTexto} · ${negocio.direccion}, ${negocio.ciudad.nombre}`;
  });

  const grupo = personas && personas > 1
    ? idioma === 'en'
      ? ` The listing does not specify whether the portion serves ${personas}.`
      : idioma === 'fr'
        ? ` La fiche ne précise pas si la portion convient à ${personas} personnes.`
        : ` La ficha no indica si la porción alcanza para ${personas} personas; confirma con el local.`
    : '';

  if (idioma === 'en') return `Best matches: ${opcionesTexto.join(' | ')}.${grupo}`;
  if (idioma === 'fr') return `Options correspondantes : ${opcionesTexto.join(' | ')}.${grupo}`;
  return `Encontré: ${opcionesTexto.join(' | ')}.${grupo}`;
}

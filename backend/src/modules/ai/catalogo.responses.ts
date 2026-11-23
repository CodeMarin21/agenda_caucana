import { EventoContexto, Idioma, NegocioContexto } from './ai.types';
import { PeriodoEventos } from './ai.temporal';

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
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

function formatearPeriodo(periodo: PeriodoEventos, idioma: Idioma): string {
  const desde = new Date(periodo.desde);
  if (periodo.anioCompleto) {
    return desde.toLocaleDateString(LOCALE[idioma], {
      timeZone: 'America/Bogota',
      year: 'numeric',
    });
  }
  if (periodo.diaCompleto) {
    return desde.toLocaleDateString(LOCALE[idioma], {
      timeZone: 'America/Bogota',
      dateStyle: 'long',
    });
  }
  return desde.toLocaleDateString(LOCALE[idioma], {
    timeZone: 'America/Bogota',
    month: 'long',
    year: 'numeric',
  });
}

function formatearRangoEvento(evento: EventoContexto, idioma: Idioma): string {
  const inicio = formatearFecha(evento.fechaInicio, idioma);
  if (!evento.fechaFin || evento.fechaFin.getTime() <= evento.fechaInicio.getTime()) return inicio;
  return `${inicio} — ${formatearFecha(evento.fechaFin, idioma)}`;
}

function coincidencias(terminos: string[], texto: string): number {
  const normalizado = normalizar(texto);
  return terminos.reduce((total, termino) => {
    const palabra = termino.startsWith('salchip') ? 'salchipapa' : normalizar(termino);
    return total + (palabra.length >= 3 && normalizado.includes(palabra) ? 1 : 0);
  }, 0);
}

export function responderEvento(evento: EventoContexto, idioma: Idioma): string {
  const fecha = formatearRangoEvento(evento, idioma);
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

export function responderEventosPorPeriodo(
  eventos: EventoContexto[],
  idioma: Idioma,
  periodo?: PeriodoEventos,
  soloFinalizados = false,
): string {
  const periodoTexto = periodo ? formatearPeriodo(periodo, idioma) : '';
  if (eventos.length === 0) {
    if (soloFinalizados && !periodo) {
      return {
        es: 'No encontré eventos publicados que ya hayan finalizado.',
        en: 'I could not find any published events that have already ended.',
        fr: 'Je n’ai trouvé aucun événement publié déjà terminé.',
      }[idioma];
    }
    if (idioma === 'en') {
      return `I found no published events${periodoTexto ? ` during ${periodoTexto}` : ''}${soloFinalizados ? ' that had already ended' : ''}.`;
    }
    if (idioma === 'fr') {
      return `Je n’ai trouvé aucun événement publié${periodoTexto ? ` pour ${periodoTexto}` : ''}${soloFinalizados ? ' déjà terminé' : ''}.`;
    }
    return `No encontré eventos publicados${periodoTexto ? ` para ${periodoTexto}` : ''}${soloFinalizados ? ' que ya hubieran finalizado' : ''}.`;
  }

  const titulo = soloFinalizados
    ? {
      es: periodoTexto ? `Eventos que ya finalizaron en ${periodoTexto}:` : 'Estos eventos publicados ya finalizaron:',
      en: periodoTexto ? `Events that ended in ${periodoTexto}:` : 'These published events have ended:',
      fr: periodoTexto ? `Événements terminés en ${periodoTexto} :` : 'Ces événements publiés sont terminés :',
    }[idioma]
    : {
      es: periodoTexto ? `Estos son los eventos publicados para ${periodoTexto}:` : 'Estos son los eventos publicados que encontré:',
      en: periodoTexto ? `These are the published events for ${periodoTexto}:` : 'Here are the published events I found:',
      fr: periodoTexto ? `Voici les événements publiés pour ${periodoTexto} :` : 'Voici les événements publiés que j’ai trouvés :',
    }[idioma];

  const lista = eventos.slice(0, 5).map((evento) => {
    const enlace = `[${evento.titulo}](evento.html?slug=${encodeURIComponent(evento.slug)})`;
    const fecha = formatearRangoEvento(evento, idioma);
    const precio = evento.precioReferencial === null || evento.precioReferencial === 0
      ? { es: 'Entrada libre', en: 'Free entry', fr: 'Entrée libre' }[idioma]
      : `$${evento.precioReferencial.toLocaleString('es-CO')} COP`;
    const edad = evento.esMayorDeEdad
      ? { es: ' · Solo mayores de 18 años', en: ' · Ages 18+', fr: ' · Réservé aux adultes' }[idioma]
      : '';
    return `• ${enlace} — ${fecha} · ${evento.lugar.nombre}, ${evento.ciudad.nombre} · ${precio}${edad}`;
  });
  const masResultados = eventos.length > 5
    ? {
      es: '\n\nHay más coincidencias en la agenda.',
      en: '\n\nMore matches are available in the agenda.',
      fr: '\n\nD’autres résultats sont disponibles dans l’agenda.',
    }[idioma]
    : '';
  return `${titulo}\n\n${lista.join('\n')}${masResultados}`;
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
  personas?: number,
  tipoPresupuesto: 'maximo' | 'objetivo' = 'maximo',
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

    return opciones.filter((opcion) => {
      if (opcion.puntos <= 0) return false;
      if (presupuesto === undefined) return true;
      if (opcion.precio === null) return true;
      const presupuestoAplicado = personas && personas > 1
        ? opcion.precio * personas
        : opcion.precio;
      if (tipoPresupuesto === 'objetivo') {
        return presupuestoAplicado >= presupuesto * 0.9 &&
          presupuestoAplicado <= presupuesto * 1.1;
      }
      return presupuestoAplicado <= presupuesto;
    });
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
  tipoPresupuesto: 'maximo' | 'objetivo' = 'maximo',
): string {
  const opciones = buscarOpciones(negocios, terminos, presupuesto, personas, tipoPresupuesto);
  if (opciones.length === 0) {
    const alternativas: Array<{
      negocio: NegocioContexto;
      plato?: PlatoContexto;
      precio: number | null;
      puntos: number;
    }> = negocios
      .flatMap((negocio): Array<{
        negocio: NegocioContexto;
        plato?: PlatoContexto;
        precio: number | null;
        puntos: number;
      }> => {
        const platos = extraerPlatos(negocio);
        if (platos.length === 0) return [{
          negocio,
          plato: undefined,
          precio: negocio.precioPromedio,
          puntos: coincidencias(terminos, `${negocio.nombre} ${negocio.descripcion}`),
        }];
        return platos.map((plato) => ({
          negocio,
          plato,
          precio: plato.precio,
          puntos: coincidencias(terminos, `${plato.nombre} ${negocio.nombre}`) * 3 +
            coincidencias(terminos, negocio.descripcion),
        }));
      })
      .filter((opcion) => {
        if (opcion.puntos <= 0) return false;
        if (presupuesto === undefined || opcion.precio === null) return false;
        const total = personas && personas > 1 ? opcion.precio * personas : opcion.precio;
        if (tipoPresupuesto === 'objetivo') {
          return total >= presupuesto * 0.5 && total <= presupuesto * 1.5;
        }
        return total <= presupuesto * 1.35;
      })
      .sort((a, b) => {
        const totalA = (a.precio ?? 0) * (personas && personas > 1 ? personas : 1);
        const totalB = (b.precio ?? 0) * (personas && personas > 1 ? personas : 1);
        const referencia = presupuesto ?? 0;
        return Math.abs(totalA - referencia) - Math.abs(totalB - referencia);
      })
      .slice(0, 3);

    if (alternativas.length > 0 && presupuesto !== undefined) {
      const texto = alternativas.map(({ negocio, plato, precio }) => {
        const total = personas && personas > 1 && precio !== null ? precio * personas : precio;
        const nombre = plato ? `${negocio.nombre} — ${plato.nombre}` : negocio.nombre;
        return `[${nombre}](negocio.html?slug=${encodeURIComponent(negocio.slug)}) · ${total !== null ? formatearPrecio(total) : 'precio por confirmar'} · ${negocio.direccion}`;
      }).join(' | ');
      const grupo = personas && personas > 1
        ? ` para ${personas} personas`
        : '';
      if (idioma === 'en') {
        return tipoPresupuesto === 'objetivo'
          ? `I couldn't find an option at about ${formatearPrecio(presupuesto)}${grupo}. These published alternatives are within a similar price range: ${texto}. Please confirm current prices and portions with the business.`
          : `I couldn't find an option within the budget${grupo}. These lower-priced alternatives may fit: ${texto}. Please confirm current prices and portions with the business.`;
      }
      if (idioma === 'fr') {
        return tipoPresupuesto === 'objetivo'
          ? `Je n’ai trouvé aucune option autour de ${formatearPrecio(presupuesto)}${grupo}. Voici des options publiées dans une gamme de prix similaire : ${texto}. Vérifiez les prix et les portions auprès du commerce.`
          : `Je n’ai trouvé aucune option dans le budget${grupo}. Ces options moins chères pourraient convenir : ${texto}. Vérifiez les prix et les portions auprès du commerce.`;
      }
      return tipoPresupuesto === 'objetivo'
        ? `No encontré una opción de aproximadamente ${formatearPrecio(presupuesto)}${grupo}. Estas alternativas publicadas están en un rango de precio similar: ${texto}. Confirma los precios y las porciones con el local.`
        : `No encontré una opción dentro del presupuesto${grupo}. Estas alternativas de menor precio podrían ajustarse: ${texto}. Confirma los precios y las porciones con el local.`;
    }

    if (idioma === 'en') return presupuesto === undefined
      ? 'I couldn’t find a published business matching that search.'
      : `I couldn't find a published option${tipoPresupuesto === 'objetivo' ? ' around' : ' within'} ${formatearPrecio(presupuesto)}. Try adjusting the price or search.`;
    if (idioma === 'fr') return presupuesto === undefined
      ? 'Je n’ai trouvé aucun commerce publié correspondant à cette recherche.'
      : `Je n’ai trouvé aucune option publiée ${tipoPresupuesto === 'objetivo' ? 'autour de' : 'dans la limite de'} ${formatearPrecio(presupuesto)}. Essayez de modifier le prix ou la recherche.`;
    return presupuesto === undefined
      ? 'No encontré un negocio publicado que coincida con esa búsqueda.'
      : `No encontré una opción publicada dentro de ${formatearPrecio(presupuesto)}. Puedes ampliar el presupuesto o consultar lugares con menú disponible.`;
  }

  const opcionesTexto = opciones.map(({ negocio, plato, precio }) => {
    const nombre = plato ? `${negocio.nombre} — ${plato.nombre}` : negocio.nombre;
    const precioTexto = precio === null
      ? ''
      : personas && personas > 1
        ? ` · ${formatearPrecio(precio * personas)} estimados para ${personas} personas`
        : ` · ${formatearPrecio(precio)}`;
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
  if (presupuesto !== undefined && tipoPresupuesto === 'maximo') {
    return `Opciones publicadas dentro de tu presupuesto: ${opcionesTexto.join(' | ')}.${grupo}`;
  }
  return `Encontré: ${opcionesTexto.join(' | ')}.${grupo}`;
}

export function responderComoLlegarNegocio(negocio: NegocioContexto, idioma: Idioma): string {
  const destino = encodeURIComponent(`${negocio.nombre}, ${negocio.direccion}, ${negocio.ciudad.nombre}`);
  const mapa = `[${negocio.nombre}](https://www.google.com/maps/search/?api=1&query=${destino})`;
  if (idioma === 'en') return `Directions to ${mapa}. The map will use the address published by the business: ${negocio.direccion}, ${negocio.ciudad.nombre}.`;
  if (idioma === 'fr') return `Itinéraire vers ${mapa}. La carte utilisera l’adresse publiée par le commerce : ${negocio.direccion}, ${negocio.ciudad.nombre}.`;
  return `Cómo llegar a ${mapa}. El mapa usará la dirección publicada por el negocio: ${negocio.direccion}, ${negocio.ciudad.nombre}.`;
}

export function responderNegocioParaLlegarNoEncontrado(idioma: Idioma): string {
  if (idioma === 'en') return 'I could not find the previously mentioned published business. Search for it again to get directions.';
  if (idioma === 'fr') return 'Je n’ai pas retrouvé le commerce publié mentionné précédemment. Recherchez-le à nouveau pour obtenir l’itinéraire.';
  return 'No pude encontrar el negocio publicado mencionado antes. Búscalo nuevamente para obtener el enlace de cómo llegar.';
}

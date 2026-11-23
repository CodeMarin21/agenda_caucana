import { Idioma } from './ai.types';

const palabrasPorIdioma: Record<Idioma, Set<string>> = {
  es: new Set(['hola', 'que', 'quiero', 'busco', 'hay', 'donde', 'cuanto', 'precio', 'direccion', 'comida', 'evento', 'por', 'favor', 'para', 'necesito', 'recomienda']),
  en: new Set(['hello', 'hi', 'what', 'where', 'want', 'looking', 'find', 'much', 'price', 'address', 'food', 'event', 'please', 'need', 'recommend', 'is', 'are', 'can']),
  fr: new Set(['bonjour', 'salut', 'quoi', 'ou', 'cherche', 'trouver', 'combien', 'prix', 'adresse', 'nourriture', 'evenement', 'svp', 'besoin', 'recommande', 'est', 'sont', 'je', 'voudrais']),
};

export function inferirIdiomaPregunta(pregunta: string): Idioma | null {
  const palabras = pregunta
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .match(/[a-z]+/g) ?? [];
  const puntuaciones = (Object.keys(palabrasPorIdioma) as Idioma[]).map((idioma) => ({
    idioma,
    puntos: palabras.reduce((total, palabra) => total + Number(palabrasPorIdioma[idioma].has(palabra)), 0),
  })).sort((a, b) => b.puntos - a.puntos);

  if (puntuaciones[0].puntos === 0 || puntuaciones[0].puntos === puntuaciones[1].puntos) return null;
  return puntuaciones[0].idioma;
}

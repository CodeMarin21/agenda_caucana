export type Idioma = 'es' | 'en' | 'fr';
export type Fuente = 'gemini' | 'cache' | 'fallback';

export interface ChatRequest {
  pregunta: string;
  idioma: Idioma;
  eventoId?: number;
  ip?: string;
}

export interface ChatResponse {
  respuesta: string;
  fuente: Fuente;
  idioma: Idioma;
  modelo?: string;
  eventoId?: number;
}

export interface EventoContexto {
  id: number;
  titulo: string;
  slug: string;
  descripcion: string;
  fechaInicio: Date;
  fechaFin: Date | null;
  horaApertura: string | null;
  precioReferencial: number | null;
  esMayorDeEdad: boolean;
  urlExternaBoletas: string | null;
  categoria: { nombre: string };
  lugar: { nombre: string; direccion: string };
}

export function normalizeIdioma(input: unknown): Idioma {
  return input === 'en' || input === 'fr' ? input : 'es';
}
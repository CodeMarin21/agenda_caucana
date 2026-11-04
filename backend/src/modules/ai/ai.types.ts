export type Idioma = 'es' | 'en' | 'fr';
export type Fuente = 'gemini' | 'cache' | 'fallback' | 'catalogo';

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
  direccion: string | null;
  precioReferencial: number | null;
  esMayorDeEdad: boolean;
  urlExternaBoletas: string | null;
  categoria: { nombre: string };
  lugar: { nombre: string; direccion: string };
  ciudad: { nombre: string };
}

export interface NegocioContexto {
  id: number;
  slug: string;
  nombre: string;
  descripcion: string;
  direccion: string;
  telefono: string | null;
  whatsapp: string | null;
  horarioAtencion: string | null;
  categoria: string;
  precioPromedio: number | null;
  platos: import('@prisma/client').Prisma.JsonValue;
  ciudad: { nombre: string };
}

export function normalizeIdioma(input: unknown): Idioma {
  return input === 'en' || input === 'fr' ? input : 'es';
}
import { body } from 'express-validator';

export interface ChatRequestDTO {
  pregunta: string;
  idioma?: 'es' | 'en' | 'fr';
  eventoId?: number;
  negocioSlug?: string;
  eventoSlug?: string;
  contextoEventos?: string[];
}

export const chatValidacion = [
  body('pregunta')
    .trim()
    .notEmpty().withMessage('La pregunta no puede estar vacía')
    .isLength({ max: 500 }).withMessage('La pregunta es demasiado larga (máximo 500 caracteres)'),

  body('idioma')
    .optional()
    .isIn(['es', 'en', 'fr']).withMessage('Idioma no soportado'),

  body('eventoId')
    .optional()
    .isInt({ min: 1 }).withMessage('ID de evento inválido')
    .toInt(),

  body('negocioSlug')
    .optional()
    .matches(/^[a-z0-9-]{1,120}$/i).withMessage('Negocio de contexto inválido'),

  body('eventoSlug')
    .optional()
    .matches(/^[a-z0-9-]{1,120}$/i).withMessage('Evento de contexto inválido'),

  body('contextoEventos')
    .optional()
    .isArray({ max: 5 }).withMessage('El contexto de eventos no es válido'),

  body('contextoEventos.*')
    .optional()
    .isString().withMessage('El término de búsqueda no es válido')
    .trim()
    .isLength({ min: 1, max: 80 }).withMessage('El término de búsqueda no es válido'),
];
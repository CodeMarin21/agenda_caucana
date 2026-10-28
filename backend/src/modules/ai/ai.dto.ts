import { body } from 'express-validator';

export interface ChatRequestDTO {
  pregunta: string;
  idioma?: 'es' | 'en' | 'fr';
  eventoId?: number;
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
];
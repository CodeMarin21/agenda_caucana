import { body, query } from 'express-validator';

export const crearEventoValidacion = [
  body('titulo')
    .trim()
    .notEmpty().withMessage('El título es obligatorio')
    .isLength({ min: 3, max: 200 })
    .withMessage('El título debe tener entre 3 y 200 caracteres'),

  body('descripcion')
    .trim()
    .notEmpty().withMessage('La descripción es obligatoria')
    .isLength({ min: 10, max: 2000 })
    .withMessage('La descripción debe tener entre 10 y 2000 caracteres'),

  body('fechaInicio')
    .notEmpty().withMessage('La fecha de inicio es obligatoria')
    .isISO8601().withMessage('Fecha inválida. Usa formato ISO (YYYY-MM-DDTHH:MM)')
    .custom((valor) => {
      const fecha = new Date(valor);
      if (isNaN(fecha.getTime())) throw new Error('Fecha de inicio inválida');
      const ahora = new Date();
      // margen de 1 min para evitar rechazos por desfase de reloj
      if (fecha.getTime() < ahora.getTime() - 60_000) {
        throw new Error('La fecha de inicio no puede ser anterior al momento actual');
      }
      return true;
    }),

  body('fechaFin')
    .optional({ values: 'falsy' })
    .isISO8601().withMessage('Fecha de fin inválida')
    .custom((valor, { req }) => {
      if (!req.body.fechaInicio) return true;
      if (new Date(valor).getTime() < new Date(req.body.fechaInicio).getTime()) {
        throw new Error('La fecha de fin no puede ser anterior a la fecha de inicio');
      }
      return true;
    }),

  body('direccion')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 300 })
    .withMessage('La dirección no puede superar 300 caracteres'),

  body('imagenUrl')
    .optional({ values: 'falsy' })
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('La URL de la imagen no es válida'),

  body('categoriaId')
    .notEmpty().withMessage('La categoría es obligatoria')
    .isInt({ min: 1 }).withMessage('Categoría inválida')
    .toInt(),

  body('lugarId')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('Lugar inválido')
    .toInt(),

  body('lugarTexto')
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 3, max: 150 })
    .withMessage('El nombre del lugar debe tener entre 3 y 150 caracteres'),

  body().custom((value, { req }) => {
    const { lugarId, lugarTexto } = req.body;
    if (!lugarId && (!lugarTexto || !String(lugarTexto).trim())) {
      throw new Error('Debes seleccionar o indicar un lugar');
    }
    return true;
  }),

  body('ciudadId')
    .notEmpty().withMessage('La ciudad es obligatoria')
    .isInt({ min: 1 }).withMessage('Ciudad inválida')
    .toInt(),

  body('precioReferencial')
    .optional({ values: 'null' })
    .isFloat({ min: 0 }).withMessage('El precio debe ser mayor o igual a 0')
    .toFloat(),

  body('urlExternaBoletas')
    .optional({ values: 'falsy' })
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('La URL de boletas no es válida'),

  body('esMayorDeEdad')
    .optional()
    .isBoolean().withMessage('esMayorDeEdad debe ser true o false')
    .toBoolean(),
];

export const filtrosEventoValidacion = [
  query('categoriaSlug').optional().isString(),
  query('desde').optional().isISO8601().withMessage('Fecha desde inválida'),
  query('hasta').optional().isISO8601().withMessage('Fecha hasta inválida'),
  query('precioMax').optional().isFloat({ min: 0 }).withMessage('Precio máximo inválido'),
  query('pagina').optional().isInt({ min: 1 }).withMessage('Página inválida'),
  query('limite').optional().isInt({ min: 1, max: 50 }).withMessage('Límite entre 1 y 50'),
];
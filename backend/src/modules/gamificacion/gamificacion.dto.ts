import { body } from 'express-validator';

export const checkinValidacion = [
  body('lugarId')
    .notEmpty().withMessage('El lugarId es obligatorio')
    .isInt({ min: 1 }).withMessage('lugarId inválido')
    .toInt(),

  body('latitud')
    .notEmpty().withMessage('La latitud es obligatoria')
    .isFloat({ min: -90, max: 90 }).withMessage('Latitud fuera de rango')
    .toFloat(),

  body('longitud')
    .notEmpty().withMessage('La longitud es obligatoria')
    .isFloat({ min: -180, max: 180 }).withMessage('Longitud fuera de rango')
    .toFloat(),
];

export const actualizarPerfilValidacion = [
  body('avatarUrl')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 500 }).withMessage('avatarUrl demasiado largo'),

  body('descripcion')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 200 }).withMessage('La descripción no puede superar 200 caracteres'),
];
export const actualizarPrivacidadValidacion = [
  body('cuentaPrivada').optional().isBoolean().withMessage('cuentaPrivada debe ser booleano'),
  body('recomendarAOtros').optional().isBoolean().withMessage('recomendarAOtros debe ser booleano'),
  body('mostrarEnRanking').optional().isBoolean().withMessage('mostrarEnRanking debe ser booleano'),
  body('permitirMensajes').optional().isBoolean().withMessage('permitirMensajes debe ser booleano'),
  body().custom((_, { req }) => {
    const { cuentaPrivada, recomendarAOtros, mostrarEnRanking, permitirMensajes } = req.body ?? {};
    if (
      cuentaPrivada === undefined &&
      recomendarAOtros === undefined &&
      mostrarEnRanking === undefined &&
      permitirMensajes === undefined
    ) {
      throw new Error('Debes enviar al menos un campo para actualizar');
    }
    return true;
  }),
];
import { CategoriaNegocio } from '@prisma/client';
import { body, query } from 'express-validator';

const valoresCategoriaNegocio = Object.values(CategoriaNegocio);
const ordenesNegocios = ['recientes', 'destacados', 'mejor-calificados'];

function esUrlHttp(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export const crearNegocioValidacion = [
  body('nombre')
    .trim()
    .notEmpty().withMessage('El nombre es obligatorio')
    .isLength({ min: 3, max: 150 })
    .withMessage('El nombre debe tener entre 3 y 150 caracteres'),

  body('descripcion')
    .trim()
    .notEmpty().withMessage('La descripción es obligatoria')
    .isLength({ min: 10, max: 2000 })
    .withMessage('La descripción debe tener entre 10 y 2000 caracteres'),

  body('direccion')
    .trim()
    .notEmpty().withMessage('La dirección es obligatoria')
    .isLength({ min: 5, max: 300 })
    .withMessage('La dirección debe tener entre 5 y 300 caracteres'),

  body('ciudadId')
    .notEmpty().withMessage('La ciudad es obligatoria')
    .isInt({ min: 1 }).withMessage('Ciudad inválida')
    .toInt(),

  body('telefono')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 20 }).withMessage('El teléfono no puede superar 20 caracteres'),

  body('whatsapp')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 20 }).withMessage('El WhatsApp no puede superar 20 caracteres'),

  body('instagram')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 100 }).withMessage('Instagram no puede superar 100 caracteres'),

  body('horarioAtencion')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 200 }).withMessage('El horario no puede superar 200 caracteres'),

  body('categoria')
    .notEmpty().withMessage('La categoría es obligatoria')
    .isIn(valoresCategoriaNegocio).withMessage('Categoría de negocio inválida'),

  body('precioPromedio')
    .optional({ values: 'null' })
    .isInt({ min: 0 }).withMessage('El precio promedio debe ser un entero mayor o igual a 0')
    .toInt(),

  body('imagenPrincipalUrl')
    .optional({ values: 'falsy' })
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('La URL de la imagen principal no es válida'),

  body('imagenesAdicionales')
    .optional({ nullable: true })
    .isArray({ max: 6 }).withMessage('Se permiten hasta 6 imágenes adicionales')
    .bail()
    .custom((imagenes: unknown[]) => imagenes.every(esUrlHttp))
    .withMessage('Todas las imágenes adicionales deben ser URLs HTTP o HTTPS válidas'),

  body('platos')
    .optional()
    .isArray({ min: 1, max: 5 })
    .withMessage('Se requiere entre 1 y 5 platos')
    .bail()
    .custom((platos: unknown[]) => platos.every((plato) =>
      typeof plato === 'object' &&
      plato !== null &&
      !Array.isArray(plato) &&
      'nombre' in plato &&
      'precio' in plato &&
      'imagenUrl' in plato
    ))
    .withMessage('Cada plato debe incluir nombre, precio e imagen'),

  body('platos.*.nombre')
    .isString().withMessage('El nombre de cada plato es obligatorio')
    .bail()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre del plato debe tener entre 2 y 100 caracteres'),

  body('platos.*.precio')
    .isInt({ min: 0 })
    .withMessage('El precio de cada plato debe ser un entero mayor o igual a 0')
    .toInt(),

  body('platos.*.imagenUrl')
    .custom(esUrlHttp)
    .withMessage('La imagen de cada plato debe ser una URL HTTP o HTTPS válida'),
];

export const calificarValidacion = [
  body('estrellas')
    .notEmpty().withMessage('La calificación es obligatoria')
    .isInt({ min: 1, max: 5 }).withMessage('Las estrellas deben ser un entero entre 1 y 5')
    .toInt(),

  body('comentario')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 500 }).withMessage('El comentario no puede superar 500 caracteres'),
];

export const filtrosNegociosValidacion = [
  query('categoria')
    .optional({ values: 'falsy' })
    .isIn(valoresCategoriaNegocio).withMessage('Categoría de negocio inválida'),
  query('ciudadId')
    .optional({ values: 'falsy' })
    .isInt({ min: 1 }).withMessage('Ciudad inválida')
    .toInt(),
  query('precioMax')
    .optional({ values: 'falsy' })
    .isInt({ min: 0 }).withMessage('Precio máximo inválido')
    .toInt(),
  query('orden')
    .optional({ values: 'falsy' })
    .isIn(ordenesNegocios).withMessage('Ordenamiento inválido'),
  query('pagina')
    .optional({ values: 'falsy' })
    .isInt({ min: 1 }).withMessage('Página inválida')
    .toInt(),
  query('limite')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: 50 }).withMessage('El límite debe estar entre 1 y 50')
    .toInt(),
];

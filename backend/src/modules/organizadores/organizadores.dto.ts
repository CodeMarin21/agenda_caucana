import { body } from 'express-validator';
import { MOTIVOS_REACTIVACION, todosLosMotivos } from './organizadores.motivos';

const TIPOS_ENTIDAD = [
  'PERSONA_NATURAL',
  'FUNDACION',
  'EMPRESA',
  'COLECTIVO',
  'ASOCIACION',
  'JUNTA_ACCION_COMUNAL',
  'INSTITUCION_PUBLICA',
  'OTRO',
] as const;

const REDES_PERMITIDAS = ['instagram', 'facebook', 'x', 'tiktok', 'youtube', 'whatsapp', 'web'] as const;

const sanearRedes = (val: unknown): unknown => {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return val;
  const limpio: Record<string, string> = {};
  for (const k of REDES_PERMITIDAS) {
    const v = (val as Record<string, unknown>)[k];
    if (typeof v === 'string' && v.trim() !== '') limpio[k] = v.trim();
  }
  return limpio;
};

export const registroOrganizadorValidacion = [
  body('nombre')
    .trim()
    .notEmpty().withMessage('El nombre es obligatorio')
    .isLength({ min: 2, max: 100 }).withMessage('Nombre entre 2 y 100 caracteres'),

  body('email')
    .trim()
    .notEmpty().withMessage('El email es obligatorio')
    .isEmail().withMessage('Email no válido')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('La contraseña es obligatoria')
    .isLength({ min: 8 }).withMessage('Mínimo 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Debe tener mayúscula, minúscula y número'),

  body('nombreEntidad')
    .trim()
    .notEmpty().withMessage('El nombre de la entidad es obligatorio')
    .isLength({ min: 2, max: 150 }).withMessage('Nombre entre 2 y 150 caracteres'),

  body('descripcion')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 }).withMessage('Descripción máximo 500 caracteres'),

  body('telefono')
    .optional({ nullable: true })
    .trim()
    .isMobilePhone('any').withMessage('Teléfono no válido'),

  body('direccion')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 200 }).withMessage('Dirección máximo 200 caracteres'),

  body('ciudadBaseId')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('ciudadBaseId debe ser un entero positivo')
    .toInt(),

  body('anioFundacion')
    .optional({ nullable: true })
    .isInt({ min: 1800, max: new Date().getFullYear() })
    .withMessage(`Año de fundación debe estar entre 1800 y ${new Date().getFullYear()}`)
    .toInt(),

  body('tipoEntidad')
    .optional({ nullable: true })
    .isIn(TIPOS_ENTIDAD as unknown as string[])
    .withMessage(`tipoEntidad debe ser uno de: ${TIPOS_ENTIDAD.join(', ')}`),

  body('documentoIdentidad')
    .optional({ nullable: true })
    .trim()
    .matches(/^\d{7,10}$/)
    .withMessage('Documento de identidad debe tener entre 7 y 10 dígitos'),

  body('redesSociales')
    .optional({ nullable: true })
    .isObject().withMessage('redesSociales debe ser un objeto')
    .customSanitizer(sanearRedes)
    .custom((val) => {
      if (val === null) return true;
      if (typeof val !== 'object' || Array.isArray(val)) {
        throw new Error('redesSociales debe ser objeto o null');
      }
      return true;
    }),
];

export const actualizarPerfilValidacion = [
  body('nombreEntidad')
    .optional()
    .trim()
    .isLength({ min: 2, max: 150 }).withMessage('Nombre entre 2 y 150 caracteres'),

  body('descripcion')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 }).withMessage('Descripción máximo 500 caracteres'),

  body('telefono')
    .optional({ nullable: true })
    .trim()
    .isMobilePhone('any').withMessage('Teléfono no válido'),

  body('nit')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 30 }).withMessage('NIT máximo 30 caracteres'),

  body('avatarUrl')
    .optional({ nullable: true })
    .trim()
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('avatarUrl debe ser una URL válida'),

  body('direccion')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 200 }).withMessage('Dirección máximo 200 caracteres'),

  body('ciudadBaseId')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('ciudadBaseId debe ser un entero positivo')
    .toInt(),

  body('anioFundacion')
    .optional({ nullable: true })
    .isInt({ min: 1800, max: new Date().getFullYear() })
    .withMessage(`Año de fundación debe estar entre 1800 y ${new Date().getFullYear()}`)
    .toInt(),

  body('tipoEntidad')
    .optional({ nullable: true })
    .isIn(TIPOS_ENTIDAD as unknown as string[])
    .withMessage(`tipoEntidad debe ser uno de: ${TIPOS_ENTIDAD.join(', ')}`),

  body('documentoIdentidad')
    .optional({ nullable: true })
    .trim()
    .matches(/^\d{7,10}$/)
    .withMessage('Documento de identidad debe tener entre 7 y 10 dígitos'),

  body('redesSociales')
    .optional({ nullable: true })
    .isObject().withMessage('redesSociales debe ser un objeto')
    .customSanitizer(sanearRedes)
    .custom((val) => {
      if (val === null) return true;
      if (typeof val !== 'object' || Array.isArray(val)) {
        throw new Error('redesSociales debe ser objeto o null');
      }
      return true;
    }),
];

const detalleMotivoValidacion = body('detalle')
  .optional({ nullable: true })
  .trim()
  .isLength({ max: 500 }).withMessage('La nota adicional no puede superar 500 caracteres');

const exigirDetalleSiOtro = body().custom((datos: Record<string, unknown>) => {
  if (datos.motivo === 'OTRO' && (typeof datos.detalle !== 'string' || datos.detalle.trim().length < 5)) {
    throw new Error('Especifica el motivo (mínimo 5 caracteres)');
  }
  return true;
});

export const motivoEstadoOrganizadorValidacion = [
  body('motivo')
    .isIn(todosLosMotivos).withMessage('Selecciona un motivo válido'),
  detalleMotivoValidacion,
  exigirDetalleSiOtro,
];

export const motivoReactivacionValidacion = [
  body('motivo')
    .isIn(Object.keys(MOTIVOS_REACTIVACION)).withMessage('Selecciona un motivo de reactivación válido'),
  detalleMotivoValidacion,
  exigirDetalleSiOtro,
  body('notificar')
    .optional()
    .isBoolean().withMessage('notificar debe ser booleano')
    .toBoolean(),
];
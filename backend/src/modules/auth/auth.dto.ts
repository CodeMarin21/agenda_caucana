import { body } from 'express-validator';
import { Rol } from '@prisma/client';

// ─────────────────────────────────────────────
// Registro
// ─────────────────────────────────────────────
export const registroValidacion = [
  body('rol')
    .optional()
    .isIn([Rol.USUARIO, Rol.ORGANIZADOR, Rol.JUGADOR])
    .withMessage('Rol no permitido en registro público'),

  body('nombre')
    .if(body('rol').not().equals(Rol.JUGADOR))
    .trim()
    .notEmpty().withMessage('El nombre es obligatorio')
    .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),

  body('email')
    .if(body('rol').not().equals(Rol.JUGADOR))
    .trim()
    .notEmpty().withMessage('El email es obligatorio')
    .isEmail().withMessage('Email no válido')
    .normalizeEmail(),

  body('username')
    .if(body('rol').equals(Rol.JUGADOR))
    .trim()
    .notEmpty().withMessage('El nombre de usuario es obligatorio')
    .isLength({ min: 3, max: 30 }).withMessage('El usuario debe tener entre 3 y 30 caracteres')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Solo se permiten letras, números y guión bajo'),

  body('descripcion')
    .if(body('rol').equals(Rol.JUGADOR))
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 200 }).withMessage('La descripción no puede superar 200 caracteres'),

  body('password')
    .notEmpty().withMessage('La contraseña es obligatoria')
    .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('La contraseña debe tener al menos una mayúscula, una minúscula y un número'),
];

// ─────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────
export const loginValidacion = [
  body().custom((_, { req }) => {
    const { email, username } = req.body ?? {};
    if (!email && !username) {
      throw new Error('Debes enviar email o nombre de usuario');
    }
    return true;
  }),

  body('email')
    .optional({ values: 'falsy' })
    .trim()
    .isEmail().withMessage('Email no válido')
    .normalizeEmail(),

  body('username')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 3, max: 30 }).withMessage('Usuario inválido'),

  body('password')
    .notEmpty().withMessage('La contraseña es obligatoria'),
];

// ─────────────────────────────────────────────
// A.5.2 — Recuperación de contraseña
// ─────────────────────────────────────────────

export const solicitarResetValidacion = [
  body('email')
    .trim()
    .notEmpty().withMessage('El email es obligatorio')
    .isEmail().withMessage('Email no válido')
    .normalizeEmail(),
];

export const solicitarResetJugadorValidacion = [
  body('username')
    .trim()
    .notEmpty().withMessage('El nombre de usuario es obligatorio')
    .isLength({ min: 3, max: 30 }).withMessage('Usuario inválido'),

  body('codigo')
    .trim()
    .notEmpty().withMessage('El código es obligatorio')
    .matches(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/i)
    .withMessage('Formato de código inválido (debe ser XXXX-XXXX)'),
];

export const confirmarResetValidacion = [
  body('token')
    .trim()
    .notEmpty().withMessage('El token es obligatorio')
    .isLength({ min: 32, max: 128 }).withMessage('Token inválido'),

  body('nuevaPassword')
    .notEmpty().withMessage('La contraseña es obligatoria')
    .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('La contraseña debe tener al menos una mayúscula, una minúscula y un número'),
];
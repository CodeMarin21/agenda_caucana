import { body } from 'express-validator';
import { Rol } from '@prisma/client';

// ─────────────────────────────────────────────
// Registro
// ─────────────────────────────────────────────
export const registroValidacion = [
  body('rol')
    .optional()
    .isIn([Rol.USUARIO, Rol.ORGANIZADOR])
    .withMessage('Rol no permitido en registro público'),

  body('nombre')
    .trim()
    .notEmpty().withMessage('El nombre es obligatorio')
    .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),

  body('email')
    .trim()
    .notEmpty().withMessage('El email es obligatorio')
    .isEmail().withMessage('Email no válido')
    .normalizeEmail(),

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
  body('email')
    .trim()
    .notEmpty().withMessage('El email es obligatorio')
    .isEmail().withMessage('Email no válido')
    .normalizeEmail(),

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
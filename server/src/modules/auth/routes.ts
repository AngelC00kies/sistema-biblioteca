import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { validateBody } from '../../middleware/validate.js';
import { authController } from './controller.js';

const router = Router();

/** Limita intentos de acceso para mitigar fuerza bruta sobre /auth/login. */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // En pruebas se relaja el límite: la suite realiza muchos inicios de sesión.
  limit: env.nodeEnv === 'test' ? 100_000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    code: 'RATE_LIMITED',
    message: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.',
  },
});

const loginSchema = z.object({
  username: z.string().min(3, 'El usuario debe tener al menos 3 caracteres').max(50),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').max(100),
});

const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'El usuario debe tener al menos 3 caracteres')
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Solo se permiten letras, números, punto, guion y guion bajo'),
  email: z.string().email('Correo electrónico inválido').max(120),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(100)
    .regex(/[A-Z]/, 'Debe incluir al menos una mayúscula')
    .regex(/[0-9]/, 'Debe incluir al menos un número'),
  fullName: z.string().min(3, 'El nombre completo es obligatorio').max(120),
  role: z.enum(['admin', 'librarian', 'member']).optional(),
});

router.post('/login', loginLimiter, validateBody(loginSchema), asyncHandler(authController.login));
router.post(
  '/register',
  authenticate,
  requireRole('admin'),
  validateBody(registerSchema),
  asyncHandler(authController.register),
);
router.get('/me', authenticate, asyncHandler(authController.me));

export default router;

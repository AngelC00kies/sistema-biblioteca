import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { usersController } from './controller.js';

const router = Router();

router.use(authenticate, requireRole('admin'));

const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(100)
  .regex(/[A-Z]/, 'Debe incluir al menos una mayúscula')
  .regex(/[0-9]/, 'Debe incluir al menos un número');

const createSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Caracteres no permitidos en el nombre de usuario'),
  email: z.string().email('Correo electrónico inválido').max(120),
  password: passwordSchema,
  fullName: z.string().min(3, 'El nombre completo es obligatorio').max(120),
  role: z.enum(['admin', 'librarian', 'member']),
  status: z.enum(['active', 'inactive']).optional(),
});

const updateSchema = z
  .object({
    email: z.string().email().max(120).optional(),
    fullName: z.string().min(3).max(120).optional(),
    role: z.enum(['admin', 'librarian', 'member']).optional(),
    status: z.enum(['active', 'inactive']).optional(),
    password: passwordSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Debe indicar al menos un campo a modificar',
  });

const listQuerySchema = z.object({
  role: z.enum(['admin', 'librarian', 'member']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  search: z.string().max(80).optional(),
});

router.get('/', validateQuery(listQuerySchema), asyncHandler(usersController.list));
router.get('/:id', asyncHandler(usersController.get));
router.post('/', validateBody(createSchema), asyncHandler(usersController.create));
router.put('/:id', validateBody(updateSchema), asyncHandler(usersController.update));
router.delete('/:id', asyncHandler(usersController.remove));

export default router;

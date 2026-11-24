import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { errors } from '../../errors/AppError.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { usersController } from './controller.js';

const router = Router();

router.use(authenticate);

/**
 * El padrón completo es exclusivo del administrador. El bibliotecario solo
 * puede consultar la lista de socios activos (`role=member&status=active`),
 * que necesita para registrar préstamos desde la interfaz (RF-06/ERR-11);
 * sin ese filtro (o con cualquier otro) recibe 403, como afirma RB-USR-01.
 */
function listUsersGuard(req: Request, _res: Response, next: NextFunction): void {
  const role = req.user?.role;
  if (role === 'admin') return next();
  const restrictedRoster =
    role === 'librarian' && req.query.role === 'member' && req.query.status === 'active';
  if (restrictedRoster) return next();
  next(errors.forbidden());
}

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

router.get('/', listUsersGuard, validateQuery(listQuerySchema), asyncHandler(usersController.list));
router.get('/:id', requireRole('admin'), asyncHandler(usersController.get));
router.post('/', requireRole('admin'), validateBody(createSchema), asyncHandler(usersController.create));
router.put(
  '/:id',
  requireRole('admin'),
  validateBody(updateSchema),
  asyncHandler(usersController.update),
);
router.delete('/:id', requireRole('admin'), asyncHandler(usersController.remove));

export default router;

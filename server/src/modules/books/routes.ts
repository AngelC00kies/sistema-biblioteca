import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, STAFF_ROLES } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { booksController } from './controller.js';

const router = Router();

const bookSchema = z.object({
  isbn: z
    .string()
    .min(10, 'El ISBN debe tener entre 10 y 17 caracteres')
    .max(17)
    .regex(/^[0-9X-]+$/, 'El ISBN solo puede contener números, guiones o X'),
  title: z.string().min(2, 'El título es obligatorio').max(200),
  author: z.string().min(2, 'El autor es obligatorio').max(120),
  publisher: z.string().max(120).nullish(),
  publicationYear: z
    .number()
    .int()
    .min(1400)
    .max(new Date().getFullYear() + 1)
    .nullish(),
  categoryId: z.number().int().positive().nullish(),
  description: z.string().max(2000).nullish(),
});

const copySchema = z.object({
  inventoryCode: z
    .string()
    .min(3, 'El código de inventario es obligatorio')
    .max(40)
    .regex(/^[A-Za-z0-9._-]+$/, 'Código de inventario inválido'),
  condition: z.enum(['good', 'regular', 'damaged']).optional(),
});

const listQuerySchema = z.object({
  search: z.string().max(120).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  available: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const staff = requireRole(...STAFF_ROLES);

router.get('/', authenticate, validateQuery(listQuerySchema), asyncHandler(booksController.list));
router.get('/:id', authenticate, asyncHandler(booksController.get));
router.post('/', authenticate, staff, validateBody(bookSchema), asyncHandler(booksController.create));
router.put(
  '/:id',
  authenticate,
  staff,
  validateBody(bookSchema),
  asyncHandler(booksController.update),
);
router.delete('/:id', authenticate, requireRole('admin'), asyncHandler(booksController.remove));
router.get('/:id/copies', authenticate, asyncHandler(booksController.listCopies));
router.post(
  '/:id/copies',
  authenticate,
  staff,
  validateBody(copySchema),
  asyncHandler(booksController.addCopy),
);

export default router;

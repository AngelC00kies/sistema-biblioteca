import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, STAFF_ROLES } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { validateBody } from '../../middleware/validate.js';
import { copiesController } from './controller.js';

const router = Router();

const copyUpdateSchema = z
  .object({
    status: z.enum(['available', 'loaned', 'lost', 'maintenance']).optional(),
    condition: z.enum(['good', 'regular', 'damaged']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Debe indicar al menos un campo a modificar',
  });

router.use(authenticate);

router.put(
  '/:id',
  requireRole(...STAFF_ROLES),
  validateBody(copyUpdateSchema),
  asyncHandler(copiesController.update),
);

router.delete('/:id', requireRole('admin'), asyncHandler(copiesController.remove));

export default router;

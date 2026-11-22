import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, STAFF_ROLES } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { validateBody } from '../../middleware/validate.js';
import { categoriesController } from './controller.js';

const router = Router();

const categorySchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(60),
  description: z.string().max(300).nullish(),
});

router.get('/', authenticate, asyncHandler(categoriesController.list));
router.get('/:id', authenticate, asyncHandler(categoriesController.get));
router.post(
  '/',
  authenticate,
  requireRole(...STAFF_ROLES),
  validateBody(categorySchema),
  asyncHandler(categoriesController.create),
);
router.put(
  '/:id',
  authenticate,
  requireRole(...STAFF_ROLES),
  validateBody(categorySchema),
  asyncHandler(categoriesController.update),
);
router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  asyncHandler(categoriesController.remove),
);

export default router;

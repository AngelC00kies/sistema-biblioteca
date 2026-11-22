import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, STAFF_ROLES } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { validateQuery } from '../../middleware/validate.js';
import { finesController } from './controller.js';

const router = Router();

router.use(authenticate);

const listQuerySchema = z.object({
  status: z.enum(['pending', 'paid']).optional(),
});

router.get(
  '/',
  requireRole(...STAFF_ROLES),
  validateQuery(listQuerySchema),
  asyncHandler(finesController.list),
);
router.get('/my', asyncHandler(finesController.mine));
router.post('/:id/pay', asyncHandler(finesController.pay));

export default router;

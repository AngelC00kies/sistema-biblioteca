import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, STAFF_ROLES } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { reservationsController } from './controller.js';

const router = Router();

router.use(authenticate);

const createSchema = z.object({
  bookId: z.number().int().positive('Debe seleccionar un libro'),
});

const listQuerySchema = z.object({
  status: z.enum(['pending', 'ready', 'fulfilled', 'cancelled']).optional(),
});

const staff = requireRole(...STAFF_ROLES);

router.get('/', validateQuery(listQuerySchema), asyncHandler(reservationsController.list));
router.get('/my', asyncHandler(reservationsController.mine));
router.post('/', validateBody(createSchema), asyncHandler(reservationsController.create));
router.post('/:id/cancel', asyncHandler(reservationsController.cancel));
router.post('/:id/fulfill', staff, asyncHandler(reservationsController.fulfill));

export default router;

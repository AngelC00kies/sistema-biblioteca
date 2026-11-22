import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, STAFF_ROLES } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { validateQuery } from '../../middleware/validate.js';
import { reportsController } from './controller.js';

const router = Router();

router.use(authenticate, requireRole(...STAFF_ROLES));

const topQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

router.get('/summary', asyncHandler(reportsController.summary));
router.get('/top-books', validateQuery(topQuerySchema), asyncHandler(reportsController.topBooks));
router.get('/overdue', asyncHandler(reportsController.overdue));

export default router;

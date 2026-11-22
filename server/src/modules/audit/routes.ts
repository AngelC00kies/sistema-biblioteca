import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { validateQuery } from '../../middleware/validate.js';
import { auditController } from './controller.js';

const router = Router();

router.use(authenticate, requireRole('admin'));

const querySchema = z.object({
  action: z.string().max(60).optional(),
  entity: z.string().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

router.get('/', validateQuery(querySchema), asyncHandler(auditController.list));

export default router;

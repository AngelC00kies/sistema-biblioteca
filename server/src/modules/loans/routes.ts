import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, STAFF_ROLES } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { loansController } from './controller.js';

const router = Router();

router.use(authenticate);

const createLoanSchema = z.object({
  copyId: z.number().int().positive('Debe seleccionar un ejemplar'),
  memberId: z.number().int().positive('Debe seleccionar un socio'),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
    .optional(),
  notes: z.string().max(500).nullish(),
});

const listQuerySchema = z.object({
  status: z.enum(['active', 'returned', 'overdue']).optional(),
  search: z.string().max(120).optional(),
  overdue: z.enum(['true', 'false']).optional(),
  memberId: z.coerce.number().int().positive().optional(),
});

const staff = requireRole(...STAFF_ROLES);

router.get('/', validateQuery(listQuerySchema), asyncHandler(loansController.list));
router.get('/my', asyncHandler(loansController.mine));
router.post('/', staff, validateBody(createLoanSchema), asyncHandler(loansController.create));
router.get('/:id', asyncHandler(loansController.get));
router.post('/:id/return', staff, asyncHandler(loansController.returnLoan));

export default router;

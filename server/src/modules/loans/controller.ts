import type { Request, Response } from 'express';
import { errors } from '../../errors/AppError.js';
import { loansService } from './service.js';

export const loansController = {
  async list(req: Request, res: Response): Promise<void> {
    const query = req.query as {
      status?: 'active' | 'returned' | 'overdue';
      search?: string;
      overdue?: string;
      memberId?: string;
    };

    // Un socio solo puede consultar su propio historial.
    const isMember = req.user!.role === 'member';
    const filters = {
      status: query.status,
      search: isMember ? undefined : query.search,
      overdueOnly: query.overdue === 'true' && !isMember,
      userId: isMember ? req.user!.id : query.memberId ? Number(query.memberId) : undefined,
    };

    const items = loansService.list(filters);
    res.status(200).json({ ok: true, data: items, meta: { total: items.length } });
  },

  async mine(req: Request, res: Response): Promise<void> {
    const items = loansService.my(req.user!.id);
    res.status(200).json({ ok: true, data: items, meta: { total: items.length } });
  },

  async get(req: Request, res: Response): Promise<void> {
    const loan = loansService.get(Number(req.params.id));
    // Un socio solo puede consultar el detalle de sus propios préstamos (IDOR).
    if (req.user!.role === 'member' && loan.user_id !== req.user!.id) {
      throw errors.forbidden('Solo puedes consultar tus propios préstamos');
    }
    res.status(200).json({ ok: true, data: loan });
  },

  async create(req: Request, res: Response): Promise<void> {
    const loan = loansService.create(req.body, { actorId: req.user!.id, ip: req.clientIp });
    res.status(201).json({ ok: true, data: loan });
  },

  async returnLoan(req: Request, res: Response): Promise<void> {
    const result = loansService.returnLoan(Number(req.params.id), {
      actorId: req.user!.id,
      ip: req.clientIp,
    });
    res.status(200).json({ ok: true, data: result });
  },
};

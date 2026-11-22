import type { Request, Response } from 'express';
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
    res.status(200).json({ ok: true, data: loansService.get(Number(req.params.id)) });
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

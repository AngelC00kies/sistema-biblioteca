import type { Request, Response } from 'express';
import { finesService } from './service.js';

export const finesController = {
  async list(req: Request, res: Response): Promise<void> {
    const query = req.query as { status?: 'pending' | 'paid' };
    const isMember = req.user!.role === 'member';
    const items = finesService.list({
      status: query.status,
      userId: isMember ? req.user!.id : undefined,
    });
    res.status(200).json({ ok: true, data: items, meta: { total: items.length } });
  },

  async mine(req: Request, res: Response): Promise<void> {
    const items = finesService.mine(req.user!.id);
    const summary = finesService.pendingSummary(req.user!.id);
    res.status(200).json({ ok: true, data: items, meta: { total: items.length, summary } });
  },

  async pay(req: Request, res: Response): Promise<void> {
    const fine = finesService.pay(Number(req.params.id), {
      actorId: req.user!.id,
      role: req.user!.role,
      ip: req.clientIp,
    });
    res.status(200).json({ ok: true, data: fine });
  },
};

import type { Request, Response } from 'express';
import { reservationsService } from './service.js';

export const reservationsController = {
  async list(req: Request, res: Response): Promise<void> {
    const query = req.query as { status?: string };
    const isMember = req.user!.role === 'member';
    const items = reservationsService.list({
      status: query.status,
      userId: isMember ? req.user!.id : undefined,
    });
    res.status(200).json({ ok: true, data: items, meta: { total: items.length } });
  },

  async mine(req: Request, res: Response): Promise<void> {
    const items = reservationsService.mine(req.user!.id);
    res.status(200).json({ ok: true, data: items, meta: { total: items.length } });
  },

  async create(req: Request, res: Response): Promise<void> {
    const reservation = reservationsService.create(req.body, {
      actorId: req.user!.id,
      ip: req.clientIp,
    });
    res.status(201).json({ ok: true, data: reservation });
  },

  async cancel(req: Request, res: Response): Promise<void> {
    const reservation = reservationsService.cancel(Number(req.params.id), {
      actorId: req.user!.id,
      role: req.user!.role,
      ip: req.clientIp,
    });
    res.status(200).json({ ok: true, data: reservation });
  },

  async fulfill(req: Request, res: Response): Promise<void> {
    const reservation = reservationsService.fulfill(Number(req.params.id), {
      actorId: req.user!.id,
      ip: req.clientIp,
    });
    res.status(200).json({ ok: true, data: reservation });
  },
};

import type { Request, Response } from 'express';
import type { Role } from '../../middleware/auth.js';
import { usersService } from './service.js';

export const usersController = {
  async list(req: Request, res: Response): Promise<void> {
    const query = req.query as { role?: Role; status?: string; search?: string };
    const result = usersService.list(query);
    res.status(200).json({ ok: true, data: result.items, meta: { total: result.total } });
  },

  async get(req: Request, res: Response): Promise<void> {
    const user = usersService.get(Number(req.params.id));
    res.status(200).json({ ok: true, data: user });
  },

  async create(req: Request, res: Response): Promise<void> {
    const user = await usersService.create(req.body, {
      actorId: req.user!.id,
      ip: req.clientIp,
    });
    res.status(201).json({ ok: true, data: user });
  },

  async update(req: Request, res: Response): Promise<void> {
    const user = await usersService.update(Number(req.params.id), req.body, {
      actorId: req.user!.id,
      ip: req.clientIp,
    });
    res.status(200).json({ ok: true, data: user });
  },

  async remove(req: Request, res: Response): Promise<void> {
    const result = usersService.remove(Number(req.params.id), {
      actorId: req.user!.id,
      ip: req.clientIp,
    });
    res.status(200).json({ ok: true, data: result });
  },
};

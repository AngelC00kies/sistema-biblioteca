import type { Request, Response } from 'express';
import { categoriesService } from './service.js';

export const categoriesController = {
  async list(_req: Request, res: Response): Promise<void> {
    res.status(200).json({ ok: true, data: categoriesService.list() });
  },

  async get(req: Request, res: Response): Promise<void> {
    res.status(200).json({ ok: true, data: categoriesService.get(Number(req.params.id)) });
  },

  async create(req: Request, res: Response): Promise<void> {
    const data = req.body as { name: string; description?: string | null };
    const category = categoriesService.create(data, {
      actorId: req.user!.id,
      ip: req.clientIp,
    });
    res.status(201).json({ ok: true, data: category });
  },

  async update(req: Request, res: Response): Promise<void> {
    const data = req.body as { name: string; description?: string | null };
    const category = categoriesService.update(Number(req.params.id), data, {
      actorId: req.user!.id,
      ip: req.clientIp,
    });
    res.status(200).json({ ok: true, data: category });
  },

  async remove(req: Request, res: Response): Promise<void> {
    categoriesService.remove(Number(req.params.id), {
      actorId: req.user!.id,
      ip: req.clientIp,
    });
    res.status(200).json({ ok: true, data: { eliminated: true } });
  },
};

import type { Request, Response } from 'express';
import { booksService } from '../books/service.js';

export const copiesController = {
  async update(req: Request, res: Response): Promise<void> {
    const copy = booksService.updateCopy(Number(req.params.id), req.body, {
      actorId: req.user!.id,
      ip: req.clientIp,
    });
    res.status(200).json({ ok: true, data: copy });
  },

  async remove(req: Request, res: Response): Promise<void> {
    booksService.removeCopy(Number(req.params.id), {
      actorId: req.user!.id,
      ip: req.clientIp,
    });
    res.status(200).json({ ok: true, data: { eliminated: true } });
  },
};

import type { Request, Response } from 'express';
import { reportsService } from './service.js';

export const reportsController = {
  async summary(_req: Request, res: Response): Promise<void> {
    res.status(200).json({ ok: true, data: reportsService.summary() });
  },

  async topBooks(req: Request, res: Response): Promise<void> {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    res.status(200).json({ ok: true, data: reportsService.topBooks(limit) });
  },

  async overdue(_req: Request, res: Response): Promise<void> {
    res.status(200).json({ ok: true, data: reportsService.overdue() });
  },
};

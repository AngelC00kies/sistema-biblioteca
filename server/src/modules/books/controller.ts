import type { Request, Response } from 'express';
import { booksService } from './service.js';

export const booksController = {
  async list(req: Request, res: Response): Promise<void> {
    const query = req.query as {
      search?: string;
      categoryId?: string;
      available?: string;
      page?: string;
      pageSize?: string;
    };
    const result = booksService.list({
      search: query.search,
      categoryId: query.categoryId ? Number(query.categoryId) : undefined,
      available: query.available === 'true',
      page: query.page ? Number(query.page) : undefined,
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
    });
    res.status(200).json({
      ok: true,
      data: result.items,
      meta: { total: result.total, page: result.page, pageSize: Number(query.pageSize ?? 10) },
    });
  },

  async get(req: Request, res: Response): Promise<void> {
    res.status(200).json({ ok: true, data: booksService.get(Number(req.params.id)) });
  },

  async create(req: Request, res: Response): Promise<void> {
    const book = booksService.create(req.body, { actorId: req.user!.id, ip: req.clientIp });
    res.status(201).json({ ok: true, data: book });
  },

  async update(req: Request, res: Response): Promise<void> {
    const book = booksService.update(Number(req.params.id), req.body, {
      actorId: req.user!.id,
      ip: req.clientIp,
    });
    res.status(200).json({ ok: true, data: book });
  },

  async remove(req: Request, res: Response): Promise<void> {
    booksService.remove(Number(req.params.id), { actorId: req.user!.id, ip: req.clientIp });
    res.status(200).json({ ok: true, data: { eliminated: true } });
  },

  async listCopies(req: Request, res: Response): Promise<void> {
    const copies = booksService.listCopies(Number(req.params.id));
    res.status(200).json({ ok: true, data: copies });
  },

  async addCopy(req: Request, res: Response): Promise<void> {
    const copy = booksService.addCopy(Number(req.params.id), req.body, {
      actorId: req.user!.id,
      ip: req.clientIp,
    });
    res.status(201).json({ ok: true, data: copy });
  },
};

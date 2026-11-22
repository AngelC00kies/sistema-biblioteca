import type { Request, Response } from 'express';
import { auditRepository } from './repository.js';

export const auditController = {
  async list(req: Request, res: Response): Promise<void> {
    const query = req.query as { action?: string; entity?: string; limit?: string };
    const items = auditRepository.findAll({
      action: query.action,
      entity: query.entity,
      limit: query.limit ? Number(query.limit) : undefined,
    });
    res.status(200).json({
      ok: true,
      data: items,
      meta: { total: items.length, stored: auditRepository.countAll() },
    });
  },
};

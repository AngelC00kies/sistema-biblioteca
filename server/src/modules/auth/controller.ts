import type { Request, Response } from 'express';
import { authService } from './service.js';

export const authController = {
  async login(req: Request, res: Response): Promise<void> {
    const { username, password } = req.body as { username: string; password: string };
    const result = await authService.login(username, password, { ip: req.clientIp });
    res.status(200).json({ ok: true, data: result });
  },

  async register(req: Request, res: Response): Promise<void> {
    const { username, email, password, fullName, role } = req.body as {
      username: string;
      email: string;
      password: string;
      fullName: string;
      role?: 'admin' | 'librarian' | 'member';
    };
    const user = await authService.register(
      { username, email, password, fullName, role },
      { actorId: req.user?.id, ip: req.clientIp },
    );
    res.status(201).json({ ok: true, data: user });
  },

  async me(req: Request, res: Response): Promise<void> {
    const user = authService.me(req.user!.id);
    res.status(200).json({ ok: true, data: user });
  },
};

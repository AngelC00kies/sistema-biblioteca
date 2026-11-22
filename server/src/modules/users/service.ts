import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import { errors } from '../../errors/AppError.js';
import type { Role } from '../../middleware/auth.js';
import { audit } from '../../utils/logger.js';
import { toPublicUser, userRepository, type PublicUser } from './repository.js';

export const usersService = {
  list(filters: { role?: Role; status?: string; search?: string } = {}): {
    items: PublicUser[];
    total: number;
  } {
    const items = userRepository.findAll(filters);
    return { items, total: items.length };
  },

  get(id: number): PublicUser {
    const user = userRepository.findById(id);
    if (!user) throw errors.notFound('Usuario');
    return toPublicUser(user);
  },

  async create(
    data: {
      username: string;
      email: string;
      password: string;
      fullName: string;
      role: Role;
      status?: string;
    },
    context: { actorId: number; ip?: string },
  ): Promise<PublicUser> {
    if (userRepository.findByUsername(data.username.trim())) {
      throw errors.conflict('El nombre de usuario ya existe');
    }
    if (userRepository.findByEmail(data.email.trim())) {
      throw errors.conflict('El correo electrónico ya está registrado');
    }

    const passwordHash = await bcrypt.hash(data.password, env.bcryptRounds);
    const id = userRepository.insert({
      username: data.username.trim(),
      email: data.email.trim(),
      passwordHash,
      fullName: data.fullName.trim(),
      role: data.role,
      status: data.status,
    });

    audit({
      userId: context.actorId,
      action: 'USER_CREATED',
      entity: 'users',
      entityId: id,
      details: `${data.username} (${data.role})`,
      ip: context.ip,
    });

    return this.get(id);
  },

  async update(
    id: number,
    data: Partial<{
      email: string;
      fullName: string;
      role: Role;
      status: string;
      password: string;
    }>,
    context: { actorId: number; ip?: string },
  ): Promise<PublicUser> {
    const existing = userRepository.findById(id);
    if (!existing) throw errors.notFound('Usuario');

    if (data.email && data.email !== existing.email) {
      const duplicated = userRepository.findByEmail(data.email.trim());
      if (duplicated && duplicated.id !== id) {
        throw errors.conflict('El correo electrónico ya está registrado');
      }
    }

    const payload: Parameters<typeof userRepository.update>[1] = {};
    if (data.email !== undefined) payload.email = data.email.trim();
    if (data.fullName !== undefined) payload.fullName = data.fullName.trim();
    if (data.role !== undefined) payload.role = data.role;
    if (data.status !== undefined) payload.status = data.status;
    if (data.password) payload.passwordHash = await bcrypt.hash(data.password, env.bcryptRounds);

    userRepository.update(id, payload);

    audit({
      userId: context.actorId,
      action: 'USER_UPDATED',
      entity: 'users',
      entityId: id,
      details: `Campos modificados: ${Object.keys(payload).join(', ')}`,
      ip: context.ip,
    });

    return this.get(id);
  },

  /**
   * Eliminación física solo si el usuario no tiene historial;
   * en caso contrario se realiza una baja lógica para preservar la integridad
   * referencial de préstamos, multas y auditoría.
   */
  remove(id: number, context: { actorId: number; ip?: string }): { mode: 'deleted' | 'deactivated' } {
    const existing = userRepository.findById(id);
    if (!existing) throw errors.notFound('Usuario');

    if (context.actorId === id) {
      throw errors.businessRule('No puedes eliminar la cuenta con la que iniciaste sesión');
    }

    const hasHistory =
      userRepository.countLoans(id) > 0 ||
      userRepository.countAll() <= 1;

    if (hasHistory) {
      userRepository.deactivate(id);
      audit({
        userId: context.actorId,
        action: 'USER_DEACTIVATED',
        entity: 'users',
        entityId: id,
        details: `${existing.username} dado de baja (cuenta con historial)`,
        ip: context.ip,
      });
      return { mode: 'deactivated' };
    }

    userRepository.remove(id);
    audit({
      userId: context.actorId,
      action: 'USER_DELETED',
      entity: 'users',
      entityId: id,
      details: existing.username,
      ip: context.ip,
    });
    return { mode: 'deleted' };
  },
};

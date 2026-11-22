import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import { errors } from '../../errors/AppError.js';
import { signToken, type Role } from '../../middleware/auth.js';
import { audit } from '../../utils/logger.js';
import {
  toPublicUser,
  userRepository,
  type PublicUser,
} from '../users/repository.js';

export type LoginResult = {
  token: string;
  user: PublicUser;
};

export const authService = {
  async login(
    username: string,
    password: string,
    context: { ip?: string } = {},
  ): Promise<LoginResult> {
    const user = userRepository.findByUsername(username.trim());

    // Comparación siempre ejecutada para dificultar ataques de temporización.
    const hash = user?.password_hash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinv';
    const valid = await bcrypt.compare(password, hash);

    if (!user || !valid) {
      audit({
        userId: user?.id ?? null,
        action: 'LOGIN_FAILED',
        entity: 'users',
        entityId: user?.id ?? null,
        details: `Usuario o contraseña incorrectos: ${username}`,
        ip: context.ip,
      });
      throw errors.unauthorized('Usuario o contraseña incorrectos');
    }

    if (user.status !== 'active') {
      audit({
        userId: user.id,
        action: 'LOGIN_BLOCKED',
        entity: 'users',
        entityId: user.id,
        details: 'Intento de acceso con cuenta inactiva',
        ip: context.ip,
      });
      throw errors.forbidden('La cuenta está inactiva. Contacta al administrador.');
    }

    audit({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      entity: 'users',
      entityId: user.id,
      details: `Acceso de ${user.username}`,
      ip: context.ip,
    });

    const token = signToken({
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      status: user.status,
    });

    return { token, user: toPublicUser(user) };
  },

  async register(
    data: {
      username: string;
      email: string;
      password: string;
      fullName: string;
      role?: Role;
    },
    context: { actorId?: number; ip?: string } = {},
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
      role: data.role ?? 'member',
    });

    audit({
      userId: context.actorId ?? null,
      action: 'USER_CREATED',
      entity: 'users',
      entityId: id,
      details: `Usuario ${data.username} con rol ${data.role ?? 'member'}`,
      ip: context.ip,
    });

    const created = userRepository.findById(id);
    if (!created) throw errors.notFound('Usuario');
    return toPublicUser(created);
  },

  me(userId: number): PublicUser {
    const user = userRepository.findById(userId);
    if (!user) throw errors.notFound('Usuario');
    return toPublicUser(user);
  },
};

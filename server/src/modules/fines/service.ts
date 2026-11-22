import { errors } from '../../errors/AppError.js';
import { audit } from '../../utils/logger.js';
import { finesRepository, type FineView } from './repository.js';

export const finesService = {
  list(filters: { status?: 'pending' | 'paid'; userId?: number } = {}): FineView[] {
    return finesRepository.findAll(filters);
  },

  mine(userId: number): FineView[] {
    return this.list({ userId });
  },

  /**
   * Liquida una multa. Un socio solo puede pagar las suyas;
   * el personal puede liquidar cualquier multa (ej. pago en ventanilla).
   */
  pay(
    id: number,
    context: { actorId: number; role: string; ip?: string },
  ): FineView {
    const fine = finesRepository.findById(id);
    if (!fine) throw errors.notFound('Multa');

    if (context.role === 'member' && fine.user_id !== context.actorId) {
      throw errors.forbidden('Solo puedes pagar tus propias multas');
    }
    if (fine.status === 'paid') {
      throw errors.businessRule('La multa ya fue pagada');
    }

    finesRepository.markPaid(id);
    audit({
      userId: context.actorId,
      action: 'FINE_PAID',
      entity: 'fines',
      entityId: id,
      details: `${fine.member_name} · ${fine.amount} (${fine.reason})`,
      ip: context.ip,
    });

    const updated = finesRepository.findById(id);
    if (!updated) throw errors.notFound('Multa');
    return updated;
  },

  pendingSummary(userId: number): { count: number; total: number } {
    return {
      count: finesRepository.countPendingByUser(userId),
      total: Number(finesRepository.sumPendingByUser(userId).toFixed(2)),
    };
  },
};

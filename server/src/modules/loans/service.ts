import { env } from '../../config/env.js';
import { getDb } from '../../db/connection.js';
import { errors } from '../../errors/AppError.js';
import { audit } from '../../utils/logger.js';
import { addDays, daysBetween, todayISO } from '../../utils/date.js';
import { booksRepository } from '../books/repository.js';
import { finesRepository } from '../fines/repository.js';
import { reservationsRepository } from '../reservations/repository.js';
import { userRepository } from '../users/repository.js';
import { loansRepository, type LoanFilters, type LoanView } from './repository.js';

export const loansService = {
  list(filters: LoanFilters = {}): LoanView[] {
    loansRepository.refreshOverdueStatus();
    return loansRepository.findAll(filters);
  },

  get(id: number): LoanView {
    loansRepository.refreshOverdueStatus();
    const loan = loansRepository.findById(id);
    if (!loan) throw errors.notFound('Préstamo');
    return loan;
  },

  my(userId: number): LoanView[] {
    return this.list({ userId });
  },

  create(
    data: { copyId: number; memberId: number; dueDate?: string; notes?: string | null },
    context: { actorId: number; ip?: string },
  ): LoanView {
    const copy = booksRepository.findCopyById(data.copyId);
    if (!copy) throw errors.notFound('Ejemplar');

    const member = userRepository.findById(data.memberId);
    if (!member) throw errors.notFound('Socio');
    if (member.status !== 'active') {
      throw errors.businessRule('El socio está inactivo y no puede realizar préstamos');
    }

    if (copy.status !== 'available') {
      throw errors.businessRule(
        `El ejemplar ${copy.inventory_code} no está disponible (estado: ${copy.status})`,
      );
    }
    if (loansRepository.findActiveByCopy(data.copyId)) {
      throw errors.businessRule('El ejemplar ya tiene un préstamo activo');
    }

    const pendingFines = finesRepository.countPendingByUser(member.id);
    if (pendingFines > 0) {
      throw errors.businessRule(
        'El socio tiene multas pendientes y no puede retirar material nuevo',
      );
    }

    const activeLoans = loansRepository.countActiveByUser(member.id);
    if (activeLoans >= env.maxActiveLoans) {
      throw errors.businessRule(
        `El socio alcanzó el límite de ${env.maxActiveLoans} préstamos activos`,
      );
    }

    const today = todayISO();
    const dueDate = data.dueDate ?? addDays(today, env.loanDays);
    if (daysBetween(today, dueDate) < 1) {
      throw errors.badRequest('La fecha de devolución debe ser posterior a la fecha de préstamo');
    }

    const loanId = getDb().transaction(() => {
      const id = loansRepository.insert({
        copyId: data.copyId,
        userId: member.id,
        dueDate,
        notes: data.notes,
      });
      booksRepository.updateCopyStatus(data.copyId, 'loaned');
      return id;
    })();

    audit({
      userId: context.actorId,
      action: 'LOAN_CREATED',
      entity: 'loans',
      entityId: loanId,
      details: `${copy.inventory_code} → ${member.full_name}, vence ${dueDate}`,
      ip: context.ip,
    });

    return this.get(loanId);
  },

  returnLoan(
    id: number,
    context: { actorId: number; ip?: string },
  ): { loan: LoanView; fineAmount: number; reservationReadyId: number | null } {
    loansRepository.refreshOverdueStatus();
    const loan = loansRepository.findById(id);
    if (!loan) throw errors.notFound('Préstamo');
    if (loan.status === 'returned') {
      throw errors.businessRule('Este préstamo ya fue devuelto');
    }

    const today = todayISO();
    const lateDays = Math.max(0, daysBetween(loan.due_date, today) - env.graceDays);
    const fineAmount = Number((lateDays * env.finePerDay).toFixed(2));

    const { reservationReadyId } = getDb().transaction(() => {
      loansRepository.markReturned(id, today, 'returned', fineAmount);

      // El ejemplar vuelve al catálogo salvo que se haya marcado como perdido.
      const copy = booksRepository.findCopyById(loan.copy_id);
      if (copy && copy.status === 'loaned') {
        booksRepository.updateCopyStatus(copy.id, 'available');
      }

      let createdFineId: number | null = null;
      if (fineAmount > 0) {
        createdFineId = finesRepository.insert({
          loanId: id,
          userId: loan.user_id,
          amount: fineAmount,
          reason: `Atraso de ${lateDays} día(s) en la devolución`,
        });
      }

      // Si había reserva sobre ese libro, se avisa al socio más antiguo.
      let readyId: number | null = null;
      const pending = reservationsRepository.findPendingByBook(loan.book_id);
      if (pending.length > 0) {
        reservationsRepository.markReady(pending[0].id, addDays(today, env.reservationDays));
        readyId = pending[0].id;
      }

      return { fineId: createdFineId, reservationReadyId: readyId };
    })();

    audit({
      userId: context.actorId,
      action: 'LOAN_RETURNED',
      entity: 'loans',
      entityId: id,
      details: `${loan.inventory_code}, atraso ${lateDays} día(s), multa ${fineAmount}`,
      ip: context.ip,
    });

    return { loan: this.get(id), fineAmount, reservationReadyId };
  },
};

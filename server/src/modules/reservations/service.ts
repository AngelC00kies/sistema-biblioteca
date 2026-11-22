import { env } from '../../config/env.js';
import { errors } from '../../errors/AppError.js';
import { audit } from '../../utils/logger.js';
import { addDays, todayISO } from '../../utils/date.js';
import { booksRepository, type BookRow } from '../books/repository.js';
import { loansRepository } from '../loans/repository.js';
import {
  reservationsRepository,
  type ReservationView,
} from './repository.js';

function assertBookHasCopies(book: BookRow): void {
  const copies = booksRepository.findCopies(book.id);
  if (copies.length === 0) {
    throw errors.businessRule('El libro no tiene ejemplares registrados');
  }
}

export const reservationsService = {
  list(filters: { status?: string; userId?: number } = {}): ReservationView[] {
    reservationsRepository.expireStale();
    return reservationsRepository.findAll(filters);
  },

  mine(userId: number): ReservationView[] {
    return this.list({ userId });
  },

  create(
    data: { bookId: number },
    context: { actorId: number; ip?: string },
  ): ReservationView {
    reservationsRepository.expireStale();

    const book = booksRepository.findById(data.bookId);
    if (!book) throw errors.notFound('Libro');
    assertBookHasCopies(book);

    const available = booksRepository.countAvailableCopies(book.id);
    if (available > 0) {
      throw errors.businessRule(
        'El libro tiene ejemplares disponibles: realiza un préstamo directo en lugar de reservar',
      );
    }

    const existing = reservationsRepository.findActiveByBookAndUser(book.id, context.actorId);
    if (existing) {
      throw errors.conflict('Ya tienes una reserva activa para este libro');
    }

    const active = reservationsRepository.countActiveByUser(context.actorId);
    if (active >= env.maxActiveReservations) {
      throw errors.businessRule(
        `Alcanzaste el límite de ${env.maxActiveReservations} reservas activas`,
      );
    }

    const id = reservationsRepository.insert(
      book.id,
      context.actorId,
      addDays(todayISO(), env.reservationDays),
    );

    audit({
      userId: context.actorId,
      action: 'RESERVATION_CREATED',
      entity: 'reservations',
      entityId: id,
      details: book.title,
      ip: context.ip,
    });

    const created = reservationsRepository.findById(id);
    if (!created) throw errors.notFound('Reserva');
    return created;
  },

  cancel(
    id: number,
    context: { actorId: number; role: string; ip?: string },
  ): ReservationView {
    const reservation = reservationsRepository.findById(id);
    if (!reservation) throw errors.notFound('Reserva');

    if (context.role === 'member' && reservation.user_id !== context.actorId) {
      throw errors.forbidden('Solo puedes cancelar tus propias reservas');
    }
    if (reservation.status === 'fulfilled' || reservation.status === 'cancelled') {
      throw errors.businessRule('La reserva ya está cerrada y no admite cambios');
    }

    reservationsRepository.setStatus(id, 'cancelled');
    audit({
      userId: context.actorId,
      action: 'RESERVATION_CANCELLED',
      entity: 'reservations',
      entityId: id,
      details: reservation.book_title,
      ip: context.ip,
    });

    const updated = reservationsRepository.findById(id);
    if (!updated) throw errors.notFound('Reserva');
    return updated;
  },

  /** Marca la reserva como atendida cuando el socio retira el ejemplar. */
  fulfill(id: number, context: { actorId: number; ip?: string }): ReservationView {
    const reservation = reservationsRepository.findById(id);
    if (!reservation) throw errors.notFound('Reserva');
    if (reservation.status !== 'ready') {
      throw errors.businessRule('La reserva aún no está lista para entrega');
    }

    reservationsRepository.setStatus(id, 'fulfilled');
    audit({
      userId: context.actorId,
      action: 'RESERVATION_FULFILLED',
      entity: 'reservations',
      entityId: id,
      details: reservation.book_title,
      ip: context.ip,
    });

    const updated = reservationsRepository.findById(id);
    if (!updated) throw errors.notFound('Reserva');
    return updated;
  },

  /** Indica si el libro tiene algún préstamo activo (para la regla de reserva). */
  hasActiveLoan(bookId: number): boolean {
    const copies = booksRepository.findCopies(bookId);
    return copies.some((copy) => loansRepository.findActiveByCopy(copy.id) !== undefined);
  },
};

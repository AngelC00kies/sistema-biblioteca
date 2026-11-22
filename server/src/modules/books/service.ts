import { errors } from '../../errors/AppError.js';
import { audit } from '../../utils/logger.js';
import { categoriesRepository } from '../categories/repository.js';
import {
  booksRepository,
  type BookFilters,
  type BookWithStats,
  type CopyRow,
} from './repository.js';

function assertCategory(categoryId?: number | null): void {
  if (categoryId && !categoriesRepository.findById(categoryId)) {
    throw errors.badRequest('La categoría indicada no existe');
  }
}

export const booksService = {
  list(filters: BookFilters = {}): { items: BookWithStats[]; total: number; page: number } {
    const result = booksRepository.findAll(filters);
    return { ...result, page: filters.page ?? 1 };
  },

  get(id: number): BookWithStats {
    const book = booksRepository.findById(id);
    if (!book) throw errors.notFound('Libro');
    return book;
  },

  create(
    data: {
      isbn: string;
      title: string;
      author: string;
      publisher?: string | null;
      publicationYear?: number | null;
      categoryId?: number | null;
      description?: string | null;
    },
    context: { actorId: number; ip?: string },
  ): BookWithStats {
    if (booksRepository.findByIsbn(data.isbn.trim())) {
      throw errors.conflict('Ya existe un libro con ese ISBN');
    }
    assertCategory(data.categoryId);

    const id = booksRepository.insert({ ...data, isbn: data.isbn.trim() });
    audit({
      userId: context.actorId,
      action: 'BOOK_CREATED',
      entity: 'books',
      entityId: id,
      details: data.title,
      ip: context.ip,
    });
    return this.get(id);
  },

  update(
    id: number,
    data: {
      isbn: string;
      title: string;
      author: string;
      publisher?: string | null;
      publicationYear?: number | null;
      categoryId?: number | null;
      description?: string | null;
    },
    context: { actorId: number; ip?: string },
  ): BookWithStats {
    const existing = booksRepository.findById(id);
    if (!existing) throw errors.notFound('Libro');

    const duplicated = booksRepository.findByIsbn(data.isbn.trim());
    if (duplicated && duplicated.id !== id) {
      throw errors.conflict('Ya existe un libro con ese ISBN');
    }
    assertCategory(data.categoryId);

    booksRepository.update(id, { ...data, isbn: data.isbn.trim() });
    audit({
      userId: context.actorId,
      action: 'BOOK_UPDATED',
      entity: 'books',
      entityId: id,
      details: `${existing.title} → ${data.title}`,
      ip: context.ip,
    });
    return this.get(id);
  },

  remove(id: number, context: { actorId: number; ip?: string }): void {
    const existing = booksRepository.findById(id);
    if (!existing) throw errors.notFound('Libro');

    const copies = booksRepository.findCopies(id);
    const busy = copies.some((copy) => booksRepository.countActiveLoansOfCopy(copy.id) > 0);
    if (busy) {
      throw errors.businessRule(
        'No se puede eliminar: el libro tiene ejemplares prestados actualmente',
      );
    }

    booksRepository.remove(id);
    audit({
      userId: context.actorId,
      action: 'BOOK_DELETED',
      entity: 'books',
      entityId: id,
      details: existing.title,
      ip: context.ip,
    });
  },

  // ---------- Ejemplares ----------

  listCopies(bookId: number): CopyRow[] {
    this.get(bookId);
    return booksRepository.findCopies(bookId);
  },

  addCopy(
    bookId: number,
    data: { inventoryCode: string; condition?: string },
    context: { actorId: number; ip?: string },
  ): CopyRow {
    this.get(bookId);
    if (booksRepository.findCopyByCode(data.inventoryCode.trim())) {
      throw errors.conflict('Ya existe un ejemplar con ese código de inventario');
    }
    const id = booksRepository.insertCopy(
      bookId,
      data.inventoryCode.trim(),
      data.condition ?? 'good',
    );
    audit({
      userId: context.actorId,
      action: 'COPY_CREATED',
      entity: 'copies',
      entityId: id,
      details: data.inventoryCode,
      ip: context.ip,
    });
    const copy = booksRepository.findCopyById(id);
    if (!copy) throw errors.notFound('Ejemplar');
    return copy;
  },

  updateCopy(
    id: number,
    data: { status?: CopyRow['status']; condition?: string },
    context: { actorId: number; ip?: string },
  ): CopyRow {
    const copy = booksRepository.findCopyById(id);
    if (!copy) throw errors.notFound('Ejemplar');

    if (data.status === 'available' && copy.status === 'loaned') {
      const active = booksRepository.countActiveLoansOfCopy(id);
      if (active > 0) {
        throw errors.businessRule(
          'No se puede marcar como disponible: el ejemplar tiene un préstamo activo. Regresa la devolución primero.',
        );
      }
    }

    booksRepository.updateCopyStatus(id, data.status ?? copy.status, data.condition);
    audit({
      userId: context.actorId,
      action: 'COPY_UPDATED',
      entity: 'copies',
      entityId: id,
      details: `${copy.status} → ${data.status ?? copy.status}`,
      ip: context.ip,
    });
    const updated = booksRepository.findCopyById(id);
    if (!updated) throw errors.notFound('Ejemplar');
    return updated;
  },

  removeCopy(id: number, context: { actorId: number; ip?: string }): void {
    const copy = booksRepository.findCopyById(id);
    if (!copy) throw errors.notFound('Ejemplar');
    if (booksRepository.countActiveLoansOfCopy(id) > 0) {
      throw errors.businessRule('No se puede eliminar un ejemplar con préstamos activos');
    }
    booksRepository.removeCopy(id);
    audit({
      userId: context.actorId,
      action: 'COPY_DELETED',
      entity: 'copies',
      entityId: id,
      details: copy.inventory_code,
      ip: context.ip,
    });
  },
};

import { errors } from '../../errors/AppError.js';
import { audit } from '../../utils/logger.js';
import { categoriesRepository, type CategoryRow } from './repository.js';

export const categoriesService = {
  list(): CategoryRow[] {
    return categoriesRepository.findAll();
  },

  get(id: number): CategoryRow {
    const category = categoriesRepository.findById(id);
    if (!category) throw errors.notFound('Categoría');
    return category;
  },

  create(
    data: { name: string; description?: string | null },
    context: { actorId: number; ip?: string },
  ): CategoryRow {
    if (categoriesRepository.findByName(data.name.trim())) {
      throw errors.conflict('Ya existe una categoría con ese nombre');
    }
    const id = categoriesRepository.insert(data.name.trim(), data.description?.trim() ?? null);
    audit({
      userId: context.actorId,
      action: 'CATEGORY_CREATED',
      entity: 'categories',
      entityId: id,
      details: data.name,
      ip: context.ip,
    });
    return this.get(id);
  },

  update(
    id: number,
    data: { name: string; description?: string | null },
    context: { actorId: number; ip?: string },
  ): CategoryRow {
    const existing = categoriesRepository.findById(id);
    if (!existing) throw errors.notFound('Categoría');

    const duplicated = categoriesRepository.findByName(data.name.trim());
    if (duplicated && duplicated.id !== id) {
      throw errors.conflict('Ya existe una categoría con ese nombre');
    }

    categoriesRepository.update(id, data.name.trim(), data.description?.trim() ?? null);
    audit({
      userId: context.actorId,
      action: 'CATEGORY_UPDATED',
      entity: 'categories',
      entityId: id,
      details: `${existing.name} → ${data.name}`,
      ip: context.ip,
    });
    return this.get(id);
  },

  remove(id: number, context: { actorId: number; ip?: string }): void {
    const existing = categoriesRepository.findById(id);
    if (!existing) throw errors.notFound('Categoría');

    if (categoriesRepository.countBooks(id) > 0) {
      throw errors.businessRule(
        'No se puede eliminar: existen libros asociados a esta categoría',
      );
    }

    categoriesRepository.remove(id);
    audit({
      userId: context.actorId,
      action: 'CATEGORY_DELETED',
      entity: 'categories',
      entityId: id,
      details: existing.name,
      ip: context.ip,
    });
  },
};

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage } from '../api/client';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import type { Book, Category, Copy } from '../types';

type BookForm = {
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  publicationYear: string;
  categoryId: string;
  description: string;
};

const EMPTY_FORM: BookForm = {
  isbn: '',
  title: '',
  author: '',
  publisher: '',
  publicationYear: '',
  categoryId: '',
  description: '',
};

export function BooksPage() {
  const { hasRole } = useAuth();
  const isStaff = hasRole('admin', 'librarian');
  const isAdmin = hasRole('admin');

  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [form, setForm] = useState<BookForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [copiesBook, setCopiesBook] = useState<Book | null>(null);
  const [copies, setCopies] = useState<Copy[]>([]);
  const [copyCode, setCopyCode] = useState('');
  const [copyCondition, setCopyCondition] = useState('good');

  const pageSize = 10;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<Book[]>('/api/books', {
        query: {
          search: search.trim() || undefined,
          categoryId: categoryId || undefined,
          available: availableOnly ? 'true' : undefined,
          page,
          pageSize,
        },
      });
      setBooks(data);
      setTotal(data.length === pageSize ? page * pageSize + 1 : (page - 1) * pageSize + data.length);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, categoryId, availableOnly, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    api<Category[]>('/api/categories')
      .then(setCategories)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  function resetAndOpen(book?: Book) {
    setError(null);
    setNotice(null);
    if (book) {
      setForm({
        isbn: book.isbn,
        title: book.title,
        author: book.author,
        publisher: book.publisher ?? '',
        publicationYear: book.publication_year ? String(book.publication_year) : '',
        categoryId: book.category_id ? String(book.category_id) : '',
        description: book.description ?? '',
      });
      setEditingId(book.id);
    } else {
      setForm(EMPTY_FORM);
      setEditingId(null);
    }
    setShowForm(true);
  }

  async function submitBook(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const body = {
      isbn: form.isbn.trim(),
      title: form.title.trim(),
      author: form.author.trim(),
      publisher: form.publisher.trim() || null,
      publicationYear: form.publicationYear ? Number(form.publicationYear) : null,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      description: form.description.trim() || null,
    };

    try {
      if (editingId) {
        await api(`/api/books/${editingId}`, { method: 'PUT', body });
        setNotice('Libro actualizado correctamente.');
      } else {
        await api('/api/books', { method: 'POST', body });
        setNotice('Libro registrado correctamente.');
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function removeBook(book: Book) {
    if (!confirm(`¿Eliminar "${book.title}" del catálogo?`)) return;
    setError(null);
    try {
      await api(`/api/books/${book.id}`, { method: 'DELETE' });
      setNotice('Libro eliminado del catálogo.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function openCopies(book: Book) {
    setError(null);
    try {
      const data = await api<Copy[]>(`/api/books/${book.id}/copies`);
      setCopiesBook(book);
      setCopies(data);
      setCopyCode('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function addCopy(event: FormEvent) {
    event.preventDefault();
    if (!copiesBook) return;
    setError(null);
    try {
      await api(`/api/books/${copiesBook.id}/copies`, {
        method: 'POST',
        body: { inventoryCode: copyCode.trim(), condition: copyCondition },
      });
      setCopyCode('');
      setCopies(await api<Copy[]>(`/api/books/${copiesBook.id}/copies`));
      setNotice('Ejemplar agregado.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function changeCopyStatus(copy: Copy, status: Copy['status']) {
    setError(null);
    try {
      await api(`/api/copies/${copy.id}`, { method: 'PUT', body: { status } });
      if (copiesBook) setCopies(await api<Copy[]>(`/api/books/${copiesBook.id}/copies`));
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function reserve(book: Book) {
    setError(null);
    setNotice(null);
    try {
      await api('/api/reservations', { method: 'POST', body: { bookId: book.id } });
      setNotice(`Reserva registrada para "${book.title}". Te avisaremos cuando esté disponible.`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}

      <div className="toolbar">
        <input
          placeholder="Buscar por título, autor o ISBN…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          aria-label="Buscar libros"
        />
        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
          aria-label="Filtrar por categoría"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => {
              setAvailableOnly(e.target.checked);
              setPage(1);
            }}
          />
          Solo con ejemplares disponibles
        </label>
        {isStaff && (
          <button className="btn" onClick={() => resetAndOpen()}>
            + Nuevo libro
          </button>
        )}
      </div>

      <div className="card">
        {loading ? (
          <div className="empty">Cargando catálogo…</div>
        ) : books.length === 0 ? (
          <div className="empty">No se encontraron libros con los filtros aplicados.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Autor</th>
                  <th>Categoría</th>
                  <th>ISBN</th>
                  <th>Ejemplares</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {books.map((book) => (
                  <tr key={book.id}>
                    <td>
                      <strong>{book.title}</strong>
                      <div className="muted">{book.publisher ?? '—'}</div>
                    </td>
                    <td>{book.author}</td>
                    <td>{book.category_name ?? <span className="muted">Sin categoría</span>}</td>
                    <td className="muted">{book.isbn}</td>
                    <td>
                      <span
                        className={`badge ${book.available_copies > 0 ? 'success' : 'danger'}`}
                      >
                        {book.available_copies}/{book.total_copies} disponibles
                      </span>
                    </td>
                    <td className="actions">
                      <button className="btn ghost small" onClick={() => openCopies(book)}>
                        Ejemplares
                      </button>
                      {!isStaff && book.available_copies === 0 && (
                        <button className="btn small" onClick={() => reserve(book)}>
                          Reservar
                        </button>
                      )}
                      {isStaff && (
                        <button
                          className="btn secondary small"
                          onClick={() => resetAndOpen(book)}
                        >
                          Editar
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          className="btn danger small"
                          onClick={() => removeBook(book)}
                        >
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="toolbar mt-2" style={{ justifyContent: 'space-between' }}>
          <span className="muted">
            Página {page} de {totalPages}
          </span>
          <span>
            <button
              className="btn secondary small"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Anterior
            </button>{' '}
            <button
              className="btn secondary small"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente →
            </button>
          </span>
        </div>
      </div>

      {showForm && (
        <Modal
          title={editingId ? 'Editar libro' : 'Registrar libro'}
          onClose={() => setShowForm(false)}
          footer={
            <>
              <button className="btn secondary" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
              <button className="btn" form="book-form" type="submit">
                {editingId ? 'Guardar cambios' : 'Registrar'}
              </button>
            </>
          }
        >
          <form id="book-form" onSubmit={submitBook}>
            <div className="form-row">
              <div className="field">
                <label>ISBN *</label>
                <input
                  value={form.isbn}
                  onChange={(e) => setForm({ ...form, isbn: e.target.value })}
                  required
                  minLength={10}
                  maxLength={17}
                  placeholder="978-84-376-0494-7"
                />
              </div>
              <div className="field">
                <label>Año de publicación</label>
                <input
                  type="number"
                  min={1400}
                  max={new Date().getFullYear() + 1}
                  value={form.publicationYear}
                  onChange={(e) => setForm({ ...form, publicationYear: e.target.value })}
                  placeholder="1967"
                />
              </div>
            </div>

            <div className="field">
              <label>Título *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                minLength={2}
                maxLength={200}
              />
            </div>

            <div className="form-row">
              <div className="field">
                <label>Autor *</label>
                <input
                  value={form.author}
                  onChange={(e) => setForm({ ...form, author: e.target.value })}
                  required
                  minLength={2}
                />
              </div>
              <div className="field">
                <label>Editorial</label>
                <input
                  value={form.publisher}
                  onChange={(e) => setForm({ ...form, publisher: e.target.value })}
                />
              </div>
            </div>

            <div className="field">
              <label>Categoría</label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Descripción</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                maxLength={2000}
              />
            </div>
          </form>
        </Modal>
      )}

      {copiesBook && (
        <Modal
          title={`Ejemplares de “${copiesBook.title}”`}
          onClose={() => setCopiesBook(null)}
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Estado</th>
                  <th>Condición</th>
                  {isStaff && <th style={{ textAlign: 'right' }}>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {copies.map((copy) => (
                  <tr key={copy.id}>
                    <td>{copy.inventory_code}</td>
                    <td>
                      <StatusBadge kind="copy" value={copy.status} />
                    </td>
                    <td className="muted">{copy.condition}</td>
                    {isStaff && (
                      <td className="actions">
                        {copy.status === 'available' && (
                          <button
                            className="btn secondary small"
                            onClick={() => changeCopyStatus(copy, 'maintenance')}
                          >
                            A mantenimiento
                          </button>
                        )}
                        {copy.status === 'maintenance' && (
                          <button
                            className="btn small"
                            onClick={() => changeCopyStatus(copy, 'available')}
                          >
                            Rehabilitar
                          </button>
                        )}
                        {copy.status === 'loaned' && (
                          <span className="muted">En préstamo</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {copies.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty">
                      Este título aún no tiene ejemplares registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {isStaff && (
            <form onSubmit={addCopy} className="toolbar mt-2">
              <input
                placeholder="Código de inventario (EJ-001-5)"
                value={copyCode}
                onChange={(e) => setCopyCode(e.target.value)}
                required
                minLength={3}
                maxLength={40}
              />
              <select
                value={copyCondition}
                onChange={(e) => setCopyCondition(e.target.value)}
                aria-label="Condición"
              >
                <option value="good">Nuevo</option>
                <option value="regular">Regular</option>
                <option value="damaged">Dañado</option>
              </select>
              <button className="btn" type="submit">
                Agregar ejemplar
              </button>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage } from '../api/client';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import type { Book, Copy, Loan, User } from '../types';

export function LoansPage() {
  const { hasRole } = useAuth();
  const isStaff = hasRole('admin', 'librarian');

  const [loans, setLoans] = useState<Loan[]>([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [members, setMembers] = useState<User[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [bookId, setBookId] = useState('');
  const [availableCopies, setAvailableCopies] = useState<Copy[]>([]);
  const [copyId, setCopyId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [dueDate, setDueDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = isStaff ? '/api/loans' : '/api/loans/my';
      const data = await api<Loan[]>(endpoint, {
        query: isStaff
          ? { status: status || undefined, search: search.trim() || undefined }
          : undefined,
      });
      setLoans(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [isStaff, status, search]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openForm() {
    setError(null);
    try {
      const [users, available] = await Promise.all([
        api<User[]>('/api/users', { query: { role: 'member', status: 'active' } }),
        api<Book[]>('/api/books', { query: { available: 'true', pageSize: 100 } }),
      ]);
      setMembers(users);
      setBooks(available.filter((b) => b.available_copies > 0));
      setBookId('');
      setAvailableCopies([]);
      setCopyId('');
      setMemberId('');
      setDueDate('');
      setShowForm(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function selectBook(selectedBookId: string) {
    setBookId(selectedBookId);
    setCopyId('');
    if (!selectedBookId) {
      setAvailableCopies([]);
      return;
    }
    try {
      const all = await api<Copy[]>(`/api/books/${selectedBookId}/copies`);
      setAvailableCopies(all.filter((c) => c.status === 'available'));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function submitLoan(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const loan = await api<Loan>('/api/loans', {
        method: 'POST',
        body: {
          copyId: Number(copyId),
          memberId: Number(memberId),
          dueDate: dueDate || undefined,
        },
      });
      setNotice(
        `Préstamo #${loan.id} registrado. Ejemplar ${loan.inventory_code} vence el ${loan.due_date}.`,
      );
      setShowForm(false);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function returnLoan(loan: Loan) {
    if (!confirm(`¿Registrar la devolución de "${loan.book_title}"?`)) return;
    setError(null);
    setNotice(null);
    try {
      const result = await api<{ loan: Loan; fineAmount: number }>(
        `/api/loans/${loan.id}/return`,
        { method: 'POST' },
      );
      setNotice(
        result.fineAmount > 0
          ? `Devolución registrada con atraso. Se generó una multa de $${result.fineAmount.toFixed(2)}.`
          : 'Devolución registrada a tiempo. Sin multa generada.',
      );
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}

      <div className="toolbar">
        {isStaff && (
          <>
            <input
              placeholder="Buscar por libro, socio o ejemplar…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar préstamos"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filtrar por estado"
            >
              <option value="">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="overdue">Vencidos</option>
              <option value="returned">Devueltos</option>
            </select>
            <button className="btn" onClick={openForm}>
              + Registrar préstamo
            </button>
          </>
        )}
      </div>

      <div className="card">
        {loading ? (
          <div className="empty">Cargando préstamos…</div>
        ) : loans.length === 0 ? (
          <div className="empty">No hay préstamos que coincidan con la búsqueda.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Libro</th>
                  <th>Ejemplar</th>
                  {isStaff && <th>Socio</th>}
                  <th>Préstamo</th>
                  <th>Vence</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => (
                  <tr key={loan.id}>
                    <td className="muted">{loan.id}</td>
                    <td>
                      <strong>{loan.book_title}</strong>
                      <div className="muted">{loan.book_author}</div>
                    </td>
                    <td>{loan.inventory_code}</td>
                    {isStaff && <td>{loan.member_name}</td>}
                    <td>{loan.loan_date.slice(0, 10)}</td>
                    <td>
                      {loan.due_date}
                      {loan.days_late > 0 && (
                        <div className="muted" style={{ color: 'var(--danger)' }}>
                          {loan.days_late} día(s) de atraso
                        </div>
                      )}
                    </td>
                    <td>
                      <StatusBadge kind="loan" value={loan.status} />
                    </td>
                    <td className="actions">
                      {isStaff && loan.status !== 'returned' && (
                        <button className="btn small" onClick={() => returnLoan(loan)}>
                          Registrar devolución
                        </button>
                      )}
                      {loan.status === 'returned' && loan.return_date && (
                        <span className="muted">Devuelto {loan.return_date.slice(0, 10)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <Modal
          title="Registrar préstamo"
          onClose={() => setShowForm(false)}
          footer={
            <>
              <button className="btn secondary" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
              <button className="btn" type="submit" form="loan-form">
                Registrar préstamo
              </button>
            </>
          }
        >
          <form id="loan-form" onSubmit={submitLoan}>
            <div className="field">
              <label>Socio *</label>
              <select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                required
              >
                <option value="">Seleccione un socio activo…</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.username})
                  </option>
                ))}
              </select>
              <span className="hint">
                El sistema bloqueará el préstamo si el socio tiene multas pendientes o alcanzó
                el límite de 5 préstamos activos.
              </span>
            </div>

            <div className="field">
              <label>Libro *</label>
              <select
                value={bookId}
                onChange={(e) => void selectBook(e.target.value)}
                required
              >
                <option value="">Seleccione un libro…</option>
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} · {b.available_copies} disponible(s)
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Ejemplar (código de inventario) *</label>
              <select
                value={copyId}
                onChange={(e) => setCopyId(e.target.value)}
                required
                disabled={!bookId}
              >
                <option value="">
                  {bookId ? 'Seleccione un ejemplar…' : 'Primero elige un libro'}
                </option>
                {availableCopies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.inventory_code} · {c.condition}
                  </option>
                ))}
              </select>
              <span className="hint">
                El sistema rechazará la operación si el ejemplar ya está prestado o si el socio
                tiene multas pendientes o alcanzó el límite de 5 préstamos activos.
              </span>
            </div>

            <div className="field">
              <label>Fecha de devolución (opcional)</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
              <span className="hint">Por defecto: 14 días a partir de hoy.</span>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

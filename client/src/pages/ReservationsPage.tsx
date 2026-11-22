import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import type { Reservation } from '../types';

export function ReservationsPage() {
  const { hasRole } = useAuth();
  const isStaff = hasRole('admin', 'librarian');

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = isStaff ? '/api/reservations' : '/api/reservations/my';
      const data = await api<Reservation[]>(endpoint, {
        query: isStaff && status ? { status } : undefined,
      });
      setReservations(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [isStaff, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function cancel(reservation: Reservation) {
    if (!confirm(`¿Cancelar la reserva de "${reservation.book_title}"?`)) return;
    setError(null);
    setNotice(null);
    try {
      await api(`/api/reservations/${reservation.id}/cancel`, { method: 'POST' });
      setNotice('Reserva cancelada.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function fulfill(reservation: Reservation) {
    setError(null);
    setNotice(null);
    try {
      await api(`/api/reservations/${reservation.id}/fulfill`, { method: 'POST' });
      setNotice(`Reserva de "${reservation.book_title}" marcada como entregada.`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}

      <div className="alert info">
        {isStaff
          ? 'Las reservas se crean automáticamente desde el catálogo cuando un título está totalmente prestado. Al devolver un ejemplar, la reserva más antigua pasa a “Lista para entrega”.'
          : 'Puedes reservar un título solo cuando todos sus ejemplares están prestados. Te avisaremos cuando esté disponible (vigencia de 7 días).'}
      </div>

      <div className="toolbar">
        {isStaff && (
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filtrar por estado"
          >
            <option value="">Todos los estados</option>
            <option value="pending">Pendientes</option>
            <option value="ready">Listas para entrega</option>
            <option value="fulfilled">Atendidas</option>
            <option value="cancelled">Canceladas</option>
          </select>
        )}
      </div>

      <div className="card">
        {loading ? (
          <div className="empty">Cargando reservas…</div>
        ) : reservations.length === 0 ? (
          <div className="empty">No hay reservas registradas.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Libro</th>
                  <th>ISBN</th>
                  {isStaff && <th>Socio</th>}
                  <th>Solicitada</th>
                  <th>Vence</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => (
                  <tr key={r.id}>
                    <td className="muted">{r.id}</td>
                    <td>
                      <strong>{r.book_title}</strong>
                      <div className="muted">{r.book_author}</div>
                    </td>
                    <td className="muted">{r.isbn}</td>
                    {isStaff && <td>{r.member_name}</td>}
                    <td>{r.created_at.slice(0, 10)}</td>
                    <td>{r.expires_at.slice(0, 10)}</td>
                    <td>
                      <StatusBadge kind="reservation" value={r.status} />
                    </td>
                    <td className="actions">
                      {r.status === 'pending' && (
                        <button className="btn secondary small" onClick={() => cancel(r)}>
                          Cancelar
                        </button>
                      )}
                      {isStaff && r.status === 'ready' && (
                        <button className="btn small" onClick={() => fulfill(r)}>
                          Marcar entregada
                        </button>
                      )}
                      {(r.status === 'fulfilled' || r.status === 'cancelled') && (
                        <span className="muted">Sin acciones</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import type { Fine } from '../types';

export function FinesPage() {
  const { hasRole } = useAuth();
  const isStaff = hasRole('admin', 'librarian');

  const [fines, setFines] = useState<Fine[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingTotal, setPendingTotal] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isStaff) {
        const data = await api<Fine[]>('/api/fines', {
          query: status ? { status } : undefined,
        });
        setFines(data);
        setPendingTotal(null);
      } else {
        const data = await api<Fine[]>('/api/fines/my');
        setFines(data);
        const pending = data.filter((f) => f.status === 'pending');
        setPendingTotal(pending.reduce((sum, f) => sum + f.amount, 0));
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [isStaff, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function pay(fine: Fine) {
    if (!confirm(`¿Confirmar el pago de $${fine.amount.toFixed(2)}?`)) return;
    setError(null);
    setNotice(null);
    try {
      await api(`/api/fines/${fine.id}/pay`, { method: 'POST' });
      setNotice('Multa liquidada correctamente.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const pending = fines.filter((f) => f.status === 'pending');

  return (
    <>
      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}

      <div className="grid grid-3" style={{ marginBottom: '1rem' }}>
        <div className="card stat">
          <span className="value">{fines.length}</span>
          <span className="label">Multas en pantalla</span>
        </div>
        <div className="card stat is-danger">
          <span className="value">{pending.length}</span>
          <span className="label">Pendientes de pago</span>
        </div>
        <div className="card stat is-success">
          <span className="value">
            $
            {(pendingTotal ??
              pending.reduce((sum, f) => sum + f.amount, 0)).toFixed(2)}
          </span>
          <span className="label">Total por recaudar</span>
        </div>
      </div>

      <div className="alert info">
        La multa se genera automáticamente al devolver un ejemplar con atraso: $0.50 por día
        transcurrido. Un socio con multas pendientes no puede retirar material nuevo.
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
            <option value="paid">Pagadas</option>
          </select>
        )}
      </div>

      <div className="card">
        {loading ? (
          <div className="empty">Cargando multas…</div>
        ) : fines.length === 0 ? (
          <div className="empty">No hay multas registradas. ¡Buen trabajo!</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  {isStaff && <th>Socio</th>}
                  <th>Libro</th>
                  <th>Ejemplar</th>
                  <th>Motivo</th>
                  <th>Importe</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {fines.map((fine) => (
                  <tr key={fine.id}>
                    <td className="muted">{fine.id}</td>
                    {isStaff && <td>{fine.member_name}</td>}
                    <td>{fine.book_title}</td>
                    <td className="muted">{fine.inventory_code}</td>
                    <td className="muted">{fine.reason}</td>
                    <td>
                      <strong>${fine.amount.toFixed(2)}</strong>
                    </td>
                    <td>
                      <StatusBadge kind="fine" value={fine.status} />
                    </td>
                    <td className="actions">
                      {fine.status === 'pending' ? (
                        <button className="btn small" onClick={() => pay(fine)}>
                          Registrar pago
                        </button>
                      ) : (
                        <span className="muted">
                          Pagada {fine.paid_at?.slice(0, 10) ?? ''}
                        </span>
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

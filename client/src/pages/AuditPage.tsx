import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../api/client';
import type { AuditEntry } from '../types';

export function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [stored, setStored] = useState(0);
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<AuditEntry[]>('/api/audit', {
        query: { action: action.trim() || undefined, limit: 200 },
      });
      setEntries(data);
      setStored(data.length);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [action]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      {error && <div className="alert error">{error}</div>}

      <div className="alert info">
        Todas las operaciones sensibles (accesos, préstamos, multas, cambios de usuario) quedan
        registradas con usuario, IP y fecha. Este registro es de solo lectura.
      </div>

      <div className="toolbar">
        <input
          placeholder="Filtrar por acción (ej. LOGIN_FAILED, LOAN_CREATED)…"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          aria-label="Filtrar por acción"
        />
        <span className="muted">{stored} evento(s) en pantalla</span>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty">Cargando auditoría…</div>
        ) : entries.length === 0 ? (
          <div className="empty">No hay eventos que coincidan con el filtro.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Entidad</th>
                  <th>Detalle</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="muted">{entry.id}</td>
                    <td className="muted">{entry.created_at}</td>
                    <td>{entry.username ?? <span className="muted">sistema</span>}</td>
                    <td>
                      <span
                        className={`badge ${
                          entry.action.includes('FAILED') || entry.action.includes('BLOCKED')
                            ? 'danger'
                            : entry.action.includes('LOGIN_SUCCESS')
                              ? 'success'
                              : 'info'
                        }`}
                      >
                        {entry.action}
                      </span>
                    </td>
                    <td className="muted">
                      {entry.entity}
                      {entry.entity_id ? ` #${entry.entity_id}` : ''}
                    </td>
                    <td className="muted">{entry.details ?? '—'}</td>
                    <td className="muted">{entry.ip ?? '—'}</td>
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

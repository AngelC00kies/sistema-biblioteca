import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api/client';
import type { OverdueLoan, Summary, TopBook } from '../types';

export function ReportsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [topBooks, setTopBooks] = useState<TopBook[]>([]);
  const [overdue, setOverdue] = useState<OverdueLoan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [s, t, o] = await Promise.all([
          api<Summary>('/api/reports/summary'),
          api<TopBook[]>('/api/reports/top-books', { query: { limit: 10 } }),
          api<OverdueLoan[]>('/api/reports/overdue'),
        ]);
        if (!cancelled) {
          setSummary(s);
          setTopBooks(t);
          setOverdue(o);
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <div className="alert error">{error}</div>;
  if (loading || !summary) return <div className="empty">Generando reportes…</div>;

  const maxMonth = Math.max(1, ...summary.loansByMonth.map((m) => m.total));
  const maxTop = Math.max(1, ...topBooks.map((b) => b.loan_count));

  return (
    <>
      <div className="grid grid-4">
        <div className="card stat">
          <span className="value">{summary.books}</span>
          <span className="label">Títulos</span>
        </div>
        <div className="card stat is-success">
          <span className="value">{summary.availableCopies}</span>
          <span className="label">Ejemplares disponibles</span>
        </div>
        <div className="card stat">
          <span className="value">{summary.activeLoans}</span>
          <span className="label">Préstamos activos</span>
        </div>
        <div className="card stat is-danger">
          <span className="value">{summary.overdueLoans}</span>
          <span className="label">Vencidos</span>
        </div>
      </div>

      <div className="grid grid-2 mt-2">
        <div className="card">
          <h3>Préstamos por mes</h3>
          {summary.loansByMonth.length === 0 ? (
            <div className="empty">Sin datos suficientes.</div>
          ) : (
            <div className="bar-chart">
              {summary.loansByMonth
                .slice()
                .reverse()
                .map((m) => (
                  <div
                    key={m.month}
                    className="bar"
                    style={{ height: `${Math.max(6, (m.total / maxMonth) * 100)}%` }}
                  >
                    <span>{m.total}</span>
                    <i>{m.month.slice(5)}</i>
                  </div>
                ))}
            </div>
          )}
          <p className="muted mt-2">
            Recaudo pendiente: <strong>${summary.pendingFinesAmount.toFixed(2)}</strong> en{' '}
            {summary.pendingFinesCount} multa(s).
          </p>
        </div>

        <div className="card">
          <h3>Libros más prestados</h3>
          {topBooks.length === 0 ? (
            <div className="empty">Aún no hay préstamos registrados.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Título</th>
                    <th>Préstamos</th>
                  </tr>
                </thead>
                <tbody>
                  {topBooks.map((book, index) => (
                    <tr key={book.book_id}>
                      <td className="muted">{index + 1}</td>
                      <td>
                        <strong>{book.title}</strong>
                        <div className="muted">{book.author}</div>
                      </td>
                      <td>
                        <div
                          style={{
                            background: 'var(--primary-soft)',
                            borderRadius: 6,
                            padding: '2px 8px',
                            display: 'inline-block',
                            minWidth: 46,
                            fontWeight: 600,
                            color: 'var(--primary-dark)',
                          }}
                        >
                          {book.loan_count}
                        </div>
                        <div
                          className="muted"
                          style={{
                            width: `${(book.loan_count / maxTop) * 100}%`,
                            height: 4,
                            background: 'var(--primary)',
                            borderRadius: 4,
                            marginTop: 4,
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card mt-2">
        <h3>Préstamos vencidos (requieren gestión)</h3>
        {overdue.length === 0 ? (
          <div className="empty">No hay préstamos vencidos. Excelente control.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Libro</th>
                  <th>Ejemplar</th>
                  <th>Socio</th>
                  <th>Vencimiento</th>
                  <th>Días de atraso</th>
                  <th>Multa estimada</th>
                </tr>
              </thead>
              <tbody>
                {overdue.map((loan) => (
                  <tr key={loan.id}>
                    <td>{loan.book_title}</td>
                    <td className="muted">{loan.inventory_code}</td>
                    <td>{loan.member_name}</td>
                    <td>{loan.due_date}</td>
                    <td>
                      <span className="badge danger">{loan.days_late} día(s)</span>
                    </td>
                    <td>
                      <strong>${(loan.days_late * 0.5).toFixed(2)}</strong>
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

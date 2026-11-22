import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Fine, Loan, Reservation, Summary } from '../types';

type MemberDashboard = {
  loans: Loan[];
  reservations: Reservation[];
  fines: Fine[];
};

export function DashboardPage() {
  const { user, hasRole } = useAuth();
  const isStaff = hasRole('admin', 'librarian');

  const [summary, setSummary] = useState<Summary | null>(null);
  const [member, setMember] = useState<MemberDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (isStaff) {
          const data = await api<Summary>('/api/reports/summary');
          if (!cancelled) setSummary(data);
        } else {
          const [loans, reservations, fines] = await Promise.all([
            api<Loan[]>('/api/loans/my'),
            api<Reservation[]>('/api/reservations/my'),
            api<Fine[]>('/api/fines/my'),
          ]);
          if (!cancelled) setMember({ loans, reservations, fines });
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [isStaff]);

  if (error) return <div className="alert error">{error}</div>;

  if (isStaff && summary) {
    const maxMonth = Math.max(1, ...summary.loansByMonth.map((m) => m.total));
    return (
      <>
        <div className="grid grid-4">
          <div className="card stat">
            <span className="value">{summary.books}</span>
            <span className="label">Títulos en catálogo</span>
          </div>
          <div className="card stat is-success">
            <span className="value">{summary.availableCopies}</span>
            <span className="label">
              Ejemplares disponibles de {summary.copies}
            </span>
          </div>
          <div className="card stat">
            <span className="value">{summary.activeLoans}</span>
            <span className="label">Préstamos activos</span>
          </div>
          <div className="card stat is-danger">
            <span className="value">{summary.overdueLoans}</span>
            <span className="label">Préstamos vencidos</span>
          </div>
        </div>

        <div className="grid grid-3 mt-2">
          <div className="card">
            <h3>Socios activos</h3>
            <div className="stat">
              <span className="value">{summary.members}</span>
              <span className="label">cuentas habilitadas</span>
            </div>
          </div>
          <div className="card">
            <h3>Reservas vigentes</h3>
            <div className="stat">
              <span className="value">{summary.activeReservations}</span>
              <span className="label">pendientes de entrega</span>
            </div>
          </div>
          <div className="card">
            <h3>Multas pendientes</h3>
            <div className="stat is-danger">
              <span className="value">${summary.pendingFinesAmount.toFixed(2)}</span>
              <span className="label">{summary.pendingFinesCount} documento(s) por cobrar</span>
            </div>
          </div>
        </div>

        <div className="card mt-2">
          <h3>Préstamos registrados por mes</h3>
          {summary.loansByMonth.length === 0 ? (
            <div className="empty">Aún no hay préstamos registrados.</div>
          ) : (
            <div className="bar-chart">
              {summary.loansByMonth
                .slice()
                .reverse()
                .map((month) => (
                  <div
                    key={month.month}
                    className="bar"
                    style={{ height: `${Math.max(6, (month.total / maxMonth) * 100)}%` }}
                  >
                    <span>{month.total}</span>
                    <i>{month.month.slice(5)}</i>
                  </div>
                ))}
            </div>
          )}
          <div className="mt-2">
            <Link className="btn ghost small" to="/reportes">
              Ver reportes completos
            </Link>
          </div>
        </div>
      </>
    );
  }

  if (!member) return <div className="empty">Cargando tu información…</div>;

  const active = member.loans.filter((l) => l.status !== 'returned');
  const pendingFines = member.fines.filter((f) => f.status === 'pending');

  return (
    <>
      <div className="grid grid-4">
        <div className="card stat">
          <span className="value">{active.length}</span>
          <span className="label">Préstamos activos</span>
        </div>
        <div className="card stat">
          <span className="value">{member.loans.length}</span>
          <span className="label">Histórico de préstamos</span>
        </div>
        <div className="card stat">
          <span className="value">
            {member.reservations.filter((r) => r.status === 'pending' || r.status === 'ready').length}
          </span>
          <span className="label">Reservas vigentes</span>
        </div>
        <div className="card stat is-danger">
          <span className="value">${pendingFines.reduce((sum, f) => sum + f.amount, 0).toFixed(2)}</span>
          <span className="label">Multas por pagar</span>
        </div>
      </div>

      <div className="card mt-2">
        <h3>Tus últimos préstamos</h3>
        {active.length === 0 ? (
          <div className="empty">
            No tienes préstamos activos. Visita el <Link to="/libros">catálogo</Link> para
            explorar los títulos disponibles.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Libro</th>
                  <th>Ejemplar</th>
                  <th>Préstamo</th>
                  <th>Vence</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {active.slice(0, 5).map((loan) => (
                  <tr key={loan.id}>
                    <td>{loan.book_title}</td>
                    <td>{loan.inventory_code}</td>
                    <td>{loan.loan_date.slice(0, 10)}</td>
                    <td>{loan.due_date}</td>
                    <td>
                      <span className={`badge ${loan.status === 'overdue' ? 'danger' : 'info'}`}>
                        {loan.status === 'overdue' ? 'Vencido' : 'Activo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-2">
          <Link className="btn ghost small" to="/mis-prestamos">
            Ver todos mis préstamos
          </Link>
        </div>
      </div>
    </>
  );
}

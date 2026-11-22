import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuditPage } from './pages/AuditPage';
import { BooksPage } from './pages/BooksPage';
import { DashboardPage } from './pages/DashboardPage';
import { FinesPage } from './pages/FinesPage';
import { LoansPage } from './pages/LoansPage';
import { LoginPage } from './pages/LoginPage';
import { ReportsPage } from './pages/ReportsPage';
import { ReservationsPage } from './pages/ReservationsPage';
import { UsersPage } from './pages/UsersPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/libros" element={<BooksPage />} />
        <Route
          path="/prestamos"
          element={
            <ProtectedRoute roles={['admin', 'librarian']}>
              <LoansPage />
            </ProtectedRoute>
          }
        />
        <Route path="/mis-prestamos" element={<LoansPage />} />
        <Route path="/reservas" element={<ReservationsPage />} />
        <Route
          path="/multas"
          element={
            <ProtectedRoute roles={['admin', 'librarian']}>
              <FinesPage />
            </ProtectedRoute>
          }
        />
        <Route path="/mis-multas" element={<FinesPage />} />
        <Route
          path="/usuarios"
          element={
            <ProtectedRoute roles={['admin']}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reportes"
          element={
            <ProtectedRoute roles={['admin', 'librarian']}>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/auditoria"
          element={
            <ProtectedRoute roles={['admin']}>
              <AuditPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

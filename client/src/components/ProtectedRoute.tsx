import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../types';

type Props = {
  children: ReactNode;
  roles?: Role[];
};

/** Guarda de ruta: exige sesión y, opcionalmente, un rol específico. */
export function ProtectedRoute({ children, roles }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="empty" style={{ padding: '4rem' }}>
        Verificando sesión…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="main">
        <div className="alert error">
          No tienes permisos para acceder a esta sección (rol requerido:{' '}
          {roles.join(' o ')}).
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  librarian: 'Bibliotecario',
  member: 'Socio',
};

export function Layout() {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  const isStaff = hasRole('admin', 'librarian');
  const isAdmin = hasRole('admin');

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <span className="brand">
          Biblioteca R. Gómez
          <small>Sistema de gestión integrado</small>
        </span>

        <span className="nav-section">General</span>
        <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          <span>▦</span> Panel principal
        </NavLink>
        <NavLink
          to="/libros"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          <span>▤</span> Catálogo de libros
        </NavLink>

        <span className="nav-section">Operación</span>
        {isStaff && (
          <NavLink
            to="/prestamos"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span>⇄</span> Préstamos y devoluciones
          </NavLink>
        )}
        <NavLink
          to="/mis-prestamos"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          <span>📖</span> {isStaff ? 'Préstamos propios' : 'Mis préstamos'}
        </NavLink>
        <NavLink
          to="/reservas"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          <span>⏱</span> Reservas
        </NavLink>
        {isStaff ? (
          <NavLink
            to="/multas"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span>⚠</span> Multas
          </NavLink>
        ) : (
          <NavLink
            to="/mis-multas"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span>⚠</span> Mis multas
          </NavLink>
        )}

        {isAdmin && (
          <>
            <span className="nav-section">Administración</span>
            <NavLink
              to="/usuarios"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <span>👤</span> Usuarios
            </NavLink>
            <NavLink
              to="/reportes"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <span>📊</span> Reportes
            </NavLink>
            <NavLink
              to="/auditoria"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <span>🛡</span> Auditoría
            </NavLink>
          </>
        )}
        {!isAdmin && isStaff && (
          <NavLink
            to="/reportes"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span>📊</span> Reportes
          </NavLink>
        )}
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <h1>Biblioteca Pública Municipal “Ricardo Gómez”</h1>
            <span className="muted">Sistema de Gestión de Biblioteca · v1.0.0</span>
          </div>
          <div className="who">
            <strong>{user?.full_name}</strong>
            {ROLE_LABEL[user?.role ?? 'member']} · {user?.username}
            <div className="mt-1">
              <button className="btn secondary small" onClick={handleLogout}>
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>

        <Outlet />
      </main>
    </div>
  );
}

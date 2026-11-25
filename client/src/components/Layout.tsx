import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  BookMarked,
  Clock,
  LayoutDashboard,
  Library,
  LogOut,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BrandMark } from './BrandMark';

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
        <div className="brand">
          <BrandMark />
          <span className="brand-text">
            Biblioteca R. Gómez
            <small>Sistema de gestión integrado</small>
          </span>
        </div>

        <span className="nav-section">General</span>
        <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          <LayoutDashboard size={18} strokeWidth={2} aria-hidden />
          Panel principal
        </NavLink>
        <NavLink
          to="/libros"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          <Library size={18} strokeWidth={2} aria-hidden />
          Catálogo de libros
        </NavLink>

        <span className="nav-section">Operación</span>
        {isStaff && (
          <NavLink
            to="/prestamos"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <ArrowLeftRight size={18} strokeWidth={2} aria-hidden />
            Préstamos y devoluciones
          </NavLink>
        )}
        <NavLink
          to="/mis-prestamos"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          <BookOpen size={18} strokeWidth={2} aria-hidden />
          {isStaff ? 'Préstamos propios' : 'Mis préstamos'}
        </NavLink>
        <NavLink
          to="/reservas"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          <Clock size={18} strokeWidth={2} aria-hidden />
          Reservas
        </NavLink>
        {isStaff ? (
          <NavLink
            to="/multas"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <AlertTriangle size={18} strokeWidth={2} aria-hidden />
            Multas
          </NavLink>
        ) : (
          <NavLink
            to="/mis-multas"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <AlertTriangle size={18} strokeWidth={2} aria-hidden />
            Mis multas
          </NavLink>
        )}

        {isAdmin && (
          <>
            <span className="nav-section">Administración</span>
            <NavLink
              to="/usuarios"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <Users size={18} strokeWidth={2} aria-hidden />
              Usuarios
            </NavLink>
            <NavLink
              to="/reportes"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <BarChart3 size={18} strokeWidth={2} aria-hidden />
              Reportes
            </NavLink>
            <NavLink
              to="/auditoria"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <ShieldCheck size={18} strokeWidth={2} aria-hidden />
              Auditoría
            </NavLink>
          </>
        )}
        {!isAdmin && isStaff && (
          <NavLink
            to="/reportes"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <BarChart3 size={18} strokeWidth={2} aria-hidden />
            Reportes
          </NavLink>
        )}

        <div className="sidebar-footer">
          <BookMarked size={14} strokeWidth={2} aria-hidden />
          v1.0.0 · SQLite
        </div>
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
                <LogOut size={14} strokeWidth={2} aria-hidden />
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

import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { BrandMark } from '../components/BrandMark';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={location.state?.from ?? '/'} replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemo(u: string, p: string) {
    setUsername(u);
    setPassword(p);
  }

  return (
    <div className="login-page">
      <aside className="login-aside">
        <div className="login-brand">
          <BrandMark size={56} />
        </div>
        <h1>Sistema de Gestión de Biblioteca</h1>
        <p>
          Biblioteca Pública Municipal “Ricardo Gómez”. Control de catálogo, préstamos,
          devoluciones, reservas, multas y reportes en un solo lugar.
        </p>
        <ul>
          <li>Préstamos y devoluciones con cálculo automático de multas</li>
          <li>Reservas con notificación de disponibilidad</li>
          <li>Roles y permisos (administrador, bibliotecario, socio)</li>
          <li>Registro de auditoría de todas las operaciones</li>
        </ul>
      </aside>

      <div className="login-main">
        <form className="login-card" onSubmit={handleSubmit}>
          <h2>Iniciar sesión</h2>
          <p className="muted">Ingresa con tu cuenta de la biblioteca.</p>

          {error && <div className="alert error">{error}</div>}

          <div className="field">
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              minLength={3}
              placeholder="ej. admin"
            />
          </div>

          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              minLength={6}
              placeholder="••••••••"
            />
          </div>

          <button className="btn" type="submit" disabled={submitting} style={{ width: '100%' }}>
            {submitting ? 'Validando…' : 'Entrar al sistema'}
          </button>

          <div className="demo">
            <strong>Cuentas de demostración</strong>
            <div className="mt-1">
              Admin: <code onClick={() => fillDemo('admin', 'Admin1234')}>admin / Admin1234</code>
            </div>
            <div>
              Bibliotecario:{' '}
              <code onClick={() => fillDemo('bibliotecario', 'Biblio1234')}>
                bibliotecario / Biblio1234
              </code>
            </div>
            <div>
              Socio: <code onClick={() => fillDemo('maria.garcia', 'Socio1234')}>maria.garcia / Socio1234</code>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

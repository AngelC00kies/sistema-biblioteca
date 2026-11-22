import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage } from '../api/client';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import type { Role, User } from '../types';

type FormState = {
  username: string;
  email: string;
  fullName: string;
  password: string;
  role: Role;
  status: 'active' | 'inactive';
};

const EMPTY: FormState = {
  username: '',
  email: '',
  fullName: '',
  password: '',
  role: 'member',
  status: 'active',
};

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<User[]>('/api/users', {
        query: {
          role: role || undefined,
          search: search.trim() || undefined,
        },
      });
      setUsers(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [role, search]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setForm(EMPTY);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(user: User) {
    setForm({
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      password: '',
      role: user.role,
      status: user.status,
    });
    setEditingId(user.id);
    setShowForm(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (editingId) {
        const body: Record<string, unknown> = {
          email: form.email.trim(),
          fullName: form.fullName.trim(),
          role: form.role,
          status: form.status,
        };
        if (form.password) body.password = form.password;
        await api(`/api/users/${editingId}`, { method: 'PUT', body });
        setNotice('Usuario actualizado correctamente.');
      } else {
        await api('/api/users', {
          method: 'POST',
          body: {
            username: form.username.trim(),
            email: form.email.trim(),
            password: form.password,
            fullName: form.fullName.trim(),
            role: form.role,
          },
        });
        setNotice('Usuario creado correctamente.');
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(user: User) {
    if (!confirm(`¿Eliminar o desactivar la cuenta de ${user.full_name}?`)) return;
    setError(null);
    setNotice(null);
    try {
      const result = await api<{ mode: 'deleted' | 'deactivated' }>(
        `/api/users/${user.id}`,
        { method: 'DELETE' },
      );
      setNotice(
        result.mode === 'deactivated'
          ? 'El usuario tenía historial: se dio de baja sin borrar sus registros.'
          : 'Usuario eliminado definitivamente.',
      );
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}

      <div className="toolbar">
        <input
          placeholder="Buscar por nombre, usuario o correo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar usuarios"
        />
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filtrar por rol">
          <option value="">Todos los roles</option>
          <option value="admin">Administradores</option>
          <option value="librarian">Bibliotecarios</option>
          <option value="member">Socios</option>
        </select>
        <button className="btn" onClick={openCreate}>
          + Nuevo usuario
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty">Cargando usuarios…</div>
        ) : users.length === 0 ? (
          <div className="empty">No se encontraron usuarios.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Usuario</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Alta</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.full_name}</strong>
                    </td>
                    <td className="muted">{user.username}</td>
                    <td className="muted">{user.email}</td>
                    <td>
                      <StatusBadge kind="role" value={user.role} />
                    </td>
                    <td>
                      <StatusBadge kind="user" value={user.status} />
                    </td>
                    <td className="muted">{user.created_at.slice(0, 10)}</td>
                    <td className="actions">
                      <button className="btn secondary small" onClick={() => openEdit(user)}>
                        Editar
                      </button>
                      <button className="btn danger small" onClick={() => remove(user)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <Modal
          title={editingId ? 'Editar usuario' : 'Registrar usuario'}
          onClose={() => setShowForm(false)}
          footer={
            <>
              <button className="btn secondary" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
              <button className="btn" type="submit" form="user-form">
                {editingId ? 'Guardar cambios' : 'Crear usuario'}
              </button>
            </>
          }
        >
          <form id="user-form" onSubmit={submit}>
            <div className="form-row">
              <div className="field">
                <label>Nombre completo *</label>
                <input
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  required
                  minLength={3}
                  maxLength={120}
                />
              </div>
              <div className="field">
                <label>Usuario *</label>
                <input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                  minLength={3}
                  maxLength={50}
                  disabled={Boolean(editingId)}
                  pattern="[a-zA-Z0-9._-]+"
                />
              </div>
            </div>

            <div className="field">
              <label>Correo electrónico *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                maxLength={120}
              />
            </div>

            <div className="field">
              <label>{editingId ? 'Nueva contraseña (opcional)' : 'Contraseña *'}</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required={!editingId}
                minLength={8}
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres, 1 mayúscula y 1 número"
              />
            </div>

            <div className="form-row">
              <div className="field">
                <label>Rol</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                >
                  <option value="member">Socio</option>
                  <option value="librarian">Bibliotecario</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="field">
                <label>Estado</label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as 'active' | 'inactive' })
                  }
                >
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                </select>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

const COPY_STATUS: Record<string, { label: string; cls: string }> = {
  available: { label: 'Disponible', cls: 'success' },
  loaned: { label: 'Prestado', cls: 'warning' },
  lost: { label: 'Perdido', cls: 'danger' },
  maintenance: { label: 'Mantenimiento', cls: 'muted' },
};

const LOAN_STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: 'Activo', cls: 'info' },
  returned: { label: 'Devuelto', cls: 'success' },
  overdue: { label: 'Vencido', cls: 'danger' },
};

const RESERVATION_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendiente', cls: 'warning' },
  ready: { label: 'Lista para entrega', cls: 'info' },
  fulfilled: { label: 'Atendida', cls: 'success' },
  cancelled: { label: 'Cancelada', cls: 'muted' },
};

const FINE_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendiente', cls: 'danger' },
  paid: { label: 'Pagada', cls: 'success' },
};

const ROLE: Record<string, { label: string; cls: string }> = {
  admin: { label: 'Administrador', cls: 'danger' },
  librarian: { label: 'Bibliotecario', cls: 'info' },
  member: { label: 'Socio', cls: 'muted' },
};

const USER_STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: 'Activo', cls: 'success' },
  inactive: { label: 'Inactivo', cls: 'muted' },
};

function lookup(map: Record<string, { label: string; cls: string }>, key: string) {
  return map[key] ?? { label: key, cls: 'muted' };
}

export function StatusBadge({ kind, value }: { kind: 'copy' | 'loan' | 'reservation' | 'fine' | 'role' | 'user'; value: string }) {
  const maps = {
    copy: COPY_STATUS,
    loan: LOAN_STATUS,
    reservation: RESERVATION_STATUS,
    fine: FINE_STATUS,
    role: ROLE,
    user: USER_STATUS,
  } as const;

  const { label, cls } = lookup(maps[kind], value);
  return <span className={`badge ${cls}`}>{label}</span>;
}

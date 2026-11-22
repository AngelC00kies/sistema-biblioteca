/** Utilidades de fecha en formato ISO (UTC) para todo el dominio. */

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nowISO(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

export function addDays(dateISO: string, days: number): string {
  const base = Date.parse(`${dateISO}T00:00:00Z`);
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}

/** Días completos transcurridos entre `from` y `to` (positivo si `to` es posterior). */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.floor((b - a) / 86_400_000);
}

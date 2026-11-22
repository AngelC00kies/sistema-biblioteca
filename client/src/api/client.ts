import type { ApiError } from '../types';

const TOKEN_KEY = 'biblioteca_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class RequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: { campo: string; mensaje: string }[] | undefined;

  constructor(status: number, error: ApiError) {
    super(error.message);
    this.name = 'RequestError';
    this.status = status;
    this.code = error.code;
    this.details = error.details;
  }
}

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
};

/** Cliente HTTP con token automático y manejo uniforme de errores. */
export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const url = new URL(path, window.location.origin);

  if (options.query) {
    Object.entries(options.query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    });
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url.toString(), {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const payload = (await response.json().catch(() => null)) as
    | (ApiError & { data?: unknown })
    | null;

  if (!response.ok || !payload || payload.ok === false) {
    if (response.status === 401) setToken(null);
    throw new RequestError(
      response.status,
      (payload as ApiError) ?? {
        ok: false,
        code: 'NETWORK_ERROR',
        message: 'No se pudo conectar con el servidor',
      },
    );
  }

  return payload.data as T;
}

/** Traduce los detalles de validación a un mensaje legible. */
export function errorMessage(error: unknown): string {
  if (error instanceof RequestError) {
    if (error.details?.length) {
      return error.details.map((d) => `${d.campo}: ${d.mensaje}`).join(' · ');
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Error inesperado';
}

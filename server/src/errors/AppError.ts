/** Error de aplicación con código HTTP y mensaje apto para el cliente. */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const errors = {
  unauthorized: (message = 'Credenciales inválidas') =>
    new AppError(401, 'UNAUTHORIZED', message),

  tokenInvalid: (message = 'Sesión inválida o expirada') =>
    new AppError(401, 'INVALID_TOKEN', message),

  forbidden: (message = 'No tienes permisos para realizar esta acción') =>
    new AppError(403, 'FORBIDDEN', message),

  notFound: (resource: string) =>
    new AppError(404, 'NOT_FOUND', `${resource} no encontrado`),

  conflict: (message: string) => new AppError(409, 'CONFLICT', message),

  badRequest: (message: string, details?: unknown) =>
    new AppError(400, 'BAD_REQUEST', message, details),

  businessRule: (message: string) =>
    new AppError(422, 'BUSINESS_RULE_VIOLATION', message),
};

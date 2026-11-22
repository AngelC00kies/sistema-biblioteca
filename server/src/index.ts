import { createApp } from './app.js';
import { env } from './config/env.js';
import { getDb } from './db/connection.js';
import { logInfo } from './utils/logger.js';

// Inicializa el esquema antes de aceptar peticiones.
getDb();

const app = createApp();

const server = app.listen(env.port, () => {
  logInfo(`API del Sistema de Gestión de Biblioteca escuchando en http://localhost:${env.port}`);
  logInfo(`Entorno: ${env.nodeEnv}`);
});

function shutdown(signal: string): void {
  logInfo(`${signal} recibido. Cerrando servidor de forma ordenada...`);
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

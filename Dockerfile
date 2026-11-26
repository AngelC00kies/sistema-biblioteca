# ============================================================
# Sistema de Gestión de Biblioteca (SGB)
# Imagen única: API Express + SPA React servida en el mismo origen.
#
#   docker build -t sistema-biblioteca .
#   docker run -p 4000:4000 sistema-biblioteca
# ============================================================

# ---------- Etapa 1: compilación del frontend (Vite) ----------
FROM node:22-slim AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---------- Etapa 2: dependencias del backend ----------
FROM node:22-slim AS server-deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci

# ---------- Etapa 3: imagen final de producción ----------
FROM node:22-slim
ENV NODE_ENV=production \
    PORT=4000 \
    CORS_ORIGIN=*

WORKDIR /app

# Módulos del backend + código fuente (ejecutado con tsx)
COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY server/ ./server/

# Build del SPA servido por Express (ver server/src/app.ts)
COPY --from=client-build /app/client/dist ./client/dist

WORKDIR /app/server
EXPOSE 4000

# Comprobación de salud para orquestadores (Docker, Render, Koyeb…)
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# El seed es idempotente: crea la base de demostración solo si está vacía.
CMD ["sh", "-c", "npm run seed && npm run start"]

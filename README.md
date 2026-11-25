# Sistema de Gestión de Biblioteca (SGB)

Trabajo final de **Ingeniería de Software II** — Biblioteca Pública Municipal *"Ricardo Gómez"*.

Aplicación web para gestionar el catálogo de libros, ejemplares, préstamos, devoluciones,
reservas, multas, usuarios, reportes y auditoría, aplicando arquitectura en capas, control de
acceso por roles, pruebas automatizadas y documentación técnica completa.

---

## 1. Contenido del repositorio

```
biblioteca/
├── docs/                      # Documentación académica (13 documentos)
│   ├── README.md              # Índice de la documentación
│   ├── 01-problema.md         # Identificación del problema
│   ├── 02-requisitos.md       # Requisitos funcionales y no funcionales
│   ├── 03-historias-y-casos-de-uso.md
│   ├── 04-modelado.md         # Diagramas Mermaid + explicación
│   ├── 05-arquitectura.md     # Justificación de la arquitectura
│   ├── 06-base-de-datos.md    # ER, DDL, normalización 3FN
│   ├── 07-interfaces.md       # Prototipos de las pantallas
│   ├── 08-seguridad.md        # Riesgos, RBAC, OWASP
│   ├── 09-evidencias-de-pruebas.md  # Registros, reportes y capturas (sección 8)
│   ├── 10-pruebas.md          # Estrategia, casos y evidencia de ejecución
│   ├── 11-calidad.md          # ISO 25010
│   ├── 12-gestion.md          # Planificación y trazabilidad
│   └── evidencias/            # Material crudo de la verificación
│       ├── capturas/          # 16 PNG con nombre descriptivo (Playwright)
│       ├── registros/         # Salidas UTF-8 de tsc, suite, cobertura, build, humo
│       └── reportes/          # suite.json + reporte HTML de cobertura
│
├── scripts/
│   └── regenerar-evidencias.mjs  # Regenera registros y reportes (UTF-8)
│
├── database/                  # Consultas SQL del sistema
│   ├── schema.sql             # DDL completo (8 tablas + 16 índices), espejo de schema.ts
│   └── queries.sql            # 67 consultas reales por módulo + checks de integridad
│
├── server/                    # API REST · Node.js + Express + TypeScript
│   ├── src/
│   │   ├── app.ts             # Composición de la aplicación (capa de entrada)
│   │   ├── index.ts           # Arranque del servidor
│   │   ├── config/env.ts      # Configuración y parámetros de negocio
│   │   ├── db/                # Conexión, esquema (DDL) y seed
│   │   ├── errors/            # Tipos de error de aplicación
│   │   ├── middleware/        # Autenticación, RBAC, validación, errores
│   │   ├── modules/           # auth · users · categories · books · copies
│   │   │                      # loans · reservations · fines · reports · audit
│   │   └── utils/             # Auditoría y utilidades de fecha
│   ├── tests/                 # 96 pruebas (Vitest + supertest)
│   └── scripts/smoke.mjs      # Prueba de humo de extremo a extremo
│
└── client/                    # SPA · React 18 + TypeScript + Vite
    ├── public/favicon.svg     # Icono del navegador (monograma SVG)
    ├── scripts/capturas.mjs   # Generador de capturas de evidencia (Playwright)
    └── src/
        ├── api/client.ts      # Cliente HTTP con JWT y manejo de errores
        ├── context/           # Sesión y roles (AuthContext)
        ├── components/        # Layout, BrandMark, guardas, modales, badges
        │                      # (iconos con lucide-react)
        └── pages/             # Login, panel, libros, préstamos, reservas,
                               # multas, usuarios, reportes, auditoría
```

**Scripts SQL (`database/`):** el esquema y las consultas están publicados como archivos ejecutables, espejo exacto del código:

```bash
# Crear la base desde cero (solo esquema)
sqlite3 server/data/biblioteca.db < database/schema.sql

# Repasar las 67 consultas reales del sistema, comentadas por módulo
sqlite3 server/data/biblioteca.db < database/queries.sql
```

> `schema.sql` es idéntico a la constante `SCHEMA` de `server/src/db/schema.ts`; si cambia una, debe cambiar la otra. `queries.sql` documenta las sentencias de los 8 repositorios (`users`, `categories`, `books`, `loans`, `reservations`, `fines`, `reports`, `audit`) con sus parámetros y las consultas de integridad (`PRAGMA foreign_key_check`).

---

## 2. Requisitos previos

| Herramienta | Versión mínima |
|---|---|
| Node.js | 22.x |
| npm | 10.x |
| Git | 2.x |

No se necesita servidor de base de datos: se usa **SQLite** (archivo local).

---

## 3. Instalación y ejecución

### 3.1 Backend

```bash
cd server
npm install
npm run seed      # crea la base de datos y carga datos de demostración
npm run start     # API en http://localhost:4000
```

Desarrollo con recarga automática:

```bash
npm run dev
```

### 3.2 Frontend

En otra terminal:

```bash
cd client
npm install
npm run dev       # aplicación en http://localhost:5173
```

El servidor de desarrollo de Vite envía `/api` a `http://localhost:4000`
(ver `client/vite.config.ts`), por lo que no hay que configurar nada más.

### 3.3 Cuentas de demostración

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `Admin1234` | Administrador |
| `bibliotecario` | `Biblio1234` | Bibliotecario |
| `maria.garcia` | `Socio1234` | Socio (con préstamo activo) |
| `juan.perez` | `Socio1234` | Socio (con multa pendiente) |
| `lucia.fernandez` | `Socio1234` | Socio |
| `carlos.ruiz` | `Socio1234` | Socio inactivo (bloqueado) |

---

## 4. Pruebas

```bash
# 96 pruebas automatizadas (8 archivos)
cd server && npm test

# Cobertura
npm run coverage

# Prueba de humo contra la API en ejecución (16 pasos)
node scripts/smoke.mjs

# Verificación de tipos
cd server && npx tsc -p tsconfig.json --noEmit
cd client && npm run typecheck

# Compilación de producción
cd client && npm run build
```

**Estado actual:** 8/8 archivos y 96/96 pruebas correctas; 16/16 pasos de humo correctos.

---

## 5. Arquitectura resumida

```
Navegador (React SPA)
        │  HTTP + JSON + JWT
        ▼
Express ─ middlewares: helmet · cors · rate limit · validación Zod
        │
        ├── rutas        (definición de endpoints y contratos)
        ├── controladores (HTTP: request → respuesta)
        ├── servicios     (reglas de negocio, transacciones)
        └── repositorios  (SQL parametrizado)
                │
                ▼
            SQLite (8 tablas, 3FN, FK con integridad referencial)
```

**Reglas de negocio clave**

- Préstamo solo de ejemplares `available`, con máximo 5 activos por socio y sin multas pendientes.
- Plazo por defecto 14 días; multa de **0,50 por día** de atraso (0 días de grace).
- La devolución libera el ejemplar, genera la multa si corresponde y activa la reserva más antigua.
- Reserva permitida solo si el libro está sin disponibilidad; máximo 3 activas; caduca a los 7 días.
- Baja lógica de usuarios con historial para preservar la integridad referencial.

Detalle completo en [`docs/05-arquitectura.md`](docs/05-arquitectura.md).

---

## 6. Variables de entorno (opcionales)

Todas tienen valores por defecto aptos para desarrollo; se definen antes de arrancar.

| Variable | Por defecto | Descripción |
|---|---|---|
| `PORT` | `4000` | Puerto de la API |
| `DATABASE_PATH` | `server/data/biblioteca.db` | Ruta de la base SQLite |
| `JWT_SECRET` | valor de desarrollo | Secreto de firma JWT (**obligatorio en producción**) |
| `JWT_EXPIRES_IN` | `8h` | Vigencia del token |
| `BCRYPT_ROUNDS` | `12` | Rondas de hash de contraseñas |
| `CORS_ORIGIN` | `http://localhost:5173` | Orígenes permitidos |
| `LOAN_DAYS` | `14` | Plazo de préstamo |
| `FINE_PER_DAY` | `0.5` | Multa por día de atraso |
| `MAX_ACTIVE_LOANS` | `5` | Límite de préstamos activos por socio |
| `MAX_ACTIVE_RESERVATIONS` | `3` | Límite de reservas activas por socio |
| `RESERVATION_DAYS` | `7` | Vigencia de una reserva |

---

## 7. Copia de seguridad de la base de datos

```bash
# Con el servidor detenido
cp server/data/biblioteca.db backups/biblioteca-$(date +%F).db

# O desde SQLite (el servidor puede seguir funcionando)
sqlite3 server/data/biblioteca.db "VACUUM INTO 'backups/biblioteca-$(date +%F).db';"
```

---

## 8. Documentación

El índice completo, con la descripción de cada documento y el orden de lectura sugerido,
está en [`docs/README.md`](docs/README.md).

---

## 9. Licencia

Proyecto académico de uso educativo.

# 13. Despliegue del sistema

**Asignatura:** Ingeniería de Software II
**Proyecto:** Sistema de Gestión de Biblioteca (SGB) — Biblioteca Pública Municipal "Ricardo Gómez"
**Versión del documento:** 1.0

---

## 1. Objeto de este documento

Este documento describe cómo **empaquetar y desplegar** el SGB de forma reproducible, sin dependencias de equipo:

1. Construir una imagen de Docker que contenga la API y la interfaz compiladas.
2. Levantar el sistema con un solo comando (`docker compose up -d --build`), con los datos persistidos en un volumen.
3. Publicar la aplicación en un alojamiento **gratuito** (Render, Koyeb o Adaptable) y conocer sus limitaciones.

La verificación local del despliegue se registra en [`09-evidencias-de-pruebas.md`](09-evidencias-de-pruebas.md) y en el Anexo A del trabajo final.

---

## 2. Arquitectura del empaquetado

El sistema se entrega en **una sola imagen** que sirve la API y la SPA desde el mismo origen, de modo que no hay problemas de CORS en producción ni necesidad de dos servicios:

```
navegador ──► :4000 ──► Express
                          ├── /api/*      → rutas de la API
                          └── demás GET   → client/dist/index.html (SPA)
```

El `Dockerfile` usa **construcción en varias etapas** (*multi-stage*):

| Etapa | Imagen | Función |
|---|---|---|
| `client-build` | `node:22-slim` | `npm ci` + `npm run build` de la SPA (Vite + TypeScript) |
| `server-deps` | `node:22-slim` | `npm ci` de la API (dependencias de producción) |
| final | `node:22-slim` | Copia `node_modules` del backend, el código del servidor y `client/dist`; expone el puerto 4000 |

Resultado: la imagen final **no** incluye el código fuente del frontend ni las dependencias de desarrollo, y el arranque ejecuta `npm run seed && npm run start`.

> **Servir la SPA desde Express:** `server/src/app.ts` monta `express.static(clientDist)` y un comodín `GET` que devuelve `index.html` para toda ruta que no empiece por `/api`, de modo que las rutas de React funcionan al recargar la página. Si `client/dist` no existe (desarrollo local), la capa estática se omite sin error.

---

## 3. Despliegue local con Docker

### 3.1 Requisitos

| Herramienta | Versión mínima |
|---|---|
| Docker Engine | 24.x (verificado con 28.0.1) |
| Docker Compose | v2 (incluido en Docker Desktop) |

No se necesita Node.js ni SQLite instalados: ambas cosas viven dentro de la imagen.

### 3.2 Comandos

```bash
# 1. Construir la imagen y levantar el servicio
docker compose up -d --build

# 2. Comprobar que el contenedor está sano
docker ps --filter "name=sistema-biblioteca"
#   → STATUS: ... (healthy)

# 3. Verificar los puntos de entrada
curl -s http://localhost:4000/api/health
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/   # 200

# 4. Prueba de humo completa (16 pasos) contra el contenedor
cd server && API_URL=http://localhost:4000 node scripts/smoke.mjs

# 5. Detener (los datos persisten en el volumen)
docker compose down
```

### 3.3 Volumen de datos

`docker-compose.yml` declara el volumen nombrado `biblioteca-data`, montado en `/app/server/data`:

```yaml
volumes:
  - biblioteca-data:/app/server/data
```

La base SQLite (`biblioteca.db`) vive **fuera** del sistema de archivos del contenedor, de modo que:

- `docker compose down` y `docker compose up --build` **no borran** los datos.
- Reconstruir la imagen no afecta el contenido de la base.
- Para una limpieza completa (borrar datos) se ejecuta `docker compose down -v`.

### 3.4 Carga inicial de datos (seed idempotente)

El `CMD` de la imagen ejecuta `npm run seed && npm run start`. El seed es **idempotente**: solo crea las categorías, libros, ejemplares, usuarios y movimientos de demostración si la base está vacía. Reiniciar el contenedor, por tanto, **no duplica registros**.

Cuentas resultantes:

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `Admin1234` | Administrador |
| `bibliotecario` | `Biblio1234` | Bibliotecario |
| `maria.garcia` | `Socio1234` | Socio (préstamo activo) |
| `juan.perez` | `Socio1234` | Socio (multa pendiente) |

### 3.5 Variables de entorno en el contenedor

| Variable | Valor en compose | Observación |
|---|---|---|
| `NODE_ENV` | `production` | Activa los valores por defecto de producción |
| `PORT` | `4000` | Puerto interno; el mapeo externo puede variar |
| `CORS_ORIGIN` | `*` | En el mismo origen no es estrictamente necesario |
| `JWT_SECRET` | `${JWT_SECRET:-…}` | **Obligatorio definirlo en producción real** (ver §5.1) |

---

## 4. Verificación del despliegue

La tabla siguiente resume lo comprobado en el equipo de desarrollo el 26 de noviembre de 2026 (registros completos en el Anexo A del trabajo final):

| Comprobación | Resultado |
|---|---|
| `docker compose up -d --build` | Contenedor `sistema-biblioteca` en estado **healthy** |
| `GET /api/health` | `200` con `{"ok":true,"data":{"status":"up",…}}` |
| `GET /` (SPA) | `200` con el documento `index.html` de React |
| `POST /api/auth/login` (admin) | `200` con token JWT válido |
| `npm test` contra el mismo código | 96/96 pruebas en verde |
| `tsc --noEmit` (cliente y servidor) | exit 0, sin errores de tipo |
| Prueba de humo con `API_URL=http://localhost:4000` | 16/16 pasos correctos |

---

## 5. Publicación en alojamiento gratuito

Las tres plataformas siguientes permiten desplegar el sistema sin costo para uso académico/demostrativo. Todas admiten despliegue desde GitHub.

### 5.1 Reglas comunes

1. **Crear una cuenta** en la plataforma y conectar el repositorio `AngelC00kies/sistema-biblioteca`.
2. **Definir `JWT_SECRET`** como secreto de entorno con un valor propio, por ejemplo:
   ```bash
   openssl rand -hex 32
   ```
   El valor por defecto del repositorio es un valor de desarrollo: **no debe usarse en producción**.
3. **Ruta de construcción / comando:** la imagen se construye desde el `Dockerfile` de la raíz; si la plataforma no usa Docker, el equivalente es `npm ci && npm run build` en `client/` y `npm ci` en `server/`, sirviendo `client/dist` desde la API.
4. **Puerto:** la aplicación escucha en `PORT` (4000 por defecto); en plataformas que asignan un puerto dinámico se debe leer `process.env.PORT` (ya soportado por el código).

### 5.2 Render (recomendado para la demostración)

| Aspecto | Valor |
|---|---|
| Plan gratuito | *Starter* (discontinuado para nuevas cuentas) o *Free web service* con limitaciones |
| Tipo de servicio | **Web Service** con Docker |
| Archivo de configuración | `render.yaml` en la raíz (opcional) |
| Discos | El plan gratuito **no incluye discos persistentes** (ver §5.5) |
| Suspensión | El servicio *free* se suspende tras 15 minutos sin tráfico y tarda ~1 minuto en reactivarse |

Ejemplo de `render.yaml`:

```yaml
services:
  - type: web
    name: sistema-biblioteca
    runtime: docker
    dockerfilePath: ./Dockerfile
    plan: free
    envVars:
      - key: JWT_SECRET
        generateValue: true
      - key: NODE_ENV
        value: production
    healthCheckPath: /api/health
```

### 5.3 Koyeb

| Aspecto | Valor |
|---|---|
| Plan gratuito | 2 servicios pequeños, sin tarjeta |
| Tipo de servicio | Servicio desde **Dockerfile** o desde repositorio |
| Discos | Persistencia mediante volúmenes adjuntos (ver §5.5) |
| Particularidad | Expone el puerto por variable `PORT`; el `HEALTHCHECK` del `Dockerfile` se usa como sondeo |

Pasos: *Create Service* → *Docker* → apuntar al repositorio → rama `main` → dejar el `Dockerfile` de la raíz → definir `JWT_SECRET`.

### 5.4 Adaptable (plan Hobby gratuito)

| Aspecto | Valor |
|---|---|
| Plan gratuito | *Hobby* con saldo inicial para experimentos |
| Tipo de servicio | Aplicación Docker o Node.js |
| Discos | Admite volúmenes persistentes montados en `/app/server/data` |

### 5.5 El problema del disco efímero

En los planes gratuitos de Render y Koyeb **el sistema de archivos es efímero**: al cada despliegue (y, en algunos casos, al reiniciar el proceso) se crea un contenedor nuevo y se pierde `/app/server/data/biblioteca.db`. Consecuencias y mitigaciones:

| Estrategia | Descripción | Costo |
|---|---|---|
| **Seed en cada arranque** (ya implementada) | El `CMD` ejecuta `npm run seed` antes de iniciar: si la base no existe, se recrea con los datos de demostración. El sistema **arranca siempre funcional**, aunque los datos introducidos durante la demostración se pierdan. | Ninguna |
| **Volumen persistente** | Adjuntar un disco/volumen en la ruta `/app/server/data` (Adaptable, plan pago de Render/Koyeb). | Requiere plan de pago |
| **Respaldo externo** | `sqlite3 biblioteca.db ".backup 'respaldo.db'"` y subirlo a un almacén de objetos. | Configuración manual |

Para la **defensa del trabajo final**, la primera estrategia es suficiente: el sistema se levanta con datos de demostración consistentes en cada arranque.

### 5.6 El problema de la suspensión por inactividad

Los planes gratuitos **duermen** el servicio tras un periodo sin tráfico:

- **Render:** ~15 minutos sin peticiones → suspensión; la primera petición posterior tarda 30–60 segundos en responder (llamada en frío).
- **Koyeb/Adaptable:** comportamiento análogo según el plan.

Implicaciones prácticas:

1. En la demostración, **hacer una petición de calentamiento** (`GET /api/health`) justo antes de mostrar el sistema.
2. El `HEALTHCHECK` del `Dockerfile` consulta `/api/health` cada 30 segundos; en plataformas con sondeo propio se debe configurar `healthCheckPath: /api/health` para que no se marque el servicio como caído durante la suspensión.
3. La suspensión **no pierde datos** si existe volumen persistente; solo retrasa la primera respuesta.

### 5.7 Alternativa sin suspensión: túnel local

Si la demostración debe ser en vivo y sin dormir, la opción más fiable es ejecutar el contenedor en la máquina local y exponerlo con un túnel gratuito:

```bash
docker compose up -d --build
npx localtunnel --port 4000      # o: cloudflared tunnel --url http://localhost:4000
```

---

## 6. Comandos de referencia

```bash
# --- desarrollo local (sin Docker) ---
cd server && npm install && npm run seed && npm run start   # API :4000
cd client && npm install && npm run dev                     # SPA :5173

# --- verificación ---
cd server && npm test                                       # 96 pruebas
cd client && npm run typecheck                              # tsc --noEmit
cd client && npm run build                                  # build de producción
cd server && API_URL=http://localhost:4000 node scripts/smoke.mjs   # 16 pasos

# --- contenedor ---
docker compose up -d --build                                # construir y levantar
docker compose logs -f biblioteca                           # ver registros
docker compose down                                         # detener (datos intactos)
docker compose down -v                                      # detener y borrar datos
docker compose build --no-cache                             # reconstruir sin caché

# --- publicación ---
git push origin main                                        # Render/Koyeb leen esta rama
```

---

## 7. Riesgos y limitaciones del despliegue gratuito

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Disco efímero | Pérdida de datos al desplegar | Seed idempotente en cada arranque (§5.5) |
| Suspensión por inactividad | Primera respuesta lenta (30–60 s) | Petición de calentamiento antes de la demostración |
| `JWT_SECRET` por defecto | Falsificación de tokens | Definir secreto propio como variable de entorno |
| Plan gratuito compartido | Rendimiento variable | Mantener la demostración local como respaldo |
| Dependencias con avisos de seguridad (`npm audit`) | Alertas en el despliegue | Actualizar en una iteración futura; sin `audit fix --force` |

---

## 8. Referencias

- Docker. (s. f.). *Docker documentation*. https://docs.docker.com/
- Docker. (s. f.). *Compose file reference*. https://docs.docker.com/compose/
- Render. (s. f.). *Render documentation — Docker web services*. https://render.com/docs/docker
- Koyeb. (s. f.). *Koyeb documentation*. https://docs.koyeb.com/
- Adaptable. (s. f.). *Adaptable documentation*. https://docs.adaptable.io/
- SQLite Consortium. (s. f.). *SQLite write-ahead logging*. https://www.sqlite.org/wal.html

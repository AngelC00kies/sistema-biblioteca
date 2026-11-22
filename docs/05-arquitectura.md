# 05 — Arquitectura de software

**Proyecto:** Sistema de Gestión de Biblioteca (SGB)
**Documento:** Justificación de la arquitectura, descripción de capas, flujo de una petición, despliegue y decisiones de diseño.

---

## 1. Arquitectura seleccionada

El SGB adopta una **arquitectura cliente-servidor en capas (layered architecture)** con el patrón **MVC** (Modelo–Vista–Controlador) en el backend y una **SPA** (Single Page Application) como vista en el frontend:

```
Frontend React (Vista MVC)  ⇄  API REST/JSON  ⇄  Backend Express (Controlador + Servicio + Modelo)  ⇄  SQLite
```

**Definición operativa:** una arquitectura en capas agrupa el software en niveles horizontales donde cada nivel solo puede invocar al inmediatamente inferior, y el MVC separa la presentación (Vista), la coordinación de la petición (Controlador) y las reglas de negocio + persistencia (Modelo/Servicio/Repositorio).

### 1.1 Elementos del MVC en el SGB

| Elemento MVC | Dónde vive en el SGB | Responsabilidad |
|---|---|---|
| **Vista** | `client/` — páginas React + componentes | Renderizar, validar en cliente, mostrar errores e indicadores de carga. |
| **Controlador** | `server/` — `controllers/*` | Recibir la petición HTTP, ejecutar validación Zod, invocar al servicio y traducir su resultado a código HTTP/JSON. |
| **Modelo** | `server/` — `services/*` + `repositories/*` + tablas SQLite | Reglas de negocio (loan, multa, reserva) y persistencia. |
| **Enrutador (Vista→Controlador)** | `server/` — `routes/*` | Mapear método+URL al controlador y encadenar `authenticate`/`authorize`/`validate`. |

---

## 2. Justificación de la elección

### 2.1 Por qué arquitectura en capas

1. **El dominio es transaccional y secuencial.** Registrar un préstamo implica validar usuario → validar ejemplar → validar límite → escribir préstamo → cambiar ejemplar → auditar. Ese flujo lineal encaja naturalmente en capas y hace trivial el manejo de transacciones (documentado en la secuencia del préstamo).
2. **Equipo de desarrollo de una sola persona.** El trabajo es individual; una estructura convencional de carpetas (rutas, controllers, services, repositories) reduce el *cognitive load* y evita decisiones de arquitectura innecesarias en cada módulo.
3. **Testeabilidad.** Con inyección simple en los servicios, Vitest puede probar la lógica de negocio sin HTTP (unitarias) y con supertest (integración), cumpliendo RNF-10.
4. **Cambio localizado.** Cambiar la política de multas o el plazo de préstamo se hace en un único servicio, sin tocar rutas ni frontend.
5. **Seguridad perimetral consistente.** Los middlewares (helmet, rate limit, Zod, JWT, RBAC) se aplican una sola vez por ruta y protegen toda la capa de controladores.
6. **Requisito de despliegue simple.** Basta un proceso Node sirviendo API y el build estático del frontend, sin orquestadores ni servicios adicionales.

### 2.2 Por qué MVC

- **Separación de responsabilidades verificable:** la vista React nunca conoce SQL; los repositorios nunca conocen Express; los controladores nunca contienen reglas de negocio.
- **Reutilización de la vista:** la misma API REST podría atender, en el futuro, una app móvil sin duplicar lógica.
- **Alineación con los requisitos de la asignatura:** el patrón se evidencia en el diagrama de componentes y en cada caso de prueba de integración.

---

## 3. Por qué **NO** microservicios (arquitectura descartada)

| Criterio | SGB (alcance real) | Microservicios | Conclusión |
|---|---|---|---|
| Dominio | Un único dominio cohesionado (préstamos) | Múltiples dominios independientes | Un solo módulo no justifica partirlo |
| Escala esperada | ~3.000 usuarios, decenas concurrentes | Miles de TPS, equipos grandes | SQLite + un proceso bastan (RNF-04: 50 concurrentes) |
| Transaccionalidad | Préstamo + ejemplar + auditoría en una misma transacción ACID | Compensaciones sagas, dos fases | La transacción local simplifica enormemente la integridad |
| Equipo | 1 desarrollador | Varios equipos/áreas | Más servicios = más coordinación que capacidad |
| Despliegue | 1 proceso Node en equipo local | Contenedores, orquestador, service mesh | Infraestructura desproporcionada |
| Observabilidad | Logs + audit_logs | Tracing distribuido, correlación de IDs | Costo injustificado |
| Consistencia de datos | 3FN en una sola BD | Consistencia eventual entre BD | La biblioteca exige fuente única de verdad |
| Costo operativo | Cero licencias, hardware existente | Múltiples servicios en ejecución | Presupuesto municipal limitado |

**Decisión:** se descartan microservicios, buses de eventos (Kafka/RabbitMQ), GraphQL y BFF porque **el costo y la complejidad superan el beneficio** para el alcance de un trabajo final individual con una única fuente de datos. Se deja explícito en el análisis que la arquitectura en capas **permite evolucionar** hacia microservicios (extrayendo reservas o reportes como servicio) sin reescribir el dominio, gracias a que los servicios encapsulan las reglas de negocio tras interfaces claras.

---

## 4. Capas descritas

### 4.1 Capa de presentación (frontend)

| Elemento | Tecnología | Responsabilidad |
|---|---|---|
| Páginas | React 18 + TS | 11 pantallas (doc. 07) |
| Enrutamiento | react-router-dom | Rutas protegidas y guardas por rol |
| Cliente HTTP | `fetch` envuelto | Adjunta `Authorization`, centraliza manejo 401/403 |
| Validación espejo | esquemas Zod compartidos | Feedback inmediato sin round-trip (RU-03) |

### 4.2 Capa de transporte / API

- Protocolo **HTTP/1.1 + JSON**, prefijo `/api`.
- Middlewares en orden: `helmet` → `cors` (lista blanca) → `express-rate-limit` → `express.json()` → `authenticate` → `validate(schema)` → controlador.
- Errores normalizados: `{ "error": { "code": "EJEMPLAR_NO_DISPONIBLE", "message": "…" } }` con códigos 400/401/403/404/409/429/500.

### 4.3 Capa de presentación del servidor: **Rutas**

Mapean `método + path` → controlador y declaran autorizaciones:

| Grupo | Rutas principales | Autorización |
|---|---|---|
| Auth | `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me` | login público; register → admin |
| Usuarios | `GET/POST /api/users`, `PUT/DELETE /api/users/:id` | admin |
| Categorías | `GET /api/categories`, `POST`, `PUT/DELETE /:id` | GET público; escritura → admin/librarian |
| Libros | `GET /api/books` (q, category_id, page, limit), `GET /api/books/:id`, `POST /api/books`, `PUT/DELETE /api/books/:id`, `GET/POST /api/books/:id/copies` | lectura público; escritura → admin/librarian |
| Ejemplares | `PUT /api/copies/:id` | admin/librarian |
| Préstamos | `POST /api/loans`, `POST /api/loans/:id/return`, `GET /api/loans`, `GET /api/loans/my` | escritura → admin/librarian; `my` → autenticado |
| Reservas | `POST /api/reservations`, `GET /api/reservations`, `POST /api/reservations/:id/cancel`, `POST /api/reservations/:id/fulfill` | creación → autenticado; listado → admin/librarian (propias en `member`) |
| Multas | `GET /api/fines`, `GET /api/fines/my`, `POST /api/fines/:id/pay` | global → admin/librarian; `my`/`pay` → autenticado |
| Reportes | `GET /api/reports/summary`, `GET /api/reports/top-books`, `GET /api/reports/overdue` | admin/librarian |
| Auditoría | bitácora (interna del módulo de auditoría) | admin |

### 4.4 Capa de controladores

- Extraen `req.body/params/query`, ejecutan `validate` con Zod, llaman **una sola vez** al servicio y devuelven la respuesta.
- **No** contienen reglas de negocio ni SQL; su complejidad máxima es la traducción HTTP.
- Devuelven códigos estándar: 200 (consulta), 201 (creación), 204 (borrado), 4xx (regla/validación), 500 (error no previsto).

### 4.5 Capa de servicios (corazón del MVC)

| Servicio | Reglas de negocio que implementa |
|---|---|
| `AuthService` | bcrypt 12 rondas, emisión/validación JWT, bloqueo de `inactive`, auditoría de login. |
| `UserService` | unicidad de username/email, creación solo por admin, borrado lógico (RF-06…RF-12). |
| `CategoryService` / `BookService` | unicidad de nombre/ISBN, bloqueo de borrado con dependencias (RF-13…RF-19). |
| `CopyService` | transiciones de estado del ejemplar y código de inventario único (RF-20…RF-22). |
| `LoanService` | plazo 14 días, disponibilidad, límite 5, bloqueo por deuda, cálculo de atraso y multa 0,50/día, activación de reservas (RF-23…RF-36). |
| `ReservationService` | disponibilidad total del libro, límite 3, caducidad 7 días, cancelación/fulfill (RF-37…RF-43). |
| `FineService` | ciclo `pending→paid`, impago doble, desbloqueo de deudores (RF-44…RF-48). |
| `ReportService` | agregaciones de resumen, ranking y atrasos (RF-49…RF-52). |
| `AuditService` | escritura *append-only* en `audit_logs` (RF-53…RF-55). |

Los servicios son los únicos que conocen **múltiples** repositorios y abren **transacciones**, de modo que la atomicidad es una responsabilidad de esta capa y no del controlador.

### 4.6 Capa de repositorios

- Encapsulan todo el SQL con **consultas parametrizadas** (`?` bindings) vía better-sqlite3 (síncrono, de alto rendimiento en SQLite).
- Exponen un API orientado a dominio: `buscarPorUsername`, `contarActivosPorUsuario`, `buscarLibrosConFiltros`, `insertarPrestamo`, etc.
- No contienen lógica de negocio; únicamente traducen entidades a filas y viceversa.

### 4.7 Capa de datos

- **SQLite** en archivo con `PRAGMA foreign_keys = ON`, `journal_mode = WAL` y `busy_timeout`.
- Índices: `idx_books_title`, `idx_books_author`, `idx_books_isbn`, `idx_copies_book`, `idx_copies_status`, `idx_loans_user_status`, `idx_loans_status`, `idx_reservations_book_status`, `idx_fines_user_status`, `idx_audit_user_created`, `idx_audit_entity`.
- Copias de seguridad diarias (ver doc. 08).

---

## 5. Flujo de una petición (ejemplo real: `POST /api/loans`)

| Paso | Capa | Qué ocurre | Posible salida |
|---|---|---|---|
| 1 | Red / proxy | El navegador envía `POST /api/loans` con `Authorization: Bearer <jwt>` y JSON | — |
| 2 | `helmet` | Fija cabeceras de seguridad y CSP | — |
| 3 | `cors` | Valida el origen contra la lista blanca | 403 CORS si no coincide |
| 4 | `express-rate-limit` | Cuenta la petición por IP | 429 al superar 100/15 min |
| 5 | `express.json()` | Parsea el cuerpo | 400 si el JSON está mal formado |
| 6 | `authenticate` | Decodifica y verifica el JWT (expiración 8 h) | 401 sin token / inválido / expirado |
| 7 | `authorize('admin','librarian')` | Compara `req.user.role` con la lista permitida | 403 si el rol no calza |
| 8 | `validate(createLoanSchema)` | Valida `copy_id`, `user_id` con Zod | 400 con detalle por campo |
| 9 | `LoanController.crear` | Delega al servicio | — |
| 10 | `LoanService.crear` | Consulta usuario, multas, préstamos activos y ejemplar; aplica RF-24…RF-27 | 403/409 con `code` específico |
| 11 | Transacción | `BEGIN` → `INSERT loans` → `UPDATE copies` → `INSERT audit_logs` → `COMMIT` | `ROLLBACK` + 500 en cualquier fallo |
| 12 | Repositorios | Ejecutan SQL parametrizado | — |
| 13 | Controlador | Devuelve `201` con `{id, loan_date, due_date}` | — |
| 14 | Cliente | Actualiza estado y muestra el aviso con la fecha de vencimiento | — |
| 15 | `errorHandler` | Captura cualquier error no manejado y lo normaliza sin exponer stack trace | 500 genérico |

---

## 6. Diagrama de despliegue

```mermaid
graph TB
  subgraph NAV["Navegador del usuario"]
    B1["Chrome / Firefox / Edge / Safari<br/>SPA React (bundle Vite)"]
    S1["Almacenamiento local<br/>token JWT + usuario"]
    B1 --- S1
  end

  subgraph RED["Red local de la biblioteca (LAN / Wi-Fi)"]
    SW["Switch / Router"]
  end

  subgraph SRV["Servidor - equipo de la biblioteca (Node.js 22)"]
    subgraph PROC["Proceso 1: API Express (puerto 3000)"]
      MW["helmet - cors - rate-limit - zod - jwt"]
      API2["Router /api/* -> controllers -> services -> repositories"]
    end
    subgraph STATIC["Servicio de archivos estaticos"]
      DIST["client/dist (build de Vite)"]
    end
    FILES["Carpeta data/<br/>biblioteca.db (WAL) + biblioteca.db-wal + biblioteca.db-shm"]
    BACKUPS["backups/<br/>biblioteca_YYYY-MM-DD.db (7 dias)"]
    LOGS["logs/ + tabla audit_logs"]
  end

  subgraph ADM["Estaciones de trabajo"]
    W1["Estacion bibliotecario"]
    W2["Estacion direccion"]
    W3["PC publica consulta catalogo"]
  end

  B1 -->|HTTP/JSON :3000| SW
  W1 --> SW
  W2 --> SW
  W3 --> SW
  SW -->|trafico| PROC
  DIST -->|GET / , /assets| B1
  API2 --> FILES
  FILES -->|copia diaria 02:00| BACKUPS
  API2 --> LOGS

  style PROC fill:#eef9ee,stroke:#3aa655
  style FILES fill:#f5eef9,stroke:#8e44ad
  style NAV fill:#e8f4fd,stroke:#2c7be5
  style RED fill:#fff4e6,stroke:#e8a838
```

### Explicación del diagrama de despliegue

El diagrama muestra el **despliegue real en la Biblioteca "Ricardo Gómez"**: un único equipo servidor ejecuta el proceso Node 22 —que expone la API en el puerto 3000 y además sirve el bundle estático generado por Vite (`client/dist`)—, el archivo de base de datos `biblioteca.db` con sus archivos WAL, la carpeta de copias de seguridad y el registro de auditoría. Los usuarios no instalan nada: cualquier navegador de las estaciones de trabajo (bibliotecario, dirección, PC de consulta pública) o de la red de la biblioteca accede por HTTP sobre la LAN.

Se eligió este diagrama porque responde la pregunta operativa **"¿dónde corre y cómo se accede?"**: no hay CDN, ni contenedores, ni servicios cloud, coherente con la decisión descartada de microservicios y con la exigencia de operar sin dependencias externas (RD-06). La separación entre proceso API y archivos estáticos dentro del mismo host permite que la copia de seguridad diaria se ejecute con un simple comando sobre el archivo mientras el servidor sigue operando en modo WAL. El corte de red o de energía se mitiga con el modo WAL (RD-07) y con la restauración en ≤ 15 minutos (RD-04).

---

## 7. Decisiones de arquitectura y alternativas descartadas

| # | Decisión (ADR breve) | Contexto | Alternativas descartadas y por qué |
|---|---|---|---|
| AD-1 | SPA React + API REST separada (client–server) | Se requiere consulta en sitio y operación en mostrador | **Server-side rendering / PHP tradicional:** acopla presentación y datos, dificulta RBAC en cliente y pruebas E2E. **Monolito con plantillas:** menos reutilizable y menos alineado con el objetivo de enseñar API REST. |
| AD-2 | Arquitectura en capas con MVC en backend | Reglas de negocio transaccionales | **Capa única (scripts):** inviable para 55 RF y pruebas. **Hexagonal/ports-adapters:** más ceremonia de la necesaria para un proyecto individual, aunque compatible a futuro. |
| AD-3 | Un solo proceso Node + SQLite | ~3.000 usuarios, decenas concurrentes, hardware local | **Microservicios:** coste operativo y consistencia eventual innecesarios (§3). **MongoDB/PostgreSQL:** exigen instalación y administración de servidor de BD; SQLite cumple RNF-07/08 con cero configuración. **MySQL:** licencia/servicio adicional sin beneficio. |
| AD-4 | better-sqlite3 (síncrono) sobre driver asincrónico | SQLite local, operación por transacciones cortas | **Prisma/ORM completo:** añade capas y learning curve; los repositorios ya encapsulan el SQL. **sqlite3 (async):** callbacks anidados sin necesidad, ya que SQLite local es instantáneo. |
| AD-5 | JWT stateless de 8 h + refresh manual | Sesión simple, sin servidor de sesiones | **Sesiones en servidor (cookies):** requiere tabla de sesiones y no escala con SPA. **Refresh token rotativo completo:** más complejidad de la justificable; se cubre con expiración corta y re-login (RS-08). |
| AD-6 | Validación Zod compartida cliente/servidor | Mismo contrato en ambos lados | **Solo validación en cliente:** inseguro. **Joi/express-validator:** válido, pero Zod da tipos TypeScript inferidos sin duplicación. |
| AD-7 | Borrado lógico de usuarios (`status='inactive'`) | Debe conservarse el histórico de préstamos y auditoría | **Borrado físico:** rompería FK y el histórico (RNF-07). |
| AD-8 | Transacciones en la capa de servicios | Operaciones multi-tabla (loan+copy+audit) | **Sin transacción:** riesgo de ejemplar `loaned` sin préstamo. **Unit of Work generalizado:** sobre-ingeniería para 8 tablas. |
| AD-9 | Auditoría append-only en tabla propia | Control interno municipal | **Solo logs de archivo:** no consultable desde la UI ni con IP/usuario. **Trigger de BD:** menos explícito y difícil de probar. |
| AD-10 | Commits convencionales en `main` | Proyecto individual | **Git Flow completo (develop/release):** burocrático para un solo autor; se reserva para fases futuras. |

---

## 8. Matriz de calidad asociada a la arquitectura

| Atributo | Cómo lo sostiene la arquitectura |
|---|---|
| Seguridad | Middlewares en una sola pila + RBAC por ruta + Zod + bcrypt + JWT + auditoría. |
| Mantenibilidad | Carpetas por capa, reglas de negocio centralizadas en servicios, TypeScript estricto. |
| Rendimiento | better-sqlite3 síncrono + índices + paginación obligatoria (RR-08). |
| Confiabilidad | Transacciones, WAL, backup diario y manejo de errores centralizado. |
| Escalabilidad | Índices en BD, paginación y posibilidad de escalar verticalmente; extracción futura de reportes a un servicio. |
| Usabilidad | SPA con respuestas inmediatas, validación espejo y guardas por rol. |

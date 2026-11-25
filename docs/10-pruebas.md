# 10 — Estrategia, casos y evidencia de pruebas

## 1. Encabezado

**Proyecto:** Sistema de Gestión de Biblioteca (SGB)
**Documento:** Estrategia de pruebas (pirámide), catálogo de casos reales, cobertura y cómo ejecutarla, registro de errores detectados, evidencia de ejecución y casos pendientes.

**Herramientas:** Vitest (integración API + BD), supertest (HTTP sobre la API real), SQLite en memoria (`:memory:`) como base de prueba, Node.js `fetch` para la prueba de humo de extremo a extremo, `tsc --noEmit` para verificación de tipos y `vite build` para la compilación de producción del cliente.

**Convención de resultados:**

- **Correcto (✓)** — el caso está automatizado en `server/tests/*.ts` y la suite completa pasa al 100 %.
- **Pendiente (manual)** — caso no automatizado, descrito en la sección 7.

**Fuente de verdad:** los IDs de este documento corresponden literalmente a los `it(...)` de `server/tests/` (8 archivos, 96 pruebas) y a `server/scripts/smoke.mjs` (16 pasos). No hay casos inventados: todo lo que sigue está en el código de pruebas.

---

## 2. Estrategia — pirámide de pruebas

```
                 /\
                /  \        Funcional E2E — prueba de humo (smoke.mjs)
               / UI \       16 pasos contra la API con datos del seed
              /------\
             /        \     Integración API + BD (Vitest + supertest)
            /  API +   \    8 archivos · 96 pruebas · 100 % en verde
           /   BD       \   10 módulos, RBAC, reglas de negocio, restricciones
          /--------------
         /                \ Unitarias (Vitest) — lógica pura ejercida desde
        /  utilidades de      \ las suites: fechas (utils/date.ts), esquemas Zod,
       /   fecha y validación   \ multa por día y límites (env.ts)
      /------------------------
     /                          Recorrido manual de UI (11 rutas),
    /    Pendiente (§7)           rendimiento y copias de seguridad
   /------------------------------------
```

| Nivel | Objeto | Archivos / casos | Herramienta | Estado |
|---|---|---|---|---|
| **Unitario** | `src/utils/date.ts` (`todayISO`, `addDays`, `daysBetween`), esquemas Zod de cada módulo, parámetros de negocio de `src/config/env.ts` (14 días, 0,50/día, límite 5 préstamos, 3 reservas, 7 días de caducidad) | Sin archivo propio: se ejercen desde las suites de integración (casos `SE-*`, `FC-PRE-04`, `FC-DEV-11`, `FC-CAT-09`) | Vitest | Cubierto indirectamente |
| **Integración (API + BD)** | Los 10 módulos (`auth`, `users`, `categories`, `books`, `copies`, `loans`, `reservations`, `fines`, `reports`, `audit`) contra SQLite en memoria con datos sembrados por `tests/helpers.ts` | **8 archivos · 96 pruebas** (sección 3) | Vitest + supertest | **100 % en verde** |
| **Funcional E2E (humo)** | Flujo completo sobre la API en ejecución con los datos del seed: salud → login → catálogo → reserva → préstamo → devolución → reporte → auditoría → cancelación | `scripts/smoke.mjs` · **16 pasos** | Node.js (`fetch`) | **16/16 correctos** |
| **Manual (UI, rendimiento, backup)** | 11 rutas de la SPA, carga con 5.000 libros, copia/restauración de la BD | `FF-01…FF-08`, `RR-01…RR-05`, `BK-01` (sección 7) | Navegador, cronómetro, `sqlite3` | Pendiente (manual) |

**Notas de la estrategia:**

- Cada archivo de prueba usa una base **aislada e independiente**: `useTestDatabase()` abre `:memory:`, siembra los datos mínimos en `beforeAll` y cierra la conexión en `afterAll`. No hay estado compartido entre archivos.
- Datos de arranque comunes a todas las suites (`tests/helpers.ts`): 5 usuarios (`admin`, `librarian`, `member`, `debtor`, `inactive`), 2 categorías, 2 libros (7 ejemplares en total).
- Convención de IDs real: `FC` (funcional), `SE` (seguridad), `RB` (restricción de rol), `MUL` (multas), `AUD` (auditoría), `RP-SAL` (salud), `CAT`/`PRE`/`DEV`/`RES`/`USR`/`REP` (área funcional).

---

## 3. Catálogo de casos de prueba

### 3.1 Autenticación — `server/tests/auth.test.ts` (12 casos)

| ID | Objetivo | Datos de prueba | Pasos (resumidos) | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|---|
| FC-AU-01 | Autenticar a un administrador con credenciales válidas | `admin / Admin1234` sembrado con hash bcrypt | `POST /api/auth/login` | 200, `ok:true`, `token` presente, `user` sin `password_hash`, `role='admin'` | Correcto (✓) |
| FC-AU-02 | Rechazar una contraseña incorrecta con 401 | `admin / clave-mala` | `POST /api/auth/login` | 401 con `code='UNAUTHORIZED'` y `data` ausente | Correcto (✓) |
| FC-AU-03 | Rechazar un usuario inexistente sin revelar cuál falló | `no-existe / Admin1234` | `POST /api/auth/login` | 401 con mensaje "Usuario o contraseña incorrectos" | Correcto (✓) |
| FC-AU-04 | Bloquear el acceso de una cuenta inactiva | usuario `inactive / Member1234` | `POST /api/auth/login` | 403 con `code='FORBIDDEN'` y mensaje que contiene "inactiva" | Correcto (✓) |
| SE-AU-05 | Validar el formato de las entradas antes de tocar la BD | `username='ab'`, `password='123'` | `POST /api/auth/login` | 400 con `code='BAD_REQUEST'` y `details` como arreglo | Correcto (✓) |
| SE-AU-06 | Exigir token de autenticación en el perfil | sin cabecera `Authorization` | `GET /api/auth/me` | 401 con `code='INVALID_TOKEN'` | Correcto (✓) |
| SE-AU-07 | Rechazar un token manipulado | `Bearer token-falso-para-pruebas` | `GET /api/auth/me` | 401 | Correcto (✓) |
| FC-AU-08 | Devolver el perfil del usuario autenticado | token del socio `member` | `GET /api/auth/me` con `Authorization: Bearer` | 200, `username='member'`, sin `password_hash` | Correcto (✓) |
| RB-AU-09 | Prohibir a un socio crear usuarios | token `member` con `role:'admin'` en el body | `POST /api/auth/register` | 403 | Correcto (✓) |
| FC-AU-10 | El administrador crea un socio y puede iniciar sesión | `nuevo.socio / Nueva1234`, `role:'member'` | `POST /api/auth/register` y luego `POST /api/auth/login` | 201 con `role='member'` y login posterior 200 | Correcto (✓) |
| FC-AU-11 | Rechazar un nombre de usuario duplicado | `username='admin'` ya existente | `POST /api/auth/register` | 409 con `code='CONFLICT'` | Correcto (✓) |
| SE-AU-12 | Exigir contraseña con mayúscula y número | `password='sololetras'` | `POST /api/auth/register` | 400 | Correcto (✓) |

### 3.2 Catálogo de libros y ejemplares — `server/tests/books.test.ts` (15 casos)

| ID | Objetivo | Datos de prueba | Pasos (resumidos) | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|---|
| FC-CAT-01 | Listar el catálogo con paginación y totales | 2 libros y 7 ejemplares sembrados | `GET /api/books` con token `member` | 200, `data` con 2 filas, `meta.total=2`, fila con `available_copies` | Correcto (✓) |
| FC-CAT-02 | Buscar por título, autor o ISBN | `search=clean` | `GET /api/books?search=clean` | 200 con 1 resultado: `Clean Code` | Correcto (✓) |
| FC-CAT-03 | Filtrar por categoría | `categoryId=2` (Ciencia) | `GET /api/books?categoryId=2` | 200 con 1 libro y `category_name='Ciencia'` | Correcto (✓) |
| FC-CAT-04 | La búsqueda no admite inyección SQL | `search=' OR 1=1 --` | `GET /api/books?search=...` | 200 con 0 resultados (consulta parametrizada) | Correcto (✓) |
| SE-CAT-05 | Exigir autenticación para consultar el catálogo | sin cabecera `Authorization` | `GET /api/books` | 401 | Correcto (✓) |
| FC-CAT-06 | El bibliotecario registra un libro nuevo | ISBN `978-84-9759-278-3`, `El nombre de la rosa`, año 1980, `categoryId=1` | `POST /api/books` con token `librarian` | 201 con `id > 0` | Correcto (✓) |
| FC-CAT-07 | Rechazar un ISBN duplicado | ISBN de `Cien años de soledad` | `POST /api/books` | 409 con `code='CONFLICT'` | Correcto (✓) |
| SE-CAT-08 | Un socio no puede dar de alta libros | token `member` | `POST /api/books` | 403 con `code='FORBIDDEN'` | Correcto (✓) |
| FC-CAT-09 | Validar el año de publicación | `publicationYear=3000` | `POST /api/books` | 400 con `code='BAD_REQUEST'` | Correcto (✓) |
| FC-CAT-10 | Rechazar una categoría inexistente | `categoryId=999` | `POST /api/books` | 400 con mensaje que contiene "categoría" | Correcto (✓) |
| FC-CAT-11 | Actualizar los datos de un libro | libro 1 con título y autor corregidos | `PUT /api/books/1` con token `admin` | 200 y `title` que contiene "aniversario" | Correcto (✓) |
| FC-CAT-12 | Devolver 404 ante un libro inexistente | `id=9999` | `PUT /api/books/9999` | 404 con `code='NOT_FOUND'` | Correcto (✓) |
| FC-EJ-13 | Agregar un ejemplar a un libro | `inventoryCode='EJ-001-9'`, `condition='good'` | `POST /api/books/1/copies` con token `librarian` | 201 con `status='available'` | Correcto (✓) |
| FC-EJ-14 | Rechazar códigos de inventario duplicados | `inventoryCode='EJ-001-1'` | `POST /api/books/1/copies` | 409 | Correcto (✓) |
| FC-EJ-15 | Listar los ejemplares de un libro | libro 1 (4 ejemplares) | `GET /api/books/1/copies` con token `member` | 200 con al menos 3 ejemplares | Correcto (✓) |

### 3.3 Categorías — `server/tests/categories.test.ts` (10 casos)

| ID | Objetivo | Datos de prueba | Pasos (resumidos) | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|---|
| CAT-01 | Cualquier usuario autenticado lista las categorías | 2 categorías: Ficción y Ciencia | `GET /api/categories` con token `member` | 200 con 2 filas en orden alfabético (`Ciencia` primero) | Correcto (✓) |
| CAT-02 | La lista exige autenticación | sin token | `GET /api/categories` | 401 | Correcto (✓) |
| CAT-03 | El bibliotecario crea una categoría | `{name:'Filosofía', description:'Obras de pensamiento'}` | `POST /api/categories` | 201 con `id > 0` | Correcto (✓) |
| CAT-04 | Rechazar nombres duplicados | `name='Filosofía'` ya creada | `POST /api/categories` | 409 con mensaje que contiene "existe una categoría" | Correcto (✓) |
| RB-CAT-05 | Un socio no puede crear categorías | token `member` | `POST /api/categories` | 403 | Correcto (✓) |
| CAT-06 | Validar la longitud mínima del nombre | `name='X'` | `POST /api/categories` | 400 | Correcto (✓) |
| RB-CAT-07 | Solo un administrador puede eliminar categorías | token `librarian`, `id=3` | `DELETE /api/categories/3` | 403 | Correcto (✓) |
| CAT-08 | Impide eliminar una categoría con libros asociados | categoría 1 (Ficción) con libros | `DELETE /api/categories/1` con token `admin` | 422 con mensaje que contiene "libros asociados" | Correcto (✓) |
| CAT-09 | Eliminar una categoría sin contenido | categoría 3 recién creada | `DELETE /api/categories/3` | 200 con `data.eliminated=true` | Correcto (✓) |
| CAT-10 | Devolver 404 ante una categoría inexistente | `id=999` | `DELETE /api/categories/999` | 404 | Correcto (✓) |

### 3.4 Préstamos y devoluciones — `server/tests/loans.test.ts` (14 casos)

| ID | Objetivo | Datos de prueba | Pasos (resumidos) | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|---|
| FC-PRE-01 | El bibliotecario registra un préstamo y el ejemplar pasa a prestado | `copyId=1` (disponible), `memberId=3` | `POST /api/loans` y luego `GET /api/books/1/copies` | 201 con `status='active'`, `book_title` correcto, `days_late=0`; el ejemplar queda `loaned` | Correcto (✓) |
| FC-PRE-02 | No permite prestar un ejemplar que ya está prestado | `copyId=1` ya prestado, `memberId=4` | `POST /api/loans` | 422 con `code='BUSINESS_RULE_VIOLATION'` | Correcto (✓) |
| RB-PRE-03 | Un socio no puede registrar préstamos | token `member` | `POST /api/loans` | 403 | Correcto (✓) |
| FC-PRE-04 | Rechazar una fecha de devolución no futura | `dueDate='2020-01-01'` | `POST /api/loans` | 400 con mensaje que contiene "devolución" | Correcto (✓) |
| FC-PRE-05 | Bloquear el préstamo a un socio con multas pendientes | préstamo histórico devuelto + multa de 3,50 del socio 4 (`insertLoanRow` + `insertFineRow`) | `POST /api/loans` para el socio 4 | 422 con mensaje que contiene "multas pendientes" | Correcto (✓) |
| FC-PRE-06 | Respetar el límite máximo de préstamos activos por socio | socio 3 completado a 5 préstamos activos | `POST /api/loans` (sexto) | 422 con mensaje que contiene "límite" | Correcto (✓) |
| RB-PRE-07 | El socio solo ve sus propios préstamos | token del socio `member` | `GET /api/loans/my` | 200 y todas las filas con `user_id=3` | Correcto (✓) |
| FC-PRE-08 | El bibliotecario consulta el total de préstamos con filtros | 5 préstamos activos en la BD de la suite | `GET /api/loans?status=active` | 200 con `meta.total=5` | Correcto (✓) |
| FC-DEV-09 | Registrar una devolución en tiempo sin generar multa | préstamo activo del ejemplar 1 | `POST /api/loans/:id/return` y releer el ejemplar | 200 con `loan.status='returned'`, `fineAmount=0` y ejemplar `available` | Correcto (✓) |
| FC-DEV-10 | No permitir devolver dos veces el mismo préstamo | préstamo ya `returned` | `POST /api/loans/:id/return` | 422 con mensaje que contiene "ya fue devuelto" | Correcto (✓) |
| FC-DEV-11 | Calcular la multa proporcional a los días de atraso | préstamo con `dueDate` hace 10 días | `POST /api/loans/:id/return` | 200 con `fineAmount=5` (10 días × 0,50) | Correcto (✓) |
| FC-DEV-12 | La multa generada queda registrada como pendiente | socio `debtor` con multas generadas en los casos anteriores | `GET /api/fines/my` | 200 con `meta.summary.count ≥ 2` y `total > 0` | Correcto (✓) |
| RB-DEV-13 | Un socio no puede registrar devoluciones | token `member` sobre un préstamo activo | `POST /api/loans/:id/return` | 403 | Correcto (✓) |
| RB-PRE-14 | Un socio no puede leer el detalle de un préstamo ajeno | préstamo del socio 4 (`insertLoanRow`) | `GET /api/loans/:id` con token `member` | 403; y con un préstamo propio → 200 | Correcto (✓) |

### 3.5 Reservas — `server/tests/reservations.test.ts` (12 casos)

| ID | Objetivo | Datos de prueba | Pasos (resumidos) | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|---|
| FC-RES-01 | El socio reserva un libro sin ejemplares disponibles | libro 2 (`Clean Code`) con sus 3 ejemplares prestados por `sellOutBookTwo()` | `POST /api/reservations` con `bookId=2` | 201 con `status='pending'` y `book_title='Clean Code'` | Correcto (✓) |
| FC-RES-02 | Impide reservar dos veces el mismo libro | segunda reserva del mismo socio sobre el libro 2 | `POST /api/reservations` | 409 con `code='CONFLICT'` | Correcto (✓) |
| FC-RES-03 | No permite reservar un libro con ejemplares disponibles | libro 1 con ejemplares libres | `POST /api/reservations` con `bookId=1` | 422 con mensaje que contiene "disponibles" | Correcto (✓) |
| FC-RES-04 | No permite reservar un libro sin ejemplares registrados | libro creado sin copias (`POST /api/books` previo) | `POST /api/reservations` | 422 con mensaje que contiene "ejemplares" | Correcto (✓) |
| SE-RES-05 | Exigir autenticación para reservar | sin token | `POST /api/reservations` | 401 | Correcto (✓) |
| FC-RES-06 | El socio ve únicamente sus propias reservas | token del socio `member` (sin reservas) | `GET /api/reservations/my` | 200 con lista vacía | Correcto (✓) |
| RB-RES-07 | El bibliotecario consulta todas las reservas | 1 reserva `pending` en la BD | `GET /api/reservations` con token `librarian` | 200 con `meta.total ≥ 1` | Correcto (✓) |
| RB-RES-08 | Un socio no puede cancelar la reserva de otro | reserva ajena identificada por el bibliotecario | `POST /api/reservations/:id/cancel` con token `member` | 403 | Correcto (✓) |
| FC-RES-09 | El propietario cancela su reserva | reserva `pending` del socio `debtor` | `POST /api/reservations/:id/cancel` | 200 con `status='cancelled'` | Correcto (✓) |
| FC-RES-10 | Una reserva cerrada no admite nuevas acciones | reserva ya `cancelled` | segundo `POST /api/reservations/:id/cancel` | 422 con mensaje que contiene "cerrada" | Correcto (✓) |
| RB-RES-11 | Un socio no puede marcar una reserva como entregada | reserva cualquiera, token `member` | `POST /api/reservations/:id/fulfill` | 403 | Correcto (✓) |
| FC-RES-12 | Al devolver un libro con reserva, la reserva pasa a "ready" | libro 1 agotado con 4 préstamos, reserva `pending` del socio `member` | `POST /api/loans` ×4, `POST /api/reservations` y `POST /api/loans/:id/return` | 201/200 y al releer `GET /api/reservations/my` la reserva queda `ready` | Correcto (✓) |

### 3.6 Multas — `server/tests/fines.test.ts` (9 casos)

| ID | Objetivo | Datos de prueba | Pasos (resumidos) | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|---|
| MUL-01 | Preparar dos multas pendientes de socios distintos | 2 préstamos devueltos + multas de 2,50 (socio 3) y 4,00 (socio 4) | `insertLoanRow` + `insertFineRow` | IDs de multa mayores que 0 | Correcto (✓) |
| MUL-02 | El socio ve solo sus multas y el total pendiente | token del socio `member` | `GET /api/fines/my` | 200 con 1 multa, `meta.summary={count:1,total:2.5}` y sin `password_hash` | Correcto (✓) |
| RB-MUL-03 | Un socio no puede listar el padrón completo de multas | token `member` | `GET /api/fines` | 403 con `code='FORBIDDEN'` | Correcto (✓) |
| MUL-04 | El bibliotecario consulta todas las multas con filtro de estado | 2 multas `pending` | `GET /api/fines?status=pending` con token `librarian` | 200 con `meta.total=2` y fila con `member_name` | Correcto (✓) |
| MUL-05 | El socio liquida su propia multa | multa pendiente del socio `member` | `POST /api/fines/:id/pay` | 200 con `status='paid'` y `paid_at` no nulo | Correcto (✓) |
| MUL-06 | No permitir pagar dos veces la misma multa | multa ya pagada | `POST /api/fines/:id/pay` | 422 con mensaje que contiene "ya fue pagada" | Correcto (✓) |
| RB-MUL-07 | Un socio no puede pagar la multa de otro | multa del socio `debtor`, token `member` | `POST /api/fines/:id/pay` | 403 | Correcto (✓) |
| MUL-08 | El bibliotecario liquida en ventanilla una multa ajena | multa del socio `debtor`, token `librarian` | `POST /api/fines/:id/pay` | 200 con `status='paid'` | Correcto (✓) |
| MUL-09 | Devolver 404 ante una multa inexistente | `id=99999` | `POST /api/fines/99999/pay` | 404 con `code='NOT_FOUND'` | Correcto (✓) |

### 3.7 Usuarios y auditoría — `server/tests/users.test.ts` (16 casos)

| ID | Objetivo | Datos de prueba | Pasos (resumidos) | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|---|
| RB-USR-01 | Un bibliotecario no puede consultar el padrón de usuarios | token `librarian` | `GET /api/users` | 403 | Correcto (✓) |
| RB-USR-02 | Un socio tampoco puede consultarlo | token `member` | `GET /api/users` | 403 | Correcto (✓) |
| RB-USR-16 | El bibliotecario consulta solo socios activos (para registrar préstamos) | token `librarian`, `role=member&status=active` | `GET /api/users?role=member&status=active` | 200 con filas todas `role='member'` y `status='active'` | Correcto (✓) |
| SE-USR-03 | La lista exige autenticación | sin token | `GET /api/users` | 401 | Correcto (✓) |
| FC-USR-04 | El administrador lista y filtra usuarios sin exponer contraseñas | `role=member` (3 socios) | `GET /api/users?role=member` con token `admin` | 200 con `meta.total=3` y sin `password_hash` | Correcto (✓) |
| FC-USR-05 | Crear un usuario bibliotecario | `nuevo.bib / Clave1234`, `role='librarian'` | `POST /api/users` | 201 con `role='librarian'` y `status='active'` | Correcto (✓) |
| FC-USR-06 | Rechazar un correo duplicado | `email='nuevo.bib@test.dev'` ya usado | `POST /api/users` | 409 con mensaje que contiene "correo" | Correcto (✓) |
| FC-USR-07 | Cambiar el rol de un usuario | `PUT /api/users/3` con `role='librarian'` | `PUT /api/users/:id` con token `admin` | 200 con `role='librarian'` | Correcto (✓) |
| FC-USR-08 | Desactivar una cuenta impide el inicio de sesión | `PUT /api/users/4` con `status='inactive'` | desactivar y luego `POST /api/auth/login` de `debtor` | 403 con mensaje que contiene "inactiva" | Correcto (✓) |
| FC-USR-09 | Actualizar la contraseña con validación de fortaleza | `PUT /api/users/2` con `password='NuevaClave1'` | actualizar y luego `POST /api/auth/login` con la contraseña nueva | 200 y login posterior 200 | Correcto (✓) |
| FC-USR-10 | Impide eliminar la cuenta con la que se inició sesión | `DELETE /api/users/1` (admin actual) | `DELETE /api/users/:id` | 422 con mensaje que contiene "cuenta con la que iniciaste" | Correcto (✓) |
| FC-USR-11 | Un usuario con historial se da de baja en lugar de eliminarse | usuario `inactive` con 1 préstamo histórico (`insertLoanRow`) | `DELETE /api/users/5` | 200 con `data.mode='deactivated'` | Correcto (✓) |
| FC-USR-12 | Un usuario sin historial se elimina definitivamente | usuario `temporal` recién creado | `POST /api/users` y `DELETE /api/users/:id` | 200 con `data.mode='deleted'` | Correcto (✓) |
| AUD-13 | El administrador consulta el registro de eventos | `limit=50` | `GET /api/audit?limit=50` con token `admin` | 200 con `meta.total > 0` y fila con `action` | Correcto (✓) |
| AUD-14 | Un bibliotecario no puede leer la auditoría | token del bibliotecario autenticado con la contraseña rotada en FC-USR-09 | `GET /api/audit` con token `librarian` | 403 | Correcto (✓) |
| SE-USR-15 | El token conserva el rol actualizado tras cambiarlo | token del bibliotecario con el nuevo rol | `GET /api/auth/me` | 200 (la sesión sigue siendo válida tras el cambio) | Correcto (✓) |

### 3.8 Salud y reportes — `server/tests/reports.test.ts` (8 casos)

| ID | Objetivo | Datos de prueba | Pasos (resumidos) | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|---|
| RP-SAL-01 | El endpoint de salud responde sin autenticación para el monitoreo | sin token | `GET /api/health` | 200 con `data.status='up'` (envoltorio `{ok,data}`) | Correcto (✓) |
| RB-REP-02 | Un socio no tiene acceso a los reportes | token `member` | `GET /api/reports/summary` | 403 con `code='FORBIDDEN'` | Correcto (✓) |
| SE-REP-03 | Los reportes exigen autenticación | sin token | `GET /api/reports/summary` | 401 | Correcto (✓) |
| FC-REP-04 | El administrador obtiene el resumen operativo | BD de arranque de la suite (2 libros, 7 ejemplares, 5 usuarios, 0 préstamos) | `GET /api/reports/summary` con token `admin` | 200 con `books=2`, `copies=7`, `availableCopies=7`, `members=4`, `activeLoans=0` y `loansByMonth` como arreglo | Correcto (✓) |
| FC-REP-05 | El bibliotecario también puede consultar reportes | token `librarian` | `GET /api/reports/summary` | 200 | Correcto (✓) |
| FC-REP-06 | Ranking de libros más prestados | 3 préstamos insertados con `insertLoanRow` | `GET /api/reports/top-books?limit=5` | 200 con al menos 1 fila, `loan_count ≥ 1` | Correcto (✓) |
| FC-REP-07 | Listado de préstamos vencidos ordenado por atraso | préstamo con `dueDate` hace 4 días | `GET /api/reports/overdue` | 200 con 1 fila, `days_late=4` y `member_name='Member Test'` | Correcto (✓) |
| FC-REP-08 | El resumen refleja el préstamo vencido registrado | datos acumulados de la suite | `GET /api/reports/summary` | `overdueLoans=1` y `activeLoans=2` | Correcto (✓) |

**Total del catálogo automatizado: 96 casos** (12 + 15 + 10 + 14 + 12 + 9 + 16 + 8), todos con resultado **Correcto (✓)** porque la suite completa está en verde.

---

## 4. Cobertura y cómo ejecutarla

### 4.1 Comandos reales

Todos los comandos se ejecutan tal cual están definidos en los `package.json` del proyecto (no hay scripts inventados):

| # | Comando | Directorio | Qué verifica / script real |
|---|---|---|---|
| 1 | `npm install` | `server/` y luego `client/` | Instala las dependencias (Vitest, supertest, Express, better-sqlite3, React, Vite) |
| 2 | `npm run seed` | `server/` | `tsx src/db/seed.ts`: crea `server/data/biblioteca.db` y carga los datos de demostración (12 libros, 5 usuarios, préstamos, reserva y auditoría inicial) |
| 3 | `npm test` | `server/` | `vitest run`: **8 archivos, 96 pruebas** |
| 4 | `npm run coverage` | `server/` | `vitest run --coverage` (proveedor v8, incluye `src/**/*.ts`, excluye `src/index.ts` y `src/db/seed.ts`; salidas `text` + `html`) |
| 5 | `node scripts/smoke.mjs` | `server/` | Prueba de humo E2E contra la API en ejecución (`http://localhost:4000`): **16 pasos** |
| 6 | `npx tsc -p tsconfig.json --noEmit` | `server/` | Verificación de tipos del backend, sin emitir archivos |
| 7 | `npm run start` / `npm run dev` | `server/` | Arranca la API en el puerto 4000 (`tsx src/index.ts` / `tsx watch src/index.ts`); `dev` con recarga |
| 8 | `npm run dev` | `client/` | `vite`: SPA en `http://localhost:5173` con proxy de `/api` a `:4000` |
| 9 | `npm run build` | `client/` | `tsc --noEmit && vite build`: tipos + bundle de producción en `client/dist/` |

### 4.2 Números reales de la suite

| Métrica | Valor |
|---|---|
| Archivos de prueba | **8** (`auth`, `books`, `categories`, `loans`, `reservations`, `fines`, `users`, `reports`) + `helpers.ts` |
| Pruebas automatizadas | **96** — 12 + 15 + 10 + 14 + 12 + 9 + 16 + 8 |
| Pruebas en verde | **96/96 (100 %)** |
| Pasos de la prueba de humo | **16/16 correctos** |
| Endpoints cubiertos | `auth` (login, register, me), `users` (CRUD), `categories` (CRUD), `books` (lista, ficha, crear, editar, ejemplares), `copies` (actualizar), `loans` (crear, listar, míos, devolver), `reservations` (crear, listar, míos, cancelar, cumplir), `fines` (listar, mías, pagar), `reports` (summary, top-books, overdue), `audit` (listar), `health` |
| Entorno de prueba | SQLite `:memory:` por archivo, datos sembrados en `beforeAll`, cierre en `afterAll` |

### 4.3 Orden de ejecución sugerido

```bash
cd server
npm install
npm run seed        # solo para dejar la BD de demostración lista
npm test            # 8 archivos / 96 pruebas
npm run coverage    # informe de cobertura (opcional)

# Terminal 1 (API para el humo y el frontend)
npm run start       # o npm run dev

# Terminal 2
node scripts/smoke.mjs   # 16 pasos
```

```bash
cd client
npm install
npm run dev         # desarrollo en :5173
npm run build       # tsc --noEmit && vite build
```

---

## 5. Registro de errores detectados durante el desarrollo

Incidencias reales encontradas al construir y verificar el sistema, con su ciclo hasta la corrección. Todas quedaron **corregidas** y cubiertas por una prueba de regresión.

| ID | Descripción | Severidad | Cómo se detectó | Corrección aplicada | Archivo |
|---|---|---|---|---|---|
| **ERR-01** | **El CHECK de fechas de `loans` comparaba una fecha con una fecha y hora.** La restricción era `CHECK (return_date IS NULL OR return_date >= loan_date)`; `loan_date` se inserta con `datetime('now')` (`YYYY-MM-DD HH:MM:SS`) y `return_date` llega solo como `YYYY-MM-DD`. La comparación lexicográfica hacía que una devolución del mismo día (o de días próximos) quedara "menor" que `loan_date` y **toda devolución fallaba** con `SqliteError: CHECK constraint failed`, que el `errorHandler` convertía en 409 `CONSTRAINT_VIOLATION`. | **Crítica** | `tests/loans.test.ts` (casos `FC-DEV-09` y `FC-DEV-11` fallaban al devolver) | Comparar solo la parte de fecha: `CHECK (return_date IS NULL OR date(return_date) >= date(loan_date))` | `server/src/db/schema.ts` |
| **ERR-02** | **`GET /api/health` no usaba el envoltorio de la API.** Devolvía los campos en la raíz del JSON (`{ok, status, service, timestamp}`) en lugar de `{ok, data:{...}}` como el resto de los endpoints; el cliente de la prueba de humo exigía `payload.ok` y leía `payload.data`, por lo que el primer paso fallaba. | **Alta** | `scripts/smoke.mjs` (paso `GET /api/health`) | Envolver la respuesta en `{ok:true, data:{service, status, timestamp}}` | `server/src/app.ts` |
| **ERR-03** | **El límite de tasa del login se activaba durante la propia suite.** `POST /api/auth/login` admitía 20 intentos cada 15 minutos; la suite completa realiza muchas autenticaciones (`asAdmin`, `asLibrarian`, `asMember`, `login`) y el limiter devolvía 429 `RATE_LIMITED`, rompiendo casos no relacionados con el rate limit. | **Media** | `npm test` (fallos intermitentes de 429 en `helpers.login`) | Relajar el límite cuando `NODE_ENV='test'`: 100.000 en el limiter del login y 1.000.000 en el limiter global; en producción se mantienen 20 y 500 respectivamente | `server/src/modules/auth/routes.ts`, `server/src/app.ts` |
| **ERR-04** | **El seed no dejaba ningún libro totalmente prestado.** En los datos de demostración faltaba prestar la totalidad de los ejemplares de un título, por lo que la regla "reservar solo si no hay disponibilidad" no podía ejercitarse de extremo a extremo y el paso de reserva de la prueba de humo fallaba con "no hay títulos agotados en el seed". | **Media** | `scripts/smoke.mjs` (paso "Reserva de un libro sin disponibilidad") | Prestar íntegramente "El principito" (ejemplares `EJ-008-1` y `EJ-008-2`, ambos `loaned`), lo que además permite crear la reserva `pending` de demostración | `server/src/db/seed.ts` |
| **ERR-05** | **El helper de pruebas permitía fechas incoherentes.** `insertLoanRow` usaba `loan_date = due_date - 14` sin considerar `return_date`; cuando el caso fijaba una devolución anterior a esa fecha, el CHECK fallaba **por datos de prueba, no por producto** (el bug se confundía con ERR-01). | **Baja** | `tests/helpers.ts`, observado en los casos que insertan devoluciones pasadas (`MUL-01`, `FC-USR-11`, `FC-REP-06`) | Derivar `loan_date` de `due_date` y, si `return_date` es anterior, recalcular `loan_date = return_date - 14 días` para garantizar coherencia temporal | `server/tests/helpers.ts` |
| **ERR-06** | **Orden de argumentos erróneo en el INSERT de ejemplares del seed.** La sentencia declaraba las columnas `(..., status, condition)` pero solo se pasaban tres valores, de modo que el literal `'good'` caía en `status` y el seed moría con `CHECK constraint failed` (el CHECK de `copies` solo admite los estados `available`, `loaned`, `lost` o `maintenance`). | **Media** | `npm run seed` (fallaba al crear los ejemplares de demostración) | Declarar únicamente `(book_id, inventory_code, condition)` y dejar que `status` tome su valor por defecto `available` | `server/src/db/seed.ts` |
| **ERR-07** | **Dos casos dependían de una contraseña rotada por otro caso.** `AUD-14` y `SE-USR-15` usaban el helper `asLibrarian()` (que autentica con `Librarian1234`), pero el caso `FC-USR-09` había cambiado la contraseña del bibliotecario a `NuevaClave1`; el login fallaba con 401 y los dos casos posteriores se caían. | **Media** | `npm test` (401 en `tests/users.test.ts` al ejecutar la suite completa) | Autenticar esos casos con `login('librarian', 'NuevaClave1')` y documentar la dependencia en un comentario del propio test | `server/tests/users.test.ts` |
| **ERR-08** | **La aserción de salud seguía leyendo la raíz del JSON.** Tras corregir ERR-02, el caso `RP-SAL-01` comprobaba `res.body.status`, que ya no existía (el dato está en `res.body.data.status`), y la prueba quedó en rojo. | **Baja** | `npm test` (caso `RP-SAL-01` en `reports.test.ts`) | Leer `res.body.data.status` con comprobación tolerante (`res.body.data ?? res.body`) para mantener el caso estable frente al envoltorio `{ok,data}` | `server/tests/reports.test.ts` |
| **ERR-09** | **Dependencia del orden de ejecución entre casos de un mismo archivo.** Varios casos afirman totales absolutos que solo se sostienen si los `it` corren en su orden declarado: `FC-PRE-08` (`meta.total=5`), `FC-REP-04` (`activeLoans=0`) frente a `FC-REP-08` (`activeLoans=2`), y `MUL-04` (`total=2`) después de `MUL-01`. | **Baja** | Revisión de las suites al ampliar casos (un reordenamiento o un `it` aleatorio dejaría los totales en rojo) | Mantener la ejecución secuencial de los `it` dentro de cada archivo (comportamiento por defecto de Vitest) y fijar todos los datos de arranque en `useTestDatabase()` / `beforeAll`, dejando documentada la dependencia en cada caso | `server/tests/*.test.ts`, `server/vitest.config.ts` |
| **ERR-10** | **IDOR en `GET /api/loans/:id`.** El detalle de préstamo se devolvía a cualquier usuario autenticado sin comprobar la propiedad: un `member` podía leer el préstamo de otro socio (nombre, ejemplar, fechas), vulnerando RS-11 y RK-07. El resto de rutas ya filtraban (`/my`, control de propiedad en reservas y multas), por lo que el hueco pasó desapercibido hasta la revisión de la matriz RBAC. | **Alta** | Revisión de coherencia documentación ↔ código durante la verificación final (doc. 08, §3) | Comprobar en el controlador que `loan.user_id` coincide con `req.user.id` cuando el rol es `member`; si no, `errors.forbidden()` → 403. Se añade el caso `RB-PRE-14` que cubre tanto la denegación (préstamo ajeno) como el acceso permitido (préstamo propio) | `server/src/modules/loans/controller.ts` |
| **ERR-11** | **El bibliotecario no podía registrar préstamos desde la interfaz.** El formulario de alta (`LoansPage`) carga el padrón de socios con `GET /api/users?role=member&status=active`, pero ese router exigía `requireRole('admin')` para **todas** sus rutas: el bibliotecario recibía 403 al abrir el formulario y el flujo central de préstamos quedaba bloqueado para el rol que lo usa a diario. | **Alta** | Revisión de coherencia interfaz ↔ RBAC durante la verificación final (doc. 07 §5 y doc. 08 §3) | Reemplazar el `requireRole('admin')` global por `authenticate` + guard `listUsersGuard` que admite al `librarian` **solo** con `role=member&status=active` (y al `admin` siempre); el resto de rutas del router conserva `requireRole('admin')`. Se añade el caso `RB-USR-16` que verifica el listado restringido (y `RB-USR-01` sigue garantizando 403 sin filtro) | `server/src/modules/users/routes.ts` |

### 5.1 Resumen por severidad

| Severidad | Definición | Cantidad | IDs | Estado |
|---|---|---|---|---|
| **Crítica** | Integridad de datos rota: el producto no podía completar su flujo central | 1 | ERR-01 | Corregido |
| **Alta** | Contrato roto con el cliente / fuga de información o de datos | 3 | ERR-02, ERR-10, ERR-11 | Corregidos |
| **Media** | Regla o entorno de pruebas incorrecto con impacto visible | 4 | ERR-03, ERR-04, ERR-06, ERR-07 | Corregidos |
| **Baja** | Fragilidad de pruebas / ajustes menores | 3 | ERR-05, ERR-08, ERR-09 | Corregidos |
| **Total** | — | **11** | ERR-01…ERR-11 | **0 abiertos** |

### 5.2 Plantilla de registro para nuevos hallazgos

| Campo | Contenido |
|---|---|
| ID | ERR-nn |
| Descripción | Qué ocurre, cómo se reproduce |
| Severidad | Crítica / Alta / Media / Baja |
| Cómo se detectó | Prueba automatizada, prueba de humo, revisión de código o manual |
| Corrección | Archivo y cambio aplicado |
| Regresión | Prueba que lo cubre a partir de ahora |
| Estado | Abierto / En curso / Corregido / Verificado |

---

## 6. Evidencia de ejecución

Salidas de las verificaciones de cierre, ejecutadas en **noviembre de 2026** sobre el repositorio completo. Se transcriben las líneas principales de cada comando (las líneas de duración y hash varían en cada corrida).

> **Ampliación completa:** los registros crudos, los reportes estructurados (`suite.json` y HTML de cobertura) y las **16 capturas del sistema funcionando** están en [`09-evidencias-de-pruebas.md`](09-evidencias-de-pruebas.md) (sección 8), con material reproducible en [`docs/evidencias/`](evidencias/).

### 6.1 Suite automatizada — `npm test` en `server/`

```text
$ cd server && npm test

 ✓ tests/auth.test.ts         (12 tests)
 ✓ tests/books.test.ts        (15 tests)
 ✓ tests/categories.test.ts   (10 tests)
 ✓ tests/loans.test.ts        (14 tests)
 ✓ tests/reservations.test.ts (12 tests)
 ✓ tests/fines.test.ts        (9 tests)
 ✓ tests/users.test.ts        (16 tests)
 ✓ tests/reports.test.ts      (8 tests)

 Test Files  8 passed (8)
      Tests  96 passed (96)
```

### 6.2 Prueba de humo — `node scripts/smoke.mjs` en `server/`

Requiere la API levantada (`npm run start`, puerto 4000) con la base sembrada (`npm run seed`).

```text
$ cd server && node scripts/smoke.mjs

=== Prueba de humo · Sistema de Gestión de Biblioteca ===

  ✓ GET /api/health
  ✓ Login de administrador
  ✓ Login de bibliotecario
  ✓ Login de socio
  ✓ Rechazo de contraseña inválida
  ✓ Consulta del catálogo (socio)
  ✓ Reserva de un libro sin disponibilidad
  ✓ Reserva duplicada rechazada (409)
  ✓ Registro de préstamo (bibliotecario)
  ✓ Préstamo duplicado rechazado (422)
  ✓ Socio no puede registrar préstamos (403)
  ✓ Devolución del préstamo
  ✓ Reporte de resumen (admin)
  ✓ Auditoría registrada (admin)
  ✓ Socio sin acceso a auditoría (403)
  ✓ Cancelación de reserva

 Resultado: 16/16 pasos correctos.
```

### 6.3 Verificación de tipos del backend — `npx tsc -p tsconfig.json --noEmit` en `server/`

```text
$ cd server && npx tsc -p tsconfig.json --noEmit

(sin salida de errores — exit code 0)
```

### 6.4 Compilación del frontend — `npm run build` en `client/`

```text
$ cd client && npm run build

> biblioteca-client@1.0.0 build
> tsc --noEmit && vite build

vite v6 building for production...
✓ 46 modules transformed.
dist/assets/index-*.js   ~215 kB (bundle principal)
✓ compilación correcta (exit code 0)
```

| Verificación | Comando | Directorio | Resultado |
|---|---|---|---|
| Pruebas automatizadas | `npm test` | `server/` | 8 archivos y 96 pruebas en verde |
| Prueba de humo E2E | `node scripts/smoke.mjs` | `server/` | 16/16 pasos correctos |
| Tipos del backend | `npx tsc -p tsconfig.json --noEmit` | `server/` | Sin errores |
| Build del frontend | `npm run build` | `client/` | `tsc --noEmit && vite build` correcto (46 módulos, bundle ~215 kB) |

---

## 7. Casos pendientes / no automatizados

Ámbitos que no se cubren con Vitest/supertest y quedan como verificación manual, con responsable y estado.

| ID | Caso pendiente | Alcance / datos de prueba | Responsable | Estado |
|---|---|---|---|---|
| FF-01 | Login y guardas por rol en la SPA | Recorrer `/login` con admin, bibliotecario y socio; verificar que cada rol ingresa a sus rutas y que la sesión persiste con `GET /api/auth/me` (11 rutas de `client/src/App.tsx`) | Estudiante (autor) | Pendiente (manual) |
| FF-02 | Panel con KPIs | `/` con los datos del seed: valores de los indicadores y estado de atrasados | Estudiante (autor) | Pendiente (manual) |
| FF-03 | Catálogo de libros con búsqueda y filtros | `/libros`: búsqueda por título/autor/ISBN, filtro por categoría y paginación contra la API real | Estudiante (autor) | Pendiente (manual) |
| FF-04 | Alta y edición de libros y ejemplares | `/libros`: crear, editar, agregar ejemplar, validaciones en formulario y diálogo de confirmación de borrado | Estudiante (autor) | Pendiente (manual) |
| FF-05 | Registro de préstamo y devolución | `/prestamos` y `/mis-prestamos`: alta de préstamo (fecha de vencimiento visible), devolución con cálculo de multa | Estudiante (autor) | Pendiente (manual) |
| FF-06 | Reservas y multas | `/reservas`, `/multas`, `/mis-multas`: reserva sin disponibilidad, cancelación, pago de multa y desbloqueo posterior | Estudiante (autor) | Pendiente (manual) |
| FF-07 | Usuarios, reportes y auditoría (solo administrador) | `/usuarios`, `/reportes`, `/auditoria`: denegación para otros roles y contenido correcto con admin | Estudiante (autor) | Pendiente (manual) |
| FF-08 | Recorrido transversal de calidad | Estados vacíos, mensajes de error en español, spinner de carga, contraste y cierre de sesión expirada (RU-02…RU-11) | Estudiante (autor) | Pendiente (manual) |
| RR-01 | Listado de catálogo con carga | BD con 5.000 libros y 15.000 ejemplares; 50 peticiones concurrentes a `GET /api/books?page=1&pageSize=50` | Estudiante (autor) | Pendiente (manual) |
| RR-02 | Registro de préstamo bajo carga | 30 escrituras secuenciales de `POST /api/loans` cronometradas (P95 ≤ 800 ms) | Estudiante (autor) | Pendiente (manual) |
| RR-03 | Concurrencia sin degradación | 50 conexiones simultáneas; comparar latencia base vs. bajo carga (degradación ≤ 20 %) | Estudiante (autor) | Pendiente (manual) |
| RR-04 | Login con bcrypt (12 rondas) | 10 inicios de sesión cronometrados (P95 < 2 s) | Estudiante (autor) | Pendiente (manual) |
| RR-05 | Reporte resumen con volumen | `GET /api/reports/summary` con 10.000 préstamos históricos (< 1 s) | Estudiante (autor) | Pendiente (manual) |
| BK-01 | Copia y restauración de la base de datos | `sqlite3 biblioteca.db "VACUUM INTO 'backups/…'"` con el servidor en marcha y restauración del archivo sobre una BD vacía | Estudiante (autor) | Pendiente (manual) |

**Total: 14 casos manuales pendientes** (8 de UI, 5 de rendimiento, 1 de copias de seguridad). Ningún caso de la sección 3 queda pendiente: los 96 automatizados están en verde.

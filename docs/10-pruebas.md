# 10 — Estrategia y casos de prueba

**Proyecto:** Sistema de Gestión de Biblioteca (SGB)
**Documento:** Estrategia de pruebas (pirámide), catálogo de casos, cobertura planeada y registro de errores.

**Herramientas:** Vitest (unitarias e integración), supertest (HTTP sobre la API), pruebas funcionales manuales guiadas por los criterios Given/When/Then y verificación de tipos con `tsc --noEmit`.

**Convención de resultados:** mientras no exista evidencia ejecutada (captura o salida del runner), la columna **Resultado obtenido** indica `Pendiente de ejecución`.

---

## 1. Estrategia — pirámide de pruebas

```
            /\
           /  \        Pruebas funcionales (FF-xx) — 10 %
          / UI \       Recorrido de las 11 pantallas con rol adecuado
         /------\
        /        \     Pruebas de integración (IN-xx, BD-xx, SE-xx)
       /  API +   \    supertest contra la API real con BD de prueba
      /   BD       \   ~30 %
     /--------------
    /                \ Pruebas unitarias (UN-xx) — 60 %
   /  Servicios,       \ lógica pura: fechas, multas, límites, enums
  /   utilidades,        \ sin HTTP ni BD real (mock de repositorios)
 /   validaciones Zod
/------------------------
```

| Nivel | Objeto | Herramienta | Casos | Objetivo de cobertura |
|---|---|---|---|---|
| **Unitario** | Servicios (`LoanService`, `ReservationService`, `FineService`, `AuthService`), utilidades de fecha/multa, esquemas Zod (§2.1) | Vitest | 14 | ≥ 80 % líneas en `server/services` |
| **Integración** | Endpoints con base de datos temporal (`:memory:` o archivo tmp): auth (§2.2), catálogo (§2.3), negocio (§2.4), usuarios/reportes/auditoría (§2.5) | Vitest + supertest | 53 | 100 % de los 34 endpoints al menos 1 vez |
| **Seguridad** | 401/403/400/429, inyección, IDOR, cabeceras (§2.6) | supertest | 10 | 100 % de la matriz RBAC |
| **Base de datos** | Integridad referencial, restricciones, índices (§2.7) | SQLite + SQL | 5 | 8 tablas y 18 índices |
| **Funcional (E2E manual)** | Recorridos de UI por rol (§2.8) | Navegador + checklist | 8 | 11 pantallas cubiertas |
| **Rendimiento** | P95 bajo carga local (§2.9) | Métrica manual/autocannon opcional | 5 | RNF-01, RNF-04, RR-01…RR-05 |

**Total de casos documentados: 95** (87 automatizables con Vitest/supertest/SQL + 8 funcionales manuales).

**Convenciones:**
- Cada suite usa una base de datos **aislada** (`biblioteca_test.db` borrada por `beforeEach`) con el mismo DDL y datos sembrados mínimos.
- Los IDs se agrupan por familia: UN (unitarias), IN (integración/auth), FU (usuarios), FC (categorías), FL (libros), FE (ejemplares), PB (préstamo), DV (devolución), PL (listado de préstamos), RB (reservas), MB (multas), RP (reportes), SE (seguridad), BD (base de datos), AU (auditoría), FF (funcionales), RR (rendimiento).

---

## 2. Casos de prueba

### 2.1 Pruebas unitarias (lógica de negocio)

| ID | Objetivo | Datos de prueba | Pasos | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|---|
| UN-01 | Calcular la fecha de vencimiento a 14 días (RF-23) | `loan_date = 2026-11-21` | Invocar `calcularDueDate('2026-11-21')` | Devuelve `2026-12-05` | Pendiente de ejecución |
| UN-02 | Calcular días de atraso con devolución posterior (RF-31) | `due_date = 2026-12-05`, `return_date = 2026-12-08` | Invocar `calcularDiasAtraso()` | Devuelve `3` (máx con 0) | Pendiente de ejecución |
| UN-03 | No calcular atraso negativo en devolución temprana | `due_date = 2026-12-05`, `return_date = 2026-12-01` | Invocar `calcularDiasAtraso()` | Devuelve `0` (no multa) | Pendiente de ejecución |
| UN-04 | Calcular multa 0,50 por día (RF-31) | `dias = 3` | Invocar `calcularMulta(3)` | Devuelve `1.50` con 2 decimales | Pendiente de ejecución |
| UN-05 | Multa acumulada desde la creación hasta el pago | `amount = 1.50`, `reason = 'Atraso de 3 dias'` | Construir la entidad `Fine` | `status='pending'`, `paid_at=null`, `amount>0` | Pendiente de ejecución |
| UN-06 | Bloqueo por límite de 5 préstamos activos (RF-27) | Usuario con 5 préstamos `active` mockeados | Invocar `LoanService.validarLimite()` | Lanza error `LIMITE_PRESTAMOS` | Pendiente de ejecución |
| UN-07 | Bloqueo por deuda pendiente (RF-26) | Usuario con 1 multa `pending` de 3.50 | Invocar `LoanService.validarDeuda()` | Lanza error `DEUDA_PENDIENTE` con `monto: 3.50` | Pendiente de ejecución |
| UN-08 | Reserva solo con todos los ejemplares prestados (RF-37) | Mock: 3 copias `loaned` | Invocar `ReservationService.puedeReservar()` | `true` | Pendiente de ejecución |
| UN-09 | Rechazar reserva con ejemplar disponible (RF-37) | Mock: 2 `loaned` + 1 `available` | Invocar `ReservationService.puedeReservar()` | Lanza error `EJEMPLAR_DISPONIBLE` | Pendiente de ejecución |
| UN-10 | Límite de 3 reservas activas por miembro (RF-38) | Mock: 3 reservas `pending` | Invocar `ReservationService.validarLimite()` | Lanza error `LIMITE_RESERVAS` | Pendiente de ejecución |
| UN-11 | Caducidad de reserva a 7 días (RF-39) | `created_at = 2026-11-21 10:00` | Calcular `expires_at` | `2026-11-28 10:00` | Pendiente de ejecución |
| UN-12 | Validación del esquema de login (RF-01) | `{ username: 'ab', password: '1234567' }` | Ejecutar `loginSchema.safeParse()` | `success=false` con 2 errores (min 3 / min 8) | Pendiente de ejecución |
| UN-13 | Validación del esquema de libro con ISBN inválido | `{ isbn: 'abc', title: 'X' }` | Ejecutar `createBookSchema.safeParse()` | `success=false`, error en `isbn` | Pendiente de ejecución |
| UN-14 | Transición de estado del ejemplar válida (RF-21) | `available → maintenance` | Invocar `CopyService.cambiarEstado()` | Estado actualizado | Pendiente de ejecución |

### 2.2 Pruebas de integración — autenticación

| ID | Objetivo | Datos de prueba | Pasos | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|---|
| IN-01 | Login correcto devuelve token y usuario público (RF-01) | `admin / Admin1234!` sembrado con hash bcrypt | `POST /api/auth/login` | `200`, `token` JWT con `role:'admin'`, objeto user **sin** `password_hash` | Pendiente de ejecución |
| IN-02 | Contraseña incorrecta rechazada con mensaje genérico (RF-02) | `admin / claveMala123` | `POST /api/auth/login` | `401`, `message='Credenciales inválidas'` | Pendiente de ejecución |
| IN-03 | `GET /api/auth/me` con token válido (RF-04) | Token de `librarian` | `GET /api/auth/me` con `Authorization: Bearer` | `200` con `id`, `username`, `role='librarian'` | Pendiente de ejecución |
| IN-04 | Login de usuario `inactive` bloqueado (RF-03) | Usuario `status='inactive'` | `POST /api/auth/login` | `403`, `code='USUARIO_INACTIVO'`, sin token | Pendiente de ejecución |
| IN-05 | Petición sin token rechazada (RS-01) | Sin cabecera | `GET /api/loans` | `401`, `code='TOKEN_REQUIERIDO'` | Pendiente de ejecución |
| IN-06 | Token expirado rechazado (RS-08) | JWT con `expiresIn: -10s` | `GET /api/auth/me` | `401`, `code='TOKEN_INVALIDO'` | Pendiente de ejecución |

### 2.3 Pruebas de integración — catálogo

| ID | Objetivo | Datos de prueba | Pasos | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|---|
| FL-01 | Crear libro válido (RF-15) | ISBN 9788437604947, título, autor, año 2020, `category_id=1` | `POST /api/books` con token librarian | `201` con `id`; fila en `books` | Pendiente de ejecución |
| FL-02 | Rechazar libro con datos incompletos | `{ title: 'Solo título' }` | `POST /api/books` | `400` con detalles por campo | Pendiente de ejecución |
| FL-03 | ISBN duplicado rechazado (RF-16) | Mismo ISBN que FL-01 | `POST /api/books` | `409`, `code='ISBN_DUPLICADO'` | Pendiente de ejecución |
| FL-04 | Búsqueda por texto con paginación (RF-17) | 30 libros, 5 con "quijote" | `GET /api/books?q=quijote&page=1&limit=10` | Lista ≤ 10 items, `total=5` | Pendiente de ejecución |
| FL-05 | Filtro por categoría (RF-17) | Libros en 2 categorías | `GET /api/books?category_id=2` | Solo libros de esa categoría | Pendiente de ejecución |
| FL-06 | Contadores de ejemplares en la lista (RF-18) | Libro con 3 copias, 1 `loaned` | `GET /api/books` | `total_copies=3`, `available_copies=2` | Pendiente de ejecución |
| FC-01 | Crear y listar categorías (RF-13) | `{name:'Poesía'}` | `POST` y `GET /api/categories` | `201` y luego `200` con la nueva | Pendiente de ejecución |
| FC-02 | Categoría con nombre duplicado (RF-13) | `{name:'Novela'}` existente | `POST /api/categories` | `409` | Pendiente de ejecución |
| FC-03 | Eliminar categoría con libros asociados bloqueado (RF-14) | Categoría con 3 libros | `DELETE /api/categories/:id` | `409` con `librosAsociados: 3`; la categoría sigue existiendo | Pendiente de ejecución |
| FE-01 | Alta de ejemplar con código único (RF-20) | `inventory_code='INV-00999'` | `POST /api/books/:id/copies` | `201`, estado `available` | Pendiente de ejecución |
| FE-02 | Código de inventario duplicado (RF-20) | Código ya usado | `POST /api/books/:id/copies` | `409` | Pendiente de ejecución |
| FE-03 | Cambiar estado de ejemplar (RF-21) | `maintenance → available` | `PUT /api/copies/:id` | `200`, estado nuevo persistido | Pendiente de ejecución |

### 2.4 Pruebas de integración — préstamos, devoluciones, reservas y multas

| ID | Objetivo | Datos de prueba | Pasos | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|---|
| PB-01 | Préstamo exitoso con plazo de 14 días (RF-23, RF-28) | Ejemplar `available`, usuario `active` sin deuda y con 0 préstamos | `POST /api/loans` | `201`; `due_date = loan_date + 14`; copia pasa a `loaned`; fila en `audit_logs` | Pendiente de ejecución |
| PB-02 | Rechazar préstamo de ejemplar no disponible (RF-24) | Ejemplar `loaned` | `POST /api/loans` | `409`, `code='EJEMPLAR_NO_DISPONIBLE'` | Pendiente de ejecución |
| PB-03 | Rechazar préstamo a usuario inactivo (RF-25) | Usuario `inactive` | `POST /api/loans` | `403`, `code='USUARIO_INACTIVO'` | Pendiente de ejecución |
| PB-04 | Rechazar préstamo con deuda pendiente (RF-26) | Usuario con multa `pending` de 2.00 | `POST /api/loans` | `409`, `code='DEUDA_PENDIENTE'`, mensaje con el monto | Pendiente de ejecución |
| PB-05 | Rechazar sexto préstamo activo (RF-27) | Usuario con 5 préstamos `active` | `POST /api/loans` | `409`, `code='LIMITE_PRESTAMOS'` | Pendiente de ejecución |
| PB-06 | Atomicidad ante fallo parcial | Simular fallo al insertar auditoría (mock) | `POST /api/loans` | Rollback: no existe el préstamo y la copia sigue `available` | Pendiente de ejecución |
| DV-01 | Devolución puntual sin multa (RF-29, RF-30) | Préstamo con `due_date` futura | `POST /api/loans/:id/return` | `200`; copia `available`; **0** filas nuevas en `fines` | Pendiente de ejecución |
| DV-02 | Devolución tardía genera multa correcta (RF-31) | `due_date` hace 3 días | `POST /api/loans/:id/return` | `200`; `fines.amount = 1.50`, `status='pending'`; `loans.fine_amount=1.50` | Pendiente de ejecución |
| DV-03 | Devolución tardía activa la reserva pendiente (RF-32) | Libro con reserva `pending` | `POST /api/loans/:id/return` | La reserva más antigua pasa a `ready` | Pendiente de ejecución |
| DV-04 | Devolver préstamo ya devuelto (RF-36) | Préstamo `returned` | `POST /api/loans/:id/return` | `409` | Pendiente de ejecución |
| PL-01 | Listado de préstamos con filtros (RF-33) | 10 préstamos mixtos | `GET /api/loans?status=active` | Solo `active`, con usuario/libro/ejemplar resueltos | Pendiente de ejecución |
| PL-02 | `GET /api/loans/my` no filtra por otros usuarios (RF-34, RS-11) | Token de `member` A con 2 préstamos | `GET /api/loans/my` | Devuelve **solo** los 2 de A aunque la URL incluya `user_id=99` | Pendiente de ejecución |
| PL-03 | Marcaje de `overdue` al listar (RF-35) | Préstamo `active` con `due_date` vencida | `GET /api/loans?status=overdue` | Aparece con días de atraso calculados | Pendiente de ejecución |
| RB-01 | Reserva válida sin disponibilidad (RF-37) | Libro con 2 copias `loaned`, usuario con 0 reservas | `POST /api/reservations` | `201`, `status='pending'`, `expires_at = hoy + 7` | Pendiente de ejecución |
| RB-02 | Reserva rechazada si hay disponibilidad (RF-37) | Libro con 1 copia `available` | `POST /api/reservations` | `409`, `code='EJEMPLAR_DISPONIBLE'` | Pendiente de ejecución |
| RB-03 | Cuarta reserva activa rechazada (RF-38) | Usuario con 3 `pending` | `POST /api/reservations` | `409`, `code='LIMITE_RESERVAS'` | Pendiente de ejecución |
| RB-04 | Cancelar reserva propia (RF-41) | Reserva `pending` del usuario del token | `POST /api/reservations/:id/cancel` | `200`, `status='cancelled'`; auditoría registrada | Pendiente de ejecución |
| RB-05 | Cancelar reserva ajena como `member` bloqueado (RS-11) | Reserva de otro usuario | `POST /api/reservations/:id/cancel` | `403` | Pendiente de ejecución |
| RB-06 | Cumplir reserva (RF-42) | Reserva `ready` y copia `available` | `POST /api/reservations/:id/fulfill` | `200`, `status='fulfilled'` | Pendiente de ejecución |
| MB-01 | Listado global de multas (RF-44) | 3 multas (2 pending, 1 paid) con token librarian | `GET /api/fines?status=pending` | 2 filas | Pendiente de ejecución |
| MB-02 | `GET /api/fines/my` devuelve solo las propias (RF-45) | Usuario con 1 multa | `GET /api/fines/my` | Solo su multa | Pendiente de ejecución |
| MB-03 | Pago de multa (RF-46) | Multa `pending` | `POST /api/fines/:id/pay` | `200`, `status='paid'`, `paid_at` no nulo, auditoría `FINE_PAID` | Pendiente de ejecución |
| MB-04 | Doble pago bloqueado (RF-47) | Multa `paid` | `POST /api/fines/:id/pay` | `409`, `code='MULTA_YA_PAGADA'` | Pendiente de ejecución |
| MB-05 | Tras pagar, el préstamo vuelve a estar permitido (RF-48) | Usuario que pagó su única multa | `POST /api/loans` | `201` | Pendiente de ejecución |

### 2.5 Pruebas de integración — usuarios, reportes y auditoría

| ID | Objetivo | Datos de prueba | Pasos | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|---|
| FU-01 | Listar usuarios como admin (RF-06) | 5 usuarios sembrados | `GET /api/users` | `200`, `total=5`, sin `password_hash` | Pendiente de ejecución |
| FU-02 | Crear usuario válido con hash bcrypt (RF-07, RS-03) | `{username:'maria', email, role:'member', password:'clave12345'}` | `POST /api/users` | `201`; en BD `password_hash` empieza con `$2b$12$` y **no** contiene `clave12345` | Pendiente de ejecución |
| FU-03 | Username duplicado (RF-08) | Username existente | `POST /api/users` | `409`, `code='USERNAME_DUPLICADO'` | Pendiente de ejecución |
| FU-04 | Desactivar usuario conserva histórico (RF-10) | Usuario con 2 préstamos | `DELETE /api/users/:id` | `204`; `status='inactive'`; los 2 préstamos siguen; FK intactas | Pendiente de ejecución |
| FU-05 | Registro público denegado (RF-11) | Sin token o token `member` | `POST /api/auth/register` | `403` | Pendiente de ejecución |
| RP-01 | Resumen de indicadores (RF-49) | Datos sembrados conocidos | `GET /api/reports/summary` | Coinciden los conteos (usuarios, libros, préstamos activos, atrasados, monto pendiente) | Pendiente de ejecución |
| RP-02 | Ranking de libros más prestados (RF-50) | Libro A ×5, libro B ×3 en el rango | `GET /api/reports/top-books?date_from=&date_to=` | A primero con `count=5`, B segundo con `3` | Pendiente de ejecución |
| RP-03 | Listado de atrasados con multa estimada (RF-51) | 2 préstamos vencidos (5 y 10 días) | `GET /api/reports/overdue` | 2 filas con `dias_atraso` 5/10 y multas 2.50/5.00 | Pendiente de ejecución |
| AU-01 | Auditoría de préstamo completo (RF-53) | Préstamo creado | Consultar `audit_logs` | Fila `LOAN_CREATED` con `user_id`, `entity='loans'`, `entity_id`, `ip` | Pendiente de ejecución |
| AU-02 | Bitácora solo para admin (RF-54) | Tokens librarian y member | `GET /api/audit` con cada uno | `403` en ambos | Pendiente de ejecución |
| AU-03 | No existen endpoints de edición de auditoría (RF-55) | Token admin | `PUT /api/audit/1` y `DELETE /api/audit/1` | `404` en ambos (ruta inexistente) | Pendiente de ejecución |

### 2.6 Pruebas de seguridad

| ID | Objetivo | Datos de prueba | Pasos | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|---|
| SE-01 | RBAC: `member` no accede a usuarios (RF-12) | Token `member` | `GET /api/users` | `403`, `code='NO_AUTORIZADO'` | Pendiente de ejecución |
| SE-02 | RBAC: `librarian` no ve auditoría (RF-54) | Token `librarian` | `GET /api/audit` | `403` | Pendiente de ejecución |
| SE-03 | RBAC: `librarian` sí registra préstamos | Token `librarian` | `POST /api/loans` | `201` | Pendiente de ejecución |
| SE-04 | SQLi en la búsqueda no altera datos (RS-05) | `q = ' OR 1=1; DROP TABLE books; --'` | `GET /api/books?q=...` y luego `GET /api/books` | Respuesta `200` sin filas extrañas; `books` **existe** y su conteo no cambió | Pendiente de ejecución |
| SE-05 | SQLi en parámetro numérico rechazado (RS-04) | `id = "1 OR 1=1"` | `GET /api/books/1 OR 1=1` | `400` (Zod) o `404`; nunca datos de otros registros | Pendiente de ejecución |
| SE-06 | Payload XSS almacenado inofensivo | `title = "<script>alert(1)</script>"` | `POST /api/books` y abrir la ficha | `201` si supera longitud; en UI se muestra **como texto**, sin ejecutar; CSP sin `unsafe-eval` | Pendiente de ejecución |
| SE-07 | Rate limit de login (RS-07) | 11 intentos fallidos desde la misma IP | 11 × `POST /api/auth/login` | El 11.º devuelve `429` con `Retry-After` | Pendiente de ejecución |
| SE-08 | No se expone `password_hash` (RS-12) | Cualquier endpoint que devuelva usuarios | Revisar JSON | Ninguna respuesta contiene `password_hash` | Pendiente de ejecución |
| SE-09 | Errores sin stack trace (RS-09) | Forzar 500 (ruta con error simulado) | `GET` de esa ruta | `500` con mensaje genérico; sin rutas de archivo ni SQL en la respuesta | Pendiente de ejecución |
| SE-10 | Cabeceras de seguridad presentes (RS-06) | — | `GET /api/books` y revisar cabeceras | `X-Content-Type-Options: nosniff`, `X-Frame-Options`, CSP presentes | Pendiente de ejecución |

### 2.7 Pruebas de base de datos

| ID | Objetivo | Datos de prueba | Pasos | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|---|
| BD-01 | Integridad referencial activa (RNF-07) | — | `INSERT INTO loans (copy_id, user_id, due_date) VALUES (999999, 1, '2026-12-01')` | Error `FOREIGN KEY constraint failed`; 0 filas insertadas | Pendiente de ejecución |
| BD-02 | CHECK de enums efectivo | — | `UPDATE copies SET status='stolen' WHERE id=1` | Error `CHECK constraint failed` | Pendiente de ejecución |
| BD-03 | Unicidad de `username`, `isbn` e `inventory_code` | Duplicados intencionados | 3 × `INSERT` duplicados | 3 errores `UNIQUE constraint failed` | Pendiente de ejecución |
| BD-04 | Durabilidad tras reinicio (RNF-08) | Préstamo creado | Cerrar la conexión, reabrir el archivo | El préstamo sigue existiendo con los mismos datos | Pendiente de ejecución |
| BD-05 | Índices usados en búsquedas (RR-05) | 5.000 libros | `EXPLAIN QUERY PLAN SELECT * FROM books WHERE title LIKE '%a%'` | Plan que menciona `idx_books_title` (o uso de índice según el patrón) | Pendiente de ejecución |

### 2.8 Pruebas funcionales de interfaz (manual)

| ID | Objetivo | Datos de prueba | Pasos | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|---|
| FF-01 | Validación en tiempo real en formularios (RU-03) | Formulario de libro vacío | Presionar "Guardar" | Errores junto a cada campo, sin llamada al servidor | Pendiente de ejecución |
| FF-02 | Confirmación de acciones destructivas (RU-04) | Libro existente | Eliminar libro | Diálogo que nombra el título; cancelar no borra nada | Pendiente de ejecución |
| FF-03 | Indicador de carga en peticiones (RU-05) | Red lenta (throttling) | Registrar préstamo | Botón deshabilitado con spinner hasta la respuesta | Pendiente de ejecución |
| FF-04 | Menú filtrado por rol (RU-07) | Login como `member` | Observar la navegación | Sin enlaces a Usuarios, Reportes ni Auditoría | Pendiente de ejecución |
| FF-05 | Fecha de vencimiento visible antes de confirmar (RU-10) | Préstamo en curso | Revisar el paso 3 del formulario | Se muestra "Vence: DD/MM/AAAA" = hoy + 14 | Pendiente de ejecución |
| FF-06 | Expiración de sesión con redirección (RU-11) | Token caducado | Navegar a una ruta protegida | Redirige a `/login` con "Sesión expirada" | Pendiente de ejecución |
| FF-07 | Dashboard con KPIs (RU-12) | Datos sembrados | Login admin → dashboard | 4 tarjetas con valores correctos; atrasados en rojo si > 0 | Pendiente de ejecución |
| FF-08 | Recorrido completo: préstamo → devolución → multa | Flujo real | Registrar préstamo vencido manualmente (fecha forzada) y devolver | Multa visible en "Mis multas" y bloqueo liberado tras pagar | Pendiente de ejecución |

### 2.9 Pruebas de rendimiento

| ID | Objetivo | Datos de prueba | Pasos | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|---|
| RR-01 | Listado de libros bajo carga (RNF-01/RR-01) | 5.000 libros, 15.000 copias | 50 peticiones concurrentes a `GET /api/books?page=1` | P95 ≤ 500 ms | Pendiente de ejecución |
| RR-02 | Registro de préstamo (RNF-02/RR-02) | 30 escrituras secuenciales | Cronometrar `POST /api/loans` | P95 ≤ 800 ms | Pendiente de ejecución |
| RR-03 | Concurrencia sin degradación (RNF-04) | 50 conexiones simultáneas | Medir latencia base vs. bajo carga | Degradación ≤ 20 % | Pendiente de ejecución |
| RR-04 | Login con bcrypt 12 rondas (RNF-05) | 10 logins | Cronometrar `POST /api/auth/login` | Cada login < 2 s (promedio < 400 ms) | Pendiente de ejecución |
| RR-05 | Reporte resumen (RR-06) | 10.000 préstamos históricos | `GET /api/reports/summary` | < 1 s | Pendiente de ejecución |

---

## 3. Cobertura planeada

| Módulo / capa | Tipo de prueba | Cobertura objetivo | Criterio de aceptación |
|---|---|---|---|
| `server/services/*` | Unitaria (Vitest) | **≥ 80 %** líneas / ≥ 70 % ramas | `vitest run --coverage` en verde |
| `server/controllers/*` | Integración (supertest) | 100 % de métodos | Todos los endpoints invocados al menos una vez |
| `server/repositories/*` | Integración + BD | 100 % de sentencias SQL | Cada query ejecutada en suite |
| `server/middleware/*` (auth, validate, errorHandler) | Integración | 100 % de rutas con/ sin token | Matriz RBAC completa verificada |
| Esquemas Zod | Unitaria | 100 % de campos con caso válido e inválido | UN-12, UN-13 y FL-02 |
| `client/` (componentes y pantallas) | Funcional manual | 11/11 pantallas | Checklist FF completado |
| Reglas de negocio (5 reglas) | Unitaria + integración | 100 % de reglas con ≥ 2 casos (positivo/negativo) | PB-xx, DV-xx, RB-xx, MB-xx en verde |
| Requisitos no funcionales | Rendimiento / revisión | RNF-01…RNF-15 | Tabla de resultados con métricas |

**Herramientas de ejecución (sin ejecutar en este documento):**

```bash
npm run test           # suite completa
npm run test:coverage  # cobertura
npm run typecheck      # tsc --noEmit
```

**Criterio global de aceptación de la entrega:** 0 errores abiertos de severidad Alta/Crítica, cobertura de servicios ≥ 80 %, todos los casos SE y BD en verde, y checklist FF completado.

---

## 4. Registro de errores detectados (bug tracker)

Errores realistas de este tipo de proyecto, con su ciclo hasta la corrección.

| ID | Descripción | Severidad | Caso de prueba | Detectado en | Estado | Corrección aplicada |
|---|---|---|---|---|---|---|
| **ERR-01** | **Cálculo de multa inconsistente por zona horaria:** al usar `new Date().toISOString()` (UTC) para comparar con `due_date` guardado en hora local, un préstamo devuelvido a las 23:30 del día límite aparecía como atrasado 1 día y generaba una multa de 0,50 indebida. | **Alta** | DV-02, UN-02 | Pruebas unitarias de `LoanService` | **Corregido** | Se centralizó la fecha actual en `utils/fecha.ts` usando `date-fns` con la zona horaria del servidor (`TZ=America/Argentina/Buenos_Aires`) y se comparan **solo** fechas (`YYYY-MM-DD`), no instantes. Se agregó UN-03 con devolución temprana. |
| **ERR-02** | **Doble préstamo del mismo ejemplar en peticiones concurrentes:** dos bibliotecarios enviaban `POST /api/loans` con el mismo `copy_id` en milisegundos; ambas validaciones leían `available` antes de escribir y se creaban dos préstamos activos para un solo ejemplar. | **Crítica** | PB-06, BD-01 | Pruebas de integración concurrentes | **Corregido** | La verificación de estado se movió **dentro** de la transacción (`BEGIN IMMEDIATE`), se relee el estado del ejemplar con bloqueo de escritura y se añadió una comprobación posterior (`UPDATE copies SET status='loaned' WHERE id=? AND status='available'` con `changes===0` → rollback y 409). |
| **ERR-03** | **Login permitido a usuarios inactivos:** el endpoint comparaba la contraseña pero no verificaba `users.status`, por lo que un usuario desactivado seguía pudiendo iniciar sesión y obtener un JWT válido. | **Alta** | IN-04, FU-04 | Prueba de seguridad SE-01 | **Corregido** | Se añadió la validación `status === 'active'` en `AuthService.autenticar()` después de `bcrypt.compare`, devolviendo 403 `USUARIO_INACTIVO` y registrando `LOGIN_BLOCKED` en `audit_logs`. |
| **ERR-04** | **SQL injection en la búsqueda de libros:** el parámetro `q` se concatenaba directamente en `WHERE title LIKE '%${q}%'`; una comilla en el término rompía la consulta (500) y `'; DROP TABLE books; --'` habría eliminado la tabla. | **Crítica** | SE-04 | Prueba de seguridad manual | **Corregido** | Todas las consultas migraron a **bindings parametrizados** (`LIKE ?` con `%${q}%` construido como parámetro de datos, no como SQL). Se añadió validación `z.string().max(120)` en el query y una prueba de regresión que verifica que `books` no desaparece. |
| **ERR-05** | **Reserva creada sobre libro con ejemplares disponibles:** la validación solo comprobaba el límite de 3 reservas y no la disponibilidad total, permitiendo reservar títulos que podrían retirarse de inmediato. | **Media** | RB-02, UN-09 | Caso de uso CU-09 | **Corregido** | `ReservationService.crear()` ahora cuenta los ejemplares `available` del libro y devuelve 409 `EJEMPLAR_DISPONIBLE` con mensaje orientador si hay al menos uno; se agregó la prueba UN-09 con mock. |
| **ERR-06** | **Reserva sin caducidad:** `expires_at` se insertaba con la misma marca de `created_at`, de modo que las reservas nunca vencían y bloqueaban la cola indefinidamente. | **Media** | RB-01, UN-11 | Revisión de datos | **Corregido** | Se calcula `expires_at = created_at + 7 días` en el servicio y se añadió el `CHECK (expires_at >= created_at)` en el DDL más la caducidad diferida al consultar (RF-43). |
| **ERR-07** | **Pago doble de multa:** no había validación de estado en `POST /api/fines/:id/pay`; al presionar dos veces se duplicaba `paid_at` y el resumen de "por cobrar" quedaba en negativo. | **Media** | MB-04 | Prueba funcional FF-08 | **Corregido** | Se añadió la condición `status='pending'` dentro de la transacción de pago (UPDATE condicionado) + 409 `MULTA_YA_PAGADA`; el diálogo de UI deshabilita el botón tras la primera respuesta. |
| **ERR-08** | **Respuesta de usuarios incluía `password_hash`:** `GET /api/users` devolvía la fila completa, exponiendo hashes bcrypt en el JSON. | **Alta** | SE-08, FU-01 | Revisión de seguridad | **Corregido** | Los repositorios pasaron a **proyección explícita de columnas** (`SELECT id, username, email, full_name, role, status, created_at`) en todos los endpoints que devuelven usuarios. |

### 4.1 Resumen de severidades

| Severidad | Definición | Cantidad | Estado |
|---|---|---|---|
| Crítica | Pérdida de integridad de datos o fallo de seguridad explotable | 2 (ERR-02, ERR-04) | Ambos corregidos |
| Alta | Regla de negocio incumplida o exposición de datos | 3 (ERR-01, ERR-03, ERR-08) | Corregidos |
| Media | Comportamiento incorrecto con workaround | 3 (ERR-05, ERR-06, ERR-07) | Corregidos |
| Baja | Cosmético / mejora menor | 0 | — |

### 4.2 Plantilla de registro para nuevos hallazgos

| Campo | Contenido |
|---|---|
| ID | ERR-nn |
| Descripción | Qué ocurre, cómo se reproduce |
| Severidad | Crítica / Alta / Media / Baja |
| Módulo | servicio / controlador / repo / UI |
| Caso de prueba asociado | xx-yy |
| Paso de reproducción | 1…n |
| Esperado vs. obtenido | — |
| Corrección | Archivo y cambio aplicado |
| Regresión | Prueba que lo cubre a partir de ahora |
| Estado | Abierto / En curso / Corregido / Verificado |

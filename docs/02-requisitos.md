# 02 — Requisitos del sistema

**Proyecto:** Sistema de Gestión de Biblioteca (SGB)
**Documento:** Especificación de requisitos funcionales, no funcionales y restricciones
**Criterio de redacción:** Todos los requisitos se enuncian en forma pasiva con la fórmula *"El sistema deberá…"*, son **verificables** (existe al menos una forma objetiva de comprobar su cumplimiento) y están referenciados en la trazabilidad del documento `12-gestion.md`.

**Leyenda de prioridad:** **M** = Must (obligatorio), **S** = Should (deseable), **C** = Could (opcional).

---

## 1. Requisitos funcionales (RF)

### 1.1 Autenticación y sesión

| ID | Requisito | Prioridad | Verificación |
|---|---|---|---|
| RF-01 | El sistema deberá autenticar al usuario mediante `POST /api/auth/login` recibiendo `username` y `password`, y devolver un token JWT firmado junto con los datos públicos del usuario. | M | Prueba de integración IN-01/IN-02 |
| RF-02 | El sistema deberá rechazar el inicio de sesión cuando la contraseña no coincida con el `password_hash` almacenado, sin revelar si el usuario existe. | M | Prueba IN-02 |
| RF-03 | El sistema deberá bloquear el inicio de sesión de todo usuario con `status = 'inactive'` devolviendo un error 403 con mensaje identificable. | M | Prueba IN-04 |
| RF-04 | El sistema deberá exponer `GET /api/auth/me` para devolver el usuario autenticado a partir del token (claims: `id`, `username`, `role`). | M | Prueba IN-03 |
| RF-05 | El sistema deberá registrar en `audit_logs` el evento `LOGIN_SUCCESS` y `LOGIN_FAILED` con usuario, IP y fecha/hora. | M | Consulta a la tabla audit_logs |

### 1.2 Gestión de usuarios

| ID | Requisito | Prioridad | Verificación |
|---|---|---|---|
| RF-06 | El sistema deberá listar los usuarios con `GET /api/users` (paginación y filtro por `role`/`status`) para roles `admin`. | M | Prueba FU-01 |
| RF-07 | El sistema deberá crear usuarios con `POST /api/users` validando con Zod que `username`, `email`, `password_hash`, `full_name` y `role` cumplan el esquema (username 3-30 caracteres, email con formato válido, password mínimo 8). | M | Prueba FU-02/FU-03 |
| RF-08 | El sistema deberá rechazar la creación de usuarios con `username` o `email` duplicados devolviendo 409. | M | Prueba FU-04 |
| RF-09 | El sistema deberá modificar un usuario con `PUT /api/users/:id`, permitiendo actualizar `full_name`, `email`, `role`, `status` y `password_hash` (esta última con re-hash de bcrypt). | M | Prueba FU-05 |
| RF-10 | El sistema deberá desactivar usuarios con `DELETE /api/users/:id` aplicando **borrado lógico** (`status='inactive'`) sin eliminar el histórico de préstamos. | M | Prueba FU-06 |
| RF-11 | El sistema deberá registrar al nuevo usuario con `POST /api/auth/register` **exclusivamente** cuando la petición provenga de un usuario autenticado con rol `admin`. | M | Prueba FU-07 |
| RF-12 | El sistema deberá impedir que un usuario con rol `member` acceda a los endpoints de usuarios (`/api/users`) devolviendo 403. | M | Prueba SE-03 |

### 1.3 Catálogo: categorías, libros y ejemplares

| ID | Requisito | Prioridad | Verificación |
|---|---|---|---|
| RF-13 | El sistema deberá listar las categorías con `GET /api/categories` y permitir su alta (`POST`), modificación (`PUT /:id`) y baja (`DELETE /:id`) para `admin` y `librarian`. | M | Prueba FC-01…FC-04 |
| RF-14 | El sistema deberá impedir eliminar una categoría que posea libros asociados, devolviendo 409 con el número de libros vinculados. | M | Prueba FC-05 |
| RF-15 | El sistema deberá crear y editar libros con `POST /api/books` y `PUT /api/books/:id` validando `isbn`, `title`, `author`, `publisher`, `publication_year` y `category_id`. | M | Prueba FL-01/FL-02 |
| RF-16 | El sistema deberá mantener `isbn` único en la tabla `books`, rechazando duplicados con 409. | M | Prueba FL-03 |
| RF-17 | El sistema deberá buscar libros con `GET /api/books` aplicando búsqueda por título, autor o ISBN (parámetro `q`), filtro por `category_id` y paginación (`page`, `limit`). | M | Prueba FL-04/FL-05 |
| RF-18 | El sistema deberá incluir en la respuesta de `GET /api/books` el total de ejemplares y los disponibles de cada título, calculados desde `copies`. | M | Prueba FL-06 |
| RF-19 | El sistema deberá eliminar un libro con `DELETE /api/books/:id` solo si no tiene préstamos registrados; en caso contrario devolver 409. | S | Prueba FL-07 |
| RF-20 | El sistema deberá crear ejemplares con `POST /api/books/:id/copies` asignando un `inventory_code` único y estado inicial `available`. | M | Prueba FE-01 |
| RF-21 | El sistema deberá modificar el estado y la condición de un ejemplar con `PUT /api/copies/:id` entre los valores `available`, `loaned`, `lost` y `maintenance`. | M | Prueba FE-02 |
| RF-22 | El sistema deberá mostrar en la ficha del libro el detalle de cada ejemplar con su código de inventario, estado y condición. | M | Prueba FE-03 |

### 1.4 Préstamos y devoluciones

| ID | Requisito | Prioridad | Verificación |
|---|---|---|---|
| RF-23 | El sistema deberá registrar un préstamo con `POST /api/loans` recibiendo `copy_id` y `user_id`, fijando `loan_date` a la fecha actual, `due_date = loan_date + 14 días` y `status = 'active'`. | M | Prueba PB-01 |
| RF-24 | El sistema deberá rechazar el préstamo si el ejemplar no tiene estado `available` (devolver 409 con el estado actual). | M | Prueba PB-02 |
| RF-25 | El sistema deberá rechazar el préstamo si el usuario tiene `status = 'inactive'`. | M | Prueba PB-03 |
| RF-26 | El sistema deberá rechazar el préstamo si el usuario tiene multas con `status='pending'`, indicando el monto adeudado. | M | Prueba PB-04 |
| RF-27 | El sistema deberá rechazar el préstamo cuando el usuario ya posea 5 préstamos con `status='active'` (límite configurable en el servicio). | M | Prueba PB-05 |
| RF-28 | El sistema deberá cambiar el estado del ejemplar a `loaned` al confirmarse el préstamo y registrar el evento en `audit_logs`. | M | Prueba PB-06 |
| RF-29 | El sistema deberá registrar la devolución con `POST /api/loans/:id/return`, fijando `return_date` y evaluando el atraso respecto de `due_date`. | M | Prueba DV-01 |
| RF-30 | El sistema deberá recalcular el estado del ejemplar a `available` (o a `maintenance`/`lost` si se reporta) al devolverse. | M | Prueba DV-02 |
| RF-31 | El sistema deberá calcular la multa como `días_atraso × 0,50` y crear un registro en `fines` con `status='pending'` cuando la devolución sea tardía. | M | Prueba DV-03 |
| RF-32 | El sistema deberá cambiar a `ready` la reserva más antigua `pending` del libro devuelto, si existe; y cancelar reservas `pending` cuyo `expires_at` ya venció. | M | Prueba DV-04 |
| RF-33 | El sistema deberá listar préstamos con `GET /api/loans` filtrando por `status`, `user_id`, `date_from`, `date_to` y devolviendo los datos del ejemplar, libro y usuario asociados. | M | Prueba PL-01/PL-02 |
| RF-34 | El sistema deberá exponer `GET /api/loans/my` para que un `member` consulte únicamente sus propios préstamos. | M | Prueba PL-03 |
| RF-35 | El sistema deberá marcar como `overdue` los préstamos `active` cuya `due_date` es anterior a la fecha actual, al ser consultados o mediante el cálculo diario. | M | Prueba PL-04 |
| RF-36 | El sistema deberá rechazar una devolución sobre un préstamo que ya tiene `return_date` (409). | S | Prueba DV-05 |

### 1.5 Reservas

| ID | Requisito | Prioridad | Verificación |
|---|---|---|---|
| RF-37 | El sistema deberá crear una reserva con `POST /api/reservations` solo cuando **todos** los ejemplares del libro estén en estado `loaned` (o no existan ejemplares), devolviendo 409 en caso contrario. | M | Prueba RB-01/RB-02 |
| RF-38 | El sistema deberá limitar a **3 reservas activas** (`pending` o `ready`) por usuario, devolviendo 409 al excederlo. | M | Prueba RB-03 |
| RF-39 | El sistema deberá fijar `expires_at = created_at + 7 días` en toda reserva. | M | Prueba RB-04 |
| RF-40 | El sistema deberá listar reservas con `GET /api/reservations` (filtro por `status` y por usuario) y permitir a `member` ver solo las suyas. | M | Prueba RB-05 |
| RF-41 | El sistema deberá cancelar reservas con `POST /api/reservations/:id/cancel` (solo el dueño o un `librarian`/`admin`), pasando `status='cancelled'`. | M | Prueba RB-06 |
| RF-42 | El sistema deberá marcar como `fulfilled` una reserva con `POST /api/reservations/:id/fulfill` al entregar el ejemplar disponible. | M | Prueba RB-07 |
| RF-43 | El sistema deberá actualizar a `cancelled` las reservas cuyo `expires_at` sea menor que la fecha actual cuando sean consultadas. | S | Prueba RB-08 |

### 1.6 Multas

| ID | Requisito | Prioridad | Verificación |
|---|---|---|---|
| RF-44 | El sistema deberá listar todas las multas con `GET /api/fines` filtrando por `status` y `user_id` para `admin` y `librarian`. | M | Prueba MB-01 |
| RF-45 | El sistema deberá exponer `GET /api/fines/my` para que el `member` consulte solo sus multas. | M | Prueba MB-02 |
| RF-46 | El sistema deberá registrar el pago de una multa con `POST /api/fines/:id/pay`, fijando `paid_at`, `status='paid'` y generando la entrada de auditoría `FINE_PAID`. | M | Prueba MB-03 |
| RF-47 | El sistema deberá impedir pagar dos veces la misma multa (409 si ya está en `paid`). | M | Prueba MB-04 |
| RF-48 | El sistema deberá impedir crear un préstamo mientras el usuario tenga multas `pending` (complementa RF-26). | M | Prueba MB-05 |

### 1.7 Reportes y consultas

| ID | Requisito | Prioridad | Verificación |
|---|---|---|---|
| RF-49 | El sistema deberá exponer `GET /api/reports/summary` con: total de usuarios, total de libros, total de ejemplares, préstamos activos, préstamos atrasados, multas pendientes y monto pendiente de cobro. | M | Prueba RP-01 |
| RF-50 | El sistema deberá exponer `GET /api/reports/top-books` devolviendo los N títulos con más préstamos en un rango de fechas, con conteo y ranking. | M | Prueba RP-02 |
| RF-51 | El sistema deberá exponer `GET /api/reports/overdue` con los préstamos atrasados: usuario, libro, ejemplar, días de atraso y multa estimada. | M | Prueba RP-03 |
| RF-52 | El sistema deberá restringir el acceso a los reportes a los roles `admin` y `librarian`. | M | Prueba SE-04 |

### 1.8 Auditoría

| ID | Requisito | Prioridad | Verificación |
|---|---|---|---|
| RF-53 | El sistema deberá registrar en `audit_logs` toda acción relevante (login, alta/baja/modificación de entidades, préstamo, devolución, reserva, pago) con `user_id`, `action`, `entity`, `entity_id`, `details`, `ip` y `created_at`. | M | Prueba AU-01 |
| RF-54 | El sistema deberá exponer la bitácora únicamente al rol `admin` (endpoint interno de auditoría), devolviendo 403 al resto. | M | Prueba AU-02 |
| RF-55 | El sistema deberá conservar los registros de auditoría de forma **append-only**: no se permite modificar ni eliminar entradas existentes. | M | Revisión de código + AU-03 |

---

## 2. Requisitos no funcionales (RNF)

| ID | Requisito | Métrica verificable | Verificación |
|---|---|---|---|
| RNF-01 | El sistema deberá responder las peticiones de lectura típicas (listados, búsqueda) en un tiempo inferior a **500 ms** en percentil 95 bajo carga local de 50 usuarios concurrentes. | P95 ≤ 500 ms | Prueba de rendimiento RR-01 |
| RNF-02 | El sistema deberá responder las peticiones de escritura (crear préstamo, devolución) en menos de **800 ms** P95. | P95 ≤ 800 ms | Prueba RR-02 |
| RNF-03 | El sistema deberá estar disponible al menos el **99,0 %** del tiempo en una ventana mensual de operación (≤ 7,2 h de indisponibilidad/mes). | Disponibilidad ≥ 99 % | Monitoreo RD-01 |
| RNF-04 | El sistema deberá soportar al menos **50 usuarios concurrentes** sin degradación superior al 20 % del tiempo de respuesta base. | 50 conexiones concurrentes | Prueba RR-03 |
| RNF-05 | El sistema deberá autenticar un usuario en menos de **2 segundos** incluyendo verificación de hash bcrypt. | < 2 s | Prueba RR-04 |
| RNF-06 | El sistema deberá devolver los resultados de búsqueda de libros (sobre un acervo simulado de 5.000 títulos) en menos de **400 ms**. | < 400 ms | Prueba RR-05 |
| RNF-07 | El sistema deberá mantener la **integridad referencial** de todas las claves foráneas (constraint `FOREIGN KEY ... ON DELETE` apropiado) sin permitir registros huérfanos. | 0 violaciones FK | Prueba BD-01 |
| RNF-08 | El sistema deberá persistir los datos de forma **durable**: después de un reinicio no se perderá información confirmada. | 0 pérdida tras reinicio | Prueba BD-02 |
| RNF-09 | El sistema deberá utilizar **SQLite con WAL** y estar preparado para operar en un equipo de la biblioteca sin conexión a internet externa. | Operación local/offline | Revisión de configuración |
| RNF-10 | El sistema deberá mantener una **cobertura de pruebas ≥ 80 %** en la capa de servicios. | ≥ 80 % líneas | Reporte Vitest |
| RNF-11 | El sistema deberá compilar sin errores de tipo en TypeScript (`tsc --noEmit`) y pasar el linter. | 0 errores | Comando de verificación |
| RNF-12 | El sistema deberá estar documentado con la documentación académica completa (12 documentos) y ejemplos de endpoints. | 12 docs entregados | Revisión del entregable |
| RNF-13 | El sistema deberá soportar navegadores modernos actuales (Chrome, Firefox, Edge, Safari — últimas 2 versiones). | Render correcto | Prueba funcional FF-xx |
| RNF-14 | El sistema deberá ser responsive hasta **360 px** de ancho para las pantallas principales (login, catálogo, préstamos). | Sin desbordes | Revisión visual |
| RNF-15 | El sistema deberá registrar un evento de auditoría en menos de **100 ms** adicional por petición. | Overhead < 100 ms | Prueba RR-06 |

---

## 3. Requisitos de seguridad (RS)

| ID | Requisito | Verificación |
|---|---|---|
| RS-01 | El sistema deberá verificar el token JWT en **todas** las rutas protegidas y rechazar con 401 las peticiones sin token, con token inválido o expirado. | Prueba SE-01 |
| RS-02 | El sistema deberá aplicar **RBAC** verificando el rol del token en cada endpoint según la matriz de autorización (sección 4). | Prueba SE-02/SE-03 |
| RS-03 | El sistema deberá almacenar contraseñas únicamente como hash **bcrypt con 12 rondas**, jamás en texto plano. | Revisión de código + SE-05 |
| RS-04 | El sistema deberá validar **todas** las entradas (body, params, query) con esquemas **Zod** y rechazar con 400 cualquier payload inválido, incluyendo los ejemplos de ataque típicos (SQLi, XSS, path traversal). | Prueba SE-06/SE-07 |
| RS-05 | El sistema deberá utilizar **consultas parametrizadas** (better-sqlite3 con `?` bindings) prohibiendo la concatenación de strings en SQL. | Revisión estática + SE-07 |
| RS-06 | El sistema deberá aplicar **helmet** para fijar cabeceras de seguridad (CSP, X-Content-Type-Options, X-Frame-Options, HSTS) y **cors** con lista blanca de orígenes. | Prueba SE-08 |
| RS-07 | El sistema deberá limitar la tasa de peticiones con **express-rate-limit** a 100 peticiones/15 min por IP en general y **10 intentos de login/15 min** por IP y usuario. | Prueba SE-09 |
| RS-08 | El sistema deberá expirar los tokens JWT en **8 horas** y no refrescarlos silenciosamente sin revalidar credenciales. | Prueba SE-10 |
| RS-09 | El sistema deberá impedir que la respuesta de un endpoint revele claves internas, hashes, SQL o trazas de stack trace en producción (manejo de errores centralizado). | Prueba SE-11 |
| RS-10 | El sistema deberá registrar en `audit_logs` los eventos de autenticación y las operaciones sensibles con la IP del cliente. | Prueba AU-01 |
| RS-11 | El sistema deberá impedir que un usuario modifique o consulte recursos de otro usuario (IDOR) validando la propiedad en los endpoints `my` y en reservas/multas. | Prueba SE-12 |
| RS-12 | El sistema deberá exponer el campo `password_hash` **nunca** en respuestas de la API (proyección explícita de columnas). | Prueba SE-13 |

---

## 4. Requisitos de disponibilidad (RD)

| ID | Requisito | Métrica / criterio |
|---|---|---|
| RD-01 | El sistema deberá mantener una disponibilidad mensual ≥ **99,0 %** considerando horario de atención de la biblioteca (8 h/día × 26 días). | ≤ 7,2 h caídas/mes |
| RD-02 | El sistema deberá reiniciarse automáticamente ante una caída del proceso Node (script `start` con reinicio o procedimiento documentado). | MTTR < 5 min |
| RD-03 | El sistema deberá disponer de una **copia de seguridad automática diaria** del archivo SQLite (ver § `08-seguridad.md`), conservando al menos 7 días de retención. | 1 backup/día, 7 versiones |
| RD-04 | El sistema deberá restaurarse desde la copia de seguridad en menos de **15 minutos**. | Tiempo de restauración ≤ 15 min |
| RD-05 | El sistema deberá informar el estado degradado (base de datos no disponible) con un mensaje controlado 503 en lugar de una respuesta incompleta. | Código 503 verificable |
| RD-06 | El sistema deberá operar sin dependencia de servicios externos de terceros en su ruta crítica (sin APIs externas obligatorias). | Revisión de arquitectura |
| RD-07 | El sistema deberá conservar los datos ante interrupciones eléctricas gracias al modo WAL de SQLite y al cierre ordenado del proceso. | Prueba de corte simulado |

---

## 5. Requisitos de rendimiento (RR)

| ID | Requisito | Métrica |
|---|---|---|
| RR-01 | El sistema deberá listar 50 libros paginados en < **500 ms** (P95) con 5.000 títulos y 15.000 ejemplares en la BD. | P95 ≤ 500 ms |
| RR-02 | El sistema deberá registrar un préstamo completo (validaciones + escritura + auditoría) en < **800 ms** (P95). | P95 ≤ 800 ms |
| RR-03 | El sistema deberá soportar **50 conexiones concurrentes** al servidor con degradación ≤ 20 % del tiempo base. | ≤ 20 % degradación |
| RR-04 | El sistema deberá autenticar en < **2 s** (bcrypt 12 rondas incluido). | < 2 s |
| RR-05 | El sistema deberá resolver la búsqueda libre de catálogo en < **400 ms** apoyándose en índices (`idx_books_title`, `idx_books_author`, `idx_books_isbn`). | < 400 ms |
| RR-06 | El sistema deberá generar `GET /api/reports/summary` en < **1 s** con 10.000 préstamos históricos. | < 1 s |
| RR-07 | El sistema deberá mantener el consumo de memoria del proceso Node por debajo de **512 MB** en operación normal. | < 512 MB RSS |
| RR-08 | El sistema deberá paginar todo listado con un tamaño máximo de **100 registros** por página para acotar el payload. | límite `limit ≤ 100` |

---

## 6. Requisitos de usabilidad (RU)

| ID | Requisito | Criterio de verificación |
|---|---|---|
| RU-01 | El sistema deberá permitir a un bibliotecario capacitado registrar un préstamo en **menos de 45 segundos** (tiempo de tarea). | Prueba de usabilidad UT-01 |
| RU-02 | El sistema deberá mostrar **mensajes de error en español**, específicos y junto al campo o componente que originó el problema. | Revisión + prueba FF |
| RU-03 | El sistema deberá validar los formularios **en tiempo real** al perder el foco del campo, sin enviar el formulario inválido al servidor. | Prueba FF-01 |
| RU-04 | El sistema deberá proteger las acciones destructivas (eliminar libro, desactivar usuario) con **diálogo de confirmación** que nombre el recurso. | Prueba FF-02 |
| RU-05 | El sistema deberá mostrar indicadores de **carga** (spinner/deshabilitado) durante toda petición asincrónica. | Prueba FF-03 |
| RU-06 | El sistema deberá ofrecer **búsqueda** en la lista de libros y de usuarios con resultado en ≤ 300 ms tras dejar de escribir (*debounce* 300 ms). | Prueba FF-04 |
| RU-07 | El sistema deberá ocultar o deshabilitar las opciones de menú que el rol actual no puede utilizar (navegación condicionada por rol). | Prueba FF-05 |
| RU-08 | El sistema deberá mantener una paleta y jerarquía visual consistente, con contraste mínimo **4,5:1** en texto normal (WCAG 2.1 AA). | Revisión de contraste |
| RU-09 | El sistema deberá incluir etiquetas `<label>` asociadas y mensajes de error con `aria-live` en todos los formularios. | Revisión de accesibilidad |
| RU-10 | El sistema deberá informar siempre la **fecha de vencimiento** calculada (loan_date + 14 días) antes de confirmar el préstamo. | Prueba FF-06 |
| RU-11 | El sistema deberá cerrar la sesión automáticamente cuando el token expire y redirigir al login con un mensaje claro. | Prueba FF-07 |
| RU-12 | El sistema deberá mostrar en el dashboard los indicadores clave (préstamos del día, atrasados, multas pendientes) en la primera pantalla. | Prueba FF-08 |

---

## 7. Matriz de trazabilidad resumen

| Área | Rango de IDs | Cantidad |
|---|---|---|
| Autenticación y sesión | RF-01…RF-05 | 5 |
| Usuarios | RF-06…RF-12 | 7 |
| Catálogo | RF-13…RF-22 | 10 |
| Préstamos y devoluciones | RF-23…RF-36 | 14 |
| Reservas | RF-37…RF-43 | 7 |
| Multas | RF-44…RF-48 | 5 |
| Reportes | RF-49…RF-52 | 4 |
| Auditoría | RF-53…RF-55 | 3 |
| **Total RF** | | **55** |
| No funcionales | RNF-01…RNF-15 | 15 |
| Seguridad | RS-01…RS-12 | 12 |
| Disponibilidad | RD-01…RD-07 | 7 |
| Rendimiento | RR-01…RR-08 | 8 |
| Usabilidad | RU-01…RU-12 | 12 |

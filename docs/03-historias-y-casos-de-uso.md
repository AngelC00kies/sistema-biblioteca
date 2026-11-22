# 03 — Historias de usuario y casos de uso

**Proyecto:** Sistema de Gestión de Biblioteca (SGB)
**Documento:** Requisitos desde la perspectiva del usuario: historias de usuario con criterios de aceptación y casos de uso detallados.

---

## 1. Actores

### 1.1 Tabla de actores

| Código | Actor | Tipo | Rol en el sistema | Descripción |
|---|---|---|---|---|
| AC-1 | **Administrador** | Principal | `admin` | Usuario con permisos totales: gestiona usuarios, catálogo, préstamos, reservas, multas, reportes y auditoría. Es el único que puede crear cuentas y ver la bitácora. |
| AC-2 | **Bibliotecario** | Principal | `librarian` | Ejecuta la operación diaria: mantiene el catálogo (libros, ejemplares, categorías), registra préstamos y devoluciones, administra reservas y multas y consulta reportes. No gestiona usuarios ni ve auditoría. |
| AC-3 | **Miembro / Usuario de la biblioteca** | Principal | `member` | Cliente de la biblioteca (~3.000). Consulta el catálogo, reserva libros, consulta sus préstamos y reservas, y paga sus multas. |
| AC-4 | **Sistema (reloj / scheduler)** | Secundario | — | Actúa automáticamente: caducidad de reservas (7 días), cálculo de multas y marca de préstamos `overdue`. |
| AC-5 | **Servicio de autenticación** | Secundario | — | Emite y valida tokens JWT y realiza el hash/verificación bcrypt. |
| AC-6 | **Motor de auditoría** | Secundario | — | Registra en `audit_logs` cada acción sensible. |

### 1.2 Relación de generalización de actores

- **Administrador** *es un* **Bibliotecario** con permisos adicionales (gestión de usuarios y auditoría) → en el diagrama se modela con herencia de actor (`<|`), de modo que un `admin` reutiliza todos los flujos del bibliotecario.

### 1.3 Matriz rol ↔ módulo

| Módulo / Caso de uso | admin | librarian | member |
|---|:--:|:--:|:--:|
| Iniciar sesión | ✔ | ✔ | ✔ |
| Consultar catálogo | ✔ | ✔ | ✔ |
| Gestionar categorías/libros/ejemplares | ✔ | ✔ | ✘ |
| Registrar préstamo / devolución | ✔ | ✔ | ✘ |
| Gestionar reservas (creación) | ✔ | ✔ | ✔ (propias) |
| Gestionar reservas (cancelar/fulfill de terceros) | ✔ | ✔ | ✘ |
| Consultar multas globales / cobrar | ✔ | ✔ | ✘ |
| Pagar la multa propia | ✔ | ✔ | ✔ |
| Gestionar usuarios | ✔ | ✘ | ✘ |
| Ver reportes | ✔ | ✔ | ✘ |
| Ver auditoría | ✔ | ✘ | ✘ |

---

## 2. Historias de usuario

Formato: **Como** [actor], **quiero** [acción], **para** [beneficio]. Cada historia incluye criterios de aceptación en formato *Given / When / Then* y una nota de estimación (puntos de historia, escala Fibonacci).

---

### HU-01 — Iniciar sesión de forma segura

> **Como** usuario del sistema (cualquier rol), **quiero** iniciar sesión con mi usuario y contraseña, **para** acceder a las funciones que me corresponden según mi rol.

**Estimación:** 3 puntos

| # | Escenario | Given | When | Then |
|---|---|---|---|---|
| 1 | Acceso correcto | Estoy en la pantalla de inicio de sesión con credenciales válidas de un usuario `active` | Presiono **Ingresar** | Recibo un token JWT, se redirige al dashboard según mi rol y aparece mi nombre en la barra superior |
| 2 | Contraseña incorrecta | La pantalla de inicio de sesión está abierta | Envío una contraseña incorrecta | Se muestra "Credenciales inválidas" junto al campo, sin indicar si el usuario existe, y permanezco en el login |
| 3 | Usuario inactivo | Existe un usuario con `status='inactive'` | Intento iniciar sesión con ese usuario | Se muestra "Usuario inactivo, contacte al administrador" y **no** se emite token |
| 4 | Campos vacíos | Estoy en el login | Envío el formulario vacío | Se resaltan los campos requeridos y no se realiza petición al servidor |

---

### HU-02 — Buscar y consultar libros del catálogo

> **Como** miembro, **quiero** buscar un libro por título, autor o ISBN y ver si hay ejemplares disponibles, **para** decidir si voy a la biblioteca a retirarlo.

**Estimación:** 5 puntos

| # | Escenario | Given | When | Then |
|---|---|---|---|---|
| 1 | Búsqueda por título | Estoy en la pantalla de catálogo | Escribo "quijote" en el campo de búsqueda | La lista se filtra y muestra los títulos coincidentes con su autor, ISBN, total de ejemplares y disponibles |
| 2 | Búsqueda por categoría | El catálogo está listado | Selecciono la categoría "Novela" | Solo se muestran libros de esa categoría, conservando la paginación |
| 3 | Sin resultados | El catálogo está abierto | Busco un título inexistente | Se muestra "No se encontraron libros" con la opción de limpiar el filtro |
| 4 | Detalle de libro | Hay resultados de búsqueda | Hago clic en un título | Se abre la ficha con descripción, categoría y la tabla de ejemplares (código, estado, condición) |

---

### HU-03 — Registrar un préstamo

> **Como** bibliotecario, **quiero** registrar el préstamo de un ejemplar a un usuario activo, **para** que el sistema controle el plazo y la devolución automáticamente.

**Estimación:** 8 puntos

| # | Escenario | Given | When | Then |
|---|---|---|---|---|
| 1 | Préstamo exitoso | Un ejemplar está `available` y el usuario está `active`, sin deudas ni 5 préstamos activos | Selecciono el ejemplar y el usuario y presiono **Registrar préstamo** | Se crea el préstamo con `loan_date` de hoy, `due_date` = hoy + 14 días, el ejemplar pasa a `loaned`, se registra auditoría y se muestra la fecha de vencimiento |
| 2 | Ejemplar ya prestado | El ejemplar tiene estado `loaned` | Confirmo el préstamo | Aparece el error "El ejemplar no está disponible" y no se crea el registro |
| 3 | Usuario con multa pendiente | El usuario tiene una multa `pending` | Confirmo el préstamo | Aparece "El usuario tiene una multa pendiente de $X" y el préstamo se bloquea |
| 4 | Límite alcanzado | El usuario ya tiene 5 préstamos `active` | Confirmo el préstamo | Aparece "Límite de 5 préstamos activos alcanzado" |
| 5 | Usuario inactivo | El usuario tiene `status='inactive'` | Confirmo el préstamo | Se bloquea con mensaje específico |

---

### HU-04 — Registrar una devolución y calcular la multa

> **Como** bibliotecario, **quiero** registrar la devolución de un ejemplar, **para** que el sistema libere el ejemplar y calcule la multa si hay atraso.

**Estimación:** 8 puntos

| # | Escenario | Given | When | Then |
|---|---|---|---|---|
| 1 | Devolución en tiempo | El préstamo está `active` y `due_date` es hoy o futuro | Presiono **Registrar devolución** | El ejemplar pasa a `available`, `return_date` se fija, el préstamo pasa a `returned` y **no** se genera multa |
| 2 | Devolución tardía | El préstamo está `active` y `due_date` fue hace 3 días | Presiono **Registrar devolución** | Se genera una multa de 3 × 0,50 = **1,50** con `status='pending'` y se muestra el importe |
| 3 | Con reserva pendiente | El libro tiene una reserva `pending` | Se registra la devolución | La reserva más antigua pasa a `ready` y aparece en la lista de reservas |
| 4 | Préstamo ya devuelto | El préstamo tiene `return_date` | Intento devolverlo de nuevo | Error 409 "El préstamo ya fue devuelto" |

---

### HU-05 — Reservar un libro sin disponibilidad

> **Como** miembro, **quiero** reservar un libro del que no quedan ejemplares disponibles, **para** ser atendido en orden cuando sea devuelto.

**Estimación:** 5 puntos

| # | Escenario | Given | When | Then |
|---|---|---|---|---|
| 1 | Reserva válida | Todos los ejemplares del libro están `loaned` y tengo menos de 3 reservas activas | Presiono **Reservar** | Se crea la reserva `pending` con `expires_at` = hoy + 7 días y se muestra la fecha de caducidad |
| 2 | Hay disponibilidad | Al menos un ejemplar está `available` | Presiono **Reservar** | Mensaje "Hay ejemplares disponibles, retire el libro directamente" y no se crea la reserva |
| 3 | Límite de 3 | Ya tengo 3 reservas `pending`/`ready` | Intento reservar otro libro | Error "Límite de 3 reservas activas alcanzado" |
| 4 | Cancelar | Tengo una reserva `pending` | Presiono **Cancelar** | La reserva pasa a `cancelled` y el sistema libera el cupo |

---

### HU-06 — Pagar una multa

> **Como** miembro, **quiero** pagar la multa que tengo pendiente, **para** volver a poder solicitar préstamos.

**Estimación:** 3 puntos

| # | Escenario | Given | When | Then |
|---|---|---|---|---|
| 1 | Pago exitoso | Tengo una multa `pending` de 2,50 | Presiono **Pagar** y confirmo | La multa pasa a `paid`, se fija `paid_at`, se registra auditoría `FINE_PAID` y desaparece de mi lista de pendientes |
| 2 | Multa ya pagada | La multa está en `paid` | Intento pagarla de nuevo | Error 409 "La multa ya fue pagada" |
| 3 | Sin multas | No tengo multas | Abro la pantalla de multas | Se muestra "No tienes multas pendientes" |

---

### HU-07 — Gestionar usuarios (solo administrador)

> **Como** administrador, **quiero** crear, editar y desactivar usuarios, **para** mantener el padrón de 3.000 miembros actualizado.

**Estimación:** 5 puntos

| # | Escenario | Given | When | Then |
|---|---|---|---|---|
| 1 | Alta de usuario | Soy `admin` y estoy en "Gestionar usuarios" | Completo el formulario (username, email, nombre completo, rol, contraseña) y envío | Se crea el usuario `active`, se hashea la contraseña con bcrypt (12 rondas) y aparece en la lista |
| 2 | Datos duplicados | Ya existe un usuario con ese username | Envío el formulario | Error "El nombre de usuario ya existe" sin crear el registro |
| 3 | Desactivar | Soy `admin` y selecciono un usuario | Confirmo la desactivación | El usuario pasa a `inactive`, **no** puede iniciar sesión y su histórico se conserva |
| 4 | Sin permiso | Soy `librarian` | Intento acceder a `/api/users` | Respuesta 403 "No autorizado" |

---

### HU-08 — Registrar un nuevo ejemplar de un libro

> **Como** bibliotecario, **quiero** agregar un ejemplar a un título existente con su código de inventario, **para** que el préstamo considere la nueva copia física.

**Estimación:** 3 puntos

| # | Escenario | Given | When | Then |
|---|---|---|---|---|
| 1 | Alta correcta | Estoy en la ficha de un libro | Ingreso el código de inventario y la condición, y presiono **Agregar ejemplar** | El ejemplar se crea `available` y el contador de disponibles del libro aumenta |
| 2 | Código duplicado | El código ya existe en `copies` | Envío el formulario | Error 409 "Código de inventario duplicado" |
| 3 | Cambiar estado | Un ejemplar está en `maintenance` | Lo marco como `available` | El estado se actualiza y vuelve a ser prestable |

---

### HU-09 — Consultar reportes de gestión

> **Como** administrador o bibliotecario, **quiero** consultar el resumen de la biblioteca, los libros más prestados y los préstamos atrasados, **para** tomar decisiones y rendir cuentas.

**Estimación:** 5 puntos

| # | Escenario | Given | When | Then |
|---|---|---|---|---|
| 1 | Resumen | Soy `admin` o `librarian` | Abro "Reportes → Resumen" | Veo usuarios, libros, ejemplares, préstamos activos, atrasados, multas pendientes y monto por cobrar |
| 2 | Top de libros | Hay histórico de préstamos | Selecciono un rango de fechas y presiono **Generar** | Se muestra el ranking de títulos con su conteo de préstamos en orden descendente |
| 3 | Atrasados | Hay préstamos vencidos | Abro "Préstamos atrasados" | La tabla lista usuario, libro, ejemplar, días de atraso y multa estimada |
| 4 | Sin permiso | Soy `member` | Intento acceder a reportes | 403 y redirigido a "Consulta de catálogo" |

---

### HU-10 — Auditoría de acciones (solo administrador)

> **Como** administrador, **quiero** consultar la bitácora de acciones, **para** verificar quién realizó cada operación sensible y detectar usos indebidos.

**Estimación:** 3 puntos

| # | Escenario | Given | When | Then |
|---|---|---|---|---|
| 1 | Consulta de bitácora | Soy `admin` | Abro "Auditoría" | Veo la tabla con fecha, usuario, acción, entidad, ID, detalles e IP, ordenada por fecha descendente |
| 2 | Filtro por acción | La bitácora está abierta | Filtro por `LOAN_CREATED` | Solo se muestran los registros de ese tipo |
| 3 | Rol no autorizado | Soy `librarian` | Intento acceder | 403 y no se muestra ningún dato |
| 4 | Registro automático | Cualquier usuario ejecuta un préstamo/devolución/pago | La acción se completa | Aparece una fila nueva en `audit_logs` con usuario, IP y hora |

---

## 3. Casos de uso

### 3.1 Catálogo general de casos de uso

| ID | Caso de uso | Actor principal | Relación | Prioridad |
|---|---|---|---|---|
| CU-01 | Iniciar sesión | Cualquier usuario | — | Alta |
| CU-02 | Registrar usuario | Administrador | — | Alta |
| CU-03 | Gestionar categorías | Bibliotecario / Administrador | — | Media |
| CU-04 | Gestionar libros (CRUD) | Bibliotecario / Administrador | — | Alta |
| CU-05 | Gestionar ejemplares | Bibliotecario / Administrador | — | Alta |
| CU-06 | Consultar catálogo | Miembro / Bibliotecario / Administrador | — | Alta |
| CU-07 | Registrar préstamo | Bibliotecario / Administrador | incluye CU-01 | Alta |
| CU-08 | Registrar devolución | Bibliotecario / Administrador | incluye CU-01, extiende CU-07 | Alta |
| CU-09 | Reservar libro | Miembro | incluye CU-01 | Alta |
| CU-10 | Cancelar reserva | Miembro (propias) / Bibliotecario | incluye CU-01 | Media |
| CU-11 | Atender reserva (fulfill) | Bibliotecario / Administrador | incluye CU-07 | Media |
| CU-12 | Consultar y pagar multas | Miembro (propias) / Bibliotecario (todas) | incluye CU-01 | Alta |
| CU-13 | Generar reportes | Bibliotecario / Administrador | — | Alta |
| CU-14 | Consultar auditoría | Administrador | — | Media |
| CU-15 | Cerrar sesión | Cualquier usuario | — | Baja |
| CU-16 | Consultar préstamo propio | Miembro | incluye CU-01 | Media |

---

### 3.2 Detalle de los casos de uso

#### CU-01 — Iniciar sesión

| Campo | Contenido |
|---|---|
| **Actores** | Administrador, Bibliotecario, Miembro (principal); Servicio de autenticación (secundario) |
| **Precondiciones** | 1. El usuario existe en `users`. 2. El navegador tiene acceso al servidor API. 3. No existe una sesión activa vigente. |
| **Flujo principal** | 1. El actor abre la pantalla de inicio de sesión.<br>2. Ingresa `username` y `password`.<br>3. El sistema valida el esquema con Zod.<br>4. El servicio busca el usuario por `username`.<br>5. Verifica el hash con bcrypt (12 rondas).<br>6. Verifica que `status='active'`.<br>7. Emite un JWT (expiración 8 h) con `id`, `username`, `role`.<br>8. Registra `LOGIN_SUCCESS` en `audit_logs`.<br>9. El frontend guarda el token, consulta `GET /api/auth/me` y redirige según rol: `admin`→dashboard, `librarian`→dashboard, `member`→catálogo. |
| **Flujos alternativos** | **3a.** Campos inválidos → devuelve 400 con los mensajes de Zod y no consulta la BD.<br>**4a.** Usuario inexistente o contraseña incorrecta → 401 "Credenciales inválidas" (mensaje genérico, se registra `LOGIN_FAILED`).<br>**6a.** Usuario `inactive` → 403 "Usuario inactivo".<br>**7a.** Demasiados intentos → 429 por *rate limiting* (10 intentos / 15 min). |
| **Postcondiciones** | **Éxito:** existe una sesión JWT válida y una fila en `audit_logs`.<br>Fracaso: ninguna sesión creada; los intentos quedan registrados. |
| **Excepciones** | Caída del servidor → pantalla de error controlada con reintento. |

---

#### CU-02 — Registrar usuario

| Campo | Contenido |
|---|---|
| **Actores** | Administrador |
| **Precondiciones** | 1. El actor está autenticado con rol `admin`. 2. El token no ha expirado. |
| **Flujo principal** | 1. Abre "Gestionar usuarios → Nuevo".<br>2. Completa `username`, `email`, `full_name`, `role`, `password`, `status`.<br>3. El sistema valida con Zod.<br>4. Verifica unicidad de `username` y `email`.<br>5. Hashea la contraseña (bcrypt 12).<br>6. Inserta el registro con `created_at` actual.<br>7. Registra `USER_CREATED` en auditoría.<br>8. Muestra el usuario en la tabla. |
| **Flujos alternativos** | **3a.** Datos inválidos → 400 con detalle por campo.<br>**4a.** Username/email duplicado → 409 "ya existe".<br>**2a.** Contraseña < 8 caracteres → validación en cliente y servidor. |
| **Postcondiciones** | El usuario existe con `status` inicial y contraseña hasheada; no queda ningún dato en texto plano. |
| **Excepciones** | Error de BD → 500 manejado sin exponer SQL. |

---

#### CU-03 — Gestionar categorías

| Campo | Contenido |
|---|---|
| **Actores** | Bibliotecario, Administrador |
| **Precondiciones** | Sesión autenticada con rol `admin` o `librarian`. |
| **Flujo principal** | 1. Abre "Categorías".<br>2. Visualiza `GET /api/categories`.<br>3. Crea una categoría (`name` único, `description` opcional) o edita/elimina una existente.<br>4. El servidor valida y persiste.<br>5. Auditoría `CATEGORY_CREATED/UPDATED/DELETED`. |
| **Flujos alternativos** | **3a.** Nombre duplicado → 409.<br>**3b.** Eliminar categoría con libros asociados → 409 con el conteo de libros.<br>**4a.** Rol `member` → 403. |
| **Postcondiciones** | El catálogo de categorías refleja el cambio y las FK siguen intactas. |

---

#### CU-04 — Gestionar libros (CRUD)

| Campo | Contenido |
|---|---|
| **Actores** | Bibliotecario, Administrador |
| **Precondiciones** | Sesión con rol adecuado; para crear/editar, la categoría debe existir. |
| **Flujo principal** | 1. Abre "Libros".<br>2. Ejecuta `GET /api/books` con `q`, `category_id`, `page`, `limit`.<br>3. Da de alta un libro con ISBN, título, autor, editorial, año, categoría y descripción.<br>4. Valida Zod + unicidad de ISBN.<br>5. Persiste y registra auditoría.<br>6. (Opcional) Agrega ejemplares desde la ficha. |
| **Flujos alternativos** | **3a.** ISBN duplicado → 409.<br>**4a.** Año fuera de rango (1400…año actual) → 400.<br>**3b.** Eliminar libro con préstamos asociados → 409. |
| **Postcondiciones** | El libro es consultable en el catálogo con sus contadores de ejemplares. |

---

#### CU-05 — Gestionar ejemplares

| Campo | Contenido |
|---|---|
| **Actores** | Bibliotecario, Administrador |
| **Precondiciones** | El libro destino existe. El `inventory_code` es único. |
| **Flujo principal** | 1. Abre la ficha del libro.<br>2. Registra un ejemplar con código de inventario y condición (`new`, `good`, `worn`…).<br>3. Estado inicial `available`.<br>4. Modifica estado/condición vía `PUT /api/copies/:id`.<br>5. Auditoría `COPY_CREATED/COPY_UPDATED`. |
| **Flujos alternativos** | **2a.** Código duplicado → 409.<br>**4a.** Intentar marcar `available` un ejemplar `loaned` con préstamo activo → 409 (debe devolverse primero). |
| **Postcondiciones** | El ejemplar está registrado y su estado determina si es prestable. |

---

#### CU-06 — Consultar catálogo

| Campo | Contenido |
|---|---|
| **Actores** | Miembro (principal), Bibliotecario, Administrador |
| **Precondiciones** | Sesión autenticada (también lectura pública permitida según configuración). |
| **Flujo principal** | 1. Abre "Catálogo".<br>2. Escribe un término de búsqueda o elige categoría.<br>3. El sistema pagina los resultados con totales de ejemplares disponibles.<br>4. Abre la ficha del libro para ver descripción y ejemplares. |
| **Flujos alternativos** | **2a.** Sin coincidencias → mensaje vacío.<br>**3a.** Página fuera de rango → se ajusta a la última. |
| **Postcondiciones** | El usuario conoce la disponibilidad real antes de desplazarse a la biblioteca. |

---

#### CU-07 — Registrar préstamo

| Campo | Contenido |
|---|---|
| **Actores** | Bibliotecario, Administrador |
| **Precondiciones** | 1. Sesión autenticada con rol adecuado. 2. El ejemplar existe y está `available`. 3. El usuario está `active`. 4. El usuario no tiene multas `pending`. 5. El usuario tiene menos de 5 préstamos `active`. |
| **Flujo principal** | 1. Abre "Registrar préstamo".<br>2. Busca y selecciona el usuario.<br>3. Busca y selecciona el ejemplar (solo disponibles).<br>4. El sistema muestra `loan_date` (hoy) y `due_date` calculado (hoy + 14 días).<br>5. Confirma.<br>6. El servicio crea el préstamo `active`, cambia el ejemplar a `loaned` y escribe auditoría `LOAN_CREATED` en una misma transacción.<br>7. Muestra el comprobante con la fecha de vencimiento. |
| **Flujos alternativos** | **4a.** Ejemplar no disponible → 409.<br>**4b.** Usuario inactivo → 403/409.<br>**4c.** Deuda pendiente → 409 con el monto.<br>**4d.** 5 préstamos activos → 409.<br>**6a.** Fallo en la BD → rollback y mensaje 500 (el ejemplar no queda `loaned` sin préstamo). |
| **Postcondiciones** | Existe un préstamo `active`, el ejemplar está `loaned` y hay una fila de auditoría. |

---

#### CU-08 — Registrar devolución

| Campo | Contenido |
|---|---|
| **Actores** | Bibliotecario, Administrador |
| **Precondiciones** | El préstamo existe, está `active` y sin `return_date`. |
| **Flujo principal** | 1. Localiza el préstamo (por usuario, ejemplar o ISBN).<br>2. Presiona **Registrar devolución**.<br>3. El sistema fija `return_date`.<br>4. Compara `return_date` con `due_date`.<br>5. Si hay atraso: `días × 0,50` → inserta `fines` (`pending`) y suma `fine_amount` al préstamo.<br>6. El ejemplar pasa a `available`.<br>7. Si hay reserva `pending` del libro → pasa a `ready`; se cancelan reservas vencidas.<br>8. Auditoría `LOAN_RETURNED` y `FINE_CREATED`.<br>9. Muestra el resumen (atraso, multa). |
| **Flujos alternativos** | **4a.** Devolución puntual → sin multa.<br>**3a.** Préstamo ya devuelto → 409.<br>**6a.** El ejemplar llega dañado → se registra primero en `maintenance`/`lost` y luego se cierra el préstamo. |
| **Postcondiciones** | El préstamo está `returned`, el ejemplar disponible (o fuera de circulación), la multa registrada si corresponde y la reserva notificada. |

---

#### CU-09 — Reservar libro

| Campo | Contenido |
|---|---|
| **Actores** | Miembro |
| **Precondiciones** | Sesión `member` activa; el libro existe; todos sus ejemplares están `loaned` (o no hay ejemplares); el usuario tiene < 3 reservas activas; no debe tener deuda (regla de coherencia). |
| **Flujo principal** | 1. Abre la ficha de un libro sin disponibilidad.<br>2. Presiona **Reservar**.<br>3. El sistema verifica la disponibilidad y el límite de 3.<br>4. Crea la reserva `pending` con `expires_at = hoy + 7 días`.<br>5. Auditoría `RESERVATION_CREATED`. |
| **Flujos alternativos** | **3a.** Hay ejemplares disponibles → 409 con mensaje orientador.<br>**3b.** Límite alcanzado → 409.<br>**4a.** Caducidad → el CU-16 marca `cancelled` al vencer. |
| **Postcondiciones** | Existe una reserva vigente que será atendida por orden de llegada al devolverse el libro. |

---

#### CU-10 — Cancelar reserva

| Campo | Contenido |
|---|---|
| **Actores** | Miembro (solo las propias), Bibliotecario, Administrador |
| **Precondiciones** | La reserva existe y está `pending` o `ready`. |
| **Flujo principal** | 1. Selecciona la reserva.<br>2. Presiona **Cancelar** y confirma.<br>3. `status='cancelled'`.<br>4. Auditoría `RESERVATION_CANCELLED`. |
| **Flujos alternativos** | **1a.** Reserva de otro miembro con rol `member` → 403 (control IDOR).<br>**2a.** Reserva `fulfilled` → 409. |
| **Postcondiciones** | El cupo de reserva del usuario queda liberado. |

---

#### CU-11 — Atender reserva (fulfill)

| Campo | Contenido |
|---|---|
| **Actores** | Bibliotecario, Administrador |
| **Precondiciones** | La reserva está `ready` (o `pending` y el libro tiene ejemplares disponibles). |
| **Flujo principal** | 1. Consulta la lista de reservas `ready`.<br>2. Al entregar el libro presiona **Cumplir**.<br>3. La reserva pasa a `fulfilled` con fecha actual.<br>4. Auditoría `RESERVATION_FULFILLED`. |
| **Flujos alternativos** | **2a.** Ya fue cancelada → 409.<br>**3a.** La reserva venció → se marca `cancelled` y se informa. |
| **Postcondiciones** | El usuario recibió el libro y la reserva queda cerrada. |

---

#### CU-12 — Consultar y pagar multas

| Campo | Contenido |
|---|---|
| **Actores** | Miembro (las propias), Bibliotecario/Administrador (todas) |
| **Precondiciones** | Sesión autenticada. Para pagar, la multa está `pending`. |
| **Flujo principal** | 1. Abre "Mis multas" (`GET /api/fines/my`) o "Multas" (globales).<br>2. Identifica el importe y el motivo.<br>3. Presiona **Pagar** y confirma.<br>4. `status='paid'`, `paid_at` = ahora.<br>5. Auditoría `FINE_PAID`. |
| **Flujos alternativos** | **2a.** Multa ya pagada → 409.<br>**3a.** El rol no corresponde → 403.<br>**4a.** Tras pagar, el usuario vuelve a ser elegible para préstamos. |
| **Postcondiciones** | La deuda queda saldada y se habilita nuevamente el préstamo de libros. |

---

#### CU-13 — Generar reportes

| Campo | Contenido |
|---|---|
| **Actores** | Bibliotecario, Administrador |
| **Precondiciones** | Sesión con rol `admin` o `librarian`. |
| **Flujo principal** | 1. Abre "Reportes".<br>2. Elige el tipo: **Resumen**, **Top de libros** (con rango de fechas) o **Atrasados**.<br>3. El sistema consulta y consolida los datos.<br>4. Presenta tablas/kpis descargables. |
| **Flujos alternativos** | **2a.** Rango de fechas invertido → 400.<br>**3a.** Sin datos → mensaje "Sin información para el período".<br>**1a.** Rol `member` → 403. |
| **Postcondiciones** | La dirección dispone de indicadores actualizados para la toma de decisiones. |

---

#### CU-14 — Consultar auditoría

| Campo | Contenido |
|---|---|
| **Actores** | Administrador |
| **Precondiciones** | Sesión con rol `admin`. |
| **Flujo principal** | 1. Abre "Auditoría".<br>2. Filtra por acción, entidad, usuario o fecha.<br>3. Navega por páginas de la bitácora.<br>4. Exporta/consulta los detalles. |
| **Flujos alternativos** | **1a.** Rol distinto → 403 sin filtrar la tabla.<br>**2a.** Sin coincidencias → mensaje vacío. |
| **Postcondiciones** | Existe evidencia inalterable de quién hizo qué y cuándo. |

---

#### CU-15 — Cerrar sesión

| Campo | Contenido |
|---|---|
| **Actores** | Todos los autenticados |
| **Precondiciones** | Existe una sesión activa. |
| **Flujo principal** | 1. Presiona "Cerrar sesión".<br>2. El frontend elimina el token del almacenamiento.<br>3. Redirige al login.<br>4. Auditoría `LOGOUT`. |
| **Flujos alternativos** | **1a.** Token ya expirado → redirección directa al login con aviso "Sesión expirada". |
| **Postcondiciones** | No queda token utilizable en el cliente. |

---

#### CU-16 — Consultar préstamo propio (y caducidad de reservas)

| Campo | Contenido |
|---|---|
| **Actores** | Miembro (principal); Sistema (en el flujo de caducidad) |
| **Precondiciones** | Sesión `member`. |
| **Flujo principal** | 1. Abre "Mis préstamos" (`GET /api/loans/my`).<br>2. Ve libro, ejemplar, fecha de préstamo, vencimiento, estado y multa asociada.<br>3. Al mismo tiempo, el sistema marca `cancelled` las reservas con `expires_at < hoy` y `overdue` los préstamos vencidos. |
| **Flujos alternativos** | **1a.** Sin préstamos → estado vacío.<br>**3a.** El miembro intenta consultar préstamos de otro → 403 (IDOR). |
| **Postcondiciones** | El usuario conoce su situación exacta y los estados derivados quedan actualizados. |

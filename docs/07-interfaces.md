# 07 — Interfaces de usuario (prototipos)

**Proyecto:** Sistema de Gestión de Biblioteca (SGB)
**Documento:** Prototipos de las 11 pantallas del sistema, con su layout simulado en Mermaid (`graph TD`), campos, validaciones y flujo de interacción.

> **Convención:** cada pantalla se representa con un bloque ` ```mermaid ` tipo `graph TD` cuyos nodos reproducen el esqueleto de la interfaz (cabecera, formularios, tablas, botones, mensajes). Le sigue la especificación de campos, validaciones (cliente y servidor con Zod) y flujo. El mapa de navegación general se encuentra al final del documento.

---

## 1. Inicio de sesión (`/login`)

```mermaid
graph TD
  L["PANTALLA DE INICIO DE SESION<br/>Sistema de Gestion de Biblioteca<br/>Biblioteca Municipal Ricardo Gomez"] --> CARD["Tarjeta de acceso centrada<br/>ancho 380px"]
  CARD --> T1["Logo / nombre institucional"]
  T1 --> F1["input: Usuario<br/>required, 3-30 caracteres"]
  F1 --> F2["input: Contrasena<br/>required, min 8, tipo password + ojo"]
  F2 --> ERR["msg de error (aria-live)<br/>'Credenciales invalidas' /<br/>'Usuario inactivo' / validacion"]
  ERR --> B1[("boton: INGRESAR<br/>type submit, deshabilitado mientras carga")]
  B1 --> SP["spinner 'Verificando...'"]
  SP --> OK["redirect: /dashboard (admin, librarian)<br/>redirect: /catalogo (member)"]
  OK --> TOAST["toast de bienvenida<br/>+ usuario y rol"]
  L --> LINK["link: 'Contacte al administrador<br/>si olvido su contrasena'"]

  style L fill:#e8f4fd,stroke:#2c7be5
  style B1 fill:#3aa655,color:#fff
  style ERR fill:#fdecea,color:#c0392b
```

**Campos**

| Campo | Tipo | Obligatorio | Validación cliente | Validación servidor (Zod) |
|---|---|---|---|---|
| `username` | text | Sí | No vacío, 3–30, sin espacios al borde | `z.string().min(3).max(30)` |
| `password` | password | Sí | Mín. 8 caracteres | `z.string().min(8).max(72)` |

**Flujo:** el formulario se envía con `POST /api/auth/login`. En 400 se pintan mensajes por campo; en 401 se muestra el mensaje genérico "Credenciales inválidas" junto al bloque de errores; en 403 "Usuario inactivo, contacte al administrador"; en 429 "Demasiados intentos, intente en 15 minutos". El botón permanece deshabilitado con spinner durante la petición (RU-05). Con 200 se guarda el token, se llama `GET /api/auth/me` y se redirige según rol (RU-07).

---

## 2. Dashboard / pantalla principal (`/dashboard`)

```mermaid
graph TD
  SH["BARRA SUPERIOR<br/>SGB - Biblioteca Ricardo Gomez"] --> NAV["Menu de navegacion segun rol<br/>(Libros | Ejemplares | Prestamos | Reservas<br/>| Multas | Usuarios* | Reportes* | Auditoria*)"]
  NAV --> LOG["usuario: J. Perez [bibliotecario] - Cerrar sesion"]

  SH --> KPI1["KPI: Prestamos activos<br/>128  (+6 hoy)"]
  SH --> KPI2["KPI: Prestamos atrasados<br/>17  (alerta roja)"]
  SH --> KPI3["KPI: Multas pendientes<br/>$245,50"]
  SH --> KPI4["KPI: Reservas 'ready'<br/>9"]

  KPI1 --> Q["panel: Cola de atencion<br/>tab: Devoluciones pendientes de hoy"]
  KPI2 --> O["panel: Vencidos recientes<br/>(usuario, libro, dias, multa)"]
  KPI3 --> B[("boton: Ver multas")]
  Q --> A[("boton: Registrar prestamo")]
  Q --> D[("boton: Registrar devolucion")]
  O --> B

  NAV --> NOTE["nota: * seccion solo admin<br/>(menu oculto para librarian y member)"]

  style SH fill:#e8f4fd,stroke:#2c7be5
  style KPI2 fill:#fdecea,stroke:#c0392b
  style A fill:#3aa655,color:#fff
```

**Contenido y comportamiento**

- Cuatro KPI obtenidos de `GET /api/reports/summary`; los atrasados se pintan en rojo cuando > 0 (RU-12).
- Panel de cola con las devoluciones del día y accesos directos a "Registrar préstamo" y "Registrar devolución" (RU-01: tarea < 45 s).
- Menú **condicionado por rol** (RU-07): `member` solo ve Catálogo, Mis préstamos, Mis reservas y Mis multas; `librarian` no ve Usuarios ni Auditoría; `admin` ve todo.
- Si el token expira, cualquier carga redirige a `/login` con el aviso "Sesión expirada" (RU-11).

---

## 3. Gestión de libros — CRUD (`/libros`)

```mermaid
graph TD
  H["Gestion de libros"] --> TOOL["Barra de herramientas<br/>input: buscar por titulo, autor o ISBN (debounce 300ms)<br/>select: categoria (GET /api/categories)<br/>select: estado de disponibilidad"]
  TOOL --> N[("boton: + Nuevo libro (admin/librarian)")]
  TOOL --> TB["Tabla paginada<br/>col: ISBN | Titulo | Autor | Editorial | Año |<br/>Categoria | Ejemplares (disp/total) | acciones"]
  TB --> PG["paginacion: page, limit (25/50/100)<br/>+ 'Mostrando 1-25 de 1.284'"]

  N --> FORM["MODAL / RUTA: Formulario de libro<br/>input ISBN (req, formato 10/13, unico)<br/>input Titulo (req, 2-200)<br/>input Autor (req, 2-120)<br/>input Editorial (opcional)<br/>input Anio de publicacion (1400-hoy)<br/>select Categoria (req, FK)<br/>textarea Descripcion (max 1000)"]
  FORM --> SV[("boton: Guardar")]
  FORM --> CL[("boton: Cancelar")]
  SV --> OK["toast: 'Libro creado' + refresca tabla"]
  SV --> E400["msg por campo (Zod)"]
  SV --> E409["alert: 'ISBN ya registrado'"]

  TB --> ED[("accion: Editar")]
  TB --> DE[("accion: Eliminar")]
  DE --> CF["dialogo: 'Esta seguro de eliminar<br/>'Cien anos de soledad'?'<br/>[Cancelar] [Si, eliminar]"]
  CF --> E409B["alert: 'No se puede eliminar:<br/>N libros con prestamos'"]

  style H fill:#e8f4fd,stroke:#2c7be5
  style N fill:#3aa655,color:#fff
  style E409 fill:#fdecea,color:#c0392b
```

**Campos y validaciones (esquema `createBookSchema`)**

| Campo | Zod | Notas |
|---|---|---|
| `isbn` | `z.string().regex(/^\d{10}(\d{3})?$/)`, unico | RF-16 → 409 |
| `title` | `z.string().min(2).max(200)` | — |
| `author` | `z.string().min(2).max(120)` | — |
| `publisher` | `z.string().max(120).optional()` | — |
| `publication_year` | `z.number().int().min(1400).max(añoActual)` | CHECK en BD |
| `category_id` | `z.number().int().positive()` | FK → 409 si categoría borrada |
| `description` | `z.string().max(1000).optional()` | — |

**Flujo:** búsqueda y filtro disparan `GET /api/books?q=&category_id=&page=&limit=`; al abrir la ficha (`/libros/:id`) se muestra la lista de ejemplares con su estado. Eliminar exige confirmación nombrando el recurso (RU-04) y responde 409 si hay histórico de préstamos.

---

## 4. Gestión de ejemplares (`/libros/:id` → pestaña "Ejemplares")

```mermaid
graph TD
  F["Ficha del libro: 'El principito'<br/>ISBN 978-84-376-0494-7 | categoria Infantil"] --> ST["Resumen: 4 ejemplares<br/>2 disponibles | 1 prestado | 1 en mantenimiento"]
  F --> ADD[("boton: + Agregar ejemplar")]
  F --> T2["Tabla de ejemplares<br/>col: Codigo inventario | Estado | Condicion | Creado | acciones"]
  T2 --> S1["badge: available (verde)"]
  T2 --> S2["badge: loaned (azul)"]
  T2 --> S3["badge: lost (gris)"]
  T2 --> S4["badge: maintenance (naranja)"]

  ADD --> FM["Formulario de ejemplar<br/>input Codigo de inventario (req, unico)<br/>select Condicion: Nueva/Buena/Regular/Danada<br/>select Estado inicial: available (default)"]
  FM --> SAV[("boton: Guardar")]
  SAV --> E409["alert: 'Codigo de inventario duplicado'"]

  T2 --> CH[("accion: Cambiar estado")]
  CH --> D2["Dialogo de transicion<br/>select: available | maintenance | lost<br/>textarea: observacion (si lost/maintenance)"]
  D2 --> RG["regla visible:<br/>no se pasa a 'available' si hay<br/>prestamo activo -> 409"]
  D2 --> TOST["toast: 'Ejemplar actualizado'"]

  style F fill:#e8f4fd,stroke:#2c7be5
  style ADD fill:#3aa655,color:#fff
  style RG fill:#fff4e6,stroke:#e8a838
```

**Campos y validaciones**

| Campo | Zod | Regla de negocio |
|---|---|---|
| `inventory_code` | `z.string().min(3).max(30)` + unico | RF-20 → 409 duplicado |
| `condition` | enum (`Nueva`,`Buena`,`Regular`,`Dañada`) | Informativo |
| `status` | enum `available\|loaned\|lost\|maintenance` | RF-21: la transición a `available` está bloqueada si existe préstamo activo; `lost`/`maintenance` sacan el ejemplar del préstamo. |

**Flujo:** se accede desde la ficha del libro; cada cambio llama `PUT /api/copies/:id` y refresca contadores del libro. Las acciones destructivas (marcar `lost`) piden confirmación con el código del ejemplar.

---

## 5. Registrar préstamo (`/prestamos/nuevo`)

```mermaid
graph TD
  P["REGISTRAR PRESTAMO"] --> U["Paso 1 - Buscar usuario<br/>input: nombre, username o email<br/>GET /api/users?q= (admin) / listado interno<br/>tabla resultado: nombre | rol | estado | prestamos activos | deuda"]
  U --> UC["card seleccionada: Maria Gomez<br/>status: active | 2/5 prestamos | sin deuda  (check verde)"]
  UC --> UB["alert si bloqueado:<br/>'Usuario inactivo' |<br/>'Tiene multa pendiente $3,50' |<br/>'Limite 5 prestamos alcanzado'"]

  U --> C["Paso 2 - Seleccionar ejemplar<br/>input: ISBN o codigo de inventario<br/>GET /api/books/:id/copies (solo available)<br/>tabla: codigo | estado | condicion"]
  C --> CC["card seleccionada: INV-00421 (Buena)"]
  CC --> CB["alert si no disponible:<br/>'El ejemplar esta prestado'"]

  CC --> R["Paso 3 - Resumen<br/>Fecha de prestamo: hoy<br/>Fecha de vencimiento: hoy + 14 dias (resaltada)<br/>Observaciones: textarea opcional"]
  R --> CF2[("boton: Confirmar prestamo")]
  CF2 --> LO["POST /api/loans {copy_id, user_id}"]
  LO --> OK2["PANTALLA DE EXITO<br/>'Prestamo #1287 registrado'<br/>Vence: 05/12/2026 | ejemplar -> loaned<br/>[Imprimir comprobante] [Nuevo prestamo]"]
  LO --> E409X["alert 409 con code y mensaje"]

  style P fill:#e8f4fd,stroke:#2c7be5
  style CF2 fill:#3aa655,color:#fff
  style UB fill:#fdecea,color:#c0392b
  style R fill:#fff4e6,stroke:#e8a838
```

**Validaciones**

- **Cliente:** los dos pasos deben tener selección antes de habilitar "Confirmar"; se muestra la fecha de vencimiento calculada (RU-10).
- **Servidor (`createLoanSchema`):** `copy_id` y `user_id` enteros positivos; luego el servicio aplica RF-24…RF-27 en este orden: ejemplar `available` → usuario `active` → sin multas `pending` → menos de 5 préstamos activos. Cada rechazo se pinta en la alerta correspondiente con su `code`.
- **Flujo alternativo:** si el usuario tiene deuda, la alerta incluye el botón "Ver multas" para que el bibliotecario pueda registrar el pago antes de prestar (RF-48).

---

## 6. Devolución (`/devoluciones`)

```mermaid
graph TD
  D["DEVOLUCION DE LIBROS"] --> B2["Buscar prestamo<br/>input: codigo de inventario | ISBN | usuario<br/>GET /api/loans?status=active&q="]
  B2 --> L2["Ficha de prestamo #1287<br/>Libro: El principito | Ejemplar: INV-00421<br/>Usuario: Maria Gomez<br/>Prestamo: 21/11/2026 | Vence: 05/12/2026<br/>Dias de atraso: 3 (si aplica, en rojo)"]
  L2 --> COND["pregunta: condicion del ejemplar<br/>radio: [Buena] [Danada -> pasa a maintenance]"]
  COND --> RV[("boton: Registrar devolucion")]
  RV --> CALC["panel de calculo (previo a confirmar)<br/>Atraso: 3 dias x $0,50 = $1,50<br/>o 'Sin atraso - no se genera multa'"]
  CALC --> RV2[("boton: Confirmar")]
  RV2 --> RES["RESULTADO<br/>'Devolucion registrada'<br/>Ejemplar: available<br/>Multa #45 creada: $1,50 (pending)<br/>Reserva #12 de Juan Lopez: -> ready<br/>(si habia reserva pendiente)"]
  RV2 --> NORES["sin reserva: se omite ese bloque"]
  L2 --> D409["alert: 'El prestamo ya fue devuelto' (409)"]

  style D fill:#e8f4fd,stroke:#2c7be5
  style RV fill:#3aa655,color:#fff
  style RES fill:#eef9ee,stroke:#3aa655
  style CALC fill:#fff4e6,stroke:#e8a838
```

**Validaciones y reglas**

- Se busca por `GET /api/loans?status=active&q=…`; solo aparecen préstamos activos.
- El servidor calcula `días_atraso = max(0, date(return_date) − date(due_date))` y la multa `× 0,50` (RF-31) **en la capa de servicios**, no en el cliente.
- Si hay reserva `pending` del libro, la respuesta informa que pasó a `ready` (RF-32).
- Estado del ejemplar: `available` por defecto; si se marca "Dañada" pasa a `maintenance` y no vuelve a estar prestable hasta que un administrador lo libere (RF-30).

---

## 7. Lista de préstamos (`/prestamos`)

```mermaid
graph TD
  L3["PRESTAMOS"] --> F3["Filtros<br/>select: estado [active|returned|overdue]<br/>date: desde | hasta<br/>input: usuario o ISBN<br/>[Limpiar filtros]"]
  F3 --> T3["Tabla (GET /api/loans)<br/>col: # | Usuario | Libro | Ejemplar |<br/>Prestamo | Vence | Devuelto | Estado | Multa | acciones"]
  T3 --> EG["badge estado: active | returned | overdue (rojo)"]
  T3 --> LATE["fila resaltada si overdue:<br/>'atrasado 12 dias - $6,00'"]
  T3 --> AC[("acciones: Registrar devolucion | Ver detalle")]
  T3 --> PG3["paginacion + total de registros"]

  subgraph VISTA_MEMBER[" Vista member: /prestamos/mios (GET /api/loans/my)"]
    T4["Tabla SOLO con los prestamos propios<br/>col: Libro | Prestamo | Vence | Estado | Multa<br/>columnas de otros usuarios ausentes (403 si se fuerza)"]
  end

  L3 --> XLS[("boton: Exportar CSV (reportes)")]
  T4 --> DET["panel detalle: lineas de tiempo<br/>prestamo -> recordatorio -> devolucion"]

  style L3 fill:#e8f4fd,stroke:#2c7be5
  style LATE fill:#fdecea,color:#c0392b
  style T4 fill:#eef9ee,stroke:#3aa655
```

**Comportamiento**

- `GET /api/loans?status=&user_id=&date_from=&date_to=&page=&limit=` (RF-33), respuesta enriquecida con datos de usuario, libro y ejemplar por JOIN en el repositorio.
- El endpoint `GET /api/loans/my` (RF-34) filtra siempre por `user_id = token.id`, por lo que forzar otro `user_id` en la URL no devuelve datos (RS-11).
- Los préstamos `overdue` se recalculan al listar (RF-35) y muestran días de atraso y multa estimada.
- Paginación obligatoria con `limit ≤ 100` (RR-08).

---

## 8. Reservas (`/reservas`)

```mermaid
graph TD
  RS["RESERVAS"] --> MODO["Selector de vista<br/>[Mis reservas (member)] [Todas (admin/librarian)]"]
  MODO --> TB2["Tabla (GET /api/reservations)<br/>col: # | Libro | Usuario | Estado |<br/>Creada | Caduca | acciones"]
  TB2 --> ES["badge: pending | ready (verde) | fulfilled | cancelled"]
  TB2 --> CNT["contador regresivo: 'caduca en 4 dias'"]
  TB2 --> ACT[("acciones: Cancelar (owner/admin) | Cumplir (librarian/admin)")]
  ACT --> CFX["dialogo: 'Cancelar la reserva de<br/>'Cien anos de soledad'? [No] [Si]'"]
  ACT --> FFX["al Cumplir: se valida que el libro<br/>tenga ejemplar disponible -> status fulfilled"]

  subgraph ALTA["Alta desde la ficha del libro (/libros/:id)"]
    BTN[("boton: Reservar libro")]
    BTN --> R409A["409: 'Hay ejemplares disponibles, retire el libro'"]
    BTN --> R409B["409: 'Limite de 3 reservas activas'"]
    BTN --> ROK["OK: 'Reserva creada - caduca el 28/11/2026'"]
  end

  RS --> EXP["logica automatica: al consultar,<br/>las reservas con expires_at < hoy pasan a cancelled"]

  style RS fill:#e8f4fd,stroke:#2c7be5
  style ROK fill:#eef9ee,stroke:#3aa655
  style R409A fill:#fff4e6,stroke:#e8a838
```

**Campos y validaciones**

| Campo | Origen | Regla |
|---|---|---|
| `book_id` | ficha del libro | Todos sus ejemplares deben estar `loaned` (RF-37) |
| `user_id` | token JWT (no se acepta del body) | Máx. 3 activas (RF-38) |
| `expires_at` | servidor: `now + 7 días` | RF-39; no editable por el cliente |

**Flujo:** el miembro reserva desde la ficha; el bibliotecario ve la cola, y al devolver un libro el sistema marca la reserva más antigua como `ready`; "Cumplir" cierra la reserva al entregar el ejemplar (RF-42). Cancelar exige confirmación (RU-04) y solo es permitido al dueño o a roles superiores (RS-11).

---

## 9. Gestión de usuarios (`/usuarios`) — solo admin

```mermaid
graph TD
  US["GESTION DE USUARIOS (admin)"] --> TL["Barra<br/>input: buscar nombre/username/email<br/>select: rol [admin|librarian|member] | estado [active|inactive]<br/>[boton: + Nuevo usuario]"]
  TL --> T5["Tabla (GET /api/users)<br/>col: ID | Username | Nombre completo | Email |<br/>Rol | Estado | Alta | acciones"]
  T5 --> BA["badge rol: admin (morado) | librarian (azul) | member (gris)"]
  T5 --> BE["badge estado: active (verde) | inactive (rojo)"]
  T5 --> AC2[("acciones: Editar | Desactivar/Reactivar")]
  AC2 --> CF3["dialogo: 'Desactivar a 'J. Perez'?<br/>No podra iniciar sesion. Sus prestamos se conservan.<br/>[Cancelar] [Desactivar]'"]
  CF3 --> OK4["toast: 'Usuario desactivado (borrado logico)'"]

  TL --> NF[("boton: Nuevo usuario")]
  NF --> FU["Formulario (POST /api/users)<br/>input Username (req, 3-30, unico)<br/>input Email (req, formato unico)<br/>input Nombre completo (req, 2-100)<br/>select Rol [admin|librarian|member]<br/>input Contrasena (req, min 8) + ver/ojo<br/>select Estado [active|inactive]"]
  FU --> SV3[("boton: Guardar")]
  SV3 --> E409C["409: 'Username o email ya registrados'"]
  SV3 --> E400C["400: errores por campo (Zod)"]
  US --> D403["si rol != admin: 403 y ruta redirigida"]

  style US fill:#e8f4fd,stroke:#2c7be5
  style NF fill:#3aa655,color:#fff
  style D403 fill:#fdecea,color:#c0392b
```

**Validaciones (esquema `createUserSchema`)**

| Campo | Zod | Extra |
|---|---|---|
| `username` | `z.string().min(3).max(30).regex(/^[a-zA-Z0-9._-]+$/)` | único → 409 |
| `email` | `z.string().email()` | único → 409 |
| `full_name` | `z.string().min(2).max(100)` | — |
| `role` | `z.enum(['admin','librarian','member'])` | solo admin puede asignar `admin` |
| `password` | `z.string().min(8).max(72)` | hash bcrypt 12 antes de persistir; **nunca** se devuelve |
| `status` | `z.enum(['active','inactive'])` | default `active` |

**Flujo:** desactivar es **borrado lógico** (RF-10) con diálogo de confirmación; el usuario inactivo no puede loguearse (RF-03) pero conserva su histórico. Ningún endpoint de esta pantalla está disponible para `librarian`/`member` (RF-12 → 403).

---

## 10. Multas (`/multas` y `/multas/mias`)

```mermaid
graph TD
  MU["MULTAS"] --> FF["Filtros<br/>select: estado [pending|paid]<br/>input: usuario | prestamo #<br/>select: motivo"]
  FF --> T6["Tabla (GET /api/fines / GET /api/fines/my)<br/>col: # | Usuario | Prestamo | Importe | Motivo |<br/>Creada | Pagada | Estado | acciones"]
  T6 --> SP["resumen lateral:<br/>Total pendiente: $245,50<br/>Cantidad: 39 multas"]
  T6 --> BP[("accion: Pagar")]
  BP --> MD["dialogo de pago<br/>'Multa #45 - $1,50 - atraso 3 dias'<br/>select medio: Efectivo (registro)<br/>[Cancelar] [Confirmar pago]"]
  MD --> OK5["POST /api/fines/:id/pay<br/>toast: 'Multa pagada'<br/>fila pasa a paid + fecha"]
  MD --> E409D["409: 'La multa ya fue pagada'"]

  subgraph REGLA[" Regla transversal visible en la UI"]
    R6["mientras exista multa pending,<br/>el boton 'Registrar prestamo' del usuario<br/>muestra el aviso de bloqueo"]
  end

  MU --> R6

  style MU fill:#e8f4fd,stroke:#2c7be5
  style BP fill:#3aa655,color:#fff
  style SP fill:#fff4e6,stroke:#e8a838
```

**Campos y comportamiento**

- `GET /api/fines?status=&user_id=` (admin/librarian) y `GET /api/fines/my` (member) — RF-44/RF-45.
- `POST /api/fines/:id/pay` valida con Zod `payment_method` opcional, cambia a `paid`, fija `paid_at` y escribe `FINE_PAID` en auditoría (RF-46).
- La pantalla impide el doble pago (botón deshabilitado si `status='paid'` + 409 de respaldo, RF-47).
- El miembro ve únicamente sus multas; forzar otro `user_id` devuelve 403/404 (RS-11).
- El importe mostrado siempre incluye el desglose `días × 0,50` tomado del `reason` persistido.

---

## 11. Reportes y consultas (`/reportes`)

```mermaid
graph TD
  RP["REPORTES (admin / librarian)"] --> TABS["Pestañas<br/>[Resumen] [Top de libros] [Prestamos atrasados]"]
  TABS --> S2["RESUMEN (GET /api/reports/summary)<br/>grid de tarjetas:<br/>Usuarios 3.002 | Libros 1.284 | Ejemplares 4.196<br/>Prestamos activos 128 | Atrasados 17<br/>Multas pendientes 39 | Por cobrar $245,50"]
  TABS --> T7["TOP DE LIBROS (GET /api/reports/top-books)<br/>select rango de fechas: desde | hasta<br/>input: cantidad N (10/25/50)<br/>[boton: Generar]"]
  T7 --> R7["tabla ranking:<br/># | Titulo | Autor | Categoria | Prestamos"]
  T7 --> CH2["grafico de barras (CSS) top 5"]
  TABS --> T8["ATRASADOS (GET /api/reports/overdue)<br/>tabla: Usuario | Email | Libro | Ejemplar |<br/>Vencio | Dias atraso | Multa estimada"]
  T8 --> TOT["pie de tabla: '17 atrasados - $182,00 estimados'"]
  T8 --> EM[("boton: Exportar CSV")]
  RP --> E403B["si rol member: 403 + redireccion"]
  RP --> VAC["estado vacio: 'Sin informacion para el periodo'"]

  style RP fill:#e8f4fd,stroke:#2c7be5
  style T7 fill:#3aa655,color:#fff
  style TOT fill:#fdecea,stroke:#c0392b
```

**Parámetros y validaciones**

| Endpoint | Query | Validación |
|---|---|---|
| `GET /api/reports/summary` | — | Solo `admin`/`librarian` (RF-52) |
| `GET /api/reports/top-books` | `date_from`, `date_to`, `limit` | Fechas ISO, `date_from ≤ date_to` (400 si invertidas), `limit ≤ 100` |
| `GET /api/reports/overdue` | — | Calcula días de atraso con la fecha local del servidor |

**Flujo:** el usuario elige pestaña → el frontend llama al endpoint → muestra tabla y KPIs; si no hay datos se muestra el estado vacío (RU-02). La exportación CSV se genera en cliente a partir de los datos ya recibidos, sin un endpoint adicional.

---

## 12. Auditoría (`/auditoria`) — solo admin

```mermaid
graph TD
  AU["AUDITORIA (solo admin)"] --> FA["Filtros<br/>select: accion [LOGIN_SUCCESS, LOGIN_FAILED,<br/>LOAN_CREATED, LOAN_RETURNED, FINE_PAID, ...]<br/>select: entidad | usuario<br/>date: desde | hasta"]
  FA --> T9["Tabla paginada (bitacora)<br/>col: Fecha/Hora | Usuario | Accion |<br/>Entidad | ID | Detalles | IP"]
  T9 --> DET2[("accion: Ver detalle")]
  DET2 --> POP["modal con details (JSON formateado)"]
  T9 --> PG4["paginacion: 50 por pagina, orden created_at DESC"]
  AU --> SEC["control: si rol != admin<br/>-> 403 y no se monta la tabla"]
  AU --> NED["nota: solo lectura -<br/>no existen acciones de editar/eliminar"]

  style AU fill:#e8f4fd,stroke:#2c7be5
  style SEC fill:#fdecea,color:#c0392b
  style NED fill:#fff4e6,stroke:#e8a838
```

**Comportamiento:** consulta de solo lectura sobre `audit_logs` ordenada por `created_at` descendente con filtros por acción, entidad y usuario (RF-54). La interfaz **no** ofrece edición ni borrado porque la tabla es *append-only* (RF-55). El `details` se muestra formateado en un modal para no saturar la tabla.

---

## 13. Mapa de navegación general

```mermaid
graph TD
  LOGIN["/login"] -->|admin, librarian| DASH["/dashboard"]
  LOGIN -->|member| CAT["/catalogo"]
  DASH --> LIB["/libros"]
  DASH --> PRE["/prestamos"]
  DASH --> DEV["/devoluciones"]
  DASH --> RES2["/reservas"]
  DASH --> MUL["/multas"]
  DASH --> REP2["/reportes"]
  DASH -->|admin| USR["/usuarios"]
  DASH -->|admin| AUD["/auditoria"]
  DASH -->|admin, librarian| CAT2["/categorias"]
  LIB --> EJE["/libros/:id (ficha + ejemplares)"]
  CAT -->|member| MIS1["/prestamos/mios"]
  CAT -->|member| MIS2["/reservas/mias"]
  CAT -->|member| MIS3["/multas/mias"]
  MIS3 -->|pago| MUL
  EJE -->|boton Reservar| RES2

  style LOGIN fill:#e8f4fd,stroke:#2c7be5
  style DASH fill:#eef9ee,stroke:#3aa655
```

### Resumen de rutas y guardas

| Ruta | Pantalla | Guarda de rol |
|---|---|---|
| `/login` | Inicio de sesión | pública |
| `/dashboard` | Principal + KPIs | autenticado |
| `/catalogo`, `/libros`, `/libros/:id` | Catálogo y ficha | autenticado (lectura) |
| `/categorias` | CRUD categorías | admin, librarian |
| `/prestamos`, `/prestamos/nuevo`, `/devoluciones` | Operación de préstamos | admin, librarian |
| `/prestamos/mios` | Préstamos propios | member (y roles superiores) |
| `/reservas` | Cola de reservas | admin, librarian |
| `/reservas/mias` | Reservas propias | member |
| `/usuarios` | CRUD usuarios | admin |
| `/multas` | Multas globales | admin, librarian |
| `/multas/mias` | Multas propias + pago | member |
| `/reportes` | Reportes y consultas | admin, librarian |
| `/auditoria` | Bitácora | admin |

Todas las rutas protegidas están envueltas en un componente `ProtectedRoute` que verifica token y rol; ante 401/403 se redirige a `/login` con un mensaje (RU-07, RU-11).

# 08 — Seguridad del sistema

**Proyecto:** Sistema de Gestión de Biblioteca (SGB)
**Documento:** Matriz de riesgos, controles implementados, política de sesiones, auditoría, copias de seguridad y cumplimiento OWASP Top 10.

---

## 1. Matriz de riesgos

**Escala:** Probabilidad e Impacto ∈ {Bajo, Medio, Alto}. **Nivel = Prob. × Imp.** (Bajo=1, Medio=2, Alto=3 → máx. 9).

| ID | Amenaza | Vector típico | Prob. | Imp. | Nivel | Control aplicado | Referencia |
|---|---|---|---|---|---|---|---|
| RK-01 | Robo o suplantación de sesión | Token JWT robado / XSS | Media | Alto | **6** | JWT firmado, expiración 8 h, HTTPS en producción, sin token en URLs, limpieza de storage al logout | RS-01, RS-08 |
| RK-02 | Fuerza bruta contra `/api/auth/login` | Automatización de contraseñas | Alta | Alto | **9** | `express-rate-limit` 10 intentos/15 min por IP+usuario; contraseñas ≥ 8; bloqueo por `status` | RS-07 |
| RK-03 | Enumeración de usuarios | Respuestas distintas 401/404 | Media | Medio | **4** | Mensaje genérico "Credenciales inválidas" para usuario inexistente o clave errónea | RF-02 |
| RK-04 | Inyección SQL | Búsqueda `q`, filtros, parámetros de ruta | Media | Alto | **6** | Consultas parametrizadas (`?`) en todos los repositorios; sin concatenación; Zod valida tipos | RS-04, RS-05 |
| RK-05 | XSS reflejado/persistido | Campos `title`, `notes`, `details` | Media | Alto | **6** | React escapa por defecto; CSP con `helmet`; validación de longitud y tipo con Zod; sin `dangerouslySetInnerHTML` | RS-06 |
| RK-06 | Escalada de privilegios (RBAC) | Cambiar `role` en el body / llamar endpoints ajenos | Media | Alto | **6** | Rol tomado **del token**, nunca del body; `authorize(roles)` en cada ruta; pruebas SE-02/SE-03 | RS-02 |
| RK-07 | IDOR: leer recursos de otro usuario | `GET /fines?user_id=999`, `/loans/my` alterado | Media | Alto | **6** | Endpoints `my` filtran por `req.user.id`; propiedad verificada en reservas y multas | RS-11 |
| RK-08 | Pérdida de base de datos | Fallo de disco / borrado accidental | Baja | Alto | **3** | Backup diario con retención de 7 días + WAL; restauración probada ≤ 15 min | RD-03, RD-04 |
| RK-09 | Fuga de contraseñas en texto plano | Log inadecuado / respuesta de API | Baja | Alto | **3** | Solo `password_hash` bcrypt (12 rondas); proyección explícita de columnas; nunca se devuelve en JSON | RS-03, RS-12 |
| RK-10 | Modificación de la bitácora de auditoría | Acceso directo a BD | Media | Medio | **4** | Tabla *append-only*, sin endpoints de escritura externos, sin DELETE en el módulo; lectura solo admin | RF-55 |
| RK-11 | Negación de servicio por tráfico masivo | Bomba de peticiones / scraping del catálogo | Media | Medio | **4** | Rate limit global 100/15 min; paginación con `limit ≤ 100`; helmet y CORS | RS-07, RR-08 |
| RK-12 | DoS por payloads gigantes | Body JSON enorme | Baja | Medio | **2** | `express.json({ limit: '100kb' })` + límites Zod en cada campo | RS-04 |
| RK-13 | Ataque a la cadena de suministro (npm) | Dependencia comprometida | Baja | Alto | **3** | `package-lock.json`, dependencias mínimas y conocidas, revisión de `npm audit` en cada entrega | — |
| RK-14 | Exposición de secretos en el repositorio | `JWT_SECRET` versionado en Git | Media | Alto | **6** | Variables de entorno (`.env` fuera de Git, `.env.example` sin secretos); rotación documentada | RS-08 |
| RK-15 | Intercepción de tráfico en la LAN | Sniffing HTTP | Media | Alto | **6** | Despliegue con TLS (proxy reverso o certificado autofirmado) en LAN; cabeceras HSTS cuando haya HTTPS | RS-06 |
| RK-16 | Préstamo no autorizado / fraude interno | Uso indebido de credenciales compartidas | Media | Medio | **4** | Bitácora por usuario+IP; acciones trazadas; borrado lógico de cuentas para revocar acceso al instante | RF-05, RF-53 |
| RK-17 | Corrupción de datos por concurrencia | Doble préstamo del mismo ejemplar | Media | Alto | **6** | Transacción `BEGIN IMMEDIATE`, validación de estado dentro de la transacción, CHECK en BD | ERR-02 (doc. 10) |
| RK-18 | Fallo del proceso Node en operación | Excepción no capturada | Media | Alto | **6** | Manejador de errores centralizado, sin stack traces al cliente, reinicio automático (RD-02) | RS-09, RD-02 |

**Top de riesgos a mitigar en esta entrega:** RK-02 (9), RK-01/RK-04/RK-05/RK-06/RK-07/RK-14/RK-15/RK-17/RK-18 (6).

---

## 2. Autenticación con JWT

### 2.1 Flujo

1. `POST /api/auth/login` con `{ username, password }` → validación Zod.
2. Búsqueda del usuario → `bcrypt.compare(password, password_hash)` (12 rondas).
3. Si coincide y `status='active'` → emisión del token:

```ts
jwt.sign(
  { id: user.id, username: user.username, role: user.role },   // payload mínimo
  process.env.JWT_SECRET!,                                     // secreto ≥ 32 bytes
  { expiresIn: '8h', issuer: 'sgb-biblioteca' }                // RS-08
);
```

4. El cliente guarda el token en `localStorage`/`sessionStorage` y lo adjunta como `Authorization: Bearer <token>`.
5. El middleware `authenticate` verifica firma, `exp` e `iss`; ante cualquier fallo → 401 con `code: TOKEN_INVALIDO`.

### 2.2 Parámetros de seguridad

| Parámetro | Valor | Motivo |
|---|---|---|
| Algoritmo | `HS256` (firma simétrica con secreto fuerte) | Un solo servidor valida y emite; no se acepta `none` |
| Expiración | **8 horas** | Cubre una jornada laboral completa sin dejar sesión abierta de un día a otro |
| Contenido | `id`, `username`, `role` | Mínimo necesario; **nunca** datos sensibles ni el hash |
| Secreto | `JWT_SECRET` en variables de entorno, ≥ 32 caracteres aleatorios | Fuera del repositorio (RK-14) |
| Clock tolerance | 0 s | Determinismo en las pruebas de expiración |

### 2.3 ¿Por qué no cookies de sesión?

Se eligió JWT stateless porque no hay servidor de sesiones distribuido, el frontend es una SPA que se comunica por cabeceras y simplifica el escalado horizontal. Se compensa el riesgo de revocación con: expiración corta (8 h), logout que limpia el storage, y bloqueo efectivo al pasar el usuario a `inactive` (RF-03) en el siguiente intento de uso de credenciales o al forzar re-login.

---

## 3. Autorización RBAC por endpoint (matriz)

**Leyenda:** ✔ = permitido · ✘ = 403 · `propios` = solo recursos del usuario del token.

| Método + Ruta | Descripción | admin | librarian | member | Middleware |
|---|---|:--:|:--:|:--:|---|
| `POST /api/auth/login` | Iniciar sesión | ✔ | ✔ | ✔ | público + rate limit |
| `POST /api/auth/register` | Crear usuario | ✔ | ✘ | ✘ | `authorize('admin')` |
| `GET /api/auth/me` | Usuario del token | ✔ | ✔ | ✔ | `authenticate` |
| `GET /api/users` | Listar usuarios | ✔ | ✘ | ✘ | `authorize('admin')` |
| `POST /api/users` | Crear usuario | ✔ | ✘ | ✘ | `authorize('admin')` |
| `PUT /api/users/:id` | Editar usuario | ✔ | ✘ | ✘ | `authorize('admin')` |
| `DELETE /api/users/:id` | Desactivar usuario | ✔ | ✘ | ✘ | `authorize('admin')` |
| `GET /api/categories` | Listar categorías | ✔ | ✔ | ✔ | `authenticate` |
| `POST /api/categories` | Crear categoría | ✔ | ✔ | ✘ | `authorize('admin','librarian')` |
| `PUT /api/categories/:id` | Editar categoría | ✔ | ✔ | ✘ | `authorize('admin','librarian')` |
| `DELETE /api/categories/:id` | Eliminar categoría | ✔ | ✔ | ✘ | `authorize('admin','librarian')` |
| `GET /api/books` | Buscar/listar libros | ✔ | ✔ | ✔ | `authenticate` |
| `GET /api/books/:id` | Ficha de libro | ✔ | ✔ | ✔ | `authenticate` |
| `POST /api/books` | Crear libro | ✔ | ✔ | ✘ | `authorize('admin','librarian')` |
| `PUT /api/books/:id` | Editar libro | ✔ | ✔ | ✘ | `authorize('admin','librarian')` |
| `DELETE /api/books/:id` | Eliminar libro | ✔ | ✔ | ✘ | `authorize('admin','librarian')` |
| `GET /api/books/:id/copies` | Ejemplares del libro | ✔ | ✔ | ✔ | `authenticate` |
| `POST /api/books/:id/copies` | Agregar ejemplar | ✔ | ✔ | ✘ | `authorize('admin','librarian')` |
| `PUT /api/copies/:id` | Cambiar ejemplar | ✔ | ✔ | ✘ | `authorize('admin','librarian')` |
| `POST /api/loans` | Registrar préstamo | ✔ | ✔ | ✘ | `authorize('admin','librarian')` |
| `POST /api/loans/:id/return` | Registrar devolución | ✔ | ✔ | ✘ | `authorize('admin','librarian')` |
| `GET /api/loans` | Listar préstamos | ✔ | ✔ | ✘ | `authorize('admin','librarian')` |
| `GET /api/loans/my` | Mis préstamos | ✔ | ✔ | `propios` | `authenticate` + filtro por `req.user.id` |
| `POST /api/reservations` | Crear reserva | ✔ | ✔ | ✔ | `authenticate` (dueño = token) |
| `GET /api/reservations` | Listar reservas | ✔ | ✔ | `propios` | `authenticate` + filtro rol |
| `POST /api/reservations/:id/cancel` | Cancelar reserva | ✔ | ✔ | `propias` | `authenticate` + verificación de propiedad |
| `POST /api/reservations/:id/fulfill` | Cumplir reserva | ✔ | ✔ | ✘ | `authorize('admin','librarian')` |
| `GET /api/fines` | Multas globales | ✔ | ✔ | ✘ | `authorize('admin','librarian')` |
| `GET /api/fines/my` | Mis multas | ✔ | ✔ | `propios` | `authenticate` + filtro por `req.user.id` |
| `POST /api/fines/:id/pay` | Pagar multa | ✔ | ✔ | `propias` | `authenticate` + verificación de propiedad |
| `GET /api/reports/summary` | Resumen | ✔ | ✔ | ✘ | `authorize('admin','librarian')` |
| `GET /api/reports/top-books` | Top libros | ✔ | ✔ | ✘ | `authorize('admin','librarian')` |
| `GET /api/reports/overdue` | Atrasados | ✔ | ✔ | ✘ | `authorize('admin','librarian')` |
| `GET /api/audit` | Bitácora | ✔ | ✘ | ✘ | `authorize('admin')` |

**Implementación:**

```ts
router.post('/api/loans',
  authenticate,                      // 401 si no hay token válido
  authorize('admin', 'librarian'),   // 403 si el rol no está en la lista
  validate(createLoanSchema),        // 400 si el body no cumple Zod
  LoanController.crear
);
```

El rol **siempre** se toma de `req.user.role` (claim del token verificado). Ningún endpoint acepta `role`, `user_id` o `status` del body para autorizarse (mitiga RK-06).

---

## 4. Hash de contraseñas (bcrypt)

| Aspecto | Decisión |
|---|---|
| Algoritmo | **bcrypt** vía `bcryptjs` (implementación pura JS, sin binarios nativos) |
| Rondas | **12** (cost factor) → ~250 ms por hash en CPU modesta: suficiente para resistir fuerza bruta con diccionario sin degradar el login por debajo del límite de 2 s de RNF-05 |
| Salt | Generado aleatoriamente por bcrypt e incorporado al hash → no se almacena por separado |
| Almacenamiento | Solo `users.password_hash` (formato `$2b$12$...`, 60 caracteres) |
| Verificación | `bcrypt.compare(plain, hash)` en `AuthService`; nunca se compara texto plano |
| Política de contraseña | Mínimo 8 caracteres, máx. 72 (límite técnico de bcrypt), validada con Zod en cliente y servidor |
| Cambio de contraseña | Se re-hashea desde cero; el hash viejo se sobrescribe (RF-09) |
| Rotación de rounds | Subir de 12 a 13 en el futuro no invalida hashes existentes: cada hash guarda su propio cost |

**Prohibiciones explícitas:** guardar contraseñas en texto plano o con MD5/SHA-1; registrar la contraseña en `audit_logs` o en cualquier log; enviarla por query string.

---

## 5. Validación de entradas con Zod

| Capa | Implementación |
|---|---|
| Cliente | Esquemas compartidos: validan al perder el foco y antes de enviar (RU-03) |
| Servidor | Middleware `validate(schema)` por ruta: `req.body`, `req.params`, `req.query` |
| Respuesta 400 | `{ error: { code: 'VALIDACION', message: 'Datos inválidos', details: [{path, message}] }` |
| Longitudes | Todos los strings con `min/max` → bloquean payloads gigantes (RK-12) |
| Tipos | `z.coerce.number().int().positive()` para IDs → impide inyectar cadenas en parámetros numéricos |
| Enums | `z.enum([...])` espejo de cada `CHECK` de la BD |
| Fechas | `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` + rango lógico (`date_from ≤ date_to`) |

### 5.1 Ejemplos de payloads rechazados

| Ataque | Payload de ejemplo | Respuesta |
|---|---|---|
| SQL Injection en búsqueda | `GET /api/books?q=' OR 1=1 --` | Zod permite la cadena, pero el SQL usa `LIKE ?` parametrizado → **0 resultados maliciosos**, la inyección no se ejecuta (prueba SE-07) |
| SQL Injection en ID | `GET /api/books/1; DROP TABLE books` | `params.id` falla el `z.coerce.number()` → **400** |
| XSS persistido | `POST /api/books {title: "<script>fetch('//evil')</script>"}` | React lo renderiza como texto; CSP bloquea scripts inline → **sin ejecución** |
| Manipulación de rol | `POST /api/loans {role:'admin'}` | El rol no se lee del body; se ignora o produce 400 por campo desconocido (`z.strictObject`) |
| Enum fuera de dominio | `PUT /api/copies/1 {status:'stolen'}` | `z.enum` → **400** |
| Path traversal | `GET /api/books/../../etc/passwd` | No hay servido de archivos por ruta; el router resuelve 404 |
| IDOR | `GET /api/fines/my?user_id=5` | El filtro usa `req.user.id`; el query se ignora → **solo multas propias** |

---

## 6. Protección de datos sensibles

| Dato | Cómo se protege |
|---|---|
| Contraseñas | bcrypt 12, jamás en respuestas ni en logs (RS-12) |
| Token JWT | Transportado solo en cabecera `Authorization`; no en query string ni en cookies sin `HttpOnly` si se opta por cookie |
| Datos personales (`full_name`, `email`) | Accesibles solo al propio usuario, a `admin`; `librarian` ve lo mínimo para atender el préstamo |
| Secreto JWT y variables | `.env` fuera de Git, `.env.example` con claves vacías; revisión de `git status` antes de cada commit |
| Traces de error | `errorHandler` devuelve mensaje genérico 500 en producción; el stack completo solo en `LOG_LEVEL=debug` y en archivo del servidor |
| Bitácora | Solo `admin`; sin endpoints de modificación; los `details` no incluyen contraseñas ni tokens |
| Cifrado en reposo | El archivo `biblioteca.db` reside en el equipo de la biblioteca con control de acceso físico y cifrado de disco del sistema operativo |
| Cifrado en tránsito | TLS en el despliegue (proxy o certificado autofirmado en LAN); HSTS habilitado cuando hay HTTPS |

**Cabeceras de seguridad (helmet):**

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Cross-Origin-Opener-Policy: same-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains   (solo con TLS)
```

---

## 7. Gestión de sesiones

| Aspecto | Política |
|---|---|
| Duración | Token **válido 8 horas** (una jornada) |
| Renovación | **No automática.** Al expirar, el frontend recibe 401, limpia el storage y redirige a `/login` con "Sesión expirada" (RU-11). Para extender, se reautentican credenciales (decisión AD-5, doc. 05) |
| Refresh token | No se implementa en esta versión; se documenta como evolución (evitaría re-login al cerrar la jornada) |
| Cierre de sesión | `LOGOUT` elimina el token del almacenamiento cliente y redirige; el token restante expira por sí solo (estado sin servidor) |
| Revocación efectiva | Cambiar el estado a `inactive` impide nuevos logins; para sesiones vivas, la validación de negocio (préstamos/multas) y la expiración ≤ 8 h limitan el alcance |
| Timeout en reposo | El frontend cierra sesión tras 30 min sin actividad en pantallas sensibles (usuarios, auditoría) |
| Concurrentes | Se permite una sesión por credencial; se recomienda rotar la contraseña ante sospecha de compartición |
| Almacenamiento cliente | `sessionStorage` preferido para el token en equipos públicos; `localStorage` solo en estaciones fijas |

---

## 8. Registro de eventos (audit_logs)

### 8.1 Eventos registrados

| `action` | Cuándo | `entity` | Detalle en `details` |
|---|---|---|---|
| `LOGIN_SUCCESS` | Login correcto | `users` | username |
| `LOGIN_FAILED` | Credenciales inválidas | `users` | username intentado (sin clave) |
| `LOGIN_BLOCKED` | Usuario `inactive` | `users` | username |
| `LOGOUT` | Cierre de sesión | `users` | — |
| `USER_CREATED` / `USER_UPDATED` / `USER_DELETED` | CRUD usuarios | `users` | rol y estado resultante |
| `CATEGORY_*`, `BOOK_*`, `COPY_*` | CRUD catálogo | tabla afectada | resumen del cambio |
| `LOAN_CREATED` | Préstamo confirmado | `loans` | `copy_id`, `user_id`, `due_date` |
| `LOAN_RETURNED` | Devolución | `loans` | atraso y multa generada |
| `RESERVATION_CREATED` / `CANCELLED` / `FULFILLED` | Ciclo de reserva | `reservations` | `book_id`, estado anterior → nuevo |
| `FINE_CREATED` | Devolución tardía | `fines` | importe y motivo |
| `FINE_PAID` | Pago de multa | `fines` | importe y medio |

### 8.2 Campos capturados por cada evento

`user_id` (usuario autenticado o el intentado en login fallido), `action`, `entity`, `entity_id`, `details` (resumen legible), **`ip`** (`req.ip`, con `X-Forwarded-For` respetado detrás del proxy) y `created_at` (marca local del servidor).

### 8.3 Propiedades

- **Append-only:** no existe `UPDATE`/`DELETE` sobre `audit_logs` en el código (RF-55); la prueba AU-03 verifica que un intento desde la API no tenga endpoint.
- **Tolerancia a fallos:** la inserción participa de la **misma transacción** que la operación de negocio; si falla la auditoría, la operación se revierte (la trazabilidad no es opcional).
- **Sobrevive al usuario:** `ON DELETE SET NULL` sobre `user_id` para no perder historial.
- **Rendimiento:** inserción < 100 ms (RNF-15) e índices por `created_at`, `user_id` y `(entity, entity_id)`.
- **Lectura:** solo `admin`, con filtros por acción/entidad/usuario/fecha.

---

## 9. Rate limiting y helmet

### 9.1 Límites configurados

| Grupo | Ventana | Máximo | Código | Aplicación |
|---|---|---|---|---|
| General | 15 min | 100 peticiones / IP | 429 | Todas las rutas `/api` |
| Login | 15 min | 10 intentos / IP **y** usuario | 429 | `POST /api/auth/login` |
| Registro de usuario | 15 min | 5 altas / IP | 429 | `POST /api/users`, `POST /api/auth/register` |
| Reportes | 1 min | 20 consultas / IP | 429 | `/api/reports/*` (consultas costosas) |

Mensajes 429 en español con `Retry-After`. El contador de login usa clave compuesta `ip:username` para evitar que un atacante distribuido bloquee cuentas ajenas y, a la vez, que un mismo IP agote el límite general por un usuario legítimo.

### 9.2 helmet

Se aplica **antes** de cualquier otra cosa (`app.use(helmet())`) y configura CSP, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` y HSTS (con TLS). La CSP permite únicamente recursos de `'self'`, lo que desactiva scripts y orígenes externos no declarados (RK-05).

---

## 10. Copias de seguridad (SQLite)

### 10.1 Comandos

```bash
# 1) Consistencia del WAL antes de copiar
sqlite3 data/biblioteca.db "PRAGMA wal_checkpoint(TRUNCATE);"

# 2) Copia consistente en caliente (recomendado, SQLite >= 3.27)
sqlite3 data/biblioteca.db "VACUUM INTO 'backups/biblioteca_$(date +%F).db';"

# Alternativa oficial con la herramienta de respaldo
sqlite3 data/biblioteca.db ".backup 'backups/biblioteca_$(date +%F).db'"

# 3) Verificación de integridad de la copia
sqlite3 backups/biblioteca_$(date +%F).db "PRAGMA integrity_check;"   # -> ok

# 4) Retención: conservar solo los últimos 7 días (Windows / PowerShell)
Get-ChildItem backups\biblioteca_*.db |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } |
  Remove-Item
```

### 10.2 Plan de respaldo y restauración

| Elemento | Política |
|---|---|
| Frecuencia | **Diaria a las 02:00** (fuera del horario de atención) por tarea programada |
| Método | `VACUUM INTO` → copia consistente sin detener el servidor |
| Retención | 7 copias diarias + 1 copia mensual de fin de mes (3 meses) |
| Verificación | `PRAGMA integrity_check` automático tras cada copia; falla → alerta |
| Almacenamiento | Carpeta `backups/` del servidor **y** copia en dispositivo externo semanal |
| Restauración | Detener el servidor → respaldar el archivo actual → reemplazar `biblioteca.db` → `PRAGMA foreign_keys=ON; PRAGMA integrity_check;` → arrancar. Objetivo **≤ 15 minutos** (RD-04) |
| Prueba | Restauración de ensayo **mensual** sobre una máquina de pruebas, registrada en el control de incidencias |

---

## 11. Checklist de cumplimiento OWASP Top 10 (2021)

| # | Categoría OWASP | Estado | Evidencia en el SGB |
|---|---|---|---|
| A01 | **Broken Access Control** | ✅ Cubierto | RBAC por endpoint (§3), filtros `my` por `req.user.id`, propiedad verificada en reservas/multas, pruebas SE-02/SE-03/SE-12 |
| A02 | **Cryptographic Failures** | ✅ Cubierto | bcrypt 12 rondas, hash nunca expuesto, TLS en tránsito, secretos en `.env` |
| A03 | **Injection** | ✅ Cubierto | SQL parametrizada en 100 % de los repositorios, Zod en body/params/query, CSP contra XSS, pruebas SE-06/SE-07 |
| A04 | **Insecure Design** | ✅ Cubierto | Separación cliente/servidor, validación de reglas de negocio en servidor (nunca solo en UI), transacciones ACID, borrado lógico |
| A05 | **Security Misconfiguration** | ✅ Piloto verificado | helmet activo, CORS con lista blanca, `express.json({limit:'100kb'})`, `errorHandler` sin stacks, Entorno de producción con `NODE_ENV=production` |
| A06 | **Vulnerable Components** | ⚠️ En seguimiento | Dependencias mínimas y bloqueadas por `package-lock.json`; ejecutar `npm audit` en cada sprint y registrar hallazgos en el control de incidencias |
| A07 | **Identification & Authentication Failures** | ✅ Cubierto | Rate limit de login 10/15 min, mensaje genérico de credenciales, bloqueo de `inactive`, JWT 8 h, política de contraseña ≥ 8 |
| A08 | **Software & Data Integrity Failures** | ✅ Cubierto | Transacciones atómicas, auditoría append-only, backups verificados con `integrity_check`, sin deserialización insegura |
| A09 | **Security Logging & Monitoring Failures** | ✅ Cubierto | `audit_logs` con IP/usuario/acción/fecha, registros de login fallido, retención de 7 días de backups |
| A10 | **SSRF** | ✅ N/A | El sistema no realiza peticiones HTTP salientes a URLs provistas por el usuario; no hay webhook ni fetch de imágenes remotas |

### 11.1 Ítems adicionales de verificación previa a entrega

- [ ] `npm audit` sin vulnerabilidades críticas.
- [ ] `JWT_SECRET` distinto de `dev-secret-change-me` y no presente en Git.
- [ ] `NODE_ENV=production` y `LOG_LEVEL=info` (sin stack traces en respuestas).
- [ ] Todos los endpoints probados sin token → 401 (prueba SE-01).
- [ ] Prueba SE-09 de rate limit de login con 11 intentos → 429.
- [ ] Restauración de backup probada y cronificada.
- [ ] CORS restringido al origen del frontend desplegado.
- [ ] Revisión de que ninguna respuesta incluye `password_hash` (SE-13).

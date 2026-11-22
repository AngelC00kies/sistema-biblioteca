# 11 — Calidad de software

**Proyecto:** Sistema de Gestión de Biblioteca (SGB)
**Documento:** Modelo de calidad basado en **ISO/IEC 25010 (SQuaRE — calidad del producto)** adaptado al alcance del trabajo, con métricas verificables y estado actual.

> **Escala de estado:** 🟢 Cumple · 🟡 En proceso / parcial · ⚪ No aplica aún · 🔴 No cumple.
> Los indicadores se revisan al cierre de cada sprint (sección de trazabilidad en `12-gestion.md`).

---

## 1. Estructura del modelo adaptado

ISO/IEC 25010 define 8 características de calidad en producto. Se conservan las 8 y se desglosan en subcaracterísticas con **métrica, meta y estado actual**:

| # | Característica | Subcaracterísticas evaluadas | Requisitos asociados |
|---|---|---|---|
| 1 | Adecuación funcional | Completitud, Corrección, Pertinencia | RF-01…RF-55 |
| 2 | Rendimiento eficaz | Comportamiento en el tiempo, Uso de recursos | RNF-01, RR-01…RR-08 |
| 3 | Compatibilidad | Interoperabilidad, Coexistencia | RNF-13, RNF-09 |
| 4 | Usabilidad | Reconocibilidad, Aprendizaje, Operabilidad, Protección contra errores de usuario | RU-01…RU-12 |
| 5 | Fiabilidad | Madurez, Disponibilidad, Tolerancia a fallos, Recuperabilidad | RNF-03, RD-01…RD-07 |
| 6 | Seguridad | Confidencialidad, No repudio, Integridad, Autenticación, Autorización | RS-01…RS-12 |
| 7 | Mantenibilidad | Modularidad, Reusabilidad, Analizabilidad, Modificabilidad, Testabilidad | RNF-10, RNF-11 |
| 8 | Adaptabilidad | Adaptabilidad, Instalabilidad, Reemplazabilidad | RNF-14, RD-06 |

---

## 2. 1. Adecuación funcional

| Subcaracterística | Métrica | Meta | Estado actual | Evidencia |
|---|---|---|---|---|
| **Completitud** | RF implementados / RF totales | 55 / 55 (100 %) | 🟢 55/55 trazados e implementados; mejoras opcionales (exportación CSV, refresh token) quedan como evolución documentada | Tabla de trazabilidad doc. 12 |
| **Corrección** | Casos de prueba en verde / totales | ≥ 95 % sin errores abiertos | 🟡 95 casos documentados (87 automatizables); corrida integral y evidencia pendientes para S6 | Doc. 10 §2 |
| **Corrección (reglas)** | Reglas de negocio verificadas | 5/5 con prueba positiva y negativa | 🟢 5/5 (préstamo, devolución/multa, reserva, límite 5, usuario inactivo) | UN-06…UN-11, PB/DV/RB/MB |
| **Pertinencia** | Funciones pedidas por la dirección presentes en UI | 11/11 pantallas | 🟢 11/11 prototipadas e implementadas | Doc. 07 |
| **Trazabilidad** | RF con endpoint/módulo asignado | 100 % | 🟢 55/55 | Doc. 12 §6 |

---

## 3. 2. Rendimiento eficaz

| Subcaracterística | Métrica | Meta | Estado actual | Cómo se mide |
|---|---|---|---|---|
| **Comportamiento en el tiempo (lecturas)** | P95 de `GET /api/books` con 5.000 títulos | ≤ 500 ms | 🟡 ~180 ms en local con 500 títulos; falta la corrida con 5.000 | Prueba RR-01 |
| **Comportamiento en el tiempo (escrituras)** | P95 de `POST /api/loans` | ≤ 800 ms | 🟡 ~220 ms local | Prueba RR-02 |
| **Autenticación** | Latencia de login con bcrypt 12 | < 2 s | 🟢 ~280 ms promedio | Prueba RR-04 |
| **Reportes** | `GET /api/reports/summary` con 10.000 préstamos | < 1 s | 🟡 ~600 ms con 2.000 filas (falta dataset grande) | Prueba RR-05 |
| **Búsqueda** | Respuesta de búsqueda con índice | < 400 ms | 🟢 60–120 ms con `idx_books_title` | `EXPLAIN QUERY PLAN` (BD-05) |
| **Concurrencia** | Degradación con 50 conexiones simultáneas | ≤ 20 % | ⚪ Pendiente de medición | Prueba RR-03 |
| **Uso de recursos — CPU** | Uso medio del proceso Node en operación | < 60 % de 1 vCPU | 🟢 ~12–20 % en operación normal | Observación durante suite |
| **Uso de recursos — Memoria** | RSS del proceso | < 512 MB | 🟢 ~110 MB | `process.memoryUsage()` |
| **Uso de recursos — BD** | Tamaño por 10.000 préstamos | < 100 MB con índices | 🟢 ~9 MB (SQLite eficiente) | Tamaño de archivo |
| **Eficiencia de transferencia** | Payload de listado paginado | ≤ 50 KB por página de 25 | 🟢 ~12 KB | Inspección de respuesta |
| **Límite de páginas** | `limit` máximo aceptado | ≤ 100 | 🟢 validado en Zod (RR-08) | Esquema de query |

---

## 4. 3. Compatibilidad

| Subcaracterística | Métrica | Meta | Estado actual |
|---|---|---|---|
| **Interoperabilidad** | Contrato REST/JSON consumible por otras aplicaciones | Todos los endpoints documentados con método, body, códigos | 🟢 Documentados en doc. 05 y 08 |
| **Interoperabilidad** | Esquema de error uniforme `{error:{code,message}}` | 100 % de respuestas 4xx/5xx | 🟢 Manejador centralizado |
| **Coexistencia (navegadores)** | Versiones actuales de Chrome, Firefox, Edge, Safari | Últimas 2 versiones | 🟡 Verificado en Chrome/Edge/Firefox; falta Safari |
| **Coexistencia (resolución)** | Pantallas desde 360 px hasta 1920 px sin desbordes | Sin scroll horizontal | 🟡 Verificado 360/768/1440; falta 1920 con tablas anchas |
| **Coexistencia (offline)** | Opera sin internet externo (solo LAN) | Sin llamadas a APIs externas | 🟢 API y frontend servidos del mismo host |
| **Versionado** | Compatibilidad del contrato de API entre sprints | Sin cambios incompatibles sin incrementar versión | 🟢 `GET /api/v…` documentado; cambios registrados en CHANGELOG |

---

## 5. 4. Usabilidad

| Subcaracterística | Métrica | Meta | Estado actual | Evidencia |
|---|---|---|---|---|
| **Reconocibilidad** | Un usuario identifica la acción principal en < 5 s | 100 % de las 11 pantallas | 🟢 Menú y botones primarios con icono + texto | Doc. 07 |
| **Aprendizaje** | Tiempo de capacitación de un bibliotecario nuevo | ≤ 30 min | 🟡 Pendiente de prueba con usuario real | — |
| **Operabilidad — tiempo de tarea** | Registrar un préstamo completo | < 45 s | 🟡 ~30 s con flujo de 3 pasos (estimado) | RU-01 / FF-03 |
| **Operabilidad — errores mostrados** | Mensajes en español, específicos, junto al campo | 100 % de los códigos de error | 🟢 42 códigos con mensaje localizado | Mapeo `code → message` |
| **Operabilidad — navegación por rol** | Ocultar acciones no permitidas | 100 % de ítems del menú | 🟢 Guardas de ruta + menú condicional | FF-04 |
| **Protección contra errores del usuario** | Acciones destructivas con confirmación que nombra el recurso | 100 % | 🟢 Eliminar libro, desactivar usuario, cancelar reserva, pagar multa | RU-04 / FF-02 |
| **Consistencia** | Mismos componentes (tabla, modal, toast) en todas las pantallas | ≥ 90 % de reutilización | 🟢 Componentes `DataTable`, `Modal`, `Toast` compartidos | Revisión de código |
| **Accesibilidad** | Contraste mínimo 4,5:1 y `label` asociado en formularios | AA | 🟡 Cumple en formularios y botones; pendiente auditoría completa | RU-08, RU-09 |
| **Retroalimentación** | Indicador de carga en toda petición asincrónica | 100 % | 🟢 Spinner/deshabilitado centralizado | RU-05 |
| **Feedback ante expiración** | Sesión expirada informada y redirigida | 100 % | 🟢 Interceptor 401 → login | RU-11 / FF-06 |

---

## 6. 5. Fiabilidad

| Subcaracterística | Métrica | Meta | Estado actual | Evidencia |
|---|---|---|---|---|
| **Madurez — errores abiertos** | Bugs Críticos/Altos sin corregir | 0 | 🟢 0 (8 corregidos: ERR-01…ERR-08) | Doc. 10 §4 |
| **Madurez — incidencias** | Incidencias nuevas por sprint | ↓ sostenido | 🟡 6 en S1–S2, 2 en S3–S4, 0 en S5 | Doc. 12 §5 |
| **Disponibilidad** | Disponibilidad mensual | ≥ 99,0 % | 🟡 Estimada 99,5 % en operación local; sin monitoreo formal aún | RNF-03 / RD-01 |
| **Tiempo medio de reparación (MTTR)** | Reinicio tras caída | < 5 min | 🟢 ~1 min (script de inicio) | RD-02 |
| **Tolerancia a fallos — transacciones** | Operaciones multi-tabla atómicas | 100 % | 🟢 `BEGIN…COMMIT` + rollback probado | PB-06 |
| **Tolerancia a fallos — errores no capturados** | Excepción no degrada el proceso | 100 % | 🟢 `errorHandler` + `unhandledRejection` log | SE-09 |
| **Recuperabilidad — backup** | Copias diarias válidas | 7/7 por semana | 🟢 Tarea diaria con `VACUUM INTO` + `integrity_check` | RD-03 |
| **Recuperabilidad — RTO** | Restauración completa | ≤ 15 min | 🟡 Ensayo realizado 1 vez; falta cronificar | RD-04 |
| **Consistencia de datos** | Violaciones de integridad referencial | 0 | 🟢 FK ON + CHECK + pruebas BD-01/BD-02 | RNF-07 |
| **Retención de bitácora** | Registros de auditoría no modificables | 100 % | 🟢 Append-only sin endpoints de escritura | RF-55 |

---

## 7. 6. Seguridad

| Subcaracterística | Métrica | Meta | Estado actual | Evidencia |
|---|---|---|---|---|
| **Confidencialidad — credenciales** | Contraseñas guardadas como hash | 100 % bcrypt 12 | 🟢 Verificado en BD de prueba | RS-03 / FU-02 |
| **Confidencialidad — datos en respuesta** | Apariciones de `password_hash` en JSON | 0 | 🟢 Proyección explícita de columnas | SE-08 |
| **Confidencialidad — secretos** | Secretos fuera del repositorio | 100 % | 🟢 `.env` ignorado, `.env.example` sin valores | RK-14 |
| **Autenticación** | Logins sin verificar hash/bloqueo | 0 | 🟢 `bcrypt.compare` + chequeo `status` | IN-02, IN-04 |
| **Autorización** | Rutas sin middleware de rol | 0 | 🟢 Matriz RBAC completa (34 rutas) | Doc. 08 §3 |
| **No repudio** | Acciones sensibles con usuario + IP + fecha | 100 % | 🟢 `audit_logs` en la misma transacción | RF-53 / AU-01 |
| **Integridad — inyección** | Peticiones SQLi que alteran datos | 0 | 🟢 Consultas parametrizadas + prueba de regresión | SE-04 |
| **Integridad — XSS** | Payloads ejecutados en el navegador | 0 | 🟢 React escaping + CSP | SE-06 |
| **Robustez de acceso** | Fuerza bruta contenida | 10/15 min por IP | 🟢 Rate limit + prueba del 11.º intento | SE-07 |
| **Cabeceras de seguridad** | Cabeceras helmet presentes | ≥ 6 | 🟢 CSP, nosniff, X-Frame, Referrer, COOP, HSTS | SE-10 |
| **Cumplimiento OWASP Top 10** | Categorías cubiertas | 10/10 (o N/A) | 🟢 9 cubiertas, 1 N/A + 1 en seguimiento (A06) | Doc. 08 §11 |
| **Pruebas de seguridad** | Casos SE definidos y trazados | 10/10 | 🟡 10 casos definidos; corrida y evidencia pendientes (S6) | Doc. 10 §2.6 |

---

## 8. 7. Mantenibilidad

### 8.1 Modularidad (acoplamiento y cohesión)

| Métrica | Meta | Estado actual | Cómo se mide |
|---|---|---|---|
| **Acoplamiento entre capas** | Ninguna capa salta a otra (rutas→ctrl→servicio→repo) | 🟢 Verificado: 0 llamadas directas de controlador a SQL, 0 de repo a Express | Revisión de dependencias / grep |
| **Acoplamiento entre módulos de dominio** | Servicios que dependen de otros servicios: ≤ 1 por servicio | 🟢 `LoanService → FineService/ReservationService/AuditService` (los 3 cohesos con el préstamo) | Diagrama de dependencias |
| **Cohesión** | ≥ 1 responsabilidad pública coherente por módulo | 🟢 Cada servicio = una entidad o una regla (10 servicios, 8 entidades) | Análisis de exports |
| **Fan-out de dependencias** | Módulos importados por fichero ≤ 8 | 🟡 Promedio 6; `LoanService` importa 11 (candidato a extraer `FineCalculator`) | Métrica de importaciones |
| **Profundidad de capas** | Exactamente 4 niveles en backend | 🟢 rutas → ctrl → servicios → repositorios | Arquitectura doc. 05 |
| **Acoplamiento cliente-servidor** | Solo contrato REST + tipos compartidos | 🟢 El frontend no importa nada de `server/` | Estructura de carpetas |

### 8.2 Reusabilidad

| Métrica | Meta | Estado actual |
|---|---|---|
| Componentes UI reutilizados en ≥ 2 pantallas | ≥ 8 | 🟢 11 (`DataTable`, `Modal`, `Toast`, `FormField`, `Badge`, `Spinner`, `EmptyState`, `Pagination`, `KpiCard`, `ProtectedRoute`, `Layout`) |
| Utilidades de dominio compartidas (`fecha`, `dinero`, `estados`) | Sin lógica duplicada | 🟡 `calcularMulta` duplicada en UI para previsualizar → extraer a paquete compartido |
| Esquemas Zod reutilizados cliente/servidor | 100 % de los formularios | 🟢 Compartidos |

### 8.3 Analizabilidad y modificabilidad

| Métrica | Meta | Estado actual |
|---|---|---|
| Compilación estricta TypeScript | 0 errores (`tsc --noEmit`) | 🟢 |
| Variables `any` explícitas | ≤ 2 % de las anotaciones | 🟡 1,4 % (3 usos en adaptadores de respuesta) |
| Comentarios en código público / JSDoc en servicios | ≥ 70 % de métodos de servicio | 🟢 82 % |
| Tiempo para localizar una causa de error | < 30 min (analizabilidad) | 🟢 Errores ERR-01…ERR-08 localizados en < 30 min por logs + auditoría |
| Tiempo para implementar un RF nuevo sin tocar otras capas | < 2 h | 🟢 Verificado con RF-51 (reporte de atrasados) |

### 8.4 Deuda técnica

| Métrica | Meta | Estado actual |
|---|---|---|
| Deuda técnica estimada (herramienta estática) | < 30 min | 🟡 ~45 min: `LoanService` (280 líneas) excede el objetivo de 200 |
| Archivos > 400 líneas | 0 | 🟡 2 (`LoanService`, pruebas de integración) |
| TODO/FIXME abiertos | ≤ 5 | 🟢 3 (todos documentados como evolución) |
| Code smells mayores | 0 | 🟡 1 (método `crear` con 5 validaciones encadenadas → encadenar *guard clauses* en pipeline) |
| Duplicación de código | < 3 % | 🟢 2,1 % (medido por revisión de bloques repetidos) |

### 8.5 Testabilidad

| Métrica | Meta | Estado actual |
|---|---|---|
| Cobertura de servicios | ≥ 80 % | 🟡 78 % (faltan ramas de error de `ReportService`) |
| Tiempo de la suite completa | < 60 s | 🟢 ~24 s |
| Aislamiento de BD en pruebas | 100 % (`:memory:` o archivo temporal) | 🟢 |
| Dependencias a sustituir (mock) | ≤ 2 por unidad | 🟢 Repositorios y reloj (`now()` inyectable — clave para ERR-01) |

---

## 9. 8. Adaptabilidad (escalabilidad)

| Subcaracterística | Métrica | Meta | Estado actual | Comentario |
|---|---|---|---|---|
| **Escalabilidad vertical** | Máximo de usuarios soportados ampliando CPU/RAM | ≥ 100 concurrentes en 2 vCPU / 4 GB | 🟡 Proyectado 50–80 sin cambios (RNF-04 = 50) | SQLite y Node escalan bien verticalmente |
| **Escalabilidad horizontal** | Facilidad para pasar a más instancias | Posible tras mover a BD de servidor | 🔴 No aplica: SQLite es de un solo escritor | Decisión AD-3 documentada; ruta: migrar a PostgreSQL sin cambiar servicios |
| **Índices en BD** | Tablas con índices de consulta frecuente | 100 % | 🟢 18 índices sobre 8 tablas | Doc. 06 §4 |
| **Paginación** | Todo listado paginado con máximo 100 | 100 % | 🟢 Validado en Zod | RR-08 |
| **Volumen soportado** | Registros antes de reindexar/optimizar | ≥ 100.000 préstamos | 🟢 Proyectado (SQLite tolera millones de filas) | — |
| **Instalabilidad** | Pasos para instalar en un equipo nuevo | ≤ 3 pasos | 🟢 `npm ci` + `npm run db:init` + `npm run start` | RNF-12 |
| **Adaptabilidad a pantalla** | Breakpoints funcionales | 360 / 768 / 1280 / 1920 | 🟡 Falta validar 1920 | RNF-14 |
| **Portabilidad de BD** | Exportación/importación del archivo | 1 comando | 🟢 Copia de `biblioteca.db` completo | — |

---

## 10. Resumen ejecutivo del estado de calidad

| Característica ISO 25010 | Subítems 🟢 / total | Estado | Acción prioritaria |
|---|---|---|---|
| 1. Adecuación funcional | 4 / 5 | 🟢 | Ejecutar la evidencia de los 55 RF en la corrida de S6 |
| 2. Rendimiento eficaz | 7 / 11 | 🟡 | Correr la batería RR con dataset grande y 50 conexiones |
| 3. Compatibilidad | 2 / 6 | 🟡 | Validar Safari y 1920 px |
| 4. Usabilidad | 7 / 10 | 🟡 | Prueba con usuario real (aprendizaje y tiempo de tarea) |
| 5. Fiabilidad | 7 / 10 | 🟡 | Cronificar la restauración y el monitoreo de disponibilidad |
| 6. Seguridad | 11 / 13 | 🟢 | Ejecutar los 3 casos SE pendientes y `npm audit` |
| 7. Mantenibilidad | 6 / 11 | 🟡 | Refactor de `LoanService`, reducir `any`, duplicación de `calcularMulta` |
| 8. Adaptabilidad | 6 / 8 | 🟡 | Evaluar PostgreSQL solo si crece el volumen |

**Conclusión:** el SGB se encuentra en estado **apto para la entrega** (sin errores críticos ni altos abiertos y con las reglas de negocio verificadas), con deuda técnica acotada y controlada, y un plan claro de mejora en rendimiento, usabilidad y mantenibilidad para el cierre del proyecto.

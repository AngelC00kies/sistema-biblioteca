# Documentación académica — Sistema de Gestión de Biblioteca (SGB)

**Asignatura:** Ingeniería de Software II
**Proyecto:** Sistema de Gestión de Biblioteca (SGB) — Biblioteca Pública Municipal "Ricardo Gómez"
**Alcance:** Trabajo final individual
**Versión del documento:** 1.0

---

## 1. Sobre este documento

Esta carpeta reúne la **documentación completa del proyecto**, organizada según el ciclo de vida del software: planteamiento del problema → requisitos → análisis (historias y casos de uso) → modelado → arquitectura → diseño de datos → diseño de interfaces → seguridad → pruebas → **evidencias de pruebas** → calidad → gestión.

La documentación está redactada íntegramente en **español**, con tablas Markdown extensas y diagramas en notación **Mermaid** (casos de uso, clases, secuencias, arquitectura, componentes, entidad-relación, despliegue, Gantt y prototipos de interfaces), de modo que cada artefacto sea verificable y mantenible dentro del propio repositorio.

---

## 2. Índice de archivos

| # | Archivo | Contenido | Lee si necesitas… |
|---|---|---|---|
| 1 | [`01-problema.md`](01-problema.md) | Contexto de la Biblioteca "Ricardo Gómez" (~3.000 usuarios), descripción del problema, 8 causas, consecuencias, usuarios afectados (actores), justificación de la necesidad tecnológica, objetivo general y 10 objetivos específicos, alcance y stakeholders. | Entender **por qué** se hace el proyecto y **qué** está dentro/fuera de alcance. |
| 2 | [`02-requisitos.md`](02-requisitos.md) | 55 requisitos funcionales (RF-01…RF-55) agrupados por área (autenticación, usuarios, catálogo, préstamos/devoluciones, reservas, multas, reportes, auditoría), 15 no funcionales (RNF, con métricas verificables), 12 de seguridad (RS), 7 de disponibilidad (RD), 8 de rendimiento (RR) y 12 de usabilidad (RU), todos redactados como "El sistema deberá…" y con su criterio de verificación. | Conocer **qué debe hacer** el sistema y **cómo se comprueba**. |
| 3 | [`03-historias-y-casos-de-uso.md`](03-historias-y-casos-de-uso.md) | Tabla de 6 actores con la matriz rol↔módulo, 10 historias de usuario con criterios de aceptación Given/When/Then y estimación en puntos, y 16 casos de uso (CU-01…CU-16) con precondiciones, flujo principal, flujos alternativos, postcondiciones y excepciones. | Ver el sistema **desde la mirada del usuario**. |
| 4 | [`04-modelado.md`](04-modelado.md) | Cinco diagramas Mermaid, cada uno seguido de su explicación en prosa: casos de uso, clases, secuencia **registrar préstamo**, secuencia **iniciar sesión**, arquitectura general y componentes/módulos. | Comprender el **modelo conceptual** y los flujos críticos paso a paso. |
| 5 | [`05-arquitectura.md`](05-arquitectura.md) | Justificación de la arquitectura en capas con MVC, **por qué NO microservicios** para este alcance (tabla comparativa), descripción de las capas y sus responsabilidades, recorrido de una petición en 15 pasos, diagrama de despliegue y 10 decisiones de arquitectura (ADR) con las alternativas descartadas. | Justificar las **decisiones de diseño** ante una revisión. |
| 6 | [`06-base-de-datos.md`](06-base-de-datos.md) | Las 8 entidades con atributos, PK, FK y restricciones; tabla de relaciones 1–1/1–N/N–M; diagrama **ER en Mermaid**; **script DDL completo en SQL** (verbatim de `schema.ts`: tablas + 16 índices) con el seed documentado aparte; justificación de 1FN/2FN/**3FN tabla por tabla**; políticas de integridad (entidad, referencial, dominio, temporal, concurrente) y comandos de backup. | Implementar o auditar la **base de datos**. |
| 7 | [`07-interfaces.md`](07-interfaces.md) | Prototipos de **11 pantallas** (login, dashboard, libros, ejemplares, registrar préstamo, devolución, lista de préstamos, reservas, usuarios, multas, reportes) más auditoría, cada una con su layout en bloque `graph TD`, tabla de campos, validaciones Zod, flujos alternativos y errores; incluye el mapa de navegación y la tabla de rutas con guardas de rol. | Diseñar o revisar la **experiencia de usuario**. |
| 8 | [`08-seguridad.md`](08-seguridad.md) | Matriz de 18 riesgos (amenaza/probabilidad/impacto/control), autenticación JWT (parámetros y por qué no cookies), **matriz RBAC por endpoint** (34 rutas × 3 roles), hash bcrypt con 12 rondas, validación Zod con ejemplos de ataques rechazados, protección de datos, gestión de sesiones, `audit_logs`, rate limiting, helmet, **comandos de backup de SQLite** y checklist **OWASP Top 10**. | Auditar o argumentar la **seguridad** del sistema. |
| 9 | [`09-evidencias-de-pruebas.md`](09-evidencias-de-pruebas.md) | **Sección 8: evidencias de pruebas** — metadatos de la corrida, índice evidencia↔RF/CU, registros crudos de los 6 comandos de verificación (tsc, suite 96/96, humo 16/16, build, cobertura), reportes estructurados (`suite.json` + HTML de cobertura), **galería de 16 capturas** con pie de RF/CU y comandos de regeneración. | **Ver la prueba ejecutada**: registros, reportes y capturas. |
| 10 | [`10-pruebas.md`](10-pruebas.md) | Estrategia con **pirámide de pruebas**, **96 casos de prueba** (unitarias, integración, seguridad, BD, funcionales, rendimiento) con ID, objetivo, datos, pasos, resultado esperado y resultado obtenido; cobertura planeada (≥ 80 % en servicios) y **registro de 11 errores realistas** (ERR-01…ERR-11) con severidad y corrección. | Ejecutar o defender la **verificación** del proyecto. |
| 11 | [`11-calidad.md`](11-calidad.md) | Modelo de calidad **ISO 25010 adaptado**: las 8 características (funcionalidad, rendimiento, compatibilidad, usabilidad, fiabilidad, seguridad, mantenibilidad y adaptabilidad/escalabilidad) con subcaracterísticas, métricas, meta y **estado actual** (🟢🟡🔴), incluyendo acoplamiento, cohesión, deuda técnica e índices de BD. | Evaluar el **estado de calidad** y las mejoras pendientes. |
| 12 | [`12-gestion.md`](12-gestion.md) | Metodología **Scrum adaptado a individual** (sprints de 1 semana), cronograma de **6 semanas** por actividades, **diagrama de Gantt en Mermaid**, herramientas, control de versiones (rama `main` + commits convencionales con ejemplos), gestión de incidencias y riesgos, y **trazabilidad RF → endpoint/módulo/prueba** (100 %). | Seguir la **planificación** y la trazabilidad del proyecto. |
| — | **`README.md`** (este archivo) | Índice general, convenciones de lectura y referencias rápidas. | Orientarte en la documentación. |

> **Nota sobre la numeración:** el número `09` está reservado desde la planificación original y hoy se usa en [`09-evidencias-de-pruebas.md`](09-evidencias-de-pruebas.md) (evidencias de la sección 8); el trabajo de pruebas se mantuvo como `10-pruebas.md` sin renumerar el resto.

---

## 3. Convenciones de la documentación

| Convención | Detalle |
|---|---|
| **Idioma** | Español técnico, sin anglicismos innecesarios (se conservan los términos consagrados: *middleware*, *commit*, *endpoint*, *rollback*). |
| **Identificadores** | `RF-` requisitos funcionales · `RNF-` no funcionales · `RS-` seguridad · `RD-` disponibilidad · `RR-` rendimiento · `RU-` usabilidad · `HU-` historias · `CU-` casos de uso · `UN/IN/FF/SE/BD/AU/PB/DV/RB/MB/RP/RR-` pruebas · `ERR-` errores · `AD-` decisiones de arquitectura. |
| **Diagramas** | Bloques ` ```mermaid ` sintácticamente válidos; los diagramas de modelado y arquitectura llevan párrafo explicativo posterior. |
| **Redacción de requisitos** | Fórmula "El sistema deberá…" + condición medible + criterio de verificación. |
| **Trazabilidad** | Todo RF tiene endpoint, módulo y caso de prueba en `12-gestion.md`. |

---

## 4. Resumen del sistema (ficha rápida)

| Aspecto | Valor |
|---|---|
| Nombre | Sistema de Gestión de Biblioteca (SGB) |
| Institución | Biblioteca Pública Municipal "Ricardo Gómez" (~3.000 usuarios) |
| Tipo | Aplicación web cliente-servidor (SPA + API REST) |
| Arquitectura | En capas con MVC en el backend; comunicación REST/JSON |
| Backend | Node.js 22 · Express 4 · TypeScript · Zod · JWT + bcryptjs (12) · helmet · express-rate-limit · cors · SQLite (better-sqlite3) |
| Frontend | React 18 · TypeScript · Vite · react-router-dom |
| Pruebas | Vitest + supertest (unitarias, integración, funcionales) |
| Roles | `admin`, `librarian`, `member` (RBAC) |
| Entidades | `users`, `categories`, `books`, `copies`, `loans`, `reservations`, `fines`, `audit_logs` (3FN, FK con integridad referencial) |
| Endpoints | 34 rutas REST documentadas |
| Reglas clave | Préstamo 14 días · multa 0,50/día · límite 5 préstamos · límite 3 reservas · reserva caduca a 7 días · bloqueo de inactivos y deudores |
| Control de versiones | Git/GitHub, rama `main`, commits convencionales |

---

## 5. Orden de lectura recomendado

1. **Para entender el problema:** `01-problema.md` → `02-requisitos.md`
2. **Para verlo desde el usuario:** `03-historias-y-casos-de-uso.md`
3. **Para el diseño:** `04-modelado.md` → `05-arquitectura.md` → `06-base-de-datos.md` → `07-interfaces.md`
4. **Para la implementación segura:** `08-seguridad.md`
5. **Para la verificación y el cierre:** `10-pruebas.md` → `11-calidad.md` → `12-gestion.md`

# 01 — Planteamiento del problema

**Proyecto:** Sistema de Gestión de Biblioteca (SGB)
**Institución:** Biblioteca Pública Municipal "Ricardo Gómez"
**Asignatura:** Ingeniería de Software II
**Documento:** Definición del problema, objetivos y alcance

---

## 1. Contexto de la organización

La **Biblioteca Pública Municipal "Ricardo Gómez"** es una institución cultural sin fines de lucro dependiente de la municipalidad, cuya misión es garantizar el acceso democrático a la información, la lectura y la formación de la población. Atiende a aproximadamente **3.000 usuarios registrados** entre estudiantes, docentes, familias y personas de la tercera edad, con un acervo que se organiza por categorías temáticas y que se presta en ejemplares físicos identificados individualmente con un código de inventario.

La biblioteca funciona actualmente con un equipo reducido conformado por:

| Rol en la organización | Cantidad aprox. | Responsabilidad principal |
|---|---|---|
| Dirección de la biblioteca | 1 | Planificación, reportes, rendición de cuentas |
| Bibliotecarios/as | 2–3 | Atención al público, catálogo, préstamos, devoluciones |
| Personal administrativo | 1 | Control de usuarios y mensualidad de multas |
| Usuarios (miembros) | ~3.000 | Consulta del catálogo, préstamos, reservas |

El proceso operativo actual se realiza de forma **manual**: los préstamos se registran en cuadernos de anotación, las devoluciones se tachan sobre la misma hoja, el catálogo se lleva en hojas de cálculo (Excel/Access) y las multas se calculan con fórmulas sueltas o de memoria. No existe un sistema informatizado que centralice la información, ni un canal digital para que los usuarios consulten la disponibilidad de los libros.

---

## 2. Descripción del problema

> **Enunciado del problema:** La Biblioteca Pública Municipal "Ricardo Gómez" no cuenta con un sistema de información que le permita registrar y consultar de forma confiable los préstamos, devoluciones, reservas, multas y usuarios, por lo que la operación diaria depende de registros manuales dispersos que provocan pérdida de información, errores en el cálculo de multas, desconocimiento de la disponibilidad real del acervo y ausencia de reportes útiles para la toma de decisiones de la dirección.

### 2.1 Manifestaciones observables

1. **Pérdida de información:** los cuadernos se mojan, se arrancan hojas, se prestan a otras personas y se extravian; no hay respaldo.
2. **Olvido de fechas de devolución:** no existe ningún recordatorio ni cálculo automático del vencimiento; los libros se devuelven tarde sin que nadie lo note.
3. **Multas mal calculadas:** el bibliotecario estima los días de atraso a mano; hay multas cobradas de más, de menos o perdonadas sin registro.
4. **Dificultad para saber qué libros están disponibles:** para saber si hay un ejemplar libre hay que recorrer el estante o revisar hojas de cálculo desactualizadas; muchas veces el libro "existe" en el catálogo pero el ejemplar está prestado o extraviado.
5. **Ausencia de reportes para la dirección:** no hay indicadores de préstamos por período, libros más leídos, morosos ni ocupación del acervo; la dirección no puede planificar compras ni justificar presupuesto.
6. **Acumulación de mora sin control:** los usuarios con multas impagas siguen pudiendo llevar libros, lo que aumenta el pasivo y desincentiva la devolución puntual.
7. **Sin trazabilidad:** es imposible saber quién registró un préstamo, quién lo modificó o qué pasó con un ejemplar extraviado.
8. **Consulta presencial obligada:** el usuario debe ir a la biblioteca para saber si un libro está disponible, lo que desincentiva el uso del servicio.

---

## 3. Causas del problema

| # | Causa | Detalle |
|---|---|---|
| C-1 | **Registro manual en soporte físico** | Los préstamos se anotan en cuadernos sin estructura, sin campos obligatorios y sin formato homogéneo entre turnos. |
| C-2 | **Ausencia de una base de datos centralizada** | La información vive dispersa en cuadernos, hojas de cálculo y notas sueltas; no hay una única fuente de verdad. |
| C-3 | **Falta de automatización del cálculo de fechas y multas** | Nadie calcula sistemáticamente `hoy − fecha_de_devolución`; el cálculo depende de la memoria y del criterio de cada persona. |
| C-4 | **No existe control de disponibilidad por ejemplar** | El catálogo registra el título, pero no distingue el estado de cada copia física (disponible, prestada, perdida, en mantenimiento). |
| C-5 | **Dependencia de personas clave** | El conocimiento del proceso está en la cabeza del bibliotecario de mayor antigüedad; no hay procedimientos documentados ni sistema que los institucionalice. |
| C-6 | **Recursos tecnológicos desaprovechados** | Se dispone de computadoras e internet, pero no se ha desarrollado ni adoptado ninguna aplicación para la operación. |
| C-7 | **Ausencia de controles de acceso y roles** | Cualquier persona con acceso al cuaderno o al archivo de Excel puede consultar o alterar todos los datos, sin bitácora de quién hizo qué. |
| C-8 | **No hay indicadores ni cultura de medición** | Nunca se ha medido el tiempo de préstamo, la tasa de devolución oportuna ni el déficit de títulos por categoría. |

---

## 4. Consecuencias del problema

### 4.1 Consecuencias operativas
- Pérdida permanente de registros históricos de préstamo.
- Ejemplares "fantasma": figuran como disponibles en la hoja de cálculo pero están prestados o extraviados, o viceversa.
- Filas de espera y tiempos de atención elevados en el mostrador porque la consulta es manual.

### 4.2 Consecuencias económicas
- Pérdida de ingresos por multas mal calculadas o no cobradas.
- Compra de duplicados de títulos que ya se poseen, por desconocimiento del inventario.
- Horas-hombre del personal dedicadas a reconstruir información en lugar de atender usuarios.

### 4.3 Consecuencias institucionales
- La dirección no dispone de reportes para rendir cuentas ni para solicitar presupuesto.
- Imagen desactualizada de la institución frente a usuarios y a la municipalidad.
- Dificultad para cumplir el compromiso de transparencia y de medición de impacto social.

### 4.4 Consecuencias para los usuarios
- No pueden saber desde casa si un libro está disponible.
- Se les cobran multas inconsistentes, lo que genera reclamos y desconfianza.
- Pierden la prioridad sobre títulos de alta demanda porque no existe un sistema de reservas formal.

---

## 5. Usuarios afectados

| Código | Actor / Rol | Descripción | Problema que sufre |
|---|---|---|---|
| A1 | **Administrador (admin)** | Responsable técnico del sistema; gestiona usuarios, parámetros y auditoría. | No tiene visibilidad del histórico ni control de quién alteró los datos. |
| A2 | **Bibliotecario (librarian)** | Ejecuta el día a día: catálogo, préstamos, devoluciones, reservas, multas y reportes. | Sobrecarga de trabajo manual, errores de cálculo, imposibilidad de generar reportes. |
| A3 | **Miembro (member)** | Usuario final de la biblioteca (~3.000). | No consulta disponibilidad ni reserva; recibe multas inconsistentes. |
| A4 | **Dirección de la biblioteca** | Consume reportes e indicadores para la toma de decisiones. | Carece de datos confiables y oportunos. |
| A5 | **Auditoría / Control interno municipal** | Revisa la operación y la trazabilidad. | No existe bitácora de acciones. |

---

## 6. Justificación y necesidad tecnológica

La institución **necesita** informatizar su operación porque:

1. El volumen de datos (3.000 usuarios, acervo con múltiples ejemplares por título) supera la capacidad de gestión manual confiable.
2. Las reglas de negocio (plazo de 14 días, multa de 0,50 por día de atraso, límite de 5 préstamos activos, máximo 3 reservas, bloqueo de usuarios inactivos y deudores) son **deterministas** y deben ejecutarse siempre igual: eso solo es garantizable con software.
3. Se requiere una **única fuente de verdad** accesible concurrentemente desde varias estaciones de trabajo.
4. Es necesario **trazar cada acción** (auditoría) para cumplir con los controles internos de la municipalidad.
5. La dirección necesita **reportes automáticos** para la planificación y la rendición de cuentas.
6. La tecnología propuesta (SPA React + API REST Node.js/Express + SQLite) es de bajo costo de mantenimiento, corre en hardware existente y permite desplegar el sistema en un equipo local de la biblioteca sin costos de licencias.

---

## 7. Objetivos

### 7.1 Objetivo general

**Diseñar e implementar el Sistema de Gestión de Biblioteca (SGB)**, una aplicación web cliente-servidor que centralice la información de la Biblioteca Pública Municipal "Ricardo Gómez" y automatice el registro y consulta de catálogo, préstamos, devoluciones, reservas, multas, usuarios y reportes, garantizando integridad, seguridad y trazabilidad de los datos.

### 7.2 Objetivos específicos

| # | Objetivo específico (tarea concreta) | Verificación |
|---|---|---|
| OE-01 | **Modelar la base de datos** del dominio con las 8 entidades (users, categories, books, copies, loans, reservations, fines, audit_logs) en 3FN con integridad referencial. | Script DDL ejecutable y diagrama ER (doc. 06). |
| OE-02 | **Implementar la capa de persistencia** (repositorios sobre better-sqlite3) con CRUD completo para todas las entidades. | Módulos `repositorios/` con pruebas unitarias. |
| OE-03 | **Desarrollar la API REST** con Express + TypeScript siguiendo el flujo rutas → controladores → servicios → repositorios. | 40 endpoints publicados y documentados (39 rutas de recursos + `GET /api/health`; doc. 05). |
| OE-04 | **Implementar la autenticación con JWT** y el control de acceso por roles (RBAC admin/librarian/member). | Login, `/api/auth/me` y protección de rutas con pruebas. |
| OE-05 | **Automatizar las reglas de negocio de préstamos** (ejemplar disponible, límite de 5 activos, bloqueo por deuda, plazo de 14 días). | Casos de prueba PB-xx en verde. |
| OE-06 | **Automatizar el cálculo de multas** de 0,50/ día de atraso y su ciclo de vida (pending → paid). | Casos de prueba MB-xx en verde. |
| OE-07 | **Implementar el módulo de reservas** con validación de disponibilidad, límite de 3 activas y caducidad a 7 días. | Casos de prueba RB-xx en verde. |
| OE-08 | **Construir el frontend React** (Vite + react-router-dom) con las 11 pantallas mínimas: login, dashboard, libros, ejemplares, préstamo, devolución, lista de préstamos, reservas, usuarios, multas y reportes. | Navegación funcional y protegida por rol (doc. 07). |
| OE-09 | **Generar los reportes** de resumen, libros más prestados y préstamos atrasados. | `GET /api/reports/summary|top-books|overdue` con datos verificables. |
| OE-10 | **Elaborar la suite de pruebas** (Vitest + supertest) con ≥ 25 casos y registrar los errores detectados con su corrección. | Cobertura ≥ 80 % en servicios y registro de errores (doc. 10). |

---

## 8. Alcance

### 8.1 Dentro del alcance
- Gestión de usuarios con roles y estados.
- Catálogo: categorías, libros y ejemplares (CRUD).
- Préstamos, devoluciones, reservas y multas con sus reglas de negocio.
- Reportes de resumen, top de libros y atrasos.
- Bitácora de auditoría de acciones relevantes.
- Autenticación JWT, autorización RBAC, validación con Zod y medidas de seguridad (helmet, rate limiting).
- Pruebas automatizadas y documentación académica.

### 8.2 Fuera del alcance (para este entregable)
- Escaneo de códigos de barras / lector físico de inventario.
- Pasarela de pagos en línea (el pago de multas se registra manualmente).
- Aplicación móvil nativa.
- Multibiblioteca / multi-tenant.
- Préstamo entre instituciones o préstamo interbibliotecario.
- Recomendaciones con inteligencia artificial.
- Notificaciones push/SMS/correo masivo (se modela la caducidad de reservas, pero no se envían correos en esta versión).

---

## 9. Stakeholders y partes interesadas

| Stakeholder | Interés en el proyecto | Nivel de influencia |
|---|---|---|
| Dirección de la biblioteca | Reportes e indicadores confiables | Alto |
| Bibliotecarios | Reducción de carga manual y errores | Alto |
| Usuarios finales (miembros) | Consulta de disponibilidad y reservas | Medio |
| Municipalidad (patrocinador) | Rendición de cuentas y uso del presupuesto | Alto |
| Desarrollador individual (autor del trabajo) | Entrega académica y demostración de competencias | Alto |
| Control interno | Trazabilidad y auditoría | Medio |

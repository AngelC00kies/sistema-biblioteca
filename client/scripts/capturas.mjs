/**
 * Generador de capturas de evidencia del Sistema de Gestión de Biblioteca.
 *
 * Uso:  node scripts/capturas.mjs
 *
 * - Asegura la API (:4000) y el frontend (:5173); si no corren, los levanta
 *   y al final detiene únicamente los que él mismo inició.
 * - Abre Chromium headless (1440x900 @2x) y guarda PNGs descriptivos en
 *   ../../docs/evidencias/capturas/.
 *
 * Requiere: `npm run seed` previo en server/ (datos de demostración).
 */
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const CAPTURES = join(ROOT, 'docs', 'evidencias', 'capturas');
const COVERAGE = join(ROOT, 'docs', 'evidencias', 'reportes', 'cobertura', 'index.html');
const API = 'http://localhost:4000';
const WEB = 'http://localhost:5173';

mkdirSync(CAPTURES, { recursive: true });

const started = []; // procesos que este script debe detener al final

async function responds(url, timeoutMs = 1500) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureService({ name, url, cwd, command, args, readyPath }) {
  if (await responds(readyPath ?? url)) {
    console.log(`· ${name}: ya está corriendo`);
    return;
  }
  console.log(`· ${name}: iniciando…`);
  const child = spawn(command, args, { cwd, shell: true, stdio: 'ignore' });
  started.push({ name, pid: child.pid });
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (await responds(readyPath ?? url)) {
      console.log(`· ${name}: listo`);
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${name} no respondió en 45 s`);
}

function stopStarted() {
  for (const { name, pid } of started) {
    if (!pid) continue;
    try {
      // /T mata el árbol completo (npm → node → vite/tsx) en Windows
      spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
      console.log(`· ${name}: detenido`);
    } catch {
      /* mejor esfuerzo */
    }
  }
}

/* ---------------- utilidades de captura ---------------- */

async function shot(page, file) {
  await page.screenshot({ path: join(CAPTURES, file) });
  console.log(`  ✓ ${file}`);
}

// Nota: se usa waitUntil 'load' (no 'networkidle') porque Vite mantiene
// abierto el WebSocket de HMR y la condición de red inactiva no se cumple.
async function go(page, path) {
  await page.goto(WEB + path, { waitUntil: 'load' });
  await page.waitForTimeout(600); // fetch inicial + render de estado de React
}

async function login(page, username, password) {
  await page.goto(WEB + '/login', { waitUntil: 'load' });
  await page.waitForSelector('#username');
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes('/login'));
  await page.waitForTimeout(500); // hidratación de la sesión (AuthContext)
}

async function newSession(browser) {
  return browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    locale: 'es-ES',
  });
}

/* ---------------- flujo principal ---------------- */

async function main() {
  await ensureService({
    name: 'API (:4000)',
    url: `${API}/api/health`,
    readyPath: `${API}/api/health`,
    cwd: join(ROOT, 'server'),
    command: 'npm',
    args: ['run', 'start'],
  });
  await ensureService({
    name: 'Frontend (:5173)',
    url: WEB,
    readyPath: WEB,
    cwd: join(ROOT, 'client'),
    command: 'npm',
    args: ['run', 'dev'],
  });

  // channel 'chromium' usa la build completa (con recursos localizados en
  // español); el chrome-headless-shell por defecto solo trae cadenas en inglés.
  const browser = await chromium.launch({ channel: 'chromium', args: ['--lang=es-ES'] });

  try {
    /* ===== Sesión 1 · administrador ===== */
    const admin = await newSession(browser);
    const page = await admin.newPage();

    // 1 · Pantalla de acceso (sin sesión)
    await page.goto(WEB + '/login', { waitUntil: 'load' });
    await page.waitForSelector('.login-card');
    await page.waitForTimeout(300);
    await shot(page, 'login-pantalla-inicio-sesion.png');

    // 2 · Panel principal con KPIs
    await login(page, 'admin', 'Admin1234');
    await go(page, '/');
    await shot(page, 'dashboard-admin-kpis.png');

    // 3 · Catálogo con búsqueda aplicada (filtro en vivo)
    await go(page, '/libros');
    await page.fill('input[aria-label="Buscar libros"]', 'García');
    await page.waitForTimeout(800); // debounce + refetch del catálogo
    await shot(page, 'catalogo-libros-busqueda-filtros.png');

    // 4 · Lista de préstamos con acciones de devolución
    await go(page, '/prestamos');
    await page.waitForSelector('.table-wrap', { timeout: 10_000 });
    await shot(page, 'prestamos-lista-gestion-devolucion.png');

    // 5 · Formulario de registro de préstamo (modal)
    await page.click('button:has-text("+ Registrar préstamo")');
    await page.waitForSelector('#loan-form');
    await page.waitForTimeout(700); // carga de selects (socios/ejemplares)
    await shot(page, 'prestamo-formulario-registro.png');
    await page.click('.modal-close');

    // 6 · Reservas con sus estados
    await go(page, '/reservas');
    await page.waitForTimeout(500);
    await shot(page, 'reservas-lista-estados.png');

    // 7 · Multas con acción de pago
    await go(page, '/multas');
    await page.waitForTimeout(500);
    await shot(page, 'multas-lista-pago.png');

    // 8 · Gestión de usuarios
    await go(page, '/usuarios');
    await page.waitForSelector('.table-wrap', { timeout: 10_000 });
    await shot(page, 'usuarios-lista-alta-edicion.png');

    // 9 · Validación en cliente: contraseña corta (HTML5 minLength)
    await page.click('button:has-text("+ Nuevo usuario")');
    await page.waitForSelector('#user-form');
    const inputs = page.locator('#user-form input');
    await inputs.nth(0).fill('Captura Evidencia');
    await inputs.nth(1).fill('captura.evidencia');
    await inputs.nth(2).fill('captura@mail.com');
    await inputs.nth(3).fill('abc');
    await page.click('button:has-text("Crear usuario")');
    await page.waitForTimeout(400); // burbuja nativa de validación
    await shot(page, 'validacion-formulario-campos-invalidos.png');

    // 10 · Validación en servidor: contraseña que incumple Zod (400 + detalle)
    await inputs.nth(3).fill('abcdefgh'); // largo OK, sin mayúscula ni número
    await page.click('button:has-text("Crear usuario")');
    await page.waitForSelector('.alert.error', { timeout: 10_000 });
    await page.waitForTimeout(300);
    await page.click('.modal-close'); // deja el mensaje del servidor a la vista
    await page.waitForTimeout(200);
    await shot(page, 'validacion-servidor-error-zod.png');

    // 11 · Reportes: ranking, vencidos y serie mensual
    await go(page, '/reportes');
    await page.waitForTimeout(700);
    await shot(page, 'reportes-ranking-vencidos-mensual.png');

    // 12 · Bitácora de auditoría
    await go(page, '/auditoria');
    await page.waitForTimeout(700);
    await shot(page, 'auditoria-bitacora-eventos.png');

    await admin.close();

    /* ===== Sesión 2 · socio con préstamo activo ===== */
    const socio = await newSession(browser);
    const p2 = await socio.newPage();
    await login(p2, 'maria.garcia', 'Socio1234');
    await go(p2, '/mis-prestamos');
    await p2.waitForTimeout(500);
    await shot(p2, 'socio-mis-prestamos.png');
    await socio.close();

    /* ===== Sesión 3 · socio con multa pendiente + intento de 403 ===== */
    const deudor = await newSession(browser);
    const p3 = await deudor.newPage();
    await login(p3, 'juan.perez', 'Socio1234');
    await go(p3, '/mis-multas');
    await p3.waitForTimeout(500);
    await shot(p3, 'socio-mis-multas.png');

    // 14 · Acceso denegado: socio navega a una ruta de administración
    await p3.goto(WEB + '/usuarios', { waitUntil: 'load' });
    await p3.waitForSelector('text=No tienes permisos', { timeout: 10_000 });
    await p3.waitForTimeout(300);
    await shot(p3, 'error-403-socio-acceso-prohibido.png');
    await deudor.close();

    /* ===== 15 · Reporte de cobertura de pruebas (HTML local) ===== */
    const cov = await newSession(browser);
    const p4 = await cov.newPage();
    await p4.goto(pathToFileURL(COVERAGE).href, { waitUntil: 'load' });
    await p4.waitForSelector('.hljs, table, body', { timeout: 10_000 }).catch(() => {});
    await p4.waitForTimeout(800);
    await shot(p4, 'reporte-cobertura-pruebas-html.png');
    await cov.close();

    console.log(`\nCapturas guardadas en: ${CAPTURES}`);
  } finally {
    await browser.close();
    stopStarted();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  stopStarted();
  process.exitCode = 1;
});

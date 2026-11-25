/**
 * Regenera las evidencias de ejecución del Sistema de Gestión de Biblioteca.
 *
 * Uso (desde la raíz del repositorio):
 *     node scripts/regenerar-evidencias.mjs
 *
 * Genera en docs/evidencias/:
 *   registros/suite-96-pruebas.log      npm test (server)
 *   registros/coverage-reporte.log      npm run coverage (server)
 *   registros/tsc-tipos-backend.log     npx tsc --noEmit (server)
 *   registros/smoke-16-pasos.log        node scripts/smoke.mjs (API arriba)
 *   registros/build-frontend.log        npm run build (client)
 *   reportes/suite.json                 reporte estructurado de Vitest
 *   reportes/cobertura/                 reporte HTML de cobertura
 *
 * Nota: se ejecuta desde Node (no desde PowerShell) para garantizar que las
 * salidas UTF-8 con acentos y glifos (✓) se graben correctamente.
 */
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SERVER = join(ROOT, 'server');
const CLIENT = join(ROOT, 'client');
const EV = join(ROOT, 'docs', 'evidencias');
const REG = join(EV, 'registros');
const REP = join(EV, 'reportes');
const API = 'http://localhost:4000';

mkdirSync(REG, { recursive: true });
mkdirSync(REP, { recursive: true });

const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g;

/** Ejecuta un comando y devuelve { code, out } con salida combinada UTF-8. */
function run(cmd, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, shell: true });
    const chunks = [];
    child.stdout.on('data', (d) => chunks.push(d));
    child.stderr.on('data', (d) => chunks.push(d));
    child.on('close', (code) => {
      const out = Buffer.concat(chunks).toString('utf8').replace(ANSI, '');
      resolve({ code: code ?? 1, out });
    });
  });
}

function log(name, header, result) {
  const body =
    result.code === 0
      ? `${header}\n\n${result.out.trim()}\n\n[exit code 0]`
      : `${header}\n\n${result.out.trim()}\n\n[exit code ${result.code} — ERROR]`;
  writeFileSync(join(REG, name), body, 'utf8');
  const ok = result.code === 0 ? 'OK ' : 'ERR';
  console.log(`  ${ok} ${name}`);
  return result.code === 0;
}

async function apiUp() {
  try {
    const res = await fetch(`${API}/api/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function withApi(fn) {
  if (await apiUp()) return fn();
  console.log('  · iniciando API para la prueba de humo…');
  const api = spawn('npm', ['run', 'start'], { cwd: SERVER, shell: true, stdio: 'ignore' });
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline && !(await apiUp())) {
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!(await apiUp())) {
    api.kill();
    throw new Error('La API no respondió en 45 s');
  }
  try {
    return await fn();
  } finally {
    try {
      spawnSyncKill(api.pid);
    } catch {
      /* mejor esfuerzo */
    }
  }
}

function spawnSyncKill(pid) {
  if (!pid) return;
  spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
}

async function main() {
  const stamp = new Date().toISOString();
  console.log(`Regenerando evidencias · ${stamp}\n`);

  // 1 · Tipos del backend
  const tsc = await run('npx', ['tsc', '-p', 'tsconfig.json', '--noEmit'], SERVER);
  log(
    'tsc-tipos-backend.log',
    `$ cd server && npx tsc -p tsconfig.json --noEmit\n# ${stamp}`,
    tsc.code === 0
      ? { code: 0, out: '(sin salida de errores — la verificación de tipos pasó)' }
      : tsc,
  );

  // 2 · Suite de pruebas (96 casos)
  const suite = await run('npm', ['test'], SERVER);
  log('suite-96-pruebas.log', `$ cd server && npm test\n# ${stamp}`, suite);

  // 3 · Cobertura de pruebas
  const cov = await run('npm', ['run', 'coverage'], SERVER);
  log('coverage-reporte.log', `$ cd server && npm run coverage\n# ${stamp}`, cov);
  if (existsSync(join(SERVER, 'coverage'))) {
    rmSync(join(REP, 'cobertura'), { recursive: true, force: true });
    cpSync(join(SERVER, 'coverage'), join(REP, 'cobertura'), { recursive: true });
    console.log('  OK  reportes/cobertura/ (HTML)');
  }

  // 4 · Reporte estructurado JSON de Vitest
  // Ruta relativa: con shell:true en Windows un espacio en la ruta absoluta
  // partiría el argumento (p. ej. "Atom X").
  const json = await run(
    'npx',
    ['vitest', 'run', '--reporter=json', '--outputFile=../docs/evidencias/reportes/suite.json'],
    SERVER,
  );
  console.log(`${json.code === 0 ? '  OK ' : '  ERR'} reportes/suite.json`);

  // 5 · Compilación del frontend
  const build = await run('npm', ['run', 'build'], CLIENT);
  log('build-frontend.log', `$ cd client && npm run build\n# ${stamp}`, build);

  // 6 · Prueba de humo (requiere API)
  const smoke = await withApi(() => run('node', ['scripts/smoke.mjs'], SERVER));
  log('smoke-16-pasos.log', `$ cd server && node scripts/smoke.mjs\n# ${stamp}`, smoke);

  const allOk = [tsc.code, suite.code, cov.code, json.code, build.code, smoke.code].every(
    (c) => c === 0,
  );
  console.log(`\n${allOk ? 'Todas las verificaciones en verde.' : 'HUBO FALLOS: revisar logs.'}`);
  process.exitCode = allOk ? 0 : 1;
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exitCode = 1;
});

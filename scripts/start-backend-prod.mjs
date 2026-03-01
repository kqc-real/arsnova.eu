#!/usr/bin/env node
/**
 * Startet das Backend im Production-Modus (Frontend aus dist/browser).
 * Lädt .env aus dem Repo-Root, gibt ggf. Port 3000 frei und startet dann das Backend.
 *
 * Aufruf: node scripts/start-backend-prod.mjs
 * Oder:   npm run start:prod
 */
import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { platform } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
}

function freePort(port) {
  try {
    if (platform() === 'win32') {
      execSync(
        `for /f "tokens=5" %a in ('netstat -aon ^| find ":${port}"') do taskkill /F /PID %a 2>nul`,
        { shell: 'cmd.exe', stdio: 'ignore' }
      );
    } else {
      execSync(`lsof -ti :${port} | xargs kill 2>/dev/null || true`, { stdio: 'ignore' });
    }
  } catch {
    // ignore
  }
}

loadEnv();

const backendDist = resolve(root, 'apps/backend/dist/index.js');
if (!existsSync(backendDist)) {
  console.log('Backend-Build fehlt, baue jetzt…');
  execSync('npm run build -w @arsnova/backend', { cwd: root, stdio: 'inherit' });
}

const port = Number(process.env.PORT) || 3000;
freePort(port);
await new Promise((r) => setTimeout(r, 1200));

const child = spawn(
  process.execPath,
  [resolve(root, 'apps/backend/dist/index.js')],
  {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: 'inherit',
  }
);

child.on('error', (err) => {
  console.error(err);
  process.exit(1);
});
child.on('exit', (code) => process.exit(code ?? 0));

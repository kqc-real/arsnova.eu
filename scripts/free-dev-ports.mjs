#!/usr/bin/env node
/**
 * Gibt die Ports für npm run dev frei (3000, 3001, 3002, 4200).
 * Nützlich wenn EADDRINUSE oder "Port already in use" auftritt.
 *
 * Optional: nur Backend-Ports — z. B. vor dev:backend:
 *   node scripts/free-dev-ports.mjs --ports=3000,3001,3002
 */
import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { createConnection } from 'net';
import { platform } from 'os';
import { resolve } from 'path';

const portsArg = process.argv.find((a) => a.startsWith('--ports='));
const requireOpenWeightLlm = process.argv.includes('--require-open-weight-llm');
const PORTS = portsArg
  ? portsArg
      .slice('--ports='.length)
      .split(',')
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0)
  : [3000, 3001, 3002, 4200];

const PORT_DESCRIPTIONS = new Map([
  [3000, 'Backend und Schnittstelle zwischen Weboberfläche und Datenbank'],
  [3001, 'Live-Aktualisierungen, zum Beispiel neue Fragen und Abstimmungen'],
  [3002, 'gemeinsame Quizbearbeitung und Synchronisierung zwischen Geräten'],
  [4200, 'Weboberfläche im Browser'],
  [8787, 'lokaler Helfer für eine Ersatz-Zusammenfassung'],
]);

function freePort(port) {
  try {
    if (platform() === 'win32') {
      execSync(
        `for /f "tokens=5" %a in ('netstat -aon ^| find ":${port}"') do taskkill /F /PID %a`,
        {
          shell: 'cmd.exe',
          stdio: 'pipe',
        },
      );
    } else {
      execSync(`lsof -ti :${port} | xargs kill 2>/dev/null || true`, { stdio: 'pipe' });
    }
    const description = PORT_DESCRIPTIONS.get(port) ?? 'lokaler Entwicklungsdienst';
    console.log(`Port ${port} freigegeben – ${description}.`);
  } catch {
    // Port war frei oder kill fehlgeschlagen
  }
}

function readLocalEnvMap() {
  const envMap = new Map();
  for (const relPath of ['.env', 'apps/backend/.env']) {
    const absPath = resolve(process.cwd(), relPath);
    if (!existsSync(absPath)) continue;
    const content = readFileSync(absPath, 'utf8');
    for (const rawLine of content.split(/\r?\n/u)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      const value = line
        .slice(eq + 1)
        .trim()
        .replace(/^['"]|['"]$/gu, '');
      envMap.set(key, value);
    }
  }
  return envMap;
}

function isTcpPortOpen(host, port, timeoutMs = 1000) {
  return new Promise((resolveOpen) => {
    const socket = createConnection({ host, port });
    const done = (open) => {
      socket.removeAllListeners();
      socket.destroy();
      resolveOpen(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

async function ensureOpenWeightLlmTunnelIfConfigured() {
  const failRequired = (message) => {
    if (requireOpenWeightLlm) throw new Error(message);
  };
  if (platform() === 'win32') {
    failRequired('dev:ai unterstützt den automatischen SSH-Tunnel unter Windows nicht.');
    return;
  }
  const envMap = readLocalEnvMap();
  const enabled =
    (process.env.OPEN_WEIGHT_LLM_ENABLED ?? envMap.get('OPEN_WEIGHT_LLM_ENABLED')) === 'true';
  const rawUrl = (
    process.env.OPEN_WEIGHT_LLM_URL ??
    envMap.get('OPEN_WEIGHT_LLM_URL') ??
    ''
  ).trim();
  const token = (
    process.env.OPEN_WEIGHT_LLM_TOKEN ??
    envMap.get('OPEN_WEIGHT_LLM_TOKEN') ??
    ''
  ).trim();
  if (!enabled || !rawUrl) {
    failRequired(
      'dev:ai benötigt OPEN_WEIGHT_LLM_ENABLED=true und eine OPEN_WEIGHT_LLM_URL in .env.',
    );
    return;
  }
  if (!token) {
    failRequired('dev:ai benötigt OPEN_WEIGHT_LLM_TOKEN in .env.');
    return;
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    failRequired('OPEN_WEIGHT_LLM_URL in .env ist ungültig.');
    return;
  }
  const port = Number.parseInt(parsed.port || (parsed.protocol === 'https:' ? '443' : '80'), 10);
  if (parsed.hostname !== '127.0.0.1' || port !== 18080) {
    if (await isTcpPortOpen(parsed.hostname, port)) {
      console.log(
        `✓ Private Text-KI erreichbar: Der konfigurierte Qwen-Dienst antwortet unter ${parsed.hostname}:${port}.`,
      );
      return;
    }
    failRequired(`OPEN_WEIGHT_LLM_URL ist nicht erreichbar: ${parsed.hostname}:${port}.`);
    return;
  }

  if (await isTcpPortOpen('127.0.0.1', 18080)) {
    console.log(
      '✓ Private Text-KI erreichbar: Die sichere SSH-Verbindung auf Port 18080 führt zu Qwen für Themenbeschriftungen, Zusammenfassungen und Lernzielvorschläge.',
    );
    return;
  }

  const sshHost =
    (
      process.env.OPEN_WEIGHT_LLM_TUNNEL_HOST ??
      envMap.get('OPEN_WEIGHT_LLM_TUNNEL_HOST') ??
      ''
    ).trim() || 'arsnova-privat';
  const remoteTarget =
    (
      process.env.OPEN_WEIGHT_LLM_TUNNEL_TARGET ??
      envMap.get('OPEN_WEIGHT_LLM_TUNNEL_TARGET') ??
      ''
    ).trim() || '10.0.0.2:8080';

  if (!/^[A-Za-z0-9._-]+$/u.test(sshHost) || !/^[A-Za-z0-9._:-]+$/u.test(remoteTarget)) {
    failRequired('OPEN_WEIGHT_LLM_TUNNEL_HOST oder OPEN_WEIGHT_LLM_TUNNEL_TARGET ist ungültig.');
    return;
  }

  try {
    const sshCheck = execSync(`ssh -G ${sshHost}`, { stdio: 'pipe', encoding: 'utf8' });
    const hasConfiguredKey = sshCheck
      .split(/\r?\n/u)
      .filter((line) => line.startsWith('identityfile '))
      .map((line) =>
        line
          .slice('identityfile '.length)
          .trim()
          .replace(/^~/u, process.env.HOME ?? ''),
      )
      .some((keyPath) => existsSync(keyPath));
    if (!hasConfiguredKey) {
      failRequired(`Für den SSH-Host ${sshHost} ist kein IdentityFile verfügbar.`);
      return;
    }
  } catch {
    failRequired(`Die SSH-Konfiguration für ${sshHost} ist nicht verwendbar.`);
    return;
  }

  try {
    const child = spawn(
      'ssh',
      [
        '-N',
        '-o',
        'BatchMode=yes',
        '-o',
        'ConnectTimeout=5',
        '-o',
        'ExitOnForwardFailure=yes',
        '-o',
        'ServerAliveInterval=30',
        '-o',
        'ServerAliveCountMax=3',
        '-L',
        `127.0.0.1:18080:${remoteTarget}`,
        sshHost,
      ],
      {
        detached: true,
        stdio: 'ignore',
      },
    );
    child.unref();

    for (let attempt = 0; attempt < 25; attempt += 1) {
      await new Promise((r) => setTimeout(r, 200));
      if (await isTcpPortOpen('127.0.0.1', 18080, 300)) {
        console.log(
          `✓ Private Text-KI erreichbar: Die sichere SSH-Verbindung zu Qwen wurde aufgebaut (${sshHost}/${remoteTarget}) – für Themenbeschriftungen, Zusammenfassungen und Lernzielvorschläge.`,
        );
        return;
      }
    }
    console.warn(
      `Hinweis: Open-Weight-LLM-Tunnel auf 127.0.0.1:18080 antwortet noch nicht (${sshHost}).`,
    );
    failRequired(`Open-Weight-LLM-Tunnel zu ${sshHost} wurde nicht rechtzeitig erreichbar.`);
  } catch (error) {
    if (requireOpenWeightLlm) throw error;
    console.warn(
      `Hinweis: Open-Weight-LLM-Tunnel auf 127.0.0.1:18080 konnte nicht automatisch zu ${sshHost} aufgebaut werden.`,
    );
  }
}

console.log('Lokale App- und KI-Dienste werden vorbereitet …');
for (const port of PORTS) {
  freePort(port);
}
await ensureOpenWeightLlmTunnelIfConfigured();
console.log(`✓ Alle benötigten lokalen Anschlüsse sind bereit (${PORTS.join(', ')}).`);

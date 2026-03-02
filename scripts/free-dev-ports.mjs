#!/usr/bin/env node
/**
 * Gibt die Ports für npm run dev frei (3000, 3001, 3002, 4200).
 * Nützlich wenn EADDRINUSE oder "Port already in use" auftritt.
 */
import { execSync } from 'child_process';
import { platform } from 'os';

const PORTS = [3000, 3001, 3002, 4200];

function freePort(port) {
  try {
    if (platform() === 'win32') {
      execSync(`for /f "tokens=5" %a in ('netstat -aon ^| find ":${port}"') do taskkill /F /PID %a`, {
        shell: 'cmd.exe',
        stdio: 'pipe',
      });
    } else {
      execSync(`lsof -ti :${port} | xargs kill 2>/dev/null || true`, { stdio: 'pipe' });
    }
    console.log(`Port ${port} freigegeben.`);
  } catch {
    // Port war frei oder kill fehlgeschlagen
  }
}

for (const port of PORTS) {
  freePort(port);
}
console.log('Dev-Ports (3000, 3001, 3002, 4200) bereit für npm run dev.');

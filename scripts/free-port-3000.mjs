#!/usr/bin/env node
/**
 * Beendet den Prozess auf Port 3000 (falls vorhanden).
 * Nützlich vor „npm run start:prod“, wenn EADDRINUSE auftritt.
 */
import { execSync } from 'child_process';
import { platform } from 'os';

const port = process.env.PORT || 3000;

try {
  if (platform() === 'win32') {
    execSync(`for /f "tokens=5" %a in ('netstat -aon ^| find ":${port}"') do taskkill /F /PID %a`, {
      shell: 'cmd.exe',
      stdio: 'inherit',
    });
  } else {
    execSync(`lsof -ti :${port} | xargs kill 2>/dev/null || true`, { stdio: 'inherit' });
  }
  console.log(`Port ${port} freigegeben.`);
} catch {
  console.log(`Port ${port} war bereits frei oder konnte nicht freigegeben werden.`);
}

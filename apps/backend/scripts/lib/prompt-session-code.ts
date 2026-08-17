import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

export const SESSION_CODE_PATTERN = /^[A-Z0-9]{6}$/;

export function normalizeSessionCode(raw: string): string {
  return raw.replace(/\s+/g, '').trim().toUpperCase();
}

export function isSessionCode(value: string): boolean {
  return SESSION_CODE_PATTERN.test(value);
}

export function assertConcreteSessionCode(code: string): void {
  if (/^X{6}$/.test(code)) {
    throw new Error(
      `„${code}“ ist ein Platzhalter. Bitte den echten 6-stelligen Code aus der Host-Ansicht verwenden (oben im Host-Tab, nicht Join).`,
    );
  }
}

export function isInteractiveStdio(): boolean {
  return Boolean(stdin.isTTY && stdout.isTTY);
}

export async function resolveSessionCode(provided: string): Promise<string> {
  const normalized = normalizeSessionCode(provided);
  if (isSessionCode(normalized)) {
    assertConcreteSessionCode(normalized);
    return normalized;
  }
  if (provided.trim().length > 0) {
    throw new Error(
      `Ungültiger Session-Code „${provided.trim()}“. Erwartet werden genau 6 Zeichen (A–Z, 0–9).`,
    );
  }
  if (!isInteractiveStdio()) {
    throw new Error(
      'Bitte einen 6-stelligen Session-Code angeben (--code ABC123 oder SESSION_CODE=ABC123).',
    );
  }

  const readline = createInterface({ input: stdin, output: stdout });
  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const raw = await readline.question('Session-Code (6 Zeichen): ');
      const code = normalizeSessionCode(raw);
      if (isSessionCode(code)) {
        assertConcreteSessionCode(code);
        return code;
      }
      stdout.write('Ungültig. Bitte genau 6 Zeichen (A–Z, 0–9) eingeben.\n');
    }
  } finally {
    readline.close();
  }

  throw new Error('Kein gültiger Session-Code eingegeben.');
}

export async function promptChoice(
  question: string,
  choices: Readonly<Record<string, string>>,
): Promise<string | null> {
  if (!isInteractiveStdio()) {
    return null;
  }

  const readline = createInterface({ input: stdin, output: stdout });
  try {
    const raw = await readline.question(question);
    const key = raw.trim().toLowerCase();
    if (!key) {
      return null;
    }
    return choices[key] ?? null;
  } finally {
    readline.close();
  }
}

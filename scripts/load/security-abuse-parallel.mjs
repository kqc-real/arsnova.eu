#!/usr/bin/env node
import { access } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createArtillery500Session } from './artillery/setup-session.mjs';
import { createHttpTrpcSingle } from './lib/trpc-runtime.mjs';
import { waitForBackend } from './lib/wait-for-backend.mjs';
import { writeScenarioReport } from './lib/reporting.mjs';

export const ISOLATED_APPROVAL = 'YES_S6_5_ISOLATED_TARGET';
export const PRODUCTION_APPROVAL = 'YES_PRODUCTION_LOAD_AUTHORIZED';

function boundedInteger(name, fallback, minimum, maximum) {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} muss eine Ganzzahl zwischen ${minimum} und ${maximum} sein.`);
  }
  return value;
}

export function isProductionHost(url) {
  const hostname = new URL(url).hostname.toLowerCase().replace(/\.+$/, '');
  return hostname === 'arsnova.eu' || hostname.endsWith('.arsnova.eu');
}

export function validateCreateBudgetProfile(perIpBudget, globalBudget, createAttempts) {
  if (
    !Number.isSafeInteger(perIpBudget) ||
    !Number.isSafeInteger(globalBudget) ||
    !Number.isSafeInteger(createAttempts) ||
    globalBudget < perIpBudget + createAttempts
  ) {
    throw new Error(
      'Das globale Session-Create-Budget muss den bisherigen IP-Maximalverbrauch plus den vollständigen Abuse-Lauf aufnehmen.',
    );
  }
}

export function assertAbuseRunAuthorized(env, trpcUrl) {
  if (env.LOAD_ACCEPTANCE_APPROVED !== ISOLATED_APPROVAL) {
    throw new Error(`Explizite Freigabe fehlt: LOAD_ACCEPTANCE_APPROVED=${ISOLATED_APPROVAL}`);
  }
  if (
    isProductionHost(trpcUrl) &&
    env.LOAD_ACCEPTANCE_PRODUCTION_APPROVED !== PRODUCTION_APPROVAL
  ) {
    throw new Error('Produktionslast ist ohne separate, dokumentierte Freigabe gesperrt.');
  }
}

function classifyError(error) {
  const text = String(error?.data?.code ?? error?.shape?.data?.code ?? error?.message ?? error);
  if (text.includes('TOO_MANY_REQUESTS')) return 'tooManyRequests';
  if (text.includes('NOT_FOUND')) return 'notFound';
  return 'unexpected';
}

async function mapConcurrent(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function waitForSignal(filePath, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      await access(filePath);
      return Date.now() - startedAt;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Startsignal blieb ${timeoutMs} ms aus.`);
}

function invalidCode(index) {
  return `Z${index.toString(36).toUpperCase().padStart(5, '0')}`.slice(-6);
}

async function run() {
  const trpcUrl = String(process.env.TRPC_URL || 'http://127.0.0.1:3000/trpc').trim();
  const signalFile = String(process.env.LOAD_ACCEPTANCE_PHASE_SIGNAL || '').trim();
  const diagnosticSecret = String(process.env.ADMIN_DIAGNOSTIC_SECRET || '').trim();
  const validJoins = boundedInteger('ABUSE_VALID_JOINS', 50, 1, 500);
  const codeGuesses = boundedInteger('ABUSE_CODE_GUESSES', 25, 21, 100);
  const createAttempts = boundedInteger('ABUSE_CREATE_ATTEMPTS', 481, 11, 10_001);
  const expectedSessionCreatePerHour = boundedInteger(
    'ABUSE_EXPECTED_SESSION_CREATE_PER_HOUR',
    480,
    1,
    10_000,
  );
  const expectedSessionCreateGlobalPerHour = boundedInteger(
    'ABUSE_EXPECTED_SESSION_CREATE_GLOBAL_PER_HOUR',
    2_400,
    1,
    100_000,
  );
  const signalTimeoutMs = boundedInteger('ABUSE_SIGNAL_TIMEOUT_MS', 1_200_000, 5_000, 1_800_000);

  if (process.env.LOAD_ACCEPTANCE_VALIDATE_ONLY === '1') {
    new URL(trpcUrl);
    if (!signalFile) throw new Error('LOAD_ACCEPTANCE_PHASE_SIGNAL fehlt.');
    console.log('security-abuse-parallel: Konfiguration gültig; keine Requests gesendet.');
    return;
  }

  assertAbuseRunAuthorized(process.env, trpcUrl);
  if (!signalFile) throw new Error('LOAD_ACCEPTANCE_PHASE_SIGNAL fehlt.');
  if (diagnosticSecret.length < 32) {
    throw new Error('ADMIN_DIAGNOSTIC_SECRET muss ein separates starkes Diagnose-Secret sein.');
  }

  await waitForBackend(trpcUrl);
  const publicTrpc = createHttpTrpcSingle(trpcUrl);
  const healthTrpc = createHttpTrpcSingle(trpcUrl, undefined, undefined, diagnosticSecret);
  const capacityStats = await healthTrpc.health.securityStats.query();
  if (capacityStats.sessionCreatePerHour !== expectedSessionCreatePerHour) {
    throw new Error(
      `Effektives Session-Create-Budget ${capacityStats.sessionCreatePerHour} stimmt nicht mit ${expectedSessionCreatePerHour} überein.`,
    );
  }
  if (capacityStats.sessionCreateGlobalPerHour !== expectedSessionCreateGlobalPerHour) {
    throw new Error(
      `Effektives globales Session-Create-Budget ${capacityStats.sessionCreateGlobalPerHour} stimmt nicht mit ${expectedSessionCreateGlobalPerHour} überein.`,
    );
  }
  validateCreateBudgetProfile(
    capacityStats.sessionCreatePerHour,
    capacityStats.sessionCreateGlobalPerHour,
    createAttempts,
  );
  const session = await createArtillery500Session(trpcUrl);
  const waitedForSignalMs = await waitForSignal(signalFile, signalTimeoutMs);
  const startedAt = performance.now();

  const validJoinPromise = mapConcurrent(
    Array.from({ length: validJoins }),
    Math.min(50, validJoins),
    async (_, index) => {
      try {
        await publicTrpc.session.join.mutate({
          code: session.code,
          nickname: `Abnahme-${index + 1}`,
          anonymousClientId: randomUUID(),
        });
        return 'accepted';
      } catch (error) {
        return classifyError(error);
      }
    },
  );

  const enumerationPromise = (async () => {
    const attackerClientId = randomUUID();
    const results = [];
    for (let index = 0; index < codeGuesses; index += 1) {
      try {
        await publicTrpc.session.join.mutate({
          code: invalidCode(index),
          nickname: 'Enumeration',
          anonymousClientId: attackerClientId,
        });
        results.push('unexpectedAccepted');
      } catch (error) {
        results.push(classifyError(error));
      }
    }
    return results;
  })();

  const createSpamPromise = mapConcurrent(
    Array.from({ length: createAttempts }),
    Math.min(15, createAttempts),
    async (_, index) => {
      try {
        await publicTrpc.session.create.mutate({
          quizId: session.quizId,
          type: 'QUIZ',
          qaEnabled: false,
          quickFeedbackEnabled: false,
          title: `Abuse ${index + 1}`,
          allowCustomNicknames: true,
          nicknameTheme: 'HIGH_SCHOOL',
          anonymousMode: false,
          teamMode: false,
        });
        return 'accepted';
      } catch (error) {
        return classifyError(error);
      }
    },
  );

  const [joinResults, enumerationResults, createResults] = await Promise.all([
    validJoinPromise,
    enumerationPromise,
    createSpamPromise,
  ]);
  await new Promise((resolve) => setTimeout(resolve, 1_000));

  const securityStats = await healthTrpc.health.securityStats.query();
  const failures = [];
  const acceptedJoins = joinResults.filter((result) => result === 'accepted').length;
  const code429 = enumerationResults.filter((result) => result === 'tooManyRequests').length;
  const codeUnexpected = enumerationResults.filter(
    (result) => result === 'unexpected' || result === 'unexpectedAccepted',
  ).length;
  const create429 = createResults.filter((result) => result === 'tooManyRequests').length;
  const createUnexpected = createResults.filter((result) => result === 'unexpected').length;

  if (acceptedJoins !== validJoins) failures.push(`Gültige Joins: ${acceptedJoins}/${validJoins}`);
  if (code429 < 1) failures.push('Enumeration erreichte den Client-429-Cap nicht.');
  if (codeUnexpected > 0) failures.push(`Unerwartete Enumeration-Ergebnisse: ${codeUnexpected}`);
  if (create429 < 1) failures.push('Create-Spam erreichte das Shared-NAT-IP-Budget nicht.');
  if (createUnexpected > 0) failures.push(`Unerwartete Create-Ergebnisse: ${createUnexpected}`);
  if ((securityStats.sessionCodeFailuresLastMinute ?? 0) < codeGuesses) {
    failures.push(
      'Session-Code-Fehlversuche sind in health.securityStats nicht vollständig sichtbar.',
    );
  }
  if ((securityStats.rateLimit429ByCategoryLastMinute?.sessionCreate ?? 0) < 1) {
    failures.push('Session-Create-429 ist in health.securityStats nicht sichtbar.');
  }

  const summary = {
    scenario: 'security-abuse-parallel',
    durationMs: Math.round(performance.now() - startedAt),
    waitedForSignalMs,
    validJoin: { target: validJoins, accepted: acceptedJoins },
    enumeration: {
      attempts: codeGuesses,
      notFound: enumerationResults.filter((result) => result === 'notFound').length,
      tooManyRequests: code429,
      unexpected: codeUnexpected,
    },
    createSpam: {
      attempts: createAttempts,
      accepted: createResults.filter((result) => result === 'accepted').length,
      tooManyRequests: create429,
      unexpected: createUnexpected,
    },
    telemetry: {
      sessionCreatesLastMinute: securityStats.sessionCreatesLastMinute,
      sessionCodeFailuresLastMinute: securityStats.sessionCodeFailuresLastMinute,
      sessionCodeSoftCapDelaysLastMinute: securityStats.sessionCodeSoftCapDelaysLastMinute,
      rateLimit429LastMinute: securityStats.rateLimit429LastMinute,
      rateLimit429ByCategoryLastMinute: securityStats.rateLimit429ByCategoryLastMinute,
    },
  };

  await writeScenarioReport({
    scenario: summary.scenario,
    environment: {
      validJoins,
      codeGuesses,
      createAttempts,
      sessionCreatePerHour: expectedSessionCreatePerHour,
      sessionCreateGlobalPerHour: expectedSessionCreateGlobalPerHour,
      sameSourceNat: true,
    },
    metrics: summary,
    failures,
  });
  console.log(JSON.stringify(summary, null, 2));
  if (failures.length > 0) {
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}

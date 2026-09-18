import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireRejoinToken } from './lib/trpc-runtime.mjs';

const here = dirname(fileURLToPath(import.meta.url));

test('requireRejoinToken verlangt den Join-Nachweis', () => {
  assert.equal(requireRejoinToken({ rejoinToken: '  cap-1  ' }), 'cap-1');
  assert.throws(() => requireRejoinToken({}), /kein rejoinToken/);
  assert.throws(() => requireRejoinToken({ rejoinToken: '   ' }, 'Artillery'), /Artillery/);
});

test('Artillery Q&A sendet Idempotenz-Key und Teilnahme-Nachweis', () => {
  const processor = readFileSync(join(here, 'artillery/processor.mjs'), 'utf8');
  const setup = readFileSync(join(here, 'artillery/setup-session.mjs'), 'utf8');
  assert.match(
    processor,
    /qa\.submit\.mutate\(\{[\s\S]*idempotencyKey:\s*globalThis\.crypto\.randomUUID\(\)/,
  );
  assert.match(processor, /function participantTrpc\(/);
  assert.match(setup, /session\.configureQaChannel\.mutate/);
  assert.match(setup, /openArtilleryQaChannel/);
});

test('Nightly-Vote-Harness sendet den Teilnahme-Nachweis', () => {
  const sources = [
    'vote-timer-fairness-600.mjs',
    'host-vote-progress-200.mjs',
    'freetext-wordcloud-classroom.mjs',
    'pdf-vs-live-voting-500.mjs',
    'artillery/processor.mjs',
  ];
  for (const relative of sources) {
    const source = readFileSync(join(here, relative), 'utf8');
    assert.match(
      source,
      /x-participant-capability|requireRejoinToken/,
      `${relative} muss den Teilnahme-Nachweis an vote.submit binden.`,
    );
    assert.match(source, /vote\.submit/, `${relative} fehlt der Vote-Pfad.`);
  }
});

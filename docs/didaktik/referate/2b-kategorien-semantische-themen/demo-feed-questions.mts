#!/usr/bin/env tsx
/**
 * Referat 2B – Demo: speist Fragen aus dem Referenzset als Teilnehmende in eine laufende
 * Q&A-Session ein, über dieselben öffentlichen tRPC-Prozeduren wie der Browser
 * (`session.join`, `qa.submit`). Damit lassen sich Kategorien (8.9b), Encoder-Themen (1.14c)
 * und der Moderationskompass im laufenden arsnova.eu zeigen.
 *
 * Nur für eine lokale Dev-Instanz gedacht. Der Produktcode wird nicht verändert.
 *
 * Aufruf aus dem Repo-Root:
 *   npx tsx docs/didaktik/referate/2b-kategorien-semantische-themen/demo-feed-questions.mts --code ABC123 [--domain police] [--locale de]
 *     [--count 40] [--participants 8] [--delay 400] [--ref docs/didaktik/referate/2b-kategorien-semantische-themen/reference-dataset.v2.2.json]
 *     [--trpc http://127.0.0.1:3000/trpc]
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2)
  args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);

const CODE = (args.get('code') ?? '').trim().toUpperCase();
const DOMAIN = args.get('domain') ?? 'police';
const LOCALE = args.get('locale') ?? 'de';
const COUNT = Number(args.get('count') ?? 40);
const PARTICIPANTS = Number(args.get('participants') ?? 8);
const DELAY = Number(args.get('delay') ?? 400);
const REF = resolve(
  args.get('ref') ??
    'docs/didaktik/referate/2b-kategorien-semantische-themen/reference-dataset.v2.2.json',
);
const TRPC = (args.get('trpc') ?? 'http://127.0.0.1:3000/trpc').replace(/\/+$/, '');

if (!/^[A-Z0-9]{6}$/.test(CODE)) {
  console.error('Bitte den 6-stelligen Session-Code angeben: --code ABC123');
  process.exit(2);
}

type Item = {
  id: string;
  text: string;
  locale: string;
  domain?: string;
  category: string | null;
  family: string;
};
const ref = JSON.parse(readFileSync(REF, 'utf8')) as { items: Item[] };
const pool = ref.items.filter(
  (it) => (it.domain ?? 'statistics') === DOMAIN && it.locale === LOCALE,
);
if (pool.length === 0) {
  console.error(`Keine Fragen für domain=${DOMAIN}, locale=${LOCALE}.`);
  process.exit(2);
}
// Familien gemischt, damit Themen nicht in Einreichungsreihenfolge entstehen.
const picked = [...pool]
  .sort((a, b) => a.id.localeCompare(b.id))
  .filter((_, i, arr) => i < COUNT || arr.length <= COUNT);
for (let i = picked.length - 1; i > 0; i -= 1) {
  const j = (i * 7919 + 13) % (i + 1);
  [picked[i], picked[j]] = [picked[j], picked[i]];
}

async function call<T>(path: string, input: unknown, capability?: string): Promise<T> {
  const res = await fetch(`${TRPC}/${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(capability ? { 'x-participant-capability': capability } : {}),
    },
    body: JSON.stringify(input),
  });
  const body = (await res.json()) as { result?: { data: T }; error?: { message: string } };
  if (!res.ok || !body.result) throw new Error(`${path}: ${body.error?.message ?? res.status}`);
  return body.result.data;
}

type Joined = { sessionId: string; participantId: string; rejoinToken: string };
type JoinOutput = { id: string; participantId: string; rejoinToken: string };
const people: Joined[] = [];
for (let p = 0; p < PARTICIPANTS; p += 1) {
  const joined = await call<JoinOutput>('session.join', {
    code: CODE,
    nickname: `Demo ${p + 1}`,
    anonymousClientId: randomUUID(),
    joinIdempotencyKey: randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, ''),
  });
  people.push({
    sessionId: joined.id,
    participantId: joined.participantId,
    rejoinToken: joined.rejoinToken,
  });
}
console.log(`${people.length} Teilnehmende beigetreten (Session ${CODE}).`);

let ok = 0;
for (const [i, item] of picked.entries()) {
  const who = people[i % people.length];
  try {
    await call(
      'qa.submit',
      {
        sessionId: who.sessionId,
        participantId: who.participantId,
        text: item.text,
        idempotencyKey: randomUUID(),
      },
      who.rejoinToken,
    );
    ok += 1;
    console.log(`${String(ok).padStart(3)}  [Referenz: ${item.category ?? '–'}]  ${item.text}`);
  } catch (error) {
    console.error(`Fehler bei ${item.id}: ${(error as Error).message}`);
  }
  await new Promise((r) => setTimeout(r, DELAY));
}
console.log(`${ok} von ${picked.length} Fragen eingereicht (${DOMAIN}, ${LOCALE}).`);

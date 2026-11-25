import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { stat } from 'node:fs/promises';

export async function istDirekterAufruf(url) {
  if (!process.argv[1]) return false;
  const [argument, modul] = await Promise.all([stat(process.argv[1]), stat(url)]);
  return argument.dev === modul.dev && argument.ino === modul.ino;
}

// hrtime verwendet dieselbe monotone Zeitbasis in Eltern- und Lastprozess.
export const versuchsUhr = {
  now: () => Number(process.hrtime.bigint()) / 1e6,
  async waitUntil(ziel, signal) {
    while (this.now() < ziel)
      await setTimeout(Math.max(1, Math.ceil(ziel - this.now())), undefined, { signal });
    signal?.throwIfAborted();
  },
};

export const VERSUCHSVARIANTEN = ['V0', 'V1', 'V2', 'V3', 'V4'];

export function erstelleVersuchsplan(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error('Der Reihenfolge-Seed muss eine vorzeichenlose 32-Bit-Ganzzahl sein.');
  let zustand = seed;
  return Array.from({ length: 5 }, (_, index) => {
    const reihenfolge = [...VERSUCHSVARIANTEN];
    for (let i = reihenfolge.length - 1; i > 0; i--) {
      zustand = (Math.imul(zustand, 1664525) + 1013904223) >>> 0;
      const j = Math.floor((zustand / 2 ** 32) * (i + 1));
      [reihenfolge[i], reihenfolge[j]] = [reihenfolge[j], reihenfolge[i]];
    }
    return reihenfolge.map((variant, position) => ({
      block: index + 1,
      position: position + 1,
      variant,
      run: `block-${String(index + 1).padStart(2, '0')}`,
    }));
  }).flat();
}

export function erstelleLaborCompose(
  prod,
  { variant, images, secretsFile, proxyDirectory, socketDirectory = '/tmp/arsnova-1a-spacy' },
) {
  if (
    !VERSUCHSVARIANTEN.includes(variant) ||
    ![images?.app, images?.spacy].every((image) => /^sha256:[a-f0-9]{64}$/.test(image))
  )
    throw new Error('Gültige Variante und unveränderliche lokale Image-IDs sind erforderlich.');
  const namen = ['postgres', 'redis', 'pdf-worker', 'spacy', 'app'];
  const services = Object.fromEntries(
    namen.map((name) => {
      if (!prod.services?.[name]) throw new Error('Ein erforderlicher Produktionsdienst fehlt.');
      const service = structuredClone(prod.services[name]);
      delete service.container_name;
      delete service.build;
      delete service.env_file;
      delete service.ports;
      service.restart = 'no';
      if (service.depends_on)
        service.depends_on = Object.fromEntries(
          Object.entries(service.depends_on).filter(([key]) => namen.includes(key)),
        );
      return [name, service];
    }),
  );
  services.postgres.env_file = [secretsFile];
  services.app.env_file = [secretsFile];
  services.app.image = services['pdf-worker'].image = images.app;
  services.spacy.image = images.spacy;
  services.spacy.cpus = variant === 'V3' ? '0.25' : '1.0';
  services.spacy.volumes = [`${socketDirectory}:/run/spacy`];
  services.app.volumes = [
    'pdf_worker_socket:/run/pdf-worker:ro',
    `${socketDirectory}:/run/spacy:ro`,
  ];
  services.app.ports = ['127.0.0.1:15300:3000', '127.0.0.1:15301:3001'];
  Object.assign(services.app.environment, {
    NLP_ENABLED: ['V0', 'V1'].includes(variant) ? 'false' : 'true',
    NLP_SOCKET_PATH: variant === 'V4' ? '/run/1a-proxy/nlp.sock' : '/run/spacy/nlp.sock',
    NLP_TIMEOUT_MS: '5000',
    NLP_CACHE_TTL_SECONDS: '1800',
    QA_NLP_ENABLED: 'false',
    WORD_CLOUD_SEMANTIC_ENABLED: 'false',
    QA_SUMMARY_ENABLED: 'false',
    OPEN_WEIGHT_LLM_ENABLED: 'false',
  });
  if (variant === 'V4') services.app.volumes.push(`${proxyDirectory}:/run/1a-proxy:ro`);
  return {
    services,
    networks: structuredClone(prod.networks),
    volumes: { postgres_data: {}, redis_data: {}, pdf_worker_socket: {} },
  };
}

/** Direkter Labordatenimport; Teilnehmeraktionen werden ausschließlich über tRPC gemessen. */
export function erstelleFixtureSql(sessionId, fixture) {
  if (!/^[a-f0-9-]{36}$/.test(sessionId)) throw new Error('Ungültige Labor-Session-ID.');
  const literal = (text) => `'${String(text).replaceAll("'", "''")}'`;
  const fragen = [...fixture.analysis.questions, ...fixture.analysis.exclusionControls];
  const personen = Array.from({ length: fixture.analysis.participantCount }, () => randomUUID());
  const werte = (zeilen) => zeilen.map((zeile) => `(${zeile.map(literal).join(',')})`).join(',\n');
  const bewertungen = [];
  const fragenzeilen = fragen.map((frage, index) => {
    const id = randomUUID();
    if (frage.positiveVoteCount + frage.negativeVoteCount > personen.length)
      throw new Error('Bewertungen überschreiten die Fixture-Raumgröße.');
    for (let i = 0; i < frage.positiveVoteCount + frage.negativeVoteCount; i++)
      bewertungen.push([
        randomUUID(),
        id,
        personen[i],
        i < frage.positiveVoteCount ? 'UP' : 'DOWN',
      ]);
    return [id, frage.text, frage.status, 0, 0, 0, sessionId, personen[index % personen.length]];
  });
  return `BEGIN;
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM "Session" WHERE id=${literal(sessionId)} AND type='Q_AND_A' AND title='1A Laboranalyse')
OR EXISTS (SELECT 1 FROM "QaQuestion" WHERE "sessionId"=${literal(sessionId)})
OR EXISTS (SELECT 1 FROM "Participant" WHERE "sessionId"=${literal(sessionId)})
THEN RAISE EXCEPTION 'Keine neue A1-Laborsession'; END IF;
END $$;
INSERT INTO "Participant" (id,nickname,"sessionId","participantNumber") VALUES
${werte(personen.map((id, i) => [id, `labor-${i + 1}`, sessionId, i + 1]))};
INSERT INTO "QaQuestion" (id,text,status,"upvoteCount","positiveVoteCount","negativeVoteCount","sessionId","participantId","updatedAt")
SELECT id,text,status::"QaQuestionStatus",net::integer,pos::integer,neg::integer,sid,pid,CURRENT_TIMESTAMP
FROM (VALUES ${werte(fragenzeilen)}) AS q(id,text,status,net,pos,neg,sid,pid);
${bewertungen.length ? `INSERT INTO "QaUpvote" (id,"qaQuestionId","participantId",direction,"updatedAt") SELECT id,qid,pid,direction::"QaVoteDirection",CURRENT_TIMESTAMP FROM (VALUES ${werte(bewertungen)}) AS v(id,qid,pid,direction);` : ''}
WITH stimmen AS (
  SELECT q.id,COUNT(v.id) FILTER (WHERE v.direction='UP')::integer AS pos,
    COUNT(v.id) FILTER (WHERE v.direction='DOWN')::integer AS neg
  FROM "QaQuestion" q LEFT JOIN "QaUpvote" v ON v."qaQuestionId"=q.id
  WHERE q."sessionId"=${literal(sessionId)} GROUP BY q.id
)
UPDATE "QaQuestion" q SET "positiveVoteCount"=s.pos,"negativeVoteCount"=s.neg,"upvoteCount"=s.pos-s.neg
FROM stimmen s WHERE q.id=s.id;
UPDATE "Session" SET "qaQuestionCount"=${fragen.length},"qaQuestionPeakCount"=${fragen.length},"qaQuestionPeakReachedAt"=CURRENT_TIMESTAMP,"qaQuestionsAcceptedTotal"=${fragen.length},"qaRankingRevision"="qaRankingRevision"+1,"participantRevision"="participantRevision"+1,"nextParticipantNumber"=${personen.length},"firstParticipantJoinedAt"=CURRENT_TIMESTAMP WHERE id=${literal(sessionId)};
DO $$ BEGIN
IF (SELECT COUNT(*) FROM "QaQuestion" WHERE "sessionId"=${literal(sessionId)}) <> ${fragen.length}
OR (SELECT COUNT(*) FROM "QaQuestion" WHERE "sessionId"=${literal(sessionId)} AND status IN ('ACTIVE','PINNED')) <> ${fixture.analysis.questions.length}
OR (SELECT COUNT(*) FROM "Participant" WHERE "sessionId"=${literal(sessionId)}) <> ${personen.length}
${fixture.analysis.exclusionControls.map((frage) => `OR (SELECT COUNT(*) FROM "QaQuestion" WHERE "sessionId"=${literal(sessionId)} AND status=${literal(frage.status)}) <> 1`).join('\n')}
THEN RAISE EXCEPTION 'Unvollständige A1-Fixture'; END IF;
END $$;
COMMIT;`;
}

/** Infrastrukturfehler stoppen die Reihe; erwartete Verschlechterungen bleiben Ergebnisse. */
export async function fuehreVersuchsreiheAus({
  plan,
  vorbereiten,
  messen,
  wiederherstellen,
  speichern,
  signal = new AbortController().signal,
}) {
  for (const lauf of plan) {
    if (signal.aborted) throw new Error('Versuchsreihe abgebrochen.');
    let report = { complete: false };
    try {
      await vorbereiten(lauf, signal);
      signal.throwIfAborted();
      report = await messen(lauf, signal);
    } catch {
      report.errorCode = 'RUN_FAILED';
    } finally {
      if (signal.aborted) {
        report.complete = false;
        report.errorCode = 'ABORTED';
      }
      try {
        report.rollback = await wiederherstellen(lauf);
      } catch {
        report.rollback = { verified: false, errorCode: 'ROLLBACK_FAILED' };
      }
      if (!report.rollback.verified) report.complete = false;
      await speichern(lauf, report);
    }
    if (!report.complete)
      throw new Error('Versuchsreihe unvollständig; Nachweis wurde gespeichert.');
  }
}

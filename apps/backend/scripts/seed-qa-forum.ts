#!/usr/bin/env tsx
/**
 * Befuellt den Q&A-Kanal einer bestehenden Session mit belastbarem Fragenmaterial.
 *
 * Beispiele:
 *   SESSION_CODE=CWDE5X npm run seed:qa-forum -w @arsnova/backend
 *   npm run seed:qa-forum -w @arsnova/backend -- --code CWDE5X --count 200 --replace
 *   npm run seed:qa-forum -w @arsnova/backend -- CWDE5X --dry-run
 *
 * Das Skript arbeitet direkt gegen Prisma. Es ist fuer lokale Test- und Review-Sessions gedacht,
 * nicht fuer Produktivdaten.
 */
import { randomUUID } from 'crypto';

type QaQuestionStatus = 'ACTIVE' | 'PINNED';
type QaVoteDirection = 'UP' | 'DOWN';

type CliOptions = {
  code: string;
  count: number;
  participants: number;
  replace: boolean;
  append: boolean;
  dryRun: boolean;
  help: boolean;
};

type TopicSeed = {
  name: string;
  phrases: string[];
  details: string[];
};

type GeneratedQuestion = {
  id: string;
  text: string;
  status: QaQuestionStatus;
  authorParticipantId: string;
  createdAt: Date;
  upvoteCount: number;
  positiveVoteCount: number;
  negativeVoteCount: number;
  profile: string;
};

type GeneratedVote = {
  qaQuestionId: string;
  participantId: string;
  direction: QaVoteDirection;
};

const DEFAULT_QUESTION_COUNT = 200;
const DEFAULT_PARTICIPANT_COUNT = 80;
const PARTICIPANT_PREFIX = 'QA Seed';
const MAX_QUESTION_COUNT = 500;
const MAX_PARTICIPANT_COUNT = 250;

const TOPICS: TopicSeed[] = [
  {
    name: 'Lernziele',
    phrases: ['klare Lernziele', 'roter Faden', 'Erwartungen an die Vorbereitung'],
    details: ['die Uebung planbarer wird', 'wir Vorwissen besser einschaetzen koennen'],
  },
  {
    name: 'Praxisbezug',
    phrases: [
      'konkreter Praxisbezug',
      'Beispiele aus dem Projektalltag',
      'Transfer in reale Faelle',
    ],
    details: ['die Theorie nicht abstrakt bleibt', 'wir Entscheidungen besser begruenden koennen'],
  },
  {
    name: 'Uebungen',
    phrases: ['mehr Uebungsaufgaben', 'schrittweise Aufgaben', 'Loesungswege nach der Uebung'],
    details: ['wir Fehler selbst finden', 'die Wiederholung vor der Pruefung leichter wird'],
  },
  {
    name: 'Tempo',
    phrases: ['Tempo der Veranstaltung', 'Zeit fuer Rueckfragen', 'Pausen zwischen Themen'],
    details: ['niemand beim Mitschreiben abhaengt', 'komplexe Inhalte verarbeitet werden'],
  },
  {
    name: 'Bewertung',
    phrases: ['faire Bewertung', 'Klausurvorbereitung', 'transparente Bewertungskriterien'],
    details: ['die Erwartungen vor der Klausur klar sind', 'wir Prioritaeten richtig setzen'],
  },
  {
    name: 'Gruppenarbeit',
    phrases: ['Rollen in der Gruppenarbeit', 'Zusammenarbeit im Team', 'ungleiche Beteiligung'],
    details: ['alle sichtbar beitragen', 'die Aufgabenverteilung nachvollziehbar bleibt'],
  },
  {
    name: 'Feedback',
    phrases: ['schnelleres Feedback', 'konkrete Rueckmeldungen', 'Feedback zu Zwischenergebnissen'],
    details: [
      'wir frueher korrigieren koennen',
      'Missverstaendnisse nicht bis zum Abgabetermin bleiben',
    ],
  },
  {
    name: 'Technik',
    phrases: ['stabile Technik', 'docker compose Setup', 'npm install im Projekt'],
    details: [
      'HTTP 404 Fehler schneller geloest werden',
      'die lokale Umgebung reproduzierbar laeuft',
    ],
  },
  {
    name: 'Datenschutz',
    phrases: ['Datenschutz bei Live-Fragen', 'anonyme Beteiligung', 'Umgang mit sensiblen Fragen'],
    details: ['auch leise Teilnehmende Fragen stellen', 'Vertrauen in die Plattform entsteht'],
  },
  {
    name: 'Barrierefreiheit',
    phrases: ['barrierefreie Darstellung', 'lesbare Folien', 'einfache Sprache'],
    details: ['Inhalte auf kleinen Displays nutzbar bleiben', 'Begriffe nicht unklar bleiben'],
  },
  {
    name: 'KI',
    phrases: ['KI-Unterstuetzung', 'Grenzen von ChatGPT', 'Transparenz bei KI-Quellen'],
    details: ['wir Ergebnisse kritisch pruefen', 'Hilfsmittel fair eingesetzt werden'],
  },
  {
    name: 'Moderation',
    phrases: ['Priorisierung der Fragen', 'Moderation im Q&A', 'sichtbare offene Fragen'],
    details: ['wichtige Punkte nicht untergehen', 'die Diskussion fokussiert bleibt'],
  },
  {
    name: 'Material',
    phrases: [
      'Literatur und Quellen',
      'kompakte Zusammenfassungen',
      'Beispieldateien vor der Sitzung',
    ],
    details: ['wir gezielter nacharbeiten', 'die Vorbereitung weniger verstreut ist'],
  },
  {
    name: 'Programmierung',
    phrases: ['Debugging in C++', 'C# Beispiele', 'PostgreSQL und Redis im Backend'],
    details: ['Fehlermeldungen besser verstanden werden', 'technische Begriffe korrekt bleiben'],
  },
  {
    name: 'Organisation',
    phrases: ['klare Termine', 'Abgaben und Fristen', 'Kommunikation bei Aenderungen'],
    details: ['Planungssicherheit entsteht', 'kurzfristige Aenderungen nicht uebersehen werden'],
  },
  {
    name: 'Interaktion',
    phrases: ['mehr Interaktion im Hoersaal', 'kurze Abstimmungen', 'Live-Fragen im Q&A'],
    details: ['das Auditorium aktiver wird', 'Fragen nicht erst am Ende kommen'],
  },
];

const QUESTION_FRAMES = [
  'Wie koennen wir {phrase} konkreter machen, damit {detail}?',
  'Welche Beispiele zu {phrase} helfen am meisten, wenn {detail}?',
  'Warum ist {phrase} aktuell noch unklar, obwohl {detail}?',
  'Wo brauchen wir bei {phrase} mehr Orientierung, damit {detail}?',
  'Was waere ein guter naechster Schritt fuer {phrase}, wenn {detail}?',
  'Welche Risiken entstehen ohne {phrase}, besonders wenn {detail}?',
  'Wie sollte {phrase} im Kurs sichtbar werden, damit {detail}?',
  'Welche Entscheidung wuerde {phrase} verbessern, ohne dass {detail} leidet?',
];

function printUsage(): void {
  console.log(`
Q&A-Forum einer bestehenden Session befuellen

Usage:
  npm run seed:qa-forum -w @arsnova/backend -- --code CWDE5X [Optionen]
  SESSION_CODE=CWDE5X npm run seed:qa-forum -w @arsnova/backend

Optionen:
  --code <CODE>          Session-Code, alternativ SESSION_CODE oder erstes Argument
  --count <N>            Anzahl Fragen, Default ${DEFAULT_QUESTION_COUNT}, max ${MAX_QUESTION_COUNT}
  --participants <N>     Anzahl Seed-Teilnehmende, Default ${DEFAULT_PARTICIPANT_COUNT}, max ${MAX_PARTICIPANT_COUNT}
  --replace              Vorhandene Q&A-Fragen der Session vorher loeschen
  --append               Neue Fragen trotz vorhandener Q&A-Fragen hinzufuegen
  --dry-run              Nur pruefen und geplante Mengen ausgeben
  --help                 Hilfe anzeigen
`);
}

function parseCliOptions(argv: string[]): CliOptions {
  const args = [...argv];
  const readValue = (name: string): string | undefined => {
    const equalsPrefix = `--${name}=`;
    const equalsIndex = args.findIndex((arg) => arg.startsWith(equalsPrefix));
    if (equalsIndex >= 0) {
      return args.splice(equalsIndex, 1)[0]!.slice(equalsPrefix.length);
    }

    const flagIndex = args.indexOf(`--${name}`);
    if (flagIndex >= 0) {
      const value = args[flagIndex + 1];
      args.splice(flagIndex, value && !value.startsWith('--') ? 2 : 1);
      return value;
    }

    return undefined;
  };

  const hasFlag = (name: string): boolean => {
    const index = args.indexOf(`--${name}`);
    if (index < 0) return false;
    args.splice(index, 1);
    return true;
  };

  const help = hasFlag('help') || hasFlag('h');
  const replace = hasFlag('replace');
  const append = hasFlag('append');
  const dryRun = hasFlag('dry-run');
  const code = (
    readValue('code') ??
    process.env['SESSION_CODE'] ??
    args.find((arg) => !arg.startsWith('--')) ??
    ''
  )
    .trim()
    .toUpperCase();
  const count = readPositiveInteger(readValue('count') ?? process.env['QUESTION_COUNT'], {
    fallback: DEFAULT_QUESTION_COUNT,
    max: MAX_QUESTION_COUNT,
    label: 'count',
  });
  const participants = readPositiveInteger(
    readValue('participants') ?? process.env['PARTICIPANT_COUNT'],
    {
      fallback: DEFAULT_PARTICIPANT_COUNT,
      max: MAX_PARTICIPANT_COUNT,
      label: 'participants',
    },
  );

  return { code, count, participants, replace, append, dryRun, help };
}

function readPositiveInteger(
  value: string | undefined,
  options: { fallback: number; max: number; label: string },
): number {
  if (!value) return options.fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > options.max) {
    throw new Error(`Ungueltiger Wert fuer --${options.label}: ${value}`);
  }
  return parsed;
}

function assertOptions(options: CliOptions): void {
  if (options.help) return;
  if (!/^[A-Z0-9]{6}$/.test(options.code)) {
    throw new Error('Bitte einen gueltigen 6-stelligen Session-Code angeben.');
  }
  if (options.replace && options.append) {
    throw new Error('--replace und --append koennen nicht gleichzeitig verwendet werden.');
  }
}

function buildParticipantNicknames(count: number): string[] {
  return Array.from(
    { length: count },
    (_, index) => `${PARTICIPANT_PREFIX} ${String(index + 1).padStart(3, '0')}`,
  );
}

function buildQuestions(
  count: number,
  participantIds: readonly string[],
): { questions: GeneratedQuestion[]; votes: GeneratedVote[] } {
  const questions: GeneratedQuestion[] = [];
  const votes: GeneratedVote[] = [];
  const startedAt = Date.now() - count * 45_000;

  for (let index = 0; index < count; index++) {
    const authorParticipantId = participantIds[index % participantIds.length]!;
    const { positiveVoteCount, negativeVoteCount, profile } = resolveVoteProfile(
      index,
      count,
      participantIds.length - 1,
    );
    const questionId = randomUUID();
    const questionVotes = buildVotesForQuestion(
      questionId,
      authorParticipantId,
      participantIds,
      positiveVoteCount,
      negativeVoteCount,
      10_000 + index * 97,
    );

    questions.push({
      id: questionId,
      text: buildQuestionText(index),
      status: index === 0 ? 'PINNED' : 'ACTIVE',
      authorParticipantId,
      createdAt: new Date(startedAt + index * 45_000),
      upvoteCount:
        questionVotes.filter((vote) => vote.direction === 'UP').length -
        questionVotes.filter((vote) => vote.direction === 'DOWN').length,
      positiveVoteCount: questionVotes.filter((vote) => vote.direction === 'UP').length,
      negativeVoteCount: questionVotes.filter((vote) => vote.direction === 'DOWN').length,
      profile,
    });
    votes.push(...questionVotes);
  }

  return { questions, votes };
}

function buildQuestionText(index: number): string {
  const topic = TOPICS[index % TOPICS.length]!;
  const phrase = topic.phrases[Math.floor(index / TOPICS.length) % topic.phrases.length]!;
  const detail = topic.details[(index * 3 + Math.floor(index / 5)) % topic.details.length]!;
  const frame =
    QUESTION_FRAMES[(index + Math.floor(index / TOPICS.length)) % QUESTION_FRAMES.length]!;
  const suffix =
    index % 11 === 0
      ? ` Kontext: ${topic.name}.`
      : index % 17 === 0
        ? ' Bitte mit einem konkreten Beispiel beantworten.'
        : '';

  return `${frame.replace('{phrase}', phrase).replace('{detail}', detail)}${suffix}`;
}

function resolveVoteProfile(
  index: number,
  totalQuestionCount: number,
  maxVotes: number,
): {
  positiveVoteCount: number;
  negativeVoteCount: number;
  profile: string;
} {
  const ratio = index / Math.max(1, totalQuestionCount);
  const jitter = (index * 17) % 9;

  if (ratio < 0.18) {
    return {
      positiveVoteCount: Math.min(maxVotes, 48 + jitter),
      negativeVoteCount: Math.min(Math.max(0, maxVotes - (48 + jitter)), index % 4),
      profile: 'high-support',
    };
  }

  if (ratio < 0.36) {
    return {
      positiveVoteCount: Math.min(maxVotes, 24 + jitter),
      negativeVoteCount: Math.min(Math.max(0, maxVotes - (24 + jitter)), index % 2),
      profile: 'best-score',
    };
  }

  if (ratio < 0.58) {
    const positive = Math.min(maxVotes, 28 + jitter);
    return {
      positiveVoteCount: positive,
      negativeVoteCount: Math.min(Math.max(0, maxVotes - positive), 24 + ((index * 5) % 10)),
      profile: 'controversial',
    };
  }

  if (ratio < 0.78) {
    const positive = Math.min(maxVotes, 14 + jitter);
    return {
      positiveVoteCount: positive,
      negativeVoteCount: Math.min(Math.max(0, maxVotes - positive), 8 + (index % 8)),
      profile: 'mixed',
    };
  }

  return {
    positiveVoteCount: Math.min(maxVotes, 4 + (index % 9)),
    negativeVoteCount: Math.min(Math.max(0, maxVotes - (4 + (index % 9))), index % 5),
    profile: 'low-signal',
  };
}

function buildVotesForQuestion(
  questionId: string,
  authorParticipantId: string,
  participantIds: readonly string[],
  positiveVoteCount: number,
  negativeVoteCount: number,
  seed: number,
): GeneratedVote[] {
  const eligibleVoters = seededShuffle(
    participantIds.filter((participantId) => participantId !== authorParticipantId),
    seed,
  );
  const positiveVoters = eligibleVoters.slice(0, positiveVoteCount);
  const negativeVoters = eligibleVoters.slice(
    positiveVoteCount,
    positiveVoteCount + negativeVoteCount,
  );

  return [
    ...positiveVoters.map((participantId) => ({
      qaQuestionId: questionId,
      participantId,
      direction: 'UP' as const,
    })),
    ...negativeVoters.map((participantId) => ({
      qaQuestionId: questionId,
      participantId,
      direction: 'DOWN' as const,
    })),
  ];
}

function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const result = [...items];
  const random = createDeterministicRandom(seed);
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }
  return result;
}

function createDeterministicRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function summarizeQuestions(questions: readonly GeneratedQuestion[]): Record<string, number> {
  return questions.reduce<Record<string, number>>((acc, question) => {
    acc[question.profile] = (acc[question.profile] ?? 0) + 1;
    return acc;
  }, {});
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  assertOptions(options);

  if (options.help) {
    printUsage();
    return;
  }

  const { prisma } = await import('../src/db');
  try {
    const session = await prisma.session.findUnique({
      where: { code: options.code },
      select: {
        id: true,
        code: true,
        status: true,
        type: true,
        qaEnabled: true,
        qaOpen: true,
      },
    });

    if (!session) {
      throw new Error(`Session ${options.code} nicht gefunden.`);
    }
    if (session.status === 'FINISHED') {
      throw new Error(`Session ${options.code} ist beendet und wird nicht befuellt.`);
    }

    const existingQuestionCount = await prisma.qaQuestion.count({
      where: { sessionId: session.id },
    });
    const participantNicknames = buildParticipantNicknames(options.participants);
    const planned = buildQuestions(
      options.count,
      participantNicknames.map((_, index) => `participant-${index}`),
    );
    const plannedUpVotes = planned.votes.filter((vote) => vote.direction === 'UP').length;
    const plannedDownVotes = planned.votes.length - plannedUpVotes;

    if (options.dryRun) {
      console.log('Dry run: Es wird nichts geschrieben.');
      console.log({
        sessionCode: session.code,
        sessionStatus: session.status,
        existingQuestionCount,
        plannedQuestionCount: planned.questions.length,
        plannedParticipantCount: options.participants,
        plannedVoteCount: planned.votes.length,
        plannedUpVotes,
        plannedDownVotes,
        profiles: summarizeQuestions(planned.questions),
      });
      return;
    }

    if (existingQuestionCount > 0 && !options.replace && !options.append) {
      throw new Error(
        `Session ${session.code} enthaelt bereits ${existingQuestionCount} Q&A-Fragen. ` +
          'Nutze --replace zum Ersetzen oder --append zum Hinzufuegen.',
      );
    }

    await prisma.session.update({
      where: { id: session.id },
      data: {
        qaEnabled: true,
        qaOpen: true,
      },
    });

    const existingParticipants = await prisma.participant.findMany({
      where: { sessionId: session.id, nickname: { in: participantNicknames } },
      select: { id: true, nickname: true },
    });
    const existingNames = new Set(existingParticipants.map((participant) => participant.nickname));
    const missingParticipants = participantNicknames
      .filter((nickname) => !existingNames.has(nickname))
      .map((nickname) => ({
        id: randomUUID(),
        sessionId: session.id,
        nickname,
      }));

    if (missingParticipants.length > 0) {
      await prisma.participant.createMany({
        data: missingParticipants,
        skipDuplicates: true,
      });
    }

    const seedParticipants = await prisma.participant.findMany({
      where: { sessionId: session.id, nickname: { in: participantNicknames } },
      select: { id: true, nickname: true },
      orderBy: { nickname: 'asc' },
    });
    const generated = buildQuestions(
      options.count,
      seedParticipants.map((participant) => participant.id),
    );
    const voteRows = generated.votes.map((vote) => ({
      id: randomUUID(),
      qaQuestionId: vote.qaQuestionId,
      participantId: vote.participantId,
      direction: vote.direction,
    }));

    await prisma.$transaction(
      async (tx) => {
        if (options.replace) {
          const existingQuestionIds = await tx.qaQuestion.findMany({
            where: { sessionId: session.id },
            select: { id: true },
          });
          if (existingQuestionIds.length > 0) {
            await tx.qaUpvote.deleteMany({
              where: {
                qaQuestionId: { in: existingQuestionIds.map((question) => question.id) },
              },
            });
            await tx.qaQuestion.deleteMany({ where: { sessionId: session.id } });
          }
        }

        await tx.qaQuestion.createMany({
          data: generated.questions.map((question) => ({
            id: question.id,
            sessionId: session.id,
            participantId: question.authorParticipantId,
            text: question.text,
            status: question.status,
            upvoteCount: question.upvoteCount,
            createdAt: question.createdAt,
          })),
        });

        for (let index = 0; index < voteRows.length; index += 1000) {
          await tx.qaUpvote.createMany({
            data: voteRows.slice(index, index + 1000),
          });
        }
      },
      { timeout: 60_000 },
    );

    const finalQuestionCount = await prisma.qaQuestion.count({ where: { sessionId: session.id } });
    const upVotes = generated.votes.filter((vote) => vote.direction === 'UP').length;
    const downVotes = generated.votes.length - upVotes;

    console.log('');
    console.log('Q&A-Forum befuellt.');
    console.log({
      sessionCode: session.code,
      participantsReused: existingParticipants.length,
      participantsCreated: missingParticipants.length,
      questionsCreated: generated.questions.length,
      questionsInSession: finalQuestionCount,
      votesCreated: generated.votes.length,
      upVotes,
      downVotes,
      profiles: summarizeQuestions(generated.questions),
      qAndAChannel: 'enabled/open',
      sortModes: ['Meist unterstuetzt', 'Beste Fragen', 'Umstritten'],
    });
    console.log('');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

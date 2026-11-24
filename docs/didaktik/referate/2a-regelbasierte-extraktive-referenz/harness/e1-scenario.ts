// E1: Six-question reference scenario (Issue #456 §12) through the unchanged rule core.
// Grid: status variant x room size N x sort mode x word-cloud variant.
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  EVIDENCE,
  describeCards,
  environment,
  referenceQuestions,
  runCompass,
  type ScenarioQuestion,
  type SortMode,
} from './lib.ts';

const env = environment();
const SORT_MODES: SortMode[] = ['BEST', 'TOP', 'CONTROVERSIAL', 'TIME'];
const ROOM_SIZES = [50, 200, 1000];
const VARIANTS = ['LEXICAL', 'THEME'] as const;

const fixture = referenceQuestions();
// S0: statuses exactly as in the repo fixture (A, D, F PENDING with votes).
// S1: "DB-realistic" — PENDING questions cannot receive votes in 1.3 (vote trigger
//     rejects status NOT IN ACTIVE/PINNED/ARCHIVED), so a voted question is approved.
// S2: start of lecture — all six questions submitted, none reviewed, no votes yet.
const statusVariants: Record<string, ScenarioQuestion[]> = {
  S0_fixture: fixture,
  S1_all_approved: fixture.map((q) => ({ ...q, status: q.key === 'C' ? 'PINNED' : 'ACTIVE' })),
  S2_unreviewed_no_votes: fixture.map((q) => ({
    ...q,
    status: 'PENDING',
    positive: 0,
    negative: 0,
  })),
};

type Row = {
  statusVariant: string;
  N: number;
  sortMode: SortMode;
  variant: string;
  cards: string;
  nextStepVisible: boolean;
  frictionKeys: string[];
  topicTerms: string[];
};

const rows: Row[] = [];
const signals: Record<string, unknown> = {};
for (const [name, questions] of Object.entries(statusVariants)) {
  for (const N of ROOM_SIZES) {
    for (const sortMode of SORT_MODES) {
      for (const variant of VARIANTS) {
        const result = runCompass({ questions, participantBasis: N, sortMode, variant });
        rows.push({
          statusVariant: name,
          N,
          sortMode,
          variant,
          cards: describeCards(result),
          nextStepVisible: result.nextStepVisible,
          frictionKeys: result.cards.find((c) => c.kind === 'friction')?.sources ?? [],
          topicTerms: result.termsSupportingTopics,
        });
        if (sortMode === 'BEST' && variant === 'LEXICAL') {
          signals[`${name}/N=${N}`] = result.compassQuestions.map((q, i) => ({
            key: questions[i]!.key,
            status: q.status,
            votes: `${q.positiveVoteCount ?? '–'}/${q.negativeVoteCount ?? '–'}`,
            net: q.score,
            bestScore: q.bestScore?.toFixed(3),
            controversyScore: q.controversyScore?.toFixed(3),
            isControversial: q.isControversial,
          }));
        }
      }
    }
  }
}

mkdirSync(`${EVIDENCE}/E1`, { recursive: true });
writeFileSync(
  `${EVIDENCE}/E1/e1-${env.commitShort}.json`,
  JSON.stringify({ env, signals, rows }, null, 2),
);

const md: string[] = [
  `# E1 – Sechs-Fragen-Szenario durch den Regelkern`,
  ``,
  `Commit \`${env.commit}\` (clean: ${env.workingTreeClean}), Regeln \`${env.rulesVersion}\`, ${env.node}, ${env.timestamp}`,
  ``,
  `## Signale je Frage (BEST, LEXICAL)`,
  ``,
];
for (const [k, v] of Object.entries(signals)) {
  md.push(
    `### ${k}`,
    '',
    '| Frage | Status | +/− | Netto | Best-Score | Kontroversität | Umstritten-Label |',
    '|---|---|---|---|---|---|---|',
  );
  for (const s of v as Array<Record<string, unknown>>) {
    md.push(
      `| ${s.key} | ${s.status} | ${s.votes} | ${s.net ?? '–'} | ${s.bestScore ?? '–'} | ${s.controversyScore ?? '–'} | ${s.isControversial ?? '–'} |`,
    );
  }
  md.push('');
}
md.push(
  '## Kartenergebnis je Bedingung',
  '',
  '| Status | N | Sortierung | Wortwolke | Karten (Quellen) → Nächster Schritt | „Als Nächstes“ sichtbar | Themen-Terme (df≥2) |',
  '|---|---|---|---|---|---|---|',
);
for (const r of rows) {
  md.push(
    `| ${r.statusVariant} | ${r.N} | ${r.sortMode} | ${r.variant} | ${r.cards} | ${r.nextStepVisible ? 'ja' : '**nein**'} | ${r.topicTerms.join(', ') || '–'} |`,
  );
}
writeFileSync(`${EVIDENCE}/E1/e1-${env.commitShort}.md`, md.join('\n') + '\n');
process.stdout.write(`${md.slice(0, 200).join('\n')}\n`);

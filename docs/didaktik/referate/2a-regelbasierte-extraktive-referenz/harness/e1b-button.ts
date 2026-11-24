// E1b: Ist der Kompass-Button sichtbar? Ab 9f230abc erscheint er nur, wenn der Plan eine
// Handlungsempfehlung hat (buildModerationCompassView().actionRecommendation !== null).
// Gleiche 72 Kombinationen wie E1; ruft ausschließlich Repo-Funktionen auf.
import { mkdirSync, writeFileSync } from 'node:fs';
import type { ModerationCompassSnapshot } from '../../../../../apps/frontend/src/app/features/session/session-host/moderation-compass.ts';
import { buildModerationCompassView } from '../../../../../apps/frontend/src/app/features/session/session-host/moderation-compass.ts';
import {
  EVIDENCE,
  environment,
  qaTermsFor,
  referenceQuestions,
  toCompassQuestion,
  type ScenarioQuestion,
  type SortMode,
} from './lib.ts';

const env = environment();
const SORT_MODES: SortMode[] = ['BEST', 'TOP', 'CONTROVERSIAL', 'TIME'];
const ROOM_SIZES = [50, 200, 1000];
const VARIANTS = ['LEXICAL', 'THEME'] as const;
const fixture = referenceQuestions();
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

const rows: {
  statusVariant: string;
  N: number;
  sortMode: SortMode;
  variant: string;
  cards: string[];
  actionRecommendation: string | null;
  buttonVisible: boolean;
}[] = [];
for (const [statusVariant, questions] of Object.entries(statusVariants)) {
  for (const N of ROOM_SIZES) {
    for (const sortMode of SORT_MODES) {
      for (const variant of VARIANTS) {
        const compassQuestions = questions.map((q) => toCompassQuestion(q, N));
        const qaTerms = qaTermsFor(compassQuestions, sortMode, variant);
        const snapshot: ModerationCompassSnapshot = {
          qaQuestions: compassQuestions,
          qaSortMode: sortMode,
          qaTerms,
          freetextTerms: [],
          extraTopicSources: [],
          topicWeightLabel: qaTerms.length > 0 ? 'Gewichtung' : null,
          tempo: null,
          quizSources: [],
          quizInsightKind: null,
        };
        const view = buildModerationCompassView(snapshot);
        rows.push({
          statusVariant,
          N,
          sortMode,
          variant,
          cards: view.cards.map((c) => c.kind),
          actionRecommendation: view.actionRecommendation,
          buttonVisible: view.actionRecommendation !== null,
        });
      }
    }
  }
}

mkdirSync(`${EVIDENCE}/E1`, { recursive: true });
writeFileSync(
  `${EVIDENCE}/E1/e1b-button-${env.commitShort}.json`,
  JSON.stringify({ env, rows }, null, 2),
);
const md = [
  `# E1b – Sichtbarkeit des Kompass-Buttons (${env.commitShort})`,
  '',
  `Commit \`${env.commit}\` (clean: ${env.workingTreeClean}), Regeln \`${env.rulesVersion}\`, ${env.node}, ${env.timestamp}`,
  '',
  'Ab diesem Stand erscheint der Button nur, wenn `buildModerationCompassView().actionRecommendation` nicht `null` ist.',
  '',
  '| Statusvariante | N | Sortierung | Wortwolke | Karten | Empfehlung | Button |',
  '|---|---|---|---|---|---|---|',
  ...rows.map(
    (r) =>
      `| ${r.statusVariant} | ${r.N} | ${r.sortMode} | ${r.variant} | ${r.cards.join(', ') || '–'} | ${r.actionRecommendation ?? '–'} | ${r.buttonVisible ? 'sichtbar' : '**ausgeblendet**'} |`,
  ),
  '',
];
writeFileSync(`${EVIDENCE}/E1/e1b-button-${env.commitShort}.md`, md.join('\n'));
const hidden = rows.filter((r) => !r.buttonVisible);
console.log(
  JSON.stringify(
    {
      runs: rows.length,
      hidden: hidden.length,
      hiddenCases: hidden.map((r) => `${r.statusVariant}/N=${r.N}/${r.sortMode}/${r.variant}`),
    },
    null,
    1,
  ),
);

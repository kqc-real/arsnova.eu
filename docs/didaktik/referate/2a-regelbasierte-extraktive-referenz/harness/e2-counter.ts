// E2: Counter-cases (Gegenfälle) against the unchanged rule core.
// Base condition unless noted: S1 (all approved), N=200, BEST, LEXICAL.
import { mkdirSync, writeFileSync } from 'node:fs';
import { applyQaPassageRedaction } from '@arsnova/shared-types';
import {
  EVIDENCE,
  describeCards,
  environment,
  qaTermsFor,
  referenceQuestions,
  runCompass,
  toCompassQuestion,
  type ScenarioQuestion,
} from './lib.ts';

const env = environment();
const base: ScenarioQuestion[] = referenceQuestions().map((q) => ({
  ...q,
  status: q.key === 'C' ? 'PINNED' : 'ACTIVE',
}));
const run = (questions: ScenarioQuestion[], N = 200) =>
  runCompass({ questions, participantBasis: N, sortMode: 'BEST', variant: 'LEXICAL' });
const with_ = (key: string, patch: Partial<ScenarioQuestion>) =>
  base.map((q) => (q.key === key ? { ...q, ...patch } : q));

type Case = { id: string; title: string; condition: string; result: string; finding: string };
const cases: Case[] = [];
const add = (c: Case) => cases.push(c);

// K1 missing vs. zero
{
  const missing = run(with_('F', { positive: undefined, negative: undefined }));
  const zero = run(with_('F', { positive: 0, negative: 0 }));
  const allMissing = run(base.map((q) => ({ ...q, positive: undefined, negative: undefined })));
  const allZero = run(base.map((q) => ({ ...q, positive: 0, negative: 0 })));
  add({
    id: 'K1',
    title: 'Fehlende vs. nullwertige Stimmen',
    condition: 'F ohne Stimmdaten vs. F mit 0/0; zusätzlich alle Fragen ohne Daten vs. alle 0/0',
    result: `F fehlt: ${describeCards(missing)} · F=0/0: ${describeCards(zero)} · alle fehlen: ${describeCards(allMissing)} · alle 0/0: ${describeCards(allZero)}`,
    finding:
      describeCards(missing) === describeCards(zero) &&
      describeCards(allMissing) === describeCards(allZero)
        ? 'Identische Ausgabe: Der Kompass unterscheidet „keine Daten“ nicht von „null Stimmen“ (qaRankValue: `?? 0`). Kein Hinweis auf Datenlücke.'
        : 'Ausgaben unterscheiden sich.',
  });
}

// K2 new unrated organisational question (approved, 0 votes)
{
  const G: ScenarioQuestion = {
    key: 'G',
    id: '77777777-7777-4777-8777-777777777777',
    text: 'Wird die Klausur online oder in Präsenz geschrieben?',
    status: 'ACTIVE',
    positive: 0,
    negative: 0,
  };
  const r = run([...base, G]);
  add({
    id: 'K2',
    title: 'Neue, noch unbewertete Organisationsfrage (freigegeben, 0 Stimmen)',
    condition: 'Basis + G „Wird die Klausur online oder in Präsenz geschrieben?“ (ACTIVE, 0/0)',
    result: describeCards(r),
    finding: r.cards.some((c) => c.sources.includes('G'))
      ? 'G wird sichtbar.'
      : 'G erscheint auf keiner Karte. Ein neues organisatorisches Anliegen bleibt unsichtbar, bis es Stimmen oder lexikalische Wiederholung erzeugt.',
  });
}

// K3 one unreviewed question without votes outranks a 40:40 controversy in "Als Nächstes"
{
  const H: ScenarioQuestion = {
    key: 'H',
    id: '88888888-8888-4888-8888-888888888888',
    text: 'Kann man die Folien vorab hochladen?',
    status: 'PENDING',
    positive: 0,
    negative: 0,
  };
  const before = run(base);
  const after = run([...base, H]);
  add({
    id: 'K3',
    title: 'Eine ungeprüfte Frage verdrängt den Kontroversen-Hinweis',
    condition: 'Basis vs. Basis + H (PENDING, 0 Stimmen)',
    result: `vorher: ${describeCards(before)} · nachher: ${describeCards(after)}`,
    finding:
      'Die Prioritätsregel (PENDING vor Reibung) verschiebt „Als Nächstes“ von der 40:40-Kontroverse auf eine einzelne ungeprüfte Frage ohne Resonanz. Fachlich begründbar (Freigabe ist Host-Pflicht), aber keine Relevanzgewichtung.',
  });
}

// K4 paraphrases / lexical blindness
{
  const termsFor = (keys: string[]) =>
    qaTermsFor(
      base
        .filter((q) => keys.includes(q.key))
        .map((q) => toCompassQuestion({ ...q, status: 'ACTIVE' }, 200)),
      'BEST',
      'THEME',
    )
      .filter((t) => t.documentFrequency >= 2 || t.sourceCount >= 2)
      .map((t) => t.label);
  const cd = termsFor(['C', 'D']);
  const ef = termsFor(['E', 'F']);
  const ab = termsFor(['A', 'B']);
  add({
    id: 'K4',
    title: 'Paraphrasen: lexikalische Themenbildung',
    condition: 'Gemeinsame Terme (df≥2, bis 3-Gramme) innerhalb der Paare A/B, C/D, E/F',
    result: `A/B: ${ab.join(', ') || '–'} · C/D: ${cd.join(', ') || '–'} · E/F: ${ef.join(', ') || '–'}`,
    finding:
      'Nur A/B teilen Wortformen. C/D („klausurrelevant/Kapitel 4“ vs. „Prüfung/vierten Abschnitt“) und E/F („Anwesenheit verpflichtend“ vs. „Anwesenheitspflicht“) werden lexikalisch nicht zusammengeführt. Die organisatorische Doppelung ist für den Regelkern unsichtbar.',
  });
}

// K5 tie-break by UUID
{
  const P1: ScenarioQuestion = {
    key: 'P1',
    id: '00000000-0000-4000-8000-00000000000a',
    text: 'Frage eins?',
    status: 'PENDING',
    positive: 0,
    negative: 0,
  };
  const P2: ScenarioQuestion = {
    key: 'P2',
    id: '00000000-0000-4000-8000-00000000000b',
    text: 'Frage zwei?',
    status: 'PENDING',
    positive: 0,
    negative: 0,
  };
  const a = run([P1, P2]);
  const b = run([
    { ...P1, id: P2.id },
    { ...P2, id: P1.id },
  ]);
  add({
    id: 'K5',
    title: 'Gleichstand wird über die UUID entschieden',
    condition: 'Zwei PENDING-Fragen mit identischen Werten; IDs vertauscht',
    result: `IDs a<b: ${describeCards(a)} · IDs vertauscht: ${describeCards(b)}`,
    finding:
      'Bei Gleichstand bestimmt die zufällige UUID die Reihenfolge, nicht Eingangszeit oder Inhalt (localeCompare auf sourceId).',
  });
}

// K6 room-size sweep for the "Umstritten" label
{
  const boundaries: Record<string, { controversialFrom?: number; controversialUntil?: number }> =
    {};
  for (const q of base.filter((q) => ['A', 'E', 'F'].includes(q.key))) {
    let first: number | undefined;
    let last: number | undefined;
    for (let N = 1; N <= 2000; N++) {
      if (toCompassQuestion(q, N).isControversial) {
        first ??= N;
        last = N;
      }
    }
    boundaries[q.key] = { controversialFrom: first, controversialUntil: last };
  }
  add({
    id: 'K6',
    title: 'Raumgröße N steuert das „Umstritten“-Label',
    condition: 'N = 1…2000 für A (80/30), E (40/40), F (20/20)',
    result: Object.entries(boundaries)
      .map(
        ([k, v]) =>
          `${k}: umstritten für N ∈ [${v.controversialFrom ?? '–'}, ${v.controversialUntil ?? '–'}]`,
      )
      .join(' · '),
    finding:
      'Dieselben Stimmen kippen je nach Raumgröße: A (73 % Zustimmung) gilt in kleinen Räumen als umstritten, E/F (exakt 50:50) verschwinden in großen Räumen aus der Reibungskarte, weil T = ⌈0,1·N⌉ und die Dämpfung mit N wachsen.',
  });
}

// K7 host redaction (qa.redactPassages) changes the text, votes stay attached
{
  const original = base.find((q) => q.key === 'A')!.text;
  const passage = 'linearen Regression';
  const at = original.indexOf(passage);
  const ranges = [
    {
      start: Array.from(original.slice(0, at)).length,
      end: Array.from(original.slice(0, at)).length + Array.from(passage).length,
    },
  ];
  const redactedText = applyQaPassageRedaction(original, ranges);
  if (!redactedText.ok) throw new Error(`Redaction failed: ${redactedText.reason}`);
  const redacted = run(with_('A', { text: redactedText.text }));
  add({
    id: 'K7',
    title: 'Host-Schwärzung bei erhaltenen Stimmen',
    condition: `In A wird „${passage}“ per qa.redactPassages geschwärzt (Repo-Funktion applyQaPassageRedaction); Stimmen 80/30 bleiben`,
    result: `vorher: ${describeCards(run(base))} · nachher: ${describeCards(redacted)} · Text nachher: „${redactedText.text}“`,
    finding:
      'Die Schwärzung entfernt den gemeinsamen Begriff; die lexikalische Themenkarte verschwindet, obwohl A/B inhaltlich weiter dasselbe Anliegen tragen. Der Kompass kennzeichnet die Veränderung nicht.',
  });
}

// K8 archive a controversial question
{
  const r = run(with_('E', { status: 'ARCHIVED' }));
  add({
    id: 'K8',
    title: 'Archivierte Kontroverse',
    condition: 'E wird archiviert',
    result: describeCards(r),
    finding:
      'Archivierte Fragen fallen aus Reibung und Wortwolke heraus; die geteilte Bewertung ist für den Kompass erledigt.',
  });
}

// K9 examiner case: high controversy while still PENDING (only reachable in synthetic
// snapshots: the 1.3 DB rejects votes on PENDING and no moderation action returns to PENDING)
{
  const pendingF = run(with_('F', { status: 'PENDING' }));
  const pendingF4040 = run(with_('F', { status: 'PENDING', positive: 40, negative: 40 }));
  const fSignal = toCompassQuestion(
    { ...base.find((q) => q.key === 'F')!, status: 'PENDING' },
    200,
  );
  add({
    id: 'K9',
    title: 'Hohe Kontroversität bei Status PENDING',
    condition: 'F (20:20) bzw. F (40:40) auf PENDING, übrige Fragen freigegeben, N = 200',
    result: `F 20:20 PENDING (K = ${fSignal.controversyScore?.toFixed(3)}, Label umstritten = ${fSignal.isControversial}): ${describeCards(pendingF)} · F 40:40 PENDING: ${describeCards(pendingF4040)}`,
    finding:
      'Trotz Label „umstritten“ erscheint F nicht auf der Reibungskarte, sondern in der Klärungskarte: Reibung berücksichtigt nur ACTIVE/PINNED (selectFrictionQuestionSourceIds), PENDING ist Freigabestatus. Im Releasepfad ist der Zustand nicht erreichbar, weil die Datenbank Stimmen auf PENDING-Fragen ablehnt (E3: ARSNOVA_QA_QUESTION_NOT_VOTABLE) und keine Moderationsaktion zu PENDING zurückführt.',
  });
}

mkdirSync(`${EVIDENCE}/E2`, { recursive: true });
writeFileSync(`${EVIDENCE}/E2/e2-${env.commitShort}.json`, JSON.stringify({ env, cases }, null, 2));
const md = [
  `# E2 – Gegenfälle`,
  '',
  `Commit \`${env.commit}\` (clean: ${env.workingTreeClean}), ${env.node}, ${env.timestamp}. Basis: alle Fragen freigegeben, N=200, BEST, LEXICAL.`,
  '',
  ...cases.flatMap((c) => [
    `## ${c.id} – ${c.title}`,
    '',
    `**Bedingung:** ${c.condition}`,
    '',
    `**Ergebnis:** ${c.result}`,
    '',
    `**Befund:** ${c.finding}`,
    '',
  ]),
];
writeFileSync(`${EVIDENCE}/E2/e2-${env.commitShort}.md`, md.join('\n'));
process.stdout.write(`${md.join('\n')}\n`);

#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { access, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

import {
  QuizImportSchema,
  QuizUploadInputSchema,
  evaluateShortAnswer,
} from '../../../libs/shared-types/dist/index.js';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const writeArtifacts = process.argv.includes('--write');
const arsnovaDirectory = 'ARSnova';
const mcTestDirectory = 'MC-Test';
const topicBlockNumbers = Array.from({ length: 12 }, (_, index) => index + 1);
const topicBlockFile = (prefix, topicBlock) =>
  `${prefix}_Themenblock_${String(topicBlock).padStart(2, '0')}.json`;
const arsnovaFilenames = topicBlockNumbers.map((topicBlock) =>
  topicBlockFile('ARSnova', topicBlock),
);
const mcTestFilenames = topicBlockNumbers.map((topicBlock) =>
  topicBlockFile('MC-Test', topicBlock),
);
const arsnovaFiles = arsnovaFilenames.map((filename) => `${arsnovaDirectory}/${filename}`);
const mcTestFiles = mcTestFilenames.map((filename) => `${mcTestDirectory}/${filename}`);
const shortTextCasesFile = `${arsnovaDirectory}/ARSnova_Kurztext_Testfaelle.json`;
const distributionFile = `${mcTestDirectory}/MC-Test_Verteilungen.json`;
const checksumFile = 'SHA256SUMS';

const questionTypes = [
  'MULTIPLE_CHOICE',
  'SINGLE_CHOICE',
  'FREETEXT',
  'SHORT_TEXT',
  'SURVEY',
  'RATING',
  'NUMERIC_ESTIMATE',
  'MATCHING',
  'ORDERING',
  'CATEGORIZATION',
];
const cognitiveLevels = new Set(['Verständnis', 'Anwendung', 'Analyse']);
const metaKeys = [
  'additional_buffer_minutes',
  'difficulty_profile',
  'language',
  'question_count',
  'target_audience',
  'test_duration_minutes',
  'time_per_weight_minutes',
  'title',
  'updated',
];
const mcQuestionKeys = [
  'answer',
  'cognitive_level',
  'concept',
  'explanation',
  'mini_glossary',
  'options',
  'question',
  'topic',
  'weight',
];
const targetAudience = 'Bachelorstudierende der Informatik im Modul Cloud Computing';
const expectedQuizConfiguration = {
  showLeaderboard: true,
  allowCustomNicknames: false,
  defaultTimer: 60,
  timerScaleByDifficulty: true,
  enableTimerAccommodation: true,
  enableSoundEffects: true,
  enableRewardEffects: true,
  enableMotivationMessages: true,
  enableEmojiReactions: true,
  anonymousMode: false,
  teamMode: true,
  teamCount: 4,
  teamAssignment: 'AUTO',
  teamNames: ['Apfel :apple:', 'Birne :pear:', 'Banane :banana:', 'Apfelsine :orange:'],
  backgroundMusic: null,
  nicknameTheme: 'KINDERGARTEN',
  bonusTokenCount: 3,
  readingPhaseEnabled: true,
};

const errors = [];
const warnings = [];
const parsedArsnova = new Map();
const parsedMcTests = new Map();

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function normalize(value) {
  return String(value).normalize('NFKC').toLocaleLowerCase('de').replace(/\s+/g, ' ').trim();
}

function sameJson(left, right) {
  return isDeepStrictEqual(left, right);
}

function countBy(values) {
  const counts = {};
  for (const value of values) {
    counts[String(value)] = (counts[String(value)] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) =>
      left.localeCompare(right, 'de', { numeric: true }),
    ),
  );
}

function assertExactKeys(value, expected, context) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (!sameJson(actual, wanted)) {
    fail(`${context}: Schlüssel ${JSON.stringify(actual)} statt ${JSON.stringify(wanted)}.`);
  }
}

async function readJson(filename, { required = true } = {}) {
  try {
    return JSON.parse(await readFile(resolve(moduleDirectory, filename), 'utf8'));
  } catch (error) {
    if (required) {
      fail(`${filename}: nicht lesbares JSON (${error.message}).`);
    }
    return null;
  }
}

async function validateFileInventory() {
  const expectedArsnova = [...arsnovaFilenames, 'ARSnova_Kurztext_Testfaelle.json'].sort();
  const expectedMcTests = [...mcTestFilenames, 'MC-Test_Verteilungen.json'].sort();
  const actualArsnova = (await readdir(resolve(moduleDirectory, arsnovaDirectory))).sort();
  const actualMcTests = (await readdir(resolve(moduleDirectory, mcTestDirectory))).sort();
  if (!sameJson(actualArsnova, expectedArsnova)) {
    fail(
      `ARSnova-Dateimenge ${JSON.stringify(actualArsnova)} statt ${JSON.stringify(expectedArsnova)}.`,
    );
  }
  if (!sameJson(actualMcTests, expectedMcTests)) {
    fail(
      `MC-Test-Dateimenge ${JSON.stringify(actualMcTests)} statt ${JSON.stringify(expectedMcTests)}.`,
    );
  }
}

function formatZodIssues(issues) {
  return issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`).join('; ');
}

function validateChoiceLengths(options, context) {
  const lengths = options.map((option) => normalize(option).length).filter((length) => length > 0);
  if (lengths.length !== options.length) {
    return;
  }
  const shortest = Math.min(...lengths);
  const longest = Math.max(...lengths);
  if (shortest >= 20 && longest / shortest > 2.5) {
    warn(`${context}: auffälliges Optionslängenverhältnis ${shortest}:${longest} fachlich prüfen.`);
  }
}

async function validateArsnovaFile(filename) {
  const data = await readJson(filename);
  if (!data) {
    return;
  }
  parsedArsnova.set(filename, data);

  const importResult = QuizImportSchema.safeParse(data);
  if (!importResult.success) {
    fail(`${filename}: QuizImportSchema verletzt (${formatZodIssues(importResult.error.issues)}).`);
  }
  const uploadResult = QuizUploadInputSchema.safeParse(data.quiz);
  if (!uploadResult.success) {
    fail(
      `${filename}: QuizUploadInputSchema verletzt (${formatZodIssues(uploadResult.error.issues)}).`,
    );
  }
  if (!data.quiz || !Array.isArray(data.quiz.questions)) {
    return;
  }

  const quiz = data.quiz;
  if (data.exportVersion !== 1) {
    fail(`${filename}: exportVersion muss 1 sein.`);
  }
  if (
    typeof data.exportedAt !== 'string' ||
    Number.isNaN(Date.parse(data.exportedAt)) ||
    !data.exportedAt.includes('T')
  ) {
    fail(`${filename}: exportedAt muss ein ISO-8601-Zeitstempel sein.`);
  }
  for (const [key, expected] of Object.entries(expectedQuizConfiguration)) {
    if (!sameJson(quiz[key], expected)) {
      fail(`${filename}: quiz.${key} entspricht nicht dem verbindlichen Gamification-Profil.`);
    }
  }
  if (quiz.questions.length !== 10) {
    fail(`${filename}: genau 10 Fragen erwartet, gefunden ${quiz.questions.length}.`);
  }

  const typeCounts = countBy(quiz.questions.map((question) => question.type));
  for (const type of questionTypes) {
    if (typeCounts[type] !== 1) {
      fail(`${filename}: Fragetyp ${type} muss genau einmal vorkommen.`);
    }
  }
  if (Object.keys(typeCounts).some((type) => !questionTypes.includes(type))) {
    fail(`${filename}: unbekannter Fragetyp in ${JSON.stringify(typeCounts)}.`);
  }

  quiz.questions.forEach((question, index) => {
    const context = `${filename}, Frage ${index + 1}`;
    if (question.order !== index) {
      fail(`${context}: order muss ${index} sein.`);
    }
    if (!['MEDIUM', 'HARD'].includes(question.difficulty)) {
      fail(`${context}: nur MEDIUM oder HARD zulässig.`);
    }
    if (question.timer !== null) {
      fail(`${context}: timer muss null sein, damit der skalierte Standardtimer greift.`);
    }
    if (question.skipReadingPhase === true) {
      fail(`${context}: die verbindliche Lesephase darf nicht übersprungen werden.`);
    }
    if (!String(question.text ?? '').trim()) {
      fail(`${context}: leerer Fragenstamm.`);
    }

    const answers = Array.isArray(question.answers) ? question.answers : [];
    const normalizedAnswers = answers.map((answer) => normalize(answer.text));
    if (new Set(normalizedAnswers).size !== normalizedAnswers.length) {
      fail(`${context}: Antworttexte müssen eindeutig sein.`);
    }
    if (['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SURVEY'].includes(question.type)) {
      validateChoiceLengths(
        answers.map((answer) => answer.text),
        context,
      );
      if (answers.length !== 4) {
        fail(`${context}: ${question.type} benötigt genau vier formal parallele Antwortoptionen.`);
      }
    }

    const correctCount = answers.filter((answer) => answer.isCorrect).length;
    if (question.type === 'SINGLE_CHOICE' && correctCount !== 1) {
      fail(`${context}: SINGLE_CHOICE benötigt genau eine richtige Antwort.`);
    }
    if (
      question.type === 'MULTIPLE_CHOICE' &&
      (correctCount < 2 || correctCount >= answers.length)
    ) {
      fail(
        `${context}: MULTIPLE_CHOICE benötigt mindestens zwei richtige und eine falsche Antwort.`,
      );
    }
    if (question.type === 'SURVEY' && correctCount !== 0) {
      fail(`${context}: SURVEY darf keine richtige Antwort markieren.`);
    }
    if (question.type === 'SHORT_TEXT') {
      if (answers.length < 1 || correctCount !== answers.length) {
        fail(`${context}: alle expliziten SHORT_TEXT-Varianten müssen als richtig markiert sein.`);
      }
      const expectedSettings = {
        shortTextEvaluationMode: 'exact',
        shortTextToleranceLevel: 'none',
        shortTextAllowPartialCredit: false,
        shortTextCaseSensitive: false,
        shortTextTrimWhitespace: true,
        shortTextNormalizeWhitespace: true,
      };
      for (const [key, expected] of Object.entries(expectedSettings)) {
        if (question[key] !== expected) {
          fail(`${context}: ${key} muss ${JSON.stringify(expected)} sein.`);
        }
      }
    }
    if (
      ['FREETEXT', 'RATING', 'NUMERIC_ESTIMATE', 'MATCHING', 'ORDERING', 'CATEGORIZATION'].includes(
        question.type,
      ) &&
      answers.length !== 0
    ) {
      fail(`${context}: ${question.type} darf keine Auswahlantworten enthalten.`);
    }
  });
}

function hasPeriodicPattern(sequence) {
  for (let period = 1; period <= Math.floor(sequence.length / 2); period += 1) {
    if (sequence.every((value, index) => value === sequence[index % period])) {
      return true;
    }
  }
  return false;
}

function longestRun(sequence) {
  let longest = 0;
  let current = 0;
  let previous;
  for (const value of sequence) {
    current = value === previous ? current + 1 : 1;
    previous = value;
    longest = Math.max(longest, current);
  }
  return longest;
}

async function validateMcTestFile(filename) {
  const data = await readJson(filename);
  if (!data) {
    return;
  }
  parsedMcTests.set(filename, data);
  assertExactKeys(data, ['meta', 'questions'], filename);
  if (!data.meta || !Array.isArray(data.questions)) {
    fail(`${filename}: meta oder questions fehlen.`);
    return;
  }
  assertExactKeys(data.meta, metaKeys, `${filename}, meta`);

  const expectedMeta = {
    target_audience: targetAudience,
    question_count: 30,
    difficulty_profile: { leicht: 0, mittel: 12, schwer: 18 },
    time_per_weight_minutes: { 1: 0.5, 2: 0.75, 3: 1 },
    additional_buffer_minutes: 5,
    test_duration_minutes: 32,
    language: 'de',
  };
  for (const [key, expected] of Object.entries(expectedMeta)) {
    if (!sameJson(data.meta[key], expected)) {
      fail(`${filename}: meta.${key} entspricht nicht dem Vertrag.`);
    }
  }
  if (!String(data.meta.title ?? '').trim()) {
    fail(`${filename}: meta.title darf nicht leer sein.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.meta.updated)) {
    fail(`${filename}: meta.updated muss JJJJ-MM-TT entsprechen.`);
  }
  if (data.questions.length !== 30) {
    fail(`${filename}: genau 30 Fragen erwartet, gefunden ${data.questions.length}.`);
  }

  data.questions.forEach((question, index) => {
    const context = `${filename}, Item ${index + 1}`;
    assertExactKeys(question, mcQuestionKeys, context);
    if (!String(question.question ?? '').trim()) {
      fail(`${context}: leerer Fragenstamm.`);
    }
    if (!Array.isArray(question.options) || question.options.length !== 4) {
      fail(`${context}: genau vier Optionen erforderlich.`);
    } else {
      if (question.options.some((option) => typeof option !== 'string')) {
        fail(`${context}: alle Optionen müssen Strings sein.`);
      }
      const normalizedOptions = question.options.map(normalize);
      if (normalizedOptions.some((option) => option.length === 0)) {
        fail(`${context}: Optionen dürfen nicht leer sein.`);
      }
      if (new Set(normalizedOptions).size !== 4) {
        fail(`${context}: Optionen müssen eindeutig sein.`);
      }
      validateChoiceLengths(question.options, context);
    }
    if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer > 3) {
      fail(`${context}: answer muss ein nullbasierter Index von 0 bis 3 sein.`);
    }
    if (![2, 3].includes(question.weight)) {
      fail(`${context}: weight muss 2 oder 3 sein.`);
    }
    if (!cognitiveLevels.has(question.cognitive_level)) {
      fail(`${context}: unzulässige kognitive Stufe ${JSON.stringify(question.cognitive_level)}.`);
    }
    if (
      typeof question.topic !== 'string' ||
      typeof question.concept !== 'string' ||
      !question.topic.trim() ||
      !question.concept.trim()
    ) {
      fail(`${context}: topic und concept dürfen nicht leer sein.`);
    }
    if (
      typeof question.explanation !== 'string' ||
      !question.explanation.trim() ||
      question.explanation.length < 80
    ) {
      fail(`${context}: Erklärung muss eigenständig und mindestens 80 Zeichen lang sein.`);
    }
    if (
      /\b(?:erste|zweite|dritte|vierte)\s+(?:option|antwort)\b|\b(?:option|antwort)\s*[a-d1-4]\b/i.test(
        question.explanation,
      )
    ) {
      fail(`${context}: Erklärung ist von einer Optionsposition abhängig.`);
    }
    if (
      !question.mini_glossary ||
      Array.isArray(question.mini_glossary) ||
      typeof question.mini_glossary !== 'object'
    ) {
      fail(`${context}: mini_glossary muss ein Objekt sein.`);
    } else {
      const entries = Object.entries(question.mini_glossary);
      if (entries.length < 2 || entries.length > 4) {
        fail(`${context}: mini_glossary benötigt zwei bis vier Einträge.`);
      }
      if (
        entries.some(
          ([term, definition]) =>
            !term.trim() || typeof definition !== 'string' || !definition.trim(),
        )
      ) {
        fail(`${context}: Glossarbegriffe und Definitionen dürfen nicht leer sein.`);
      }
    }
  });

  const weights = countBy(data.questions.map((question) => question.weight));
  if (!sameJson(weights, { 2: 12, 3: 18 })) {
    fail(`${filename}: weight-Verteilung ${JSON.stringify(weights)} statt {\"2\":12,\"3\":18}.`);
  }
  const positions = data.questions.map((question) => question.answer);
  const positionCounts = countBy(positions);
  if (
    !['0', '1', '2', '3'].every(
      (position) => positionCounts[position] === 7 || positionCounts[position] === 8,
    )
  ) {
    fail(`${filename}: Lösungspositionen müssen jeweils sieben- oder achtmal vorkommen.`);
  }
  if (longestRun(positions) > 3) {
    fail(`${filename}: mehr als drei identische Lösungspositionen in Folge.`);
  }
  if (hasPeriodicPattern(positions)) {
    fail(`${filename}: periodisches Muster der Lösungspositionen erkannt.`);
  }
}

function validateGlobalUniqueness(collection, fieldPath, label) {
  const seen = new Map();
  for (const [filename, data] of collection) {
    const questions = fieldPath === 'quiz.questions' ? data.quiz?.questions : data.questions;
    for (const [index, question] of (questions ?? []).entries()) {
      const text = fieldPath === 'quiz.questions' ? question.text : question.question;
      const key = normalize(text);
      if (seen.has(key)) {
        fail(
          `${label}: Dublette in ${filename}, Frage ${index + 1}; zuerst gefunden in ${seen.get(key)}.`,
        );
      } else {
        seen.set(key, `${filename}, Frage ${index + 1}`);
      }
    }
  }
}

function validateCrossBankUniqueness() {
  const arsnovaQuestions = new Map();
  for (const [filename, data] of parsedArsnova) {
    for (const [index, question] of (data.quiz?.questions ?? []).entries()) {
      arsnovaQuestions.set(normalize(question.text), `${filename}, Frage ${index + 1}`);
    }
  }
  for (const [filename, data] of parsedMcTests) {
    for (const [index, question] of (data.questions ?? []).entries()) {
      const match = arsnovaQuestions.get(normalize(question.question));
      if (match) {
        fail(
          `Gesamtpaket: identischer Fragenstamm in ${filename}, Item ${index + 1} und ${match}.`,
        );
      }
    }
  }
}

async function validateShortTextCases() {
  const data = await readJson(shortTextCasesFile);
  if (!data) {
    return;
  }
  assertExactKeys(data, ['schemaVersion', 'cases'], shortTextCasesFile);
  if (data.schemaVersion !== 1 || !Array.isArray(data.cases)) {
    fail(`${shortTextCasesFile}: schemaVersion 1 und ein cases-Array sind erforderlich.`);
    return;
  }
  const casesByFile = new Map(data.cases.map((entry) => [entry.file, entry]));
  if (casesByFile.size !== arsnovaFiles.length) {
    fail(`${shortTextCasesFile}: genau ein Testfall je ARSnova-Themenblock erforderlich.`);
  }

  for (const filename of arsnovaFilenames) {
    const testCase = casesByFile.get(filename);
    const quiz = parsedArsnova.get(`${arsnovaDirectory}/${filename}`)?.quiz;
    const question = quiz?.questions?.find((candidate) => candidate.type === 'SHORT_TEXT');
    if (!testCase || !question) {
      fail(`${shortTextCasesFile}: Testfall oder SHORT_TEXT-Frage für ${filename} fehlt.`);
      continue;
    }
    assertExactKeys(
      testCase,
      ['file', 'positives', 'negatives'],
      `${shortTextCasesFile}, ${filename}`,
    );
    if (!Array.isArray(testCase.positives) || !Array.isArray(testCase.negatives)) {
      fail(`${shortTextCasesFile}, ${filename}: positives und negatives müssen Arrays sein.`);
      continue;
    }
    const modelAnswers = question.answers.map((answer) => answer.text);
    const normalizedModels = [...new Set(modelAnswers.map(normalize))].sort();
    const normalizedPositives = [...new Set(testCase.positives.map(normalize))].sort();
    if (!sameJson(normalizedModels, normalizedPositives)) {
      fail(
        `${shortTextCasesFile}, ${filename}: Positivfälle müssen alle Lösungsvarianten abdecken.`,
      );
    }
    if (testCase.negatives.length < 2) {
      fail(
        `${shortTextCasesFile}, ${filename}: mindestens zwei fachlich falsche Negativfälle nötig.`,
      );
    }

    const settings = {
      evaluationMode: question.shortTextEvaluationMode,
      toleranceLevel: question.shortTextToleranceLevel,
      allowPartialCredit: question.shortTextAllowPartialCredit,
      caseSensitive: question.shortTextCaseSensitive,
      trimWhitespace: question.shortTextTrimWhitespace,
      normalizeWhitespace: question.shortTextNormalizeWhitespace,
    };
    for (const positive of testCase.positives) {
      const result = evaluateShortAnswer({
        studentAnswer: positive,
        modelAnswers,
        maxPoints: 100,
        maxLength: question.shortTextMaxLength,
        settings,
      });
      if (result.points !== 100) {
        fail(
          `${shortTextCasesFile}, ${filename}: Positivfall ${JSON.stringify(positive)} erhält ${result.points} Punkte.`,
        );
      }
    }
    for (const negative of testCase.negatives) {
      const result = evaluateShortAnswer({
        studentAnswer: negative,
        modelAnswers,
        maxPoints: 100,
        maxLength: question.shortTextMaxLength,
        settings,
      });
      if (result.points !== 0) {
        fail(
          `${shortTextCasesFile}, ${filename}: Negativfall ${JSON.stringify(negative)} erhält ${result.points} Punkte.`,
        );
      }
    }
  }
}

function buildDistributionReport() {
  return {
    generatedFrom: mcTestFilenames,
    topicBlocks: Object.fromEntries(
      mcTestFilenames.map((filename, index) => {
        const questions = parsedMcTests.get(`${mcTestDirectory}/${filename}`)?.questions ?? [];
        return [
          `TB${String(index + 1).padStart(2, '0')}`,
          {
            file: filename,
            questionCount: questions.length,
            topic: countBy(questions.map((question) => question.topic)),
            cognitive_level: countBy(questions.map((question) => question.cognitive_level)),
            weight: countBy(questions.map((question) => question.weight)),
          },
        ];
      }),
    ),
  };
}

async function validateLocalLinks() {
  const markdownFiles = (await readdir(moduleDirectory)).filter((filename) =>
    filename.endsWith('.md'),
  );
  const linkPattern = /\[[^\]]*]\(([^)]+)\)/g;
  for (const filename of markdownFiles) {
    const content = await readFile(resolve(moduleDirectory, filename), 'utf8');
    for (const match of content.matchAll(linkPattern)) {
      let target = match[1].trim();
      if (!target || target.startsWith('#') || /^(?:https?:|mailto:|data:)/i.test(target)) {
        continue;
      }
      target = target.split('#', 1)[0].trim().replace(/^<|>$/g, '');
      if (!target) {
        continue;
      }
      try {
        await access(resolve(moduleDirectory, decodeURIComponent(target)));
      } catch {
        if (
          writeArtifacts &&
          [distributionFile, checksumFile].includes(target.replace(/^\.\//, ''))
        ) {
          continue;
        }
        fail(`${filename}: lokales Linkziel ${JSON.stringify(target)} existiert nicht.`);
      }
    }
  }
}

async function sha256(filename) {
  const content = await readFile(resolve(moduleDirectory, filename));
  return createHash('sha256').update(content).digest('hex');
}

async function writeGeneratedArtifacts(distributions) {
  await writeFile(
    resolve(moduleDirectory, distributionFile),
    `${JSON.stringify(distributions, null, 2)}\n`,
    'utf8',
  );
  const machineReadableFiles = [
    ...arsnovaFiles,
    ...mcTestFiles,
    shortTextCasesFile,
    distributionFile,
  ].sort((left, right) => left.localeCompare(right, 'de'));
  const lines = [];
  for (const filename of machineReadableFiles) {
    lines.push(`${await sha256(filename)}  ${filename}`);
  }
  await writeFile(resolve(moduleDirectory, checksumFile), `${lines.join('\n')}\n`, 'utf8');
}

async function validateGeneratedArtifacts(distributions) {
  const existingDistribution = await readJson(distributionFile, { required: false });
  if (!existingDistribution || !sameJson(existingDistribution, distributions)) {
    fail(
      `${distributionFile}: fehlt oder stimmt nicht mit den programmgesteuerten Zählungen überein.`,
    );
  }

  try {
    const expectedFiles = [
      ...arsnovaFiles,
      ...mcTestFiles,
      shortTextCasesFile,
      distributionFile,
    ].sort((left, right) => left.localeCompare(right, 'de'));
    const manifest = await readFile(resolve(moduleDirectory, checksumFile), 'utf8');
    const lines = manifest.split(/\r?\n/);
    if (lines.at(-1) === '') {
      lines.pop();
    }
    if (lines.length !== expectedFiles.length) {
      fail(
        `${checksumFile}: genau ${expectedFiles.length} Einträge erwartet, gefunden ${lines.length}.`,
      );
    }

    const entries = [];
    for (const [index, line] of lines.entries()) {
      const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
      if (!match) {
        fail(`${checksumFile}: Zeile ${index + 1} verletzt das Format "<sha256>  <datei>".`);
        continue;
      }
      entries.push([match[2], match[1]]);
    }
    const listedFiles = entries.map(([filename]) => filename);
    if (new Set(listedFiles).size !== listedFiles.length) {
      fail(`${checksumFile}: Dateinamen dürfen nicht mehrfach aufgeführt werden.`);
    }
    const checksumMap = new Map(entries);
    if (!sameJson([...checksumMap.keys()].sort(), expectedFiles)) {
      fail(
        `${checksumFile}: Dateimenge stimmt nicht mit den maschinenlesbaren Artefakten überein.`,
      );
    }
    for (const filename of expectedFiles) {
      if (checksumMap.get(filename) !== (await sha256(filename))) {
        fail(`${checksumFile}: Prüfsumme für ${filename} stimmt nicht.`);
      }
    }
  } catch (error) {
    fail(`${checksumFile}: nicht lesbar (${error.message}).`);
  }
}

await validateFileInventory();
await Promise.all(arsnovaFiles.map(validateArsnovaFile));
await Promise.all(mcTestFiles.map(validateMcTestFile));
validateGlobalUniqueness(parsedArsnova, 'quiz.questions', 'ARSnova-Paket');
validateGlobalUniqueness(parsedMcTests, 'questions', 'MC-Test-Paket');
validateCrossBankUniqueness();
await validateShortTextCases();
await validateLocalLinks();

const distributions = buildDistributionReport();
if (writeArtifacts && errors.length === 0) {
  await writeGeneratedArtifacts(distributions);
} else if (!writeArtifacts) {
  await validateGeneratedArtifacts(distributions);
}

for (const message of warnings) {
  console.warn(`WARNUNG: ${message}`);
}
for (const message of errors) {
  console.error(`FEHLER: ${message}`);
}

if (errors.length > 0) {
  console.error(
    `Validierung fehlgeschlagen: ${errors.length} Fehler, ${warnings.length} Warnungen.`,
  );
  process.exit(1);
}

console.log(
  `Validierung bestanden: ${parsedArsnova.size} ARSnova-Dateien, ${parsedMcTests.size} MC-Test-Dateien, ${warnings.length} Warnungen.`,
);
if (writeArtifacts) {
  console.log(`${distributionFile} und ${checksumFile} wurden abschließend erzeugt.`);
}

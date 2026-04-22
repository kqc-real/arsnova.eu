import { QUIZ_EXPORT_VERSION, type Difficulty, type QuizExport } from '@arsnova/shared-types';

type JsonRecord = Record<string, unknown>;
type ImportedQuiz = QuizExport['quiz'];
type ImportedQuestion = ImportedQuiz['questions'][number];
type ImportedAnswer = ImportedQuestion['answers'][number];

const CLICK_TEAM_NAME_LIMIT = 8;

export type QuizImportWarningKind =
  | 'skipped_question'
  | 'mapped_question'
  | 'simplified_question'
  | 'ignored_quiz_options';

export interface QuizImportWarning {
  kind: QuizImportWarningKind;
  message: string;
  detail?: string;
  questionNumber?: number;
  questionText?: string;
}

interface MappedQuestionResult {
  question: ImportedQuestion;
  warnings: QuizImportWarning[];
}

export interface NormalizedQuizImportPayload {
  payload: unknown;
  sourceQuiz?: ImportedQuiz;
  warnings: QuizImportWarning[];
}

export function normalizeQuizImportPayload(payload: unknown): NormalizedQuizImportPayload {
  if (!isRecord(payload) || !looksLikeArsnovaClickExport(payload)) {
    return { payload, warnings: [] };
  }

  return convertArsnovaClickExport(payload);
}

function looksLikeArsnovaClickExport(value: JsonRecord): boolean {
  return typeof value['name'] === 'string' && Array.isArray(value['questionList']);
}

function convertArsnovaClickExport(source: JsonRecord): NormalizedQuizImportPayload {
  const name = readRequiredString(source['name'], 'Quiz-Name');
  const description = readOptionalString(source['description']);
  const sessionConfig = isRecord(source['sessionConfig']) ? source['sessionConfig'] : null;
  const teamSettings = mapTeamSettings(sessionConfig);
  const allowCustomNicknames = mapAllowCustomNicknames(sessionConfig);
  const readingPhaseEnabled = readBoolean(sessionConfig?.['readingConfirmationEnabled']) ?? true;
  const questionsRaw = source['questionList'];

  if (!Array.isArray(questionsRaw)) {
    throw new Error('arsnova.click-Export ohne gueltige questionList.');
  }

  const warnings: QuizImportWarning[] = [];
  const ignoredQuizOptionLabels = collectIgnoredQuizOptionLabels(source);
  if (ignoredQuizOptionLabels.length > 0) {
    warnings.push({
      kind: 'ignored_quiz_options',
      message:
        'Einige Quiz-Einstellungen wie Musik, Anzeige oder Namensvorgaben wurden nicht übernommen.',
      detail: `Nicht uebernommene Felder: ${ignoredQuizOptionLabels.join(', ')}`,
    });
  }

  const questions: ImportedQuestion[] = [];
  for (const [index, question] of questionsRaw.entries()) {
    const questionText =
      isRecord(question) && typeof question['questionText'] === 'string'
        ? readOptionalString(question['questionText'])
        : undefined;

    try {
      const mapped = mapQuestion(question, index);
      questions.push(mapped.question);
      warnings.push(...mapped.warnings);
    } catch (error) {
      warnings.push({
        kind: 'skipped_question',
        questionNumber: index + 1,
        questionText,
        message:
          error instanceof Error ? error.message : 'Diese Frage konnte nicht übernommen werden.',
      });
    }
  }

  const sourceQuiz: ImportedQuiz = {
    name,
    ...(description ? { description } : {}),
    motifImageUrl: null,
    showLeaderboard: true,
    allowCustomNicknames,
    defaultTimer: null,
    timerScaleByDifficulty: true,
    enableSoundEffects: true,
    enableRewardEffects: true,
    enableMotivationMessages: true,
    enableEmojiReactions: true,
    anonymousMode: false,
    teamMode: teamSettings.teamMode,
    teamCount: teamSettings.teamCount,
    teamAssignment: teamSettings.teamAssignment,
    teamNames: teamSettings.teamNames,
    backgroundMusic: null,
    nicknameTheme: 'HIGH_SCHOOL',
    bonusTokenCount: null,
    readingPhaseEnabled,
    questions,
  };

  return {
    payload: {
      exportVersion: QUIZ_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      quiz: sourceQuiz,
    } satisfies QuizExport,
    sourceQuiz,
    warnings,
  };
}

function collectIgnoredQuizOptionLabels(source: JsonRecord): string[] {
  const ignored = new Set<string>();
  const sessionConfig = isRecord(source['sessionConfig']) ? source['sessionConfig'] : null;
  const nicks = isRecord(sessionConfig?.['nicks']) ? sessionConfig['nicks'] : null;

  addIfPresent(source, ignored, 'origin');
  addIfPresent(source, ignored, 'state');
  addIfPresent(source, ignored, 'currentQuestionIndex');
  addIfPresent(source, ignored, 'currentStartTimestamp');
  addIfPresent(source, ignored, 'sentQuestionIndex');
  addIfPresent(source, ignored, 'readingConfirmationRequested');
  addIfPresent(source, ignored, 'questionCount');
  addIfPresent(sessionConfig, ignored, 'sessionConfig.confidenceSliderEnabled');
  addIfPresent(sessionConfig, ignored, 'sessionConfig.showResponseProgress');
  addIfPresent(sessionConfig, ignored, 'sessionConfig.theme');
  addIfPresent(sessionConfig, ignored, 'sessionConfig.leaderboardAlgorithm');
  addIfPresent(sessionConfig, ignored, 'sessionConfig.music');
  addIfPresent(nicks, ignored, 'sessionConfig.nicks.maxMembersPerGroup');
  addIfPresent(nicks, ignored, 'sessionConfig.nicks.selectedNicks');

  return [...ignored];
}

function mapTeamSettings(
  sessionConfig: JsonRecord | null,
): Pick<ImportedQuiz, 'teamMode' | 'teamCount' | 'teamAssignment' | 'teamNames'> {
  const nicks = isRecord(sessionConfig?.['nicks']) ? sessionConfig['nicks'] : null;
  const groupsRaw = Array.isArray(nicks?.['memberGroups']) ? nicks['memberGroups'] : [];
  const teamNames = groupsRaw
    .map((group) => (isRecord(group) ? readOptionalString(group['name']) : undefined))
    .filter((name): name is string => typeof name === 'string' && name.length > 0)
    .slice(0, CLICK_TEAM_NAME_LIMIT);

  const teamMode = teamNames.length >= 2;
  return {
    teamMode,
    teamCount: teamMode ? teamNames.length : null,
    teamAssignment: readBoolean(nicks?.['autoJoinToGroup']) === true ? 'AUTO' : 'MANUAL',
    teamNames: teamMode ? teamNames : [],
  };
}

function mapAllowCustomNicknames(sessionConfig: JsonRecord | null): boolean {
  const nicks = isRecord(sessionConfig?.['nicks']) ? sessionConfig['nicks'] : null;
  const blockIllegalNicks = readBoolean(nicks?.['blockIllegalNicks']);
  return blockIllegalNicks === undefined ? false : !blockIllegalNicks;
}

function mapQuestion(value: unknown, index: number): MappedQuestionResult {
  if (!isRecord(value)) {
    throw new Error('Diese Frage ist unvollständig.');
  }

  const questionNumber = index + 1;
  const questionText = readOptionalString(value['questionText']);
  const sourceType = readOptionalString(value['TYPE']) ?? readOptionalString(value['type']);
  const text = readRequiredString(value['questionText'], `Frage ${questionNumber}`);
  const timer = normalizeTimer(value['timer']);
  const difficulty = mapDifficulty(value['difficulty']);
  const warnings = collectQuestionWarnings(value, questionNumber, questionText);

  switch (sourceType) {
    case 'SingleChoiceQuestion':
      return {
        question: {
          text,
          type: 'SINGLE_CHOICE',
          difficulty,
          order: index,
          ...(timer === undefined ? {} : { timer }),
          answers: mapChoiceAnswers(value, 'SINGLE_CHOICE'),
          enabled: true,
        },
        warnings,
      };
    case 'YesNoSingleChoiceQuestion':
    case 'TrueFalseSingleChoiceQuestion':
      warnings.push({
        kind: 'mapped_question',
        questionNumber,
        questionText,
        message: 'Wurde als normale Single-Choice-Frage importiert.',
        detail: sourceType,
      });
      return {
        question: {
          text,
          type: 'SINGLE_CHOICE',
          difficulty,
          order: index,
          ...(timer === undefined ? {} : { timer }),
          answers: mapChoiceAnswers(value, 'SINGLE_CHOICE'),
          enabled: true,
        },
        warnings,
      };
    case 'MultipleChoiceQuestion':
      return {
        question: {
          text,
          type: 'MULTIPLE_CHOICE',
          difficulty,
          order: index,
          ...(timer === undefined ? {} : { timer }),
          answers: mapChoiceAnswers(value, 'MULTIPLE_CHOICE'),
          enabled: true,
        },
        warnings,
      };
    case 'SurveyQuestion':
      return {
        question: {
          text,
          type: 'SURVEY',
          difficulty,
          order: index,
          ...(timer === undefined ? {} : { timer }),
          answers: mapSurveyAnswers(value, false),
          enabled: true,
        },
        warnings,
      };
    case 'ABCDSurveyQuestion':
      warnings.push({
        kind: 'mapped_question',
        questionNumber,
        questionText,
        message: 'Wurde als normale Umfrage importiert.',
        detail: sourceType,
      });
      return {
        question: {
          text,
          type: 'SURVEY',
          difficulty,
          order: index,
          ...(timer === undefined ? {} : { timer }),
          answers: mapSurveyAnswers(value, true),
          enabled: true,
        },
        warnings,
      };
    case 'FreeTextQuestion':
      return {
        question: {
          text,
          type: 'FREETEXT',
          difficulty,
          order: index,
          ...(timer === undefined ? {} : { timer }),
          answers: [],
          enabled: true,
        },
        warnings,
      };
    case 'RangedQuestion':
      throw new Error('Dieser Fragetyp wird in arsnova.eu noch nicht unterstützt.');
    default:
      throw new Error('Dieser Fragetyp wird in arsnova.eu noch nicht unterstützt.');
  }
}

function collectQuestionWarnings(
  question: JsonRecord,
  questionNumber: number,
  questionText?: string,
): QuizImportWarning[] {
  const ignored = new Set<string>();

  addIfPresent(question, ignored, 'displayAnswerText');
  addIfPresent(question, ignored, 'showOneAnswerPerRow');
  addIfPresent(question, ignored, 'multipleSelectionEnabled');
  addIfPresent(question, ignored, 'tags');
  addIfPresent(question, ignored, 'requiredForToken');

  const answers = Array.isArray(question['answerOptionList']) ? question['answerOptionList'] : [];
  let hasFreeTextAnswerConfig = false;
  for (const answer of answers) {
    if (!isRecord(answer)) continue;
    if (
      Object.hasOwn(answer, 'configCaseSensitive') ||
      Object.hasOwn(answer, 'configTrimWhitespaces') ||
      Object.hasOwn(answer, 'configUseKeywords') ||
      Object.hasOwn(answer, 'configUsePunctuation')
    ) {
      hasFreeTextAnswerConfig = true;
    }
  }

  const warnings: QuizImportWarning[] = [];
  if (ignored.size > 0) {
    warnings.push({
      kind: 'simplified_question',
      questionNumber,
      questionText,
      message: 'Zusatzoptionen dieser Frage wurden nicht übernommen.',
      detail: [...ignored].join(', '),
    });
  }

  if (hasFreeTextAnswerConfig) {
    warnings.push({
      kind: 'simplified_question',
      questionNumber,
      questionText,
      message: 'Sonderregeln für Freitext-Antworten wurden nicht übernommen.',
      detail: 'configCaseSensitive, configTrimWhitespaces, configUseKeywords, configUsePunctuation',
    });
  }

  return warnings;
}

function mapChoiceAnswers(
  question: JsonRecord,
  targetType: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE',
): ImportedAnswer[] {
  const answers = readAnswerList(question['answerOptionList']);
  const correctCount = answers.filter((answer) => answer.isCorrect).length;

  if (answers.length < 2) {
    throw new Error('Es werden mindestens zwei Antwortoptionen benötigt.');
  }

  if (targetType === 'SINGLE_CHOICE' && correctCount !== 1) {
    throw new Error('Es muss genau eine richtige Antwort geben.');
  }

  if (targetType === 'MULTIPLE_CHOICE' && correctCount < 1) {
    throw new Error('Es muss mindestens eine richtige Antwort geben.');
  }

  return answers;
}

function mapSurveyAnswers(question: JsonRecord, useAbcdFallback: boolean): ImportedAnswer[] {
  const answers = useAbcdFallback
    ? readAnswerList(question['answerOptionList'], ['A', 'B', 'C', 'D'])
    : readAnswerList(question['answerOptionList']);

  if (answers.length < 2) {
    throw new Error('Es werden mindestens zwei Antwortoptionen benötigt.');
  }

  return answers.map((answer) => ({ ...answer, isCorrect: false }));
}

function readAnswerList(value: unknown, fallbackTexts: string[] = []): ImportedAnswer[] {
  if (!Array.isArray(value)) {
    if (fallbackTexts.length > 0) {
      return fallbackTexts.map((text) => ({ text, isCorrect: false }));
    }
    throw new Error('Die Antwortoptionen sind unvollständig.');
  }

  const answers = value.map((answer, answerIndex) => mapAnswer(answer, answerIndex));
  return answers.length > 0 || fallbackTexts.length === 0
    ? answers
    : fallbackTexts.map((text) => ({ text, isCorrect: false }));
}

function mapAnswer(value: unknown, answerIndex: number): ImportedAnswer {
  if (!isRecord(value)) {
    throw new Error(`Antwort ${answerIndex + 1} ist unvollständig.`);
  }

  const text = readOptionalString(value['answerText']);
  if (!text) {
    throw new Error(`Antwort ${answerIndex + 1} hat keinen gültigen Text.`);
  }

  return {
    text,
    isCorrect: readBoolean(value['isCorrect']) ?? false,
  };
}

function mapDifficulty(value: unknown): Difficulty {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'MEDIUM';
  }
  if (value <= 3) return 'EASY';
  if (value <= 7) return 'MEDIUM';
  return 'HARD';
}

function normalizeTimer(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  const rounded = Math.round(value);
  return rounded >= 5 && rounded <= 300 ? rounded : undefined;
}

function readRequiredString(value: unknown, label: string): string {
  const normalized = readOptionalString(value);
  if (!normalized) {
    throw new Error(`${label} ist unvollständig.`);
  }
  return normalized;
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function addIfPresent(value: JsonRecord | null, target: Set<string>, key: string): void {
  if (value && Object.hasOwn(value, key)) {
    target.add(key);
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

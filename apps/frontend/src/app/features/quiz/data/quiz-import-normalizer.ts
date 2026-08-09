import {
  QUIZ_EXPORT_VERSION,
  SHORT_TEXT_DEFAULT_MAX_LENGTH,
  SHORT_TEXT_MAX_LENGTH_LIMIT,
  normalizeShortTextValue,
  questionSupportsConfidence,
  type Difficulty,
  type QuizExport,
} from '@arsnova/shared-types';

type JsonRecord = Record<string, unknown>;
type ImportedQuiz = QuizExport['quiz'];
type ImportedQuestion = ImportedQuiz['questions'][number];
type ImportedAnswer = ImportedQuestion['answers'][number];
type ClickFreeTextFlagKey =
  'configCaseSensitive' | 'configTrimWhitespaces' | 'configUseKeywords' | 'configUsePunctuation';

const CLICK_TEAM_NAME_LIMIT = 8;
const NUMERIC_ESTIMATE_MAX_DECIMAL_PLACES = 10;

interface ClickFreeTextAnswerOption {
  text: string;
  configCaseSensitive?: boolean;
  configTrimWhitespaces?: boolean;
  configUseKeywords?: boolean;
  configUsePunctuation?: boolean;
}

interface ParsedClickFreeTextAnswers {
  answers: ClickFreeTextAnswerOption[];
  discardedAnswerCount: number;
}

interface ResolvedClickBooleanSetting {
  value: boolean;
  hadConflicts: boolean;
}

export type QuizImportWarningKind =
  'skipped_question' | 'mapped_question' | 'simplified_question' | 'ignored_quiz_options';

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
  if (!isRecord(payload)) {
    return { payload, warnings: [] };
  }
  if (!looksLikeArsnovaClickExport(payload)) {
    return { payload: normalizeNativeStructuredQuestionIds(payload), warnings: [] };
  }

  return convertArsnovaClickExport(payload);
}

function normalizeNativeStructuredQuestionIds(payload: JsonRecord): JsonRecord {
  const quiz = isRecord(payload['quiz']) ? payload['quiz'] : null;
  const questions = Array.isArray(quiz?.['questions']) ? quiz['questions'] : null;
  if (!quiz || !questions) return payload;

  return {
    ...payload,
    quiz: {
      ...quiz,
      questions: questions.map((entry) => {
        if (!isRecord(entry)) return entry;
        const type = entry['type'];
        if (type === 'MATCHING' && Array.isArray(entry['matchingPairs'])) {
          return {
            ...entry,
            matchingShuffleRight: readBoolean(entry['matchingShuffleRight']) ?? true,
            matchingPairs: entry['matchingPairs'].map((pair) => {
              if (!isRecord(pair)) return pair;
              return {
                ...pair,
                leftId: readOptionalString(pair['leftId']) ?? createOpaqueStructuredId(),
                rightId: readOptionalString(pair['rightId']) ?? createOpaqueStructuredId(),
              };
            }),
          };
        }
        if (type === 'CATEGORIZATION' && Array.isArray(entry['categorizationItems'])) {
          return {
            ...entry,
            categorizationShuffleItems: readBoolean(entry['categorizationShuffleItems']) ?? true,
            categorizationItems: entry['categorizationItems'].map((item) => {
              if (!isRecord(item)) return item;
              return {
                ...item,
                id: readOptionalString(item['id']) ?? createOpaqueStructuredId(),
              };
            }),
          };
        }
        return entry;
      }),
    },
  };
}

function createOpaqueStructuredId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
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
  const confidenceSliderEnabled = readBoolean(sessionConfig?.['confidenceSliderEnabled']) === true;
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
      detail: `Nicht übernommene Felder: ${ignoredQuizOptionLabels.join(', ')}`,
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

  applyClickConfidenceSettings(questions, confidenceSliderEnabled, sessionConfig, warnings);

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
    showQuestionTypeIndicators: true,
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

function applyClickConfidenceSettings(
  questions: ImportedQuestion[],
  confidenceSliderEnabled: boolean,
  sessionConfig: JsonRecord | null,
  warnings: QuizImportWarning[],
): void {
  if (!confidenceSliderEnabled) {
    return;
  }

  const labelLow =
    readOptionalConfidenceLabel(sessionConfig?.['confidenceLabelLow']) ??
    readOptionalConfidenceLabel(sessionConfig?.['confidenceLowLabel']) ??
    readOptionalConfidenceLabel(sessionConfig?.['confidenceSliderLabelLow']);
  const labelHigh =
    readOptionalConfidenceLabel(sessionConfig?.['confidenceLabelHigh']) ??
    readOptionalConfidenceLabel(sessionConfig?.['confidenceHighLabel']) ??
    readOptionalConfidenceLabel(sessionConfig?.['confidenceSliderLabelHigh']);

  let enabledCount = 0;
  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    if (!question || !questionSupportsConfidence(question.type)) {
      continue;
    }
    questions[index] = {
      ...question,
      confidenceEnabled: true,
      ...(labelLow ? { confidenceLabelLow: labelLow } : {}),
      ...(labelHigh ? { confidenceLabelHigh: labelHigh } : {}),
    };
    enabledCount += 1;
  }

  if (enabledCount > 0) {
    warnings.push({
      kind: 'mapped_question',
      message: $localize`:@@quizImport.confidenceMappedMessage:Die Selbsteinschätzung wurde für bewertbare Fragen übernommen.`,
      detail: buildConfidenceImportMappedDetail(enabledCount, labelLow, labelHigh),
    });
  }
}

function buildConfidenceImportMappedDetail(
  count: number,
  labelLow?: string,
  labelHigh?: string,
): string {
  if (labelLow && labelHigh) {
    return $localize`:@@quizImport.confidenceMappedDetailBoth:Aktiviert für ${count}:count: Frage(n) · niedrig: ${labelLow}:low: · hoch: ${labelHigh}:high:`;
  }
  if (labelLow) {
    return $localize`:@@quizImport.confidenceMappedDetailLow:Aktiviert für ${count}:count: Frage(n) · niedrig: ${labelLow}:low:`;
  }
  if (labelHigh) {
    return $localize`:@@quizImport.confidenceMappedDetailHigh:Aktiviert für ${count}:count: Frage(n) · hoch: ${labelHigh}:high:`;
  }
  return $localize`:@@quizImport.confidenceMappedDetail:Aktiviert für ${count}:count: Frage(n)`;
}

function readOptionalConfidenceLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 50) {
    return undefined;
  }
  return trimmed;
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
      return mapFreeTextQuestion({
        question: value,
        questionNumber,
        questionText,
        text,
        index,
        timer,
        difficulty,
        warnings,
      });
    case 'RangedQuestion':
      return mapRangedQuestion({
        question: value,
        questionNumber,
        questionText,
        text,
        index,
        timer,
        difficulty,
        warnings,
      });
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

  return warnings;
}

function mapFreeTextQuestion(params: {
  question: JsonRecord;
  questionNumber: number;
  questionText?: string;
  text: string;
  index: number;
  timer?: number;
  difficulty: Difficulty;
  warnings: QuizImportWarning[];
}): MappedQuestionResult {
  const {
    question,
    questionNumber,
    questionText,
    text,
    index,
    timer,
    difficulty,
    warnings: baseWarnings,
  } = params;
  const warnings = [...baseWarnings];
  const parsedAnswers = readClickFreeTextAnswers(question['answerOptionList']);

  if (parsedAnswers.discardedAnswerCount > 0) {
    warnings.push({
      kind: 'simplified_question',
      questionNumber,
      questionText,
      message: 'Leere Kurzantwort-Musterlösungen wurden verworfen.',
      detail: `${parsedAnswers.discardedAnswerCount} Eintrag/Einträge`,
    });
  }

  if (parsedAnswers.answers.length === 0) {
    warnings.push({
      kind: 'simplified_question',
      questionNumber,
      questionText,
      message: 'Ohne gültige Musterlösungen wurde die Kurzantwort als Freitext importiert.',
    });
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
  }

  const caseSensitive = resolveClickBooleanSetting(
    parsedAnswers.answers.map((answer) => answer.configCaseSensitive),
    false,
    'preferFalse',
  );
  const trimWhitespace = resolveClickBooleanSetting(
    parsedAnswers.answers.map((answer) => answer.configTrimWhitespaces),
    true,
    'preferTrue',
  );
  const conflictingSettings = new Set<string>();
  if (caseSensitive.hadConflicts) {
    conflictingSettings.add('configCaseSensitive');
  }
  if (trimWhitespace.hadConflicts) {
    conflictingSettings.add('configTrimWhitespaces');
  }
  if (conflictingSettings.size > 0) {
    warnings.push({
      kind: 'simplified_question',
      questionNumber,
      questionText,
      message: 'Abweichende Kurzantwort-Regeln je Musterlösung wurden vereinheitlicht.',
      detail: [...conflictingSettings].join(', '),
    });
  }

  const unsupportedSettings = new Set<string>();
  if (hasAnyFlagValue(parsedAnswers.answers, 'configUseKeywords', true)) {
    unsupportedSettings.add('configUseKeywords');
  }
  if (hasAnyFlagValue(parsedAnswers.answers, 'configUsePunctuation', false)) {
    unsupportedSettings.add('configUsePunctuation');
  }
  if (unsupportedSettings.size > 0) {
    warnings.push({
      kind: 'simplified_question',
      questionNumber,
      questionText,
      message: 'Nicht alle Kurzantwort-Regeln konnten 1:1 übernommen werden.',
      detail: [...unsupportedSettings].join(', '),
    });
  }

  const normalizationOptions = {
    caseSensitive: caseSensitive.value,
    trimWhitespace: trimWhitespace.value,
    normalizeWhitespace: false,
  };
  const answers: ImportedAnswer[] = [];
  const seenNormalizedAnswers = new Set<string>();
  let mergedAnswerCount = 0;

  for (const answer of parsedAnswers.answers) {
    const normalizedAnswer = normalizeShortTextValue(answer.text, normalizationOptions);
    if (!normalizedAnswer) {
      continue;
    }
    if (seenNormalizedAnswers.has(normalizedAnswer)) {
      mergedAnswerCount += 1;
      continue;
    }
    seenNormalizedAnswers.add(normalizedAnswer);
    answers.push({
      text: answer.text,
      isCorrect: true,
    });
  }

  if (mergedAnswerCount > 0) {
    warnings.push({
      kind: 'simplified_question',
      questionNumber,
      questionText,
      message: 'Doppelte Kurzantwort-Musterlösungen wurden zusammengeführt.',
      detail: `${mergedAnswerCount} Eintrag/Einträge`,
    });
  }

  if (answers.length === 0) {
    warnings.push({
      kind: 'simplified_question',
      questionNumber,
      questionText,
      message: 'Ohne gültige Musterlösungen wurde die Kurzantwort als Freitext importiert.',
    });
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
  }

  const longestAnswerLength = Math.max(...answers.map((answer) => answer.text.length), 0);
  const shortTextMaxLength =
    longestAnswerLength > SHORT_TEXT_DEFAULT_MAX_LENGTH
      ? Math.min(longestAnswerLength, SHORT_TEXT_MAX_LENGTH_LIMIT)
      : undefined;

  return {
    question: {
      text,
      type: 'SHORT_TEXT',
      difficulty,
      order: index,
      ...(timer === undefined ? {} : { timer }),
      answers,
      shortTextEvaluationKind: 'text',
      ...(shortTextMaxLength === undefined ? {} : { shortTextMaxLength }),
      shortTextCaseSensitive: caseSensitive.value,
      shortTextEvaluationMode: 'exact',
      shortTextToleranceLevel: 'none',
      shortTextAllowPartialCredit: false,
      shortTextTrimWhitespace: trimWhitespace.value,
      shortTextNormalizeWhitespace: false,
      enabled: true,
    },
    warnings,
  };
}

function mapRangedQuestion(params: {
  question: JsonRecord;
  questionNumber: number;
  questionText?: string;
  text: string;
  index: number;
  timer?: number;
  difficulty: Difficulty;
  warnings: QuizImportWarning[];
}): MappedQuestionResult {
  const {
    question,
    questionNumber,
    questionText,
    text,
    index,
    timer,
    difficulty,
    warnings: baseWarnings,
  } = params;
  const warnings = [...baseWarnings];
  let rangeMin = readRequiredNumber(question['rangeMin'], 'Linke Bereichsgrenze');
  let rangeMax = readRequiredNumber(question['rangeMax'], 'Rechte Bereichsgrenze');
  let correctValue = readRequiredNumber(question['correctValue'], 'Referenzwert');
  const rawDecimalPlaces = Math.max(
    countDecimalPlaces(rangeMin),
    countDecimalPlaces(rangeMax),
    countDecimalPlaces(correctValue),
  );
  const decimalPlaces = Math.min(rawDecimalPlaces, NUMERIC_ESTIMATE_MAX_DECIMAL_PLACES);

  if (rawDecimalPlaces > NUMERIC_ESTIMATE_MAX_DECIMAL_PLACES) {
    rangeMin = roundToDecimalPlaces(rangeMin, decimalPlaces);
    rangeMax = roundToDecimalPlaces(rangeMax, decimalPlaces);
    correctValue = roundToDecimalPlaces(correctValue, decimalPlaces);
    warnings.push({
      kind: 'simplified_question',
      questionNumber,
      questionText,
      message: 'Sehr genaue Zahlenwerte wurden auf die maximal unterstützte Genauigkeit gerundet.',
      detail: `${NUMERIC_ESTIMATE_MAX_DECIMAL_PLACES} Nachkommastellen`,
    });
  }

  if (rangeMin === rangeMax) {
    throw new Error('Schätzfragen benötigen unterschiedliche Bereichsgrenzen.');
  }

  const numericIntervalLeft = Math.min(rangeMin, rangeMax);
  const numericIntervalRight = Math.max(rangeMin, rangeMax);
  if (rangeMin > rangeMax) {
    warnings.push({
      kind: 'simplified_question',
      questionNumber,
      questionText,
      message: 'Vertauschte Bereichsgrenzen der Schätzfrage wurden korrigiert.',
      detail: `rangeMin=${String(rangeMin)}, rangeMax=${String(rangeMax)}`,
    });
  }

  if (correctValue < numericIntervalLeft || correctValue > numericIntervalRight) {
    warnings.push({
      kind: 'simplified_question',
      questionNumber,
      questionText,
      message:
        'Der Referenzwert liegt außerhalb des Click-Toleranzbands; bitte prüfe die importierte Schätzfrage.',
    });
  }

  const numericInputType = decimalPlaces === 0 ? 'INTEGER' : 'DECIMAL';
  warnings.push({
    kind: 'mapped_question',
    questionNumber,
    questionText,
    message: 'Wurde als numerische Schätzfrage importiert.',
    detail:
      'rangeMin/rangeMax wurden als absolutes Toleranzband übernommen; correctValue wurde als Referenzwert übernommen.',
  });

  return {
    question: {
      text,
      type: 'NUMERIC_ESTIMATE',
      difficulty,
      order: index,
      ...(timer === undefined ? {} : { timer }),
      answers: [],
      numericToleranceMode: 'ABSOLUTE_INTERVAL',
      numericReferenceValue: correctValue,
      numericIntervalLeft,
      numericIntervalRight,
      numericInputType,
      ...(numericInputType === 'DECIMAL' ? { numericDecimalPlaces: decimalPlaces } : {}),
      numericTwoRounds: false,
      enabled: true,
    },
    warnings,
  };
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

function readClickFreeTextAnswers(value: unknown): ParsedClickFreeTextAnswers {
  if (!Array.isArray(value)) {
    return { answers: [], discardedAnswerCount: 0 };
  }

  const answers: ClickFreeTextAnswerOption[] = [];
  let discardedAnswerCount = 0;

  for (const answer of value) {
    if (!isRecord(answer)) {
      discardedAnswerCount += 1;
      continue;
    }

    const text = readOptionalString(answer['answerText']);
    if (!text) {
      discardedAnswerCount += 1;
      continue;
    }

    answers.push({
      text,
      configCaseSensitive: readBoolean(answer['configCaseSensitive']),
      configTrimWhitespaces: readBoolean(answer['configTrimWhitespaces']),
      configUseKeywords: readBoolean(answer['configUseKeywords']),
      configUsePunctuation: readBoolean(answer['configUsePunctuation']),
    });
  }

  return { answers, discardedAnswerCount };
}

function resolveClickBooleanSetting(
  values: Array<boolean | undefined>,
  defaultValue: boolean,
  conflictStrategy: 'preferTrue' | 'preferFalse',
): ResolvedClickBooleanSetting {
  const distinctValues = [
    ...new Set(values.filter((value): value is boolean => value !== undefined)),
  ];

  if (distinctValues.length === 0) {
    return { value: defaultValue, hadConflicts: false };
  }

  if (distinctValues.length === 1) {
    return { value: distinctValues[0], hadConflicts: false };
  }

  return {
    value: conflictStrategy === 'preferTrue',
    hadConflicts: true,
  };
}

function hasAnyFlagValue(
  answers: ClickFreeTextAnswerOption[],
  key: ClickFreeTextFlagKey,
  expectedValue: boolean,
): boolean {
  return answers.some((answer) => answer[key] === expectedValue);
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

function readRequiredNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} ist unvollständig.`);
  }
  return value;
}

function countDecimalPlaces(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const normalized = Math.abs(value).toString().toLowerCase();
  const [mantissa, exponentRaw] = normalized.split('e');
  const mantissaDecimalPlaces = mantissa?.split('.')[1]?.length ?? 0;
  if (exponentRaw === undefined) {
    return mantissaDecimalPlaces;
  }
  const exponent = Number(exponentRaw);
  return Number.isFinite(exponent) ? Math.max(0, mantissaDecimalPlaces - exponent) : 0;
}

function roundToDecimalPlaces(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round(value * factor) / factor;
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

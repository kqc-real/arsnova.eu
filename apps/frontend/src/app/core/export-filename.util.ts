const ASCII_REPLACEMENTS: Record<string, string> = {
  ß: 'ss',
  Æ: 'AE',
  æ: 'ae',
  Ø: 'O',
  ø: 'o',
  Œ: 'OE',
  œ: 'oe',
  Ł: 'L',
  ł: 'l',
  Đ: 'D',
  đ: 'd',
  Þ: 'TH',
  þ: 'th',
};

const QUIZ_TITLE_MAX_LENGTH = 80;
const SESSION_CODE_MAX_LENGTH = 32;

function replaceAsciiSpecials(value: string): string {
  return value.replace(/[ßÆæØøŒœŁłĐđÞþ]/g, (char) => ASCII_REPLACEMENTS[char] ?? '');
}

function trimDashes(value: string): string {
  return value.replace(/^-+|-+$/g, '');
}

export function sanitizeExportFilenameSegment(
  value: string,
  fallback: string,
  maxLength = QUIZ_TITLE_MAX_LENGTH,
): string {
  const normalized = replaceAsciiSpecials(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-');
  const collapsed = trimDashes(normalized).replace(/-+/g, '-');
  const truncated = trimDashes(collapsed.slice(0, maxLength));
  return truncated || fallback;
}

export function buildSessionResultsCsvFilename(quizTitle: string, sessionCode: string): string {
  const safeTitle = sanitizeExportFilenameSegment(quizTitle, 'quiz');
  const safeSessionCode = sanitizeExportFilenameSegment(
    sessionCode,
    'session',
    SESSION_CODE_MAX_LENGTH,
  );
  return `arsnova-results-${safeTitle}-${safeSessionCode}.csv`;
}

export function buildSessionResultsPdfFilename(quizTitle: string, sessionCode: string): string {
  const safeTitle = sanitizeExportFilenameSegment(quizTitle, 'quiz');
  const safeSessionCode = sanitizeExportFilenameSegment(
    sessionCode,
    'session',
    SESSION_CODE_MAX_LENGTH,
  );
  return `arsnova-results-${safeTitle}-${safeSessionCode}.pdf`;
}

export function buildQaQuestionsCsvFilename(sessionCode: string): string {
  const safeSessionCode = sanitizeExportFilenameSegment(
    sessionCode,
    'session',
    SESSION_CODE_MAX_LENGTH,
  );
  return `arsnova-qa-questions-${safeSessionCode}.csv`;
}

export function buildBonusCodesCsvFilename(quizTitle: string): string {
  const safeTitle = sanitizeExportFilenameSegment(quizTitle, 'quiz');
  return `arsnova-bonus-codes-${safeTitle}.csv`;
}

export function buildQuizExportJsonFilename(quizTitle: string): string {
  const safeTitle = sanitizeExportFilenameSegment(quizTitle, 'quiz');
  return `arsnova-quiz-${safeTitle}.json`;
}

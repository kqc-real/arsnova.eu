import { describe, expect, it } from 'vitest';
import {
  buildBonusCodesCsvFilename,
  buildQaQuestionsCsvFilename,
  buildQuizExportJsonFilename,
  buildSessionResultsCsvFilename,
  sanitizeExportFilenameSegment,
} from './export-filename.util';

describe('export filename util', () => {
  it('normalisiert Titel auf ASCII ohne Leer- oder Sonderzeichen', () => {
    expect(sanitizeExportFilenameSegment(' Überprüfung / SQL? 101 ', 'quiz')).toBe(
      'Uberprufung-SQL-101',
    );
    expect(sanitizeExportFilenameSegment('C# & C++ für Anfänger', 'quiz')).toBe('C-C-fur-Anfanger');
  });

  it('faellt bei leerem oder reinem Sonderzeichen-Titel auf einen Fallback zurueck', () => {
    expect(sanitizeExportFilenameSegment('   ', 'quiz')).toBe('quiz');
    expect(sanitizeExportFilenameSegment('***', 'session')).toBe('session');
  });

  it('baut sprachneutrale Dateinamen fuer Ergebnis- und Bonus-Exporte', () => {
    expect(buildSessionResultsCsvFilename('Überprüfung / SQL? 101', 'ABC123')).toBe(
      'arsnova-results-Uberprufung-SQL-101-ABC123.csv',
    );
    expect(buildQaQuestionsCsvFilename('ABC123')).toBe('arsnova-qa-questions-ABC123.csv');
    expect(buildBonusCodesCsvFilename('Überprüfung / SQL? 101')).toBe(
      'arsnova-bonus-codes-Uberprufung-SQL-101.csv',
    );
  });

  it('baut einen sprachneutralen Quiz-Exportnamen mit JSON-Endung', () => {
    expect(buildQuizExportJsonFilename('Überprüfung / SQL? 101')).toBe(
      'arsnova-quiz-Uberprufung-SQL-101.json',
    );
  });
});

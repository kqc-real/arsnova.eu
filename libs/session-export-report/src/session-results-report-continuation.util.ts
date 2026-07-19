import type { SessionExportDTO } from '@arsnova/shared-types';
import {
  beginMarkedContent,
  endMarkedContent,
  PDFDocument,
  rgb,
  StandardFonts,
  type PDFFont,
  type PDFPage,
  type RGB,
} from 'pdf-lib';
import type { SessionResultsReportLabels } from './labels-de';
import { stripMarkdownToPlainText } from './markdown-plain-text.util';
import { enhanceSessionResultsPdfUa } from './session-results-report-pdf-ua.util';

export interface QuestionContinuationStamp {
  /** 1-basierte Fragennummer (wie „FRAGE N VON …“). */
  questionNumber: number;
  /** Sichtbarer Fortsetzungstext, z. B. „Frage 4 – Fortsetzung: …“. */
  label: string;
  /** Kurze Variante ohne Fragetitel, wenn der volle Stempel nicht passt. */
  shortLabel: string;
}

function questionTitleForContinuation(questionTextShort: string): string {
  return (
    questionTextShort
      .split(/\r?\n/)
      .map((line) => stripMarkdownToPlainText(line).trim())
      .find(
        (line) =>
          line.length > 0 &&
          !/^(unterrichtsidee|teaching idea|idée pédagogique|piste pédagogique|idea didáctica|idea didattica)\b/i.test(
            line,
          ),
      ) ?? stripMarkdownToPlainText(questionTextShort)
  );
}

/** Baut Fortsetzungslabels aus dem Session-Export für den PDF-Stempel. */
export function buildQuestionContinuationStamps(
  data: Pick<SessionExportDTO, 'questions'>,
  labels: Pick<
    SessionResultsReportLabels,
    'questionContinuationTemplate' | 'questionContinuationShortTemplate'
  >,
): QuestionContinuationStamp[] {
  return data.questions.map((q) => ({
    questionNumber: q.questionOrder + 1,
    label: labels.questionContinuationTemplate
      .replace('{0}', String(q.questionOrder + 1))
      .replace('{1}', questionTitleForContinuation(q.questionTextShort)),
    shortLabel: labels.questionContinuationShortTemplate.replace(
      '{0}',
      String(q.questionOrder + 1),
    ),
  }));
}

/**
 * WinAnsi-sichere Zeichenkette für Helvetica/pdf-lib.
 * Gedankenstriche und typografische Apostrophe als ASCII,
 * damit `StandardFonts` nicht an C1-Controls oder U+2019 scheitern.
 * π bleibt erhalten und wird beim Zeichnen über Symbol gesetzt.
 */
export function toWinAnsiSafe(text: string): string {
  return text
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/×/g, 'x')
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[„“”«»\u201C\u201D]/g, '"')
    .replace(/…/g, '...')
    .replace(/\u202F/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/./gu, (ch) => {
      if (ch === '\u03c0') return ch; // π → Symbol-Font beim Zeichnen
      const cp = ch.codePointAt(0) ?? 0;
      if (cp <= 0x7f) return ch;
      if (cp >= 0xa0 && cp <= 0xff) return ch;
      return '?';
    });
}

/** Text ohne π, für Helvetica-Breitenmessung (π ≈ Breite von „p“ in Symbol/Helvetica). */
function toHelveticaMeasureText(text: string): string {
  return toWinAnsiSafe(text).replace(/\u03c0/g, 'p');
}

function measureLabelWidth(label: string, helvetica: PDFFont, size: number): number {
  return helvetica.widthOfTextAtSize(toHelveticaMeasureText(label), size);
}

/** Fragetitel wirkt abgeschnitten (z. B. durch questionTextShort-Slice). */
function looksLikeTruncatedContinuationLabel(label: string): boolean {
  const trimmed = label.trim();
  if (!trimmed) return false;
  // Mitten im Satz / nach Komma abgeschnitten, oder klassische Ellipse.
  if (/[,;:]\s*$/.test(trimmed) || /\.\.\.\s*$/.test(trimmed)) return true;
  // Kein Satzende und sehr lang → eher Kurzform „Question N – suite“.
  if (trimmed.length > 90 && !/[.?!)»"]\s*$/.test(trimmed)) return true;
  return false;
}

function pickStampLabel(
  item: Pick<QuestionContinuationStamp, 'label' | 'shortLabel'>,
  helvetica: PDFFont,
  size: number,
  maxWidth: number,
): string {
  if (
    measureLabelWidth(item.label, helvetica, size) <= maxWidth &&
    !looksLikeTruncatedContinuationLabel(item.label)
  ) {
    return item.label;
  }
  return item.shortLabel;
}

function drawLabel(
  page: PDFPage,
  label: string,
  x: number,
  y: number,
  size: number,
  helvetica: PDFFont,
  symbolFont: PDFFont,
  color: RGB,
): void {
  const safe = toWinAnsiSafe(label);
  let cursorX = x;
  let buffer = '';
  const flushHelvetica = () => {
    if (!buffer) return;
    page.drawText(buffer, { x: cursorX, y, size, font: helvetica, color });
    cursorX += helvetica.widthOfTextAtSize(buffer, size);
    buffer = '';
  };
  for (const ch of safe) {
    if (ch === '\u03c0') {
      flushHelvetica();
      // Symbol-Font: Unicode π (nicht ASCII „p“)
      page.drawText('\u03c0', { x: cursorX, y, size, font: symbolFont, color });
      cursorX += symbolFont.widthOfTextAtSize('\u03c0', size);
    } else {
      buffer += ch;
    }
  }
  flushHelvetica();
}

export interface ContinuationStampPlanItem {
  /** 0-basierter Seitenindex. */
  pageIndex: number;
  label: string;
  shortLabel: string;
}

const FRONT_MATTER_TOP =
  /^(?:Didaktische Quiz-Auswertung|Quiz Insights for Teaching|Analyse pédagogique du quiz|Ergebnisbericht|Lernstand und Selbsteinschätzung|Niveau de maîtrise|Fragen im Detail|Résultats question par question|Question-by-question results|Nächste Schritte|Prochaines étapes|Next steps|Team-Wertung|Teamwertung|Classement des équipes|Profil d['']apprentissage|Profilo di apprendimento|Team learning|Lernprofil|Bonus|Codes bonus|Bonus codes|Bonus-Codes|Feedback der Teilnehmenden|Teilnehmendenfeedback|Avis des participants|Participant feedback|Inhaltsnavigation|Sommaire|Contents|So liest du|Dein Nachbesprechungsplan|Votre plan de débriefing|Your debriefing plan)/i;

/** Abschnitte nach den Einzelfragen – kein Fortsetzungsstempel mehr. */
const POST_QUESTION_SECTION =
  /(?:Profil d['']apprentissage|Profilo di apprendimento|Team learning|Lernprofil|Codes bonus|Bonus-Codes|Bonus codes|Classement des équipes|Team-Wertung|Teamwertung|Avis des participants|Teilnehmendenfeedback|Participant feedback|Prochaines étapes|Nächste Schritte|Next steps)/i;

const QUESTION_BODY_TOP =
  /^(?:Selbsteinschätzung|Antwortverteilung|Auswahlfehler|Verteilung der|Nachbesprechungsimpuls|Richtig beantwortet|Vollständig richtig|Schätzstatistik|Korrektheit|Distraktor|Eingereichte|Peer Instruction|Ergebnis nach Diskussion|Für diese Frage|Akzeptierter Bereich|Histogramm|Unterrichtsidee|Confiance dans la réponse|Répartition des réponses|Analyse des options|Réponses correctes|Réponses entièrement correctes|Statistiques d’estimation|Statistiques d'estimation|Plage acceptée|Piste pédagogique|Piste de débriefing|Indicateur|Answer confidence|Option analysis|Fully correct|Answered correctly|Summary statistics|Accepted range|Teaching idea|Debrief prompt)/i;

const CONTENT_ANCHOR =
  /Frage\s+\d+|Question\s+\d+|NÄCHSTE FRAGE|Question suivante|Next question|FRAGE\s+\d+|QUESTION\s+\d+|Selbsteinschätzung|Confiance dans la réponse|Answer confidence|Antwortverteilung|Répartition des réponses|Analyse des options|Option analysis|Auswahlfehler|Verteilung der|Nachbesprechung|Richtig beantwortet|Réponses correctes|Réponses entièrement correctes|Vollständig richtig|Schätzstatistik|Statistiques d’estimation|Korrektheit|Distraktor|Eingereichte|Ergebnis nach|Für diese Frage|Akzeptierter Bereich|Plage acceptée|Unterrichtsidee|Piste pédagogique|Lernstand|Niveau de maîtrise|Fragen im Detail|Résultats question par question|Nächste Schritte|Prochaines étapes|Team-Wertung|Teamwertung|Classement|Bonus|Codes bonus|Feedback|Avis des participants|Didaktische Quiz-Auswertung|Analyse pédagogique|Ergebnisbericht|So liest|Dein Nach|Votre plan|Inhaltsnavigation|Sommaire|Ergebnis der Abstimmung|Indicateur|Profil d['']apprentissage|Profilo di apprendimento/i;

function normalizePageText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Entfernt den laufenden PDF-Seitenkopf (Quizname + Session-Code), soweit erkennbar. */
export function stripPdfRunningHeader(normalized: string): string {
  const match = normalized.match(CONTENT_ANCHOR);
  if (!match || match.index === undefined || match.index === 0) {
    return normalized;
  }
  // Nur kürzen, wenn davor typischer Header-Ballast steht (nicht mitten im Satz).
  const prefix = normalized.slice(0, match.index);
  if (prefix.length > 160) return normalized;
  // Keinen Abschnittsbeginn überspringen (z. B. Teamprofil vor „réponses correctes“ im Fließtext).
  if (POST_QUESTION_SECTION.test(prefix) || FRONT_MATTER_TOP.test(prefix.trimStart())) {
    return normalized;
  }
  return normalized.slice(match.index);
}

/**
 * Plant Fortsetzungsstempel für Seiten, die mitten in einer Frage beginnen,
 * ohne eigenen Fragenkopf oder Fortsetzungskontext.
 */
export function planQuestionContinuationStamps(
  pageTexts: string[],
  questions: QuestionContinuationStamp[],
): ContinuationStampPlanItem[] {
  const byNumber = new Map(questions.map((q) => [q.questionNumber, q]));
  const stamps: ContinuationStampPlanItem[] = [];
  let active: QuestionContinuationStamp | null = null;

  for (let pageIndex = 0; pageIndex < pageTexts.length; pageIndex++) {
    const normalized = normalizePageText(pageTexts[pageIndex] ?? '');
    if (!normalized) continue;

    const start = stripPdfRunningHeader(normalized);
    const top = start.slice(0, 160);
    const isPostQuestion =
      POST_QUESTION_SECTION.test(start.slice(0, 280)) ||
      POST_QUESTION_SECTION.test(normalized.slice(0, 280));

    if (isPostQuestion) {
      active = null;
      continue;
    }

    const hasOwnContext =
      /^Frage\s+\d+\s+[–—-]\s*Fortsetzung/i.test(top) ||
      /^Question\s+\d+\s+[–—-]\s*(?:suite|continued)/i.test(top) ||
      /^NÄCHSTE FRAGE/i.test(top) ||
      /^Question suivante/i.test(top) ||
      /^Next question/i.test(top) ||
      /^FRAGE\s+\d+\s+VON/i.test(top) ||
      /^Question\s+\d+\s+(?:sur|of|von)\b/i.test(top) ||
      /^Ergebnis der Abstimmung/i.test(top) ||
      FRONT_MATTER_TOP.test(top);

    if (active && !hasOwnContext && QUESTION_BODY_TOP.test(top)) {
      stamps.push({ pageIndex, label: active.label, shortLabel: active.shortLabel });
    }

    const starts = [
      ...normalized.matchAll(/FRAGE\s+(\d+)\s+VON/gi),
      ...normalized.matchAll(/Question\s+(\d+)\s+(?:sur|of|von)\b/gi),
      ...normalized.matchAll(/QUESTION\s+(\d+)\s+(?:SUR|OF|VON)\b/gi),
    ];
    if (starts.length > 0) {
      const lastNum = Number(starts[starts.length - 1]?.[1]);
      active = byNumber.get(lastNum) ?? active;
    }
  }

  return stamps;
}

async function extractPdfPageTexts(pdfBytes: Uint8Array): Promise<string[]> {
  // Dynamischer Import: pdfjs braucht DOM-APIs und darf Module-Load in Vitest nicht sprengen.
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await getDocument({ data: pdfBytes, useSystemFonts: true }).promise;
  const texts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    texts.push(content.items.map((item) => ('str' in item ? String(item.str) : '')).join(' '));
  }
  return texts;
}

export interface StampQuestionContinuationsOptions {
  /** PDF-Dokumenttitel (Metadaten / Screenreader / Browser-Tab). */
  documentTitle?: string;
  /** Locale für Catalog Lang / XMP (PDF/UA). */
  localeId?: string;
  /** Nur bei PDF/UA-Profil `pdfuaid:part=1` setzen. */
  claimPdfUa?: boolean;
}

/**
 * Stempelt kompakte Fortsetzungszeilen auf PDF-Seiten, die mitten in einer Frage beginnen.
 * Erhält die HTML/DOM-Lesereihenfolge (kein thead-Repeat, kein Absolute-Content-Reorder).
 * Stempel liegen in Artifact-Marked-Content; abschließend PDF/UA-Metadaten.
 */
export async function stampQuestionContinuationsOnPdf(
  pdfBytes: Uint8Array,
  questions: QuestionContinuationStamp[],
  options: StampQuestionContinuationsOptions = {},
): Promise<Uint8Array> {
  const documentTitle = options.documentTitle?.trim();
  const localeId = options.localeId;
  const claimPdfUa = options.claimPdfUa === true;

  try {
    // pdf.js kann den Input-Buffer transferieren — Kopie für nachfolgendes pdf-lib.
    const bytesForExtract = pdfBytes.slice();
    const pageTexts = questions.length > 0 ? await extractPdfPageTexts(bytesForExtract) : [];
    const plan = questions.length > 0 ? planQuestionContinuationStamps(pageTexts, questions) : [];

    const pdfDoc = await PDFDocument.load(pdfBytes.slice());
    if (documentTitle) {
      pdfDoc.setTitle(documentTitle);
    }

    if (plan.length > 0) {
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const symbolFont = await pdfDoc.embedFont(StandardFonts.Symbol);
      const pages = pdfDoc.getPages();
      const fontSize = 9;
      const color = rgb(0.216, 0.255, 0.318); // #374151
      const lineColor = rgb(0.82, 0.835, 0.859); // #d1d5db

      for (const item of plan) {
        const page = pages[item.pageIndex];
        if (!page) continue;
        const { width, height } = page.getSize();
        /** Kompakte Fortsetzungszeile im oberen Randbereich (ohne Playwright-Header). */
        const textY = height - 40;
        const textX = 40;
        const maxWidth = width - 80;
        const label = pickStampLabel(item, font, fontSize, maxWidth);
        const textWidth = measureLabelWidth(label, font, fontSize);
        page.pushOperators(beginMarkedContent('Artifact'));
        page.drawRectangle({
          x: textX - 2,
          y: textY - 1,
          width: Math.min(textWidth + 4, maxWidth + 4),
          height: fontSize + 2,
          color: rgb(1, 1, 1),
        });
        drawLabel(page, label, textX, textY, fontSize, font, symbolFont, color);
        page.drawLine({
          start: { x: textX, y: textY - 4 },
          end: { x: width - 40, y: textY - 4 },
          thickness: 0.6,
          color: lineColor,
        });
        page.pushOperators(endMarkedContent());
      }
    }

    const stamped = await pdfDoc.save({ useObjectStreams: false });
    return enhanceSessionResultsPdfUa(stamped, { documentTitle, localeId, claimPdfUa });
  } catch (error) {
    // Ungültige/minimale PDFs: zumindest Basis-Metadaten versuchen.
    console.warn(
      '[session-results-report] Fortsetzungsstempel übersprungen:',
      error instanceof Error ? error.message : error,
    );
    return enhanceSessionResultsPdfUa(pdfBytes, { documentTitle, localeId, claimPdfUa });
  }
}

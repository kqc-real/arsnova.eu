import type { SessionExportDTO } from '@arsnova/shared-types';
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import type { SessionResultsReportLabels } from './labels-de';
import { stripMarkdownToPlainText } from './markdown-plain-text.util';

export interface QuestionContinuationStamp {
  /** 1-basierte Fragennummer (wie „FRAGE N VON …“). */
  questionNumber: number;
  /** Sichtbarer Fortsetzungstext, z. B. „Frage 4 – Fortsetzung: …“. */
  label: string;
}

function questionTitleForContinuation(questionTextShort: string): string {
  return (
    questionTextShort
      .split(/\r?\n/)
      .map((line) => stripMarkdownToPlainText(line).trim())
      .find(
        (line) =>
          line.length > 0 &&
          !/^(unterrichtsidee|teaching idea|idée pédagogique|idea didáctica|idea didattica)\b/i.test(
            line,
          ),
      ) ?? stripMarkdownToPlainText(questionTextShort)
  );
}

/** Baut Fortsetzungslabels aus dem Session-Export für den PDF-Stempel. */
export function buildQuestionContinuationStamps(
  data: Pick<SessionExportDTO, 'questions'>,
  labels: Pick<SessionResultsReportLabels, 'questionContinuationTemplate'>,
): QuestionContinuationStamp[] {
  return data.questions.map((q) => ({
    questionNumber: q.questionOrder + 1,
    label: labels.questionContinuationTemplate
      .replace('{0}', String(q.questionOrder + 1))
      .replace('{1}', questionTitleForContinuation(q.questionTextShort)),
  }));
}

/** Adobe Symbol Encoding: π bei Oktal 160 = 0x70. */
const SYMBOL_PI = String.fromCharCode(0x70);

/**
 * WinAnsi-sichere Zeichenkette für Helvetica.
 * Bewahrt Gedankenstriche (–/— → WinAnsi 0x96/0x97); π als Platzhalter `\u0001` für Symbol-Font.
 */
export function toWinAnsiSafe(text: string): string {
  return text
    .replace(/\u03c0/g, '\u0001')
    .replace(/\u2013/g, '\x96')
    .replace(/\u2014/g, '\x97')
    .replace(/×/g, 'x')
    .replace(/[„“”«»]/g, '"')
    .replace(/…/g, '...')
    .replace(/./gu, (ch) => {
      if (ch === '\u0001') return ch;
      const cp = ch.codePointAt(0) ?? 0;
      return cp <= 0xff ? ch : '?';
    });
}

function measureLabelWidth(
  label: string,
  helvetica: PDFFont,
  symbol: PDFFont,
  size: number,
): number {
  const safe = toWinAnsiSafe(label);
  const parts = safe.split('\u0001');
  let width = 0;
  for (let i = 0; i < parts.length; i++) {
    width += helvetica.widthOfTextAtSize(parts[i] ?? '', size);
    if (i < parts.length - 1) {
      width += symbol.widthOfTextAtSize(SYMBOL_PI, size);
    }
  }
  return width;
}

function truncateLabelToWidth(
  label: string,
  helvetica: PDFFont,
  symbol: PDFFont,
  size: number,
  maxWidth: number,
): string {
  let current = label;
  while (measureLabelWidth(current, helvetica, symbol, size) > maxWidth && current.length > 12) {
    current = `${current.slice(0, Math.max(0, current.length - 2))}...`;
  }
  return current;
}

function drawMixedLabel(
  page: PDFPage,
  label: string,
  x: number,
  y: number,
  size: number,
  helvetica: PDFFont,
  symbol: PDFFont,
  color: RGB,
): void {
  const safe = toWinAnsiSafe(label);
  const parts = safe.split('\u0001');
  let cursorX = x;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i] ?? '';
    if (part) {
      page.drawText(part, { x: cursorX, y, size, font: helvetica, color });
      cursorX += helvetica.widthOfTextAtSize(part, size);
    }
    if (i < parts.length - 1) {
      page.drawText(SYMBOL_PI, { x: cursorX, y, size, font: symbol, color });
      cursorX += symbol.widthOfTextAtSize(SYMBOL_PI, size);
    }
  }
}

export interface ContinuationStampPlanItem {
  /** 0-basierter Seitenindex. */
  pageIndex: number;
  label: string;
}

const FRONT_MATTER_TOP =
  /^(?:Didaktische Quiz-Auswertung|Ergebnisbericht|Lernstand und Selbsteinschätzung|Fragen im Detail|Nächste Schritte|Team-Wertung|Teamwertung|Bonus|Feedback der Teilnehmenden|Teilnehmendenfeedback|Inhaltsnavigation|So liest du|Dein Nachbesprechungsplan)/i;

const QUESTION_BODY_TOP =
  /^(?:Selbsteinschätzung|Antwortverteilung|Auswahlfehler|Verteilung der|Nachbesprechungsimpuls|Richtig beantwortet|Vollständig richtig|Schätzstatistik|Korrektheit|Distraktor|Eingereichte|Peer Instruction|Ergebnis nach Diskussion|Für diese Frage|Akzeptierter Bereich|Histogramm|Unterrichtsidee)/i;

const CONTENT_ANCHOR =
  /Frage\s+\d+|NÄCHSTE FRAGE|FRAGE\s+\d+|Selbsteinschätzung|Antwortverteilung|Auswahlfehler|Verteilung der|Nachbesprechung|Richtig beantwortet|Vollständig richtig|Schätzstatistik|Korrektheit|Distraktor|Eingereichte|Ergebnis nach|Für diese Frage|Akzeptierter Bereich|Unterrichtsidee|Lernstand|Fragen im Detail|Nächste Schritte|Team-Wertung|Teamwertung|Bonus|Feedback|Didaktische Quiz-Auswertung|Ergebnisbericht|So liest|Dein Nach|Inhaltsnavigation|Ergebnis der Abstimmung/i;

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
    const hasOwnContext =
      /^Frage\s+\d+\s+[–—-]\s*Fortsetzung/i.test(top) ||
      /^NÄCHSTE FRAGE/i.test(top) ||
      /^FRAGE\s+\d+\s+VON/i.test(top) ||
      /^Ergebnis der Abstimmung/i.test(top) ||
      FRONT_MATTER_TOP.test(top);

    if (active && !hasOwnContext && QUESTION_BODY_TOP.test(top)) {
      stamps.push({ pageIndex, label: active.label });
    }

    const starts = [...normalized.matchAll(/FRAGE\s+(\d+)\s+VON/gi)];
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
}

/**
 * Stempelt kompakte Fortsetzungszeilen auf PDF-Seiten, die mitten in einer Frage beginnen.
 * Erhält die HTML/DOM-Lesereihenfolge (kein thead-Repeat, kein Absolute-Content-Reorder).
 */
export async function stampQuestionContinuationsOnPdf(
  pdfBytes: Uint8Array,
  questions: QuestionContinuationStamp[],
  options: StampQuestionContinuationsOptions = {},
): Promise<Uint8Array> {
  const documentTitle = options.documentTitle?.trim();
  if (questions.length === 0 && !documentTitle) return pdfBytes;

  try {
    // pdf.js kann den Input-Buffer transferieren — Kopie für nachfolgendes pdf-lib.
    const bytesForExtract = pdfBytes.slice();
    const pageTexts = questions.length > 0 ? await extractPdfPageTexts(bytesForExtract) : [];
    const plan = questions.length > 0 ? planQuestionContinuationStamps(pageTexts, questions) : [];

    if (plan.length === 0 && !documentTitle) return pdfBytes;

    const pdfDoc = await PDFDocument.load(pdfBytes.slice());
    if (documentTitle) {
      pdfDoc.setTitle(documentTitle);
    }
    if (plan.length === 0) {
      return pdfDoc.save();
    }

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
      /**
       * Band zwischen laufendem Header (~y 822) und Content (@page margin-top 24mm ≈ y 758).
       * Etwas unter der Header-Linie, mit klarer Luft nach oben und unten.
       */
      const textY = height - 56; // ≈ 20mm vom oberen Rand
      const textX = 40;
      const maxWidth = width - 80;
      const label = truncateLabelToWidth(item.label, font, symbolFont, fontSize, maxWidth);
      const textWidth = measureLabelWidth(label, font, symbolFont, fontSize);
      page.drawRectangle({
        x: textX - 2,
        y: textY - 1,
        width: Math.min(textWidth + 4, maxWidth + 4),
        height: fontSize + 2,
        color: rgb(1, 1, 1),
      });
      drawMixedLabel(page, label, textX, textY, fontSize, font, symbolFont, color);
      page.drawLine({
        start: { x: textX, y: textY - 4 },
        end: { x: width - 40, y: textY - 4 },
        thickness: 0.6,
        color: lineColor,
      });
    }

    return pdfDoc.save();
  } catch {
    // Ungültige/minimale PDFs (z. B. Unit-Test-Mocks) unverändert zurückgeben.
    return pdfBytes;
  }
}

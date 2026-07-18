import type { SessionExportDTO } from '@arsnova/shared-types';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
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

function toWinAnsiSafe(text: string): string {
  return text
    .replace(/π/g, 'pi')
    .replace(/×/g, 'x')
    .replace(/[–—]/g, '-')
    .replace(/[„“”«»]/g, '"')
    .replace(/…/g, '...')
    .replace(/./gu, (ch) => ((ch.codePointAt(0) ?? 0) <= 0xff ? ch : '?'));
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

/**
 * Stempelt kompakte Fortsetzungszeilen auf PDF-Seiten, die mitten in einer Frage beginnen.
 * Erhält die HTML/DOM-Lesereihenfolge (kein thead-Repeat, kein Absolute-Content-Reorder).
 */
export async function stampQuestionContinuationsOnPdf(
  pdfBytes: Uint8Array,
  questions: QuestionContinuationStamp[],
): Promise<Uint8Array> {
  if (questions.length === 0) return pdfBytes;

  try {
    // pdf.js kann den Input-Buffer transferieren — Kopie für nachfolgendes pdf-lib.
    const bytesForExtract = pdfBytes.slice();
    const pageTexts = await extractPdfPageTexts(bytesForExtract);
    const plan = planQuestionContinuationStamps(pageTexts, questions);
    if (plan.length === 0) return pdfBytes;

    const pdfDoc = await PDFDocument.load(pdfBytes.slice());
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
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
      let label = toWinAnsiSafe(item.label);
      while (font.widthOfTextAtSize(label, fontSize) > maxWidth && label.length > 12) {
        label = `${label.slice(0, Math.max(0, label.length - 2))}...`;
      }
      const textWidth = font.widthOfTextAtSize(label, fontSize);
      page.drawRectangle({
        x: textX - 2,
        y: textY - 1,
        width: Math.min(textWidth + 4, maxWidth + 4),
        height: fontSize + 2,
        color: rgb(1, 1, 1),
      });
      page.drawText(label, {
        x: textX,
        y: textY,
        size: fontSize,
        font,
        color,
      });
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

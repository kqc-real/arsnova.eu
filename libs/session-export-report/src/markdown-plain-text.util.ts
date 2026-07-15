import { replaceEmojiShortcodes } from './emoji-shortcode.util';

const HOST_NOTE_LINE = /^>\s*\*\*(Unterrichtsidee|Hinweis):\*\*/i;
const ITALIC_FOOTNOTE = /^\*[^*].*\*$/;
const OPTIONAL_IMPULSE = /^Optional(er Impuls)?:/i;
const CODE_HEAVY_LINE = /[{}();=<>]{3,}/;

/** Lehrer-Hinweise (Blockquotes) aus Fragentext für Exporte entfernen. */
export function stripHostOnlyQuestionNotes(value: string): string {
  return value
    .split('\n')
    .filter((line) => !HOST_NOTE_LINE.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Markdown/KaTeX in lesbaren Fließtext umwandeln. */
export function stripMarkdownToPlainText(value: string): string {
  return replaceEmojiShortcodes(
    value
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/\$\$[\s\S]*?\$\$/g, ' ')
      .replace(/\$([^$]+)\$/g, (_, inner: string) =>
        inner.trim().replace(/\\pi/g, 'π').replace(/^pi$/i, 'π').replace(/\\/g, ''),
      )
      .replace(/\\\[[\s\S]*?\\\]/g, ' ')
      .replace(/\\\([\s\S]*?\\\)/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^#+\s*/gm, '')
      .replace(/^>\s?/gm, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function isLearnerFacingLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (HOST_NOTE_LINE.test(trimmed)) return false;
  if (trimmed.startsWith('>')) return false;
  if (ITALIC_FOOTNOTE.test(trimmed)) return false;
  if (OPTIONAL_IMPULSE.test(trimmed)) return false;
  if (/^https?:\/\//i.test(trimmed)) return false;
  if (/^[A-Za-zÄÖÜäöüß .'()-]{2,48}:$/.test(trimmed)) return false;
  if (CODE_HEAVY_LINE.test(trimmed) && trimmed.length > 32) return false;
  return true;
}

function isLearnerContextLine(line: string): boolean {
  const trimmed = line.trim();
  return /^(Gesucht ist|Gemeint ist|_?Mehrere Antworten)/i.test(trimmed);
}

/**
 * Fragentext für Lehrenden-Exporte: nur Lernenden-relevante Passagen,
 * ohne Unterrichtsideen, Medien, Code und Formeln.
 */
export function extractExportQuestionText(value: string, maxLength = 320): string {
  const withoutHostNotes = stripHostOnlyQuestionNotes(value)
    .replace(/```[\s\S]*?```/g, '\n')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '\n')
    .replace(/\$\$[\s\S]*?\$\$/g, '\n');

  const lines = withoutHostNotes.split('\n').map((line) => line.trim());
  let heading = '';
  const body: string[] = [];

  for (const line of lines) {
    if (!isLearnerFacingLine(line)) continue;
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch && !heading) {
      heading = stripMarkdownToPlainText(headingMatch[1] ?? '');
      continue;
    }
    body.push(stripMarkdownToPlainText(line.replace(/^#{1,6}\s+/, '')));
  }

  const parts = [heading, ...body.filter(Boolean)].filter(Boolean);
  const uniqueParts: string[] = [];
  for (const part of parts) {
    if (!uniqueParts.includes(part)) uniqueParts.push(part);
  }

  const [title, ...rest] = uniqueParts;
  const supplements = rest.filter((part) => isLearnerContextLine(part));
  let result = title ?? '';
  if (supplements.length > 0) {
    const suffix = supplements.join('. ');
    result = /[.?!]$/.test(result) ? `${result} ${suffix}` : `${result}. ${suffix}`;
  }
  if (result.length > maxLength) {
    result = `${result.slice(0, maxLength - 1).trimEnd()}…`;
  }
  return result;
}

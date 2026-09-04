import type { HostCurrentQuestionDTO } from '@arsnova/shared-types';
import type {
  DistributionMatrixAxisEntry,
  DistributionMatrixCell,
} from '../../../shared/presenter-distribution-matrix/presenter-distribution-matrix.component';

export function matchingMatrixRows(
  question: HostCurrentQuestionDTO,
): DistributionMatrixAxisEntry[] {
  return (question.matchingPairs ?? []).map((pair) => ({ id: pair.leftId, label: pair.left }));
}

export function matchingMatrixColumns(
  question: HostCurrentQuestionDTO,
): DistributionMatrixAxisEntry[] {
  return (question.matchingPairs ?? []).map((pair) => ({ id: pair.rightId, label: pair.right }));
}

export function matchingMatrixCells(question: HostCurrentQuestionDTO): DistributionMatrixCell[] {
  return (question.matchingStats?.selectionCounts ?? []).map((entry) => ({
    rowId: entry.leftId,
    columnId: entry.rightId,
    count: entry.count,
  }));
}

export function matchingCorrectColumns(question: HostCurrentQuestionDTO): Record<string, string> {
  return Object.fromEntries(
    (question.matchingPairs ?? []).map((pair) => [pair.leftId, pair.rightId]),
  );
}

export function orderingMatrixRows(
  question: HostCurrentQuestionDTO,
): DistributionMatrixAxisEntry[] {
  return (question.orderingItems ?? []).map((item) => ({ id: item.id, label: item.text }));
}

export function orderingMatrixColumns(
  question: HostCurrentQuestionDTO,
): DistributionMatrixAxisEntry[] {
  return (question.orderingItems ?? []).map((_, index) => ({
    id: String(index),
    label: String(index + 1),
  }));
}

export function orderingMatrixCells(question: HostCurrentQuestionDTO): DistributionMatrixCell[] {
  return (question.orderingStats?.positionCounts ?? []).map((entry) => ({
    rowId: entry.itemId,
    columnId: String(entry.position),
    count: entry.count,
  }));
}

export function orderingCorrectColumns(question: HostCurrentQuestionDTO): Record<string, string> {
  return Object.fromEntries(
    (question.orderingItems ?? []).map((item, index) => [item.id, String(index)]),
  );
}

export function categorizationMatrixRows(
  question: HostCurrentQuestionDTO,
): DistributionMatrixAxisEntry[] {
  return (question.categorizationItems ?? []).map((item) => ({
    id: item.id,
    label: item.text,
  }));
}

export function categorizationMatrixColumns(
  question: HostCurrentQuestionDTO,
): DistributionMatrixAxisEntry[] {
  return (question.categories ?? []).map((category) => ({
    id: category.id,
    label: category.name,
  }));
}

export function categorizationMatrixCells(
  question: HostCurrentQuestionDTO,
): DistributionMatrixCell[] {
  return (question.categorizationStats?.itemCategoryCounts ?? []).map((entry) => ({
    rowId: entry.itemId,
    columnId: entry.categoryId,
    count: entry.count,
  }));
}

export function categorizationCorrectColumns(
  question: HostCurrentQuestionDTO,
): Record<string, string> {
  return Object.fromEntries(
    (question.categorizationItems ?? []).map((item) => [item.id, item.correctCategoryId]),
  );
}

export function ratingScaleValues(question: HostCurrentQuestionDTO): number[] {
  const min = question.ratingMin ?? 1;
  const max = question.ratingMax ?? 5;
  const values: number[] = [];
  for (let value = min; value <= max; value++) {
    values.push(value);
  }
  return values;
}

export function numericHistogramBarPercent(
  count: number,
  histogram: Array<{ count: number }>,
): number {
  const maxCount = Math.max(1, ...histogram.map((bin) => bin.count));
  return Math.round((count / maxCount) * 100);
}

/** Stabile, nicht kanonische Reihenfolge – ohne die Lösung zu verraten. */
export function stableSeededShuffle<T>(
  items: readonly T[],
  seed: string,
  key: (item: T) => string,
): T[] {
  return [...items]
    .map((item) => ({
      item,
      rank: fnv1a32(`${seed}\0${key(item)}`),
      key: key(item),
    }))
    .sort((left, right) => left.rank - right.rank || left.key.localeCompare(right.key))
    .map((entry) => entry.item);
}

function fnv1a32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const FENCED_CODE_BLOCK_PATTERN =
  /^ {0,3}(`{3,}|~{3,})([^\n]*)\r?\n([\s\S]*?)^ {0,3}\1[ \t]*\r?$/gm;

function fencedCodeBlockRe(): RegExp {
  return new RegExp(FENCED_CODE_BLOCK_PATTERN.source, FENCED_CODE_BLOCK_PATTERN.flags);
}

export interface PresenterQuestionCodeBlock {
  language: string;
  source: string;
}

export function presenterQuestionCodeBlocks(markdown: string): PresenterQuestionCodeBlock[] {
  const blocks: PresenterQuestionCodeBlock[] = [];
  const text = String(markdown ?? '');
  for (const match of text.matchAll(fencedCodeBlockRe())) {
    const info = (match[2] ?? '').trim();
    const language = info.split(/\s+/)[0] ?? '';
    blocks.push({ language, source: match[3] ?? '' });
  }
  return blocks;
}

export function presenterMarkdownWithoutCode(markdown: string): string {
  return String(markdown ?? '')
    .replace(fencedCodeBlockRe(), '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function presenterQuestionCodeMarkdown(markdown: string): string {
  return presenterQuestionCodeBlocks(markdown)
    .map((block) => {
      const body = block.source.replace(/\n$/, '');
      return `\`\`\`${block.language}\n${body}\n\`\`\``;
    })
    .join('\n\n');
}

export function presenterCodeColumnCount(markdown: string): 1 | 2 | 3 {
  const lines = presenterQuestionCodeBlocks(markdown).reduce((sum, block) => {
    const body = block.source.replace(/\n+$/g, '');
    if (!body) {
      return sum;
    }
    return sum + body.split('\n').length;
  }, 0);
  if (lines <= 16) {
    return 1;
  }
  if (lines <= 40) {
    return 2;
  }
  return 3;
}

/** Splits fenced code into whole-line columns so presenter code never wraps. */
export function presenterQuestionCodeColumnMarkdown(markdown: string): string[] {
  const blocks = presenterQuestionCodeBlocks(markdown);
  if (blocks.length === 0) {
    return [];
  }
  const language = blocks[0]?.language ?? '';
  const lines = blocks
    .map((block) => block.source.replace(/\n+$/g, ''))
    .join('\n\n')
    .split('\n');
  const columnCount = Math.min(presenterCodeColumnCount(markdown), Math.max(1, lines.length));
  const linesPerColumn = Math.ceil(lines.length / columnCount);
  const columns: string[] = [];
  for (let index = 0; index < columnCount; index += 1) {
    const slice = lines.slice(index * linesPerColumn, (index + 1) * linesPerColumn);
    if (slice.length === 0) {
      continue;
    }
    columns.push(`\`\`\`${language}\n${slice.join('\n')}\n\`\`\``);
  }
  return columns;
}

export function presenterQuestionHeading(markdown: string): string {
  const stripped = String(markdown ?? '').replace(/!\[[^\]]*]\([^)]*\)/g, '');
  const headingMatch = stripped.match(/^#{1,6}\s+(.+)$/m);
  if (headingMatch) {
    return headingMatch[1].trim();
  }
  const first =
    stripped
      .split(/\n+/)
      .map((line) => line.trim())
      .find(Boolean) ?? '';
  return first.replace(/^[_*]+|[_*]+$/g, '').trim();
}

/** Expliziter Bildnachweis-Marker in kursivem Markdown: `*[credit] Quelle*` */
export const PRESENTER_IMAGE_CREDIT_MARKER = '[credit]';

export type PresenterQuestionVisual = {
  url: string;
  alt: string;
  /** Bereinigter Nachweis ohne `[credit]`-Präfix; null wenn keiner gesetzt. */
  credit: string | null;
};

const IMAGE_MARKDOWN_RE = /!\[([^\]]*)]\(\s*<?([^)\s>]+)[^)]*\)/;
const IMAGE_CREDIT_AFTER_IMAGE_RE = new RegExp(
  String.raw`^\s*[*_]\s*` +
    PRESENTER_IMAGE_CREDIT_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
    String.raw`\s*([^*_\n][^*_]*)[*_]`,
  'i',
);

export function presenterQuestionImageCredit(markdown: string): string | null {
  const text = String(markdown ?? '');
  const imageMatch = text.match(IMAGE_MARKDOWN_RE);
  if (!imageMatch || imageMatch.index === undefined) {
    return null;
  }
  const afterImage = text.slice(imageMatch.index + imageMatch[0].length);
  const creditMatch = afterImage.match(IMAGE_CREDIT_AFTER_IMAGE_RE);
  const credit = creditMatch?.[1]?.trim();
  return credit || null;
}

export function presenterQuestionImage(markdown: string): PresenterQuestionVisual | null {
  const text = String(markdown ?? '');
  const match = text.match(IMAGE_MARKDOWN_RE);
  const url = match?.[2]?.trim();
  if (!url) {
    return null;
  }
  return {
    alt: (match?.[1] ?? '').trim(),
    url,
    credit: presenterQuestionImageCredit(text),
  };
}

export function presenterCompactMarkdown(markdown: string): string {
  const heading = presenterQuestionHeading(markdown);
  return heading ? `### ${heading}` : '';
}

export function presenterCorrectPairResults(
  rows: Array<{ id: string; label: string }>,
  columns: Array<{ id: string; label: string }>,
  cells: Array<{ rowId: string; columnId: string; count: number }>,
  correctColumnByRow: Record<string, string>,
): Array<{ id: string; from: string; to: string; count: number; percent: number }> {
  const columnLabel = new Map(columns.map((column) => [column.id, column.label]));
  return rows.map((row) => {
    const correctId = correctColumnByRow[row.id];
    const count =
      cells.find((cell) => cell.rowId === row.id && cell.columnId === correctId)?.count ?? 0;
    const rowTotal = cells
      .filter((cell) => cell.rowId === row.id)
      .reduce((sum, cell) => sum + cell.count, 0);
    return {
      id: row.id,
      from: row.label,
      to: (correctId && columnLabel.get(correctId)) || '',
      count,
      percent: rowTotal > 0 ? Math.round((count / rowTotal) * 100) : 0,
    };
  });
}

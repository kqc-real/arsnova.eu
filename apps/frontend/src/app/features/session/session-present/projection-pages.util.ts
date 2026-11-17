/** DOM boundaries preserve rendered Markdown, code and complete formula subtrees. */
export interface ProjectionBoundary {
  node: Node;
  offset: number;
  semantic: boolean;
}
const ATOMIC =
  '.session-projection-quiz__answer, [data-projection-unit], .katex, img, svg, canvas, mat-icon, app-answer-option-badge';
const BLOCK = 'p, li, pre, tr, h1, h2, h3, h4, article, mat-card, [data-projection-unit]';
const ANSWER_LIST = '[data-projection-answer-list]';

export function projectionBoundaries(root: HTMLElement): ProjectionBoundary[] {
  const points: ProjectionBoundary[] = [];
  const after = (node: Node, semantic: boolean): void => {
    const parent = node.parentNode;
    if (parent)
      points.push({
        node: parent,
        offset: Array.from(parent.childNodes).indexOf(node as ChildNode) + 1,
        semantic,
      });
  };
  const visit = (node: Node): void => {
    if (node instanceof HTMLElement || node instanceof SVGElement) {
      if (node.matches('[data-projection-status], [data-markdown-code-copy]')) return;
      if (node.matches(ATOMIC)) {
        after(
          node,
          node.matches(
            '.session-projection-quiz__answer, [data-projection-unit], .katex, img, svg, canvas',
          ),
        );
        return;
      }
    }
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      const code = node.parentElement?.closest('pre');
      const pattern = code ? /[^\n]*\n|[^\n]+$/g : /\S+\s*|\s+/g;
      for (const match of text.matchAll(pattern)) {
        points.push({
          node,
          offset: match.index! + match[0].length,
          semantic: !!code && match[0].endsWith('\n'),
        });
      }
    } else {
      for (const child of Array.from(node.childNodes)) visit(child);
      if (node instanceof HTMLElement && node.matches(BLOCK)) after(node, true);
    }
  };
  for (const child of Array.from(root.childNodes)) visit(child);
  points.push({ node: root, offset: root.childNodes.length, semantic: true });
  return points;
}

/** Retain the common ancestor and its styles when a paragraph spans several pages. */
export function cloneProjectionRange(
  root: HTMLElement,
  start: ProjectionBoundary,
  end: ProjectionBoundary,
): HTMLElement {
  const range = root.ownerDocument.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  let content: Node = range.cloneContents();
  let ancestor: Node | null = range.commonAncestorContainer;
  if (ancestor.nodeType === Node.TEXT_NODE) ancestor = ancestor.parentNode;
  while (ancestor && ancestor !== root) {
    const wrapper = ancestor.cloneNode(false);
    wrapper.appendChild(content);
    content = wrapper;
    ancestor = ancestor.parentNode;
  }
  const copy = root.cloneNode(false) as HTMLElement;
  copy.appendChild(content);
  // Ordered lists and answer badges retain their meaning on continuation pages.
  const originalItems = Array.from(root.querySelectorAll('li')).filter((item) =>
    range.intersectsNode(item),
  );
  copy.querySelectorAll('li').forEach((item, index) => {
    const original = originalItems[index];
    if (original?.parentElement?.tagName !== 'OL') return;
    const siblings = Array.from(original.parentElement.children);
    const start = Number(original.parentElement.getAttribute('start') ?? 1);
    item.value = original.hasAttribute('value')
      ? original.value
      : start + siblings.indexOf(original);
  });
  const originalAnswers = Array.from(
    root.querySelectorAll('.session-projection-quiz__answer'),
  ).filter((item) => range.intersectsNode(item));
  copy.querySelectorAll('.session-projection-quiz__answer').forEach((answer, index) => {
    const badge = originalAnswers[index]?.querySelector('app-answer-option-badge');
    const head = answer.querySelector('.session-projection-quiz__answer-head');
    if (badge && head && !head.querySelector('app-answer-option-badge'))
      head.prepend(badge.cloneNode(true));
  });
  copy
    .querySelectorAll('[data-projection-status], [data-markdown-code-copy]')
    .forEach((element) => element.remove());
  return copy;
}

function hasProjectionContent(page: HTMLElement): boolean {
  return !!(page.textContent?.trim() || page.querySelector('img,svg,canvas'));
}

export function paginateProjection(
  root: HTMLElement,
  fits: (page: HTMLElement) => boolean,
): HTMLElement[] {
  const boundaries = projectionBoundaries(root);
  const pages: HTMLElement[] = [];
  let start: ProjectionBoundary = { node: root, offset: 0, semantic: true };
  let first = 0;
  while (first < boundaries.length) {
    let low = first,
      high = boundaries.length - 1,
      lastFit = first - 1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (fits(cloneProjectionRange(root, start, boundaries[middle]!))) {
        lastFit = middle;
        low = middle + 1;
      } else high = middle - 1;
    }
    // Prefer complete paragraphs/options/code lines. Only split prose when needed.
    let end = lastFit;
    while (end >= first && !boundaries[end]!.semantic) end--;
    if (end < first) end = Math.max(first, lastFit);
    const page = cloneProjectionRange(root, start, boundaries[end]!);
    if (hasProjectionContent(page)) pages.push(page);
    start = boundaries[end]!;
    first = end + 1;
  }
  return pages.length ? pages : [root.cloneNode(true) as HTMLElement];
}

export function layoutProjection(
  root: HTMLElement,
  fits: (page: HTMLElement) => boolean,
): HTMLElement[] {
  const list = root.querySelector<HTMLElement>(ANSWER_LIST);
  if (!list || list.childElementCount < 2) return paginateProjection(root, fits);

  const full = cloneProjectionRange(
    root,
    { node: root, offset: 0, semantic: true },
    { node: root, offset: root.childNodes.length, semantic: true },
  );
  if (fits(full)) return [full];

  const compactList = full.querySelector<HTMLElement>(ANSWER_LIST)!;
  const groupBoundary = (element: HTMLElement, after: boolean): ProjectionBoundary => {
    let node = element;
    // Include enclosing cards at the beginning or end of the group.
    // That keeps empty card fragments off neighboring pages.
    while (
      node.parentElement !== full &&
      !(after ? node.nextElementSibling : node.previousElementSibling)
    ) {
      node = node.parentElement!;
    }
    const parent = node.parentNode!;
    return {
      node: parent,
      offset: Array.from(parent.childNodes).indexOf(node) + Number(after),
      semantic: true,
    };
  };
  full.classList.add('projection-source--compact-answers');
  const columnLayouts = [false, true];
  for (const twoColumns of columnLayouts) {
    full.classList.toggle('projection-source--two-column-answers', twoColumns);
    if (fits(full)) return [full];
  }
  const legend = compactList.parentElement?.querySelector<HTMLElement>(
    ':scope > [data-projection-answer-legend]',
  );
  const end = groupBoundary(compactList, true);
  for (const first of legend ? [legend, compactList] : [compactList]) {
    const start = groupBoundary(first, false);
    for (const twoColumns of columnLayouts) {
      full.classList.toggle('projection-source--two-column-answers', twoColumns);
      const answers = cloneProjectionRange(full, start, end);
      if (!fits(answers)) continue;

      const before = cloneProjectionRange(full, { node: full, offset: 0, semantic: true }, start);
      const after = cloneProjectionRange(full, end, {
        node: full,
        offset: full.childNodes.length,
        semantic: true,
      });
      return [
        ...(hasProjectionContent(before) ? paginateProjection(before, fits) : []),
        answers,
        ...(hasProjectionContent(after) ? paginateProjection(after, fits) : []),
      ];
    }
  }

  return paginateProjection(root, fits);
}

/** Expand distribution matrices into labelled rows; all cells remain readable on narrow projectors. */
export function prepareProjectionSource(root: HTMLElement): HTMLElement {
  const copy = root.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('.distribution-matrix table').forEach((table) => {
    const section = document.createElement('section');
    section.className = 'projection-matrix';
    const caption = table.querySelector('caption');
    if (caption) {
      const title = document.createElement('div');
      title.append(...Array.from(caption.childNodes, (node) => node.cloneNode(true)));
      section.append(title);
    }
    const columns = Array.from(table.querySelectorAll('thead th')).slice(1);
    table.querySelectorAll('tbody tr').forEach((row) => {
      const heading = row.querySelector('th');
      row.querySelectorAll('td').forEach((cell, index) => {
        const entry = document.createElement('div');
        entry.className = 'projection-matrix__entry';
        entry.setAttribute('data-projection-unit', '');
        const label = document.createElement('div');
        label.className = 'projection-matrix__label';
        if (heading)
          label.append(...Array.from(heading.childNodes, (node) => node.cloneNode(true)));
        label.append(document.createTextNode(' → '));
        if (columns[index])
          label.append(...Array.from(columns[index]!.childNodes, (node) => node.cloneNode(true)));
        const value = document.createElement('div');
        value.className = cell.className;
        value.append(...Array.from(cell.childNodes, (node) => node.cloneNode(true)));
        entry.append(label, value);
        section.append(entry);
      });
    });
    table.replaceWith(section);
  });
  const projectionUnitCount = copy.querySelectorAll(
    '.session-projection-quiz__answer, [data-projection-unit]',
  ).length;
  if (projectionUnitCount >= 4 && projectionUnitCount <= 8) {
    copy.classList.add('projection-source--many-units');
  }
  return copy;
}

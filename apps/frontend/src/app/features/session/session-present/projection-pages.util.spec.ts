import { describe, expect, it } from 'vitest';
import {
  layoutProjection,
  paginateProjection,
  prepareProjectionSource,
} from './projection-pages.util';

function root(html: string): HTMLElement {
  const element = document.createElement('article');
  element.innerHTML = html;
  return element;
}
const copy = (pages: HTMLElement[]): string => pages.map((page) => page.textContent).join('');

describe('choice answer layout', () => {
  const compact = 'projection-source--compact-answers';
  const twoColumns = 'projection-source--two-column-answers';
  const answerSelector = '[data-projection-answer-list] > li';
  const choice = (before = 'Question', after = '') =>
    root(
      `<mat-card><p>${before}</p></mat-card><mat-card><div>
        <ul data-projection-answer-list>${['Alpha', 'Beta', 'Gamma', 'Delta']
          .map(
            (label) => `<li class="session-projection-quiz__answer">${label}<span>25 %</span></li>`,
          )
          .join('')}</ul>
        ${after ? `<p>${after}</p>` : ''}
      </div></mat-card>`,
    );

  it('keeps the regular layout when the question and all cards fit', () => {
    const source = choice();
    const pages = layoutProjection(source, () => true);

    expect(pages).toHaveLength(1);
    expect(pages[0]!.classList.contains(compact)).toBe(false);
    expect(copy(pages)).toBe(source.textContent);
  });

  it.each([false, true])(
    'tries compact layouts before splitting the question (grid: %s)',
    (grid) => {
      const source = choice();
      const pages = layoutProjection(
        source,
        (page) => page.classList.contains(compact) && page.classList.contains(twoColumns) === grid,
      );

      expect(pages).toHaveLength(1);
      expect(pages[0]!.classList.contains(twoColumns)).toBe(grid);
      expect(pages[0]!.querySelectorAll(answerSelector)).toHaveLength(4);
      expect(copy(pages)).toBe(source.textContent);
    },
  );

  it('uses two columns when exactly two options only fit side by side', () => {
    const source = choice();
    Array.from(source.querySelectorAll(answerSelector))
      .slice(2)
      .forEach((card) => card.remove());

    const pages = layoutProjection(source, (page) => page.classList.contains(twoColumns));

    expect(pages).toHaveLength(1);
    expect(pages[0]!.classList.contains(twoColumns)).toBe(true);
    expect(pages[0]!.querySelectorAll(answerSelector)).toHaveLength(2);
    expect(copy(pages)).toBe(source.textContent);
  });

  it('puts the complete result list on one page between question and supplementary content', () => {
    const source = choice('Long question', 'Round comparison details');
    const pages = layoutProjection(
      source,
      (page) =>
        !page.querySelector(answerSelector) ||
        (page.classList.contains(twoColumns) &&
          !page.textContent!.includes('Long question') &&
          !page.textContent!.includes('Round comparison details')),
    );

    expect(pages).toHaveLength(3);
    expect(pages[0]!.querySelectorAll('mat-card')).toHaveLength(1);
    expect(pages[1]!.querySelectorAll(answerSelector)).toHaveLength(4);
    expect(pages[1]!.textContent).toContain('Alpha25 %Beta25 %Gamma25 %Delta25 %');
    expect(pages[2]!.textContent).toContain('Round comparison details');
    expect(copy(pages).replace(/\s+/g, '')).toBe(source.textContent!.replace(/\s+/g, ''));
  });

  it.each([true, false])(
    'keeps the round totals with the separate answer page whenever they fit (fits: %s)',
    (legendFits) => {
      const source = choice('Long question');
      const legendSelector = '[data-projection-answer-legend]';
      source
        .querySelector('[data-projection-answer-list]')!
        .insertAdjacentHTML(
          'beforebegin',
          '<div data-projection-answer-legend>Round 1: 50 votes · Round 2: 48 votes</div>',
        );

      const pages = layoutProjection(source, (page) => {
        if (!page.querySelector(answerSelector)) return true;
        if (page.textContent!.includes('Long question')) return false;
        return (
          !page.querySelector(legendSelector) || (legendFits && page.classList.contains(twoColumns))
        );
      });

      expect(pages).toHaveLength(2);
      expect(pages[1]!.querySelectorAll(answerSelector)).toHaveLength(4);
      expect(!!pages[1]!.querySelector(legendSelector)).toBe(legendFits);
      expect(pages[1]!.classList.contains(twoColumns)).toBe(legendFits);
      expect(copy(pages).replace(/\s+/g, '')).toBe(source.textContent!.replace(/\s+/g, ''));
    },
  );

  it('falls back to ordinary pagination when the answer group itself is too tall', () => {
    const source = choice();
    const fits = (page: HTMLElement) => page.querySelectorAll(answerSelector).length <= 2;
    const pages = layoutProjection(source, fits);

    expect(pages.map((page) => page.innerHTML)).toEqual(
      paginateProjection(source, fits).map((page) => page.innerHTML),
    );
    expect(pages).toHaveLength(2);
    expect(pages.every((page) => !page.classList.contains(compact))).toBe(true);
  });
});

describe('semantic projection pages', () => {
  it('keeps complete content and order when long prose spans pages', () => {
    const source = root(
      '<h1>' +
        'A long question with accents é and punctuation. '.repeat(30) +
        '</h1><p>Final answer.</p>',
    );
    const pages = paginateProjection(source, (page) => page.textContent!.length <= 150);
    expect(pages.length).toBeGreaterThan(2);
    expect(copy(pages)).toBe(source.textContent);
    expect(pages[1]!.querySelector('h1')).not.toBeNull();
  });
  it('keeps formulas atomic and code split at complete lines', () => {
    const source = root(
      '<p>Question</p><div class="katex"><span>a + b = c</span></div><pre><code>line one\nline two\nline three\nline four</code></pre>',
    );
    const pages = paginateProjection(source, (page) => page.textContent!.length <= 22);
    expect(copy(pages)).toBe(source.textContent);
    expect(pages.flatMap((page) => Array.from(page.querySelectorAll('.katex')))).toHaveLength(1);
    for (const page of pages) {
      const code = page.querySelector('code')?.textContent;
      if (code) expect(code).toMatch(/^(line (one|two|three|four)\n?)+$/);
    }
  });
  it('projects every matrix value together with its row and column labels', () => {
    const source = root(
      '<div class="distribution-matrix"><table><thead><tr><th>Item</th><th>Left</th><th>Right</th></tr></thead><tbody><tr><th>First</th><td>3 / 30%</td><td>7 / 70%</td></tr></tbody></table></div>',
    );
    const prepared = prepareProjectionSource(source);
    const entries = Array.from(prepared.querySelectorAll('.projection-matrix__entry'));
    expect(entries.map((entry) => entry.textContent)).toEqual([
      'First → Left3 / 30%',
      'First → Right7 / 70%',
    ]);
    expect(source.querySelector('table')).not.toBeNull();
  });

  it('retains all answer labels and reveals no removed status content', () => {
    const source = root(
      '<p data-projection-status>Countdown 20</p><ol><li>A: First</li><li>B: Second</li><li>C: Third</li></ol>',
    );
    const pages = paginateProjection(source, (page) => page.textContent!.length <= 12);
    expect(copy(pages)).toBe('A: FirstB: SecondC: Third');
    const numbers = pages.flatMap((page) =>
      Array.from(page.querySelectorAll('li'))
        .filter((li) => li.textContent)
        .map((li) => li.value),
    );
    expect(numbers).toEqual([1, 2, 3]);
    expect(pages.every((page) => !page.querySelector('[data-projection-status]'))).toBe(true);
  });

  it('moves complete presenter answer options to following pages instead of splitting them', () => {
    const source = root(
      '<ul class="session-projection-quiz__answers">' +
        '<li class="session-projection-quiz__answer"><div class="session-projection-quiz__answer-head">Alpha option</div></li>' +
        '<li class="session-projection-quiz__answer"><div class="session-projection-quiz__answer-head">Beta option</div></li>' +
        '<li class="session-projection-quiz__answer"><div class="session-projection-quiz__answer-head">Gamma option</div></li>' +
        '</ul>',
    );
    const pages = paginateProjection(source, (page) => page.textContent!.length <= 14);

    expect(copy(pages)).toBe(source.textContent);
    expect(pages).toHaveLength(3);
    expect(
      pages.map((page) =>
        Array.from(page.querySelectorAll('.session-projection-quiz__answer'), (answer) =>
          answer.textContent?.trim(),
        ),
      ),
    ).toEqual([['Alpha option'], ['Beta option'], ['Gamma option']]);
  });

  it('uses complete result answer cards as preferred page boundaries', () => {
    const source = root(
      '<p>Question</p><ul class="session-projection-quiz__answers">' +
        '<li class="session-projection-quiz__answer"><div class="session-projection-quiz__answer-head">START-A Result answer END-A</div><div class="session-projection-quiz__bar-track">50 %</div></li>' +
        '<li class="session-projection-quiz__answer"><div class="session-projection-quiz__answer-head">START-B Result answer END-B</div><div class="session-projection-quiz__bar-track">50 %</div></li>' +
        '</ul>',
    );
    const firstAnswerEnd = 'QuestionSTART-A Result answer END-A50 %'.length;
    const pages = paginateProjection(source, (page) => page.textContent!.length <= firstAnswerEnd);

    expect(pages).toHaveLength(2);
    expect(pages[0]!.textContent).toBe('QuestionSTART-A Result answer END-A50 %');
    expect(pages[1]!.textContent).toBe('START-B Result answer END-B50 %');
    expect(
      pages.every((page) =>
        Array.from(page.querySelectorAll('.session-projection-quiz__answer')).every((answer) => {
          const text = answer.textContent ?? '';
          return (
            (!text.includes('START-A') || text.includes('END-A')) &&
            (!text.includes('START-B') || text.includes('END-B'))
          );
        }),
      ),
    ).toBe(true);
  });

  it('marks four answer options for a compact single-page layout', () => {
    const source = root(
      '<ul class="session-projection-quiz__answers">' +
        ['Alpha', 'Beta', 'Gamma', 'Delta']
          .map((label) => `<li class="session-projection-quiz__answer"><div>${label}</div></li>`)
          .join('') +
        '</ul>',
    );
    const prepared = prepareProjectionSource(source);
    const pages = paginateProjection(prepared, () => true);

    expect(copy(pages)).toBe(source.textContent);
    expect(prepared.classList.contains('projection-source--many-units')).toBe(true);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.querySelectorAll('.session-projection-quiz__answer')).toHaveLength(4);
  });

  it('marks four structured projection units for a compact single-page layout', () => {
    const source = root(
      '<ul>' +
        ['Matching', 'Ordering', 'Category A', 'Category B']
          .map((label) => `<li data-projection-unit>${label}</li>`)
          .join('') +
        '</ul>',
    );
    const prepared = prepareProjectionSource(source);
    const pages = paginateProjection(prepared, () => true);

    expect(copy(pages)).toBe(source.textContent);
    expect(prepared.classList.contains('projection-source--many-units')).toBe(true);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.querySelectorAll('[data-projection-unit]')).toHaveLength(4);
  });

  it('keeps matching pairs, ordering options and categorization options atomic', () => {
    const source = root(
      '<ul>' +
        '<li class="session-projection-quiz__pair" data-projection-unit><span>START-M</span><span>Matching pair</span><span>END-M</span></li>' +
        '<li class="session-projection-quiz__option-chip" data-projection-unit><span>START-O</span><span>Ordering option</span><span>END-O</span></li>' +
        '<li class="session-projection-quiz__option-chip" data-projection-unit><span>START-C</span><span>Category option</span><span>END-C</span></li>' +
        '</ul>',
    );
    const pages = paginateProjection(source, (page) => page.textContent!.length <= 28);

    expect(copy(pages)).toBe(source.textContent);
    expect(pages).toHaveLength(3);
    for (const marker of ['M', 'O', 'C']) {
      expect(
        pages.some((page) => {
          const text = page.textContent ?? '';
          return text.includes(`START-${marker}`) && text.includes(`END-${marker}`);
        }),
      ).toBe(true);
      expect(
        pages.every((page) => {
          const text = page.textContent ?? '';
          return text.includes(`START-${marker}`) === text.includes(`END-${marker}`);
        }),
      ).toBe(true);
    }
  });
});

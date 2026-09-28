import { describe, expect, it } from 'vitest';
import { paginateProjection, prepareProjectionSource } from './projection-pages.util';

function root(html: string): HTMLElement {
  const element = document.createElement('article');
  element.innerHTML = html;
  return element;
}
const copy = (pages: HTMLElement[]): string => pages.map((page) => page.textContent).join('');

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

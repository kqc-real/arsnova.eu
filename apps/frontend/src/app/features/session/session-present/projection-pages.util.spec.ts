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
});

import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { PresenterDistributionMatrixComponent } from './presenter-distribution-matrix.component';

describe('PresenterDistributionMatrixComponent', () => {
  it('rendert die vollständige Matrix einschließlich Nullzellen und Musterlösung', () => {
    const fixture = TestBed.createComponent(PresenterDistributionMatrixComponent);
    fixture.componentRef.setInput('title', 'Gewählte Zuordnungen');
    fixture.componentRef.setInput('description', '2 Stimmen');
    fixture.componentRef.setInput('rows', [
      { id: 'left-a', label: '**A**' },
      { id: 'left-b', label: 'B' },
    ]);
    fixture.componentRef.setInput('columns', [
      { id: 'right-1', label: '$1$' },
      { id: 'right-2', label: '2' },
    ]);
    fixture.componentRef.setInput('cells', [
      { rowId: 'left-a', columnId: 'right-1', count: 2 },
      { rowId: 'left-b', columnId: 'right-2', count: 1 },
    ]);
    fixture.componentRef.setInput('totalVotes', 2);
    fixture.componentRef.setInput('correctColumnByRow', {
      'left-a': 'right-1',
      'left-b': 'right-2',
    });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const region = host.querySelector<HTMLElement>('[role="region"]');
    const cells = [...host.querySelectorAll<HTMLTableCellElement>('tbody td')];

    expect(region?.getAttribute('aria-label')).toBe('Gewählte Zuordnungen');
    expect(region?.tabIndex).toBe(0);
    expect(cells).toHaveLength(4);
    expect(
      cells.map((cell) => cell.querySelector('.distribution-matrix__count')?.textContent),
    ).toEqual(['2', '0', '0', '1']);
    expect(cells[0]?.textContent).toContain('100 %');
    expect(host.querySelectorAll('.distribution-matrix__cell--correct')).toHaveLength(2);
    expect(host.querySelectorAll('.sr-only')).toHaveLength(2);
    expect(host.querySelector('tbody th strong')?.textContent).toBe('A');
    expect(host.querySelector('thead .katex')).toBeTruthy();
  });
});

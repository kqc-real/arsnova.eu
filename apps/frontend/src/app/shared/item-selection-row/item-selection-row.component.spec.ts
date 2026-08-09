import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ItemSelectionRowComponent } from './item-selection-row.component';

describe('ItemSelectionRowComponent', () => {
  it('rendert Markdown und KaTeX in Element, Auswahl und Optionen', () => {
    const fixture = TestBed.createComponent(ItemSelectionRowComponent);
    fixture.componentRef.setInput('itemText', '**Impuls** $x^2$');
    fixture.componentRef.setInput('options', [
      { id: 'one', text: '**Erste** $x$' },
      { id: 'two', text: 'Zweite' },
    ]);
    fixture.componentRef.setInput('selectedId', 'one');
    fixture.componentRef.setInput('selectLabel', 'Zuordnung');
    fixture.componentRef.setInput('selectAriaLabel', 'Zuordnung für Impuls');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.item-selection-row__item strong')?.textContent).toBe('Impuls');
    expect(host.querySelector('.item-selection-row__item .katex')).toBeTruthy();
    expect(host.querySelector('mat-select')?.getAttribute('aria-label')).toBe(
      'Zuordnung für Impuls',
    );
    expect(fixture.componentInstance.selectedText()).toBe('**Erste** $x$');
  });

  it('gibt ausschließlich die stabile ID der Auswahl aus', () => {
    const fixture = TestBed.createComponent(ItemSelectionRowComponent);
    fixture.componentRef.setInput('itemText', 'Element');
    fixture.componentRef.setInput('options', [{ id: 'stable-option-id', text: 'Sichtbarer Text' }]);
    fixture.componentRef.setInput('selectedId', '');
    fixture.componentRef.setInput('selectLabel', 'Auswahl');
    fixture.componentRef.setInput('selectAriaLabel', 'Auswahl für Element');
    const listener = vi.fn();
    fixture.componentInstance.selectedIdChange.subscribe(listener);

    fixture.componentInstance.selectedIdChange.emit('stable-option-id');

    expect(listener).toHaveBeenCalledWith('stable-option-id');
    expect(listener).not.toHaveBeenCalledWith('Sichtbarer Text');
  });
});

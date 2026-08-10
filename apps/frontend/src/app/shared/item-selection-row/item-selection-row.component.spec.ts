import { TestBed } from '@angular/core/testing';
import { MatSelect } from '@angular/material/select';
import { By } from '@angular/platform-browser';
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

  it('schließt das Auswahlmenü nach einer bestätigten Auswahl explizit', async () => {
    const fixture = TestBed.createComponent(ItemSelectionRowComponent);
    fixture.componentRef.setInput('itemText', 'Element');
    fixture.componentRef.setInput('options', [{ id: 'stable-option-id', text: 'Sichtbarer Text' }]);
    fixture.componentRef.setInput('selectedId', '');
    fixture.componentRef.setInput('selectLabel', 'Auswahl');
    fixture.componentRef.setInput('selectAriaLabel', 'Auswahl für Element');
    fixture.detectChanges();

    const select = fixture.debugElement.query(By.directive(MatSelect))
      .componentInstance as MatSelect;
    const closeSpy = vi.spyOn(select, 'close').mockImplementation(() => undefined);
    const listener = vi.fn();
    fixture.componentInstance.selectedIdChange.subscribe(listener);

    fixture.componentInstance.confirmSelection('stable-option-id', select);

    expect(listener).toHaveBeenCalledWith('stable-option-id');
    expect(closeSpy).not.toHaveBeenCalled();

    await Promise.resolve();

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('öffnet die Auswahl mit dem ersten Klick auf den sichtbaren Formularrahmen', () => {
    const fixture = TestBed.createComponent(ItemSelectionRowComponent);
    fixture.componentRef.setInput('itemText', 'Element');
    fixture.componentRef.setInput('options', [{ id: 'one', text: 'Erste Option' }]);
    fixture.componentRef.setInput('selectedId', '');
    fixture.componentRef.setInput('selectLabel', 'Auswahl');
    fixture.componentRef.setInput('selectAriaLabel', 'Auswahl für Element');
    fixture.detectChanges();

    const select = fixture.debugElement.query(By.directive(MatSelect))
      .componentInstance as MatSelect;
    const openSpy = vi.spyOn(select, 'open').mockImplementation(() => undefined);

    (fixture.nativeElement as HTMLElement).querySelector('mat-form-field')?.click();

    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it('überlässt einen Klick auf das Select ausschließlich dem nativen Select-Handler', () => {
    const fixture = TestBed.createComponent(ItemSelectionRowComponent);
    fixture.componentRef.setInput('itemText', 'Element');
    fixture.componentRef.setInput('options', [{ id: 'one', text: 'Erste Option' }]);
    fixture.componentRef.setInput('selectedId', '');
    fixture.componentRef.setInput('selectLabel', 'Auswahl');
    fixture.componentRef.setInput('selectAriaLabel', 'Auswahl für Element');
    fixture.detectChanges();

    const select = fixture.debugElement.query(By.directive(MatSelect))
      .componentInstance as MatSelect;
    const openSpy = vi.spyOn(select, 'open').mockImplementation(() => undefined);

    (fixture.nativeElement as HTMLElement).querySelector('mat-select')?.click();

    expect(openSpy).toHaveBeenCalledTimes(1);
  });
});

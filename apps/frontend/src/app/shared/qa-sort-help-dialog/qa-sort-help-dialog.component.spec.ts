import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LOCALE_ID } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { QaSortHelpDialogComponent } from './qa-sort-help-dialog.component';

describe('QaSortHelpDialogComponent', () => {
  async function create(kind: 'BEST' | 'CONTROVERSIAL'): Promise<{
    fixture: ComponentFixture<QaSortHelpDialogComponent>;
    el: HTMLElement;
  }> {
    await TestBed.configureTestingModule({
      imports: [QaSortHelpDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MAT_DIALOG_DATA, useValue: { kind } },
        { provide: LOCALE_ID, useValue: 'de' },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(QaSortHelpDialogComponent);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('renders BEST help with Wilson formula', async () => {
    const { el } = await create('BEST');
    expect(el.querySelector('.dialog-title-header__heading')?.textContent?.trim()).toBe(
      'Beste Fragen',
    );
    expect(el.querySelector('.qa-sort-help-dialog__body')?.textContent).toContain('Wilson');
    expect(el.querySelector('.qa-sort-help-dialog__body .katex')).toBeTruthy();
    const body = el.querySelector('.qa-sort-help-dialog__body')!;
    expect(body.querySelector('.markdown-katex-error')).toBeNull();
    expect(body.innerHTML).not.toContain('\\(');
    expect(body.innerHTML).not.toContain('\\)');
    expect(body.querySelectorAll('.katex-display').length).toBeGreaterThanOrEqual(1);
    expect(body.querySelectorAll('.katex').length).toBeGreaterThanOrEqual(6);
  });

  it('renders CONTROVERSIAL help with threshold explanation', async () => {
    const { el } = await create('CONTROVERSIAL');
    expect(el.querySelector('.dialog-title-header__heading')?.textContent?.trim()).toBe(
      'Umstrittene Fragen',
    );
    expect(el.querySelector('.qa-sort-help-dialog__body')?.textContent).toContain('umstritten');
    expect(el.querySelector('.qa-sort-help-dialog__body table')).toBeTruthy();
    const body = el.querySelector('.qa-sort-help-dialog__body')!;
    expect(body.querySelector('.markdown-katex-error')).toBeNull();
    expect(body.innerHTML).not.toContain('\\(');
    expect(body.querySelectorAll('.katex-display').length).toBeGreaterThanOrEqual(2);
  });
});

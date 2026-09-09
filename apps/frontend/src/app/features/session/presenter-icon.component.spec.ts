import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { PresenterIconComponent } from './presenter-icon.component';

describe('PresenterIconComponent', () => {
  let fixture: ComponentFixture<PresenterIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PresenterIconComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(PresenterIconComponent);
    fixture.detectChanges();
  });

  it('zeichnet den Beamer als currentColor-SVG', () => {
    const svg = fixture.nativeElement.querySelector('svg.presenter-icon') as SVGElement | null;
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    const path = svg?.querySelector('path');
    expect(path?.getAttribute('fill')).toBe('currentColor');
    expect(path?.getAttribute('fill-rule')).toBe('evenodd');
    expect(svg?.querySelectorAll('rect')).toHaveLength(2);
    expect(svg?.querySelector('g')?.getAttribute('transform')).toBe('translate(0 1.2)');
    expect(getComputedStyle(svg!).transform).toMatch(
      /translateY\(-2px\)|matrix\(1,\s*0,\s*0,\s*1,\s*0,\s*-2/,
    );
  });

  it('steht in Material-Buttons als Leading-Icon neben dem Label', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.hasAttribute('matButtonIcon')).toBe(true);
    const styles = getComputedStyle(host);
    expect(styles.display).toBe('inline-flex');
    expect(styles.alignItems).toBe('center');
    expect(styles.alignSelf).toBe('center');
    expect(styles.verticalAlign).toBe('middle');
    expect(styles.width).toMatch(/1\.75rem|app-presenter-icon-size/);
    expect(styles.height).toMatch(/1\.75rem|app-presenter-icon-size/);
  });
});

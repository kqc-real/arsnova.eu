import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { CountdownFingersComponent } from './countdown-fingers.component';

describe('CountdownFingersComponent', () => {
  it('beschreibt die Fingergrafik ohne doppelten Alternativtext', () => {
    const fixture = TestBed.createComponent(CountdownFingersComponent);
    fixture.componentRef.setInput('seconds', 3);
    fixture.detectChanges();

    const graphic = fixture.nativeElement.querySelector('[role="img"]') as HTMLElement;
    const image = graphic.querySelector('img') as HTMLImageElement;

    expect(graphic.getAttribute('aria-label')).toBe('3 Sekunden, durch Finger dargestellt');
    expect(image.alt).toBe('');
    expect(image.getAttribute('aria-hidden')).toBe('true');
  });

  it('verwendet für eine Sekunde die Singularform', () => {
    const fixture = TestBed.createComponent(CountdownFingersComponent);
    fixture.componentRef.setInput('seconds', 1);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="img"]').getAttribute('aria-label')).toBe(
      '1 Sekunde, durch einen Finger dargestellt',
    );
  });
});

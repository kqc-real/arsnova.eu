import { TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

  it('hält Vote-Fingers schmal, light-only Kontrast und bündig unten links', () => {
    const fixture = TestBed.createComponent(CountdownFingersComponent);
    fixture.componentRef.setInput('seconds', 4);
    fixture.componentRef.setInput('size', 'small');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.classList.contains('countdown-fingers-host--viewport')).toBe(true);

    const styles = readFileSync(
      resolve(process.cwd(), 'src/app/shared/countdown-fingers/countdown-fingers.component.ts'),
      'utf8',
    );

    expect(styles).toMatch(/countdown-fingers-host--viewport[\s\S]*?position:\s*fixed/);
    expect(styles).toMatch(/countdown-fingers-host--viewport[\s\S]*?bottom:\s*0;/);
    expect(styles).not.toMatch(/bottom:\s*max\(5\.5rem/);
    expect(styles).not.toMatch(/position-anchor:\s*--app-footer-anchor/);
    expect(styles).toMatch(/countdown-fingers-host--viewport[\s\S]*?left:\s*calc\(/);
    expect(styles).toMatch(/width:\s*fit-content/);
    expect(styles).toMatch(
      /countdown-fingers--small[\s\S]*?background:\s*light-dark\(\s*var\(--mat-sys-inverse-surface\),\s*transparent\s*\)/,
    );
    expect(styles).toMatch(/padding:\s*0\.2rem 0\.3rem 0/);
    expect(styles).toMatch(/countdown-fingers--small[\s\S]*?width:\s*48px/);
  });
});

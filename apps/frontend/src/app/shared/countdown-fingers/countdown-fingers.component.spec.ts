import { TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CountdownFingersComponent } from './countdown-fingers.component';
import { VOTE_FINGER_PRELOAD_INTERVAL_MS } from './countdown-fingers-preload';

describe('CountdownFingersComponent', () => {
  it('verwendet für die große Presenter-Darstellung vierfach aufgelöste Assets', () => {
    for (let seconds = 0; seconds <= 5; seconds += 1) {
      const png = readFileSync(
        resolve(
          process.cwd(),
          `src/assets/countdown-fingers/countdown_poster_clean_${seconds}.png`,
        ),
      );

      expect(png.readUInt32BE(16)).toBe(568);
      expect(png.readUInt32BE(20)).toBe(1392);
    }
  });

  it('begrenzt die mobilen Fingerbilder zusammen auf 40 KiB', () => {
    const bytes = [0, 1, 2, 3, 4, 5].map(
      (seconds) =>
        readFileSync(
          resolve(process.cwd(), `src/assets/countdown-fingers/countdown_vote_${seconds}.webp`),
        ).length,
    );
    expect(bytes.reduce((sum, size) => sum + size, 0)).toBeLessThanOrEqual(40 * 1024);
  });

  it('beschreibt die Fingergrafik ohne doppelten Alternativtext', () => {
    const fixture = TestBed.createComponent(CountdownFingersComponent);
    fixture.componentRef.setInput('seconds', 3);
    fixture.detectChanges();

    const graphic = fixture.nativeElement.querySelector('.countdown-fingers') as HTMLElement;
    const image = graphic.querySelector('img') as HTMLImageElement;

    expect(graphic.getAttribute('role')).toBeNull();
    expect(graphic.getAttribute('aria-hidden')).toBe('true');
    image.dispatchEvent(new Event('load'));
    fixture.detectChanges();
    expect(graphic.getAttribute('aria-label')).toBe('3 Sekunden, durch Finger dargestellt');
    expect(graphic.getAttribute('role')).toBe('img');
    expect(graphic.getAttribute('aria-hidden')).toBeNull();
    expect(image.alt).toBe('');
    expect(image.getAttribute('aria-hidden')).toBe('true');
  });

  it('zeigt die Null-Finger-Grafik als letztes Bild', () => {
    const fixture = TestBed.createComponent(CountdownFingersComponent);
    fixture.componentRef.setInput('seconds', 0);
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(image.src).toContain('countdown_vote_0.webp');
  });

  it('verwendet für eine Sekunde die Singularform', () => {
    const fixture = TestBed.createComponent(CountdownFingersComponent);
    fixture.componentRef.setInput('seconds', 1);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('img') as HTMLImageElement).dispatchEvent(
      new Event('load'),
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="img"]').getAttribute('aria-label')).toBe(
      '1 Sekunde, durch einen Finger dargestellt',
    );
  });

  it('wechselt ohne neuen Ladezustand zum vorgeladenen Bild und nutzt bei fehlenden Bildern den Fallback', () => {
    const fixture = TestBed.createComponent(CountdownFingersComponent);
    fixture.componentRef.setInput('seconds', 5);
    fixture.componentRef.setInput('size', 'present');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const firstImage = host.querySelector('img') as HTMLImageElement;
    const nextImage = host.querySelector('img[src$="_4.png"]') as HTMLImageElement;
    const graphic = host.querySelector('.countdown-fingers') as HTMLElement;
    expect(host.classList.contains('countdown-fingers-host--loaded')).toBe(false);
    expect(graphic.hidden).toBe(true);

    firstImage.dispatchEvent(new Event('load'));
    nextImage.dispatchEvent(new Event('load'));
    fixture.detectChanges();
    expect(host.classList.contains('countdown-fingers-host--loaded')).toBe(true);
    expect(graphic.hidden).toBe(false);
    expect(nextImage.hidden).toBe(true);

    fixture.componentRef.setInput('seconds', 4);
    fixture.detectChanges();
    expect(host.classList.contains('countdown-fingers-host--loaded')).toBe(true);
    expect(graphic.hidden).toBe(false);
    expect(host.querySelector('img:not([hidden])')).toBe(nextImage);
    expect(firstImage.hidden).toBe(true);

    fixture.componentRef.setInput('seconds', 3);
    fixture.detectChanges();
    expect(host.classList.contains('countdown-fingers-host--loaded')).toBe(false);
    expect(graphic.hidden).toBe(true);

    const failedImage = host.querySelector('img[src$="_3.png"]') as HTMLImageElement;
    failedImage.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(host.classList.contains('countdown-fingers-host--loaded')).toBe(false);
    expect(graphic.hidden).toBe(true);
  });

  it('staffelt Vote-Abrufe einzeln und beendet die Staffel beim Verlassen der Ansicht', () => {
    vi.useFakeTimers();
    try {
      const fixture = TestBed.createComponent(CountdownFingersComponent);
      fixture.componentRef.setInput('seconds', 9);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      const frames = () =>
        Array.from(host.querySelectorAll('img')).map((image) => image.src.split('/').at(-1));
      expect(frames()).toEqual(['countdown_vote_5.webp']);

      vi.advanceTimersByTime(VOTE_FINGER_PRELOAD_INTERVAL_MS - 1);
      fixture.detectChanges();
      expect(frames()).toEqual(['countdown_vote_5.webp']);
      vi.advanceTimersByTime(1);
      fixture.detectChanges();
      expect(frames()).toEqual(['countdown_vote_5.webp', 'countdown_vote_4.webp']);

      fixture.destroy();
      vi.advanceTimersByTime(VOTE_FINGER_PRELOAD_INTERVAL_MS);
      expect(fixture.componentInstance.requestedFrames()).toEqual([5, 4]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('fordert nach einer Zeitverlängerung den aktuellen Frame sofort und weitere Frames gestaffelt an', () => {
    vi.useFakeTimers();
    try {
      const fixture = TestBed.createComponent(CountdownFingersComponent);
      fixture.componentRef.setInput('seconds', 2);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      const frames = () =>
        Array.from(host.querySelectorAll('img')).map((image) => image.src.split('/').at(-1));
      expect(frames()).toEqual(['countdown_vote_2.webp']);

      fixture.componentRef.setInput('seconds', 5);
      fixture.detectChanges();
      expect(frames()).toEqual(['countdown_vote_2.webp', 'countdown_vote_5.webp']);

      vi.advanceTimersByTime(VOTE_FINGER_PRELOAD_INTERVAL_MS);
      fixture.detectChanges();
      expect(frames()).toEqual([
        'countdown_vote_2.webp',
        'countdown_vote_5.webp',
        'countdown_vote_4.webp',
      ]);

      fixture.componentRef.setInput('seconds', 4);
      fixture.detectChanges();
      expect(frames()).toEqual([
        'countdown_vote_2.webp',
        'countdown_vote_5.webp',
        'countdown_vote_4.webp',
      ]);

      vi.advanceTimersByTime(VOTE_FINGER_PRELOAD_INTERVAL_MS);
      fixture.detectChanges();
      expect(frames()).toEqual([
        'countdown_vote_2.webp',
        'countdown_vote_5.webp',
        'countdown_vote_4.webp',
        'countdown_vote_3.webp',
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('hält Vote-Fingers transparent, bündig unten links', () => {
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
    expect(styles).toMatch(/countdown-fingers--small[\s\S]*?background:\s*transparent/);
    expect(styles).toMatch(/countdown-fingers--large[\s\S]*?background:\s*transparent/);
    expect(styles).toMatch(/countdown-fingers--present[\s\S]*?background:\s*transparent/);
    expect(styles).not.toMatch(/background:\s*var\(--mat-sys-primary\)/);
    expect(styles).toMatch(/countdown-fingers--small[\s\S]*?padding:\s*0/);
    expect(styles).toMatch(/countdown-fingers--small[\s\S]*?width:\s*48px/);
    expect(styles).toMatch(/countdown-fingers--small[\s\S]*?height:\s*calc\(48px \* 348 \/ 142\)/);
    expect(styles).toMatch(/countdown-fingers--large[\s\S]*?height:\s*calc\(120px \* 348 \/ 142\)/);
    expect(styles).toMatch(/countdown-fingers--present[\s\S]*?height:\s*100%/);
    expect(styles).toMatch(/countdown-fingers--present[\s\S]*?image-rendering:\s*auto/);
    expect(styles).toMatch(/\.countdown-fingers\s*\{[^}]*transform-origin:\s*bottom center/);
    expect(styles).toMatch(/countdown-fingers-host--present[\s\S]*?height:\s*min\(41%, 24rem\)/);
    expect(styles).toMatch(/countdown-fingers-host--present[\s\S]*?max-width:\s*100%/);
  });
});

import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HelpComponent } from './help.component';

describe('HelpComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HelpComponent],
      providers: [provideRouter([])],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('ruft bei Klick auf den Backdrop location.back auf', async () => {
    const fixture = TestBed.createComponent(HelpComponent);
    const location = TestBed.inject(Location);
    const spy = vi.spyOn(location, 'back');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const backdrop = (fixture.nativeElement as HTMLElement).querySelector(
      '.content-page-backdrop-sheet',
    );
    expect(backdrop).toBeTruthy();
    backdrop!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(spy).toHaveBeenCalledOnce();
  });

  it('zeigt keine Rekordteilnahme mehr auf der Hilfeseite', async () => {
    const fixture = TestBed.createComponent(HelpComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).not.toMatch(/Rekordteilnahme/i);
  });
});

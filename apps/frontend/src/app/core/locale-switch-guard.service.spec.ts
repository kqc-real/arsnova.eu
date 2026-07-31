import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, beforeEach } from 'vitest';
import { LocaleSwitchGuardService } from './locale-switch-guard.service';

describe('LocaleSwitchGuardService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), LocaleSwitchGuardService],
    });
  });

  it('kombiniert mehrere Dirty-Getter und schliesst Preview-Routen ein', () => {
    const router = TestBed.inject(Router);
    Object.defineProperty(router, 'url', {
      value: '/de/quiz/abc/preview',
      configurable: true,
    });
    const guard = TestBed.inject(LocaleSwitchGuardService);
    const editDirty = (): boolean => false;
    const previewDirty = (): boolean => true;

    guard.register(editDirty);
    guard.register(previewDirty);

    expect(guard.hasUnsavedChanges()).toBe(true);

    guard.unregister(previewDirty);
    expect(guard.hasUnsavedChanges()).toBe(false);

    guard.unregister(editDirty);
  });

  it('ignoriert Sync-Routen', () => {
    const router = TestBed.inject(Router);
    Object.defineProperty(router, 'url', {
      value: '/quiz/sync/doc-1',
      configurable: true,
    });
    const guard = TestBed.inject(LocaleSwitchGuardService);
    const dirty = (): boolean => true;
    guard.register(dirty);

    expect(guard.hasUnsavedChanges()).toBe(false);

    guard.unregister(dirty);
  });
});

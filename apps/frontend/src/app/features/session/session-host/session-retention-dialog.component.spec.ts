import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';
import { SessionRetentionDialogComponent } from './session-retention-dialog.component';

const lifecycle = {
  status: 'ACTIVE' as const,
  createdAt: '2026-03-24T12:00:00.000Z',
  expiresAt: '2026-03-25T12:00:00.000Z',
  endedAt: null,
  qaClosesAt: '2026-03-25T12:00:00.000Z',
  firstParticipantJoinedAt: '2026-03-24T12:05:00.000Z',
  timeZone: 'Europe/Berlin',
  sessionLifecycleRevision: 2,
  serverNow: '2026-03-25T11:30:00.000Z',
  maxExpiresAt: '2026-04-07T12:00:00.000Z',
  originalHost: true,
  extensionAllowed: true,
  configurationAllowed: false,
  postProcessingEndsAt: '2026-04-08T12:00:00.000Z',
  purgeEligibleAt: '2026-04-08T12:00:00.000Z',
  expectedDeletionAt: '2026-04-08T12:00:00.000Z',
  deletionDelayedByLegalHold: false,
  hostContentAccessAllowed: true,
};

describe('SessionRetentionDialogComponent', () => {
  it('zeigt Nachbereitung und technische Löschung', () => {
    TestBed.configureTestingModule({
      imports: [SessionRetentionDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { lifecycle } },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(SessionRetentionDialogComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.dialog-title-header')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Datenverfügbarkeit');
    expect(fixture.nativeElement.textContent).toContain('Host-Nachbereitung bis:');
    expect(fixture.nativeElement.textContent).toContain('Voraussichtliche technische Löschung:');
    expect(fixture.nativeElement.textContent).not.toContain(
      'Eine begrenzte Aufbewahrung verzögert die technische Löschung',
    );
  });

  it('erklärt einen Legal Hold ohne Zugriffsverlängerung', () => {
    TestBed.configureTestingModule({
      imports: [SessionRetentionDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: { lifecycle: { ...lifecycle, deletionDelayedByLegalHold: true } },
        },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(SessionRetentionDialogComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Eine begrenzte Aufbewahrung verzögert die technische Löschung, verlängert aber keinen regulären Zugriff.',
    );
  });
});

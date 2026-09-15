import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QaChannelConfigurationDialogComponent } from './qa-channel-configuration-dialog.component';

const { previewMock, configureMock } = vi.hoisted(() => ({
  previewMock: vi.fn(),
  configureMock: vi.fn(),
}));

vi.mock('../../../core/trpc.client', () => ({
  trpc: {
    session: {
      previewQaConfiguration: { query: previewMock },
      configureQaChannel: { mutate: configureMock },
    },
  },
}));

const session = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'ABC123',
  type: 'QUIZ' as const,
  status: 'ACTIVE' as const,
  serverTime: '2026-09-15T07:00:00.000Z',
  serverNow: '2026-09-15T07:00:00.000Z',
  expiresAt: '2026-09-16T06:00:00.000Z',
  qaClosesAt: null,
  timeZone: 'Europe/Berlin',
  sessionLifecycleRevision: 2,
  quizName: 'Seminar',
  title: 'Seminar',
  participantCount: 0,
  nicknameTheme: 'HIGH_SCHOOL' as const,
  allowCustomNicknames: true,
  anonymousMode: false,
  teamMode: false,
  teamCount: null,
  teamAssignment: null,
  teamNames: [],
  channels: {
    quiz: { enabled: true },
    qa: {
      enabled: false,
      open: false,
      closesAt: null,
      state: 'UNCONFIGURED' as const,
      title: null,
      moderationMode: true,
    },
    quickFeedback: { enabled: false, open: false },
  },
  preferredChannel: 'quiz' as const,
};

const preview = {
  mode: 'INITIAL' as const,
  expectedLifecycleRevision: 2,
  oldQaClosesAt: null,
  newQaClosesAt: '2026-09-16T07:00:00.000Z',
  oldExpiresAt: '2026-09-16T06:00:00.000Z',
  newExpiresAt: '2026-09-16T07:00:00.000Z',
  requiresSessionExtension: true,
  originalHost: true,
  timeZone: 'Europe/Berlin',
  maxExpiresAt: '2026-09-29T06:00:00.000Z',
  serverNow: '2026-09-15T07:00:00.000Z',
  projectedPostProcessingEndsAt: '2026-09-23T07:00:00.000Z',
  projectedPurgeEligibleAt: '2026-09-23T07:00:00.000Z',
};

function configureTestBed(profileLocked = false) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    imports: [QaChannelConfigurationDialogComponent],
    providers: [
      {
        provide: MAT_DIALOG_DATA,
        useValue: { code: 'ABC123', session, profileLocked },
      },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });
  const fixture = TestBed.createComponent(QaChannelConfigurationDialogComponent);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, close };
}

describe('QaChannelConfigurationDialogComponent', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('nutzt die gemeinsame Dialog-Titelzeile', () => {
    const { fixture } = configureTestBed();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('.dialog-title-header')).not.toBeNull();
    expect(host.querySelector('.dialog-title-header__icon mat-icon')?.textContent?.trim()).toBe(
      'forum',
    );
    expect(host.textContent).toContain('Q&A-Kanal einrichten');
  });

  it('sperrt das Teilnahmeprofil nach dem ersten Beitritt sichtbar', () => {
    const { fixture } = configureTestBed(true);

    expect(fixture.nativeElement.textContent).toContain(
      'Das Teilnahmeprofil ist nach dem ersten Beitritt gesperrt.',
    );
    const profileFieldset = fixture.nativeElement.querySelector(
      'fieldset:nth-of-type(2)',
    ) as HTMLFieldSetElement;
    expect(profileFieldset.disabled).toBe(true);
  });

  it('zeigt vor der Bestätigung die serverseitigen Fristen und die globale Verlängerung', async () => {
    previewMock.mockResolvedValue(preview);
    const { fixture, component } = configureTestBed();
    component.deadlineKind = 'DURATION_DAYS';
    component.days = 1;

    await component.loadPreview();
    fixture.detectChanges();

    expect(previewMock).toHaveBeenCalledWith({
      code: 'ABC123',
      mode: 'INITIAL',
      selection: { kind: 'DURATION_DAYS', days: 1 },
    });
    expect(fixture.nativeElement.textContent).toContain('Verbindliche Vorschau');
    expect(fixture.nativeElement.textContent).toContain(
      'Beim Bestätigen wird die globale Sessionfrist mit verlängert',
    );
  });

  it('bindet die Mutation an Revision, Vorschauzeit und bestätigte Fristen', async () => {
    previewMock.mockResolvedValue(preview);
    configureMock.mockResolvedValue({
      channels: {
        ...session.channels,
        qa: {
          ...session.channels.qa,
          enabled: true,
          open: true,
          closesAt: preview.newQaClosesAt,
          state: 'OPEN',
        },
      },
      preferredChannel: 'qa',
      expiresAt: preview.newExpiresAt,
      qaClosesAt: preview.newQaClosesAt,
      sessionLifecycleRevision: 3,
      serverNow: preview.serverNow,
    });
    const { component, close } = configureTestBed();
    component.deadlineKind = 'DURATION_DAYS';
    component.days = 1;
    component.identityMode = 'PRESET_PSEUDONYM';
    component.qaTitle = 'Prüfungsfragen';

    await component.loadPreview();
    await component.confirm();

    expect(configureMock).toHaveBeenCalledWith({
      code: 'ABC123',
      mode: 'INITIAL',
      selection: { kind: 'DURATION_DAYS', days: 1 },
      expectedLifecycleRevision: 2,
      previewServerNow: preview.serverNow,
      confirmedQaClosesAt: preview.newQaClosesAt,
      confirmedExpiresAt: preview.newExpiresAt,
      confirmSessionExtension: true,
      qaTitle: 'Prüfungsfragen',
      moderationMode: true,
      participationProfile: {
        identityMode: 'PRESET_PSEUDONYM',
        nicknameTheme: 'HIGH_SCHOOL',
      },
    });
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ preferredChannel: 'qa' }));
  });
});

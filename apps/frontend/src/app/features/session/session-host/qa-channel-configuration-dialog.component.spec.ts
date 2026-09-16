import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QaChannelConfigurationDialogComponent } from './qa-channel-configuration-dialog.component';

const { previewMock, configureMock, lifecycleMock } = vi.hoisted(() => ({
  previewMock: vi.fn(),
  configureMock: vi.fn(),
  lifecycleMock: vi.fn(),
}));

vi.mock('../../../core/trpc.client', () => ({
  trpc: {
    session: {
      previewQaConfiguration: { query: previewMock },
      configureQaChannel: { mutate: configureMock },
      getLifecycleForHost: { query: lifecycleMock },
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

const matchingSessionPreview = {
  ...preview,
  newQaClosesAt: session.expiresAt,
  newExpiresAt: session.expiresAt,
  requiresSessionExtension: false,
};

function configureTestBed(
  profileLocked = false,
  setup?: { setupStep: number; setupStepCount: number },
) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    imports: [QaChannelConfigurationDialogComponent],
    providers: [
      {
        provide: MAT_DIALOG_DATA,
        useValue: { code: 'ABC123', session, profileLocked, ...setup },
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
    previewMock.mockResolvedValue(matchingSessionPreview);
    lifecycleMock.mockResolvedValue({ firstParticipantJoinedAt: null });
  });

  it('nutzt die gemeinsame Dialog-Titelzeile und bleibt auf einem Schritt', async () => {
    const { fixture, component } = configureTestBed();
    await component.onDeadlineChange();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('.dialog-title-header')).not.toBeNull();
    expect(host.querySelector('.dialog-title-header__icon mat-icon')?.textContent?.trim()).toBe(
      'forum',
    );
    expect(host.textContent).toContain('Fragerunde einrichten');
    expect(host.textContent).toContain('Fragerunde öffnen');
    expect(host.textContent).toContain('Offen für Fragen und Bewertungen bis');
    expect(host.textContent).not.toContain('Schritt 1 von 2');
    expect(host.textContent).not.toContain('Verbindliche Vorschau');
    expect(host.textContent).not.toContain('Vorschau prüfen');
  });

  it('zeigt die Sequenznummer nur beim ersten Q&A-Start', async () => {
    const { fixture } = configureTestBed(false, { setupStep: 2, setupStepCount: 3 });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Schritt 2 von 3');
  });

  it('sperrt das Teilnahmeprofil nach dem ersten Beitritt sichtbar', () => {
    const { fixture } = configureTestBed(true);

    expect(fixture.nativeElement.textContent).toContain(
      'Diese Einstellungen können nach dem ersten Beitritt nicht mehr geändert werden.',
    );
    const profileFieldset = fixture.nativeElement.querySelector(
      'fieldset:nth-of-type(2)',
    ) as HTMLFieldSetElement;
    expect(profileFieldset.disabled).toBe(true);
  });

  it('zeigt die ausgerechnete Frist und die globale Verlängerung direkt im Formular', async () => {
    previewMock.mockResolvedValue(preview);
    const { fixture, component } = configureTestBed();
    component.deadlineKind = 'DURATION_DAYS';
    component.days = 1;

    await component.onDeadlineChange();
    fixture.detectChanges();

    expect(previewMock).toHaveBeenCalledWith({
      code: 'ABC123',
      mode: 'INITIAL',
      selection: { kind: 'DURATION_DAYS', days: 1 },
    });
    expect(fixture.nativeElement.textContent).toContain('Offen für Fragen und Bewertungen bis');
    expect(fixture.nativeElement.textContent).toContain('Session endet');
    expect(fixture.nativeElement.textContent).toContain(
      'Beim Bestätigen wird die globale Sessionfrist mit verlängert',
    );
    expect(fixture.nativeElement.textContent).toContain('Titel der Fragenwand');
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

  it('holt die Vorschau als Neuplanung nach wenn Q&A schon eingerichtet ist', async () => {
    previewMock.mockImplementation(async (input: { mode: 'INITIAL' | 'REPLAN' }) => {
      if (input.mode === 'INITIAL') {
        throw { message: 'Q&A wurde bereits eingerichtet.' };
      }
      return { ...preview, mode: 'REPLAN' as const };
    });
    configureMock.mockResolvedValue({
      channels: session.channels,
      preferredChannel: 'qa',
      expiresAt: preview.newExpiresAt,
      qaClosesAt: preview.newQaClosesAt,
      sessionLifecycleRevision: 3,
      serverNow: preview.serverNow,
    });
    const { component } = configureTestBed();
    await component.confirm();

    expect(previewMock).toHaveBeenCalledWith({
      code: 'ABC123',
      mode: 'INITIAL',
      selection: { kind: 'UNTIL_SESSION_END' },
    });
    expect(previewMock).toHaveBeenCalledWith({
      code: 'ABC123',
      mode: 'REPLAN',
      selection: { kind: 'UNTIL_SESSION_END' },
    });
    expect(component.error()).toBeNull();
  });

  it('sperrt ein während des Dialogs belegtes Profil und richtet Q&A ohne Profiländerung ein', async () => {
    previewMock.mockResolvedValue(preview);
    lifecycleMock.mockResolvedValue({
      firstParticipantJoinedAt: '2026-09-15T07:05:00.000Z',
    });
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
    const { fixture, component, close } = configureTestBed();

    await component.confirm();
    fixture.detectChanges();

    expect(component.profileLocked()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain(
      'Diese Einstellungen können nach dem ersten Beitritt nicht mehr geändert werden.',
    );
    expect(configureMock).toHaveBeenCalledWith(
      expect.objectContaining({ participationProfile: undefined }),
    );
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ preferredChannel: 'qa' }));
  });

  it('wiederholt die Fristkonfiguration ohne Profil, wenn der erste Beitritt mit der Mutation konkurriert', async () => {
    previewMock.mockResolvedValue(preview);
    lifecycleMock
      .mockResolvedValueOnce({ firstParticipantJoinedAt: null })
      .mockResolvedValueOnce({ firstParticipantJoinedAt: '2026-09-15T07:05:00.000Z' });
    const configured = {
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
    };
    configureMock
      .mockRejectedValueOnce(new Error('Profil wurde durch ersten Beitritt gesperrt'))
      .mockResolvedValueOnce(configured);
    const { component, close } = configureTestBed();

    await component.confirm();

    expect(configureMock).toHaveBeenCalledTimes(2);
    expect(configureMock.mock.calls[0]?.[0].participationProfile).toEqual({
      identityMode: 'CUSTOM_NICKNAME',
      nicknameTheme: 'HIGH_SCHOOL',
    });
    expect(configureMock.mock.calls[1]?.[0].participationProfile).toBeUndefined();
    expect(close).toHaveBeenCalledWith(configured);
  });
});

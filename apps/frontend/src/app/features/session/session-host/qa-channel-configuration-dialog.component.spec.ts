import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
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
  setup?: { setupStep: number; setupStepCount: number; omitParticipationProfile?: boolean },
  extensionConfirmed = true,
  sessionOverride = session,
) {
  const close = vi.fn();
  const dialogOpen = vi.fn().mockReturnValue({
    afterClosed: () => of(extensionConfirmed),
  });
  TestBed.configureTestingModule({
    imports: [QaChannelConfigurationDialogComponent],
    providers: [
      {
        provide: MAT_DIALOG_DATA,
        useValue: { code: 'ABC123', session: sessionOverride, profileLocked, ...setup },
      },
      { provide: MatDialogRef, useValue: { close } },
      { provide: MatDialog, useValue: { open: dialogOpen } },
    ],
  });
  const fixture = TestBed.createComponent(QaChannelConfigurationDialogComponent);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, close, dialogOpen };
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
    expect(fixture.nativeElement.textContent).toContain('Teilnahmeprofil');
  });

  it('blendet das Teilnahmeprofil in Schritt 2 der Anlage aus und sendet es nicht erneut', async () => {
    configureMock.mockResolvedValue({
      channels: session.channels,
      preferredChannel: 'qa',
      expiresAt: matchingSessionPreview.newExpiresAt,
      qaClosesAt: matchingSessionPreview.newQaClosesAt,
      sessionLifecycleRevision: 3,
      serverNow: matchingSessionPreview.serverNow,
    });
    const { fixture, component } = configureTestBed(false, {
      setupStep: 2,
      setupStepCount: 3,
      omitParticipationProfile: true,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Schritt 2 von 3');
    expect(fixture.nativeElement.textContent).not.toContain('Teilnahmeprofil');
    expect(fixture.nativeElement.textContent).not.toContain('Sichtbarer Name');

    await component.confirm();

    expect(configureMock).toHaveBeenCalledWith(
      expect.objectContaining({ participationProfile: undefined }),
    );
  });

  it('fragt das Teilnahmeprofil beim späteren Aktivieren weiterhin ab', async () => {
    const { fixture } = configureTestBed(false, { setupStep: 1, setupStepCount: 2 });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Schritt 1 von 2');
    expect(fixture.nativeElement.textContent).toContain('Teilnahmeprofil');
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
      reopenQa: false,
    });
    expect(fixture.nativeElement.textContent).toContain('Offen für Fragen und Bewertungen bis');
    expect(fixture.nativeElement.textContent).toContain('Session endet');
    expect(fixture.nativeElement.textContent).toContain(
      'Beim Bestätigen wird die globale Sessionfrist mit verlängert',
    );
    expect(fixture.nativeElement.textContent).toContain('Bisheriges Sessionende');
    expect(fixture.nativeElement.textContent).toContain('Neues Sessionende');
    expect(fixture.nativeElement.textContent).toContain('Host-Lesezugriff bis');
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
    const { component, close, dialogOpen } = configureTestBed();
    component.deadlineKind = 'DURATION_DAYS';
    component.days = 1;
    component.identityMode = 'PRESET_PSEUDONYM';
    component.qaTitle = 'Prüfungsfragen';

    await component.onDeadlineChange();
    await component.confirm();

    expect(dialogOpen).toHaveBeenCalled();
    expect(configureMock).toHaveBeenCalledWith({
      code: 'ABC123',
      mode: 'INITIAL',
      selection: { kind: 'DURATION_DAYS', days: 1 },
      expectedLifecycleRevision: 2,
      previewServerNow: preview.serverNow,
      confirmedQaClosesAt: preview.newQaClosesAt,
      confirmedExpiresAt: preview.newExpiresAt,
      confirmSessionExtension: true,
      reopenQa: false,
      qaTitle: 'Prüfungsfragen',
      moderationMode: true,
      participationProfile: {
        identityMode: 'PRESET_PSEUDONYM',
        nicknameTheme: 'HIGH_SCHOOL',
      },
    });
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ preferredChannel: 'qa' }));
  });

  it('mutiert ohne Bestätigungsdialog, wenn keine Sessionverlängerung nötig ist', async () => {
    previewMock.mockResolvedValue(matchingSessionPreview);
    configureMock.mockResolvedValue({
      channels: session.channels,
      preferredChannel: 'qa',
      expiresAt: matchingSessionPreview.newExpiresAt,
      qaClosesAt: matchingSessionPreview.newQaClosesAt,
      sessionLifecycleRevision: 3,
      serverNow: matchingSessionPreview.serverNow,
    });
    const { component, dialogOpen } = configureTestBed();

    await component.confirm();

    expect(dialogOpen).not.toHaveBeenCalled();
    expect(configureMock).toHaveBeenCalledWith(
      expect.objectContaining({ confirmSessionExtension: false }),
    );
  });

  it('nutzt die neu geladene Vorschau nicht still als Zustimmung zur Verlängerung', async () => {
    previewMock.mockResolvedValue(preview);
    const { component, close, dialogOpen } = configureTestBed(false, undefined, false);

    await component.confirm();

    expect(dialogOpen).toHaveBeenCalled();
    expect(configureMock).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
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
      reopenQa: false,
    });
    expect(previewMock).toHaveBeenCalledWith({
      code: 'ABC123',
      mode: 'REPLAN',
      selection: { kind: 'UNTIL_SESSION_END' },
      reopenQa: false,
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

  it('übernimmt gespeicherte Q&A-Werte und ändert bei reinem Titel keine Frist, Moderation oder Öffnung', async () => {
    const closedSession = {
      ...session,
      qaClosesAt: '2026-09-16T04:00:00.000Z',
      expiresAt: '2026-09-16T06:00:00.000Z',
      channels: {
        ...session.channels,
        qa: {
          enabled: true,
          open: false,
          closesAt: '2026-09-16T04:00:00.000Z',
          state: 'MANUALLY_CLOSED' as const,
          title: 'Alte Fragenwand',
          moderationMode: false,
        },
      },
    };
    previewMock.mockResolvedValue({
      ...matchingSessionPreview,
      mode: 'REPLAN' as const,
      oldQaClosesAt: '2026-09-16T04:00:00.000Z',
      newQaClosesAt: '2026-09-16T04:00:00.000Z',
      newExpiresAt: closedSession.expiresAt,
    });
    configureMock.mockResolvedValue({
      channels: closedSession.channels,
      preferredChannel: 'qa',
      expiresAt: closedSession.expiresAt,
      qaClosesAt: '2026-09-16T04:00:00.000Z',
      sessionLifecycleRevision: 3,
      serverNow: preview.serverNow,
    });
    const { fixture, component } = configureTestBed(false, undefined, true, closedSession);
    fixture.detectChanges();

    expect(component.qaTitle).toBe('Alte Fragenwand');
    expect(component.moderationMode).toBe(false);
    expect(component.deadlineKind).toBe('ABSOLUTE');
    expect(component.canReopen).toBe(true);
    expect(component.reopenQa).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Fragerunde bearbeiten');
    expect(fixture.nativeElement.textContent).toContain('Änderungen speichern');

    component.qaTitle = 'Nur Titel';
    await component.confirm();

    expect(configureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'REPLAN',
        selection: {
          kind: 'ABSOLUTE',
          closesAt: '2026-09-16T04:00:00.000Z',
        },
        reopenQa: false,
        moderationMode: false,
        qaTitle: 'Nur Titel',
      }),
    );
  });

  it('sendet ein ausdrückliches Wiederöffnen nur nach Bestätigung der Aktion', async () => {
    const closedSession = {
      ...session,
      qaClosesAt: '2026-09-16T04:00:00.000Z',
      channels: {
        ...session.channels,
        qa: {
          enabled: true,
          open: false,
          closesAt: '2026-09-16T04:00:00.000Z',
          state: 'MANUALLY_CLOSED' as const,
          title: 'Alte Fragenwand',
          moderationMode: false,
        },
      },
    };
    previewMock.mockResolvedValue({
      ...matchingSessionPreview,
      mode: 'REPLAN' as const,
      oldQaClosesAt: '2026-09-16T04:00:00.000Z',
      newQaClosesAt: '2026-09-16T04:00:00.000Z',
    });
    configureMock.mockResolvedValue({
      channels: { ...closedSession.channels, qa: { ...closedSession.channels.qa, open: true } },
      preferredChannel: 'qa',
      expiresAt: closedSession.expiresAt,
      qaClosesAt: '2026-09-16T04:00:00.000Z',
      sessionLifecycleRevision: 3,
      serverNow: preview.serverNow,
    });
    const { component } = configureTestBed(false, undefined, true, closedSession);
    component.reopenQa = true;

    expect(component.confirmLabel()).toContain('wieder öffnen');
    await component.confirm();

    expect(configureMock).toHaveBeenCalledWith(expect.objectContaining({ reopenQa: true }));
  });

  it('fordert zum Wiederöffnen einer abgelaufenen Frist eine neue Frist', async () => {
    const expiredSession = {
      ...session,
      serverNow: '2026-09-15T07:00:00.000Z',
      qaClosesAt: '2026-09-15T06:30:00.123Z',
      expiresAt: '2026-09-16T06:00:00.000Z',
      channels: {
        ...session.channels,
        qa: {
          enabled: true,
          open: false,
          closesAt: '2026-09-15T06:30:00.123Z',
          state: 'DEADLINE_EXPIRED' as const,
          title: 'Alte Fragenwand',
          moderationMode: false,
        },
      },
    };
    const { component } = configureTestBed(false, undefined, true, expiredSession);
    component.reopenQa = true;
    await component.confirm();

    expect(configureMock).not.toHaveBeenCalled();
    expect(component.error()).toContain('Teilnahmefrist in der Zukunft');
  });

  it('bewahrt Sekunden und Millisekunden einer unveränderten Frist', async () => {
    const preciseClosesAt = '2026-09-16T04:00:12.345Z';
    const closedSession = {
      ...session,
      qaClosesAt: preciseClosesAt,
      expiresAt: '2026-09-16T06:00:00.000Z',
      channels: {
        ...session.channels,
        qa: {
          enabled: true,
          open: false,
          closesAt: preciseClosesAt,
          state: 'MANUALLY_CLOSED' as const,
          title: 'Alte Fragenwand',
          moderationMode: false,
        },
      },
    };
    previewMock.mockResolvedValue({
      ...matchingSessionPreview,
      mode: 'REPLAN' as const,
      oldQaClosesAt: preciseClosesAt,
      newQaClosesAt: preciseClosesAt,
      newExpiresAt: closedSession.expiresAt,
    });
    configureMock.mockResolvedValue({
      channels: closedSession.channels,
      preferredChannel: 'qa',
      expiresAt: closedSession.expiresAt,
      qaClosesAt: preciseClosesAt,
      sessionLifecycleRevision: 3,
      serverNow: preview.serverNow,
    });
    const { component } = configureTestBed(false, undefined, true, closedSession);
    component.qaTitle = 'Nur Titel';
    await component.confirm();

    expect(configureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        selection: { kind: 'ABSOLUTE', closesAt: preciseClosesAt },
        reopenQa: false,
      }),
    );
  });

  it('speichert eine unveränderte Frist in der doppelten Stunde ohne Datumsfehler', async () => {
    const foldClosesAt = '2026-10-25T00:30:00.000Z';
    const foldSession = {
      ...session,
      timeZone: 'Europe/Berlin',
      qaClosesAt: foldClosesAt,
      expiresAt: '2026-10-26T10:00:00.000Z',
      channels: {
        ...session.channels,
        qa: {
          enabled: true,
          open: true,
          closesAt: foldClosesAt,
          state: 'OPEN' as const,
          title: 'Herbst',
          moderationMode: true,
        },
      },
    };
    previewMock.mockResolvedValue({
      ...matchingSessionPreview,
      mode: 'REPLAN' as const,
      oldQaClosesAt: foldClosesAt,
      newQaClosesAt: foldClosesAt,
      oldExpiresAt: foldSession.expiresAt,
      newExpiresAt: foldSession.expiresAt,
      requiresSessionExtension: false,
    });
    configureMock.mockResolvedValue({
      channels: foldSession.channels,
      preferredChannel: 'qa',
      expiresAt: foldSession.expiresAt,
      qaClosesAt: foldClosesAt,
      sessionLifecycleRevision: 3,
      serverNow: preview.serverNow,
    });
    const { component } = configureTestBed(false, undefined, true, foldSession);
    component.qaTitle = 'Neuer Titel';
    await component.confirm();

    expect(component.error()).toBeNull();
    expect(configureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        selection: { kind: 'ABSOLUTE', closesAt: foldClosesAt },
      }),
    );
  });

  it('lehnt eine geänderte mehrdeutige Ortszeit weiter ab', async () => {
    const foldSession = {
      ...session,
      timeZone: 'Europe/Berlin',
      qaClosesAt: '2026-10-25T00:30:00.000Z',
      expiresAt: '2026-10-26T10:00:00.000Z',
      channels: {
        ...session.channels,
        qa: {
          enabled: true,
          open: true,
          closesAt: '2026-10-25T00:30:00.000Z',
          state: 'OPEN' as const,
          title: 'Herbst',
          moderationMode: true,
        },
      },
    };
    const { component } = configureTestBed(false, undefined, true, foldSession);
    component.deadlineKind = 'ABSOLUTE';
    component.absoluteLocal = '2026-10-25T02:45';
    await component.confirm();

    expect(configureMock).not.toHaveBeenCalled();
    expect(component.error()).toContain('nicht eindeutig');
  });

  it('beschreibt eine Verlängerung ohne Wiederöffnen als Speichern', async () => {
    const closedSession = {
      ...session,
      qaClosesAt: '2026-09-16T04:00:00.000Z',
      expiresAt: '2026-09-16T06:00:00.000Z',
      channels: {
        ...session.channels,
        qa: {
          enabled: true,
          open: false,
          closesAt: '2026-09-16T04:00:00.000Z',
          state: 'MANUALLY_CLOSED' as const,
          title: 'Alte Fragenwand',
          moderationMode: false,
        },
      },
    };
    const extensionPreview = {
      ...preview,
      mode: 'REPLAN' as const,
      oldQaClosesAt: '2026-09-16T04:00:00.000Z',
      newQaClosesAt: '2026-09-16T08:00:00.000Z',
      oldExpiresAt: closedSession.expiresAt,
      newExpiresAt: '2026-09-16T08:00:00.000Z',
      requiresSessionExtension: true,
    };
    previewMock.mockResolvedValue(extensionPreview);
    configureMock.mockResolvedValue({
      channels: closedSession.channels,
      preferredChannel: 'qa',
      expiresAt: extensionPreview.newExpiresAt,
      qaClosesAt: extensionPreview.newQaClosesAt,
      sessionLifecycleRevision: 3,
      serverNow: extensionPreview.serverNow,
    });
    const { component, dialogOpen } = configureTestBed(false, undefined, true, closedSession);
    component.deadlineKind = 'ABSOLUTE';
    component.absoluteLocal = '2026-09-16T10:00';
    component.reopenQa = false;
    await component.onDeadlineChange();

    expect(component.confirmLabel()).toBe('Session verlängern und Änderungen speichern');
    await component.confirm();

    expect(dialogOpen).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          confirmLabel: 'Session verlängern und Änderungen speichern',
          message: expect.stringContaining('neue Teilnahmefrist'),
        }),
      }),
    );
    expect(dialogOpen.mock.calls[0]?.[1].data.message).not.toContain('Die Fragerunde läuft');
    expect(configureMock).toHaveBeenCalledWith(expect.objectContaining({ reopenQa: false }));
  });
});

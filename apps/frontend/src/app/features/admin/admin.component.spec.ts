import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminSessionDetailDTO } from '@arsnova/shared-types';
import { trpc } from '../../core/trpc.client';
import { AdminComponent } from './admin.component';

vi.mock('../../core/trpc.client', () => ({
  getAdminToken: vi.fn().mockReturnValue(null),
  setAdminToken: vi.fn(),
  trpc: {
    admin: {
      whoami: { query: vi.fn().mockRejectedValue(new Error('unauthorized')) },
      listSessions: { query: vi.fn().mockResolvedValue({ sessions: [], total: 0 }) },
      getSessionByCode: { query: vi.fn() },
      getSessionDetail: { query: vi.fn() },
      resetSessionHostAccess: { mutate: vi.fn() },
      logout: { mutate: vi.fn().mockResolvedValue({ authenticated: true }) },
    },
  },
}));

const sessionA = '11111111-1111-4111-8111-111111111111';
const sessionB = '22222222-2222-4222-8222-222222222222';

function detailFor(
  sessionId: string,
  sessionCode: string,
  supportId: string | null = 'ARS-ABCD-2345',
): AdminSessionDetailDTO {
  return {
    session: {
      sessionId,
      sessionCode,
      type: 'Q_AND_A',
      status: 'ACTIVE',
      quizName: null,
      participantCount: 3,
      startedAt: '2026-09-18T10:00:00.000Z',
      endedAt: null,
      lastActivityAt: '2026-09-18T10:05:00.000Z',
      retention: { window: 'RUNNING' },
    },
    supportId,
    title: 'Seminar',
  };
}

function resetOutput(sessionId: string, sessionCode: string) {
  return {
    sessionId,
    code: sessionCode,
    supportId: 'ARS-ABCD-2345',
    handoffCapability: `handoff-${sessionCode}`,
    expiresAt: '2026-09-18T10:20:00.000Z',
    revokedCredentialVersion: 1,
  };
}

function createComponent(): AdminComponent {
  TestBed.configureTestingModule({
    imports: [AdminComponent],
    providers: [provideRouter([])],
  });
  return TestBed.createComponent(AdminComponent).componentInstance;
}

function fillValidReset(component: AdminComponent, detail: AdminSessionDetailDTO): void {
  component.selectedSessionId.set(detail.session.sessionId);
  component.selectedDetail.set(detail);
  component.updateHostResetEvidenceCategory('PREEXISTING_VERIFIED_SUPPORT_CASE');
  component.updateHostResetField('requester', 'Ticket 12 dokumentiert');
  component.updateHostResetField('authorization', 'Sessionbezug im Ticket 12');
  component.updateHostResetField('supportCase', 'CASE-405-001');
  component.updateHostResetField('reason', 'Beide Zugangsmittel wurden nachgewiesen verloren.');
}

describe('AdminComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  it('rendert Quiz-Markdown mit Lightbox-Attributen und absolutisierten Asset-URLs', () => {
    const previousBaseHref = document.querySelector('base')?.getAttribute('href') ?? null;
    let baseEl = document.querySelector('base');
    if (!baseEl) {
      baseEl = document.createElement('base');
      document.head.appendChild(baseEl);
    }
    baseEl.setAttribute('href', '/de/');

    try {
      const component = createComponent();
      const html = String(
        (
          component.renderQuizRichText('![Demo](/assets/demo/example.png)') as unknown as {
            changingThisBreaksApplicationSecurity?: string;
          }
        ).changingThisBreaksApplicationSecurity ?? '',
      );

      expect(html).toMatch(/data-markdown-image-lightbox="true"/);
      expect(html).toMatch(/data-markdown-image-state="loading"/);
      expect(html).toContain('/de/assets/demo/example.png');
    } finally {
      if (previousBaseHref === null) {
        baseEl.removeAttribute('href');
      } else {
        baseEl.setAttribute('href', previousBaseHref);
      }
    }
  });

  it('liefert für denselben Text und Heading-Level dieselbe SafeHtml-Referenz', () => {
    const component = createComponent();
    const first = component.renderQuizRichText('![Demo](https://example.org/a.png)');
    const second = component.renderQuizRichText('![Demo](https://example.org/a.png)');
    const differentLevel = component.renderQuizRichText('![Demo](https://example.org/a.png)', 4);

    expect(second).toBe(first);
    expect(differentLevel).not.toBe(first);
  });

  it('hält Tab-, Button- und Markdown-Overrides ohne Piercing-Selektoren', () => {
    const styles = readFileSync(
      resolve(process.cwd(), 'src/app/features/admin/admin.component.scss'),
      'utf8',
    );

    expect(styles).not.toContain('::ng-deep');
    expect(styles).not.toContain(':deep(');
    expect(styles).toMatch(/\.admin-tabs \.mat-mdc-tab-body-content\s*\{/);
    expect(styles).toMatch(/\.admin-card \.mdc-button__label\s*\{/);
    expect(styles).toMatch(/\.admin-question__text\.markdown-body p\s*\{/);
    expect(styles).toMatch(/\.admin-answer-text\.markdown-body p\s*\{/);
  });

  it('kürzt eine Session-Kennung nicht still auf sechs Zeichen', () => {
    const component = createComponent();
    component.updateLookupCode('ARS-ABCD-2345');
    expect(component.lookupCode()).toBe('ARS-ABCD-2345');
    expect(component.canLookupSession()).toBe(true);
  });

  it('sucht dieselbe Session über Sessioncode oder vollständige Session-Kennung', async () => {
    const component = createComponent();
    const detail = detailFor(sessionA, 'ABC123');
    vi.mocked(trpc.admin.getSessionByCode.query).mockResolvedValue(detail);

    component.updateLookupCode('ABC123');
    await component.lookupByCode();
    expect(trpc.admin.getSessionByCode.query).toHaveBeenCalledWith({ code: 'ABC123' });

    component.updateLookupCode('ARS-ABCD-2345');
    await component.lookupByCode();
    expect(trpc.admin.getSessionByCode.query).toHaveBeenCalledWith({
      supportId: 'ARS-ABCD-2345',
    });
  });

  it('sendet eine ungültige Kennung nicht als anderen Sessioncode', async () => {
    const component = createComponent();
    component.updateLookupCode('ARSABCX');
    await component.lookupByCode();
    expect(trpc.admin.getSessionByCode.query).not.toHaveBeenCalled();
    expect(component.lookupError()).toContain('keine gültige Session-Kennung');
  });

  it('bindet ein verspätetes Reset-Ergebnis an Session A und zeigt es nicht unter B', async () => {
    const component = createComponent();
    const detailA = detailFor(sessionA, 'AAAAAA', 'ARS-AAAA-2345');
    const detailB = detailFor(sessionB, 'BBBBBB', 'ARS-BBBB-2345');
    let resolveReset!: (value: ReturnType<typeof resetOutput>) => void;
    vi.mocked(trpc.admin.resetSessionHostAccess.mutate).mockReturnValue(
      new Promise((resolve) => {
        resolveReset = resolve;
      }),
    );

    fillValidReset(component, detailA);
    const pending = component.resetHostAccess();
    component.selectedSessionId.set(sessionB);
    component.selectedDetail.set(detailB);
    resolveReset(resetOutput(sessionA, 'AAAAAA'));
    await pending;

    expect(component.hostResetResultFor(sessionB)).toBeNull();
    expect(component.hostResetResultFor(sessionA)?.code).toBe('AAAAAA');
    expect(component.hostResetDraftFor(sessionB).evidenceCategory).toBe('');
  });

  it('verwirft eine verspätete Reset-Antwort nach Logout', async () => {
    const component = createComponent();
    const detailA = detailFor(sessionA, 'AAAAAA');
    let resolveReset!: (value: ReturnType<typeof resetOutput>) => void;
    vi.mocked(trpc.admin.resetSessionHostAccess.mutate).mockReturnValue(
      new Promise((resolve) => {
        resolveReset = resolve;
      }),
    );

    fillValidReset(component, detailA);
    const pending = component.resetHostAccess();
    await component.logout();
    resolveReset(resetOutput(sessionA, 'AAAAAA'));
    await pending;

    expect(component.authenticated()).toBe(false);
    expect(component.hostResetResultFor(sessionA)).toBeNull();
  });

  it('wiederholt dieselbe Operation nach verlorener Antwort und widerruft nach Erfolg nicht erneut', async () => {
    const component = createComponent();
    const detailA = detailFor(sessionA, 'AAAAAA');
    fillValidReset(component, detailA);
    const operationId = component.hostResetDraftFor(sessionA).operationId;
    vi.mocked(trpc.admin.resetSessionHostAccess.mutate)
      .mockRejectedValueOnce(new Error('failed to fetch'))
      .mockResolvedValueOnce(resetOutput(sessionA, 'AAAAAA'));

    await component.resetHostAccess();
    expect(component.hostResetDraftFor(sessionA).unconfirmed).toBe(true);
    expect(component.hostResetDraftFor(sessionA).error).toContain(
      'Die Serverantwort ist ausgeblieben',
    );

    await component.resetHostAccess();
    expect(trpc.admin.resetSessionHostAccess.mutate).toHaveBeenCalledTimes(2);
    expect(vi.mocked(trpc.admin.resetSessionHostAccess.mutate).mock.calls[0]?.[0]).toMatchObject({
      operationId,
    });
    expect(vi.mocked(trpc.admin.resetSessionHostAccess.mutate).mock.calls[1]?.[0]).toMatchObject({
      operationId,
    });

    await component.resetHostAccess();
    expect(trpc.admin.resetSessionHostAccess.mutate).toHaveBeenCalledTimes(2);
  });

  it('setzt die Nachweiskategorie bei einem neuen Vorgang zurück', () => {
    const component = createComponent();
    fillValidReset(component, detailFor(sessionA, 'AAAAAA'));
    component.startReplacementHostReset(sessionA);
    expect(component.hostResetDraftFor(sessionA).evidenceCategory).toBe('');
    expect(component.hostResetDraftFor(sessionA).confirmNewReset).toBe(true);
    expect(component.canResetHostAccess(sessionA)).toBe(false);
  });
});

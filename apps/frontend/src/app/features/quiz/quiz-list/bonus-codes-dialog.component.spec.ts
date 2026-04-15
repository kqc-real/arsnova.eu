import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BonusCodesDialogComponent } from './bonus-codes-dialog.component';

const { getBonusTokensQueryMock, verifyBonusTokenQueryMock } = vi.hoisted(() => ({
  getBonusTokensQueryMock: vi.fn(),
  verifyBonusTokenQueryMock: vi.fn(),
}));

vi.mock('../../../core/trpc.client', () => ({
  trpc: {
    session: {
      getBonusTokensForQuiz: {
        query: getBonusTokensQueryMock,
      },
      verifyBonusTokenForQuiz: {
        query: verifyBonusTokenQueryMock,
      },
    },
  },
}));

describe('BonusCodesDialogComponent', () => {
  const matDialogRefMock = {
    close: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getBonusTokensQueryMock.mockResolvedValue({ sessions: [] });
    verifyBonusTokenQueryMock.mockResolvedValue({ valid: false });

    TestBed.configureTestingModule({
      imports: [BonusCodesDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            serverQuizId: '11111111-1111-4111-8111-111111111111',
            accessProof: 'proof',
            quizName: 'Chemie 101',
          },
        },
        {
          provide: MatDialogRef,
          useValue: matDialogRefMock,
        },
      ],
    });
  });

  it('laedt Bonus-Code-Sessions beim Start', async () => {
    getBonusTokensQueryMock.mockResolvedValue({
      sessions: [
        {
          sessionCode: 'ABCDEF',
          quizName: 'Chemie 101',
          endedAt: '2026-04-15T11:00:00.000Z',
          tokens: [],
        },
      ],
    });
    const fixture = TestBed.createComponent(BonusCodesDialogComponent);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(getBonusTokensQueryMock).toHaveBeenCalledWith({
      quizId: '11111111-1111-4111-8111-111111111111',
      accessProof: 'proof',
    });
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.componentInstance.loadError()).toBe(false);
    expect(fixture.componentInstance.sessions()).toHaveLength(1);
  });

  it('setzt Load-Error wenn Initial-Laden fehlschlaegt', async () => {
    getBonusTokensQueryMock.mockRejectedValue(new Error('boom'));
    const fixture = TestBed.createComponent(BonusCodesDialogComponent);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.componentInstance.loadError()).toBe(true);
  });

  it('normalisiert den Verify-Code und loescht altes Ergebnis', () => {
    const fixture = TestBed.createComponent(BonusCodesDialogComponent);
    const component = fixture.componentInstance;

    component.verifyResult.set({ valid: false });
    component.verifyError.set(true);
    component.updateVerifyCode('  bns-a#1  ');

    expect(component.verifyCode()).toBe('BNS-A1');
    expect(component.verifyResult()).toBeNull();
    expect(component.verifyError()).toBe(false);
  });

  it('prueft Bonus-Code serverseitig und zeigt gueltiges Ergebnis', async () => {
    verifyBonusTokenQueryMock.mockResolvedValue({
      valid: true,
      sessionCode: 'ABCDEF',
      nickname: 'Ada',
      rank: 1,
      totalScore: 42,
    });
    const fixture = TestBed.createComponent(BonusCodesDialogComponent);
    const component = fixture.componentInstance;

    component.updateVerifyCode('bns-test-1234');
    await component.verifyBonusCode();

    expect(verifyBonusTokenQueryMock).toHaveBeenCalledWith({
      quizId: '11111111-1111-4111-8111-111111111111',
      accessProof: 'proof',
      bonusCode: 'BNS-TEST-1234',
    });
    expect(component.verifyResult()).toEqual({
      valid: true,
      sessionCode: 'ABCDEF',
      nickname: 'Ada',
      rank: 1,
      totalScore: 42,
    });
    expect(component.verifyError()).toBe(false);
    expect(component.verifyLoading()).toBe(false);
  });

  it('zeigt Verify-Fehlerstatus bei Serverfehler', async () => {
    verifyBonusTokenQueryMock.mockRejectedValue(new Error('network'));
    const fixture = TestBed.createComponent(BonusCodesDialogComponent);
    const component = fixture.componentInstance;

    component.updateVerifyCode('BNS-TEST-1234');
    await component.verifyBonusCode();

    expect(component.verifyError()).toBe(true);
    expect(component.verifyLoading()).toBe(false);
    expect(component.verifyResult()).toBeNull();
  });

  it('zeigt einen Ladeindikator waehrend der serverseitigen Pruefung', async () => {
    let resolveVerify: (value: { valid: false }) => void = () => undefined;
    verifyBonusTokenQueryMock.mockReturnValue(
      new Promise<{ valid: false }>((resolve) => {
        resolveVerify = resolve;
      }),
    );
    const fixture = TestBed.createComponent(BonusCodesDialogComponent);
    const component = fixture.componentInstance;

    component.updateVerifyCode('BNS-TEST-1234');
    const pendingVerification = component.verifyBonusCode();
    fixture.detectChanges();

    expect(component.verifyLoading()).toBe(true);
    expect(fixture.nativeElement.querySelector('.bonus-codes-dialog__verify-spinner')).toBeTruthy();

    resolveVerify({ valid: false });
    await pendingVerification;
    fixture.detectChanges();

    expect(component.verifyLoading()).toBe(false);
    expect(fixture.nativeElement.querySelector('.bonus-codes-dialog__verify-spinner')).toBeFalsy();
  });

  it('exportiert Bonus-Codes als CSV', () => {
    const fixture = TestBed.createComponent(BonusCodesDialogComponent);
    const component = fixture.componentInstance;
    component.sessions.set([
      {
        sessionCode: 'ABCDEF',
        quizName: 'Chemie 101',
        endedAt: null,
        tokens: [
          {
            token: 'BNS-TEST-1234',
            nickname: 'Ada',
            quizName: 'Chemie 101',
            totalScore: 42,
            rank: 1,
            generatedAt: '2026-04-15T11:05:00.000Z',
          },
        ],
      },
    ]);
    const originalCreateElement = document.createElement.bind(document);
    const anchor = originalCreateElement('a');
    const clickSpy = vi.spyOn(anchor, 'click').mockImplementation(() => undefined);
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation(((tagName: string) =>
        tagName.toLowerCase() === 'a'
          ? anchor
          : originalCreateElement(tagName)) as typeof document.createElement);
    const urlCreateSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:bonus');
    const urlRevokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    component.exportAllCsv();

    expect(urlCreateSpy).toHaveBeenCalledTimes(1);
    expect(anchor.download).toContain('bonus-codes-Chemie-101.csv');
    expect(anchor.href).toContain('blob:bonus');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(urlRevokeSpy).toHaveBeenCalledWith('blob:bonus');
    createElementSpy.mockRestore();
    urlCreateSpy.mockRestore();
    urlRevokeSpy.mockRestore();
    clickSpy.mockRestore();
  });
});

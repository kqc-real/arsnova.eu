import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import {
  UpdateBannerSuppressionService,
  participantDraftBlocksUpdateBanner,
  qaTitleDraftBlocksUpdateBanner,
} from './update-banner-suppression.service';

describe('UpdateBannerSuppressionService', () => {
  it('blendet nur aus, solange mindestens ein Grund gesetzt ist', () => {
    const service = TestBed.inject(UpdateBannerSuppressionService);

    expect(service.active()).toBe(false);

    service.set('quiz-edit', true);
    service.set('quiz-edit', true);
    expect(service.active()).toBe(true);

    service.set('participant-draft', true);
    service.set('quiz-edit', false);
    expect(service.active()).toBe(true);

    service.set('participant-draft', false);
    expect(service.active()).toBe(false);
  });
});

describe('participantDraftBlocksUpdateBanner', () => {
  const empty = {
    voteSent: false,
    selectedAnswerCount: 0,
    freeText: '',
    numericInput: '',
    ratingValue: null,
    confidenceValue: null,
    qaDraft: '',
  };

  it('blockt flüchtige Antworten und eine angefangene Q&A-Frage', () => {
    expect(participantDraftBlocksUpdateBanner({ ...empty, selectedAnswerCount: 1 })).toBe(true);
    expect(participantDraftBlocksUpdateBanner({ ...empty, freeText: 'Entwurf' })).toBe(true);
    expect(participantDraftBlocksUpdateBanner({ ...empty, numericInput: '-' })).toBe(true);
    expect(participantDraftBlocksUpdateBanner({ ...empty, ratingValue: 0 })).toBe(true);
    expect(participantDraftBlocksUpdateBanner({ ...empty, confidenceValue: 3 })).toBe(true);
    expect(participantDraftBlocksUpdateBanner({ ...empty, qaDraft: 'Frage' })).toBe(true);
    expect(participantDraftBlocksUpdateBanner({ ...empty, qaDraft: '   ' })).toBe(false);
  });

  it('lässt gespeicherte Strukturentwürfe und bereits gesendete Antworten durch', () => {
    expect(participantDraftBlocksUpdateBanner(empty)).toBe(false);
    expect(
      participantDraftBlocksUpdateBanner({
        ...empty,
        voteSent: true,
        selectedAnswerCount: 1,
        freeText: 'schon gesendet',
      }),
    ).toBe(false);
    expect(
      participantDraftBlocksUpdateBanner({
        ...empty,
        voteSent: true,
        qaDraft: 'noch offen',
      }),
    ).toBe(true);
  });
});

describe('qaTitleDraftBlocksUpdateBanner', () => {
  it('blockt nur einen abweichenden Entwurf oder einen laufenden Speichervorgang', () => {
    expect(
      qaTitleDraftBlocksUpdateBanner({
        editing: true,
        saving: false,
        draft: 'Neu',
        serverTitle: 'Alt',
      }),
    ).toBe(true);
    expect(
      qaTitleDraftBlocksUpdateBanner({
        editing: false,
        saving: true,
        draft: 'Alt',
        serverTitle: 'Alt',
      }),
    ).toBe(true);
    expect(
      qaTitleDraftBlocksUpdateBanner({
        editing: true,
        saving: false,
        draft: '  Alt ',
        serverTitle: 'Alt',
      }),
    ).toBe(false);
    expect(
      qaTitleDraftBlocksUpdateBanner({
        editing: false,
        saving: false,
        draft: 'Neu',
        serverTitle: 'Alt',
      }),
    ).toBe(false);
  });
});

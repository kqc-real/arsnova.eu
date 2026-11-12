import { describe, expect, it, vi } from 'vitest';
import { FreetextWordCloudVisibilityState } from './freetext-word-cloud-visibility';

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock('../../core/trpc.client', () => ({
  trpc: { session: { setFreetextWordCloudEntryVisibility: { mutate } } },
}));

describe('FreetextWordCloudVisibilityState', () => {
  it('behält eine bestätigte Änderung, wenn ein älterer Poll erst danach eintrifft', async () => {
    const questionId = '11111111-1111-4111-8111-111111111111';
    const initial = { questionId, hiddenLabels: [] };
    const hidden = { questionId, hiddenLabels: ['Orbit'] };
    const state = new FreetextWordCloudVisibilityState();
    state.applyRead(state.beginRead(), initial);
    const lateRead = state.beginRead();

    mutate.mockResolvedValueOnce(hidden);
    await state.update('ABC123', questionId, 'Orbit', true);
    state.applyRead(lateRead, initial);
    expect(state.snapshot()).toEqual(hidden);

    state.applyRead(state.beginRead(), initial);
    expect(state.snapshot()).toEqual(initial);
  });
});

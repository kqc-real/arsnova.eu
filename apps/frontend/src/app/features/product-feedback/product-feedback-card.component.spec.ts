import { describe, expect, it } from 'vitest';
import { resolveProductFeedbackAreaPromptKind } from '@arsnova/shared-types';

describe('ProductFeedbackCard branching helpers', () => {
  it('mappt positive Antworten auf strength und Reibung auf hurdle', () => {
    expect(resolveProductFeedbackAreaPromptKind('EASY')).toBe('strength');
    expect(resolveProductFeedbackAreaPromptKind('YES')).toBe('strength');
    expect(resolveProductFeedbackAreaPromptKind('HARD')).toBe('hurdle');
    expect(resolveProductFeedbackAreaPromptKind('PARTIAL')).toBe('hurdle');
    expect(resolveProductFeedbackAreaPromptKind('NO')).toBe('hurdle');
    expect(resolveProductFeedbackAreaPromptKind('MINOR_FRICTION')).toBe('hurdle');
  });
});

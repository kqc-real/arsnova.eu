import { describe, expect, it } from 'vitest';
import {
  resolveProductFeedbackRole,
  resolveProductFeedbackRouteGroup,
} from './product-feedback-launcher.service';

describe('ProductFeedbackLauncher route context', () => {
  it.each([
    ['/de/session/ABC123/vote', 'SESSION_VOTE', 'PARTICIPANT'],
    ['/en/session/ABC123/host', 'SESSION_HOST', 'HOST'],
    ['/quiz/new', 'QUIZ_EDITOR', 'HOST'],
    ['/help', 'HELP', 'GENERAL'],
    ['/feedback/ABC123/vote', 'QUICK_FEEDBACK', 'GENERAL'],
  ] as const)('mappt %s ohne Parameter auf %s / %s', (url, routeGroup, role) => {
    const resolved = resolveProductFeedbackRouteGroup(url);
    expect(resolved).toBe(routeGroup);
    expect(resolveProductFeedbackRole(resolved)).toBe(role);
  });

  it('leitet aus der Presenter-Route keine persönliche Rolle ab', () => {
    const routeGroup = resolveProductFeedbackRouteGroup('/session/ABC123/present');
    expect(routeGroup).toBe('OTHER');
    expect(resolveProductFeedbackRole(routeGroup)).toBe('GENERAL');
  });
});

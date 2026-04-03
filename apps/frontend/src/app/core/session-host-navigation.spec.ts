import { describe, expect, it, vi } from 'vitest';
import { navigateToHostSession } from './session-host-navigation';

vi.mock('./locale-router', () => ({
  localizePath: vi.fn((path: string) => `/en${path}`),
}));

describe('navigateToHostSession', () => {
  it('navigiert zur lokalisierten Host-Route mit Query-Parametern', async () => {
    const navigateByUrlMock = vi.fn().mockResolvedValue(true);
    const router = {
      navigateByUrl: navigateByUrlMock,
    } as never;

    await navigateToHostSession(router, 'ABC123', 'qa', null);

    expect(navigateByUrlMock).toHaveBeenCalledWith('/en/session/ABC123/host?tab=qa');
  });

  it('fällt auf einen echten Seitenwechsel zurück, wenn Angular false zurückgibt', async () => {
    const navigateByUrlMock = vi.fn().mockResolvedValue(false);
    const assignMock = vi.fn();
    const router = {
      navigateByUrl: navigateByUrlMock,
    } as never;

    await navigateToHostSession(router, 'ABC123', 'quiz', { assign: assignMock });

    expect(navigateByUrlMock).toHaveBeenCalledWith('/en/session/ABC123/host');
    expect(assignMock).toHaveBeenCalledWith('/en/session/ABC123/host');
  });
});

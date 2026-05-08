import type { TeamDTO } from '@arsnova/shared-types';

const PARTICIPANT_TEAM_CONFIRMATION_PREFIX = 'arsnova-team-confirmation:';

export type ConfirmedParticipantTeam = Pick<TeamDTO, 'id' | 'name' | 'color'>;

function isBrowser(): boolean {
  return globalThis.window !== undefined;
}

function normalizeSessionCode(sessionCode: string): string {
  return sessionCode.trim().toUpperCase();
}

function getParticipantTeamConfirmationKey(sessionCode: string): string {
  return `${PARTICIPANT_TEAM_CONFIRMATION_PREFIX}${normalizeSessionCode(sessionCode)}`;
}

export function setConfirmedParticipantTeam(
  sessionCode: string,
  team: ConfirmedParticipantTeam | null,
): void {
  if (!isBrowser()) {
    return;
  }

  const key = getParticipantTeamConfirmationKey(sessionCode);
  if (!team) {
    globalThis.window.sessionStorage.removeItem(key);
    return;
  }

  globalThis.window.sessionStorage.setItem(key, JSON.stringify(team));
}

export function peekConfirmedParticipantTeam(sessionCode: string): ConfirmedParticipantTeam | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw = globalThis.window.sessionStorage.getItem(
      getParticipantTeamConfirmationKey(sessionCode),
    );
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<ConfirmedParticipantTeam>;
    if (typeof parsed.id !== 'string' || typeof parsed.name !== 'string') {
      return null;
    }
    return {
      id: parsed.id,
      name: parsed.name,
      color: typeof parsed.color === 'string' ? parsed.color : null,
    };
  } catch {
    return null;
  }
}

export function consumeConfirmedParticipantTeam(
  sessionCode: string,
): ConfirmedParticipantTeam | null {
  if (!isBrowser()) {
    return null;
  }

  const key = getParticipantTeamConfirmationKey(sessionCode);
  const team = peekConfirmedParticipantTeam(sessionCode);
  globalThis.window.sessionStorage.removeItem(key);
  return team;
}

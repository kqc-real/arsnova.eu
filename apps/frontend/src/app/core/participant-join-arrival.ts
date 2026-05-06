const PARTICIPANT_JOIN_ARRIVAL_PREFIX = 'arsnova-join-arrival:';

function isBrowser(): boolean {
  return globalThis.window !== undefined;
}

function normalizeSessionCode(sessionCode: string): string {
  return sessionCode.trim().toUpperCase();
}

function getParticipantJoinArrivalKey(sessionCode: string): string {
  return `${PARTICIPANT_JOIN_ARRIVAL_PREFIX}${normalizeSessionCode(sessionCode)}`;
}

export function setParticipantJoinArrival(sessionCode: string): void {
  if (!isBrowser()) {
    return;
  }

  globalThis.window.sessionStorage.setItem(getParticipantJoinArrivalKey(sessionCode), '1');
}

export function hasParticipantJoinArrival(sessionCode: string): boolean {
  if (!isBrowser()) {
    return false;
  }

  return (
    globalThis.window.sessionStorage.getItem(getParticipantJoinArrivalKey(sessionCode)) === '1'
  );
}

export function consumeParticipantJoinArrival(sessionCode: string): boolean {
  if (!isBrowser()) {
    return false;
  }

  const key = getParticipantJoinArrivalKey(sessionCode);
  const hasArrival = globalThis.window.sessionStorage.getItem(key) === '1';
  globalThis.window.sessionStorage.removeItem(key);
  return hasArrival;
}

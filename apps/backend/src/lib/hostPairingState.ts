/**
 * Reiner Zustandsautomat für Story 2.10 Slice 1.
 * Secrets liegen hier nur als Hashes; Klartext-Tokens erzeugt die Redis-Schicht.
 */
import {
  HOST_PAIRING_MAX_PAIRED_HOSTS,
  type HostPairingErrorCode,
  type HostPairingScreenVisibility,
  type HostPairingState,
} from '@arsnova/shared-types';

export type HostPairingInviteRecord = {
  inviteId: string;
  secretHash: string;
  createdAt: string;
  expiresAt: string;
  screenVisibility: HostPairingScreenVisibility;
  state: Extract<
    HostPairingState,
    'PAIRING_INVITE_CREATED' | 'PAIRING_REQUESTED' | 'PENDING_APPROVAL'
  >;
};

export type HostPairingPendingRecord = {
  requestId: string;
  inviteId: string;
  requestSecretHash: string;
  confirmationIndicator: string;
  deviceLabel: string | null;
  createdAt: string;
  expiresAt: string;
  state: 'PENDING_APPROVAL';
};

export type HostPairedHostRecord = {
  tokenId: string;
  tokenHash: string;
  deviceLabel: string | null;
  pairedAt: string;
  state: 'CONNECTED';
};

export type HostPairingRecord = {
  version: number;
  invite: HostPairingInviteRecord | null;
  pending: HostPairingPendingRecord | null;
  pairedHosts: HostPairedHostRecord[];
};

export type HostPairingEffect =
  | { type: 'DELETE_INVITE_LOOKUP'; secretHash: string }
  | { type: 'SET_INVITE_LOOKUP'; secretHash: string; inviteId: string }
  | { type: 'DELETE_REQUEST_LOOKUP'; requestSecretHash: string }
  | { type: 'SET_REQUEST_LOOKUP'; requestSecretHash: string; requestId: string }
  | { type: 'SET_TOKEN_LOOKUP'; tokenHash: string; tokenId: string }
  | { type: 'DELETE_TOKEN_LOOKUP'; tokenHash: string }
  | { type: 'ISSUE_CLAIM'; requestSecretHash: string; tokenId: string; tokenHash: string }
  | { type: 'SET_OUTCOME'; requestSecretHash: string; state: HostPairingState; tokenId?: string }
  | { type: 'INVALIDATE_TOKEN_HASH'; tokenHash: string };

export type HostPairingCommand =
  | {
      type: 'CREATE_INVITE';
      inviteId: string;
      secretHash: string;
      screenVisibility: HostPairingScreenVisibility;
      now: Date;
      inviteTtlSeconds: number;
    }
  | {
      type: 'REQUEST';
      inviteSecretHash: string;
      requestId: string;
      requestSecretHash: string;
      confirmationIndicator: string;
      deviceLabel: string | null;
      now: Date;
      pendingTtlSeconds: number;
    }
  | { type: 'APPROVE'; requestId: string; tokenId: string; tokenHash: string; now: Date }
  | { type: 'REJECT'; requestId: string; now: Date }
  | { type: 'REVOKE'; tokenId: string; now: Date }
  | { type: 'SESSION_END'; now: Date }
  | { type: 'SWEEP_EXPIRED'; now: Date };

export type HostPairingSuccess = {
  ok: true;
  record: HostPairingRecord;
  effects: HostPairingEffect[];
  alreadyPending?: boolean;
  issuedTokenId?: string;
  confirmationIndicator?: string;
  requestSecretHash?: string;
};

export type HostPairingFailure = {
  ok: false;
  code: HostPairingErrorCode;
  message: string;
};

export type HostPairingApplyResult = HostPairingSuccess | HostPairingFailure;

const USER_MESSAGES: Record<HostPairingErrorCode, string> = {
  INVITE_EXPIRED: 'Die Verbindungsanfrage ist abgelaufen.',
  INVITE_INVALID: 'Dieser Verbindungslink ist ungültig oder abgelaufen.',
  ALREADY_PENDING: 'Es wartet bereits eine Verbindungsanfrage.',
  PAIRING_CAP_REACHED: 'Es sind bereits drei weitere Host-Geräte verbunden.',
  NOT_ORIGINAL_HOST: 'Nur die ursprüngliche Lehrperson kann weitere Geräte verbinden.',
  REQUEST_EXPIRED: 'Die Verbindungsanfrage ist abgelaufen.',
  REQUEST_REJECTED: 'Die Verbindung wurde abgelehnt.',
  REQUEST_NOT_FOUND: 'Es gibt keine offene Verbindungsanfrage.',
  SESSION_ENDED: 'Die Veranstaltung ist bereits beendet.',
  SESSION_NOT_FOUND: 'Session nicht gefunden.',
  RATE_LIMITED: 'Zu viele Verbindungsversuche. Bitte später erneut versuchen.',
  HOST_REQUIRED: 'Host-Authentifizierung erforderlich.',
};

export function hostPairingUserMessage(code: HostPairingErrorCode): string {
  return USER_MESSAGES[code];
}

export function emptyHostPairingRecord(): HostPairingRecord {
  return { version: 1, invite: null, pending: null, pairedHosts: [] };
}

export function isExpiredAt(expiresAt: string, now: Date): boolean {
  return Date.parse(expiresAt) <= now.getTime();
}

function toIso(date: Date): string {
  return date.toISOString();
}

function addSeconds(now: Date, seconds: number): Date {
  return new Date(now.getTime() + seconds * 1000);
}

function fail(code: HostPairingErrorCode): HostPairingFailure {
  return { ok: false, code, message: USER_MESSAGES[code] };
}

function expireInviteAndPending(
  record: HostPairingRecord,
  now: Date,
): { record: HostPairingRecord; effects: HostPairingEffect[] } {
  const effects: HostPairingEffect[] = [];
  let invite = record.invite;
  let pending = record.pending;

  if (invite && isExpiredAt(invite.expiresAt, now)) {
    effects.push({ type: 'DELETE_INVITE_LOOKUP', secretHash: invite.secretHash });
    if (pending) {
      effects.push(
        { type: 'DELETE_REQUEST_LOOKUP', requestSecretHash: pending.requestSecretHash },
        {
          type: 'SET_OUTCOME',
          requestSecretHash: pending.requestSecretHash,
          state: 'EXPIRED',
        },
      );
      pending = null;
    }
    invite = null;
  }
  if (pending && isExpiredAt(pending.expiresAt, now)) {
    effects.push(
      { type: 'DELETE_REQUEST_LOOKUP', requestSecretHash: pending.requestSecretHash },
      {
        type: 'SET_OUTCOME',
        requestSecretHash: pending.requestSecretHash,
        state: 'EXPIRED',
      },
    );
    pending = null;
    if (invite) {
      invite = { ...invite, state: 'PAIRING_INVITE_CREATED' };
    }
  }

  return {
    record: { ...record, invite, pending, version: record.version + 1 },
    effects,
  };
}

export function applyHostPairingCommand(
  current: HostPairingRecord,
  command: HostPairingCommand,
): HostPairingApplyResult {
  const swept =
    command.type === 'CREATE_INVITE'
      ? { record: current, effects: [] as HostPairingEffect[] }
      : expireInviteAndPending(current, command.now);
  const record = swept.record;
  const baseEffects = swept.effects;

  switch (command.type) {
    case 'SWEEP_EXPIRED':
      return { ok: true, record, effects: baseEffects };

    case 'CREATE_INVITE': {
      const effects = [...baseEffects];
      if (record.invite) {
        effects.push({ type: 'DELETE_INVITE_LOOKUP', secretHash: record.invite.secretHash });
      }
      if (record.pending) {
        effects.push(
          { type: 'DELETE_REQUEST_LOOKUP', requestSecretHash: record.pending.requestSecretHash },
          {
            type: 'SET_OUTCOME',
            requestSecretHash: record.pending.requestSecretHash,
            state: 'EXPIRED',
          },
        );
      }
      const invite: HostPairingInviteRecord = {
        inviteId: command.inviteId,
        secretHash: command.secretHash,
        createdAt: toIso(command.now),
        expiresAt: toIso(addSeconds(command.now, command.inviteTtlSeconds)),
        screenVisibility: command.screenVisibility,
        state: 'PAIRING_INVITE_CREATED',
      };
      effects.push({
        type: 'SET_INVITE_LOOKUP',
        secretHash: command.secretHash,
        inviteId: command.inviteId,
      });
      return {
        ok: true,
        record: {
          version: record.version + 1,
          invite,
          pending: null,
          pairedHosts: record.pairedHosts,
        },
        effects,
      };
    }

    case 'REQUEST': {
      const invite = current.invite;
      if (!invite || invite.secretHash !== command.inviteSecretHash) {
        return fail('INVITE_INVALID');
      }
      if (isExpiredAt(invite.expiresAt, command.now)) {
        return fail('INVITE_EXPIRED');
      }
      if (record.pending && !isExpiredAt(record.pending.expiresAt, command.now)) {
        return {
          ok: true,
          record,
          effects: baseEffects,
          alreadyPending: true,
          confirmationIndicator: record.pending.confirmationIndicator,
        };
      }
      if (record.pairedHosts.length >= HOST_PAIRING_MAX_PAIRED_HOSTS) {
        return fail('PAIRING_CAP_REACHED');
      }
      const pending: HostPairingPendingRecord = {
        requestId: command.requestId,
        inviteId: invite.inviteId,
        requestSecretHash: command.requestSecretHash,
        confirmationIndicator: command.confirmationIndicator,
        deviceLabel: command.deviceLabel,
        createdAt: toIso(command.now),
        expiresAt: toIso(addSeconds(command.now, command.pendingTtlSeconds)),
        state: 'PENDING_APPROVAL',
      };
      return {
        ok: true,
        record: {
          version: record.version + 1,
          invite: { ...invite, state: 'PENDING_APPROVAL' },
          pending,
          pairedHosts: record.pairedHosts,
        },
        effects: [
          ...baseEffects,
          {
            type: 'SET_REQUEST_LOOKUP',
            requestSecretHash: command.requestSecretHash,
            requestId: command.requestId,
          },
        ],
        alreadyPending: false,
        confirmationIndicator: pending.confirmationIndicator,
        requestSecretHash: command.requestSecretHash,
      };
    }

    case 'APPROVE': {
      const pending = current.pending;
      if (!pending || pending.requestId !== command.requestId) {
        return fail('REQUEST_NOT_FOUND');
      }
      if (isExpiredAt(pending.expiresAt, command.now)) {
        return fail('REQUEST_EXPIRED');
      }
      if (record.pairedHosts.length >= HOST_PAIRING_MAX_PAIRED_HOSTS) {
        return fail('PAIRING_CAP_REACHED');
      }
      const paired: HostPairedHostRecord = {
        tokenId: command.tokenId,
        tokenHash: command.tokenHash,
        deviceLabel: pending.deviceLabel,
        pairedAt: toIso(command.now),
        state: 'CONNECTED',
      };
      const effects: HostPairingEffect[] = [
        ...baseEffects,
        { type: 'DELETE_REQUEST_LOOKUP', requestSecretHash: pending.requestSecretHash },
        {
          type: 'ISSUE_CLAIM',
          requestSecretHash: pending.requestSecretHash,
          tokenId: command.tokenId,
          tokenHash: command.tokenHash,
        },
        {
          type: 'SET_OUTCOME',
          requestSecretHash: pending.requestSecretHash,
          state: 'CONNECTED',
          tokenId: command.tokenId,
        },
        { type: 'SET_TOKEN_LOOKUP', tokenHash: command.tokenHash, tokenId: command.tokenId },
      ];
      if (record.invite) {
        effects.push({ type: 'DELETE_INVITE_LOOKUP', secretHash: record.invite.secretHash });
      }
      return {
        ok: true,
        record: {
          version: record.version + 1,
          invite: null,
          pending: null,
          pairedHosts: [...record.pairedHosts, paired],
        },
        effects,
        issuedTokenId: command.tokenId,
        confirmationIndicator: pending.confirmationIndicator,
        requestSecretHash: pending.requestSecretHash,
      };
    }

    case 'REJECT': {
      const pending = current.pending;
      if (!pending || pending.requestId !== command.requestId) {
        return fail('REQUEST_NOT_FOUND');
      }
      if (isExpiredAt(pending.expiresAt, command.now)) {
        return fail('REQUEST_EXPIRED');
      }
      const effects: HostPairingEffect[] = [
        ...baseEffects,
        { type: 'DELETE_REQUEST_LOOKUP', requestSecretHash: pending.requestSecretHash },
        {
          type: 'SET_OUTCOME',
          requestSecretHash: pending.requestSecretHash,
          state: 'REJECTED',
        },
      ];
      if (record.invite) {
        effects.push({ type: 'DELETE_INVITE_LOOKUP', secretHash: record.invite.secretHash });
      }
      return {
        ok: true,
        record: {
          version: record.version + 1,
          invite: null,
          pending: null,
          pairedHosts: record.pairedHosts,
        },
        effects,
        confirmationIndicator: pending.confirmationIndicator,
        requestSecretHash: pending.requestSecretHash,
      };
    }

    case 'REVOKE': {
      const target = record.pairedHosts.find((device) => device.tokenId === command.tokenId);
      if (!target) {
        return fail('REQUEST_NOT_FOUND');
      }
      return {
        ok: true,
        record: {
          version: record.version + 1,
          invite: record.invite,
          pending: record.pending,
          pairedHosts: record.pairedHosts.filter((device) => device.tokenId !== command.tokenId),
        },
        effects: [
          ...baseEffects,
          { type: 'DELETE_TOKEN_LOOKUP', tokenHash: target.tokenHash },
          { type: 'INVALIDATE_TOKEN_HASH', tokenHash: target.tokenHash },
        ],
        issuedTokenId: target.tokenId,
      };
    }

    case 'SESSION_END': {
      const effects: HostPairingEffect[] = [...baseEffects];
      if (record.invite) {
        effects.push({ type: 'DELETE_INVITE_LOOKUP', secretHash: record.invite.secretHash });
      }
      if (record.pending) {
        effects.push(
          { type: 'DELETE_REQUEST_LOOKUP', requestSecretHash: record.pending.requestSecretHash },
          {
            type: 'SET_OUTCOME',
            requestSecretHash: record.pending.requestSecretHash,
            state: 'SESSION_ENDED',
          },
        );
      }
      for (const device of record.pairedHosts) {
        effects.push(
          { type: 'DELETE_TOKEN_LOOKUP', tokenHash: device.tokenHash },
          { type: 'INVALIDATE_TOKEN_HASH', tokenHash: device.tokenHash },
        );
      }
      return {
        ok: true,
        record: emptyHostPairingRecord(),
        effects,
      };
    }
  }
}

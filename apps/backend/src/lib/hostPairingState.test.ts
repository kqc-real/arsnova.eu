import { describe, expect, it } from 'vitest';
import {
  applyHostPairingCommand,
  emptyHostPairingRecord,
  type HostPairingRecord,
} from './hostPairingState';

const NOW = new Date('2026-09-07T12:00:00.000Z');
const LATER = new Date('2026-09-07T12:10:00.000Z');

function inviteCommand() {
  return {
    type: 'CREATE_INVITE' as const,
    inviteId: '11111111-1111-4111-8111-111111111111',
    secretHash: 'invite-hash',
    screenVisibility: 'PROJECTED' as const,
    now: NOW,
    inviteTtlSeconds: 300,
  };
}

function requestCommand(overrides: Partial<{ now: Date; requestId: string }> = {}) {
  return {
    type: 'REQUEST' as const,
    inviteSecretHash: 'invite-hash',
    requestId: overrides.requestId ?? '22222222-2222-4222-8222-222222222222',
    requestSecretHash: 'request-hash',
    confirmationIndicator: 'Eule · 47',
    deviceLabel: 'Smartphone',
    now: overrides.now ?? NOW,
    pendingTtlSeconds: 300,
  };
}

describe('hostPairingState (Story 2.10 Slice 1)', () => {
  it('führt IDLE → Invite → Pending → Connected und speichert nur Hashes', () => {
    const invited = applyHostPairingCommand(emptyHostPairingRecord(), inviteCommand());
    expect(invited.ok).toBe(true);
    if (!invited.ok) return;
    expect(invited.record.invite?.state).toBe('PAIRING_INVITE_CREATED');
    expect(invited.record.invite?.secretHash).toBe('invite-hash');

    const requested = applyHostPairingCommand(invited.record, requestCommand());
    expect(requested.ok).toBe(true);
    if (!requested.ok) return;
    expect(requested.alreadyPending).toBe(false);
    expect(requested.record.pending?.state).toBe('PENDING_APPROVAL');

    const approved = applyHostPairingCommand(requested.record, {
      type: 'APPROVE',
      requestId: '22222222-2222-4222-8222-222222222222',
      tokenId: '33333333-3333-4333-8333-333333333333',
      tokenHash: 'token-hash',
      now: NOW,
    });
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    expect(approved.record.invite).toBeNull();
    expect(approved.record.pending).toBeNull();
    expect(approved.record.pairedHosts).toHaveLength(1);
    expect(approved.record.pairedHosts[0]?.tokenHash).toBe('token-hash');
    expect(approved.effects.some((effect) => effect.type === 'ISSUE_CLAIM')).toBe(true);
  });

  it('erzeugt ohne Approve kein Token — auch im privaten Sichtbarkeitspfad', () => {
    const invited = applyHostPairingCommand(emptyHostPairingRecord(), {
      ...inviteCommand(),
      screenVisibility: 'PRIVATE',
    });
    if (!invited.ok) return;
    const requested = applyHostPairingCommand(invited.record, requestCommand());
    if (!requested.ok) return;
    expect(requested.record.pairedHosts).toHaveLength(0);
    expect(requested.effects.some((effect) => effect.type === 'ISSUE_CLAIM')).toBe(false);
  });

  it('lehnt eine zweite Pending-Anfrage derselben Einladung ohne neues Secret ab', () => {
    const invited = applyHostPairingCommand(emptyHostPairingRecord(), inviteCommand());
    if (!invited.ok) return;
    const first = applyHostPairingCommand(invited.record, requestCommand());
    if (!first.ok) return;
    const second = applyHostPairingCommand(
      first.record,
      requestCommand({ requestId: '44444444-4444-4444-8444-444444444444' }),
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.alreadyPending).toBe(true);
    expect(second.record.pending?.requestId).toBe('22222222-2222-4222-8222-222222222222');
  });

  it('lehnt Freigabe über dem Cap von 3 Paired Hosts ab und erlaubt sie nach Widerruf', () => {
    let record: HostPairingRecord = emptyHostPairingRecord();
    for (let index = 0; index < 3; index += 1) {
      const invited = applyHostPairingCommand(record, {
        ...inviteCommand(),
        inviteId: `11111111-1111-4111-8111-11111111111${index}`,
        secretHash: `invite-hash-${index}`,
      });
      if (!invited.ok) throw new Error('invite');
      const requested = applyHostPairingCommand(invited.record, {
        ...requestCommand(),
        inviteSecretHash: `invite-hash-${index}`,
        requestId: `22222222-2222-4222-8222-22222222222${index}`,
        requestSecretHash: `request-hash-${index}`,
      });
      if (!requested.ok) throw new Error('request');
      const approved = applyHostPairingCommand(requested.record, {
        type: 'APPROVE',
        requestId: `22222222-2222-4222-8222-22222222222${index}`,
        tokenId: `33333333-3333-4333-8333-33333333333${index}`,
        tokenHash: `token-hash-${index}`,
        now: NOW,
      });
      if (!approved.ok) throw new Error('approve');
      record = approved.record;
    }
    expect(record.pairedHosts).toHaveLength(3);

    const extraInvite = applyHostPairingCommand(record, inviteCommand());
    if (!extraInvite.ok) throw new Error('extra invite');
    const extraRequest = applyHostPairingCommand(extraInvite.record, requestCommand());
    expect(extraRequest.ok).toBe(false);
    if (extraRequest.ok) return;
    expect(extraRequest.code).toBe('PAIRING_CAP_REACHED');

    const revoked = applyHostPairingCommand(record, {
      type: 'REVOKE',
      tokenId: '33333333-3333-4333-8333-333333333330',
      now: NOW,
    });
    expect(revoked.ok).toBe(true);
    if (!revoked.ok) return;
    expect(revoked.record.pairedHosts).toHaveLength(2);
    expect(revoked.effects.some((effect) => effect.type === 'INVALIDATE_TOKEN_HASH')).toBe(true);

    const afterRevokeInvite = applyHostPairingCommand(revoked.record, inviteCommand());
    if (!afterRevokeInvite.ok) throw new Error('after revoke invite');
    const afterRevokeRequest = applyHostPairingCommand(afterRevokeInvite.record, requestCommand());
    expect(afterRevokeRequest.ok).toBe(true);
  });

  it('markiert abgelaufene Einladungen und Anfragen als EXPIRED ohne Token', () => {
    const invited = applyHostPairingCommand(emptyHostPairingRecord(), inviteCommand());
    if (!invited.ok) return;
    const expiredRequest = applyHostPairingCommand(invited.record, requestCommand({ now: LATER }));
    expect(expiredRequest.ok).toBe(false);
    if (expiredRequest.ok) return;
    expect(expiredRequest.code).toBe('INVITE_EXPIRED');

    const requested = applyHostPairingCommand(invited.record, requestCommand());
    if (!requested.ok) return;
    const expiredApprove = applyHostPairingCommand(requested.record, {
      type: 'APPROVE',
      requestId: '22222222-2222-4222-8222-222222222222',
      tokenId: '33333333-3333-4333-8333-333333333333',
      tokenHash: 'token-hash',
      now: LATER,
    });
    expect(expiredApprove.ok).toBe(false);
    if (expiredApprove.ok) return;
    expect(expiredApprove.code).toBe('REQUEST_EXPIRED');
  });

  it('invalidiert bei Reject und Session-Ende alle offenen Secrets und Tokens', () => {
    const invited = applyHostPairingCommand(emptyHostPairingRecord(), inviteCommand());
    if (!invited.ok) return;
    const requested = applyHostPairingCommand(invited.record, requestCommand());
    if (!requested.ok) return;
    const rejected = applyHostPairingCommand(requested.record, {
      type: 'REJECT',
      requestId: '22222222-2222-4222-8222-222222222222',
      now: NOW,
    });
    expect(rejected.ok).toBe(true);
    if (!rejected.ok) return;
    expect(rejected.record.pending).toBeNull();
    expect(rejected.effects.some((effect) => effect.type === 'SET_OUTCOME')).toBe(true);

    const approved = applyHostPairingCommand(requested.record, {
      type: 'APPROVE',
      requestId: '22222222-2222-4222-8222-222222222222',
      tokenId: '33333333-3333-4333-8333-333333333333',
      tokenHash: 'token-hash',
      now: NOW,
    });
    if (!approved.ok) return;
    const ended = applyHostPairingCommand(approved.record, { type: 'SESSION_END', now: NOW });
    expect(ended.ok).toBe(true);
    if (!ended.ok) return;
    expect(ended.record.pairedHosts).toHaveLength(0);
    expect(ended.effects.some((effect) => effect.type === 'INVALIDATE_TOKEN_HASH')).toBe(true);
  });

  it('ersetzt eine aktive Einladung atomar und invalidiert die vorherige', () => {
    const first = applyHostPairingCommand(emptyHostPairingRecord(), inviteCommand());
    if (!first.ok) return;
    const second = applyHostPairingCommand(first.record, {
      ...inviteCommand(),
      inviteId: '55555555-5555-4555-8555-555555555555',
      secretHash: 'invite-hash-2',
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.record.invite?.secretHash).toBe('invite-hash-2');
    expect(
      second.effects.some(
        (effect) => effect.type === 'DELETE_INVITE_LOOKUP' && effect.secretHash === 'invite-hash',
      ),
    ).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import {
  ApproveHostPairingInputSchema,
  ApproveHostPairingOutputSchema,
  CreateHostPairingInviteInputSchema,
  CreateHostPairingInviteOutputSchema,
  GetHostPairingRequestInputSchema,
  GetHostPairingRequestOutputSchema,
  HOST_PAIRING_CAPS,
  HOST_PAIRING_INVITE_TTL_SECONDS,
  HOST_PAIRING_MAX_ACTIVE_INVITES,
  HOST_PAIRING_MAX_PAIRED_HOSTS,
  HOST_PAIRING_MAX_PENDING_PER_INVITE,
  HOST_PAIRING_PENDING_TTL_SECONDS,
  HOST_PAIRING_SECRET_MIN_LENGTH,
  HostPairingCapsSchema,
  HostPairingStateEnum,
  HostSessionRoleEnum,
  ListPairedHostsOutputSchema,
  RejectHostPairingOutputSchema,
  RequestHostPairingInputSchema,
  RequestHostPairingOutputSchema,
  RevokePairedHostOutputSchema,
} from './host-pairing';

const INVITE_ID = '11111111-1111-4111-8111-111111111111';
const REQUEST_ID = '22222222-2222-4222-8222-222222222222';
const TOKEN_ID = '33333333-3333-4333-8333-333333333333';
const SECRET = 'a'.repeat(HOST_PAIRING_SECRET_MIN_LENGTH);
const EXPIRES = '2026-09-07T14:00:00.000Z';

describe('Host-Pairing Contracts (Story 2.10 Slice 1)', () => {
  it('erzwingt Caps und kurze TTLs im Minutenbereich', () => {
    expect(HOST_PAIRING_MAX_PAIRED_HOSTS).toBe(3);
    expect(HOST_PAIRING_MAX_ACTIVE_INVITES).toBe(1);
    expect(HOST_PAIRING_MAX_PENDING_PER_INVITE).toBe(1);
    expect(HOST_PAIRING_INVITE_TTL_SECONDS).toBe(300);
    expect(HOST_PAIRING_PENDING_TTL_SECONDS).toBe(300);
    expect(HostPairingCapsSchema.parse(HOST_PAIRING_CAPS)).toEqual(HOST_PAIRING_CAPS);
  });

  it('normalisiert den Session-Code und lehnt zu kurze Secrets ab', () => {
    expect(CreateHostPairingInviteInputSchema.parse({ code: 'abc123' }).code).toBe('ABC123');
    expect(CreateHostPairingInviteInputSchema.parse({ code: 'ABC123' }).screenVisibility).toBe(
      'PROJECTED',
    );
    expect(
      RequestHostPairingInputSchema.safeParse({
        code: 'ABC123',
        pairingSecret: 'short',
      }).success,
    ).toBe(false);
  });

  it('bildet Invite-, Request- und Freigabe-Verträge ohne Host-Token im Approve-Output', () => {
    expect(
      CreateHostPairingInviteOutputSchema.parse({
        inviteId: INVITE_ID,
        pairingSecret: SECRET,
        expiresAt: EXPIRES,
        state: 'PAIRING_INVITE_CREATED',
        screenVisibility: 'PRIVATE',
        caps: HOST_PAIRING_CAPS,
      }).pairingSecret,
    ).toHaveLength(HOST_PAIRING_SECRET_MIN_LENGTH);

    expect(
      RequestHostPairingOutputSchema.parse({
        requestId: REQUEST_ID,
        requestSecret: SECRET,
        confirmationIndicator: 'Eule · 47',
        state: 'PENDING_APPROVAL',
        alreadyPending: false,
        expiresAt: EXPIRES,
      }).alreadyPending,
    ).toBe(false);

    const approved = ApproveHostPairingOutputSchema.parse({
      requestId: REQUEST_ID,
      tokenId: TOKEN_ID,
      state: 'CONNECTED',
      confirmationIndicator: 'Eule · 47',
    });
    expect(approved).not.toHaveProperty('pairedHostToken');
    expect(
      RejectHostPairingOutputSchema.parse({
        requestId: REQUEST_ID,
        state: 'REJECTED',
      }).state,
    ).toBe('REJECTED');
  });

  it('liefert das Paired-Host-Token nur über den Anfrage-Poll, nicht über Session-Code allein', () => {
    expect(
      GetHostPairingRequestInputSchema.safeParse({
        code: 'ABC123',
        requestId: REQUEST_ID,
      }).success,
    ).toBe(false);

    const pending = GetHostPairingRequestOutputSchema.parse({
      requestId: REQUEST_ID,
      state: 'PENDING_APPROVAL',
      confirmationIndicator: 'Eule · 47',
      expiresAt: EXPIRES,
      token: null,
    });
    expect(pending.token).toBeNull();

    const issued = GetHostPairingRequestOutputSchema.parse({
      requestId: REQUEST_ID,
      state: 'PAIRED_HOST_TOKEN_ISSUED',
      confirmationIndicator: 'Eule · 47',
      expiresAt: EXPIRES,
      token: {
        tokenId: TOKEN_ID,
        pairedHostToken: 'paired-host-token',
        role: HostSessionRoleEnum.enum.PAIRED_HOST,
      },
    });
    expect(issued.token?.role).toBe('PAIRED_HOST');
  });

  it('begrenzt die Geräteliste auf den Paired-Host-Cap', () => {
    const devices = Array.from({ length: 3 }, (_, index) => ({
      tokenId: `33333333-3333-4333-8333-33333333333${index}`,
      deviceLabel: `Gerät ${index + 1}`,
      pairedAt: EXPIRES,
      state: 'CONNECTED' as const,
    }));
    expect(
      ListPairedHostsOutputSchema.parse({
        devices,
        pending: null,
        invite: null,
        caps: HOST_PAIRING_CAPS,
      }).devices,
    ).toHaveLength(3);
    expect(
      ListPairedHostsOutputSchema.safeParse({
        devices: [
          ...devices,
          {
            tokenId: '33333333-3333-4333-8333-333333333339',
            deviceLabel: 'Zu viel',
            pairedAt: EXPIRES,
            state: 'CONNECTED',
          },
        ],
        pending: null,
        invite: null,
        caps: HOST_PAIRING_CAPS,
      }).success,
    ).toBe(false);
    expect(
      RevokePairedHostOutputSchema.parse({
        tokenId: TOKEN_ID,
        state: 'REVOKED',
      }).state,
    ).toBe('REVOKED');
  });

  it('unterscheidet den Zustandsautomaten vollständig', () => {
    expect(HostPairingStateEnum.options).toEqual([
      'IDLE',
      'PAIRING_INVITE_CREATED',
      'PAIRING_REQUESTED',
      'PENDING_APPROVAL',
      'APPROVED',
      'REJECTED',
      'EXPIRED',
      'PAIRED_HOST_TOKEN_ISSUED',
      'CONNECTED',
      'REVOKED',
      'SESSION_ENDED',
    ]);
    expect(
      ApproveHostPairingInputSchema.parse({
        code: 'abc123',
        requestId: REQUEST_ID,
      }).code,
    ).toBe('ABC123');
  });
});

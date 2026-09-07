/**
 * Story 2.10 / ADR-0011 — Paired Host, Slice 1.
 * Shared Zod-Contracts für Pairing-Invite, Request, Freigabe/Ablehnung,
 * Paired-Host-Token und Geräte-Caps. Keine UI-Copy.
 */
import { z } from 'zod';

/** Pro Session zusätzlich zum ursprünglichen Host. */
export const HOST_PAIRING_MAX_PAIRED_HOSTS = 3;
export const HOST_PAIRING_MAX_ACTIVE_INVITES = 1;
export const HOST_PAIRING_MAX_PENDING_PER_INVITE = 1;

/** Kurze TTL im Minutenbereich; serverseitig erzwungen. */
export const HOST_PAIRING_INVITE_TTL_SECONDS = 300;
export const HOST_PAIRING_PENDING_TTL_SECONDS = 300;
export const HOST_PAIRING_CLAIM_TTL_SECONDS = 300;

export const HOST_PAIRING_DEVICE_LABEL_MAX = 80;
export const HOST_PAIRING_CONFIRMATION_INDICATOR_MAX = 32;
export const HOST_PAIRING_SECRET_MIN_LENGTH = 32;

export const HostSessionRoleEnum = z.enum(['ORIGINAL_HOST', 'PAIRED_HOST']);
export type HostSessionRole = z.infer<typeof HostSessionRoleEnum>;

export const HostPairingScreenVisibilityEnum = z.enum(['PROJECTED', 'PRIVATE']);
export type HostPairingScreenVisibility = z.infer<typeof HostPairingScreenVisibilityEnum>;

/**
 * Serverzustandsautomat (Story 2.10).
 * REQUESTED und PENDING_APPROVAL folgen im Request-and-Approve-Default
 * unmittelbar aufeinander; TOKEN_ISSUED und CONNECTED entstehen atomar
 * bei Freigabe, das Token wird dem anfragenden Gerät einmalig ausgeliefert.
 */
export const HostPairingStateEnum = z.enum([
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
export type HostPairingState = z.infer<typeof HostPairingStateEnum>;

export const HostPairingErrorCodeEnum = z.enum([
  'INVITE_EXPIRED',
  'INVITE_INVALID',
  'ALREADY_PENDING',
  'PAIRING_CAP_REACHED',
  'NOT_ORIGINAL_HOST',
  'REQUEST_EXPIRED',
  'REQUEST_REJECTED',
  'REQUEST_NOT_FOUND',
  'SESSION_ENDED',
  'SESSION_NOT_FOUND',
  'RATE_LIMITED',
  'HOST_REQUIRED',
]);
export type HostPairingErrorCode = z.infer<typeof HostPairingErrorCodeEnum>;

export const HostPairingCapsSchema = z.object({
  maxPairedHosts: z.literal(HOST_PAIRING_MAX_PAIRED_HOSTS),
  maxActiveInvites: z.literal(HOST_PAIRING_MAX_ACTIVE_INVITES),
  maxPendingPerInvite: z.literal(HOST_PAIRING_MAX_PENDING_PER_INVITE),
  inviteTtlSeconds: z.number().int().positive(),
  pendingTtlSeconds: z.number().int().positive(),
});
export type HostPairingCaps = z.infer<typeof HostPairingCapsSchema>;

export const HOST_PAIRING_CAPS = {
  maxPairedHosts: HOST_PAIRING_MAX_PAIRED_HOSTS,
  maxActiveInvites: HOST_PAIRING_MAX_ACTIVE_INVITES,
  maxPendingPerInvite: HOST_PAIRING_MAX_PENDING_PER_INVITE,
  inviteTtlSeconds: HOST_PAIRING_INVITE_TTL_SECONDS,
  pendingTtlSeconds: HOST_PAIRING_PENDING_TTL_SECONDS,
} as const satisfies HostPairingCaps;

const SessionCodeSchema = z
  .string()
  .length(6, { error: 'Session-Code muss 6 Zeichen lang sein' })
  .transform((value) => value.toUpperCase());

const PairingSecretSchema = z
  .string()
  .min(HOST_PAIRING_SECRET_MIN_LENGTH)
  .regex(/^[A-Za-z0-9_-]+$/, { error: 'Ungültiges Verbindungsmaterial.' });

const DeviceLabelSchema = z.string().trim().min(1).max(HOST_PAIRING_DEVICE_LABEL_MAX).optional();

export const CreateHostPairingInviteInputSchema = z.object({
  code: SessionCodeSchema,
  /** Nur UX-Hinweis; ändert den Serverflow nicht (kein silent grant). */
  screenVisibility: HostPairingScreenVisibilityEnum.optional().default('PROJECTED'),
});
export type CreateHostPairingInviteInput = z.infer<typeof CreateHostPairingInviteInputSchema>;

export const CreateHostPairingInviteOutputSchema = z.object({
  inviteId: z.uuid(),
  pairingSecret: PairingSecretSchema,
  expiresAt: z.string().datetime(),
  state: z.literal(HostPairingStateEnum.enum.PAIRING_INVITE_CREATED),
  screenVisibility: HostPairingScreenVisibilityEnum,
  caps: HostPairingCapsSchema,
});
export type CreateHostPairingInviteOutput = z.infer<typeof CreateHostPairingInviteOutputSchema>;

export const RequestHostPairingInputSchema = z.object({
  code: SessionCodeSchema,
  pairingSecret: PairingSecretSchema,
  deviceLabel: DeviceLabelSchema,
});
export type RequestHostPairingInput = z.infer<typeof RequestHostPairingInputSchema>;

export const RequestHostPairingOutputSchema = z.object({
  requestId: z.uuid().nullable(),
  requestSecret: PairingSecretSchema.nullable(),
  confirmationIndicator: z.string().max(HOST_PAIRING_CONFIRMATION_INDICATOR_MAX).nullable(),
  state: z.enum([
    HostPairingStateEnum.enum.PENDING_APPROVAL,
    HostPairingStateEnum.enum.PAIRING_REQUESTED,
  ]),
  alreadyPending: z.boolean(),
  expiresAt: z.string().datetime().nullable(),
});
export type RequestHostPairingOutput = z.infer<typeof RequestHostPairingOutputSchema>;

export const GetHostPairingRequestInputSchema = z.object({
  code: SessionCodeSchema,
  requestId: z.uuid(),
  requestSecret: PairingSecretSchema,
});
export type GetHostPairingRequestInput = z.infer<typeof GetHostPairingRequestInputSchema>;

export const PairedHostTokenDTOSchema = z.object({
  tokenId: z.uuid(),
  pairedHostToken: z.string().min(1),
  role: z.literal(HostSessionRoleEnum.enum.PAIRED_HOST),
});
export type PairedHostTokenDTO = z.infer<typeof PairedHostTokenDTOSchema>;

export const GetHostPairingRequestOutputSchema = z.object({
  requestId: z.uuid(),
  state: HostPairingStateEnum,
  confirmationIndicator: z.string().max(HOST_PAIRING_CONFIRMATION_INDICATOR_MAX).nullable(),
  expiresAt: z.string().datetime().nullable(),
  token: PairedHostTokenDTOSchema.nullable(),
});
export type GetHostPairingRequestOutput = z.infer<typeof GetHostPairingRequestOutputSchema>;

export const ApproveHostPairingInputSchema = z.object({
  code: SessionCodeSchema,
  requestId: z.uuid(),
});
export type ApproveHostPairingInput = z.infer<typeof ApproveHostPairingInputSchema>;

export const ApproveHostPairingOutputSchema = z.object({
  requestId: z.uuid(),
  tokenId: z.uuid(),
  state: z.literal(HostPairingStateEnum.enum.CONNECTED),
  confirmationIndicator: z.string().max(HOST_PAIRING_CONFIRMATION_INDICATOR_MAX),
});
export type ApproveHostPairingOutput = z.infer<typeof ApproveHostPairingOutputSchema>;

export const RejectHostPairingInputSchema = z.object({
  code: SessionCodeSchema,
  requestId: z.uuid(),
});
export type RejectHostPairingInput = z.infer<typeof RejectHostPairingInputSchema>;

export const RejectHostPairingOutputSchema = z.object({
  requestId: z.uuid(),
  state: z.literal(HostPairingStateEnum.enum.REJECTED),
});
export type RejectHostPairingOutput = z.infer<typeof RejectHostPairingOutputSchema>;

export const RevokePairedHostInputSchema = z.object({
  code: SessionCodeSchema,
  tokenId: z.uuid(),
});
export type RevokePairedHostInput = z.infer<typeof RevokePairedHostInputSchema>;

export const RevokePairedHostOutputSchema = z.object({
  tokenId: z.uuid(),
  state: z.literal(HostPairingStateEnum.enum.REVOKED),
});
export type RevokePairedHostOutput = z.infer<typeof RevokePairedHostOutputSchema>;

export const HostPairingPendingDTOSchema = z.object({
  requestId: z.uuid(),
  confirmationIndicator: z.string().max(HOST_PAIRING_CONFIRMATION_INDICATOR_MAX),
  deviceLabel: z.string().max(HOST_PAIRING_DEVICE_LABEL_MAX).nullable(),
  state: z.literal(HostPairingStateEnum.enum.PENDING_APPROVAL),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export type HostPairingPendingDTO = z.infer<typeof HostPairingPendingDTOSchema>;

export const PairedHostDeviceDTOSchema = z.object({
  tokenId: z.uuid(),
  deviceLabel: z.string().max(HOST_PAIRING_DEVICE_LABEL_MAX).nullable(),
  pairedAt: z.string().datetime(),
  state: z.literal(HostPairingStateEnum.enum.CONNECTED),
});
export type PairedHostDeviceDTO = z.infer<typeof PairedHostDeviceDTOSchema>;

export const HostPairingInviteStatusDTOSchema = z.object({
  inviteId: z.uuid(),
  state: z.enum([
    HostPairingStateEnum.enum.PAIRING_INVITE_CREATED,
    HostPairingStateEnum.enum.PAIRING_REQUESTED,
    HostPairingStateEnum.enum.PENDING_APPROVAL,
  ]),
  screenVisibility: HostPairingScreenVisibilityEnum,
  expiresAt: z.string().datetime(),
});
export type HostPairingInviteStatusDTO = z.infer<typeof HostPairingInviteStatusDTOSchema>;

export const ListPairedHostsInputSchema = z.object({
  code: SessionCodeSchema,
});
export type ListPairedHostsInput = z.infer<typeof ListPairedHostsInputSchema>;

export const ListPairedHostsOutputSchema = z.object({
  devices: z.array(PairedHostDeviceDTOSchema).max(HOST_PAIRING_MAX_PAIRED_HOSTS),
  pending: HostPairingPendingDTOSchema.nullable(),
  invite: HostPairingInviteStatusDTOSchema.nullable(),
  caps: HostPairingCapsSchema,
});
export type ListPairedHostsOutput = z.infer<typeof ListPairedHostsOutputSchema>;

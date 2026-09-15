import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const ENVELOPE_VERSION = 'v1';
const SUPPORT_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function decodeConfiguredKey(value: string): Buffer {
  const key = Buffer.from(value.trim(), 'base64');
  if (key.length !== 32) {
    throw new Error('CAPABILITY_ENVELOPE_KEY_BASE64 muss exakt 32 Byte Base64 enthalten.');
  }
  return key;
}

function resolveEnvelopeKey(): Buffer {
  const configured = process.env['CAPABILITY_ENVELOPE_KEY_BASE64'];
  if (configured) {
    return decodeConfiguredKey(configured);
  }
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('CAPABILITY_ENVELOPE_KEY_BASE64 ist in Produktion erforderlich.');
  }
  return createHash('sha256')
    .update(`arsnova-capability-dev:${process.env['JWT_SECRET'] ?? 'local-test-only'}`, 'utf8')
    .digest();
}

export function assertCapabilityEnvelopeKeyConfigured(): void {
  void resolveEnvelopeKey();
}

function encode(value: Buffer): string {
  return value.toString('base64url');
}

function decode(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

export function createOpaqueCapability(): string {
  return encode(randomBytes(32));
}

export function hashCapability(value: string): string {
  return createHash('sha256').update(value.trim(), 'utf8').digest('hex');
}

export function hashCapabilityIndex(value: string, purpose: string): string {
  return createHmac('sha256', resolveEnvelopeKey())
    .update(`${purpose}\0${value.trim()}`, 'utf8')
    .digest('hex');
}

export function capabilityHashesEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function encryptCapabilityEnvelope<T>(value: T, associatedData: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', resolveEnvelopeKey(), iv);
  cipher.setAAD(Buffer.from(associatedData, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [ENVELOPE_VERSION, encode(iv), encode(tag), encode(ciphertext)].join('.');
}

export function decryptCapabilityEnvelope<T>(envelope: string, associatedData: string): T {
  const [version, ivRaw, tagRaw, ciphertextRaw, extra] = envelope.split('.');
  if (version !== ENVELOPE_VERSION || !ivRaw || !tagRaw || !ciphertextRaw || extra !== undefined) {
    throw new Error('Ungültiges Capability-Envelope.');
  }
  const decipher = createDecipheriv('aes-256-gcm', resolveEnvelopeKey(), decode(ivRaw));
  decipher.setAAD(Buffer.from(associatedData, 'utf8'));
  decipher.setAuthTag(decode(tagRaw));
  const plaintext = Buffer.concat([
    decipher.update(decode(ciphertextRaw)),
    decipher.final(),
  ]).toString('utf8');
  return JSON.parse(plaintext) as T;
}

export function createHostSupportId(): string {
  const bytes = randomBytes(8);
  let payload = '';
  for (let index = 0; index < 8; index += 1) {
    payload += SUPPORT_ALPHABET[bytes[index]! % SUPPORT_ALPHABET.length];
  }
  return `ARS-${payload.slice(0, 4)}-${payload.slice(4)}`;
}

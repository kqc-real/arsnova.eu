import { describe, expect, it } from 'vitest';
import { HealthSecurityStatsDTOSchema } from './schemas';

describe('HealthSecurityStatsDTOSchema CSP-Telemetrie', () => {
  it('verlangt nichtnegative ganzzahlige CSP-Zähler', () => {
    const fields = [
      HealthSecurityStatsDTOSchema.shape.cspReportsReceivedLastMinute,
      HealthSecurityStatsDTOSchema.shape.cspReportsDroppedLastMinute,
      HealthSecurityStatsDTOSchema.shape.cspReportsRateLimitedLastMinute,
      HealthSecurityStatsDTOSchema.shape.cspReportsEvalLastMinute,
      HealthSecurityStatsDTOSchema.shape.cspReportsScriptHttpsLastMinute,
    ];
    for (const field of fields) {
      expect(field.parse(0)).toBe(0);
      expect(field.safeParse(-1).success).toBe(false);
      expect(field.safeParse(1.5).success).toBe(false);
    }
  });

  it('verlangt einen expliziten PostgreSQL-Status', () => {
    expect(HealthSecurityStatsDTOSchema.shape.databaseStatus.parse('unavailable')).toBe(
      'unavailable',
    );
    expect(HealthSecurityStatsDTOSchema.shape.databaseStatus.safeParse('unknown').success).toBe(
      false,
    );
  });

  it('verlangt vollständige Session-Code-Fehlerquellen', () => {
    const sources = { join: 1, lookup: 2, pollReconnect: 3, other: 4 };
    expect(
      HealthSecurityStatsDTOSchema.shape.sessionCodeFailuresBySourceLastMinute.parse(sources),
    ).toEqual(sources);
    expect(
      HealthSecurityStatsDTOSchema.shape.sessionCodeFailuresBySourceLastMinute.safeParse({
        join: 1,
        lookup: 2,
      }).success,
    ).toBe(false);
  });

  it('verlangt vollständige PII-freie Yjs-Ablehnungsgründe', () => {
    const reasons = {
      globalRate: 1,
      invalidPath: 2,
      authorizationUnavailable: 3,
      legacyCutoff: 4,
      tokenRequired: 5,
      invalidToken: 6,
      staleGeneration: 7,
      roomRate: 8,
      globalConnectionCap: 9,
      roomConnectionCap: 10,
    };
    expect(
      HealthSecurityStatsDTOSchema.shape.yjsWebSocketRejectedUpgradesByReasonLastMinute.parse(
        reasons,
      ),
    ).toEqual(reasons);
    expect(
      HealthSecurityStatsDTOSchema.shape.yjsWebSocketRejectedUpgradesByReasonLastMinute.safeParse({
        invalidToken: 1,
      }).success,
    ).toBe(false);
  });
});

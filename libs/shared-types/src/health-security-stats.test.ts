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
});

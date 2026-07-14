import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type EnsureSchemaModule = {
  shouldSeedMotdRuntime: (nodeEnv: string | undefined) => boolean;
  shouldSeedMotdMakingOfRuntime: (nodeEnv: string | undefined) => boolean;
  shouldSeedMotdFeatureRuntime: (nodeEnv: string | undefined) => boolean;
  getMotdWelcomeSeedFiles: () => string[];
  getMotdMakingOfSeedFiles: () => string[];
  getMotdFeatureSeedFiles: () => string[];
};

const cjsRequire = createRequire(__filename);
const ensureSchema = cjsRequire(
  path.resolve(__dirname, '../../../../scripts/ensure-schema.js'),
) as EnsureSchemaModule;

describe('ensure-schema MOTD runtime seeding', () => {
  it('überspringt Making-of-Re-Seeding in Produktion', () => {
    expect(ensureSchema.shouldSeedMotdRuntime('production')).toBe(false);
    expect(ensureSchema.shouldSeedMotdMakingOfRuntime('production')).toBe(false);
    expect(ensureSchema.shouldSeedMotdFeatureRuntime('production')).toBe(false);
  });

  it('erlaubt Making-of-Re-Seeding außerhalb der Produktion', () => {
    expect(ensureSchema.shouldSeedMotdRuntime('development')).toBe(true);
    expect(ensureSchema.shouldSeedMotdRuntime(undefined)).toBe(true);
    expect(ensureSchema.shouldSeedMotdMakingOfRuntime('development')).toBe(true);
    expect(ensureSchema.shouldSeedMotdMakingOfRuntime(undefined)).toBe(true);
    expect(ensureSchema.shouldSeedMotdFeatureRuntime('development')).toBe(true);
    expect(ensureSchema.shouldSeedMotdFeatureRuntime(undefined)).toBe(true);
  });

  it('enthält die Banner-Migration in der Dev-Seed-Liste', () => {
    expect(ensureSchema.getMotdMakingOfSeedFiles()).toContain(
      'prisma/migrations/20260401120000_motd_making_of_banner_image/migration.sql',
    );
  });

  it('enthält die aktuellen Feature-MOTD-Migrationen in der Dev-Seed-Liste', () => {
    expect(ensureSchema.getMotdFeatureSeedFiles()).toEqual([
      'prisma/migrations/20260604140000_motd_tempo_feedback/migration.sql',
      'prisma/migrations/20260617133000_motd_numeric_estimate/migration.sql',
      'prisma/migrations/20260624113000_motd_ai_quiz_generation/migration.sql',
      'prisma/migrations/20260713160000_motd_confidence_slider/migration.sql',
      'prisma/migrations/20260713203000_motd_confidence_didactic_summary/migration.sql',
      'prisma/migrations/20260714040000_motd_confidence_copy_v7/migration.sql',
    ]);
  });

  it('seedet die Welcome-MOTD vor der Making-of-Kette', () => {
    expect(ensureSchema.getMotdWelcomeSeedFiles()).toEqual([
      'prisma/migrations/20260327170000_motd_welcome_message/migration.sql',
      'prisma/migrations/20260327200000_motd_welcome_date_adjust/migration.sql',
      'prisma/migrations/20260328103000_motd_welcome_copy_optimize/migration.sql',
      'prisma/migrations/20260329120000_motd_welcome_copy_v4/migration.sql',
      'prisma/migrations/20260524120000_motd_welcome_copy_v5/migration.sql',
      'prisma/migrations/20260524123000_motd_welcome_copy_v6/migration.sql',
      'prisma/migrations/20260525100000_motd_welcome_copy_v7/migration.sql',
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as ensureSchema from '../../../../scripts/ensure-schema.mjs';

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
      'prisma/migrations/20260715071600_motd_confidence_copy_v8/migration.sql',
      'prisma/migrations/20260715075500_motd_confidence_copy_v9/migration.sql',
      'prisma/migrations/20260717153000_motd_session_results_pdf_report/migration.sql',
      'prisma/migrations/20260717164000_motd_session_results_pdf_example_link/migration.sql',
      'prisma/migrations/20260718083400_motd_session_results_pdf_nachbesprechungsplan/migration.sql',
      'prisma/migrations/20260719071500_motd_session_results_pdf_locale_links/migration.sql',
      'prisma/migrations/20260722070000_motd_accessibility_wcag/migration.sql',
      'prisma/migrations/20260809174500_motd_structured_question_types/migration.sql',
    ]);
  });

  it('liefert die neue Fragetyp-MOTD strukturgleich in allen fünf Sprachen aus', () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        '../../prisma/migrations/20260809174500_motd_structured_question_types/migration.sql',
      ),
      'utf8',
    );
    const localeBlocks = [...sql.matchAll(/\$(md(?:de|en|fr|it|es))\$([\s\S]*?)\$\1\$/g)].map(
      ([, , markdown]) => markdown ?? '',
    );

    expect(localeBlocks).toHaveLength(5);
    for (const markdown of localeBlocks) {
      const paragraphs = markdown.split('\n\n');
      expect(paragraphs).toHaveLength(3);
      expect(paragraphs[0]).toMatch(/^### 🧩 /);
      expect(paragraphs[2]).toMatch(/^\*\*.+\*\*$/);
      expect(paragraphs.every((paragraph) => !paragraph.includes('\n'))).toBe(true);
    }
    expect(localeBlocks).toEqual([
      '### 🧩 Neu: Zuordnen. Sortieren. Kategorisieren.\n\nDrei neue Fragetypen sind da! Lass deine Teilnehmenden Begriffe verbinden, Abläufe in die richtige Reihenfolge bringen und Inhalte sinnvoll einordnen. So wird aus einer Wissensabfrage aktives Denken – direkt im Live-Quiz.\n\n**Erstelle eine Frage und probiere es jetzt aus!**',
      '### 🧩 New: Match. Order. Categorize.\n\nThree new question types are here! Invite participants to match concepts, put steps in the right order, and sort content into categories. Turn a simple knowledge check into active thinking – right inside your live quiz.\n\n**Create a question and try it now!**',
      '### 🧩 Nouveau : associer, ordonner, classer.\n\nTrois nouveaux types de questions sont disponibles ! Propose à ton public d’associer des notions, de remettre des étapes dans le bon ordre et de classer des éléments par catégorie. Transforme une simple vérification des connaissances en véritable activité de réflexion – directement dans ton quiz en direct.\n\n**Crée une question et essaie-les dès maintenant !**',
      '### 🧩 Novità: abbina, ordina, classifica.\n\nSono arrivati tre nuovi tipi di domanda! Invita chi partecipa ad abbinare concetti, mettere in ordine le diverse fasi e classificare i contenuti. Trasforma una semplice verifica delle conoscenze in un’attività che fa ragionare – direttamente nel tuo quiz live.\n\n**Crea una domanda e provali subito!**',
      '### 🧩 Novedad: relaciona, ordena y clasifica.\n\n¡Ya están aquí tres nuevos tipos de pregunta! Haz que tus participantes relacionen conceptos, pongan los pasos en el orden correcto y clasifiquen contenidos por categorías. Convierte una simple comprobación de conocimientos en una actividad que invite a pensar – directamente en tu quiz en directo.\n\n**¡Crea una pregunta y pruébalos ahora!**',
    ]);
    expect(sql).not.toMatch(/\b(?:Assignment|Series)\b/);
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

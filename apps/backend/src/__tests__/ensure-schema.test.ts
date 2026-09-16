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
      'prisma/migrations/20260813120000_motd_shared_insight_vision/migration.sql',
      'prisma/migrations/20260906143000_motd_product_feedback/migration.sql',
      'prisma/migrations/20260911140000_motd_personal_time/migration.sql',
      'prisma/migrations/20260916103000_motd_qa_live_channel/migration.sql',
    ]);
  });

  it('liefert die Produktfeedback-MOTD kurz und vollständig in allen fünf Sprachen aus', () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        '../../prisma/migrations/20260906143000_motd_product_feedback/migration.sql',
      ),
      'utf8',
    );
    const localeBlocks = [...sql.matchAll(/\$(md(?:de|en|fr|es|it))\$([\s\S]*?)\$\1\$/g)].map(
      ([, , markdown]) => markdown ?? '',
    );

    expect(localeBlocks).toHaveLength(5);
    for (const markdown of localeBlocks) {
      const paragraphs = markdown.split('\n\n');
      expect(paragraphs).toHaveLength(4);
      expect(paragraphs[0]).toMatch(/^### 💬 /);
      expect(paragraphs[1]).toMatch(/^\*\*.+(?:Tage|days|jours|días|giorni)\.\*\*/);
      expect(markdown).toContain('arsnova.eu');
      expect(markdown).not.toMatch(/Auswahl|selection|sélection|selección|selezione/i);
    }
    expect(localeBlocks[4]).toContain('**«Aiutaci a migliorare arsnova.eu»**');
  });

  it('liefert die Vision-MOTD mit funktionsfähigen Backlog-Links in allen fünf Sprachen aus', () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        '../../prisma/migrations/20260813120000_motd_shared_insight_vision/migration.sql',
      ),
      'utf8',
    );
    const localeBlocks = [...sql.matchAll(/\$(md(?:de|en|fr|it|es))\$([\s\S]*?)\$\1\$/g)].map(
      ([, , markdown]) => markdown ?? '',
    );

    expect(localeBlocks).toHaveLength(5);
    const backlogUrl = 'https://github.com/kqc-real/arsnova.eu/blob/main/Backlog.md';
    for (const markdown of localeBlocks) {
      expect(markdown).toMatch(/^### ✨ /);
      expect(markdown).toContain(backlogUrl);
      expect(markdown.split(backlogUrl)).toHaveLength(3);
      expect(markdown).not.toContain('[[');
      expect(markdown).toMatch(/\n\n> \*\*arsnova\.eu /);
    }
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

  it('liefert die Persönliche-Zeit-MOTD strukturgleich in allen fünf Sprachen aus', () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        '../../prisma/migrations/20260911140000_motd_personal_time/migration.sql',
      ),
      'utf8',
    );
    const localeBlocks = [...sql.matchAll(/\$(md(?:de|en|fr|it|es))\$([\s\S]*?)\$\1\$/g)].map(
      ([, , markdown]) => markdown ?? '',
    );

    expect(localeBlocks).toHaveLength(5);
    for (const markdown of localeBlocks) {
      const paragraphs = markdown.split('\n\n');
      expect(paragraphs).toHaveLength(2);
      expect(paragraphs[0]).toMatch(/^### /);
      expect(paragraphs.every((paragraph) => !paragraph.includes('\n'))).toBe(true);
      expect(markdown).not.toMatch(
        /Fairness-Option|Explore the fairness|Découvrir|Scopri|Descubre/i,
      );
    }
    expect(localeBlocks[0]).toContain('»Persönliche Zeit«');
    expect(localeBlocks[1]).toContain('“Personal time”');
    expect(localeBlocks[2]).toContain('« Temps personnalisé »');
    expect(localeBlocks[3]).toContain('«Tempo personalizzato»');
    expect(localeBlocks[4]).toContain('«Tiempo personalizado»');
    expect(sql).toContain("'c0777777-c777-4c77-8c77-c07777777777'");
  });

  it('liefert die Live-Q&A-MOTD strukturgleich in allen fünf Sprachen aus', () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        '../../prisma/migrations/20260916103000_motd_qa_live_channel/migration.sql',
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
      expect(markdown).not.toMatch(/Epic|#405|GitHub|Backlog/i);
    }
    expect(localeBlocks).toEqual([
      '### 🧩 Fragen vorher einholen – vorbereitet starten.\n\nMit »Q&A erstellen« legst du schon vor der Veranstaltung eine Fragenwand an und teilst den Code. Teilnehmende schreiben in Ruhe; du siehst, was unklar ist, sortierst und wertest aus – und gehst vorbereitet in die Sitzung.\n\n**Hol dir jetzt die Fragen für deine nächste Stunde oder deinen nächsten Termin.**',
      '### 🧩 Gather questions beforehand – then walk in prepared.\n\nUse “Create Q&A” to open a question wall and share the code before the event. People can send questions in their own time; you see what’s unclear, sort and review – and you arrive ready.\n\n**Collect the questions for your next class or event now.**',
      '### 🧩 Recueille les questions avant – arrive préparé.\n\nAvec « Créer un Q&A », tu ouvres un mur de questions et tu partages le code avant l’événement. Chacun écrit à son rythme ; tu vois ce qui bloque, tu tries et tu fais le point – et tu prépares ta séance sur cette base.\n\n**Récupère dès maintenant les questions de ton prochain cours ou rendez-vous.**',
      '### 🧩 Raccogli le domande prima – e arriva preparato.\n\nCon «Crea un Q&A» apri un muro delle domande e condividi il codice già prima dell’incontro. Chi partecipa scrive con calma; tu vedi i dubbi, li ordini e li usi per prepararti.\n\n**Raccogli adesso le domande per la tua prossima lezione o il tuo prossimo appuntamento.**',
      '### 🧩 Recoge las preguntas antes – y llega con la sesión pensada.\n\nCon «Crear un Q&A» abres un muro de preguntas y compartes el código antes del encuentro. Quien participa escribe con calma; tú ves qué no está claro, ordenas y evalúas – y llegas preparado.\n\n**Recoge ya las preguntas de tu próxima clase o de tu próximo evento.**',
    ]);
    expect(localeBlocks[0]).toContain('»Q&A erstellen«');
    expect(localeBlocks[1]).toContain('“Create Q&A”');
    expect(localeBlocks[2]).toContain('« Créer un Q&A »');
    expect(localeBlocks[3]).toContain('«Crea un Q&A»');
    expect(localeBlocks[4]).toContain('«Crear un Q&A»');
    expect(sql).toContain("'c0888888-c888-4c88-8c88-c08888888888'");
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

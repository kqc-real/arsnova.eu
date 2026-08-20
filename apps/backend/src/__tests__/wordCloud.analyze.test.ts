import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';
import { SpacyClientError } from '../lib/spacyClient';
import * as spacyClient from '../lib/spacyClient';

const { extractHostTokenFromContextMock, isHostSessionTokenValidMock } = vi.hoisted(() => ({
  extractHostTokenFromContextMock: vi.fn(),
  isHostSessionTokenValidMock: vi.fn(),
}));

vi.mock('../lib/hostAuth', () => ({
  extractHostTokenFromContext: extractHostTokenFromContextMock,
  isHostSessionTokenValid: isHostSessionTokenValidMock,
}));

import { wordCloudRouter, analyzeWordCloudSnapshot } from '../routers/wordCloud';
import { createMemoryWordCloudAnalysisCache } from '../lib/wordCloudAnalysisCache';
import {
  resetWordCloudNlpTelemetryForTests,
  snapshotWordCloudNlpTelemetry,
} from '../lib/wordCloudNlpTelemetry';
import { logger } from '../lib/logger';

const hostCaller = wordCloudRouter.createCaller({ req: {} as never });

describe('wordCloud.analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    extractHostTokenFromContextMock.mockReturnValue('host-token-123');
    isHostSessionTokenValidMock.mockResolvedValue(true);
  });

  trpcDodIt(
    {
      procedure: 'wordCloud.analyze',
      case: 'happy',
      mode: 'direct',
      title: 'buendelt paraphrasennahe Fragen im Themenmodus zu erklaerbaren Clustern',
    },
    async () => {
      const result = await hostCaller.analyze({
        sessionCode: 'ABC123',
        mode: 'THEME',
        locale: 'de',
        metric: 'BEST',
        maxEntries: 5,
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            text: 'Kommt Kapitel 4 in der Klausur vor?',
            weight: 8,
          },
          {
            id: '22222222-2222-4222-8222-222222222222',
            text: 'Brauchen wir Kapitel 4 fuer die Pruefung?',
            weight: 5,
          },
          {
            id: '33333333-3333-4333-8333-333333333333',
            text: 'Wie funktioniert lineare Regression im Praxisprojekt?',
            weight: 3,
          },
          {
            id: '44444444-4444-4444-8444-444444444444',
            text: 'Wann nutzen wir lineare Regression fuer Prognosen?',
            weight: 4,
          },
        ],
      });

      expect(result.mode).toBe('THEME');
      expect(result.metric).toBe('BEST');
      expect(result.fallbackUsed).toBe(false);
      expect(result.status).toBe('ready');
      expect(result.modelVersion).toBeNull();
      expect(result.normalization).toBe('NONE');
      expect(result.normalizationApplied).toBe('NONE');
      expect(result.normalizationFallbackUsed).toBe(false);
      expect(result.normalizationFallbackReason).toBeNull();
      expect(result.analysisVersion).toBe('1.14b.8');
      expect(result.snapshotHash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0]).toMatchObject({
        key: 'kapitel 4',
        label: 'Kapitel 4',
        count: 13,
        basisLabel: 'Kapitel 4',
        variants: ['Kapitel 4'],
      });
      expect(result.entries[0]?.members).toHaveLength(2);
      expect(result.entries[0]?.members.map((member) => member.text)).toEqual([
        'Kommt Kapitel 4 in der Klausur vor?',
        'Brauchen wir Kapitel 4 fuer die Pruefung?',
      ]);
      expect(result.entries[0]?.confidence).toBeGreaterThanOrEqual(0.65);
      expect(result.entries[0]?.confidence).toBeLessThan(0.85);
      expect(result.entries[1]).toMatchObject({
        key: 'lineare regression',
        label: 'lineare Regression',
        count: 7,
        basisLabel: 'lineare Regression',
        variants: ['lineare Regression'],
      });
      expect(result.entries[1]?.confidence).toBeGreaterThanOrEqual(0.65);
      expect(result.entries[1]?.confidence).toBeLessThan(0.85);
    },
  );

  it('buendelt englische Paraphrasen im Themenmodus ueber gemeinsame Kernphrasen', async () => {
    const result = await hostCaller.analyze({
      sessionCode: 'ABC123',
      mode: 'THEME',
      locale: 'en',
      metric: 'TOP',
      items: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          text: 'How does linear regression work in practice?',
          weight: 4,
        },
        {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          text: 'When do we use linear regression for forecasts?',
          weight: 5,
        },
      ],
    });

    expect(result.fallbackUsed).toBe(false);
    expect(result.entries).toMatchObject([
      {
        key: 'linear regression',
        label: 'linear regression',
        count: 9,
        basisLabel: 'linear regression',
        variants: ['linear regression'],
      },
    ]);
    expect(result.entries[0]?.members).toHaveLength(2);
  });

  it('bevorzugt fachliche Kernphrasen vor generischen Q&A-Traegern im Deutschen', async () => {
    const result = await hostCaller.analyze({
      sessionCode: 'ABC123',
      mode: 'THEME',
      locale: 'de',
      metric: 'TOP',
      items: [
        {
          id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          text: 'Welche Themen zur linearen Regression sind klausurrelevant?',
          weight: 6,
        },
        {
          id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          text: 'Koennen wir das Thema lineare Regression fuer die Pruefung einordnen?',
          weight: 4,
        },
      ],
    });

    expect(result.fallbackUsed).toBe(false);
    expect(result.entries).toMatchObject([
      {
        key: 'lineare regression',
        label: 'lineare Regression',
        count: 10,
        basisLabel: 'lineare Regression',
        variants: ['lineare Regression'],
      },
    ]);
    expect(result.entries[0]?.label.toLocaleLowerCase()).not.toContain('thema');
    expect(result.entries[0]?.label.toLocaleLowerCase()).not.toContain('klausur');
  });

  it('filtert zusaetzliche deutsche Traegerwoerter wie sich, werden oder schwaecht im Themenmodus', async () => {
    const result = await hostCaller.analyze({
      sessionCode: 'ABC123',
      mode: 'THEME',
      locale: 'de',
      metric: 'TOP',
      items: [
        {
          id: 'abababab-abab-4bab-8bab-abababababab',
          text: 'Erkläre, warum sich beim Wahlrecht eher große Unterschiede zeigen und woran es direkt liegt.',
          weight: 5,
        },
        {
          id: 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd',
          text: 'Warum werden über das Wahlrecht trotz mehr Debatten neue Modelle diskutiert, obwohl manches dran bleibt?',
          weight: 4,
        },
        {
          id: 'efefefef-efef-4fef-8fef-efefefefefef',
          text: 'Was hilft beim Wahlrecht, wenn ein Vorschlag kleiner wirkt, Parteien schwächt und sich schwer erklären lässt?',
          weight: 3,
        },
      ],
    });

    expect(result.fallbackUsed).toBe(false);
    expect(result.entries).toMatchObject([
      {
        key: 'wahlrecht',
        label: 'Wahlrecht',
        count: 12,
        basisLabel: 'Wahlrecht',
        variants: ['Wahlrecht'],
      },
    ]);
    expect(result.entries[0]?.label.toLocaleLowerCase()).not.toContain('sich');
    expect(result.entries[0]?.label.toLocaleLowerCase()).not.toContain('werden');
    expect(result.entries[0]?.label.toLocaleLowerCase()).not.toContain('über');
    expect(result.entries[0]?.label.toLocaleLowerCase()).not.toContain('schwächt');
  });

  it('bevorzugt fachliche Kernphrasen vor generischen Q&A-Traegern im Englischen', async () => {
    const result = await hostCaller.analyze({
      sessionCode: 'ABC123',
      mode: 'THEME',
      locale: 'en',
      metric: 'TOP',
      items: [
        {
          id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
          text: 'Which topic about linear regression is exam relevant?',
          weight: 5,
        },
        {
          id: '99999999-9999-4999-8999-999999999999',
          text: 'Can we place the topic linear regression for the exam?',
          weight: 4,
        },
      ],
    });

    expect(result.fallbackUsed).toBe(false);
    expect(result.entries).toMatchObject([
      {
        key: 'linear regression',
        label: 'linear regression',
        count: 9,
        basisLabel: 'linear regression',
        variants: ['linear regression'],
      },
    ]);
    expect(result.entries[0]?.label.toLocaleLowerCase()).not.toContain('topic');
    expect(result.entries[0]?.label.toLocaleLowerCase()).not.toContain('exam');
  });

  it('stuft einen einzelnen numerischen Themenanker vorsichtig ein', async () => {
    const result = await hostCaller.analyze({
      sessionCode: 'ABC123',
      mode: 'THEME',
      locale: 'de',
      metric: 'TOP',
      items: [
        {
          id: '12121212-1212-4212-8212-121212121212',
          text: 'Kommt Kapitel 4 in der Klausur vor?',
          weight: 4,
        },
      ],
    });

    expect(result.fallbackUsed).toBe(false);
    expect(result.entries).toMatchObject([
      {
        key: 'kapitel 4',
        label: 'Kapitel 4',
        count: 4,
        basisLabel: 'Kapitel 4',
        variants: ['Kapitel 4'],
      },
    ]);
    expect(result.entries[0]?.confidence).toBeLessThan(0.65);
  });

  it('stuft dreifach belegte Themencluster als hohe Sicherheit ein', async () => {
    const result = await hostCaller.analyze({
      sessionCode: 'ABC123',
      mode: 'THEME',
      locale: 'de',
      metric: 'TOP',
      items: [
        {
          id: '13131313-1313-4313-8313-131313131313',
          text: 'Wie funktioniert lineare Regression im Praxisprojekt?',
          weight: 4,
        },
        {
          id: '14141414-1414-4414-8414-141414141414',
          text: 'Wann nutzen wir lineare Regression fuer Prognosen?',
          weight: 5,
        },
        {
          id: '15151515-1515-4515-8515-151515151515',
          text: 'Wo setzen wir lineare Regression in der Uebung ein?',
          weight: 3,
        },
      ],
    });

    expect(result.fallbackUsed).toBe(false);
    expect(result.entries).toMatchObject([
      {
        key: 'lineare regression',
        label: 'lineare Regression',
        count: 12,
        basisLabel: 'lineare Regression',
        variants: ['lineare Regression'],
      },
    ]);
    expect(result.entries[0]?.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('faellt bei unsicherem Einzel-Theme kontrolliert lexikalisch zurueck', async () => {
    const result = await hostCaller.analyze({
      sessionCode: 'ABC123',
      mode: 'THEME',
      locale: 'de',
      metric: 'TOP',
      items: [
        {
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          text: 'Welche Frage gewinnt?',
          weight: 4,
        },
      ],
    });

    expect(result.fallbackUsed).toBe(true);
    expect(result.entries).toMatchObject([
      {
        key: 'gewinnt',
        label: 'gewinnt',
        count: 4,
        basisLabel: null,
        variants: ['gewinnt'],
      },
    ]);
  });

  it('aggregiert im lexikalischen Pfad Tokens statt kompletter Fragetexte', async () => {
    const result = await hostCaller.analyze({
      sessionCode: 'ABC123',
      mode: 'LEXICAL',
      locale: 'de',
      metric: 'TOP',
      items: [
        {
          id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          text: 'Welche Frage gewinnt?',
          weight: 2,
        },
        {
          id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          text: 'Welche Frage bleibt zur Regression?',
          weight: 1,
        },
      ],
    });

    expect(result.fallbackUsed).toBe(false);
    expect(result.entries.map((entry) => entry.key)).not.toContain('welche frage gewinnt?');
    expect(result.entries.slice(0, 2)).toMatchObject([
      {
        key: 'gewinnt',
        label: 'gewinnt',
        count: 2,
        variants: ['gewinnt'],
      },
      {
        key: 'regression',
        label: 'Regression',
        count: 1,
        variants: ['Regression'],
      },
    ]);
  });

  it('faellt bei angeforderter Lemma-Glaettung ohne NLP auf NONE zurueck', async () => {
    const result = await hostCaller.analyze({
      sessionCode: 'ABC123',
      mode: 'LEXICAL',
      locale: 'de',
      metric: 'TOP',
      normalization: 'LEMMA',
      items: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          text: 'Fragen zur Validierung',
          weight: 2,
        },
      ],
    });

    expect(result.fallbackUsed).toBe(false);
    expect(result.normalization).toBe('LEMMA');
    expect(result.normalizationApplied).toBe('NONE');
    expect(result.normalizationFallbackUsed).toBe(true);
    expect(result.normalizationFallbackReason).toBe('NLP_DISABLED');
    expect(result.modelId).toBeNull();
    expect(result.entries.length).toBeGreaterThan(0);
  });

  it('wendet THEME + LEMMA nicht an und laesst den Themenpfad unangetastet', async () => {
    const result = await hostCaller.analyze({
      sessionCode: 'ABC123',
      mode: 'THEME',
      locale: 'de',
      metric: 'BEST',
      normalization: 'LEMMA',
      items: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          text: 'Kommt Kapitel 4 in der Klausur vor?',
          weight: 8,
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          text: 'Brauchen wir Kapitel 4 fuer die Pruefung?',
          weight: 5,
        },
      ],
    });

    expect(result.mode).toBe('THEME');
    expect(result.fallbackUsed).toBe(false);
    expect(result.normalization).toBe('LEMMA');
    expect(result.normalizationApplied).toBe('NONE');
    expect(result.normalizationFallbackReason).toBe('MODE_UNSUPPORTED');
    expect(result.entries[0]).toMatchObject({
      key: 'kapitel 4',
      label: 'Kapitel 4',
    });
  });

  it('faellt SEMANTIC ohne Encoder auf den 2.x-Themenpfad mit status disabled', async () => {
    const sidecar = vi.spyOn(spacyClient, 'normalizeWithSpacySidecar');
    const result = await hostCaller.analyze({
      sessionCode: 'ABC123',
      mode: 'SEMANTIC',
      locale: 'de',
      metric: 'BEST',
      items: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          text: 'Kommt Kapitel 4 in der Klausur vor?',
          weight: 8,
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          text: 'Brauchen wir Kapitel 4 fuer die Pruefung?',
          weight: 5,
        },
        {
          id: '33333333-3333-4333-8333-333333333333',
          text: 'Wie funktioniert lineare Regression im Praxisprojekt?',
          weight: 3,
        },
        {
          id: '44444444-4444-4444-8444-444444444444',
          text: 'Wann nutzen wir lineare Regression fuer Prognosen?',
          weight: 4,
        },
      ],
    });

    expect(sidecar).not.toHaveBeenCalled();
    expect(result.mode).toBe('SEMANTIC');
    expect(result.status).toBe('disabled');
    expect(result.fallbackUsed).toBe(true);
    expect(result.modelVersion).toBeNull();
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toMatchObject({
      key: 'kapitel 4',
      label: 'Kapitel 4',
    });
    expect(result.entries[0]?.members).toHaveLength(2);
  });

  it('liefert SEMANTIC ohne Items als disabled ohne leeren Sondervertrag', async () => {
    const result = await hostCaller.analyze({
      sessionCode: 'ABC123',
      mode: 'SEMANTIC',
      locale: 'de',
      metric: 'TOP',
      items: [],
    });

    expect(result.mode).toBe('SEMANTIC');
    expect(result.status).toBe('disabled');
    expect(result.fallbackUsed).toBe(true);
    expect(result.entries).toEqual([]);
  });

  it('cacht Themenanalysen ohne Sidecar-Aufruf', async () => {
    const sidecar = vi.spyOn(spacyClient, 'normalizeWithSpacySidecar');
    const cache = createMemoryWordCloudAnalysisCache();
    const input = {
      sessionCode: 'ABC123',
      mode: 'THEME' as const,
      locale: 'de' as const,
      metric: 'BEST' as const,
      normalization: 'NONE' as const,
      items: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          text: 'Kommt Kapitel 4 in der Klausur vor?',
          weight: 8,
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          text: 'Brauchen wir Kapitel 4 fuer die Pruefung?',
          weight: 5,
        },
      ],
    };

    const first = await analyzeWordCloudSnapshot(input, { cache });
    const second = await analyzeWordCloudSnapshot(input, { cache });

    expect(sidecar).not.toHaveBeenCalled();
    expect(first.fallbackUsed).toBe(false);
    expect(second.generatedAt).toBe(first.generatedAt);
    expect(second.entries[0]).toMatchObject({ key: 'kapitel 4', label: 'Kapitel 4' });

    const getSnapshot = vi.spyOn(cache, 'getSnapshot');
    await analyzeWordCloudSnapshot({ ...input, refresh: true }, { cache });
    expect(getSnapshot).not.toHaveBeenCalled();
    sidecar.mockRestore();
  });

  describe('LEXICAL + LEMMA', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    });

    it('faellt ohne erreichbaren Sidecar hart auf Identity zurueck', async () => {
      vi.stubEnv('NLP_ENABLED', 'true');
      vi.stubEnv('NLP_SOCKET_PATH', '/tmp/arsnova-missing-nlp.sock');

      const result = await hostCaller.analyze({
        sessionCode: 'ABC123',
        mode: 'LEXICAL',
        locale: 'de',
        metric: 'TOP',
        normalization: 'LEMMA',
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            text: 'Häuser',
            weight: 2,
          },
          {
            id: '22222222-2222-4222-8222-222222222222',
            text: 'Haus',
            weight: 1,
          },
        ],
      });

      expect(result.fallbackUsed).toBe(false);
      expect(result.normalizationApplied).toBe('NONE');
      expect(result.normalizationFallbackReason).toBe('SIDECAR_UNAVAILABLE');
      expect(result.entries.map((entry) => entry.key).sort()).toEqual(['haeuser', 'haus']);
    });

    it('buendelt Nomenformen, wenn der Sidecar Lemma-Tokens liefert', async () => {
      vi.stubEnv('NLP_ENABLED', 'true');
      vi.spyOn(spacyClient, 'normalizeWithSpacySidecar').mockResolvedValue({
        locale: 'de',
        modelId: 'de_core_news_sm@3.8.0',
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            tokens: [{ text: 'Häuser', lemma: 'Haus', pos: 'NOUN' }],
          },
          {
            id: '22222222-2222-4222-8222-222222222222',
            tokens: [{ text: 'Haus', lemma: 'Haus', pos: 'NOUN' }],
          },
        ],
      });

      const result = await hostCaller.analyze({
        sessionCode: 'ABC123',
        mode: 'LEXICAL',
        locale: 'de',
        metric: 'TOP',
        normalization: 'LEMMA',
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            text: 'Häuser',
            weight: 2,
          },
          {
            id: '22222222-2222-4222-8222-222222222222',
            text: 'Haus',
            weight: 1,
          },
        ],
      });

      expect(result.normalizationApplied).toBe('LEMMA');
      expect(result.normalizationFallbackUsed).toBe(false);
      expect(result.modelId).toBe('de_core_news_sm@3.8.0');
      expect(result.entries).toMatchObject([
        {
          key: 'haus',
          label: 'Haus',
          count: 3,
          variants: ['Haus'],
        },
      ]);
    });

    it('nimmt geglaettete Bigramme auf, wenn maxNgramLength Phrasen erlaubt', async () => {
      vi.stubEnv('NLP_ENABLED', 'true');
      vi.spyOn(spacyClient, 'normalizeWithSpacySidecar').mockResolvedValue({
        locale: 'de',
        modelId: 'de_core_news_sm@3.8.0',
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            tokens: [
              { text: 'lineare', lemma: 'linear', pos: 'ADJ' },
              { text: 'Regression', lemma: 'Regression', pos: 'NOUN' },
            ],
          },
          {
            id: '22222222-2222-4222-8222-222222222222',
            tokens: [
              { text: 'lineare', lemma: 'linear', pos: 'ADJ' },
              { text: 'Regressionen', lemma: 'Regression', pos: 'NOUN' },
            ],
          },
        ],
      });

      const result = await hostCaller.analyze({
        sessionCode: 'ABC123',
        mode: 'LEXICAL',
        locale: 'de',
        metric: 'TOP',
        normalization: 'LEMMA',
        maxNgramLength: 3,
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            text: 'lineare Regression',
            weight: 1,
          },
          {
            id: '22222222-2222-4222-8222-222222222222',
            text: 'lineare Regressionen',
            weight: 1,
          },
        ],
      });

      expect(result.normalizationApplied).toBe('LEMMA');
      expect(result.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: 'regression',
            label: 'Regression',
            count: 2,
          }),
          expect.objectContaining({
            key: 'linear regression',
            label: 'linear Regression',
            count: 2,
          }),
        ]),
      );
    });

    it('meldet Sidecar-Timeout als Normalisierungs-Fallback', async () => {
      vi.stubEnv('NLP_ENABLED', 'true');
      vi.spyOn(spacyClient, 'normalizeWithSpacySidecar').mockRejectedValue(
        new SpacyClientError('TIMEOUT'),
      );

      const result = await hostCaller.analyze({
        sessionCode: 'ABC123',
        mode: 'LEXICAL',
        locale: 'de',
        metric: 'TOP',
        normalization: 'LEMMA',
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            text: 'Häuser',
            weight: 2,
          },
        ],
      });

      expect(result.normalizationApplied).toBe('NONE');
      expect(result.normalizationFallbackReason).toBe('TIMEOUT');
      expect(result.fallbackUsed).toBe(false);
      expect(result.entries[0]?.key).toBe('haeuser');
    });

    it('meldet ungueltige Sidecar-Antworten als Normalisierungs-Fallback', async () => {
      vi.stubEnv('NLP_ENABLED', 'true');
      vi.spyOn(spacyClient, 'normalizeWithSpacySidecar').mockRejectedValue(
        new SpacyClientError('INVALID_RESPONSE'),
      );

      const result = await hostCaller.analyze({
        sessionCode: 'ABC123',
        mode: 'LEXICAL',
        locale: 'de',
        metric: 'TOP',
        normalization: 'LEMMA',
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            text: 'Häuser',
            weight: 2,
          },
        ],
      });

      expect(result.normalizationApplied).toBe('NONE');
      expect(result.normalizationFallbackReason).toBe('INVALID_RESPONSE');
      expect(result.entries[0]?.key).toBe('haeuser');
    });

    it('liefert fuer leere Snapshots keine Eintraege', async () => {
      const result = await hostCaller.analyze({
        sessionCode: 'ABC123',
        mode: 'LEXICAL',
        locale: 'de',
        metric: 'TOP',
        items: [],
      });

      expect(result.entries).toEqual([]);
      expect(result.fallbackUsed).toBe(false);
    });

    it('ruft den Sidecar bei THEME + LEMMA und SEMANTIC + LEMMA nicht an', async () => {
      vi.stubEnv('NLP_ENABLED', 'true');
      const sidecar = vi.spyOn(spacyClient, 'normalizeWithSpacySidecar');

      const theme = await hostCaller.analyze({
        sessionCode: 'ABC123',
        mode: 'THEME',
        locale: 'de',
        metric: 'BEST',
        normalization: 'LEMMA',
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            text: 'Kommt Kapitel 4 in der Klausur vor?',
            weight: 8,
          },
          {
            id: '22222222-2222-4222-8222-222222222222',
            text: 'Brauchen wir Kapitel 4 fuer die Pruefung?',
            weight: 5,
          },
        ],
      });

      const semantic = await hostCaller.analyze({
        sessionCode: 'ABC123',
        mode: 'SEMANTIC',
        locale: 'de',
        metric: 'BEST',
        normalization: 'LEMMA',
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            text: 'Kommt Kapitel 4 in der Klausur vor?',
            weight: 8,
          },
          {
            id: '22222222-2222-4222-8222-222222222222',
            text: 'Brauchen wir Kapitel 4 fuer die Pruefung?',
            weight: 5,
          },
        ],
      });

      expect(sidecar).not.toHaveBeenCalled();
      expect(theme.normalizationFallbackReason).toBe('MODE_UNSUPPORTED');
      expect(theme.entries[0]).toMatchObject({
        key: 'kapitel 4',
        label: 'Kapitel 4',
      });
      expect(semantic.mode).toBe('SEMANTIC');
      expect(semantic.status).toBe('disabled');
      expect(semantic.normalizationFallbackReason).toBe('MODE_UNSUPPORTED');
      expect(semantic.entries[0]).toMatchObject({
        key: 'kapitel 4',
        label: 'Kapitel 4',
      });
    });

    it('liefert denselben Snapshot beim zweiten Aufruf aus dem Cache', async () => {
      vi.stubEnv('NLP_ENABLED', 'true');
      const sidecar = vi.spyOn(spacyClient, 'normalizeWithSpacySidecar').mockResolvedValue({
        locale: 'de',
        modelId: 'de_core_news_sm@3.8.0',
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            tokens: [{ text: 'Häuser', lemma: 'Haus', pos: 'NOUN' }],
          },
        ],
      });
      const cache = createMemoryWordCloudAnalysisCache();
      const input = {
        sessionCode: 'ABC123',
        mode: 'LEXICAL' as const,
        locale: 'de' as const,
        metric: 'TOP' as const,
        normalization: 'LEMMA' as const,
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            text: 'Häuser',
            weight: 2,
          },
        ],
      };

      resetWordCloudNlpTelemetryForTests();
      const first = await analyzeWordCloudSnapshot(input, { cache });
      const second = await analyzeWordCloudSnapshot(input, { cache });

      expect(sidecar).toHaveBeenCalledOnce();
      expect(second.generatedAt).toBe(first.generatedAt);
      expect(second.normalizationApplied).toBe('LEMMA');
      expect(snapshotWordCloudNlpTelemetry()).toMatchObject({
        snapshotHits: 1,
        snapshotMisses: 1,
        sidecarCalls: 1,
      });
    });

    it('nutzt den Text-Cache ueber Sessiongrenzen und cacht Timeouts nicht', async () => {
      vi.stubEnv('NLP_ENABLED', 'true');
      const sidecar = vi.spyOn(spacyClient, 'normalizeWithSpacySidecar').mockResolvedValue({
        locale: 'de',
        modelId: 'de_core_news_sm@3.8.0',
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            tokens: [{ text: 'Häuser', lemma: 'Haus', pos: 'NOUN' }],
          },
        ],
      });
      const cache = createMemoryWordCloudAnalysisCache();
      const base = {
        mode: 'LEXICAL' as const,
        locale: 'de' as const,
        metric: 'TOP' as const,
        normalization: 'LEMMA' as const,
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            text: 'Häuser',
            weight: 2,
          },
        ],
      };

      resetWordCloudNlpTelemetryForTests();
      await analyzeWordCloudSnapshot({ ...base, sessionCode: 'ABC123' }, { cache });
      await analyzeWordCloudSnapshot({ ...base, sessionCode: 'XYZ789' }, { cache });
      expect(sidecar).toHaveBeenCalledOnce();
      expect(snapshotWordCloudNlpTelemetry()).toMatchObject({
        snapshotHits: 0,
        snapshotMisses: 2,
        sidecarCalls: 1,
        textHits: 1,
        textMisses: 1,
      });

      sidecar.mockRejectedValue(new SpacyClientError('TIMEOUT'));
      const timeoutInput = {
        ...base,
        sessionCode: 'TMO001',
        items: [
          {
            id: '22222222-2222-4222-8222-222222222222',
            text: 'Fragen',
            weight: 1,
          },
        ],
      };
      const firstTimeout = await analyzeWordCloudSnapshot(timeoutInput, { cache });
      expect(firstTimeout.normalizationFallbackReason).toBe('TIMEOUT');
      expect(await cache.getSnapshot(timeoutInput)).toBeNull();
      await analyzeWordCloudSnapshot(timeoutInput, { cache });
      expect(sidecar).toHaveBeenCalledTimes(3);
    });

    it('loggt Analyse-Telemetrie ohne Rohtexte und Socketpfad', async () => {
      vi.stubEnv('NLP_ENABLED', 'true');
      vi.stubEnv('NLP_SOCKET_PATH', '/run/spacy/nlp.sock');
      vi.spyOn(spacyClient, 'normalizeWithSpacySidecar').mockResolvedValue({
        locale: 'de',
        modelId: 'de_core_news_sm@3.8.0',
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            tokens: [{ text: 'Häuser', lemma: 'Haus', pos: 'NOUN' }],
          },
        ],
      });
      const info = vi.spyOn(logger, 'info');
      await analyzeWordCloudSnapshot(
        {
          sessionCode: 'ABC123',
          mode: 'LEXICAL',
          locale: 'de',
          metric: 'TOP',
          normalization: 'LEMMA',
          items: [
            {
              id: '11111111-1111-4111-8111-111111111111',
              text: 'Häuser',
              weight: 2,
            },
          ],
        },
        { cache: createMemoryWordCloudAnalysisCache() },
      );

      const payload = info.mock.calls.find((call) => call[0] === 'wordcloud:analyze')?.[1];
      expect(payload).toMatchObject({
        sessionCode: 'ABC123',
        snapshotCache: 'miss',
        sidecarCalled: true,
      });
      expect(JSON.stringify(payload)).not.toContain('Häuser');
      expect(JSON.stringify(payload)).not.toContain('/run/spacy/nlp.sock');
    });
  });

  trpcDodIt(
    {
      procedure: 'wordCloud.analyze',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'lehnt den Analysepfad ohne gueltigen Host-Token ab',
    },
    async () => {
      extractHostTokenFromContextMock.mockReturnValue(null);

      await expect(
        hostCaller.analyze({
          sessionCode: 'ABC123',
          mode: 'LEXICAL',
          locale: 'de',
          metric: 'TOP',
          items: [
            {
              id: '11111111-1111-4111-8111-111111111111',
              text: 'Kapitel 4 in der Klausur',
              weight: 8,
            },
          ],
        }),
      ).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Host-Authentifizierung erforderlich.',
      });
    },
  );
});

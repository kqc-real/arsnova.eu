import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import {
  AnalyzeWordCloudInputSchema,
  WORD_CLOUD_SEMANTIC_COSINE_THRESHOLD,
  WORD_CLOUD_SEMANTIC_LOCALES,
  type AnalyzeWordCloudInput,
  type WordCloudAnalysisChannel,
  type WordCloudSemanticLocale,
} from '@arsnova/shared-types';
import { toWordCloudAnalysisSourceText } from '../src/lib/wordCloudAnalysis';
import {
  embedWithWordCloudEncoder,
  resetWordCloudEncoderClientForTests,
} from '../src/lib/wordCloudEncoderClient';
import { resolveWordCloudNormalizationMeta } from '../src/lib/wordCloudNormalization';
import {
  analyzeSemanticWordCloudSnapshot,
  resetWordCloudSemanticAnalyzeForTests,
} from '../src/lib/wordCloudSemanticAnalyze';
import {
  clusterWordCloudEmbeddings,
  hasReliableSemanticCluster,
  rankSemanticClusters,
  type WordCloudEmbedding,
} from '../src/lib/wordCloudSemanticCluster';
import { resolveWordCloudSemanticConfig } from '../src/lib/wordCloudSemanticConfig';
import { buildSemanticQaQuestionTexts } from './lib/semantic-wordcloud-seed-corpus';

const models = ['e5', 'minilm', 'gemma'] as const;
type Model = (typeof models)[number];
type Sample = { id: string; text: string; group: string; weight: number };
type Case = {
  name: string;
  split: 'calibration' | 'test';
  channel: WordCloudAnalysisChannel;
  locale: WordCloudSemanticLocale | 'mixed';
  items: Sample[];
};
type EmbeddedCase = Case & { embeddings: WordCloudEmbedding[] };
type Pair = [string, string];
type Measurement = {
  channel: WordCloudAnalysisChannel;
  count: number;
  snapshotHash: string;
  coldMs: number;
  warmMs: number;
  requestTimeouts: number;
  coldStatus: string | undefined;
  warmStatus: string | undefined;
  warmEncoderRequests: number;
};
type LoadRecord = { kind: 'load'; ms: number; modelVersion: string };
type EmbedRecord = { kind: 'embed'; ms: number; items: number; snapshotHash: string };

const root = process.cwd();
const locales = WORD_CLOUD_SEMANTIC_LOCALES;
const repeats = Number(process.env.WORD_CLOUD_BENCH_REPEATS ?? 3);
const image = process.env.WORD_CLOUD_BENCH_IMAGE ?? 'arsnova-wordcloud-encoder:e5-small';
const modelsDir = resolve(process.argv[2] ?? '/private/tmp/arsnova-695-bench');
const adapter = join(root, 'apps/backend/scripts/word-cloud-model-comparison-sidecar.py');

function docker(args: string[]): string {
  return execFileSync('docker', args, { encoding: 'utf8', timeout: 150_000 }).trim();
}

function digestFile(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function modelDigests(model: Model) {
  const directory = join(modelsDir, model);
  const graph = join(directory, 'onnx/model_quantized.onnx');
  return {
    onnxSha256: digestFile(graph),
    ...(model === 'gemma' && {
      onnxDataSha256: digestFile(`${graph}_data`),
      tokenizerConfigSha256: digestFile(join(directory, 'tokenizer_config.json')),
    }),
    tokenizerSha256: digestFile(join(directory, 'tokenizer.json')),
  };
}

function readCases(): Case[] {
  const file = join(root, 'docs/examples/word-cloud-model-comparison-695.tsv');
  const [header, ...lines] = readFileSync(file, 'utf8').trimEnd().split('\n');
  const expectedHeader = ['split', 'channel', 'case', 'group', ...locales].join('\t');
  if (header !== expectedHeader) {
    throw new Error(`Wrong corpus header, expected ${expectedHeader}`);
  }

  const cases = new Map<string, Case>();
  for (const [index, line] of lines.entries()) {
    const [split, channel, name, group, ...texts] = line.split('\t');
    if (
      (split !== 'test' && split !== 'calibration') ||
      (channel !== 'QA' && channel !== 'FREETEXT') ||
      !name ||
      !group ||
      texts.length !== locales.length ||
      texts.some((text) => !text.trim())
    ) {
      throw new Error(`Invalid corpus row ${index + 2}`);
    }

    for (const [localeIndex, locale] of locales.entries()) {
      const sample = {
        id: `${locale}-${index}`,
        text: texts[localeIndex]!,
        group: group === '-' ? `${locale}-${index}` : group,
        weight: 1,
      };
      const caseLocales =
        localeIndex === index % locales.length ? [locale, 'mixed' as const] : [locale];
      for (const caseLocale of caseLocales) {
        const key = `${split}/${channel}/${name}/${caseLocale}`;
        const current = cases.get(key) ?? { name, split, channel, locale: caseLocale, items: [] };
        current.items.push(sample);
        cases.set(key, current);
      }
    }
  }

  const teaching = JSON.parse(
    readFileSync(join(root, 'docs/examples/word-cloud-teaching-corpus.v1.json'), 'utf8'),
  ) as Record<'qa' | 'freetext', Array<Omit<Sample, 'group'>>> & {
    expected: Record<
      'qaClusters' | 'freetextClusters',
      Array<{ members: string[]; modelLabel: string }>
    >;
  };
  for (const channel of ['QA', 'FREETEXT'] as const) {
    const key = channel === 'QA' ? 'qa' : 'freetext';
    const groups = new Map(
      teaching.expected[`${key}Clusters`].flatMap((group) =>
        group.members.map((id) => [id, group.modelLabel] as const),
      ),
    );
    cases.set(`test/${channel}/original/de`, {
      name: 'original',
      split: 'test',
      channel,
      locale: 'de',
      items: teaching[key].map((item) => ({ ...item, group: groups.get(item.id) ?? item.id })),
    });
  }
  return [...cases.values()];
}

async function embedCases(
  cases: Case[],
  config: ReturnType<typeof resolveWordCloudSemanticConfig>,
  dimensions: number,
) {
  const embedded: EmbeddedCase[] = [];
  for (const current of cases) {
    const byText = new Map<string, string>();
    const originalItems = current.items.map((item) => ({
      ...item,
      source: toWordCloudAnalysisSourceText(item.text),
    }));
    for (const item of originalItems) {
      if (item.source && !byText.has(item.source)) byText.set(item.source, item.id);
    }
    const batch = [...byText].map(([text, id]) => ({ id, text }));
    const response = await embedWithWordCloudEncoder(
      {
        locale: current.locale === 'mixed' ? 'de' : current.locale,
        snapshotHash: createHash('sha256').update(JSON.stringify(batch)).digest('hex'),
        items: batch,
      },
      config,
    );
    const vectors = new Map(response.items.map(({ id, embedding }) => [id, embedding]));
    if (
      vectors.size !== batch.length ||
      batch.some(({ id }) => {
        const vector = vectors.get(id);
        return (
          vector?.length !== dimensions ||
          Math.abs(vector.reduce((sum, value) => sum + value * value, 0) - 1) > 1e-5
        );
      })
    ) {
      throw new Error(`Invalid vectors for ${current.channel}/${current.name}/${current.locale}`);
    }
    const embeddings = originalItems.flatMap(({ id, text, source }) => {
      const vector = vectors.get(byText.get(source) ?? '');
      return vector ? [{ id, text, vector }] : [];
    });
    embedded.push({ ...current, embeddings });
  }
  return embedded;
}

function grade(sample: EmbeddedCase, threshold: number) {
  const clusters = clusterWordCloudEmbeddings(sample.embeddings, threshold);
  const groupById = new Map(
    clusters.flatMap((cluster, index) => cluster.memberIds.map((id) => [id, index] as const)),
  );
  const falseMerges: Pair[] = [];
  const missed: Pair[] = [];
  let truePairs = 0;
  for (const [index, left] of sample.items.entries()) {
    for (const right of sample.items.slice(index + 1)) {
      const leftGroup = groupById.get(left.id);
      const grouped = leftGroup !== undefined && leftGroup === groupById.get(right.id);
      const expected = left.group === right.group;
      if (grouped && expected) truePairs++;
      if (grouped && !expected) falseMerges.push([left.text, right.text]);
      if (!grouped && expected) missed.push([left.text, right.text]);
    }
  }
  const { channel, locale, name } = sample;
  const fallback = !hasReliableSemanticCluster(rankSemanticClusters(clusters, sample.items));
  return { channel, locale, name, truePairs, falseMerges, missed, fallback };
}

function calibrate(samples: EmbeddedCase[]): number {
  const scores = Array.from({ length: 101 }, (_, index) => {
    const threshold = index / 100;
    const cases = samples.map((sample) => grade(sample, threshold));
    const tp = cases.reduce((sum, entry) => sum + entry.truePairs, 0);
    const fp = cases.reduce((sum, entry) => sum + entry.falseMerges.length, 0);
    const fn = cases.reduce((sum, entry) => sum + entry.missed.length, 0);
    return { threshold, f1: (2 * tp) / (2 * tp + fp + fn), fp };
  });
  scores.sort((a, b) => b.f1 - a.f1 || a.fp - b.fp || b.threshold - a.threshold);
  return scores[0]!.threshold;
}

function loadTexts(channel: WordCloudAnalysisChannel, count: number): string[] {
  if (channel === 'QA') return buildSemanticQaQuestionTexts(count);
  const subjects = ['Stichprobe', 'Umfrage', 'Erhebung', 'Studie', 'Messreihe'];
  const observations = [
    'Freiwillige melden sich häufiger',
    'ältere Personen fehlen',
    'viele brechen vorzeitig ab',
    'einige antworten doppelt',
    'es nehmen nur Studierende teil',
    'die Region ist unterrepräsentiert',
    'kleine Gruppen werden übersehen',
    'der Fragebogen ist zu lang',
    'die Online-Gruppe ist größer',
    'Zufallsschwankungen beeinflussen das Ergebnis',
  ];
  return Array.from(
    { length: count },
    (_, index) =>
      `Bei der ${subjects[index % subjects.length]} gilt: ${observations[Math.floor(index / subjects.length) % observations.length]}. ` +
      `Das betrifft ${Math.floor(index / (subjects.length * observations.length)) + 1} von 20 Gruppen.`,
  );
}

async function measureBackend(
  channel: WordCloudAnalysisChannel,
  count: number,
  env: NodeJS.ProcessEnv,
  sessionId: string,
): Promise<Measurement> {
  const texts = loadTexts(channel, count);
  const input: AnalyzeWordCloudInput = AnalyzeWordCloudInputSchema.parse({
    sessionCode: 'EVAL95',
    mode: 'SEMANTIC',
    locale: 'de',
    metric: 'TOP',
    channel,
    normalization: 'NONE',
    items: texts.map((text, index) => ({ id: `load-${index}`, text, weight: 1 })),
  });
  if (new Set(texts.map(toWordCloudAnalysisSourceText)).size !== count) {
    throw new Error(`Unexpected source-text deduplication for ${channel}/${count}`);
  }

  let requests = 0;
  let requestTimeouts = 0;
  resetWordCloudEncoderClientForTests({
    fetch: async (url, init) => {
      requests++;
      init.signal.addEventListener('abort', () => requestTimeouts++, { once: true });
      return fetch(url, init);
    },
  });
  const run = async () => {
    const started = performance.now();
    const meta = resolveWordCloudNormalizationMeta(input, env);
    const result = await analyzeSemanticWordCloudSnapshot(input, meta, { sessionId, env });
    return { elapsed: performance.now() - started, result, snapshotHash: meta.snapshotHash };
  };
  const cold = await run();
  const requestsAfterCold = requests;
  const warm = await run();
  if (requestsAfterCold !== 1 || (!requestTimeouts && requests !== 1)) {
    throw new Error(
      `Unexpected encoder requests for ${channel}/${count}: ${requestsAfterCold}/${requests}`,
    );
  }
  return {
    channel,
    count,
    snapshotHash: cold.snapshotHash,
    coldMs: cold.elapsed,
    warmMs: warm.elapsed,
    requestTimeouts,
    coldStatus: cold.result.status,
    warmStatus: warm.result.status,
    warmEncoderRequests: requests - requestsAfterCold,
  };
}

async function runContainer(
  model: Model,
  trial: number,
  cases: Case[],
  digests: ReturnType<typeof modelDigests>,
) {
  const started = performance.now();
  const container = docker([
    'run',
    '--detach',
    '--rm',
    '--no-healthcheck',
    '--read-only',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--cpus',
    '4',
    '--memory',
    '2g',
    '--memory-swap',
    '2g',
    '--pids-limit',
    '64',
    '--tmpfs',
    '/tmp:rw,noexec,nosuid,nodev,size=256m',
    '-p',
    '127.0.0.1::8790',
    '-e',
    `MODEL_COMPARISON_CANDIDATE=${model}`,
    '-e',
    'WORD_CLOUD_ENCODER_MODEL_DIR=/candidate',
    '-e',
    'WORD_CLOUD_ENCODER_THREADS=4',
    '-e',
    'WORD_CLOUD_ENCODER_HTTP_BIND=0.0.0.0:8790',
    '--mount',
    `type=bind,src=${join(modelsDir, model)},dst=/candidate,readonly`,
    '--mount',
    `type=bind,src=${adapter},dst=/benchmark.py,readonly`,
    '-e',
    'PYTHONPATH=/app',
    '--entrypoint',
    'python',
    image,
    '/benchmark.py',
  ]);
  try {
    const address = docker(['port', container, '8790/tcp']);
    const baseUrl = `http://${address}`;
    while (true) {
      const response = await fetch(`${baseUrl}/health`, {
        signal: AbortSignal.timeout(1000),
      }).catch(() => undefined);
      if (response?.status === 204) break;
      if (performance.now() - started > 120_000) throw new Error('Encoder readiness timeout');
      await delay(75);
    }
    const startupMs = performance.now() - started;
    const env = {
      WORD_CLOUD_SEMANTIC_ENABLED: 'true',
      WORD_CLOUD_ENCODER_URL: `${baseUrl}/embed`,
      WORD_CLOUD_ENCODER_TIMEOUT_MS: '120000',
    };
    resetWordCloudSemanticAnalyzeForTests();
    const measurements: Measurement[] = [];
    for (const channel of ['QA', 'FREETEXT'] as const) {
      for (const count of [200, 500]) {
        measurements.push(
          await measureBackend(channel, count, env, `${model}-${trial}-${channel}-${count}`),
        );
      }
    }
    resetWordCloudEncoderClientForTests();
    const peakMatch = docker(['exec', container, 'cat', '/proc/1/status']).match(
      /^VmHWM:\s+(\d+) kB$/m,
    );
    if (!peakMatch) throw new Error('VmHWM missing from sidecar process status');
    const embedded = cases.length
      ? await embedCases(cases, resolveWordCloudSemanticConfig(env), model === 'gemma' ? 768 : 384)
      : [];
    const log = docker(['logs', container])
      .split('\n')
      .map((line) => JSON.parse(line) as LoadRecord | EmbedRecord);
    const load = log.find((event): event is LoadRecord => event.kind === 'load');
    const expectedDigest = [digests.onnxSha256, digests.onnxDataSha256]
      .filter((digest) => digest !== undefined)
      .map((digest) => digest.slice(0, 16))
      .join('-');
    if (!load?.modelVersion.endsWith(`@sha256:${expectedDigest}`)) {
      throw new Error('Unexpected model digest in sidecar response');
    }
    return {
      startupMs,
      load,
      peakRssKiB: Number(peakMatch[1]),
      measurements: measurements.map((measurement) => {
        const entry = log.find(
          (event): event is EmbedRecord =>
            event.kind === 'embed' && event.snapshotHash === measurement.snapshotHash,
        );
        if (!entry && !measurement.requestTimeouts) throw new Error('Missing sidecar timing');
        return { ...measurement, encoderMs: entry?.ms, encoderItems: entry?.items };
      }),
      embedded,
    };
  } catch (error) {
    console.error(docker(['logs', container]));
    throw error;
  } finally {
    docker(['rm', '-f', container]);
  }
}

async function main() {
  if (!Number.isInteger(repeats) || repeats < 1) throw new Error('Invalid repeat count');
  const cases = readCases();
  const digests = {
    e5: modelDigests('e5'),
    minilm: modelDigests('minilm'),
    gemma: modelDigests('gemma'),
  };
  const results: Record<string, unknown> = {
    image: docker(['image', 'inspect', image, '--format', '{{.Id}} {{.Architecture}}']),
    docker: docker(['info', '--format', '{{.OperatingSystem}} {{.NCPU}} CPUs {{.MemTotal}} bytes']),
    node: process.version,
  };
  for (let trial = 0; trial < repeats; trial++) {
    const offset = trial % models.length;
    for (const model of [...models.slice(offset), ...models.slice(0, offset)]) {
      console.error(`Running ${model}, trial ${trial + 1}/${repeats}`);
      const { embedded, ...timings } = await runContainer(
        model,
        trial,
        trial === 0 ? cases : [],
        digests[model],
      );
      const previous = results[model] as { trials: unknown[] } | undefined;
      if (previous) {
        previous.trials.push(timings);
      } else {
        const threshold =
          model === 'e5'
            ? WORD_CLOUD_SEMANTIC_COSINE_THRESHOLD
            : calibrate(embedded.filter((sample) => sample.split === 'calibration'));
        results[model] = {
          threshold,
          ...digests[model],
          calibration: embedded
            .filter(({ split }) => split === 'calibration')
            .map((sample) => grade(sample, threshold)),
          test: embedded
            .filter(({ split }) => split === 'test')
            .map((sample) => grade(sample, threshold)),
          trials: [timings],
        };
      }
    }
  }
  console.log(JSON.stringify(results, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

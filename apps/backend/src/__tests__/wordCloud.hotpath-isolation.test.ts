import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const routersDir = join(process.cwd(), 'src/routers');

function pruefeLiveRouter(verzeichnis: string): void {
  const forbidden =
    /spacyClient|wordCloudNormalizer|normalizeWordCloudItems|nlpSidecar|wordCloudEncoderClient|wordCloudSemanticAnalyze|embedWithWordCloudEncoder|openWeightLlmClient|runOpenWeightLlm/;
  for (const file of ['vote.ts', 'qa.ts', 'session.ts', 'quickFeedback.ts']) {
    const source = readFileSync(join(verzeichnis, file), 'utf8');
    expect(source, file).not.toMatch(forbidden);
  }
}

describe('wordCloud hotpath isolation', () => {
  it('haelt spaCy, Encoder und LLM aus Vote-, Q&A-Submit-, Join- und Quick-Feedback-Routern', () => {
    pruefeLiveRouter(routersDir);
  });

  it('erkennt einen direkten Inferenzimport auch im Quick-Feedback-Router', () => {
    const verzeichnis = mkdtempSync(join(tmpdir(), 'a1-hotpfad-'));
    try {
      for (const datei of ['vote.ts', 'qa.ts', 'session.ts']) {
        writeFileSync(join(verzeichnis, datei), 'export {};');
      }
      writeFileSync(join(verzeichnis, 'quickFeedback.ts'), "import '../lib/spacyClient';");
      expect(() => pruefeLiveRouter(verzeichnis)).toThrow(/quickFeedback\.ts/);
    } finally {
      rmSync(verzeichnis, { recursive: true, force: true });
    }
  });

  it('haelt die LLM-Runtime aus beiden WebSocket-Servern', () => {
    const libDir = join(process.cwd(), 'src/lib');
    for (const file of ['trpcWebSocketServer.ts', 'yjsRelay.ts']) {
      const source = readFileSync(join(libDir, file), 'utf8');
      expect(source, file).not.toMatch(/openWeightLlmClient|runOpenWeightLlm/);
    }
  });

  it('haelt den Q&A-Submit-Router frei von Klassifikator- und Worker-Implementierung', () => {
    const source = readFileSync(join(routersDir, 'qa.ts'), 'utf8');
    expect(source).not.toMatch(
      /qaNlpWorker|runStubQaNlpClassifier|runQaNlpClassifier|qaNlpGatekeeper|qaNlpNaiveBayes|spacyClient/,
    );
    expect(source).toMatch(/enqueueQaNlpJob/);
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const routersDir = join(process.cwd(), 'src/routers');

describe('wordCloud hotpath isolation', () => {
  it('haelt spaCy aus Vote-, Q&A-Submit- und Join-Routern', () => {
    const forbidden = /spacyClient|wordCloudNormalizer|normalizeWordCloudItems|nlpSidecar/;
    for (const file of ['vote.ts', 'qa.ts', 'session.ts']) {
      const source = readFileSync(join(routersDir, file), 'utf8');
      expect(source, file).not.toMatch(forbidden);
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

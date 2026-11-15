import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const sha256 = (daten) => createHash('sha256').update(daten).digest('hex');

export const HISTORISCHE_REIHE = Object.freeze({
  baselineCommit: '8f91e0417bc5aace461c3644a0b6b26c9284035b',
  contractSha256: 'f7d3eba4b82a3f3a47c914665ac8a7be4988b9061deff6b857a79d2fcf766ab7',
  pdfWorkerPidsLimit: 128,
  requiresResolvedCompose: false,
});

/** Explizite neue Reihe; alte Nachweise behalten ihren festgelegten Standard. */
export async function ladeReihendefinition(file) {
  const bytes = await readFile(file);
  const reihe = JSON.parse(bytes);
  const fixture = JSON.parse(
    await readFile(join(root, 'scripts/load/fixtures/resource-isolation-v1.manifest.json'), 'utf8'),
  );
  if (
    reihe.schemaVersion !== 1 ||
    !/^[a-z0-9-]+$/.test(reihe.seriesId ?? '') ||
    !/^[a-f0-9]{40}$/.test(reihe.baselineCommit ?? '') ||
    reihe.contractSha256 !== HISTORISCHE_REIHE.contractSha256 ||
    reihe.fixtureSha256 !== fixture.sha256 ||
    reihe.orderSeed !== fixture.seed ||
    !Number.isSafeInteger(reihe.pdfWorkerPidsLimit) ||
    reihe.pdfWorkerPidsLimit < 1 ||
    reihe.requiresResolvedCompose !== true ||
    !/^docs\/referat-thema-1\/specs\/[a-zA-Z0-9-]+\.md$/.test(reihe.addendumFile ?? '') ||
    !/^[a-f0-9]{64}$/.test(reihe.addendumSha256 ?? '')
  )
    throw new Error(
      'Ungültige Reihendefinition: Baseline, Quellen, Fixture und Sollkonfiguration prüfen.',
    );
  if (
    sha256(await readFile(join(root, 'docs/referat-thema-1/1A-experiment-contract.md'))) !==
      reihe.contractSha256 ||
    sha256(await readFile(join(root, reihe.addendumFile))) !== reihe.addendumSha256
  )
    throw new Error('Versuchsvertrag oder Vorabnachtrag wurde verändert.');
  return Object.freeze({ ...reihe, definitionSha256: sha256(bytes) });
}

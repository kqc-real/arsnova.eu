// S1-Labor: reine Validierung und Manifest-Erzeugung; Import hat keine Seiteneffekte.
import { readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';

export function s1Config({ n, consumer, tag, timeoutMs }) {
  if (
    !Number.isInteger(n) ||
    n < 1 ||
    n > 3 ||
    !['label', 'summary'].includes(consumer) ||
    !/^(dev-)?s1-[a-z0-9-]+$/.test(tag ?? '') ||
    ![90000, 300000].includes(timeoutMs)
  )
    throw new Error('S1: ungültige Konfiguration.');
  return { n, consumer, tag, timeoutMs, live: true, variant: 'normal' };
}
export function checkS1Host(h) {
  if (
    !['cpus', 'memoryBytes', 'availableBytes', 'diskBytes'].every((k) => Number.isFinite(h[k])) ||
    !h.addresses?.includes('192.168.150.20') ||
    h.cpus !== 8 ||
    h.memoryBytes < 9 * 1024 ** 3 ||
    h.availableBytes < 4 * 1024 ** 3 ||
    h.diskBytes < 4 * 1024 ** 3 ||
    !Array.isArray(h.foreignContainers) ||
    h.foreignContainers.length
  )
    throw new Error('S1: falsche VM, unzureichende Reserve oder vorhandene Container.');
}
export function checkS1Networks(subnets) {
  const range = (cidr) => {
    const [ip, prefix] = cidr.split('/'),
      parts = ip.split('.').map(Number),
      bits = Number(prefix);
    if (
      parts.length !== 4 ||
      parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255) ||
      !Number.isInteger(bits) ||
      bits < 0 ||
      bits > 32
    )
      throw new Error('S1: ungültiges IPv4-Netz.');
    const value = parts.reduce((n, p) => n * 256 + p, 0),
      size = 2 ** (32 - bits);
    const start = Math.floor(value / size) * size;
    return [start, start + size - 1];
  };
  const [start, end] = range('172.31.150.0/24');
  for (const subnet of subnets) {
    if (!subnet || subnet.includes(':')) continue;
    const [a, b] = range(subnet);
    if (a <= end && b >= start) throw new Error('S1: Docker-Subnetz überlappt.');
  }
}
export function s1Environment(text, config) {
  const entries = [...text.matchAll(/^([A-Z][A-Z0-9_]*)=(.*)$/gm)];
  const map = new Map(entries.map((m) => [m[1], m[2].replace(/\r$/, '')]));
  if (
    map.get('OPEN_WEIGHT_LLM_URL') !== 'http://192.168.150.20:8080' ||
    !map.get('OPEN_WEIGHT_LLM_TOKEN') ||
    entries.length !== map.size
  )
    throw new Error('S1: Quellkonfiguration nicht eindeutig oder falsches Runtime-Ziel.');
  const values = {
    QA_SUMMARY_ENABLED: 'true',
    OPEN_WEIGHT_LLM_ENABLED: 'true',
    QA_SUMMARY_TIMEOUT_MS: String(config.timeoutMs),
    OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS: String(config.timeoutMs),
    WORD_CLOUD_SEMANTIC_ENABLED: String(config.consumer === 'label'),
  };
  for (const key of Object.keys(values))
    if (!map.has(key)) throw new Error('S1: Pflichtsetting fehlt.');
  return text.replace(/^([A-Z][A-Z0-9_]*)=(.*)$/gm, (line, key) =>
    key in values ? `${key}=${values[key]}` : line,
  );
}
export function buildS1Result({
  config,
  driver,
  sourceImages,
  actualImages,
  restored,
  ...evidence
}) {
  config = s1Config(config);
  if (
    !sourceImages ||
    !Object.keys(sourceImages).length ||
    !isDeepStrictEqual(sourceImages, actualImages)
  )
    throw new Error('S1: Image-Identität nicht bestätigt.');
  if (
    !restored ||
    driver?.auftraege?.length !== config.n ||
    driver?.live?.windows?.length !== config.n ||
    !driver.auftraege.every(
      (j) => j.status === 'ready' && j.measurement?.complete && j.measurement.resources?.complete,
    ) ||
    !driver.live.windows.every((w) => w.complete)
  )
    throw new Error('S1: Messung oder Wiederherstellung unvollständig.');
  return {
    topology: 'same-host-http',
    config,
    sourceImages,
    actualImages,
    treiber: driver,
    restoration: { restored: true, checksPassed: true },
    ...evidence,
    limitations: [
      'S1: 8 vCPU/10 GiB statt 2+8 vCPU/4+10 GiB; keine kapazitätsgleiche Kausalbehauptung.',
      'HTTP über dieselbe VM, kein Unix-Socket-Vergleich; Treiber und Collector auf llm-host.',
    ],
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode, ...args] = process.argv.slice(2);
  const config = () =>
    s1Config({ n: Number(args[0]), consumer: args[1], tag: args[2], timeoutMs: Number(args[3]) });
  if (mode === 'config') process.stdout.write(JSON.stringify(config()) + '\n');
  else if (mode === 'env') process.stdout.write(s1Environment(readFileSync(0, 'utf8'), config()));
  else if (mode === 'networks') checkS1Networks(JSON.parse(readFileSync(0, 'utf8')));
  else if (mode === 'check') checkS1Host(JSON.parse(readFileSync(0, 'utf8')));
  else if (mode === 'result') {
    const p = args[0],
      read = (n) => JSON.parse(readFileSync(`${p}/${n}.json`, 'utf8'));
    const result = buildS1Result({
      ...read('evidence'),
      config: read('config'),
      driver: read('treiber'),
      sourceImages: read('source-images'),
      actualImages: read('actual-images'),
      restored: read('wiederherstellung').checksPassed === true,
      runtimeObservation: { before: read('runtime-before'), after: read('runtime-after') },
      appObservation: { before: read('app-before'), after: read('app-after') },
    });
    writeFileSync(`${p}/ergebnis.json`, JSON.stringify(result, null, 2) + '\n');
  } else throw new Error('S1: unbekannter Modus.');
}

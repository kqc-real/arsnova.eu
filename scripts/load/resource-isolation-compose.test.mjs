import assert from 'node:assert/strict';
import test from 'node:test';
import { bereinigeCompose, pruefeManifestAbgleich } from './lib/resource-isolation-compose.mjs';

const image = `sha256:${'a'.repeat(64)}`;

test('exportiert nur erlaubte Compose-Felder und entfernt Secrets sowie lokale Pfade', () => {
  const quelle = {
    name: 'arsnova-1a',
    services: {
      app: {
        image,
        environment: { NLP_ENABLED: 'true', JWT_SECRET: 'vertraulich', DATABASE_URL: 'privat' },
        labels: { intern: 'vertraulich' },
        volumes: [
          { type: 'bind', source: '/private/labor/socket', target: '/run/spacy', read_only: true },
        ],
        ports: [{ host_ip: '127.0.0.1', target: 3000, published: '15300', protocol: 'tcp' }],
      },
    },
    secrets: { passwort: { file: '/private/labor/secret' } },
  };
  const ausgabe = bereinigeCompose(quelle);
  assert.deepEqual(ausgabe.services.app.environment, { NLP_ENABLED: 'true' });
  assert.deepEqual(ausgabe.services.app.volumes, [
    { type: 'bind', source: 'SPACY_SOCKET_DIRECTORY', target: '/run/spacy', read_only: true },
  ]);
  assert.deepEqual(ausgabe.services.app.ports, [
    { binding: 'loopback-only', target: 3000, published: '15300', protocol: 'tcp' },
  ]);
  assert.doesNotMatch(JSON.stringify(ausgabe), /vertraulich|privat|127\.0\.0\.1|JWT_SECRET/);
  assert.equal(ausgabe.secrets, undefined);
});

test('verweigert öffentliche Bindings und unbekannte Bind-Mount-Ziele', () => {
  assert.throws(() =>
    bereinigeCompose({ services: { app: { image, ports: [{ host_ip: '0.0.0.0' }] } } }),
  );
  assert.throws(() =>
    bereinigeCompose({
      services: { app: { image, volumes: [{ type: 'bind', target: '/unbekannt' }] } },
    }),
  );
});

test('erkennt abweichende Limits und Flags statt Rekonstruktionen ungeprüft zu bestätigen', () => {
  const compose = {
    services: {
      spacy: { image, cpus: 0.25, mem_limit: 1073741824, pids_limit: 64 },
      app: { image, environment: { NLP_ENABLED: 'true' } },
    },
  };
  const manifest = {
    services: {
      spacy: { imageId: image, cpuLimit: 0.25, memoryLimitBytes: 1073741824, pidsLimit: 64 },
      app: {
        imageId: image,
        cpuLimit: null,
        memoryLimitBytes: null,
        pidsLimit: null,
        flags: { NLP_ENABLED: 'true' },
      },
    },
  };
  assert.equal(pruefeManifestAbgleich(compose, manifest), true);
  const falsch = structuredClone(compose);
  falsch.services.spacy.cpus = 1;
  assert.throws(() => pruefeManifestAbgleich(falsch, manifest));
  const falschesFlag = structuredClone(compose);
  falschesFlag.services.app.environment.NLP_ENABLED = 'false';
  assert.throws(() => pruefeManifestAbgleich(falschesFlag, manifest));
});

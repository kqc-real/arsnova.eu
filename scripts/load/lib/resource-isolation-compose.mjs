const flags = [
  'NODE_ENV',
  'NLP_ENABLED',
  'NLP_SOCKET_PATH',
  'QA_NLP_ENABLED',
  'QA_SUMMARY_ENABLED',
  'WORD_CLOUD_SEMANTIC_ENABLED',
  'OPEN_WEIGHT_LLM_ENABLED',
  'NLP_TIMEOUT_MS',
  'NLP_CACHE_TTL_SECONDS',
  'RATE_LIMIT_SESSION_CREATE_PER_HOUR',
  'RATE_LIMIT_SESSION_CREATE_GLOBAL_PER_HOUR',
];

/** Positivliste: weder vollständige Umgebung noch private Hostpfade exportieren. */
export function bereinigeCompose(config) {
  return {
    services: Object.fromEntries(
      Object.entries(config.services).map(([name, service]) => {
        const ausgabe = {};
        for (const feld of [
          'image',
          'profiles',
          'restart',
          'init',
          'read_only',
          'cap_drop',
          'security_opt',
          'network_mode',
          'cpus',
          'mem_limit',
          'pids_limit',
          'stop_grace_period',
          'depends_on',
        ]) {
          if (Object.hasOwn(service, feld)) ausgabe[feld] = service[feld];
        }
        ausgabe.environment = Object.fromEntries(
          Object.entries(service.environment ?? {}).filter(([key]) => flags.includes(key)),
        );
        if (service.networks) ausgabe.networks = Object.keys(service.networks);
        if (service.healthcheck)
          ausgabe.healthcheck = Object.fromEntries(
            ['interval', 'timeout', 'start_period', 'retries']
              .filter((k) => Object.hasOwn(service.healthcheck, k))
              .map((k) => [k, service.healthcheck[k]]),
          );
        if (service.volumes)
          ausgabe.volumes = service.volumes.map((volume) => {
            const erlaubteZiele = {
              '/run/spacy': 'SPACY_SOCKET_DIRECTORY',
              '/run/1a-proxy': 'PROXY_DIRECTORY',
            };
            if (volume.type === 'bind' && !erlaubteZiele[volume.target])
              throw new Error('Unbekanntes Bind-Mount-Ziel.');
            return {
              type: volume.type,
              source:
                volume.type === 'bind'
                  ? erlaubteZiele[volume.target]
                  : volume.source.replace(/^arsnova-1a_/, ''),
              target: volume.target,
              read_only: volume.read_only === true,
            };
          });
        if (service.ports)
          ausgabe.ports = service.ports.map((port) => {
            if (port.host_ip !== '127.0.0.1')
              throw new Error('Nicht ausschließlich lokale Portbindung.');
            return {
              binding: 'loopback-only',
              target: port.target,
              published: port.published,
              protocol: port.protocol,
            };
          });
        return [name, ausgabe];
      }),
    ),
  };
}

export function pruefeManifestAbgleich(compose, manifest) {
  for (const [name, belegt] of Object.entries(manifest.services)) {
    const service = compose.services[name];
    if (
      !service ||
      service.image !== belegt.imageId ||
      (Number(service.cpus) || null) !== belegt.cpuLimit ||
      (Number(service.mem_limit) || null) !== belegt.memoryLimitBytes ||
      (Number(service.pids_limit) || null) !== belegt.pidsLimit ||
      Object.entries(belegt.flags ?? {}).some(([key, value]) => service.environment[key] !== value)
    )
      throw new Error(`Aufgelöster Dienst ${name} weicht vom aufgezeichneten Manifest ab.`);
  }
  return true;
}

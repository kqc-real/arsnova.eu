#!/usr/bin/env node
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { parse as parseYaml } from 'yaml';

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = '.github/required-checks.json';
const SCHEMA_PATH = '.github/required-checks.schema.json';
const DOCUMENTATION_PATH = 'docs/CI-WORKFLOW.md';
const DOC_START = '<!-- required-checks:start -->';
const DOC_END = '<!-- required-checks:end -->';

function readJson(rootDir, path) {
  return JSON.parse(readFileSync(resolve(rootDir, path), 'utf8'));
}

function producerKey(producer) {
  return `${producer.workflow}#${producer.job}`;
}

function compareSets(expected, actual) {
  return {
    missing: [...expected].filter((value) => !actual.has(value)).sort(),
    additional: [...actual].filter((value) => !expected.has(value)).sort(),
  };
}

function cartesian(values) {
  return values.reduce(
    (rows, column) => rows.flatMap((row) => column.map((value) => [...row, value])),
    [[]],
  );
}

export function renderJobContexts(job, location, fallbackName) {
  const jobName = job?.name ?? fallbackName;
  if (typeof jobName !== 'string' || jobName.trim() === '') {
    throw new Error(`${location}: required-check producer needs a non-empty job name`);
  }
  const variables = [
    ...new Set(
      [...jobName.matchAll(/\$\{\{\s*matrix\.([A-Za-z0-9_-]+)\s*\}\}/g)].map((match) => match[1]),
    ),
  ];
  if (variables.length === 0) return [jobName];
  if (job.strategy?.matrix?.include || job.strategy?.matrix?.exclude) {
    throw new Error(
      `${location}: matrix include/exclude in a rendered check name is unsupported and must be modelled explicitly`,
    );
  }
  const columns = variables.map((variable) => {
    const values = job.strategy?.matrix?.[variable];
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error(`${location}: matrix.${variable} must be a non-empty array`);
    }
    return values;
  });
  return cartesian(columns)
    .map((combination) => {
      let context = jobName;
      variables.forEach((variable, index) => {
        const expression = new RegExp(`\\$\\{\\{\\s*matrix\\.${variable}\\s*\\}\\}`, 'g');
        context = context.replace(expression, String(combination[index]));
      });
      return context;
    })
    .sort();
}

export function discoverWorkflowContexts(rootDir) {
  const workflowsDir = resolve(rootDir, '.github/workflows');
  const workflowFiles = readdirSync(workflowsDir)
    .filter((file) => /\.ya?ml$/.test(file))
    .map((file) => `.github/workflows/${file}`)
    .sort();
  const byContext = new Map();
  const byProducer = new Map();
  for (const workflow of workflowFiles) {
    const parsed = parseYaml(readFileSync(resolve(rootDir, workflow), 'utf8'));
    for (const [jobId, job] of Object.entries(parsed?.jobs ?? {})) {
      const producer = { workflow, job: jobId };
      const contexts = renderJobContexts(job, `${workflow}#${jobId}`, jobId);
      byProducer.set(producerKey(producer), new Set(contexts));
      for (const context of contexts) {
        const producers = byContext.get(context) ?? [];
        producers.push(producer);
        byContext.set(context, producers);
      }
    }
  }
  return { byContext, byProducer };
}

function validateShape(manifest, schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  if (validate(manifest)) return [];
  return (validate.errors ?? []).map(
    (error) => `manifest${error.instancePath || '/'} ${error.message}`,
  );
}

function workflowSource(source) {
  return source.type === 'workflow'
    ? source.producers.map(producerKey).sort().join(', ')
    : source.provider;
}

function markdownTable(headers, rows) {
  const widths = headers.map((header, index) =>
    Math.max(3, header.length, ...rows.map((row) => row[index].length)),
  );
  const line = (row) => `| ${row.map((cell, index) => cell.padEnd(widths[index])).join(' | ')} |`;
  return [line(headers), line(widths.map((width) => '-'.repeat(width))), ...rows.map(line)];
}

export function renderRequiredChecksDocumentation(manifest) {
  const requiredRows = [...manifest.checks]
    .sort((left, right) => left.context.localeCompare(right.context))
    .map((check) => [
      check.context,
      check.ruleset,
      `${check.source.type}: ${workflowSource(check.source)}`,
      check.purpose,
    ]);
  const snapshotRows = manifest.rulesets.flatMap((ruleset) =>
    [...ruleset.contexts]
      .sort((left, right) => left.localeCompare(right))
      .map((context) => [`${ruleset.name} (${ruleset.id})`, context]),
  );
  const nonRequiredRows = [...manifest.nonRequiredWorkflowChecks]
    .sort((left, right) => left.context.localeCompare(right.context))
    .map((check) => [check.context, workflowSource(check.source), check.reason]);
  return [
    DOC_START,
    '',
    '## Required Checks: Soll-Konfiguration und Ist-Snapshot',
    '',
    `Kanonische Quelle: [\`.github/required-checks.json\`](../.github/required-checks.json), Zielbranch \`${manifest.targetBranch}\`.`,
    '',
    '### Kanonische Soll-Konfiguration',
    '',
    ...markdownTable(['Kontext', 'Ruleset', 'Quelle', 'Zweck'], requiredRows),
    '',
    '### Ermittelte Ruleset-Momentaufnahme',
    '',
    `Status: **${manifest.ownerVerification.status}** · Erfasst: ${manifest.ownerVerification.capturedAt} · Endpunkt: \`${manifest.ownerVerification.endpoint}\` · Erfassung: \`${manifest.ownerVerification.capturedBy}\`.`,
    '',
    ...markdownTable(['Ruleset', 'Required Context'], snapshotRows),
    '',
    '### Sichtbare, derzeit nicht required gesetzte Workflow-Kontexte',
    '',
    ...markdownTable(
      ['Kontext', 'Quelle', 'Begründung'],
      nonRequiredRows.length > 0 ? nonRequiredRows : [['–', '–', 'Keine']],
    ),
    '',
    '### Offene Beobachtungen für den Owner-Checkpoint',
    '',
    ...manifest.observations.map((observation) => `- ${observation}`),
    '',
    DOC_END,
  ].join('\n');
}

function validateManifestSemantics(manifest, discovered) {
  const errors = [];
  if (
    manifest.ownerVerification.status === 'verified' &&
    (typeof manifest.ownerVerification.evidence !== 'string' ||
      manifest.ownerVerification.evidence.trim() === '')
  ) {
    errors.push('ownerVerification.evidence is required when status is verified');
  }
  const contexts = new Set();
  const rulesets = new Map();
  const snapshotContextRuleset = new Map();
  for (const ruleset of manifest.rulesets) {
    if (rulesets.has(ruleset.name)) errors.push(`duplicate ruleset name: ${ruleset.name}`);
    rulesets.set(ruleset.name, ruleset);
    for (const context of ruleset.contexts) {
      if (snapshotContextRuleset.has(context)) {
        errors.push(`snapshot context appears in multiple rulesets: ${context}`);
      }
      snapshotContextRuleset.set(context, ruleset.name);
    }
  }

  const declaredByProducer = new Map();
  for (const check of manifest.checks) {
    if (contexts.has(check.context)) errors.push(`duplicate required context: ${check.context}`);
    contexts.add(check.context);
    const snapshotRuleset = snapshotContextRuleset.get(check.context);
    if (!snapshotRuleset) {
      errors.push(`${check.context}: missing from the recorded ruleset snapshot`);
    } else if (snapshotRuleset !== check.ruleset) {
      errors.push(
        `${check.context}: manifest ruleset ${check.ruleset} differs from snapshot ruleset ${snapshotRuleset}`,
      );
    }
    if (!rulesets.has(check.ruleset)) {
      errors.push(`${check.context}: unknown ruleset ${check.ruleset}`);
    }

    const actualProducers = new Set(
      (discovered.byContext.get(check.context) ?? []).map(producerKey),
    );
    if (check.source.type === 'external') {
      if (actualProducers.size > 0) {
        errors.push(
          `${check.context}: classified external but produced by ${[...actualProducers].join(', ')}`,
        );
      }
      continue;
    }
    const expectedProducers = new Set(check.source.producers.map(producerKey));
    const producerDiff = compareSets(expectedProducers, actualProducers);
    if (producerDiff.missing.length > 0 || producerDiff.additional.length > 0) {
      errors.push(
        `${check.context}: workflow producers differ; missing [${producerDiff.missing.join(', ')}], additional [${producerDiff.additional.join(', ')}]`,
      );
    }
    for (const producer of expectedProducers) {
      const declaredContexts = declaredByProducer.get(producer) ?? new Set();
      declaredContexts.add(check.context);
      declaredByProducer.set(producer, declaredContexts);
      if (!discovered.byProducer.has(producer)) {
        errors.push(`${check.context}: workflow job missing or renamed: ${producer}`);
      }
    }
  }

  for (const [context, ruleset] of snapshotContextRuleset) {
    if (!contexts.has(context)) {
      errors.push(`${context}: recorded in ruleset ${ruleset} but missing from canonical checks`);
    }
  }

  for (const check of manifest.nonRequiredWorkflowChecks) {
    if (contexts.has(check.context) || snapshotContextRuleset.has(check.context)) {
      errors.push(`${check.context}: marked non-required but present in canonical required checks`);
    }
    if (check.source.type !== 'workflow') {
      errors.push(`${check.context}: non-required workflow check must use a workflow source`);
      continue;
    }
    const expectedProducers = new Set(check.source.producers.map(producerKey));
    const actualProducers = new Set(
      (discovered.byContext.get(check.context) ?? []).map(producerKey),
    );
    const producerDiff = compareSets(expectedProducers, actualProducers);
    if (producerDiff.missing.length > 0 || producerDiff.additional.length > 0) {
      errors.push(
        `${check.context}: non-required workflow producers differ; missing [${producerDiff.missing.join(', ')}], additional [${producerDiff.additional.join(', ')}]`,
      );
    }
    for (const producer of expectedProducers) {
      const declaredContexts = declaredByProducer.get(producer) ?? new Set();
      declaredContexts.add(check.context);
      declaredByProducer.set(producer, declaredContexts);
    }
  }

  for (const [producer, declaredContexts] of declaredByProducer) {
    const actualContexts = discovered.byProducer.get(producer);
    if (!actualContexts) continue;
    const contextDiff = compareSets(declaredContexts, actualContexts);
    if (contextDiff.missing.length > 0 || contextDiff.additional.length > 0) {
      errors.push(
        `${producer}: rendered contexts differ; missing [${contextDiff.missing.join(', ')}], additional [${contextDiff.additional.join(', ')}]`,
      );
    }
  }
  return errors;
}

export function extractLiveRulesets(apiRulesets) {
  return apiRulesets
    .map((ruleset) => {
      const statusRule = ruleset.rules?.find((rule) => rule.type === 'required_status_checks');
      if (!statusRule) return null;
      return {
        name: ruleset.name,
        id: ruleset.id,
        contexts: (statusRule.parameters?.required_status_checks ?? [])
          .map((check) => check.context)
          .sort(),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function compareLiveRulesets(manifest, apiRulesets) {
  const expected = [...manifest.rulesets]
    .map((ruleset) => ({ ...ruleset, contexts: [...ruleset.contexts].sort() }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const actual = extractLiveRulesets(apiRulesets);
  return JSON.stringify(expected) === JSON.stringify(actual)
    ? []
    : [
        `live rulesets differ from manifest\nexpected: ${JSON.stringify(expected)}\nactual:   ${JSON.stringify(actual)}`,
      ];
}

export function validateRepository({ rootDir = REPOSITORY_ROOT, liveRulesets } = {}) {
  const manifest = readJson(rootDir, MANIFEST_PATH);
  const schema = readJson(rootDir, SCHEMA_PATH);
  const shapeErrors = validateShape(manifest, schema);
  if (shapeErrors.length > 0) {
    return { errors: shapeErrors, manifest, expectedDocumentation: null };
  }
  const discovered = discoverWorkflowContexts(rootDir);
  const errors = validateManifestSemantics(manifest, discovered);
  if (liveRulesets) errors.push(...compareLiveRulesets(manifest, liveRulesets));
  const expectedDocumentation = renderRequiredChecksDocumentation(manifest);
  const documentation = readFileSync(resolve(rootDir, DOCUMENTATION_PATH), 'utf8');
  const starts = [...documentation.matchAll(new RegExp(DOC_START, 'g'))];
  const ends = [...documentation.matchAll(new RegExp(DOC_END, 'g'))];
  const start = starts[0]?.index ?? -1;
  const end = ends[0]?.index ?? -1;
  if (starts.length !== 1 || ends.length !== 1 || end < start) {
    errors.push(
      `${DOCUMENTATION_PATH}: expected exactly one generated required-check section, found ${starts.length} start and ${ends.length} end marker(s)`,
    );
  } else {
    const actualDocumentation = documentation.slice(start, end + DOC_END.length);
    if (actualDocumentation !== expectedDocumentation) {
      errors.push(
        `${DOCUMENTATION_PATH}: generated required-check section is stale; run npm run validate:required-checks:write`,
      );
    }
  }
  return { errors, manifest, expectedDocumentation };
}

function parseArguments(argv) {
  const args = { writeDocs: false, liveRulesetsPath: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--write-docs') {
      args.writeDocs = true;
      continue;
    }
    if (argument === '--live-rulesets') {
      args.liveRulesetsPath = argv[++index];
      if (!args.liveRulesetsPath) throw new Error('--live-rulesets requires a JSON file');
      continue;
    }
    throw new Error(`unknown argument: ${argument}`);
  }
  return args;
}

function replaceDocumentation(rootDir, generated) {
  const path = resolve(rootDir, DOCUMENTATION_PATH);
  const documentation = readFileSync(path, 'utf8');
  const start = documentation.indexOf(DOC_START);
  const end = documentation.indexOf(DOC_END);
  let next;
  if (start === -1 || end === -1) {
    next = `${documentation.trimEnd()}\n\n${generated}\n`;
  } else {
    const withoutGenerated = `${documentation.slice(0, start)}${documentation.slice(end + DOC_END.length)}`;
    const referencesAnchor = '\n---\n\n## 11) Canonical References';
    const anchor = withoutGenerated.indexOf(referencesAnchor);
    next =
      anchor !== -1 && start > anchor
        ? `${withoutGenerated.slice(0, anchor).trimEnd()}\n\n${generated}\n${withoutGenerated.slice(anchor)}`
        : `${documentation.slice(0, start)}${generated}${documentation.slice(end + DOC_END.length)}`;
  }
  writeFileSync(path, next);
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  const liveRulesets = args.liveRulesetsPath
    ? JSON.parse(readFileSync(resolve(args.liveRulesetsPath), 'utf8'))
    : undefined;
  if (args.writeDocs) {
    const manifest = readJson(REPOSITORY_ROOT, MANIFEST_PATH);
    replaceDocumentation(REPOSITORY_ROOT, renderRequiredChecksDocumentation(manifest));
  }
  const { errors, manifest } = validateRepository({ rootDir: REPOSITORY_ROOT, liveRulesets });
  if (errors.length > 0) {
    process.stderr.write(
      `Required-check validation failed:\n${errors.map((error) => `- ${error}`).join('\n')}\n`,
    );
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `Required-check validation passed: ${manifest.checks.length} required context(s), ${manifest.nonRequiredWorkflowChecks.length} documented non-required context(s).\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

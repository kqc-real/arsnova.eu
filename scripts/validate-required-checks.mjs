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

function globMatchesBranch(pattern, branch) {
  const negated = pattern.startsWith('!');
  const source = negated ? pattern.slice(1) : pattern;
  if (source === '' || [...source].some((character) => '[]()+@'.includes(character))) {
    return { supported: false, matches: false };
  }
  const escaped = source.replace(/[.\\^$|{}]/g, '\\$&');
  const expression = escaped
    .replaceAll('**', '\0')
    .replaceAll('*', '[^/]*')
    .replaceAll('?', '[^/]')
    .replaceAll('\0', '.*');
  return { supported: true, matches: new RegExp(`^${expression}$`).test(branch), negated };
}

function branchFilterIncludes(patterns, branch) {
  const values = Array.isArray(patterns) ? patterns : [patterns];
  let included = false;
  for (const pattern of values) {
    if (typeof pattern !== 'string') return { supported: false, included: false };
    const result = globMatchesBranch(pattern, branch);
    if (!result.supported) return { supported: false, included: false };
    if (result.matches) included = !result.negated;
  }
  return { supported: true, included };
}

function pullRequestAvailability(trigger, targetBranch) {
  const unavailable = (reason) => ({ eligible: false, reason });
  if (trigger === 'pull_request') return { eligible: true, reason: null };
  if (Array.isArray(trigger)) {
    return trigger.includes('pull_request')
      ? { eligible: true, reason: null }
      : unavailable('workflow has no pull_request trigger');
  }
  if (!trigger || typeof trigger !== 'object' || !Object.hasOwn(trigger, 'pull_request')) {
    return unavailable('workflow has no pull_request trigger');
  }
  const pullRequest = trigger.pull_request ?? {};
  if (typeof pullRequest !== 'object' || Array.isArray(pullRequest)) {
    return unavailable('pull_request trigger has an unsupported shape');
  }
  if (pullRequest.paths || pullRequest['paths-ignore']) {
    return unavailable('pull_request trigger has path filters');
  }
  const requiredTypes = ['opened', 'ready_for_review', 'reopened', 'synchronize'];
  if (pullRequest.types) {
    const types = Array.isArray(pullRequest.types) ? pullRequest.types : [pullRequest.types];
    const missingTypes = requiredTypes.filter((type) => !types.includes(type));
    if (missingTypes.length > 0) {
      return unavailable(`pull_request trigger omits event types [${missingTypes.join(', ')}]`);
    }
  }
  if (pullRequest.branches) {
    const branchMatch = branchFilterIncludes(pullRequest.branches, targetBranch);
    if (!branchMatch.supported) return unavailable('pull_request branch filter is unsupported');
    if (!branchMatch.included) return unavailable(`pull_request does not target ${targetBranch}`);
  }
  if (pullRequest['branches-ignore']) {
    const ignored = branchFilterIncludes(pullRequest['branches-ignore'], targetBranch);
    if (!ignored.supported) return unavailable('pull_request branches-ignore is unsupported');
    if (ignored.included) return unavailable(`pull_request excludes ${targetBranch}`);
  }
  return { eligible: true, reason: null };
}

export function discoverWorkflowContexts(rootDir, targetBranch) {
  const workflowsDir = resolve(rootDir, '.github/workflows');
  const workflowFiles = readdirSync(workflowsDir)
    .filter((file) => /\.ya?ml$/.test(file))
    .map((file) => `.github/workflows/${file}`)
    .sort();
  const byContext = new Map();
  const byProducer = new Map();
  const availabilityByProducer = new Map();
  for (const workflow of workflowFiles) {
    const parsed = parseYaml(readFileSync(resolve(rootDir, workflow), 'utf8'));
    const availability = pullRequestAvailability(parsed?.on, targetBranch);
    for (const [jobId, job] of Object.entries(parsed?.jobs ?? {})) {
      const producer = { workflow, job: jobId };
      const contexts = renderJobContexts(job, `${workflow}#${jobId}`, jobId);
      byProducer.set(producerKey(producer), new Set(contexts));
      availabilityByProducer.set(producerKey(producer), availability);
      for (const context of contexts) {
        const producers = byContext.get(context) ?? [];
        producers.push(producer);
        byContext.set(context, producers);
      }
    }
  }
  return { byContext, byProducer, availabilityByProducer };
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

function refConditionMatches(pattern, targetBranch) {
  if (pattern === '~ALL' || pattern === '~DEFAULT_BRANCH') return true;
  const result = globMatchesBranch(pattern, `refs/heads/${targetBranch}`);
  return result.supported && result.matches && !result.negated;
}

function rulesetAppliesToTargetBranch(ruleset, targetBranch) {
  const { include, exclude } = ruleset.conditions.refName;
  return (
    include.some((pattern) => refConditionMatches(pattern, targetBranch)) &&
    !exclude.some((pattern) => refConditionMatches(pattern, targetBranch))
  );
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
    [...ruleset.checks]
      .sort((left, right) => left.context.localeCompare(right.context))
      .map((check) => [
        `${ruleset.name} (${ruleset.id})`,
        `${ruleset.enforcement}; ${ruleset.target}; +${ruleset.conditions.refName.include.join(', ')} / -${ruleset.conditions.refName.exclude.join(', ') || '–'}`,
        check.context,
        check.integrationId === null ? 'ungebunden' : String(check.integrationId),
      ]),
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
    ...markdownTable(
      ['Ruleset', 'Enforcement / Ziel / Ref-Bedingung', 'Required Context', 'Integration'],
      snapshotRows,
    ),
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
    if (!rulesetAppliesToTargetBranch(ruleset, manifest.targetBranch)) {
      errors.push(`${ruleset.name}: ruleset conditions do not apply to ${manifest.targetBranch}`);
    }
    for (const { context } of ruleset.checks) {
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
    const eligibleProducers = [...expectedProducers].filter(
      (producer) => discovered.availabilityByProducer.get(producer)?.eligible,
    );
    if (eligibleProducers.length === 0) {
      const reasons = [...expectedProducers]
        .map((producer) => {
          const availability = discovered.availabilityByProducer.get(producer);
          return `${producer}: ${availability?.reason ?? 'workflow job missing'}`;
        })
        .join(', ');
      errors.push(
        `${check.context}: no producer runs for pull requests targeting ${manifest.targetBranch}; ${reasons}`,
      );
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
        enforcement: ruleset.enforcement,
        target: ruleset.target,
        conditions: {
          refName: {
            include: [...(ruleset.conditions?.ref_name?.include ?? [])].sort(),
            exclude: [...(ruleset.conditions?.ref_name?.exclude ?? [])].sort(),
          },
        },
        checks: (statusRule.parameters?.required_status_checks ?? [])
          .map((check) => ({
            context: check.context,
            integrationId: check.integration_id ?? null,
          }))
          .sort(
            (left, right) =>
              left.context.localeCompare(right.context) ||
              String(left.integrationId).localeCompare(String(right.integrationId)),
          ),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function compareLiveRulesets(manifest, apiRulesets) {
  if (!Array.isArray(apiRulesets)) {
    return ['live ruleset evidence must be a JSON array'];
  }
  const expected = [...manifest.rulesets]
    .map((ruleset) => ({
      ...ruleset,
      conditions: {
        refName: {
          include: [...ruleset.conditions.refName.include].sort(),
          exclude: [...ruleset.conditions.refName.exclude].sort(),
        },
      },
      checks: [...ruleset.checks].sort(
        (left, right) =>
          left.context.localeCompare(right.context) ||
          String(left.integrationId).localeCompare(String(right.integrationId)),
      ),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  let actual;
  try {
    actual = extractLiveRulesets(apiRulesets);
  } catch (error) {
    return [`live ruleset evidence has an invalid shape: ${error.message}`];
  }
  return JSON.stringify(expected) === JSON.stringify(actual)
    ? []
    : [
        `live rulesets differ from manifest\nexpected: ${JSON.stringify(expected)}\nactual:   ${JSON.stringify(actual)}`,
      ];
}

export function validateRepository(options = {}) {
  const { rootDir = REPOSITORY_ROOT, liveRulesets } = options;
  const manifest = readJson(rootDir, MANIFEST_PATH);
  const schema = readJson(rootDir, SCHEMA_PATH);
  const shapeErrors = validateShape(manifest, schema);
  if (shapeErrors.length > 0) {
    return { errors: shapeErrors, manifest, expectedDocumentation: null };
  }
  const discovered = discoverWorkflowContexts(rootDir, manifest.targetBranch);
  const errors = validateManifestSemantics(manifest, discovered);
  if (Object.hasOwn(options, 'liveRulesets')) {
    errors.push(...compareLiveRulesets(manifest, liveRulesets));
  }
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
  const validationOptions = { rootDir: REPOSITORY_ROOT };
  if (args.liveRulesetsPath) validationOptions.liveRulesets = liveRulesets;
  const { errors, manifest } = validateRepository(validationOptions);
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

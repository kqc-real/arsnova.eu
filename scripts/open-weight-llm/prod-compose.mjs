#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { BlockList, isIP } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import { shouldValidateOpenWeightLlmStart } from './prod-compose-policy.mjs';

const privateAddresses = new BlockList();
privateAddresses.addSubnet('10.0.0.0', 8, 'ipv4');
privateAddresses.addSubnet('172.16.0.0', 12, 'ipv4');
privateAddresses.addSubnet('192.168.0.0', 16, 'ipv4');
privateAddresses.addSubnet('fc00::', 7, 'ipv6');

function isPrivateAddress(address) {
  const family = isIP(address);
  return family === 4
    ? privateAddresses.check(address, 'ipv4')
    : family === 6 && privateAddresses.check(address, 'ipv6');
}

function main() {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const envPath = resolve(repositoryRoot, '.env.llm');
  if (!existsSync(envPath)) {
    throw new Error('Missing .env.llm; copy .env.llm.example and set operator values');
  }
  const env = { ...process.env, ...parse(readFileSync(envPath)) };
  const image = env.OPEN_WEIGHT_LLM_IMAGE?.trim() ?? '';
  const bindAddress = env.OPEN_WEIGHT_LLM_BIND_ADDRESS?.trim() ?? '';
  const token = env.OPEN_WEIGHT_LLM_TOKEN ?? '';
  const modelDirectory = env.OPEN_WEIGHT_LLM_MODEL_DIR?.trim() ?? '';
  const composeArguments = process.argv.slice(2);

  if (shouldValidateOpenWeightLlmStart(composeArguments)) {
    if (!/@sha256:[a-f0-9]{64}$/.test(image)) {
      throw new Error('OPEN_WEIGHT_LLM_IMAGE must be pinned by sha256 digest');
    }
    if (!isIP(bindAddress) || !isPrivateAddress(bindAddress)) {
      throw new Error('OPEN_WEIGHT_LLM_BIND_ADDRESS must be a private IP literal');
    }
    if (token.length < 32 || token.length > 512 || !/^[A-Za-z0-9._~-]+$/.test(token)) {
      throw new Error('OPEN_WEIGHT_LLM_TOKEN must contain 32 to 512 URL-safe ASCII characters');
    }
    if (!modelDirectory.startsWith('/')) {
      throw new Error('OPEN_WEIGHT_LLM_MODEL_DIR must be absolute');
    }
    const manifest = JSON.parse(
      readFileSync(resolve(repositoryRoot, 'docker/open-weight-llm/model-manifest.json'), 'utf8'),
    );
    const filename = manifest.filename;
    if (typeof filename !== 'string' || !/^[A-Za-z0-9._-]+\.gguf$/.test(filename)) {
      throw new Error('model manifest filename must be a single GGUF basename');
    }
    const verification = spawnSync(
      process.execPath,
      [
        resolve(repositoryRoot, 'scripts/open-weight-llm/verify-model.mjs'),
        resolve(repositoryRoot, 'docker/open-weight-llm/model-manifest.json'),
        resolve(modelDirectory, filename),
      ],
      { env, stdio: 'inherit' },
    );
    if (verification.status !== 0) process.exit(verification.status ?? 1);
  }

  const compose = spawnSync(
    'docker',
    [
      'compose',
      '-f',
      resolve(repositoryRoot, 'docker-compose.llm.yml'),
      '--env-file',
      envPath,
      '--profile',
      'llm',
      ...composeArguments,
    ],
    { env, stdio: 'inherit' },
  );
  process.exit(compose.status ?? 1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

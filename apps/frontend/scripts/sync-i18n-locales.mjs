#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localeDir = path.join(__dirname, '../src/locale');
const sourcePath = path.join(localeDir, 'messages.xlf');
const localeConfigs = [
  { file: 'messages.en.xlf', language: 'en' },
  { file: 'messages.fr.xlf', language: 'fr' },
  { file: 'messages.es.xlf', language: 'es' },
  { file: 'messages.it.xlf', language: 'it' },
];

const unitRegex = /(<trans-unit\b[^>]*\bid="([^"]+)"[^>]*>)([\s\S]*?)<\/trans-unit>/g;
const sourceRegex = /<source>([\s\S]*?)<\/source>/;
const targetRegex = /<target>([\s\S]*?)<\/target>/;
const placeholderRegex = /<x [^>]+\/>/g;

function decodeEntities(text) {
  return text
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}

function encodeEntities(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function protectPlaceholders(text) {
  const placeholders = [];
  const protectedText = text.replace(placeholderRegex, (match) => {
    const token = `__XPH_${placeholders.length}__`;
    placeholders.push(match);
    return token;
  });
  return { protectedText, placeholders };
}

function restorePlaceholders(text, placeholders) {
  let result = text;
  placeholders.forEach((value, index) => {
    result = result.replaceAll(`__XPH_${index}__`, value);
  });
  return result;
}

function encodeEntitiesPreservingPlaceholders(text) {
  const { protectedText, placeholders } = protectPlaceholders(text);
  return restorePlaceholders(encodeEntities(protectedText), placeholders);
}

function normalizeMessage(text) {
  return decodeEntities(text).replace(/\s+/g, ' ').trim();
}

function parseUnits(content) {
  return [...content.matchAll(unitRegex)].map((match) => {
    const inner = match[3];
    const source = inner.match(sourceRegex)?.[1] ?? '';
    const target = inner.match(targetRegex)?.[1] ?? '';
    return {
      openTag: match[1],
      id: match[2],
      inner,
      source,
      target,
    };
  });
}

function buildUnitById(units) {
  const map = new Map();
  units.forEach((unit) => {
    if (unit.target.trim().length > 0) {
      map.set(unit.id, unit);
    }
  });
  return map;
}

function buildTargetBySource(units) {
  const map = new Map();
  units.forEach((unit) => {
    const key = normalizeMessage(unit.source);
    if (!key || unit.target.trim().length === 0 || map.has(key)) {
      return;
    }
    map.set(key, unit.target);
  });
  return map;
}

function insertTarget(inner, target) {
  if (targetRegex.test(inner)) {
    return inner.replace(targetRegex, `<target>${target}</target>`);
  }
  return inner.replace(
    /(\s*<\/source>\s*)/,
    `</source>\n        <target>${target}</target>\n        `,
  );
}

function getBodyBounds(content) {
  const start = content.indexOf('<body>');
  const end = content.indexOf('</body>');
  if (start === -1 || end === -1) {
    throw new Error('Invalid XLF file: <body> not found.');
  }
  return { start, end };
}

async function translateText(text, from, to) {
  if (!text.trim()) return text;
  const { protectedText, placeholders } = protectPlaceholders(text);
  const urlBase =
    `https://translate.googleapis.com/translate_a/t?client=dict-chrome-ex&sl=${encodeURIComponent(from)}` +
    `&tl=${encodeURIComponent(to)}&q=`;
  let lastError = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await fetch(`${urlBase}${encodeURIComponent(protectedText)}`);
    if (response.ok) {
      const json = await response.json();
      const translated = Array.isArray(json?.[0])
        ? json[0].map((part) => part?.[0] ?? '').join('')
        : (json?.[0] ?? '');
      return restorePlaceholders(translated, placeholders);
    }
    lastError = new Error(`Translate request failed (${response.status})`);
    const retryAfterSeconds = Number(response.headers.get('retry-after') ?? 0);
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(retryAfterSeconds * 1000, 1000 * attempt)),
    );
  }
  throw lastError ?? new Error('Translate request failed');
}

async function syncLocale(localeConfig, sourceUnits) {
  const localePath = path.join(localeDir, localeConfig.file);
  const localeContent = fs.readFileSync(localePath, 'utf8');
  const localeUnits = parseUnits(localeContent);
  const sourceIds = new Set(sourceUnits.map((unit) => unit.id));
  const orphanCount = localeUnits.filter((unit) => !sourceIds.has(unit.id)).length;
  const unitById = buildUnitById(localeUnits);
  const targetBySource = buildTargetBySource(localeUnits);
  const translationCache = new Map();

  let reusedById = 0;
  let reusedBySource = 0;
  let translated = 0;

  const rebuiltUnits = [];
  for (const sourceUnit of sourceUnits) {
    const sourceKey = normalizeMessage(sourceUnit.source);
    const sameIdUnit = unitById.get(sourceUnit.id);
    const targetByUnchangedId =
      sameIdUnit && normalizeMessage(sameIdUnit.source) === sourceKey ? sameIdUnit.target : null;
    let target = targetByUnchangedId ?? targetBySource.get(sourceKey) ?? null;
    let targetMarkup;

    if (target) {
      targetMarkup = target;
      if (targetByUnchangedId) {
        reusedById += 1;
      } else {
        reusedBySource += 1;
      }
    } else {
      const decodedSource = decodeEntities(sourceUnit.source);
      let translatedText = translationCache.get(decodedSource);
      if (!translatedText) {
        translatedText = await translateText(decodedSource, 'de', localeConfig.language);
        translationCache.set(decodedSource, translatedText);
      }
      targetMarkup = encodeEntitiesPreservingPlaceholders(translatedText);
      translated += 1;
      await new Promise((resolve) => setTimeout(resolve, 350));
    }

    rebuiltUnits.push(
      `${sourceUnit.openTag}${insertTarget(sourceUnit.inner, targetMarkup)}</trans-unit>`,
    );
  }

  const { start, end } = getBodyBounds(localeContent);
  const prefix = localeContent.slice(0, start + '<body>'.length);
  const suffix = localeContent.slice(end);
  const nextContent = `${prefix}\n${rebuiltUnits.map((unit) => `      ${unit}`).join('\n')}\n    ${suffix.replace(/^\s*/, '')}`;

  fs.writeFileSync(localePath, nextContent, 'utf8');
  console.log(
    `${localeConfig.file}: reused by id=${reusedById}, reused by source=${reusedBySource}, translated=${translated}, removed orphan=${orphanCount}`,
  );
}

async function main() {
  const sourceContent = fs.readFileSync(sourcePath, 'utf8');
  const sourceUnits = parseUnits(sourceContent);
  for (const localeConfig of localeConfigs) {
    await syncLocale(localeConfig, sourceUnits);
  }
}

await main();

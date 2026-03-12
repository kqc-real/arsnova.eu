#!/usr/bin/env node
/**
 * Auto-translates XLIFF <target> contents via Google Translate endpoint.
 * Usage:
 *   node scripts/auto-translate-xlf.mjs --file src/locale/messages.fr.xlf --from de --to fr
 *
 * Notes:
 * - Preserves Angular placeholder tags (<x .../>).
 * - Only translates entries where target is empty or equals source.
 * - Intended as bootstrap; human review remains mandatory.
 */

import fs from 'fs';
import path from 'path';

function getArg(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const fileArg = getArg('--file');
const from = getArg('--from', 'de');
const to = getArg('--to');

if (!fileArg || !to) {
  console.error('Usage: node scripts/auto-translate-xlf.mjs --file <xlf-file> --from <lang> --to <lang>');
  process.exit(1);
}

const xlfPath = path.isAbsolute(fileArg) ? fileArg : path.resolve(process.cwd(), fileArg);
const original = fs.readFileSync(xlfPath, 'utf8');

const unitRegex = /(<trans-unit id="([^"]+)"[^>]*>[\s\S]*?<source>([\s\S]*?)<\/source>[\s\S]*?<target>)([\s\S]*?)(<\/target>[\s\S]*?<\/trans-unit>)/g;
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
  const protectedText = text.replace(placeholderRegex, (m) => {
    const token = `__XPH_${placeholders.length}__`;
    placeholders.push(m);
    return token;
  });
  return { protectedText, placeholders };
}

function restorePlaceholders(text, placeholders) {
  let result = text;
  placeholders.forEach((value, i) => {
    result = result.replaceAll(`__XPH_${i}__`, value);
  });
  return result;
}

function encodeEntitiesPreservingPlaceholders(text) {
  const { protectedText, placeholders } = protectPlaceholders(text);
  const escaped = encodeEntities(protectedText);
  return restorePlaceholders(escaped, placeholders);
}

async function translateText(text) {
  if (!text.trim()) return text;
  const { protectedText, placeholders } = protectPlaceholders(text);
  const urlBase =
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(from)}` +
    `&tl=${encodeURIComponent(to)}&dt=t&q=`;
  let lastError = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const res = await fetch(`${urlBase}${encodeURIComponent(protectedText)}`);
    if (res.ok) {
      const json = await res.json();
      const translated = (json?.[0] ?? []).map((part) => part?.[0] ?? '').join('');
      return restorePlaceholders(translated, placeholders);
    }
    lastError = new Error(`Translate request failed (${res.status})`);
    await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
  }
  throw lastError ?? new Error('Translate request failed');
}

const matches = [...original.matchAll(unitRegex)];
const translatable = matches
  .map((m) => ({
    full: m[0],
    head: m[1],
    id: m[2],
    source: m[3],
    target: m[4],
    tail: m[5],
  }))
  .filter((u) => {
    const source = u.source.trim();
    const target = u.target.trim();
    return source.length > 0 && (target.length === 0 || target === source);
  });

const uniqueSourceTexts = [...new Set(translatable.map((u) => decodeEntities(u.source.trim())))];
const translationMap = new Map();

for (let i = 0; i < uniqueSourceTexts.length; i += 1) {
  const text = uniqueSourceTexts[i];
  const translated = await translateText(text);
  translationMap.set(text, translated);
  if ((i + 1) % 25 === 0 || i + 1 === uniqueSourceTexts.length) {
    console.log(`Translated ${i + 1}/${uniqueSourceTexts.length}`);
  }
  await new Promise((resolve) => setTimeout(resolve, 80));
}

let updated = original;
for (const unit of translatable) {
  const key = decodeEntities(unit.source.trim());
  const translated = translationMap.get(key) ?? key;
  const escaped = encodeEntitiesPreservingPlaceholders(translated);
  updated = updated.replace(unit.full, `${unit.head}${escaped}${unit.tail}`);
}

fs.writeFileSync(xlfPath, updated, 'utf8');
console.log(`Updated ${translatable.length} target(s) in ${xlfPath}`);

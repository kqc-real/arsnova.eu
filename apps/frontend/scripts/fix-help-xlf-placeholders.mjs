#!/usr/bin/env node
/**
 * Repariert in help.*-trans-units falsch entity-escapete <x id="..."/>-Platzhalter
 * (entstehen z. B. nach sync-i18n mit Google Translate).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localeDir = path.join(__dirname, '../src/locale');
const files = ['messages.en.xlf', 'messages.fr.xlf', 'messages.es.xlf', 'messages.it.xlf'];

for (const file of files) {
  const p = path.join(localeDir, file);
  let c = fs.readFileSync(p, 'utf8');
  const unitRegex = /<trans-unit\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/trans-unit>/g;
  let fixed = 0;
  c = c.replace(unitRegex, (full, id, inner) => {
    if (!id.startsWith('help.')) return full;
    const targetMatch = inner.match(/<target>([\s\S]*?)<\/target>/);
    if (!targetMatch) return full;
    const body = targetMatch[1];
    if (!body.includes('&lt;x id=')) return full;
    const decoded = body
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&apos;', "'");
    fixed += 1;
    const newInner = inner.replace(/<target>[\s\S]*?<\/target>/, `<target>${decoded}</target>`);
    return full.replace(inner, newInner);
  });
  fs.writeFileSync(p, c, 'utf8');
  console.log(`${file}: fixed ${fixed} help.* targets with escaped placeholders`);
}

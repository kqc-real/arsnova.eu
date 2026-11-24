#!/usr/bin/env node
// Baut reference-dataset.v2.1.json: übernimmt v2 unverändert (Q001–Q500) und ergänzt
// fachfremde Fragen (Botanik, Geschichte) als Out-of-Domain-Testscheibe.
// Zweck: Der 8.9b-Seed enthält nur Statistik/ML-Inhalte; geprüft wird, wie Klassifikation
// und Encoder-Themen auf Fachvokabular reagieren, das im Seed nicht vorkommt.
// Aufruf: node build-dataset-ood.mjs <reference-dataset.v2.json> <reference-dataset.v2.1.json>
import { readFileSync, writeFileSync } from 'node:fs';

const [v2Path, outPath] = process.argv.slice(2);
if (!v2Path || !outPath) {
  console.error(
    'usage: node build-dataset-ood.mjs <reference-dataset.v2.json> <reference-dataset.v2.1.json>',
  );
  process.exit(2);
}
const v2 = JSON.parse(readFileSync(v2Path, 'utf8'));

// ---------- Fachfremde Familien ----------
const FAMILIES = [
  {
    id: 'B-PHOTO',
    domain: 'botany',
    category: 'content',
    label: 'Lichtreaktion und Calvin-Zyklus erklären',
  },
  {
    id: 'B-MONO',
    domain: 'botany',
    category: 'content',
    label: 'Monokotyle und Dikotyle unterscheiden',
  },
  {
    id: 'B-WATER',
    domain: 'botany',
    category: 'content',
    label: 'Wassertransport von der Wurzel ins Blatt',
  },
  {
    id: 'B-TRIP',
    domain: 'botany',
    category: 'organization',
    label: 'Exkursion in den Botanischen Garten: Termin, Treffpunkt, Ausrüstung',
  },
  {
    id: 'B-HERB',
    domain: 'botany',
    category: 'organization',
    label: 'Herbarium: Abgabefrist und Umfang',
  },
  {
    id: 'B-MICRO',
    domain: 'botany',
    category: 'technical',
    label: 'Mikroskopkamera überträgt kein Bild',
  },
  {
    id: 'H-WEIMAR',
    domain: 'history',
    category: 'content',
    label: 'Ursachen für das Scheitern der Weimarer Republik',
  },
  {
    id: 'H-SOURCE',
    domain: 'history',
    category: 'content',
    label: 'Primär- und Sekundärquellen unterscheiden',
  },
  {
    id: 'H-WESTF',
    domain: 'history',
    category: 'content',
    label: 'Westfälischer Frieden und seine Folgen',
  },
  {
    id: 'H-ARCH',
    domain: 'history',
    category: 'organization',
    label: 'Archivbesuch: Anmeldung und Treffpunkt',
  },
  {
    id: 'H-ESSAY',
    domain: 'history',
    category: 'organization',
    label: 'Hausarbeit: Umfang, Frist, Zitierweise',
  },
  {
    id: 'H-DB',
    domain: 'history',
    category: 'technical',
    label: 'Digitale Zeitungsdatenbank lädt nicht',
  },
];

// ---------- Items: [locale, tags, text] ('short' wird aus der Tokenzahl berechnet) ----------
const ITEMS = {
  'B-PHOTO': [
    [
      'de',
      'canonical',
      'Können Sie den Unterschied zwischen Lichtreaktion und Calvin-Zyklus nochmal erklären?',
    ],
    ['de', '', 'Wozu braucht der Calvin-Zyklus eigentlich das ATP aus der Lichtreaktion?'],
    ['de', 'typo', 'lichtreaktion vs calvin zyklus versteh ich nicht'],
    ['en', 'canonical', 'Could you explain again how the light reactions feed the Calvin cycle?'],
    ['en', '', 'Why does the Calvin cycle need ATP and NADPH?'],
    [
      'fr',
      'canonical',
      'Pouvez-vous réexpliquer le lien entre la phase lumineuse et le cycle de Calvin ?',
    ],
    [
      'es',
      'canonical',
      '¿Puede explicar otra vez la relación entre la fase luminosa y el ciclo de Calvin?',
    ],
  ],
  'B-MONO': [
    ['de', 'canonical', 'Woran erkenne ich, ob eine Pflanze monokotyl oder dikotyl ist?'],
    [
      'de',
      '',
      'Ist die parallele Blattaderung wirklich das sicherste Merkmal für Einkeimblättrige?',
    ],
    ['de', '', 'Einkeimblättrig oder zweikeimblättrig – wie bestimmen?'],
    ['en', 'canonical', 'How do I tell monocots from dicots?'],
    ['en', '', 'Are parallel leaf veins always a sign of a monocot?'],
    ['fr', 'canonical', "Comment distinguer une monocotylédone d'une dicotylédone ?"],
    ['es', 'canonical', '¿Cómo se distingue una monocotiledónea de una dicotiledónea?'],
  ],
  'B-WATER': [
    ['de', 'canonical', 'Wie kommt das Wasser eigentlich von der Wurzel bis in die Blätter?'],
    ['de', '', 'Welche Rolle spielt der Caspary-Streifen bei der Wasseraufnahme?'],
    ['de', '', 'Reicht der Transpirationssog allein für den Wassertransport aus?'],
    ['en', 'canonical', 'How does water get from the roots up to the leaves?'],
    ['en', '', 'What does the Casparian strip actually do?'],
    ['fr', 'canonical', "Comment l'eau monte-t-elle des racines jusqu'aux feuilles ?"],
    ['es', 'canonical', '¿Cómo sube el agua desde la raíz hasta las hojas?'],
  ],
  'B-TRIP': [
    ['de', 'canonical', 'Wann ist die Exkursion in den Botanischen Garten und wo treffen wir uns?'],
    ['de', '', 'Ist die Exkursion zum Botanischen Garten verpflichtend?'],
    ['de', '', 'Brauchen wir für die Exkursion feste Schuhe oder eine Lupe?'],
    ['en', 'canonical', 'When and where do we meet for the botanical garden field trip?'],
    ['fr', 'canonical', 'À quelle heure est le rendez-vous pour la sortie au jardin botanique ?'],
    ['es', 'canonical', '¿Cuándo es la excursión al jardín botánico y dónde quedamos?'],
  ],
  'B-HERB': [
    ['de', 'canonical', 'Bis wann müssen wir unser Herbarium abgeben?'],
    ['de', '', 'Wie viele Belege muss das Herbarium mindestens enthalten?'],
    ['en', '', "What's the deadline for handing in the herbarium?"],
    ['fr', 'canonical', "Combien de planches faut-il rendre pour l'herbier ?"],
    ['es', 'canonical', '¿Cuándo hay que entregar el herbario?'],
  ],
  'B-MICRO': [
    ['de', 'canonical', 'Das Bild der Mikroskopkamera kommt auf der Leinwand nicht an.'],
    ['de', '', 'Die Übertragung vom Mikroskop ist nur noch schwarz.'],
    ['en', 'canonical', "The microscope camera isn't showing on the screen."],
    ['fr', 'canonical', "La caméra du microscope n'affiche rien sur l'écran."],
    ['es', 'canonical', 'La cámara del microscopio no se ve en la pantalla.'],
  ],
  'H-WEIMAR': [
    [
      'de',
      'canonical',
      'Welche Gründe waren für das Scheitern der Weimarer Republik am wichtigsten?',
    ],
    ['de', '', 'Lag das Ende von Weimar eher an der Verfassung oder an der Wirtschaftskrise?'],
    ['de', '', 'Welche Rolle spielte Artikel 48 beim Ende der Republik?'],
    ['en', 'canonical', 'Why did the Weimar Republic fail?'],
    ['en', '', 'Was Article 48 the main reason Weimar collapsed?'],
    ['fr', 'canonical', 'Pourquoi la république de Weimar a-t-elle échoué ?'],
    ['es', 'canonical', '¿Por qué fracasó la República de Weimar?'],
  ],
  'H-SOURCE': [
    ['de', 'canonical', 'Worin unterscheiden sich Primär- und Sekundärquellen?'],
    ['de', '', 'Zählt ein Zeitzeugeninterview von 1990 als Primärquelle?'],
    ['de', '', 'Ist ein Schulbuch von 1935 eine Primär- oder eine Sekundärquelle?'],
    ['en', 'canonical', "What's the difference between a primary and a secondary source?"],
    ['en', '', 'Is a memoir written decades later a primary source?'],
    ['fr', 'canonical', 'Quelle différence entre source primaire et source secondaire ?'],
    ['es', 'canonical', '¿Qué diferencia hay entre una fuente primaria y una secundaria?'],
  ],
  'H-WESTF': [
    ['de', 'canonical', 'Was hat der Westfälische Frieden von 1648 konkret verändert?'],
    ['de', '', 'Warum gilt der Westfälische Frieden als Beginn des modernen Staatensystems?'],
    ['de', 'typo', 'westfälischer frieden folgen??'],
    ['en', 'canonical', 'What did the Peace of Westphalia actually change?'],
    ['en', '', 'Why is the Peace of Westphalia seen as the start of the modern state system?'],
    ['fr', 'canonical', "Qu'a changé concrètement la paix de Westphalie ?"],
    ['es', 'canonical', '¿Qué cambió realmente con la Paz de Westfalia?'],
  ],
  'H-ARCH': [
    ['de', 'canonical', 'Müssen wir uns für den Archivbesuch vorher anmelden?'],
    ['de', '', 'Um wie viel Uhr treffen wir uns vor dem Stadtarchiv?'],
    ['en', 'canonical', 'Is there a sign-up list for the archive visit?'],
    ['fr', 'canonical', "Faut-il s'inscrire avant la visite aux archives ?"],
    ['es', 'canonical', '¿Hay que inscribirse antes de la visita al archivo?'],
  ],
  'H-ESSAY': [
    ['de', 'canonical', 'Wie viele Seiten soll die Hausarbeit haben und bis wann ist sie fällig?'],
    ['de', '', 'Sollen wir in der Hausarbeit mit Fußnoten zitieren?'],
    ['en', 'canonical', 'How long should the term paper be, and when is it due?'],
    ['fr', 'canonical', 'Quelle longueur pour le dossier, et pour quand ?'],
    ['es', 'canonical', '¿Cuántas páginas tiene que tener el trabajo y para cuándo es?'],
  ],
  'H-DB': [
    ['de', 'canonical', 'Die Zeitungsdatenbank für die Übung lädt seit heute Morgen nicht.'],
    ['de', '', 'Beim Öffnen der digitalen Zeitungsarchive kommt nur eine Fehlerseite.'],
    ['en', 'canonical', "The newspaper archive database won't load."],
    ['fr', 'canonical', "La base de données de presse ne s'ouvre pas."],
    ['es', 'canonical', 'La base de datos de periódicos no carga.'],
  ],
};

// Gleicher Tokenbegriff wie in der Review-Seite (Entscheidung F5).
const tokenCount = (s) => (s.match(/[\p{L}\p{N}'’-]+/gu) || []).length;
const famById = new Map(FAMILIES.map((f) => [f.id, f]));
const items = [];
for (const f of FAMILIES) {
  for (const [locale, tags, text] of ITEMS[f.id]) {
    const t = tags.split(' ').filter(Boolean);
    if (tokenCount(text) <= 5) t.push('short');
    t.push('out-of-domain');
    items.push({ family: f.id, category: f.category, domain: f.domain, locale, tags: t, text });
  }
}
items.forEach((it, k) => {
  it.id = `Q${String(v2.items.length + k + 1).padStart(3, '0')}`;
});

// ---------- Prüfungen ----------
const errors = [];
const norm = (s) =>
  s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const seen = new Map(v2.items.map((i) => [norm(i.text), i.id]));
for (const it of items) {
  const k = norm(it.text);
  if (seen.has(k)) errors.push(`Duplikat: ${seen.get(k)} / ${it.id} »${it.text}«`);
  seen.set(k, it.id);
  if (famById.get(it.family).category !== it.category) errors.push(`${it.id}: Kategorie ≠ Familie`);
}
const v2Fams = new Set(v2.families.map((f) => f.id));
for (const f of FAMILIES) {
  if (v2Fams.has(f.id)) errors.push(`Familien-ID ${f.id} existiert bereits`);
  const own = items.filter((i) => i.family === f.id);
  for (const lang of ['de', 'en', 'fr', 'es'])
    if (!own.some((i) => i.locale === lang)) errors.push(`${f.id}: keine ${lang}-Frage`);
}

const meta = structuredClone(v2.meta);
meta.version = '2.1.0-draft';
meta.created = '2026-10-23';
meta.composition +=
  ' Ab v2.1 zusätzlich fachfremde Familien (B-* Botanik, H-* Geschichte) mit Feld domain.';
meta.idNote =
  'Q001–Q500 unverändert aus v2; Q501 ff. fachfremde Ergänzung (build-dataset-ood.mjs).';
meta.domainRules = {
  default: 'Items ohne Feld domain gehören zur Statistik-Vorlesung (domain = statistics).',
  purpose:
    'Der 8.9b-Seed (qaNlpSeed.ts) enthält inhaltlich nur Statistik/ML. Fachfremde Items prüfen, ob Kategorien und Themen auf unbekanntes Fachvokabular übertragbar sind.',
  categories: 'Die Kategorieregeln gelten unverändert; sie sind fachunabhängig.',
  topics:
    'Themenmessung je Domäne getrennt (eine Sitzung = ein Fach); Domänen werden nie in einer Sitzung gemischt.',
  classification:
    'Kennzahlen je Domäne getrennt; die Statistik-Kennzahlen bleiben mit v2 vergleichbar.',
};
meta.tags = {
  ...meta.tags,
  'out-of-domain': 'Fachfremde Frage (Botanik oder Geschichte); Fachvokabular nicht im Seed',
};

const out = {
  ...v2,
  meta,
  families: [...v2.families, ...FAMILIES],
  items: [...v2.items, ...items],
};
const count = (key) =>
  items.reduce((m, i) => {
    m[key(i)] = (m[key(i)] ?? 0) + 1;
    return m;
  }, {});
console.log(`Neu ${items.length} Items (gesamt ${out.items.length}), ${FAMILIES.length} Familien`);
console.log(
  'Domäne:   ',
  count((i) => i.domain),
);
console.log(
  'Kategorie:',
  count((i) => i.category),
);
console.log(
  'Sprache:  ',
  count((i) => i.locale),
);
if (errors.length) {
  console.error(`\n${errors.length} Fehler:`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`geschrieben: ${outPath}`);

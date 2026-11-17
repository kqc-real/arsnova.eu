#!/usr/bin/env node

const profiles = {
  nlp: {
    title: 'Entwicklung mit lokaler Textanalyse',
    components: {
      language: true,
      topics: true,
      summary: false,
      llm: false,
    },
  },
  summary: {
    title: 'Entwicklung mit lokaler Zusammenfassung',
    components: {
      language: true,
      topics: true,
      summary: true,
      llm: false,
    },
  },
  ai: {
    title: 'Entwicklung mit allen KI-Komponenten',
    components: {
      language: true,
      topics: true,
      summary: true,
      llm: true,
    },
  },
};

function argumentValue(name, fallback) {
  const prefix = `--${name}=`;
  return (
    process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? fallback
  );
}

const profileName = argumentValue('profile', 'nlp');
const locale = argumentValue('locale', 'de');
const profile = profiles[profileName];

if (!profile) {
  console.error(`Unbekanntes Entwicklungsprofil: ${profileName}`);
  console.error(`Erlaubt sind: ${Object.keys(profiles).join(', ')}`);
  process.exit(1);
}

const colorsEnabled =
  process.env.FORCE_COLOR === '1' ||
  (process.env.NO_COLOR === undefined && process.stdout.isTTY === true);
const color = (code, text) => (colorsEnabled ? `\u001B[${code}m${text}\u001B[0m` : text);
const active = (enabled) =>
  enabled
    ? `${color('1;32', '● AKTIV')}      wird mit diesem Befehl gestartet`
    : `${color('2;37', '○ AUS')}        wird mit diesem Befehl nicht gestartet`;

const summaryTechnology = profile.components.llm
  ? 'Qwen3-4B-Instruct (privates Sprachmodell über den SSH-Tunnel). Falls es nicht antwortet oder keine brauchbare Antwort liefert, erstellt arsnova.eu lokal eine einfache Ersatzfassung.'
  : process.env.GEMINI_API_KEY
    ? 'Gemini über den lokalen Test-Helfer. Dafür werden die ausgewählten Texte an Google gesendet. Dieser Weg ist nur für die lokale Entwicklung vorgesehen.'
    : 'Kein Sprachmodell. Der lokale Test-Helfer wählt wichtige Originalbeiträge nach festen Regeln aus.';

const rows = [
  {
    name: 'Wörter auf ihre Grundform zurückführen (Lemmatisierung)',
    enabled: profile.components.language,
    place:
      'In der Q&A-Wortwolke und bei Freitextfragen, in den Ansichten »Wörter« und »Wörter & Phrasen«.',
    source:
      'Die Teilnehmenden: ihre sichtbaren Q&A-Fragen oder ihre Antworten auf die aktuell ausgewählte Freitextfrage.',
    locales: 'de, en, fr, es und it.',
    purpose:
      'Die Lehrkraft sieht eine übersichtlichere Wortwolke. Formen desselben Wortes, zum Beispiel »Frage« und »Fragen« oder »validiert« und »validieren«, werden unter ihrer Grundform gemeinsam gezählt.',
    technology:
      'spaCy 3.8 übernimmt die Lemmatisierung. Die Modelle für Deutsch, Englisch, Französisch und Spanisch sowie die italienische Lookup-Tabelle laufen auf diesem Rechner.',
  },
  {
    name: 'Ähnliche Beiträge zu Themen gruppieren',
    enabled: profile.components.topics,
    place:
      'In der Q&A-Wortwolke und bei Freitextfragen, sobald die Lehrkraft die Ansicht »Themen« wählt.',
    source:
      'Die Teilnehmenden: ihre Q&A-Fragen oder Freitextantworten. Namen oder Benutzerkonten werden für die Gruppierung nicht verwendet.',
    locales: 'de, en, fr, es und it.',
    purpose:
      'Die Lehrkraft sieht mehrere Themenblasen. Beiträge mit ähnlicher Bedeutung landen in derselben Blase.',
    technology:
      'intfloat/multilingual-e5-small vergleicht die Bedeutung der Texte. Kein kNN: Das Backend bildet die Gruppen mit agglomerativem Complete-Linkage-Clustering und einer Kosinus-Schwelle von 0,87.',
  },
  {
    name: 'Themenblasen kurz benennen',
    enabled: profile.components.llm,
    place: 'Als kurze Beschriftung auf den Themenblasen der Q&A- und Freitext-Wortwolke.',
    source:
      'Je Gruppe einige typische Fragen oder Antworten der Teilnehmenden, die zuvor bereits zusammengeordnet wurden.',
    locales: 'de, en, fr, es und it.',
    purpose:
      'Die Lehrkraft erkennt schneller, worum es in einer Themenblase geht. Das Sprachmodell formuliert nur den Namen und sortiert keine Beiträge um.',
    technology:
      'Qwen3-4B-Instruct. Das private Sprachmodell wird über den SSH-Tunnel erreicht; bei einem Fehler bleibt eine lokal erzeugte Beschriftung erhalten.',
  },
  {
    name: 'Offene Fragen für die Lehrkraft zusammenfassen',
    enabled: profile.components.summary,
    place:
      'Im Moderationskompass unter »Wichtige offene Fragen«, nachdem die Lehrkraft »Fragen zusammenfassen« gewählt hat.',
    source:
      'Je nach Session: Q&A-Fragen der Teilnehmenden, bereits gebildete Themen, Hinweise aus dem Moderationskompass, von der Lehrkraft hinterlegte Lernziele sowie freigegebene, zusammengezählte Ergebnisse. Die Zusammenfassung ordnet Aussagen keinen Personen zu.',
    locales: 'de, en, fr, es und it.',
    purpose:
      'Die Lehrkraft erhält zwei bis vier kurze Punkte zu den wichtigsten noch offenen Fragen und kann die dazu verwendeten Beiträge als Belege prüfen.',
    technology: summaryTechnology,
  },
  {
    name: 'Lernziele für einen Quizentwurf vorschlagen',
    enabled: profile.components.llm,
    place:
      'In der Quizvorbereitung bei den Lernzielen, nachdem die Lehrkraft die Erstellung ausdrücklich startet.',
    source:
      'Die Lehrkraft: aktive, bewertbare Quizfragen einschließlich Antworten und Lösungen. Dafür werden keine Beiträge oder Namen von Teilnehmenden verwendet.',
    locales: 'de, en, fr, es und it.',
    purpose:
      'Die Lehrkraft erhält Lernzielvorschläge als Entwürfe. Sie muss jeden Vorschlag prüfen; die App bestätigt oder veröffentlicht ihn nicht automatisch.',
    technology:
      'Qwen3-4B-Instruct. Das private Sprachmodell wird über den SSH-Tunnel erreicht; es gibt keinen Cloud-Ersatzdienst.',
  },
];

console.log('');
console.log(
  color('1;36', '══════════════════════════════════════════════════════════════════════'),
);
console.log(color('1;36', ` arsnova.eu · ${profile.title}`));
console.log(
  color('1;36', '══════════════════════════════════════════════════════════════════════'),
);
console.log('');
console.log(color('1;37', 'Was die KI-Funktionen in der App tun'));
for (const row of rows) {
  console.log(`  ${active(row.enabled)}  ${color('1', row.name)}`);
  console.log(`                  ${color('1', 'Wo sichtbar:')}       ${row.place}`);
  console.log(`                  ${color('1', 'Texte stammen von:')} ${row.source}`);
  console.log(`                  ${color('1', 'Aktive Locales:')}    ${row.locales}`);
  console.log(`                  ${color('1', 'Nutzen:')}            ${row.purpose}`);
  console.log(`                  ${color('1', 'Modell/Verfahren:')}  ${row.technology}`);
  console.log('');
}
console.log(color('1;37', 'Logkanäle und Anwendung'));
const serverTask = profile.components.llm
  ? 'App-Backend; übergibt Themenbeschriftungen, Zusammenfassungen und Lernzielaufträge an das private Qwen-Modell'
  : profile.components.summary
    ? 'App-Backend; übergibt ausgewählte Fragen an den lokalen Zusammenfassungshelfer'
    : 'App-Backend; verarbeitet die Daten der App';
console.log(`  ${color('1;34', 'SERVER')}           ${serverTask} · http://localhost:3000`);
console.log(
  `  ${color('1;32', 'WEB')}              Weboberfläche für Lehrkräfte und Teilnehmende (${locale}) · http://localhost:4200`,
);
if (profile.components.summary) {
  const summaryHelperTask = profile.components.llm
    ? 'Lokale Ersatzfassung, falls der private KI-Dienst nicht verwendet werden kann'
    : 'Erstellt die Zusammenfassung lokal oder – mit Gemini-Key – über Gemini';
  console.log(
    `  ${color('1;33', 'ZUSAMMENFASSUNG')}  ${summaryHelperTask} · http://127.0.0.1:8787/summary`,
  );
}
console.log(`  ${color('1;35', 'LEMMATISIERUNG')}  spaCy führt Wörter auf ihre Grundform zurück`);
console.log(
  `  ${color('1;36', 'THEMEN')}           E5-Vektoren plus Complete-Linkage-Clustering gruppieren ähnliche Beiträge; kein kNN`,
);
console.log('');
console.log(
  color(
    '2;37',
    'Die farbigen Kürzel vor den folgenden Meldungen zeigen, zu welchem Teil sie gehören.',
  ),
);
console.log(
  color('1;36', '──────────────────────────────────────────────────────────────────────'),
);
console.log('');

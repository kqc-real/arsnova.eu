#!/usr/bin/env node
// Baut reference-dataset.v2.2.json: übernimmt v2.1 unverändert (Q001–Q573) und ergänzt
// 150 Fragen aus dem Unterricht einer Polizeischule (domain = police).
// Zweck: zweite, praxisnahe Out-of-Domain-Scheibe. Der 8.9b-Seed enthält nur Statistik/ML;
// Polizeiausbildung bringt eigenes Fach- und Organisationsvokabular (Schießstand, Dienststelle,
// Digitalfunk, Vorgangsbearbeitung), das lexikalisch nah an allen drei Kategorien liegt.
// Aufruf: node build-dataset-police.mjs <reference-dataset.v2.1.json> <reference-dataset.v2.2.json>
import { readFileSync, writeFileSync } from 'node:fs';

const [inPath, outPath] = process.argv.slice(2);
if (!inPath || !outPath) {
  console.error(
    'usage: node build-dataset-police.mjs <reference-dataset.v2.1.json> <reference-dataset.v2.2.json>',
  );
  process.exit(2);
}
const base = JSON.parse(readFileSync(inPath, 'utf8'));

// ---------- Familien (eine Antwort/Handlung der Lehrperson erledigt alle Items) ----------
const FAMILIES = [
  // content
  {
    id: 'P-NOTWEHR',
    category: 'content',
    label: 'Notwehr (§ 32 StGB) und Notstand (§ 34 StGB) abgrenzen',
  },
  {
    id: 'P-FESTNAHME',
    category: 'content',
    label: 'Vorläufige Festnahme nach § 127 StPO: Jedermann vs. Polizei',
  },
  {
    id: 'P-VERHAELT',
    category: 'content',
    label: 'Verhältnismäßigkeit polizeilicher Maßnahmen prüfen',
  },
  {
    id: 'P-BELEHRUNG',
    category: 'content',
    label: 'Belehrung von Beschuldigten und Zeugen (§§ 136, 163a StPO)',
  },
  {
    id: 'P-UZWANG',
    category: 'content',
    label: 'Unmittelbarer Zwang und Schusswaffengebrauch: Voraussetzungen',
  },
  {
    id: 'P-SPUREN',
    category: 'content',
    label: 'Spurensicherung am Tatort und Kontamination vermeiden',
  },
  { id: 'P-DEESK', category: 'content', label: 'Deeskalierende Kommunikation in Konfliktlagen' },
  {
    id: 'P-LEGAL',
    category: 'content',
    label: 'Legalitäts- und Opportunitätsprinzip, Gefahrenabwehr vs. Strafverfolgung',
  },
  // organization
  {
    id: 'P-SCHIESS',
    category: 'organization',
    label: 'Schießtraining: Termin, Schießstand, Schutzausrüstung',
  },
  { id: 'P-SPORT', category: 'organization', label: 'Sporttest: Anforderungen und Nachholtermin' },
  {
    id: 'P-PRAKT',
    category: 'organization',
    label: 'Praktikum auf der Dienststelle: Zuteilung und Dienstplan',
  },
  {
    id: 'P-UNIFORM',
    category: 'organization',
    label: 'Dienstkleidung im Unterricht und Ausrüstungsausgabe',
  },
  {
    id: 'P-GESETZ',
    category: 'organization',
    label: 'Klausur: zugelassene Gesetzestexte und Markierungen',
  },
  {
    id: 'P-HALLE',
    category: 'organization',
    label: 'Einsatztraining in der Trainingshalle: Treffpunkt und Kleidung',
  },
  // technical
  {
    id: 'P-SIM',
    category: 'technical',
    label: 'Einsatz-/Schießsimulator startet nicht oder zeigt kein Bild',
  },
  {
    id: 'P-VBS',
    category: 'technical',
    label: 'Schulungsumgebung der Vorgangsbearbeitung: Anmeldung schlägt fehl',
  },
  {
    id: 'P-FUNK',
    category: 'technical',
    label: 'Digitalfunk-Übungsgeräte bekommen keine Verbindung',
  },
  {
    id: 'P-BODYCAM',
    category: 'technical',
    label: 'Bodycam-Aufnahme aus dem Training spielt nicht ab',
  },
];

// ---------- Items: [locale, tags, text] ('short' wird aus der Tokenzahl berechnet) ----------
const ITEMS = {
  'P-NOTWEHR': [
    [
      'de',
      'canonical',
      'Können Sie den Unterschied zwischen Notwehr und rechtfertigendem Notstand nochmal erklären?',
    ],
    ['de', '', 'Ist ein Angriff auf eine Sache auch notwehrfähig oder nur einer auf Personen?'],
    ['de', '', 'Wann ist eine Notwehrhandlung nicht mehr geboten?'],
    ['de', 'typo', 'notwehr oder notstand was is der unterschied'],
    [
      'en',
      'canonical',
      'Could you explain the difference between self-defence and necessity again?',
    ],
    [
      'fr',
      'canonical',
      'Pouvez-vous réexpliquer la différence entre légitime défense et état de nécessité ?',
    ],
    [
      'es',
      'canonical',
      '¿Puede explicar otra vez la diferencia entre legítima defensa y estado de necesidad?',
    ],
  ],
  'P-FESTNAHME': [
    [
      'de',
      'canonical',
      'Worin unterscheidet sich die Jedermann-Festnahme von der Festnahme durch die Polizei?',
    ],
    ['de', '', 'Braucht die Polizei für § 127 Abs. 2 StPO immer Gefahr im Verzug?'],
    ['de', '', 'Darf ein Ladendetektiv jemanden bis zum Eintreffen der Streife festhalten?'],
    ['de', '', 'Was heißt »auf frischer Tat betroffen« genau?'],
    [
      'de',
      'code-switch',
      'Ist die vorläufige Festnahme basically dasselbe wie eine Ingewahrsamnahme?',
    ],
    [
      'en',
      'canonical',
      "What's the difference between a citizen's arrest and an arrest by the police?",
    ],
    [
      'fr',
      'canonical',
      "Quelle est la différence entre l'arrestation par un citoyen et celle par la police ?",
    ],
    [
      'es',
      'canonical',
      '¿Qué diferencia hay entre la detención por un ciudadano y la detención policial?',
    ],
  ],
  'P-VERHAELT': [
    [
      'de',
      'canonical',
      'Wie prüfe ich die Verhältnismäßigkeit einer Maßnahme Schritt für Schritt?',
    ],
    ['de', '', 'Wie grenze ich »erforderlich« und »angemessen« bei der Prüfung voneinander ab?'],
    [
      'de',
      '',
      'Ist eine Identitätsfeststellung schon unverhältnismäßig, wenn die Person kooperiert?',
    ],
    ['de', '', 'Muss ich immer das mildeste Mittel wählen, auch wenn es weniger sicher ist?'],
    ['en', 'canonical', 'How do I check whether a police measure is proportionate?'],
    [
      'en',
      '',
      'What is the difference between necessary and appropriate in the proportionality test?',
    ],
    ['fr', 'canonical', "Comment vérifier la proportionnalité d'une mesure de police ?"],
    ['es', 'canonical', '¿Cómo compruebo si una medida policial es proporcionada?'],
  ],
  'P-BELEHRUNG': [
    [
      'de',
      'canonical',
      'Wann genau muss ich jemanden als Beschuldigten belehren und nicht mehr als Zeugen?',
    ],
    ['de', '', 'Was passiert mit der Aussage, wenn die Belehrung vergessen wurde?'],
    ['de', '', 'Gilt eine informatorische Befragung schon als Vernehmung?'],
    ['de', 'typo', 'belehrung zeuge vs beschuldigter wann wechselt das'],
    ['en', 'canonical', 'When do I have to caution someone as a suspect instead of a witness?'],
    [
      'fr',
      'canonical',
      'À quel moment faut-il informer une personne de ses droits en tant que suspect et non plus comme témoin ?',
    ],
    [
      'es',
      'canonical',
      '¿Cuándo tengo que informar a alguien de sus derechos como sospechoso y no como testigo?',
    ],
  ],
  'P-UZWANG': [
    [
      'de',
      'canonical',
      'Welche Voraussetzungen müssen für den Schusswaffengebrauch gegen Personen vorliegen?',
    ],
    ['de', '', 'Muss der Schusswaffengebrauch immer vorher angedroht werden?'],
    ['de', '', 'Zählt der Einsatz von Pfefferspray schon als unmittelbarer Zwang?'],
    ['de', '', 'Ist ein Warnschuss rechtlich ein eigener Schusswaffengebrauch?'],
    [
      'en',
      'canonical',
      'What conditions have to be met before an officer may use a firearm against a person?',
    ],
    [
      'fr',
      'canonical',
      "Quelles conditions faut-il remplir pour faire usage de l'arme contre une personne ?",
    ],
    [
      'es',
      'canonical',
      '¿Qué requisitos deben cumplirse para usar el arma de fuego contra una persona?',
    ],
  ],
  'P-SPUREN': [
    ['de', 'canonical', 'Wie sichere ich Spuren am Tatort, ohne sie zu kontaminieren?'],
    ['de', '', 'In welcher Reihenfolge werden Spuren am Tatort gesichert?'],
    ['de', '', 'Warum dürfen DNA-Spuren nicht in Plastiktüten verpackt werden?'],
    ['de', '', 'Wer darf den Tatort betreten, bevor die Spurensicherung da ist?'],
    ['en', 'canonical', 'How do I secure evidence at a crime scene without contaminating it?'],
    [
      'fr',
      'canonical',
      'Comment préserver les traces sur une scène de crime sans les contaminer ?',
    ],
    ['es', 'canonical', '¿Cómo se aseguran las huellas en la escena del crimen sin contaminarlas?'],
  ],
  'P-DEESK': [
    [
      'de',
      'canonical',
      'Wie spreche ich eine aufgebrachte Person an, damit die Lage nicht eskaliert?',
    ],
    ['de', '', 'Wann ist Duzen in einer Konfliktsituation sinnvoll und wann schadet es?'],
    [
      'de',
      '',
      'Wie viel Abstand sollte ich bei einer aggressiven Person halten, während ich rede?',
    ],
    ['de', 'slang', 'Was macht man, wenn einer total austickt und gar nicht mehr zuhört?'],
    [
      'en',
      'canonical',
      'How should I talk to an agitated person so the situation does not escalate?',
    ],
    [
      'fr',
      'canonical',
      "Comment s'adresser à une personne agitée pour éviter que la situation dégénère ?",
    ],
    ['es', 'canonical', '¿Cómo hablo con una persona alterada para que la situación no se agrave?'],
  ],
  'P-LEGAL': [
    [
      'de',
      'canonical',
      'Wo genau liegt die Grenze zwischen Legalitätsprinzip und Opportunitätsprinzip?',
    ],
    ['de', '', 'Muss ich jede Straftat anzeigen, die ich in der Freizeit mitbekomme?'],
    ['de', '', 'Was hat Vorrang, wenn Gefahrenabwehr und Strafverfolgung gleichzeitig nötig sind?'],
    ['de', '', 'Darf ich bei einer Ordnungswidrigkeit einfach nur verwarnen?'],
    [
      'en',
      'canonical',
      'Where exactly is the line between mandatory prosecution and police discretion?',
    ],
    [
      'fr',
      'canonical',
      "Où se situe la limite entre l'obligation de poursuivre et le pouvoir d'appréciation de la police ?",
    ],
    [
      'es',
      'canonical',
      '¿Dónde está el límite entre la obligación de perseguir y la discrecionalidad policial?',
    ],
  ],
  'P-SCHIESS': [
    ['de', 'canonical', 'Wann ist das nächste Schießtraining und auf welchem Schießstand?'],
    ['de', '', 'Muss ich für den Schießstand meinen eigenen Gehörschutz mitbringen?'],
    ['de', '', 'Fällt das Schießtraining am Freitag wegen der Prüfungswoche aus?'],
    ['de', 'typo', 'schiesstraining morgen wo treffpunkt'],
    ['en', 'canonical', 'When and where is the next shooting practice?'],
    ['fr', 'canonical', 'Quand et où a lieu le prochain entraînement au tir ?'],
    ['es', 'canonical', '¿Cuándo y dónde es el próximo entrenamiento de tiro?'],
  ],
  'P-SPORT': [
    ['de', 'canonical', 'Welche Zeiten muss man beim Sporttest für die Laufstrecke schaffen?'],
    ['de', '', 'Gibt es einen Nachholtermin für den Sporttest, wenn man krank war?'],
    [
      'de',
      '',
      'Zählt der Sporttest in die Abschlussnote oder ist er nur bestanden/nicht bestanden?',
    ],
    ['de', 'slang', 'Wie fit muss man für den Sporttest wirklich sein?'],
    ['en', 'canonical', 'Is there a make-up date for the fitness test if I was ill?'],
    ['fr', 'canonical', 'Y a-t-il une date de rattrapage pour le test sportif en cas de maladie ?'],
    ['es', 'canonical', '¿Hay fecha de recuperación para la prueba física si estuve enfermo?'],
  ],
  'P-PRAKT': [
    ['de', 'canonical', 'Wann erfahren wir, auf welche Dienststelle wir im Praktikum kommen?'],
    ['de', '', 'Kann man sich die Dienststelle für das Praktikum wünschen?'],
    ['de', '', 'Müssen wir im Praktikum auch Nachtdienste mitmachen?'],
    ['de', '', 'Wer ist im Praktikum unser Ansprechpartner auf der Wache?'],
    [
      'en',
      'canonical',
      'When will we find out which station we are assigned to for the internship?',
    ],
    ['fr', 'canonical', 'Quand saurons-nous dans quel commissariat nous ferons notre stage ?'],
    ['es', 'canonical', '¿Cuándo sabremos en qué comisaría haremos las prácticas?'],
  ],
  'P-UNIFORM': [
    ['de', 'canonical', 'Müssen wir im Theorieunterricht Dienstkleidung tragen?'],
    ['de', '', 'Wann ist die nächste Ausgabe der Ausrüstung in der Kleiderkammer?'],
    ['de', '', 'Was mache ich, wenn meine Dienstjacke die falsche Größe hat?'],
    ['en', 'canonical', 'Do we have to wear uniform in the classroom lessons?'],
    ['fr', 'canonical', "Faut-il porter l'uniforme pendant les cours théoriques ?"],
    ['es', 'canonical', '¿Tenemos que llevar uniforme en las clases teóricas?'],
  ],
  'P-GESETZ': [
    ['de', 'canonical', 'Welche Gesetzestexte dürfen wir in die Klausur mitnehmen?'],
    [
      'de',
      'near-miss',
      'Dürfen im Gesetzestext für die Klausur Markierungen und Klebezettel sein?',
    ],
    ['de', '', 'Ist ein Kommentar zum Polizeigesetz in der Klausur erlaubt?'],
    ['en', 'canonical', 'Which statute books are we allowed to bring into the exam?'],
    ['fr', 'canonical', "Quels codes avons-nous le droit d'apporter à l'examen ?"],
    ['es', 'canonical', '¿Qué textos legales podemos llevar al examen?'],
  ],
  'P-HALLE': [
    ['de', 'canonical', 'Wo treffen wir uns für das Einsatztraining in der Trainingshalle?'],
    ['de', '', 'Sollen wir zum Einsatztraining Sportkleidung oder Einsatzanzug anziehen?'],
    ['de', '', 'Fängt das Einsatztraining morgen wirklich schon um sieben an?'],
    ['en', 'canonical', 'Where do we meet for the operational training in the training hall?'],
    ['fr', 'canonical', "Où se retrouve-t-on pour l'entraînement opérationnel dans la salle ?"],
    ['es', 'canonical', '¿Dónde nos reunimos para el entrenamiento operativo en el pabellón?'],
  ],
  'P-SIM': [
    ['de', 'canonical', 'Der Einsatzsimulator startet nicht, die Leinwand bleibt schwarz.'],
    ['de', '', 'Beim Schießsimulator werden die Treffer gerade nicht mehr erkannt.'],
    ['de', '', 'Der Simulator hängt mitten im Szenario fest.'],
    ['en', 'canonical', 'The training simulator will not start, the screen stays black.'],
    ['fr', 'canonical', "Le simulateur d'intervention ne démarre pas, l'écran reste noir."],
    ['es', 'canonical', 'El simulador de intervención no arranca, la pantalla sigue en negro.'],
  ],
  'P-VBS': [
    [
      'de',
      'canonical',
      'Ich komme nicht in die Schulungsumgebung der Vorgangsbearbeitung, das Passwort wird abgelehnt.',
    ],
    ['de', '', 'Die Übungsversion der Vorgangsbearbeitung meldet nur »Sitzung abgelaufen«.'],
    ['de', 'typo', 'vorgangsbearbeitung schulung login geht nicht'],
    [
      'en',
      'canonical',
      "I can't log in to the case-management training system, my password is rejected.",
    ],
    [
      'fr',
      'canonical',
      "Je n'arrive pas à me connecter au logiciel de gestion des procédures en formation.",
    ],
    [
      'es',
      'canonical',
      'No puedo entrar en el sistema de gestión de expedientes de formación, rechaza la contraseña.',
    ],
  ],
  'P-FUNK': [
    ['de', 'canonical', 'Unsere Digitalfunk-Übungsgeräte bekommen keine Verbindung.'],
    ['de', '', 'Das Funkgerät zeigt nur »kein Netz« an, obwohl wir im Übungsgelände sind.'],
    ['de', '', 'Bei Gruppe 3 kommt im Funk nur Rauschen an.'],
    ['en', 'canonical', 'Our training radios are not connecting to the network.'],
    ['fr', 'canonical', "Nos radios d'entraînement n'arrivent pas à se connecter."],
    ['es', 'canonical', 'Nuestras radios de prácticas no consiguen conexión.'],
  ],
  'P-BODYCAM': [
    ['de', 'canonical', 'Die Bodycam-Aufnahme aus dem Rollenspiel lässt sich nicht abspielen.'],
    ['de', '', 'Das Video von der Bodycam bricht nach ein paar Sekunden ab.'],
    ['en', 'canonical', "The bodycam footage from the role play won't play."],
    ['fr', 'canonical', "La vidéo de la caméra-piéton de l'exercice ne se lance pas."],
    ['es', 'canonical', 'El vídeo de la cámara corporal del ejercicio no se reproduce.'],
  ],
};

// ---------- Singletons: Near-Miss, mehrdeutig, Rauschen ----------
// [locale, category, tags, text, extra]
const SINGLETONS = [
  // Near-Miss: Schlüsselwort einer anderen Kategorie, Anliegen eindeutig
  [
    'de',
    'content',
    'near-miss',
    'Kommt die Prüfung der Notwehr in der Klausur dran?',
    { note: 'Klausur + Stoffgebiet → content (tieBreak).' },
  ],
  [
    'de',
    'content',
    'near-miss',
    'Ist die Bodycam rechtlich eine offene oder eine verdeckte Maßnahme?',
    { note: '‚Bodycam‘ wie P-BODYCAM, Anliegen ist Rechtsfrage.' },
  ],
  [
    'de',
    'organization',
    'near-miss',
    'Wird das Einsatztraining auf Video aufgezeichnet?',
    { note: 'Aufzeichnung als Regelung → organization (tieBreak).' },
  ],
  [
    'de',
    'technical',
    'near-miss',
    'Im Simulator ist das Bild so verzerrt, dass man die Waffe des Gegenübers nicht erkennt.',
    { note: '‚Waffe‘ deutet auf P-UZWANG, Anliegen ist Darstellung.' },
  ],
  [
    'de',
    'content',
    'near-miss',
    'Welche Rufnamen-Systematik gilt im Funkverkehr bei größeren Einsatzlagen?',
    { note: '‚Funk‘ wie P-FUNK, Anliegen ist Fachinhalt.' },
  ],
  [
    'de',
    'content',
    'near-miss',
    'Ist der Übungsfall in der Vorgangsbearbeitung ein Hausfriedensbruch oder nicht?',
    { note: '‚Vorgangsbearbeitung‘ wie P-VBS, Anliegen ist rechtliche Einordnung.' },
  ],
  [
    'de',
    'organization',
    'near-miss',
    'Bis wann muss der Praktikumsbericht über Spurensicherung abgegeben werden?',
    { note: '‚Spurensicherung‘ wie P-SPUREN, Anliegen ist Frist.' },
  ],
  [
    'de',
    'content',
    'near-miss',
    'Warum wurde die Festnahme im Rollenspiel als rechtswidrig bewertet?',
    { note: '‚Rollenspiel/Bewertung‘ klingt nach Ablauf, Anliegen ist Rechtsbegründung.' },
  ],
  [
    'de',
    'organization',
    'near-miss',
    'Gibt es für das Schießtraining eine Anwesenheitsliste, die man unterschreiben muss?',
    { note: 'Anwesenheit → organization.' },
  ],
  [
    'de',
    'technical',
    'near-miss',
    'Die Folie mit dem Prüfschema zur Verhältnismäßigkeit ist auf dem Beamer abgeschnitten.',
    { note: '‚Verhältnismäßigkeit‘ wie P-VERHAELT, Anliegen ist Darstellungsfehler.' },
  ],
  [
    'en',
    'content',
    'near-miss',
    'Will the use-of-force rules be on the written exam?',
    { note: 'Klausur + Stoffgebiet → content.' },
  ],
  [
    'de',
    'organization',
    'near-miss code-switch',
    'Ist der Sporttest eigentlich ein must für die Übernahme in den Dienst?',
    { note: 'Rahmenregel, nicht Trainingsinhalt.' },
  ],
  [
    'de',
    'content',
    'near-miss',
    'Darf ich bei der Durchsuchung eines Rucksacks die Dienststelle als Zeugen nehmen?',
    { note: '‚Dienststelle‘ wie P-PRAKT, Anliegen ist Rechtsfrage.' },
  ],
  [
    'de',
    'technical',
    'near-miss',
    'Das Lernvideo zur Eigensicherung bleibt nach zwei Minuten hängen.',
    { note: '‚Eigensicherung‘ deutet auf content, Anliegen ist Abspielfehler.' },
  ],
  [
    'de',
    'organization',
    'near-miss',
    'Kann man die Klausur im Eingriffsrecht nachschreiben, wenn man im Nachtdienst war?',
    { note: 'Klausur + Rahmen → organization.' },
  ],

  // Mehrdeutig: aus dem Text allein nicht entscheidbar
  [
    'de',
    'content',
    'ambiguous',
    'Gilt das auch im Streifendienst?',
    { expectUncertain: true, acceptableCategories: ['content', 'organization'] },
  ],
  [
    'de',
    'content',
    'ambiguous',
    'Wo steht das?',
    { expectUncertain: true, acceptableCategories: ['content', 'organization'] },
  ],
  [
    'de',
    'content',
    'ambiguous',
    'Und wenn er sich wehrt?',
    { expectUncertain: true, acceptableCategories: ['content'] },
  ],
  [
    'de',
    'organization',
    'ambiguous',
    'Ist das Pflicht?',
    { expectUncertain: true, acceptableCategories: ['organization', 'content'] },
  ],
  [
    'de',
    'organization',
    'ambiguous',
    'Und im Praktikum?',
    { expectUncertain: true, acceptableCategories: ['organization', 'content'] },
  ],
  [
    'de',
    'technical',
    'ambiguous',
    'Geht das auch auf dem Dienst-Tablet?',
    { expectUncertain: true, acceptableCategories: ['technical', 'organization'] },
  ],
  [
    'de',
    'organization',
    'ambiguous',
    'Zählt das?',
    { expectUncertain: true, acceptableCategories: ['organization', 'content'] },
  ],
  [
    'en',
    'content',
    'ambiguous',
    'What if they refuse?',
    { expectUncertain: true, acceptableCategories: ['content'] },
  ],
  [
    'fr',
    'content',
    'ambiguous',
    'Et si la personne refuse ?',
    { expectUncertain: true, acceptableCategories: ['content'] },
  ],

  // Rauschen: kein Moderationsanliegen
  ['de', null, 'noise', 'Danke für die Einheit, war richtig gut!', { expectUncertain: true }],
  ['de', null, 'noise', 'Moin zusammen', { expectUncertain: true }],
  ['de', null, 'noise slang', 'Respekt an Gruppe 2, starke Übung', { expectUncertain: true }],
  ['de', null, 'noise', 'Bis morgen in der Halle!', { expectUncertain: true }],
  ['en', null, 'noise', 'Thanks, that was really helpful', { expectUncertain: true }],
  ['es', null, 'noise', '¡Gracias, muy claro!', { expectUncertain: true }],
];

// Gleicher Tokenbegriff wie in der Review-Seite (Entscheidung F5).
const tokenCount = (s) => (s.match(/[\p{L}\p{N}'’-]+/gu) || []).length;
const famById = new Map(FAMILIES.map((f) => [f.id, f]));
const finishTags = (tags, text) => {
  const t = tags.split(' ').filter(Boolean);
  if (tokenCount(text) <= 5 && !t.includes('short')) t.push('short');
  t.push('out-of-domain');
  return t;
};
const items = [];
for (const f of FAMILIES) {
  for (const [locale, tags, text] of ITEMS[f.id]) {
    items.push({
      family: f.id,
      category: f.category,
      domain: 'police',
      locale,
      tags: finishTags(tags, text),
      text,
    });
  }
}
const kindCounter = { 'near-miss': 0, ambiguous: 0, noise: 0 };
for (const [locale, category, tags, text, extra] of SINGLETONS) {
  const kind = tags.includes('noise')
    ? 'noise'
    : tags.includes('ambiguous')
      ? 'ambiguous'
      : 'near-miss';
  kindCounter[kind] += 1;
  const prefix = { 'near-miss': 'S-P-NM', ambiguous: 'S-P-AMB', noise: 'S-P-NOISE' }[kind];
  items.push({
    family: `${prefix}-${String(kindCounter[kind]).padStart(2, '0')}`,
    category,
    domain: 'police',
    locale,
    tags: finishTags(tags, text),
    text,
    ...extra,
  });
}
items.forEach((it, k) => {
  it.id = `Q${String(base.items.length + k + 1).padStart(3, '0')}`;
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
const seen = new Map(base.items.map((i) => [norm(i.text), i.id]));
for (const it of items) {
  const k = norm(it.text);
  if (seen.has(k)) errors.push(`Duplikat: ${seen.get(k)} / ${it.id} »${it.text}«`);
  seen.set(k, it.id);
  const fam = famById.get(it.family);
  if (fam && fam.category !== it.category) errors.push(`${it.id}: Kategorie ≠ Familie`);
  if (it.category === null && !it.tags.includes('noise'))
    errors.push(`${it.id}: null nur für noise`);
}
const baseFams = new Set(base.families.map((f) => f.id));
for (const f of FAMILIES) {
  if (baseFams.has(f.id)) errors.push(`Familien-ID ${f.id} existiert bereits`);
  const own = items.filter((i) => i.family === f.id);
  for (const lang of ['de', 'en', 'fr', 'es'])
    if (!own.some((i) => i.locale === lang)) errors.push(`${f.id}: keine ${lang}-Frage`);
}
if (items.length !== 150) errors.push(`Erwartet 150 neue Items, gebaut ${items.length}`);

const meta = structuredClone(base.meta);
meta.version = '2.2.0';
meta.status =
  'Eingefroren am 2026-11-04. Q001–Q573 seit den Messungen vom 21./23.10.2026 inhaltlich unverändert; Q574–Q723 nach einem Vorlauf ohne Änderung an Fragen oder Kategorien eingefroren. Synthetisch, mit KI-Assistenz entworfen; Zuordnung von einer Person festgelegt, keine Zweitannotation. SHA-256 steht in jedem Messbericht.';
meta.created = '2026-11-04';
meta.composition +=
  ' Ab v2.2 zusätzlich 150 Fragen aus dem Unterricht einer Polizeischule (P-* Familien, S-P-* Singletons, domain = police).';
meta.idNote =
  'Q001–Q500 unverändert aus v2; Q501–Q573 fachfremde Ergänzung (build-dataset-ood.mjs); Q574–Q723 Polizeischule (build-dataset-police.mjs).';
meta.domainRules = {
  ...meta.domainRules,
  police:
    'Polizeiausbildung: Eingriffs- und Strafrecht, Einsatzlehre, Kriminalistik, Kommunikation; Organisation von Schießtraining, Sporttest, Praktikum; Technik von Simulator, Digitalfunk, Vorgangsbearbeitung, Bodycam. Die Kategorieregeln gelten unverändert.',
};
meta.tags = {
  ...meta.tags,
  'out-of-domain':
    'Fachfremde Frage (Botanik, Geschichte oder Polizeischule); Fachvokabular nicht im Seed',
};

const out = {
  ...base,
  meta,
  families: [...base.families, ...FAMILIES],
  items: [...base.items, ...items],
};
const count = (key) =>
  items.reduce((m, i) => {
    m[key(i)] = (m[key(i)] ?? 0) + 1;
    return m;
  }, {});
console.log(`Neu ${items.length} Items (gesamt ${out.items.length}), ${FAMILIES.length} Familien`);
console.log(
  'Kategorie:',
  count((i) => i.category),
);
console.log(
  'Sprache:  ',
  count((i) => i.locale),
);
console.log(
  'Art:      ',
  count((i) => (i.family.startsWith('S-') ? i.family.replace(/-\d+$/, '') : 'Familie')),
);
if (errors.length) {
  console.error(`\n${errors.length} Fehler:`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`geschrieben: ${outPath}`);

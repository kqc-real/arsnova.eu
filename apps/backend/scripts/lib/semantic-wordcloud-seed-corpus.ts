/**
 * Q&A-Paraphrasen für lokale Encoder-/Themen-Tests (1.14c Stufe 1)
 * und für spätere LLM-Kurzlabels (Stufe 2).
 *
 * Cluster mit ≥2 Mitgliedern und langen extraktiven Labels sind bewusst dabei:
 * Stufe 2 verbalisiert nur solche Gruppen, ohne die Mitgliedschaft zu ändern.
 * Folien und Beamer bleiben getrennt. Default füllt bis zum Analyse-Cap.
 */
import { WORD_CLOUD_MAX_ANALYZE_ITEMS } from '@arsnova/shared-types';

export const SEMANTIC_QA_SEED_PARTICIPANT_COUNT = 250;
export const SEMANTIC_QA_SEED_ITEM_COUNT = WORD_CLOUD_MAX_ANALYZE_ITEMS;
export const SEMANTIC_QA_SEED_MAX_CHARS = 500;

type SeedFamily = {
  readonly paraphrases: readonly string[];
};

const SEMANTIC_QA_SEED_FAMILIES = [
  {
    paraphrases: [
      'Kommt Kapitel 4 in die Klausur?',
      'Ist Kapitel 4 klausurrelevant?',
      'Brauchen wir Kapitel 4 für die Prüfung?',
      'Wird der Stoff aus Kapitel 4 dieses Semester geprüft?',
      'Müssen wir Kapitel 4 auswendig können?',
      'Liegt der Klausurschwerpunkt wirklich auf Kapitel 4?',
      'Kann Kapitel 4 in der Klausur weggelassen werden?',
      'Zählt Kapitel 4 zur prüfungsrelevanten Auswahl?',
      'Kommt aus Kapitel 4 eine Rechenaufgabe?',
      'Ist Kapitel 4 nur Verständnis oder auch Auswendiglernen?',
    ],
  },
  {
    paraphrases: [
      'Könnt ihr lineare Regression noch einmal erklären?',
      'Ich verstehe den Zusammenhang bei der geraden Ausgleichslinie nicht.',
      'Wie bestimmt man die beste Gerade durch die Punkte?',
      'Was bedeutet die Steigung bei der linearen Regression praktisch?',
      'Wie hängt Residuum und Ausgleichsgerade zusammen?',
      'Warum minimiert man die Abweichungsquadrate und nicht die Beträge?',
      'Wann ist eine Gerade als Modell ungeeignet?',
      'Was ist der Unterschied zwischen Korrelation und Regression?',
      'Wie interpretiere ich R-Quadrat in der Vorlesung?',
      'Brauchen wir die Formel für die Steigung auswendig?',
    ],
  },
  {
    paraphrases: [
      'Die Folien von letzter Woche fehlen im Moodle.',
      'Im Kursraum liegen die Slides der vergangenen Sitzung nicht.',
      'Kann jemand die Präsentation von Dienstag hochladen?',
      'Wo finde ich die Vortragsfolien der letzten Einheit?',
      'Die PDF zur letzten Sitzung ist im Kursraum leer.',
      'Wurden die Folien von letzter Woche schon freigeschaltet?',
      'Fehlt bei euch auch der Foliensatz nach dem Feiertag?',
      'Könnt ihr den Deckblatt-Foliensatz nachreichen?',
      'Die Slides sind nur als Entwurf markiert, nicht final.',
      'Gibt es die Präsentation auch ohne Animationen als PDF?',
    ],
  },
  {
    paraphrases: [
      'Der Beamer-Hänger in Hörsaal 2 ist wieder defekt.',
      'Die Deckenhalterung des Projektors im zweiten Hörsaal klemmt.',
      'Bildwurf im H2 geht nicht, die Halterung hängt schief.',
      'Der Projektor in Hörsaal 2 wackelt an der Decke.',
      'Könnte Facility den Beamer in H2 vor der Sitzung prüfen?',
      'Das Bild in Hörsaal 2 ist schief, weil die Halterung klemmt.',
      'Ohne funktionierenden Beamer in H2 sehen die hinteren Reihen nichts.',
      'Die Deckenmontage des Projektors quietscht und blockiert.',
      'H2: der Beamer fährt nicht mehr in die Parkposition.',
      'Bitte die Projektorhalterung in Hörsaal 2 instand setzen.',
    ],
  },
  {
    paraphrases: [
      'Bis wann muss die Hausarbeit abgegeben werden?',
      'Gibt es eine Verlängerung für das Essay?',
      'Der Abgabetermin im Moodle ist unklar.',
      'Zählt die Uhrzeit oder nur das Datum bei der Einreichung?',
      'Welche Zeitzone gilt für den Upload der Hausarbeit?',
      'Kann ich die Deadline für die schriftliche Ausarbeitung schieben?',
      'Ist 23:59 hart oder gibt es eine Kulanzminute?',
      'Wohin genau muss die Hausarbeit hochgeladen werden?',
      'Zählt der Eingang im Moodle oder die E-Mail an euch?',
      'Was passiert, wenn der Upload eine Minute zu spät ankommt?',
    ],
  },
  {
    paraphrases: [
      'Kann ich online zugeschaltet werden, wenn ich krank bin?',
      'Gibt es einen Stream, falls ich nicht im Hörsaal bin?',
      'Ist Hybridteilnahme diesmal erlaubt?',
      'Wird die Sitzung für Kranke live übertragen?',
      'Darf ich per Video teilnehmen statt vor Ort?',
      'Gibt es einen Einwahllink bei Erkrankung?',
      'Ist reine Online-Teilnahme ohne Attest möglich?',
      'Kann ich die Hybridoption nur für heute nutzen?',
      'Läuft der Stream nur Ton oder auch Bild vom Board?',
      'Wer schaltet das Meeting frei, wenn ich krankmelde?',
    ],
  },
  {
    paraphrases: [
      'Wann findet das Tutorium statt?',
      'In welche Übungsgruppe muss ich mich eintragen?',
      'Die Übungszeiten kollidieren mit meinem Labor.',
      'Gibt es eine zweite Tutoriums-Schiene am Abend?',
      'Wie wechsle ich die Übungsgruppe ohne Platzverlust?',
      'Ist das Tutorium verpflichtend oder freiwillig?',
      'Wo steht der Raum für die Übungsgruppe B?',
      'Fallen die Tutorien in der Klausurwoche aus?',
      'Kann ich zwei Übungsgruppen probeweise besuchen?',
      'Wer trägt die Anwesenheit im Tutorium ein?',
    ],
  },
  {
    paraphrases: [
      'Welche Texte sind Pflichtlektüre bis nächste Woche?',
      'Müssen wir das Paper vor der Sitzung gelesen haben?',
      'Reicht das Skript oder brauchen wir das Lehrbuch?',
      'Welche Seiten im Buch sind bis Montag dran?',
      'Ist der englische Aufsatz Pflicht oder nur Ergänzung?',
      'Könnt ihr die Kernkapitel der Lektüre markieren?',
      'Reichen Abstracts oder müssen wir den Volltext lesen?',
      'Liegt die Pflichtlektüre legal als PDF im Kursraum?',
      'Wie viel der Literaturliste kommt wirklich in die Diskussion?',
      'Gibt es eine gekürzte Lesefassung für die nächste Einheit?',
    ],
  },
  {
    paraphrases: [
      'Darf ein nicht programmierbarer Taschenrechner mit?',
      'Ist die Formelsammlung aus dem Moodle zugelassen?',
      'Welche Unterlagen dürfen wir auf den Platz legen?',
      'Sind handschriftliche Notizzettel in der Klausur erlaubt?',
      'Darf das eigene Lineal und Geodreieck benutzt werden?',
      'Zählt ein wissenschaftlicher Taschenrechner als Hilfsmittel?',
      'Dürfen wir ein DIN-A4-Blatt beidseitig beschreiben?',
      'Sind Wörterbücher für Nicht-Muttersprachler zugelassen?',
      'Muss die Formelsammlung unbeschriftet bleiben?',
      'Welche Hilfsmittel stehen auf dem Klausurdeckblatt?',
    ],
  },
  {
    paraphrases: [
      'Eduroam im Hörsaal 2 bricht ständig ab.',
      'Das W-LAN reicht für die Abstimmung nicht.',
      'Kann das Netz vor der Live-Abstimmung geprüft werden?',
      'Viele Geräte bekommen in H2 keine IP.',
      'Das Captive Portal hängt und blockiert die Abstimmung.',
      'Ist das Hörsaalnetz überlastet oder nur Eduroam?',
      'Können wir für die Abstimmung ein zweites SSID nutzen?',
      'Mein Laptop verbindet in H2, das Handy nicht.',
      'Die Latenz im WLAN macht die Abstimmung unbenutzbar.',
      'Bitte die Access-Points in Hörsaal 2 prüfen lassen.',
    ],
  },
  {
    paraphrases: [
      'Warum ändert sich meine Antwort in der zweiten Runde, obwohl ich mir in der ersten sicher war?',
      'Wie soll die Diskussion mit der Nachbarbank ablaufen, ohne die Lösung vorzusagen?',
      'Bringt die zweite Abstimmung etwas, wenn fast alle schon in Runde eins richtig lagen?',
      'Soll ich in Runde zwei bei meiner Erstantwort bleiben?',
      'Wie lange ist die Peer-Diskussion vor der zweiten Abstimmung gedacht?',
      'Was tun, wenn die Nachbarbank eine andere Begründung hat?',
      'Zählt für die Statistik nur die zweite Stimme?',
      'Warum sehe ich nach Runde eins nicht sofort die richtige Option?',
      'Wie gehe ich damit um, dass ich in Runde zwei unsicherer bin?',
      'Ist die zweite Runde optional, wenn ich schon abgestimmt habe?',
    ],
  },
  {
    paraphrases: [
      'Gibt es Bonuspunkte nur für Anwesenheit?',
      'Wie werden Bonuspunkte in der Endnote verrechnet?',
      'Kann ich Bonuspunkte nachträglich noch einsammeln?',
      'Zählen Mini-Quizzes in der Vorlesung für den Bonus?',
      'Gibt es einen Deckeln, wie viele Bonuspunkte möglich sind?',
      'Verfallen ungenutzte Bonuspunkte am Semesterende?',
      'Muss ich für Bonuspunkte jede Sitzung unterschreiben?',
      'Zählt Online-Teilnahme ebenfalls für den Anwesenheitsbonus?',
      'Wo sehe ich meinen aktuellen Bonuspunktestand?',
      'Gibt es Bonus nur bei bestandener Klausur oder immer?',
    ],
  },
  {
    paraphrases: [
      'Darf ich die Sitzung für mich mitschneiden?',
      'Wird die Vorlesung offiziell aufgezeichnet?',
      'Kann ich die Aufzeichnung später in Moodle abrufen?',
      'Wie lange bleibt die Session-Aufzeichnung verfügbar?',
      'Darf ich ein Diktiergerät in der ersten Reihe nutzen?',
      'Ist privates Filmen der Tafel erlaubt, wenn ich nichts teile?',
      'Gibt es ein Transkript statt Video?',
      'Wer hat die Rechte an der Vorlesungsaufzeichnung?',
      'Kann die Aufzeichnung barrierefrei mit Untertiteln kommen?',
      'Falls ich fehlen muss: liegt dann ein Mitschnitt bereit?',
    ],
  },
  {
    paraphrases: [
      'Wann ist die nächste Sprechstunde?',
      'Muss ich die Sprechstunde vorher per Mail buchen?',
      'Gibt es Sprechstunden auch per Video?',
      'Wie lange darf ein Sprechstundentermin dauern?',
      'Kann ich Fragen zur Hausarbeit in die Sprechstunde mitbringen?',
      'Findet die Sprechstunde in der vorlesungsfreien Zeit statt?',
      'Ist die Sprechstunde nur für angemeldete Prüfungsfälle?',
      'Wo genau liegt das Büro für die Präsenzsprechstunde?',
      'Kann ich zu zweit in die Sprechstunde kommen?',
      'Welche Unterlagen soll ich zur Sprechstunde mitbringen?',
    ],
  },
  {
    paraphrases: [
      'Ab welcher Punktzahl gilt die Klausur als bestanden?',
      'Wie sieht der Notenschlüssel in diesem Semester aus?',
      'Gibt es eine Bestehensgrenze bei 50 oder 60 Prozent?',
      'Werden die Aufgaben unterschiedlich gewichtet?',
      'Zählt eine mündliche Nachprüfung bei knappem Durchfallen?',
      'Wie werden Teilpunkte bei halb richtigen Antworten vergeben?',
      'Gibt es eine Notenkurve oder absolute Schwellen?',
      'Wann hängen die Klausurergebnisse aus?',
      'Kann ich die Klausureinsicht schon vor der Note beantragen?',
      'Was passiert bei einem Täuschungsversuch punktemäßig?',
    ],
  },
  {
    paraphrases: [
      'Wie werden die Gruppen für die Projektarbeit eingeteilt?',
      'Darf ich die Gruppe selbst wählen oder wird zugelost?',
      'Wie groß sollen die Projektgruppen maximal sein?',
      'Was tun, wenn ein Gruppenmitglied nicht liefert?',
      'Können wir zu dritt statt zu viert abgeben?',
      'Gibt es eine Peer-Bewertung innerhalb der Gruppe?',
      'Muss jedes Mitglied denselben Beitrag dokumentieren?',
      'Können Erasmus-Studierende in bestehende Gruppen?',
      'Bis wann muss die Gruppenliste feststehen?',
      'Gibt es eine Warteliste, falls Gruppen voll sind?',
    ],
  },
  {
    paraphrases: [
      'Dürfen wir ChatGPT für die Hausarbeit nutzen?',
      'Wie müssen KI-Hilfen in der Abgabe gekennzeichnet werden?',
      'Zählt ungekennzeichnete KI-Nutzung als Täuschung?',
      'Gibt es ein erlaubtes Maß an KI-Korrekturlesen?',
      'Soll der Prompt mit abgegeben werden?',
      'Prüft ihr Abgaben mit einem KI-Detektor?',
      'Darf KI nur die Literaturrecherche unterstützen?',
      'Ist DeepL für englische Abstracts in Ordnung?',
      'Welche Erklärung zur Eigenständigkeit gilt mit KI?',
      'Könnt ihr ein Beispiel für erlaubte KI-Nutzung zeigen?',
    ],
  },
  {
    paraphrases: [
      'Wann ist die Nachklausur terminiert?',
      'Muss ich mich getrennt zur Nachklausur anmelden?',
      'Deckt die Nachklausur denselben Stoff ab?',
      'Kann ich Erstversuch und Nachklausur beide mitschreiben?',
      'Gibt es in der Nachklausur denselben Aufgabentyp?',
      'Zählt die bessere der beiden Klausuren?',
      'Wo findet die Nachklausur räumlich statt?',
      'Brauche ich für die Nachklausur ein Attest vom Ersttermin?',
      'Ist die Nachklausur kürzer als die Hauptklausur?',
      'Bis wann kann ich mich von der Nachklausur abmelden?',
    ],
  },
  {
    paraphrases: [
      'Sollen wir Python oder R für die Übungen nutzen?',
      'Ist in der Klausur Python-Syntax gefragt?',
      'Welche Bibliotheken dürfen in den Übungsnotebooks stehen?',
      'Läuft die Demo unter Jupyter oder nur im Terminal?',
      'Gibt es eine vorbereitete Conda-Umgebung?',
      'Reicht Colab oder brauchen wir lokale Installation?',
      'Welches Python-Release ist die Referenz?',
      'Sind Lösungen in Julia auch akzeptiert?',
      'Müssen Plots mit Matplotlib oder Seaborn sein?',
      'Wo liegt das Starter-Notebook für die nächste Übung?',
    ],
  },
  {
    paraphrases: [
      'Wie lang ist die Pause heute geplant?',
      'Können wir die Pause um fünf Minuten strecken?',
      'Fällt die Pause aus, weil wir im Stoff hinterher sind?',
      'Gibt es nach 45 Minuten eine kurze Bewegungspause?',
      'Wann genau treffen wir uns nach der Pause wieder?',
      'Ist die Cafeteria in der Pause noch offen?',
      'Können wir die Pause vorziehen, der Raum wird heiß?',
      'Gibt es eine zweite Pause bei Doppelsitzungen?',
      'Soll die Abstimmung vor oder nach der Pause laufen?',
      'Bitte die Pause nicht in die Peer-Diskussion legen.',
    ],
  },
  {
    paraphrases: [
      'Das Mikrofon kommt hinten kaum an.',
      'Könnt ihr das Headset etwas lauter drehen?',
      'Die Lautsprecher knacken, sobald ihr vom Pult weggeht?',
      'Hörsaal 2: ohne Mikro verstehen die hinteren Reihen nichts.',
      'Gibt es eine Induktionsschleife für Hörgeräte?',
      'Das Ansteckmikro fällt immer wieder aus.',
      'Bitte einmal auf die hintere Reihe sprechen zum Test.',
      'Der Saalhall macht Konsonanten unverständlich.',
      'Kann die Medientechnik das Funkmikro vorab prüfen?',
      'Ohne Verstärkung ist die Frage aus Reihe 12 nicht zu hören.',
    ],
  },
  {
    paraphrases: [
      'Wie zitiere ich Vorlesungsfolien in der Hausarbeit?',
      'Welcher Zitierstil ist verbindlich, APA oder Harvard?',
      'Reicht ein Link oder braucht es DOI bei Webquellen?',
      'Müssen Abbildungen aus den Folien extra belegt werden?',
      'Wie zitiert man eine mündliche Aussage aus der Sitzung?',
      'Ist Wikipedia als Einstieg erlaubt, wenn die Primärquelle folgt?',
      'Sollen wir Zotero oder Citavi verwenden?',
      'Gibt es eine verbindliche BibTeX-Vorlage?',
      'Wie viele Quellen sind für die Hausarbeit erwartet?',
      'Müssen alle Quellen auf Deutsch verfügbar sein?',
    ],
  },
  {
    paraphrases: [
      'Wann ist die Exkursion und ist sie Pflicht?',
      'Fallen Fahrtkosten für die Exkursion selbst an?',
      'Brauche ich festes Schuhwerk bei der Exkursion?',
      'Gibt es eine Alternative, falls ich nicht mitfahren kann?',
      'Wie lange dauert die Exkursion inklusive Anfahrt?',
      'Muss ich mich für die Exkursion extra anmelden?',
      'Gibt es ein Arbeitsblatt während der Exkursion?',
      'Treffpunkt für die Exkursion ist der Hörsaal oder der Bahnhof?',
      'Ist essen unterwegs selbst organisiert?',
      'Zählt die Exkursion für die Anwesenheit?',
    ],
  },
  {
    paraphrases: [
      'Können wir ein Fenster kippen, es ist sehr stickig?',
      'Die Lüftung in H2 bläst kalt auf die erste Reihe.',
      'Darf die Tür während der Abstimmung offen bleiben?',
      'Es zieht stark, sobald beide Flügel offen sind.',
      'Könnte die Klimaanlage eine Stufe runter?',
      'Hintere Reihen haben keine frische Luft.',
      'Bitte kurz stoßlüften vor der Peer-Diskussion.',
      'Die CO2-Ampel ist rot, können wir fünf Minuten lüften?',
      'Ist der Sonnenschutz unten, weil der Beamer sonst unsichtbar ist?',
      'Im Sommer: können wir früher anfangen, solange es kühler ist?',
    ],
  },
  {
    paraphrases: [
      'Gibt es einen Probeklausurtermin ohne Note?',
      'Wo liegt die alte Klausur zum Üben?',
      'Könnt ihr drei Beispielaufgaben mit Lösungsweg zeigen?',
      'Reicht das Übungsblatt als Klausurvorbereitung?',
      'Gibt es ein Moodle-Quiz als Testlauf vor der Prüfung?',
      'Wie ähnlich sind Übungsaufgaben zur Klausur?',
      'Wird eine Musterklausur in der letzten Sitzung gerechnet?',
      'Kann ich Altklausuren in der Bibliothek einsehen?',
      'Gibt es eine Fragerunde nur zur Klausurlogistik?',
      'Welche Aufgabentypen sollen wir priorisieren beim Lernen?',
    ],
  },
] as const satisfies readonly SeedFamily[];

const QUESTION_WRAPPERS: ReadonlyArray<(text: string) => string> = [
  (text) => text,
  (text) => `Kurze Nachfrage: ${lowerFirst(text)}`,
  (text) => `${stripTerminalPunctuation(text)} — oder sehe ich das falsch?`,
  (text) => `Kann das jemand einordnen: ${lowerFirst(text)}`,
  (text) => `${text} Danke schon mal.`,
];

/** Kanonische Fixture-Paraphrasen, die im generierten Korpus vorn stehen. */
export const SEMANTIC_QA_SEED_TEXTS = SEMANTIC_QA_SEED_FAMILIES.flatMap(
  (family) => family.paraphrases,
);

function lowerFirst(text: string): string {
  const [first = ''] = text;
  return `${first.toLowerCase()}${text.slice(1)}`;
}

function stripTerminalPunctuation(text: string): string {
  return text.replace(/[.?]\s*$/u, '');
}

function uniqueTexts(texts: readonly string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const text of texts) {
    const trimmed = text.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    if (trimmed.length > SEMANTIC_QA_SEED_MAX_CHARS) {
      throw new Error(`Semantisches Q&A-Seed überschreitet ${SEMANTIC_QA_SEED_MAX_CHARS} Zeichen.`);
    }
    seen.add(trimmed);
    unique.push(trimmed);
  }
  return unique;
}

export function buildSemanticQaQuestionPool(): string[] {
  const originals = SEMANTIC_QA_SEED_FAMILIES.flatMap((family) => family.paraphrases);
  const wrapped = SEMANTIC_QA_SEED_FAMILIES.flatMap((family) =>
    family.paraphrases.flatMap((paraphrase) =>
      QUESTION_WRAPPERS.slice(1).map((wrap) => wrap(paraphrase)),
    ),
  );
  return uniqueTexts([...originals, ...wrapped]);
}

export function buildSemanticQaQuestionTexts(count = SEMANTIC_QA_SEED_ITEM_COUNT): string[] {
  if (count < 1) {
    throw new Error('Semantisches Q&A-Seed braucht mindestens eine Frage.');
  }

  const pool = buildSemanticQaQuestionPool();
  if (pool.length < count) {
    throw new Error(
      `Semantisches Q&A-Seed hat nur ${pool.length} eindeutige Texte, angefragt wurden ${count}.`,
    );
  }
  return pool.slice(0, count);
}

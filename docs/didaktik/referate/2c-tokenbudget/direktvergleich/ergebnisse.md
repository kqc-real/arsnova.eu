# Ergebnisse · Backend-Auswahl gegen alle zwölf Fragen

## November-Baseline · 8. November 2026

Mit allen zwölf Texten erreichte die Untertitelfrage das Modell. Die Modellanfrage dauerte im Median 2,47 Sekunden länger. Beide Kurzfassungen deuteten eine Bitte um ein Rechenbeispiel als tatsächliche Durchführung. [Anleitung](README.md)

## Messwerte

Vier gewertete Läufe je Spalte. Zeiten sind Mediane. Die Spanne umfasst den schnellsten und langsamsten Lauf. Eingabetoken umfassen den vollständig formatierten Prompt. Ausgabetoken umfassen die gesamte JSON-Antwort samt Quellen-IDs. [Einzelwerte mit Warm-ups](tabellen/einzelwerte.csv) · [Mediane und Spannweiten für jede Messgröße](tabellen/uebersicht.csv)

| Messgröße                                  |     Auswahl |        Alle |
| ------------------------------------------ | ----------: | ----------: |
| Übergebene Fragetexte                      |           3 |          12 |
| Eingabe / Ausgabe in Token je Lauf         |   355 / 268 |   901 / 500 |
| Zeit bis zum ersten Textfragment           |      108 ms |      258 ms |
| Verarbeitung der Eingabe (Prefill)         |       97 ms |      249 ms |
| Erzeugen der Ausgabe (Decodierung)         |      3,19 s |      5,52 s |
| Gesamtdauer der Modellanfrage              |      3,30 s |      5,77 s |
| Spanne der Gesamtdauer                     | 3,10–3,77 s | 5,64–6,24 s |
| JSON, Schema, IDs und Formfilter bestanden |         4/4 |         4/4 |

Die Differenz der beiden Mediane beträgt 2,47 s (rund 75 %). Qwen las im Volltextarm 546 zusätzliche Token und schrieb 232 zusätzliche Token. Der größte gemessene Zeitunterschied entfiel auf die Decodierung. [Zeit- und Tokenmessungen](tabellen/uebersicht.csv)

## Was Qwen aus den Fragen gemacht hat

| Referenzanliegen                                                                                                                                 | Auswahl                                                                                           | Alle                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Untertitel.** Quelle 12 fragt: »Wird es für die Vorlesungsaufzeichnungen Untertitel geben? Ohne sie kann ich den Aufzeichnungen nicht folgen.« | Die Frage erreicht das Modell nicht und erscheint auch nicht in seiner Ausgabe.                   | »Es wird keine Bestätigung gegeben, ob Untertitel bereitgestellt werden.« Das trifft den offenen Stand. Der Grund für die Nachfrage fehlt.                                                                                               |
| **Gemeinsame Rechnung.** Quelle 01 fragt: »Könnten wir im Tutorium ein Konfidenzintervall einmal gemeinsam von Anfang bis Ende berechnen?«       | »Gemeinsam Schritt für Schritt durchgeführt.« Für eine bereits gehaltene Übung fehlt jeder Beleg. | Zwei Aussagen greifen dieselbe Bitte auf. Unter anderem heißt es: »Ein vollständiges Zahlenbeispiel wird im Tutorium gemeinsam durchgerechnet, um den Prozess des Konfidenzintervalls zu verdeutlichen.« Auch hier gibt es keine Zusage. |
| **Abgabefrist.** Quelle 03 enthält den Nachtrag: »Die Frist ist verbindlich Freitag um 18 Uhr.«                                                  | Freitag um 18 Uhr korrekt wiedergegeben, mit Quellen 02 und 03.                                   | Ebenfalls korrekt, mit denselben Quellen. Die Antwort steht nur in 03.                                                                                                                                                                   |

Bezogen auf die **zwei offenen Anliegen des gesamten Snapshots** erwähnt die Auswahl eines und wahrt bei keinem den offenen Stand. Der Volltextarm erwähnt beide und wahrt bei einem den offenen Stand. Von den eigentlichen Aussagen ist in der Auswahl **1/2** und im Volltextarm **2/4** vollständig belegt. Alle zitierten IDs passen thematisch. Beide Handlungsvorschläge zur Beispielrechnung sind als Vorschläge vertretbar und wurden gesondert bewertet. [Originalfragen](fragen.json) · [Ungekürzte Modellantworten](rohdaten/messungen.jsonl) · [Begründung je Aussage und Quelle](inhaltsbewertung.json)

## Aussagekraft für 2C

**Im Projekt implementiert** sind die verwendete Backend-Auswahl und die Formatprüfung. Der direkte Weg mit allen Texten ist ein Forschungstest. **Lokal getestet** ist die Wirkung auf diesen fest angeordneten Datensatz. Das seltene Anliegen erreicht Qwen nur im Volltextarm. Die unzutreffende Darstellung des Rechenwunschs entsteht in beiden Armen bei der Formulierung. **Produktiv beobachtet** wurde für diesen Vergleich keine Hostausgabe. Gemessen wurde jeweils die rohe Modellantwort, ohne Warteschlange, Fallback oder Browser. **Hypothetisch** bleibt, ob eine andere Auswahl seltene Anliegen über viele Sitzungen hinweg zuverlässiger erhält. Die mögliche Relevanz einer seltenen Frage für den Host war hier ein eigenes Prüfkriterium; der Produktprompt betont gerade wiederkehrende Themen. Vier technische Wiederholungen auf einem synthetischen Datensatz erlauben keine allgemeine Trefferquote. [Versuchsplan](versuchsplan.md) · [Wortlaut des Prompts](rohdaten/request-alle.json) · [Bewertete Rohantworten](inhaltsbewertung.json)

## Alle Modellanfragen

Die IDs mit Wiederholung 0 bezeichnen die beiden Warm-ups. Sie zählen nicht zu den Medianen. Hier wurde die Zeit der Modellanfrage gemessen. Eine Auslieferung durch die Anwendung wurde nicht geprüft. [Rohe Antworten](rohdaten/messungen.jsonl)

| Lauf-ID              | Eingabetoken | Ausgabetoken | Erstes Textfragment (ms) | Modellanfrage (s) | JSON, IDs, Schema und Form |
| -------------------- | -----------: | -----------: | -----------------------: | ----------------: | -------------------------- |
| E-DIREKT12-0-auswahl |          355 |          268 |                    185,8 |             3,336 | bestanden                  |
| E-DIREKT12-0-alle    |          901 |          500 |                    270,0 |             5,821 | bestanden                  |
| E-DIREKT12-1-auswahl |          355 |          268 |                    100,9 |             3,104 | bestanden                  |
| E-DIREKT12-1-alle    |          901 |          500 |                    253,4 |             5,735 | bestanden                  |
| E-DIREKT12-2-alle    |          901 |          500 |                    256,8 |             5,640 | bestanden                  |
| E-DIREKT12-2-auswahl |          355 |          268 |                    111,1 |             3,180 | bestanden                  |
| E-DIREKT12-3-alle    |          901 |          500 |                    258,5 |             5,812 | bestanden                  |
| E-DIREKT12-3-auswahl |          355 |          268 |                    105,4 |             3,419 | bestanden                  |
| E-DIREKT12-4-auswahl |          355 |          268 |                    118,6 |             3,769 | bestanden                  |
| E-DIREKT12-4-alle    |          901 |          500 |                    367,1 |             6,239 | bestanden                  |

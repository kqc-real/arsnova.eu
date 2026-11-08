# Thema 2C · Q&A-Kurzfassungen mit lokalem Qwen

Kann eine Lehrperson aus der Kurzfassung erkennen, was Studierende fragen und was noch offen ist? Die Tests verändern die verfügbaren Quellen, Zusatzfelder oder das Ausgabelimit. Gemessen wurde am **8. November 2026** mit dem vereinbarten [Anwendungsstand von Release 1.3](https://github.com/kqc-real/arsnova.eu/commit/1d71bd9583954d5304e3d56ee2cc716196190a65).

| Testfall               | Zweck                                                                            | Anleitung                                          | Ergebnisse                                                                 |
| ---------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------- |
| Kontext bei 640 Token  | Gleiche Fragen mit und ohne Registerdaten zusammenfassen.                        | [Test](testfaelle/kontext-640/anleitung.md)        | [20 Läufe](testfaelle/kontext-640/ergebnisse.md)                           |
| Ausgabelimit 1.024     | Prüfen, ob eine größere Antwortreserve Inhalt, Annahme oder Zeit verändert.      | [Test](testfaelle/ausgabelimit-1024/anleitung.md)  | [20 Läufe und Budgetvergleich](testfaelle/ausgabelimit-1024/ergebnisse.md) |
| Fragen im Kontext      | Verfügbare und tatsächlich übergebene Quellen zählen.                            | [Auswertung](testfaelle/kapazitaet/anleitung.md)   | [Auswahl aus den Hauptläufen](testfaelle/kapazitaet/ergebnisse.md)         |
| Lange Fragen           | Prüfen, welche Texte durch Verlängerung wegfallen oder gekürzt werden.           | [Test](testfaelle/lange-fragetexte/anleitung.md)   | [6 Läufe](testfaelle/lange-fragetexte/ergebnisse.md)                       |
| Stimmen und Status     | Prüfen, ob zwei Zusatzfelder die Deutung einer Kontroverse verändern.            | [Test](testfaelle/stimmen-und-status/anleitung.md) | [6 Läufe](testfaelle/stimmen-und-status/ergebnisse.md)                     |
| Quellenprüfung         | Zehn Antworten mit bekanntem Inhalt in den Validierungspfad einspeisen.          | [Test](testfaelle/quellenpruefung/anleitung.md)    | [10 Kontrollen ohne Inferenz](testfaelle/quellenpruefung/ergebnisse.md)    |
| Drei oder zwölf Fragen | Prüfen, ob ein Anliegen bei der Auswahl oder bei der Formulierung verloren geht. | [Test](direktvergleich/README.md)                  | [8 Läufe](direktvergleich/ergebnisse.md)                                   |

Insgesamt liegen **60 gewertete Modellaufrufe** und **sechs separat archivierte Warm-ups** vor. Die Prüfung der Quellen und die Auswertung der Fragenauswahl erzeugen keine weiteren Modellantworten. Die Hauptversuche messen von der Kontextaufbereitung bis zur geprüften Ausgabe für den Host. Der Direktvergleich misst nur die Modellanfrage und bewertet ihren Rohtext. [Messplan](messreihe/methodik.md) · [Direktvergleich](direktvergleich/versuchsplan.md)

### Inhaltliche Bewertung der Modellantworten

Die nachträgliche, KI-gestützte Auswertung vergleicht Qwens Aussagen und Vorschläge mit der jeweils gesendeten Anfrage. Sie prüft, welche Anliegen Qwen aufgreift, ob es offene Fragen als offen wiedergibt und ob die angeführten Quellen seine Behauptungen stützen. Wiederholungen mit gleichem Wortlaut zählen einmal pro Eingabevariante. Eine unabhängige menschliche Zweitbewertung steht aus. Die [vier Kurzfassungen des Budgetversuchs](testfaelle/kontext-640/ergebnisse.md#inhalt-von-qwens-kurzfassungen) gelten für beide Ausgabelimits. Die ergänzenden Ergebnisse stehen bei [langen Fragen](testfaelle/lange-fragetexte/ergebnisse.md#inhalt-von-qwens-kurzfassungen), [Stimmen und Status](testfaelle/stimmen-und-status/ergebnisse.md#inhalt-von-qwens-kurzfassungen) und im [Direktvergleich](direktvergleich/ergebnisse.md).

Die ursprünglichen Rubrikpunkte in den archivierten CSV-Spalten `D1` bis `D5`, `score`, `score_min` und `score_max` beziehen sich auf die vom Backend bereitgestellte Hostausgabe. Die Inhaltsbewertung der Modellantworten verwendet diese Punkte nicht. [Ursprüngliche Einzelbewertung](extended_experiments/inhaltsbewertung.json) · [Archivierter Messplan, Abschnitt 5](messreihe/methodik.md#5-auswertung)

## Messungen wiederholen

Die archivierten Daten lassen sich ohne GPU auswerten. Für neue Messungen werden die [lokale GPU-Umgebung](gpu-einrichten.md), Docker und der vorbereitete Modellserver benötigt. Das Setup lädt einmalig die Abhängigkeiten des angegebenen Anwendungsexports. Die Inferenz läuft anschließend im Container ohne externes Netz. Im Stamm des Forschungsworktrees beginnen:

```bash
repo=$(git rev-parse --show-toplevel)
cd "$repo/docs/didaktik/referate/2c-tokenbudget"
mkdir -p "$repo/tmp"
export STUDY_WORK=$(mktemp -d "$repo/tmp/studie-2c.XXXXXX")
export GPU_DIR="$repo/tmp/wsl-gpu-validation"
bash messreihe/versuch.sh setup
```

Falls die GPU-Umgebung im Hauptworktree eingerichtet wurde, für `GPU_DIR` dessen absoluten Pfad einsetzen. Die einzelnen Befehle stehen in den Testanleitungen. Jedes Messverzeichnis wird nur einmal angelegt.

## Messwerte ohne Inferenz reproduzieren

Aus diesem Studienverzeichnis ausführen. Die Befehle prüfen die Dateien, berechnen alle Ergebnistabellen aus den Rohdaten und vergleichen sie mit der Abgabe.

```bash
sha256sum --quiet -c messreihe/SHA256SUMS
(cd direktvergleich && sha256sum --quiet -c SHA256SUMS)
ziel=$(mktemp -d)
python3 messreihe/auswerten.py --ausgabe "$ziel/messreihe"
diff -ru messreihe/tabellen "$ziel/messreihe"
python3 direktvergleich/auswerten.py direktvergleich/rohdaten "$ziel/direkt" \
  --bewertung direktvergleich/inhaltsbewertung.json
diff -ru direktvergleich/tabellen "$ziel/direkt"
```

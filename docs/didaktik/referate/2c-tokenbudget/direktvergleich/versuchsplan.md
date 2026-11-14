# E-DIREKT-12 · Studienplan vor der ersten Inferenz

## 1 · Fragestellung und Prüfkriterien

Welchen Unterschied macht die Quellenauswahl, wenn Qwen unter identischen Generierungsbedingungen entweder die vom Moderationskompass ausgewählten Fragen oder alle freigegebenen Fragen erhält? Erwartung: Die Vollmenge kann ein seltenes Anliegen sichtbar machen; ob Qwen es dann aufgreift und als offene Frage wiedergibt, wird getrennt geprüft.

Ein neuer deutscher [Datensatz](fragen.json) enthält zwölf synthetische Beiträge in fester Reihenfolge. Die Endziffern der IDs kennzeichnen drei Referenzanliegen:

| Anliegen         | Quellen und fachlich richtige Deutung                                                                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rechenbeispiel   | 01, 04–11: Neunmal wird eine gemeinsame Beispielrechnung zu Konfidenzintervallen gewünscht. Ein Termin oder eine Zusage ist nicht belegt.                                                                   |
| Abgabefrist      | 02 fragt nach dem Termin. Nur der ausdrückliche Nachtrag der Lehrperson in 03 belegt Freitag um 18 Uhr. Eine als weiterhin offen dargestellte Frist widerspricht diesem Nachtrag, sofern er im Input steht. |
| Barrierefreiheit | 12 fragt nach Untertiteln und erklärt, weshalb sie für den Zugang nötig sind. Bereitstellung und Ablehnung sind beide unbestätigt.                                                                          |

Vorab definierte Bewertung je unterschiedlicher Rohantwort: (a) Anzahl der zwei offenen Anliegen in den Aussagen (0–2), (b) Zugangshürde bei Untertiteln erläutert (ja/nein), (c) Frist bestätigt und korrekt / teilweise / fälschlich offen oder falsch / ausgelassen. Der Produktprompt verlangt offene Themen; das Weglassen einer geklärten Frist zählt separat und gilt allein nicht als Fehler. (d) Aussagen und Handlungsvorschläge einzeln gegen ihre zitierten Texte lesen. Eine Aussage ist vollständig belegt, wenn die genannten Quellen zusammen den Inhalt tragen. Eine neue Entscheidung, Zahl, Zusage oder eine unzutreffende Deutung gilt als unbelegt. Ein erkennbarer Vorschlag darf zur Klärung anregen. Prüfen, ob jede einzelne ID thematisch passt. Sichtbarkeit im Input, Erwähnung und fachliche Treue getrennt erfassen. Eine fehlende Quelle begrenzt die Auswahl; daraus folgt kein Modellfehler. Keine ungeprüften Behauptungen dürfen als beantwortete Fragen durchgehen.

## 2 · Umgebung und Vergleich

Anwendungsexport vom 6. November 2026, Commit `1d71bd9583954d5304e3d56ee2cc716196190a65`. Lokales Qwen3-4B-Instruct-2507 Q4_K_M auf der RX 9070 XT im geprüften WSL-Container. Der vorhandene [Startprozess](../messreihe/server.py) kontrolliert den Modelldigest und 37/37 GPU-Schichten. Ein Slot, 8.192 Kontexttoken, Temperatur 0, Seed 456, höchstens 1.024 Ausgabetoken. Die Laufzeit wendet für beide Arme dieselbe JSON-Grammatik an; nur die erlaubten Quellen-IDs folgen den tatsächlich gezeigten Texten.

- **Auswahl**: Alle zwölf Einträge werden als aktiver, stimmloser Q&A-Snapshot validiert. Der unveränderte November-Packer wählt daraus wie in der bisherigen B-Bedingung. Qwen erhält nur die ausgewählten Texte mit ihren IDs.
- **Alle**: Qwen erhält direkt alle zwölf Texte und IDs aus derselben Datei in Dateireihenfolge. Es erfolgt keine Priorisierung, Klassifizierung oder Kürzung. Im Auswahlarm bleibt die vom Packer gelieferte Reihenfolge erhalten. Geprüft wird, dass die gemeinsamen Texte und ihre relative Reihenfolge übereinstimmen.

Die Antworten werden vor dem extraktiven Fallback ausgewertet. Der Versuch prüft die aktuelle Modellaufgabe offline; er misst keine Hostansicht. Quellenstatus, Häufigkeitslabels und die Bewertungsregeln werden dem Modell in keinem Arm zusätzlich verraten.

## 3 · Messplan und Abbruch

Ein Warm-up je Arm, danach vier gepaarte Wiederholungen in der Reihenfolge Auswahl/Alle, Alle/Auswahl, Alle/Auswahl, Auswahl/Alle. Der KV-Slot wird vor jeder Anfrage geleert. Der Server zählt vorab die Token beider vollständig formatierten Prompts. Prompt plus Ausgabegrenze plus Sicherheitsmarge von 128 Token müssen in 8.192 Token passen. Für jede Antwort werden rohe Zeichenfolge, Abbruchgrund, Token, Zeit bis zum ersten Text, Prefill, Decodierung und Dauer der lokalen Modellanfrage gespeichert. Die Zeitmessung beginnt mit dem POST und schließt mit dem Ende des Streams; Datenaufbau, Tokenvorprüfung und Slotlöschung liegen außerhalb. Technisches Versuchsziel: vollständiges JSON, erlaubte Belege und Antwort innerhalb von 90 Sekunden pro Auftrag. Bei Transportfehlern bleibt der begonnene Lauf als Fehler erhalten. Keine fehlgeschlagenen Antworten ersetzen, keine Wiederholung als neue inhaltliche Stichprobe werten.

## 4–6 · Durchführung, Auswertung und Entscheidung

Einzelmessungen getrennt von Warm-ups ausweisen. Je Arm Median und Spannweite berichten. Jede verschiedene Rohantwort einzeln kodieren, formale Gültigkeit getrennt aufzeichnen. Fehlende Anliegen zuerst auf Verfügbarkeit im Input und dann auf Auslassung oder Umdeutung durch das Modell prüfen. Die Schlussfolgerung gilt für diesen konstruierten Fall und diese Promptfassung.

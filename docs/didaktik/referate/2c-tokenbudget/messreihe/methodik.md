# Messplan · Q&A-Kurzfassungen unter Quellen- und Tokenbudget

## 1. Fragestellung und Kriterien

Erkennt die Lehrperson die Anliegen, ihren offenen oder geklärten Stand und ihre Quellen? Für einen technisch erfolgreichen Hauptlauf muss die generierte Kurzfassung die Format- und Quellenprüfung bestehen und beim Host ankommen. Das Backend kann auch einen extraktiven Ersatz mit Status `ready` liefern. Deshalb speichern wir Modelltext und Hostausgabe getrennt. Zusätzlich erfassen wir tatsächlich übergebene Fragen, Input- und Output-Token, Zeit bis zum ersten Textfragment und Komponentenzeit. Die [Informationsrubrik](https://github.com/XarotDev/arsnova.eu/blob/3fc9f5ceffc769804e2a085d95f4608d3f1cd788/docs/didaktik/referate/2a-regelbasierte-extraktive-referenz/evidence/E4/rubrik.md) bewertet Quellenbezug, Stimmen, Trennung der Anliegen, Unsicherheit und Themenabdeckung mit je 0 bis 2 Punkten.

## 2. Umgebung und Eingaben

Anwendungsstand `1d71bd9583954d5304e3d56ee2cc716196190a65`. Qwen3-4B-Instruct-2507 Q4_K_M lief mit llama.cpp auf einer Radeon RX 9070 XT unter WSL. Containerlimits: vier CPU-Kerne und 8 GiB RAM. Kontextfenster: 8.192 Token. Temperatur 0, Seed 456, ein Slot, geleerter KV-Cache vor jeder Anfrage. Die Inferenz lief über Loopback ohne externes Netz, Browser, Datenbank oder Warteschlange. Das [Laufprotokoll](pruefprotokoll.txt) dokumentiert die GPU-Ausführung. Die [sechs](eingaben/S6.json) bzw. [100](eingaben/S100.json) synthetischen Ausgangsfragen sind die unveränderten Eingaben aus dem Messarchiv. Die Reproduktion lädt sie jetzt direkt aus diesen beiden Dateien. Dadurch unterscheidet sich der Hash des aktuellen Testskripts vom Hash im ursprünglichen Laufmanifest.

## 3. Versuchsplan

Der Haupttest nutzt den Prompt des Anwendungsexports. A enthält die vom Backend ausgewählten Registerdaten, B dieselben Fragetexte und IDs. Die Ausgabegrammatik und die abschließende Quellenbindung von B sind auf die dort zulässigen IDs begrenzt. Bei 1.024 wird nur das Ausgabelimit erhöht. Die Kontextaufbereitung behält ihre Reserve von 640. Je Budget gibt es zwei Warm-ups und fünf gewertete Läufe pro Kombination. Das Ziel für jeden gewerteten Lauf war eine nutzbare, korrekt belegte Antwort. Die im Versuchsplan übernommene Qualitätsschwelle lag bei mindestens 8/10 Punkten in neun von zehn Ausgaben.

Die Zusatzfälle variieren entweder die Länge aller 100 Fragen oder ergänzen bei sechs Fragen Status und Stimmen. Pro Fall und Eingabe gibt es drei gewertete Läufe. Sie stammen aus einer aufgewärmten Serie. Deren gemeinsame Warm-ups liegen im Teilarchiv nicht vor. Bei einer Wiederholung wärmt der Runner mit zwei Anfragen auf. Zehn vorab konstruierte Antworten prüfen die Validierung separat. Für den [Direktvergleich](../direktvergleich/versuchsplan.md) gelten ein eigener Datensatz, vier gewertete Wiederholungen je Eingabe und eine eigene Messgrenze.

## 4. Durchführung

Gemessen wurde am 8. November 2026. Für jede Serie wurden Snapshot, Prompt, Rohantwort, Entscheidung des Adapters und Hostausgabe gespeichert. Ein erster Packversuch mit acht Textzusätzen scheiterte an der Grenze von 500 Zeichen pro Frage. Mit fünf Zusätzen gelang die Messung. Ein äußerer Shell-Aufruf meldete nach den beiden Budgetserien einen Lesefehler. Die inneren Vitest-Protokolle belegen den Abschluss beider Serien. Alle 44 Einzelaufträge einschließlich Warm-ups und ihre Request-Paare wurden geprüft. [Protokoll](pruefprotokoll.txt) · [Testcode](qa-kurzfassung.test.ts)

## 5. Auswertung

Warm-ups bleiben aus den Medianen ausgeschlossen. Die Komponentenzeit umfasst Auswahl, Modellanfrage und Prüfung. Die Rubrik bewertet jeden unterschiedlichen sichtbaren Wortlaut einmal. Die [Einzelbegründungen](../extended_experiments/inhaltsbewertung.json) sind KI-gestützt. Eine unabhängige menschliche Zweitbewertung fehlt. Für den [Direktvergleich](../direktvergleich/inhaltsbewertung.json) wurde zusätzlich jede Aussage mit ihren zitierten Fragen abgeglichen. Die Wiederholungen desselben Snapshots sind keine unabhängigen Qualitätsstichproben.

## 6. Entscheidung und Evidenz

- **Implementiert:** Die Tests verwenden die vorhandene Quellenauswahl, den Anwendungsprompt, den Formfilter und den extraktiven Ersatz.
- **Lokal getestet:** Die [Ergebnistabellen](tabellen/uebersicht.csv) belegen die technische Ausgabe und die Laufzeit dieser Eingaben. [Direktvergleich](../direktvergleich/ergebnisse.md) und [Quellenkontrollen](../testfaelle/quellenpruefung/ergebnisse.md) zeigen, wo offene Anliegen oder die inhaltliche Begründung verloren gehen können.
- **Produktiv beobachtet:** Für diese Kurzfassungen liegen keine produktiven Qualitäts- oder Latenzmessungen vor. Die lokale Inferenz mit synthetischen Fragen dokumentiert den Datenweg. Eine vollständige Datenschutzprüfung für den späteren Betrieb war kein Teil des Versuchs.
- **Hypothetisches Zielbild:** Eine Lehrperson könnte einen KI-Entwurf zusammen mit seinen Originalquellen prüfen. Vor einem Einsatz wären unabhängig bewertete Sitzungen mit weiteren Themen sowie Messungen mit parallelen Anfragen sinnvoll.

Die Befehle zur [Einrichtung und Auswertung](../README.md#messungen-wiederholen) und je Testfall stehen im Studienverzeichnis.

# Hörsaalprojektion (#473)

## Verhalten und Verträge

Die bestehende Host-Aktion öffnet weiterhin den geschützten Presenter. Der
Startdialog erklärt den Projektionsbildschirm und die getrennte Host-Steuerung;
Smartphone-Kopplung bleibt optional. Das Vollbild-Overlay lässt den aktuellen
Inhalt als Kontext erkennen.

`app-projection-pages` misst gerenderten Inhalt auf der tatsächlichen Fläche.
Absätze und Codezeilen bilden bevorzugte Seitengrenzen; Formeln, Bilder und
vollständige Antwortoptionen bleiben zusammen. Das gilt auch für jedes
Zuordnungspaar, jede Reihenfolgeoption sowie jedes Kategorisierungselement und
jede Kategorie.
Für Single Choice, Multiple Choice und Umfragen versucht der Presenter zuerst,
Frage und alle Antwortoptionen gemeinsam darzustellen. Bei Platzmangel misst
er kompaktere Karten einspaltig und bei ausreichender Breite zweispaltig.
Passt nur der vollständige Antwortblock auf eine Seite, erhält er eine eigene
Seite. Das gilt auch für Ergebnisbalken und den Vergleich zweier Abstimmungsrunden.
Passt der Block auch dort nicht, blättert der Presenter zwischen vollständigen
Antwortkarten. Fortsetzungen behalten Antwortkennzeichen und Listennummern.
Später geladene Bilder und Schriften lösen eine Neumessung aus,
auch wenn ihre Seite gerade nicht sichtbar ist. Während sie nach einem Reload
noch laden, begrenzt eine vorläufige Messung den gespeicherten Index nicht.
Verteilungsmatrizen werden für die Projektion in vollständig
beschriftete Einträge umgebrochen. Quell-Markdown bleibt unverändert; als
optional markierte Unterrichtsimpulse bleiben wie bisher ausgeblendet.
Auch Antwortkarten mit Ergebnisbalken und Korrektheitsmarkierung bilden eine
bevorzugte Seitengrenze; eine Karte wird in der Ergebnisansicht niemals zwischen
zwei Projektionsseiten geteilt.
In der Ergebnisphase folgt das persönliche und gegebenenfalls das Team-Leaderboard
als eigene letzte Projektionsseite auf sämtliche Inhaltsseiten. Beim Sessionende
verdrängt das Abschluss-Leaderboard weiterhin alle vorherigen Quizseiten und ist
damit die terminale Präsentationsseite.

Die lokal begrenzten Projektionsgrößen zielen bei 1080p auf mindestens 36 px
Fragetext, 30 px Antworten/Q&A und 26 px Ergebnislabels. Text und Code haben
Zeilenhöhe 1,5. Antwortblöcke werden auf jeder Seite vertikal zentriert.
Umfangreiche Inhalte erhalten zusätzliche Seiten. Quiz-Seiten und die
Quizphase wechselt die Lehrkraft im Presenter-Footer, einschließlich
**Erste Frage starten** in der Lobby. Die Phasensteuerung steht auch auf dem
Host zur Verfügung. Eine neue Frage oder Runde erscheint erst, wenn ihr
Snapshot zur Session passt, auch
wenn der Host die Runde oder die Frage wechselt. Bis dahin steht »Die Frage
wird geladen«, nach einem Fehlschlag »Erneut laden«. Der Fokus wandert von
dieser Ladeanzeige auf den nächsten Phasenknopf, sobald der Snapshot da ist.
Die Seitensteuerung erscheint, sobald mehr als eine Seite gemessen wurde,
und bleibt im DOM, wenn die Zahl wieder auf eine Seite fällt. Die Seitenangabe
steht in dieser Steuerung. Q&A-Fragen
wechseln über denselben Host-Navigator oder den Presenter-Footer. Das
Zwischenleaderboard zeigt die ersten fünf Personen und Teams und nennt die
Kappung, zum Beispiel »Top 5 von 20«. Auf einer kurzen Projektion schrumpfen
diese Zeilen, damit alle fünf Plätze in der Bühnenhöhe bleiben. Das Abschluss-Leaderboard für Personen und
Teams wechselt automatisch mit höchstens acht Einträgen und zwölf Sekunden pro
Seite. **Anhalten** legt die Seite fest, **Vorherige Seite** und **Nächste
Seite** blättern von Hand, **Automatisch** setzt den Wechsel fort. Voting,
Timer, Ergebnisfreigabe und effektive Wertungsrunde
bleiben unabhängig von der Seite.

In der Quiz-Statuszeile stehen der Lesefortschritt (»x von y bereit«) und
**Alle sind bereit**, sobald alle Teilnehmenden der Session bereit sind. Während
der Abstimmung bleiben Prozent und »n / m«. **Alle haben abgestimmt** erscheint
bei voller Stimmenzahl. **Abstimmung beendet** ersetzt die Phasenbezeichnung,
sobald alle abgestimmt haben oder der Countdown abgelaufen ist und die Freigabe
noch aussteht. Persönliche Zeitfenster, deren Anzahl und **Trotzdem freigeben**
bleiben auf dem Host. Die betroffenen Presenter-Knöpfe sind dann deaktiviert
und der Presenter sagt, dass die Fenster noch laufen und der Host sie schließt.

Der Footer zeigt je Phase genau die nächste Aktion: **Antwortoptionen
freigeben**, **Ergebnis zeigen**, bei Peer-Instruction-Empfehlung zusätzlich
**Diskussionsphase**, in der Diskussion **Zweite Abstimmung** und den
ausdrücklich beschrifteten Weg ohne zweite Abstimmung, danach **Nächste Frage**
oder **Zur Gesamtauswertung**. **Quiz pausieren** steht daneben in Lese- und
Abstimmungsphase, **Quiz fortsetzen** auf der Pause-Fläche. **Zurück zum Host**
bleibt in der Ecke jeder Presenter-Fläche, schließt die Projektion nicht und
verlässt das Vollbild nur auf einem einzelnen Bildschirm.

In den letzten fünf Sekunden liegt die Fingeranzeige als nicht interaktive
Viewport-Ebene über der Presenter-Fläche. Sie gehört weder zur Statuszeile noch
zu einer Inhaltsseite, wird deshalb nicht vom Seitenlayout abgeschnitten und
bleibt auch beim Seitenwechsel sichtbar. Das Bild steht mittig im rechten
Viewport-Drittel und schließt bündig mit der unteren Viewportkante ab. Seine
Höhe ist auf 41 Prozent der Projektionsfläche beziehungsweise 24 rem begrenzt;
automatisch geglättete, vierfach aufgelöste Assets vermeiden dabei sichtbare
Rasterkanten.

Die bestehende Mutation `session.setPresenterSurface` akzeptiert entweder eine
Projektionsfläche oder einen Seitenbefehl. Der Presenter meldet die gemessene
Seitenzahl, der Host sendet eine relative Navigation. `hostProcedure` prüft in
beiden Fällen den Host-Token. Das zusätzliche optionale Statusfeld
`presenterPage` enthält Kontext, Index und Anzahl. Ein zufälliger Kontext pro
Frage/Kanal/Fläche verhindert verspätete Befehle für alte Inhalte; beim
Sessionende wird ebenfalls zurückgesetzt. Die Anzahl begrenzt den Index.
Mehrere Host-Geräte ändern denselben flüchtigen Zustand. Reconnect/Reload
bewahrt die Seite; ein Backend-Neustart setzt sie zurück, wie bei der bestehenden
flüchtigen Presenter-Flächenwahl. Es gibt keine Datenbankmigration. Seitenbefehle invalidieren nur Sessioninfo
und Status. Die bestehenden Subscription-Schleifen erfassen ihre Signalversion
vor dem Lesen und Ausliefern, damit dabei eintreffende Änderungen sofort
nachgeliefert werden. Ein Regressionstest deckt diesen Übergang ab.

Fehlgeschlagene Messmeldungen werden nach zwei Sekunden erneut versucht.
Host-Navigation sperrt doppelte Klicks während der Anfrage, beendet sie nach
zehn Sekunden und bietet bei Fehlern denselben Knopf erneut an. Die
Bedienelemente bleiben nach einer Verringerung auf eine Seite im DOM, damit
Tastaturfokus nicht verloren geht.

## Weitere Flächen

- Crowd-Lobby: Gesamtzahl und bei höchstens acht Teams Teamzahlen ersetzen
  Nicknames; QR und Code erhalten Vorrang.
- Q&A: oben die Bühnen-Sortierung als Auswahl (Kontroverse, Beste Fragen,
  Stimmensaldo, Zeit), darunter die aktuelle
  Frage dominant (hörsaaltaugliche Typografie ≥36 px bei 1080p), darunter alle
  weiteren freigegebenen Fragen untereinander (≥30 px). Die Bühne scrollt, wenn
  Hero und Warteschlange nicht gemeinsam in die Fläche passen. Die Gesamtsumme
  der Warteschlange bleibt im Queue-Badge (»… Fragen«). Der Fragen-Navigator
  (»Vorherige Frage« / »n / m« / »Nächste Frage«) sitzt unten im Presenter-Footer,
  damit er beim ersten Präsentieren an der Bühne erreichbar ist; der Host behält
  dieselbe Steuerung. Keine Restzahl »weitere« und keine Seitenzeile »Seite n / m«
  auf der Bühne selbst;
  Hero und Queue zeigen Erstellungszeit (relativ) sowie die passende Sortier-Metrik:
  bei BEST Zustimmung (%), bei CONTROVERSIAL geteilte Reaktionen (%) – nie beides;
  `qa.presentProjection` liefert die Scores dafür immer mit (ohne Moderator-NLP),
  auch außerhalb von BEST/CONTROVERSIAL;
  `qa.presentProjection` lädt bis zu 500 `ACTIVE`/`PINNED`-Fragen (Forum-Seitenmaximum),
  damit Presenter und Host dieselbe absolute Bühnenreihenfolge teilen;
  der Host speichert denselben ungefilterten Snapshot für die Presenter-Synchronisation;
  der Fragen-Navigator (Vor/Zurück, Anzeige »n / m«) erscheint bei mindestens einer
  in der Host-Liste sichtbaren Frage und folgt exakt der aktuellen Listenreihenfolge
  aus »Auswertung & Werkzeuge« (Sortierung TOP/BEST/CONTROVERSIAL/TIME, Suche, Autor,
  Pin-/Pending-/Archiv-Filter und geladene Seite) — einschließlich PENDING und ARCHIVED;
  Presenter-Bühne und absolute `presenterPage` bleiben auf ACTIVE/PINNED begrenzt und
  werden nur mitgezogen, wenn die navigierte Listenfrage auf der Bühne liegt;
  fehlt der Snapshot, navigiert der Host über die aktuelle Listenreihenfolge;
  fehlt der Snapshot während der Projektion nicht mehr als harte Leersperre für den Host-Hero;
  nach Session-Ende ist `presentProjection` leer (`SESSION_ENDED`); der Navigator folgt dann
  der geladenen Host-Liste und synchronisiert den Presenter nicht;
  Host publiziert den Sortiermodus beim Q&A-Abonnement und vor dem Öffnen der
  Präsentation (`qa.setPresenterSortMode`), damit Forum und Bühne denselben Modus nutzen;
  der Presenter schaltet dieselbe Sortierung über `source: 'presenter'` um, setzt den
  Fragen-Navigator auf Position 1 und scrollt die Bühne nach oben; Suche, Pin- und
  Autorfilter der Bühne bleiben stehen; solange diese Quelle gilt, übernimmt
  der Host den Modus und schreibt ihn nicht zurück;
  fehlt `sortModeSource` und weicht `presentProjection.sortMode` vom Host ab
  (Backend-Restart, leere Map), publiziert der Host den Modus erneut (`force`);
  eine ausdrückliche Host-Sortierung oder ein Host-Filterwechsel setzt `takeover`;
  ein vorheriger Abo-Publish derselben Ansicht ohne `takeover` unterdrückt diese
  Übernahme nicht;
  Teilnehmer-Forum färbt denselben Navigator-Hero (via `presenterPage`) ein;
  `PINNED` steht in der Presenter-Bühnenreihenfolge zuerst (Host vor `PENDING`/`ACTIVE`);
  die Host-Liste rotiert ab dem Navigator-Cursor (Position 1 = Hero, 2 = nächster
  Kandidat, …); der Hero trägt allein die Primary-Rand-Markierung (wandert mit dem
  Cursor; Rahmen bleibt auch ohne laufende Projektion als Host-Bearbeitungshilfe);
  Hero nutzt die Standard-Kartenfläche und nur einen verstärkten Primary-Rand; der Neu-Hinweis (`--highlight`)
  überschreibt die Hero-Fläche nicht; Host-Forum markiert Hero und die aktuelle
  Warteschlangen-Fragen während laufender Projektion mit »Aktuell in der Präsentation«
  (Badge entfällt bei `presenterSurface === 'ended'`);
  der Host rückt den Hero über denselben Projektionsnavigator wie beim Quiz vor
  (Beschriftung »Vorherige Frage« / »Nächste Frage«, solange der Q&A-Kanal
  bevorzugt ist); die bisherige Hero-Frage wandert aus dem Fokus, die nächste
  Bühnenfrage (PINNED/ACTIVE in Presenter-Reihenfolge) wird Hero.
- Wortwolken: höchstens 24 Ausgangsbegriffe, mindestens 30 px nach Layout und
  eine sichtbare Restzahl. Tatsächliche Textflächen werden auf Überschneidung
  geprüft; nicht passend darstellbare Begriffe gehen in die Restzahl ein.
  Die Freitext-Bühne zeigt dieselbe Werkzeugleiste wie der Host: »Wörter«,
  »Wörter & Phrasen«, »Thema«, Einfrieren, Wortformen glätten und Themen
  aktualisieren. Eine Auswahl im Presenter bleibt in diesem Fenster gültig.
- Schätzfragen: beschriftete horizontale Verteilungsbalken, Stimmenzahl und
  bestehende Kennzahlen; längere Ergebnisse werden ebenfalls aufgeteilt.
- Blitzlicht: neutrale Fläche vor Freigabe, beschriftete Balken danach;
  Prozentwerte weiterhin erst ab fünf Stimmen.

## Technische Abnahme

Die reproduzierbaren Browserbefehle stehen unter
[Hörsaalprojektion in TESTING.md](../TESTING.md#hörsaalprojektion-und-host-seitensteuerung-473).
Die Tests verwenden lokale Test-Sessions und echte Browsergeometrie. Der
Testlauf für lange Inhalte prüft zusätzlich die Tastaturbedienung der Seitensteuerung,
Vollständigkeit von Absätzen/Code/Antworten, Zeilenhöhe und Reload. Der
Szenarienlauf deckt drei Auflösungen, beide Presets und DE/EN/FR ab. Vollbild
wird dort für die Geometriemessung simuliert; bestehende Dialog-, Fenster- und
Guard-Tests bleiben Teil der Frontend-Suite.

UI-Checkliste: Material-Buttons und vorhandene Farb-/Shape-Tokens; lazy scoped
Markdown-Overrides ohne Piercing; fünf synchronisierte Locales; keine neue
Animation; Tastaturfokus, Pending, Fehler und Retry durch DOM-Tests abgedeckt.
Projektor-Layout und Host bei 320 px werden in den Browserläufen geprüft.
Eine vollständige erneute Screenreader- oder Lighthouse-Abnahme der gesamten
Anwendung wird durch diese gezielte Änderung nicht ersetzt.

## Betrieb und offene reale Abnahme

Keine neuen Variablen, Dienste oder Berechtigungen. Die vorhandenen
Produktionsdateien und der Digest-Deploy bleiben unverändert. Seitenbefehle
laufen nur über Host-Mutationen und bestehende Statusverteilung; es gibt kein
zusätzliches Polling pro Teilnehmendem. Der technische Rollback ist ein
Image-Rollback ohne Datenbank-Rückmigration.

Als Zielumgebung wurden **HDMI-Beamer im Seminarraum und im Audimax** angegeben.
Eine reale Prüfung aus der letzten Reihe wurde durch die automatisierten Tests
nicht durchgeführt. Für das Abnahmeprotokoll fehlen noch Abstand, Auflösung,
Lichtbedingungen und Beobachtungen einer unvorbereiteten Person beim Vorlesen
von Code, Frage, allen Antworten, Q&A und Ergebnislabels. Eine Freigabe zum
Merge mit nachgelagerter Raumprüfung muss ausdrücklich dokumentiert werden.

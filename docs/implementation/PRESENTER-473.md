# Hörsaalprojektion (#473)

## Verhalten und Verträge

Die bestehende Host-Aktion öffnet weiterhin den geschützten Presenter. Der
Startdialog erklärt den Projektionsbildschirm und die getrennte Host-Steuerung;
Smartphone-Kopplung bleibt optional. Das Vollbild-Overlay lässt den aktuellen
Inhalt als Kontext erkennen.

`app-projection-pages` misst gerenderten Inhalt auf der tatsächlichen Fläche.
Absätze, Optionen und Codezeilen bilden bevorzugte Seitengrenzen; Formeln und
Bilder bleiben zusammen. Fortsetzungen behalten Antwortkennzeichen und
Listennummern. Später geladene Bilder und Schriften lösen eine Neumessung aus,
auch wenn ihre Seite gerade nicht sichtbar ist. Während sie nach einem Reload
noch laden, begrenzt eine vorläufige Messung den gespeicherten Index nicht.
Verteilungsmatrizen werden für die Projektion in vollständig
beschriftete Einträge umgebrochen. Quell-Markdown bleibt unverändert; als
optional markierte Unterrichtsimpulse bleiben wie bisher ausgeblendet.

Die lokal begrenzten Projektionsgrößen zielen bei 1080p auf mindestens 36 px
Fragetext, 30 px Antworten/Q&A und 26 px Ergebnislabels. Text und Code haben
Zeilenhöhe 1,5. Umfangreiche Inhalte erhalten zusätzliche Seiten. Quiz- und
Q&A-Seiten wechseln ausschließlich durch den Host; die Rangliste wechselt wie
bisher automatisch, jetzt mit höchstens acht Einträgen und zwölf Sekunden pro
Seite. Voting, Timer, Ergebnisfreigabe und effektive Wertungsrunde bleiben
unabhängig von der Seite.

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
- Q&A: angeheftete Frage, höchstens zwei weitere Fragen und Restzahl.
- Wortwolken: höchstens 24 Ausgangsbegriffe, mindestens 30 px nach Layout und
  eine sichtbare Restzahl. Tatsächliche Textflächen werden auf Überschneidung
  geprüft; nicht passend darstellbare Begriffe gehen in die Restzahl ein.
- Schätzfragen: beschriftete horizontale Verteilungsbalken, Stimmenzahl und
  bestehende Kennzahlen; längere Ergebnisse werden ebenfalls aufgeteilt.
- Blitzlicht: neutrale Fläche vor Freigabe, beschriftete Balken danach;
  Prozentwerte weiterhin erst ab fünf Stimmen.

## Technische Abnahme

Die reproduzierbaren Browserbefehle stehen unter
[Hörsaalprojektion in TESTING.md](../TESTING.md#hörsaalprojektion-und-host-seitensteuerung-473).
Die Tests verwenden lokale Test-Sessions und echte Browsergeometrie. Der
Testlauf für lange Inhalte prüft zusätzlich die mobile Host-Seitensteuerung,
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

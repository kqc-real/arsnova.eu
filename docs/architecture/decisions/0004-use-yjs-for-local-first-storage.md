# ADR-0004: Nutzung von Yjs (CRDTs) für Local-First Speicherung

**Status:** Accepted
**Datum:** 2026-02-18
**Entscheider:** Projektteam

## Kontext

Das Kernprinzip von arsnova.eu ist die **"Zero-Knowledge"-Infrastruktur**: Die **Quiz-Bibliothek** der Dozenten (geistiges Eigentum) wird nicht als dauerhafte Kopie auf einem zentralen Server gespeichert. Dozenten sollen ohne Account arbeiten können; ihre Quiz-Sammlung lebt primär lokal im Browser. Beim **Start einer Live-Session** wird eine **Kopie** des gewählten Quiz an den Server übermittelt (Story 2.1a), damit Abstimmungen und Präsentation laufen können – diese Kopie dient nur der laufenden Session.

## Entscheidung

Wir verwenden **Yjs** als CRDT-Framework (Conflict-free Replicated Data Types) kombiniert mit **IndexedDB** als lokaler Persistenz-Layer im Browser.

- Die **Quiz-Bibliothek** wird als **Yjs-Dokumente** modelliert und lebt in der lokalen IndexedDB; der Server speichert **keine dauerhafte** Quiz-Bibliothek.
- Die lokale Persistenz erfolgt über `y-indexeddb`.
- Synchronisation zwischen Geräten desselben Dozenten (z.B. Laptop & iPad) läuft über einen WebSocket-Relay-Server, der nur verschlüsselte Deltas weiterleitet.
- Beim Start einer Live-Session wird eine Kopie des Quiz an den Server gesendet (Quiz-Upload); der Server hält diese Kopie nur für die Dauer der Session (PostgreSQL/Prisma). Zero-Knowledge bezieht sich damit auf die **dauerhafte** Speicherung der Dozenten-Bibliothek, nicht auf die temporäre Session-Kopie.

## Konsequenzen

### Positiv
- 100 % DSGVO-Konformität: Keine personenbezogenen Inhalte auf dem Server
- Offline-Fähigkeit: Dozenten können Quizzes ohne Internetverbindung erstellen
- Multi-Device-Sync ohne Cloud-Account
- Konfliktfreie Zusammenarbeit durch CRDTs

### Negativ / Risiken
- Yjs hat eine Lernkurve; CRDTs sind konzeptionell anspruchsvoll
- Browser-Storage (IndexedDB) kann vom User gelöscht werden → Datenverlust möglich
- Debugging von CRDT-Sync-Problemen ist schwieriger als bei klassischen DB-Queries

## Alternativen (geprüft)
- **Klassische Server-Speicherung:** Widerspricht dem Zero-Knowledge-Prinzip
- **LocalStorage:** Zu limitiert (5 MB), keine strukturierte Abfrage
- **PouchDB/CouchDB:** Gute Sync-Lösung, aber weniger flexibel als Yjs bei Echtzeit-Collaboration

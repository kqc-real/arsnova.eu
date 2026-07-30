## Zusammenfassung

<!-- Problem und Lösung in wenigen Sätzen beschreiben. -->

- **Problem:**
- **Lösung:**
- **Bewusste Nicht-Ziele:**

## Risiko und Verträge

<!-- Genau eine Risikostufe auswählen. -->

- [ ] Niedrig – Dokumentation, Texte oder isolierte Änderung ohne geändertes Verhalten
- [ ] Mittel – Benutzeroberfläche, Anwendungslogik, Schema, Persistenz oder Konfiguration
- [ ] Hoch – Authentifizierung, Autorisierung, Tokens, WebSockets, Yjs, Redis,
      Datenbankmigrationen, Datenschutz, Deployment oder Sicherheitskonfiguration

**Maßgebliche Quelle und relevante Invarianten:**

<!-- Welche Spezifikation, welches Schema oder welches bestehende Verhalten ist verbindlich? -->

**Betroffene externe Verträge:**

<!-- Beispielsweise Browser-API, Bibliothek, Dateiformat oder Netzwerkprotokoll. Falls keine: „Keine“. -->

## Implementierung

<!-- Die wichtigsten Änderungen knapp und fachlich beschreiben. -->

-

## Verhaltens- und Abdeckungsprüfung

- [ ] Gewünschtes Verhalten und maßgebliche Quelle wurden vor der Implementierung geklärt
- [ ] Vergleichbare Implementierungen und betroffene Aufrufpfade wurden geprüft
- [ ] Erfolgsfall wurde getestet
- [ ] Ablehnungs-, Fehler- oder ungültiger Eingabepfad wurde getestet oder unter
      „Nicht zutreffend“ begründet
- [ ] Ein Regressionstest bildet bei einer Fehlerbehebung den ursprünglichen
      Fehler ab
- [ ] Relevante Zustandsübergänge wurden geprüft

### Relevante Zustandsübergänge

<!-- Zutreffendes markieren. Nicht markierte, naheliegende Punkte unten begründen. -->

- [ ] Nicht zustandsbehaftete Änderung
- [ ] Wiederholung oder doppelte Anfrage
- [ ] Neuladen und Wiederherstellung
- [ ] Reconnect oder Verbindungsersetzung
- [ ] Token- oder Capability-Rotation
- [ ] Ablauf und Bereinigung
- [ ] Migration oder Legacy-Daten
- [ ] Parallelität oder Race Conditions
- [ ] Abhängigkeit vorübergehend nicht verfügbar
- [ ] Asynchroner Ablauf: Pending → Erfolg → Ablehnung/Timeout → Retry oder Abbruch
- [ ] DOM-Ersetzung: nach Erfolg und Fehler existiert ein sichtbares,
      nicht verdecktes und fachlich sinnvolles Fokusziel

## Validierung

<!-- Nur tatsächlich im aktuellen Branch ausgeführte Prüfungen markieren. -->

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run build:prod` bei Frontend-, i18n-, Build- oder Produktionsänderungen
- [ ] Betroffene Unit-, Integrations- oder Contract-Tests ergänzt beziehungsweise aktualisiert

### Ausgeführte Prüfungen und Ergebnisse

| Prüfung/Befehl | Ergebnis |
| -------------- | -------- |
|                |          |

<!-- Keine Prüfung als erfolgreich angeben, wenn sie nicht ausgeführt wurde. -->

## Risikobezogene Prüfungen

<!-- Zutreffende Prüfungen markieren und unter „Nachweise“ belegen. -->

- [ ] Keine Benutzeroberflächenänderung oder mobile Darstellung geprüft
- [ ] Keine relevante Änderung oder Tastatursteuerung und Fokusverhalten geprüft
- [ ] Keine relevante Änderung oder Screenreader-Semantik geprüft
- [ ] Keine relevante Änderung oder Reflow, Zoom und Kontrast geprüft
- [ ] Keine Realtime-Änderung oder WebSocket-/Yjs-Szenarien geprüft
- [ ] Keine Migrationsänderung oder Prisma-Migrationskette auf einer frischen
      Datenbank geprüft
- [ ] Keine lastrelevante Änderung oder Last-/Performance-Budget geprüft
- [ ] Keine Textänderung oder alle Locales (`de`, `en`, `fr`, `es`, `it`)
      synchronisiert
- [ ] Keine Änderung externer Verträge oder Vertrag anhand einer maßgeblichen
      Spezifikation beziehungsweise eines Contract-Tests geprüft
- [ ] Keine sicherheitsrelevante Änderung oder erlaubte und abgelehnte
      Sicherheitsgrenze getestet

## Betrieb und Rollback

- **Auswirkung auf Produktion:**
- **Erforderliche Konfigurations- oder Deployment-Schritte:**
- **Beobachtbarkeit beziehungsweise relevante Logs/Metriken:**
- **Rollback:**

- [ ] Keine neuen Secrets, Zugangsdaten, `.env`-Inhalte, Dumps oder lokalen
      Artefakte eingecheckt
- [ ] `.env.production.example`, Deployment-Dateien und Betriebsdokumentation
      sind aktuell oder nicht betroffen
- [ ] Shared-NAT-Betrieb und mindestens 500 gleichzeitige Hörsaal-Clients sind
      nicht betroffen oder wurden berücksichtigt

## Nachweise

<!-- CI-Lauf, Testreport, Screenshots, Messungen oder manuelle Prüfungen verlinken. -->

-

## Nicht zutreffend und verbleibende Risiken

<!-- Jeden nicht ausgeführten, aber naheliegenden Prüfpunkt konkret begründen. -->

- **Nicht zutreffende Prüfungen:**
- **Verbleibende Risiken:**

## Selbstreview

- [ ] Der vollständige Diff wurde unabhängig noch einmal geprüft
- [ ] Aufgabenstellung und Akzeptanzkriterien wurden erneut mit dem Ergebnis verglichen
- [ ] Code, Tests, Schemas, Dokumentation, Konfiguration, Übersetzungen und
      PR-Beschreibung widersprechen sich nicht
- [ ] Vergleichbare Pfade enthalten den behobenen Fehler nicht weiterhin
- [ ] Temporärer Code, Debug-Ausgaben und überholte Kommentare wurden entfernt
- [ ] Sicherheits-, Barrierefreiheits-, Kompatibilitäts- und
      Performanceaussagen sind durch Nachweise gedeckt
- [ ] Der PR ist vollständig und bereit für ein Review
- [ ] Bei asynchronen UI-Änderungen wurden Erfolg, Pending, Fehler und Fokus
      jeweils anhand des tatsächlichen DOM-Ablaufs geprüft

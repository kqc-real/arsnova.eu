# Story 2.10 Slice 5 — DoD-Nachweis

Stand: 2026-09-07. Slices 1–4 bleiben die Feature-Basis. Dieser Slice liefert
die Abnahmenachweise, keine neuen Produktfähigkeiten.

## 1. Missbrauchs- und Security-E2E

Live gegen Backend, ohne Browser:

```bash
npm run dev:backend
npm run load:smoke:host-pairing-security
```

| Fall                        | Erwartung                                         |
| --------------------------- | ------------------------------------------------- |
| Öffentlicher QR             | Pending, keine Host-Mutation, Reject → kein Token |
| Privat ohne Approve         | kein `PairedHostToken`                            |
| Cap 3                       | vierte Anfrage fehl, nach Widerruf wieder möglich |
| Approve → Aktion → Widerruf | HTTP und bestehende Host-WS sofort tot            |

Presenter ohne Freigabe-UI: Browser-Smoke und
`host-pairing-surfaces.spec.ts`.

CI: Job `classroom-smokes`.

## 2. Last und Reconnect

Classroom-30 (PR-Gate, CI):

```bash
npm run load:smoke:host-pairing-classroom-30
```

Cap-Worst-Case 500 (kein PR-Gate):

```bash
PARTICIPANTS=500 npm run load:smoke:host-pairing-cap-500
```

Beide Läufe erzeugen: Original-Host + 3 Paired Hosts + Presenter-Status,
Shared-NAT (ein Runner-IP), Vote-Welle, Paired-Host-Reconnect,
Presenter-Kanalwechsel, Widerruf bei noch verbundenen Teilnehmenden.

### Ausgeführte Läufe

Lokales Backend am 2026-09-07. Der 500er ist kein PR-Gate, wurde aber lokal
ausgeführt.

| Datum      | Befehl                                                     | Ergebnis                                           |
| ---------- | ---------------------------------------------------------- | -------------------------------------------------- |
| 2026-09-07 | `npm run load:smoke:host-pairing-security`                 | bestanden (`K7E7GE`, `8LUY48`)                     |
| 2026-09-07 | `npm run load:smoke:host-pairing-classroom-30`             | bestanden (`ZB2P7P`, Vote-p95 51 ms)               |
| 2026-09-07 | `PARTICIPANTS=500 npm run load:smoke:host-pairing-cap-500` | bestanden (`NKDM5P`, Vote-p95 512 ms, 0 Fehlvotes) |
| 2026-09-07 | `smoke:host-pairing-security` (Playwright, Port 4202)      | bestanden (`YEJDNT`)                               |

500er-Kennzahlen `NKDM5P`: 500 Shared-NAT-Joins, Vote-p50/p95/max 510/512/513 ms,
Host-Progress 4 Messages, Current-Question 2, Widerruf beendete die Host-WS mit
„Die Host-Verbindung wurde beendet.“ Gesamtlauf ~12 s.

## 3. Browser-Smoke

Getrennte Kontexte Original-Host / Smartphone / Presenter.

```bash
BASE_URL=http://localhost:4200/de TRPC_URL=http://localhost:3000/trpc \
  npm run smoke:host-pairing-security -w @arsnova/frontend
```

Verifiziert: Presenter ohne Freigabe-UI; öffentlicher Scan pending + Reject;
Approve → `LOBBY → Frage → Ergebnis → Kanalwechsel → Session-Ende`;
sofortiger Entzug mit Overlay „Die Host-Verbindung wurde beendet.“

CI: Job der Playwright-Browser-Smokes.

## 4. Usability — Thinking-Aloud

Ein Agent kann diese Sitzung nicht ersetzen. Story 2.10 ist UX-seitig erst
abnahmefähig, wenn eine Person **ohne Architekturkenntnis** den Flow geprüft
hat.

### Aufgabe

„Sie möchten Ihre Präsentation auf dem Beamer zeigen und sich anschließend
mit Ihrem Smartphone im Raum bewegen und die Präsentation steuern.“

### Erfolgskriterien (Story 2.10)

- [ ] Findet die Smartphone-Steuerung ohne Anleitung
- [ ] Versteht, dass das Smartphone die laufende Präsentation steuert
- [ ] Kennt die Begriffe Paired Host, Token oder WebSocket nicht und braucht
      sie nicht
- [ ] Erkennt, wann das Smartphone verbunden ist
- [ ] Kann die Präsentation starten
- [ ] Versteht bei einem als öffentlich beschriebenen Bildschirm, dass die
      Freigabe noch bestätigt werden muss
- [ ] Der Flow wirkt nicht wie eine technische Administrationsaufgabe

### Sitzungsvorlage

- Datum:
- Person (Rolle, keine Architekturkenntnis):
- Geräte: Laptop (Host) / Smartphone / Beamer oder zweiter Bildschirm
- Beobachtungen (lautes Denken, Zitate):
- Ergebnis je Kriterium: erfüllt / nicht erfüllt
- Offene UX-Punkte:

## 5. Locale-Gegenprüfung

Neue bzw. Slice-4-Strings (`hostPairing.*`, `hostAccess.*`,
`presentationStart.reviewRequest`, `presentationStart.manageDevices`) wurden
am 2026-09-07 in `de` / `en` / `fr` / `es` / `it` redaktionell gegengeprüft.
Keine Maschinenübersetzung, keine Token-/WebSocket-Begriffe in der
regulären UI. Kleine FR-Schärfung: Cap-Hinweis „un appareil“ statt
„une liaison“, „Examiner la demande“ statt einer zu kurzen Schaltfläche.

`npm run check:i18n -w @arsnova/frontend` bleibt das maschinelle
Vollständigkeitsgate.

## 6. Bewusste Lücke

Das Thinking-Aloud ist vorbereitet, aber nicht durch eine echte Person
durchgeführt. Technische DoD-Nachweise können ohne diese Sitzung
reviewbereit sein; die UX-Abnahme der Story bleibt offen, bis die Vorlage
oben ausgefüllt ist.

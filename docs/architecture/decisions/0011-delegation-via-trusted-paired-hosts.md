<!-- markdownlint-disable MD013 -->

# ADR-0011: Delegation über vertrauenswürdige Paired Hosts

**Status:** Accepted
**Datum:** 2026-03-16
**Ersetzt am:** 2026-08-25
**Entscheider:** Projektteam

## Kontext

Die ursprüngliche Fassung plante eine eigenständige, auf Q&A begrenzte Moderatorrolle mit separatem Token, eigener Route und reduzierter Oberfläche. Dieser Pfad wurde nie implementiert. Produktiv läuft Q&A-Moderation weiterhin als Host-Funktion über serverseitig autorisierte Host-Prozeduren; `moderatorView` ist nur ein Sichtflag und kein Berechtigungsnachweis.

Für die tatsächlichen Einsatzfälle werden überwiegend zwei gleichberechtigte Host-Geräte oder eine persönlich vertrauenswürdige Tutor:in, Assistenz beziehungsweise Moderator:in benötigt. Eine zusätzliche Rollen- und Oberflächenmatrix würde Pairing, Realtime-Synchronisation, Reconnect, Tests und Produktkommunikation deutlich vergrößern.

## Neue Entscheidung

Delegierte Live-Steuerung wird ausschließlich über **Story 2.10 (Paired Host / Host-Twin)** geplant:

- Ein Paired Host erhält ein eigenes, sessiongebundenes und separat widerrufbares Token.
- Nur der ursprüngliche Host darf weitere Geräte koppeln, auflisten oder widerrufen.
- Paired Hosts dürfen keine weiteren Geräte koppeln.
- Eine gekoppelte Person nutzt dieselbe responsive Host-Oberfläche und besitzt vollständige reguläre Host-Rechte.
- „Moderator:in“ bezeichnet dabei eine Aufgabe in der Veranstaltung, keine eigene technische Rolle.
- Es gibt keine Route `/session/:code/moderate`, kein Moderator-Token und keine reduzierte Moderator-Oberfläche.
- Presenter bleibt eine getrennte Projektionsansicht ohne Steuerbedienelemente.

Der Session-Code allein verleiht weiterhin keinerlei Host- oder Pairing-Rechte. URL, Route und Clientzustand sind keine Berechtigungsnachweise.

## Vertrauensgrenze

Die Lehrperson darf nur eigene Geräte oder persönlich vertrauenswürdige Personen koppeln. Vor der Kopplung muss klar erkennbar sein, dass der Paired Host neben Q&A und Moderationskompass auch Quizphasen, Ergebnisse, Blitzlicht, Presenter-Flächen und das Session-Ende steuern kann.

Ein Quiz-Export schützt die wiederverwendbare Quizdefinition, nicht jedoch den Ablauf oder die Ergebnisse einer laufenden Session. Vorzeitig gezeigte Lösungen, übersprungene Phasen oder ein Session-Ende bleiben mögliche Auswirkungen einer Fehlbedienung.

Benötigt eine Organisation Rechte für nicht vollständig vertrauenswürdige Personen, darf sie keinen Paired Host koppeln. Ein Least-Privilege-Rollenmodell ist nicht Bestandteil der aktuellen Produktplanung und müsste bei nachgewiesenem Bedarf neu entschieden werden.

## Konsequenzen

### Positiv

- Eine Host-Oberfläche und ein Autorisierungsmodell statt paralleler Rollenpfade.
- Vertrauenswürdige Tutor:innen oder Moderator:innen sehen Ergebnisse, Moderationskompass und alle für die gemeinsame Durchführung nötigen Zustände.
- Pro Gerät widerrufbare Tokens vermeiden das Teilen des ursprünglichen Host-Tokens.
- Weniger Routen-, Realtime-, Test- und Dokumentationskomplexität.

### Negativ / Risiken

- Paired Hosts haben bewusst keine eingeschränkten Rechte.
- Vertrauen und verständliche Kopplungswarnungen werden Teil der Sicherheitsgrenze.
- Fehlbedienung kann eine laufende Veranstaltung stören, auch wenn die Quizdefinition exportiert wurde.
- Sicherheitskritische Aktionen benötigen weiterhin klare Bestätigungen und serverseitige Zustandsprüfung.

## Umsetzungsstand

Story 2.10 ist offen. Im aktuellen Repo existieren weder Paired-Host-Pairing noch eine eigenständige Moderatorrolle. Die bestehende Host-Authentifizierung bleibt bis zur Umsetzung maßgeblich.

---

**Referenzen:** [ADR-0006: Rollen, Routen und Autorisierung](./0006-roles-routes-authorization-host-admin.md), [ADR-0009: Einheitliche Live-Session mit Tabs für Quiz, Q&A und Blitzlicht](./0009-unified-live-session-channels.md), [ADR-0019: Host-Härtung und besitzgebundene Session-Zugriffe](./0019-host-hardening-and-owner-bound-session-access.md), `Backlog.md` Story `2.10`.

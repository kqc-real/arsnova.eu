# Post-Deploy Go/No-Go Checkliste

Diese Checkliste wird direkt nach jedem Production-Deploy ausgefuellt.
Sie dient als verbindlicher Smoke-Test fuer den Go/No-Go-Entscheid.

## Release-Metadaten

- Release/Commit: `__________`
- Datum/Uhrzeit: `__________`
- Verantwortlich: `__________`
- Entscheidung: `GO / NO-GO`

## Smoke-Checks

- **1) API-Liveness**
  - Command: `curl -fsS https://arsnova.eu/trpc/health.check`
  - Erwartet: HTTP 200 und JSON mit `status: "ok"`.
  - Ergebnis/Notiz: `____________________________`
- **2) Frontend-Shell + Routing**
  - URLs: `https://arsnova.eu/`, `https://arsnova.eu/de/`
  - Erwartet: Keine Blank Page, Startseite laedt, Locale-Routing korrekt.
  - Ergebnis/Notiz: `____________________________`
- **3) Realtime-Smoke (Host <-> Teilnehmende)**
  - Test: Session starten, zweites Geraet beitreten, Frage/Status wechseln.
  - Erwartet: Updates kommen direkt an (keine sichtbaren Haenger).
  - Ergebnis/Notiz: `____________________________`
- **4) Admin-Smoke (Epic 9)**
  - URL: `https://arsnova.eu/admin`
  - Test: Login, Session suchen, Detailansicht laden.
  - Erwartet: Login/Token ok, Daten laden ohne Fehler.
  - Ergebnis/Notiz: `____________________________`
- **5) Infrastruktur/Container-Health**
  - Command: `docker compose -f docker-compose.prod.yml --env-file .env.production ps`
  - Erwartet: `app`, `postgres`, `redis` laufen und sind healthy.
  - Optional Logs: `docker compose -f docker-compose.prod.yml --env-file .env.production logs app --tail 100`
  - Ergebnis/Notiz: `____________________________`

## Go/No-Go

- **GO** - alle 5 Checks erfolgreich
- **NO-GO** - mindestens 1 kritischer Check fehlgeschlagen
- Freigabe durch: `__________`
- Uhrzeit: `__________`
- Follow-up Tickets (bei NO-GO): `__________`

## Eskalation bei NO-GO

1. Incident im Team-Channel melden.
2. Betroffenen Check und Logs dokumentieren.
3. Rollback- oder Hotfix-Entscheidung mit Verantwortlichen treffen.
4. Neues Deploy erst nach erneuter vollstaendiger Checkliste.

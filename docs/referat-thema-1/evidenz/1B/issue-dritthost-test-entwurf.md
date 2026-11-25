# Issue-Entwurf: Runbook §11 verlangt einen Negativtest von einem Dritthost, nennt aber keinen Befehl

> **Status:** _Aktualisiert 2026-11-13:_ angelegt als [#22](https://github.com/NiklasSkulll/arsnova.eu/issues/22) im Fork (Unter-Issue von #8); maßgeblich ist das Issue. Ursprünglich: Entwurf, nicht angelegt. Angelegt wird erst nach Freigabe durch den Autor; Ort (kqc-real oder Fork) entscheidet er. Grundlage: [Aufbauprotokoll, Befund 3](2026-11-12-aufbau.md#befunde-für-kernaussage-c). Entworfen mit Claude Code (Modell Claude Opus 5.5).

**Vorgeschlagener Titel:** `Second-Host-Runbook: prüfbaren Befehl für „anderer Host erreicht Port 8080 nicht“ ergänzen`

---

## Beobachtung

`docs/operations/OPEN-WEIGHT-LLM-SECOND-HOST-RUNBOOK.md` Abschnitt 11 verlangt am Ende (Z. 601–603): „Zusätzlich muss ein Zugriff von einem beliebigen anderen Host auf Port 8080 scheitern. Dafür **keine** öffentliche Firewall-Freigabe zum Testen anlegen.“ Ein Befehl und eine erwartete Ausgabe fehlen, anders als bei den übrigen Prüfungen in §10 und §11. Damit ist eine zentrale Sicherheitsannahme der zweiten Rolle (nur der App-Host erreicht die Runtime) im Abnahmeprotokoll nicht nachvollziehbar belegt.

## Vorschlag

Einen Befehl mit erwarteter Ausgabe ergänzen, etwa von einem dritten Host im selben Segment:

```bash
curl --silent --show-error --max-time 5 "http://<PRIVATE-IP-DES-INFERENZ-HOSTS>:8080/health" \
  && echo 'FEHLER: Port 8080 von diesem Host erreichbar' || echo 'OK: nicht erreichbar'
```

Erwartet: `OK: nicht erreichbar` (Zeitüberschreitung oder abgelehnte Verbindung). Ohne `--fail` endet `curl` bei jeder HTTP-Antwort mit 0, also auch bei 401; jede Antwort zählt damit als erreichbar. Dazu ein Hinweis, dass ohne dritten Host im Segment die Firewall-Regel (`ufw status verbose`, Quelle nur App-Host) als Ersatzbeleg dient.

**Kosten:** gering (nur Doku). **Risiko:** keins. **Rückweg:** Revert.

## Gültigkeitsgrenze

Runbook am Branch-Stand `e2e9c701` (unverändert gegenüber `a19ca70f`). Das Labor prüfte vom Rechner aus und über die Firewall-Regeln ([Aufbauprotokoll](2026-11-12-aufbau.md)); einen echten dritten Host im Labornetz gab es nicht.

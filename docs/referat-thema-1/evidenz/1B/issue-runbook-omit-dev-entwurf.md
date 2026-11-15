# Issue-Entwurf: Runbook §6 installiert ohne Dev-Abhängigkeiten, der Compose-Wrapper braucht aber `dotenv` aus der Wurzel

> **Status:** _Aktualisiert 2026-11-13:_ angelegt als [#21](https://github.com/NiklasSkulll/arsnova.eu/issues/21) im Fork (Unter-Issue von #8); maßgeblich ist das Issue. Ursprünglich: Entwurf, nicht angelegt. Angelegt wird erst nach Freigabe durch den Autor; Ort (kqc-real oder Fork) entscheidet er. Grundlage: [Aufbauprotokoll, Befund 2](2026-11-12-aufbau.md#befunde-für-kernaussage-c). Entworfen mit Claude Code (Modell Claude Opus 5.5).

**Vorgeschlagener Titel:** `Second-Host-Runbook: npm ci --omit=dev bricht scripts/open-weight-llm/prod-compose.mjs`

---

## Beobachtung

`docs/operations/OPEN-WEIGHT-LLM-SECOND-HOST-RUNBOOK.md` Abschnitt 6 (Z. 313) und Abschnitt 14.2 (Z. 904) installieren mit `npm ci --omit=dev --ignore-scripts`. Danach scheitert der erste Aufruf des Compose-Wrappers in §9 (Z. 436, `npm run llm:prod -- config`; das Skript `llm:prod` ist laut `package.json` Z. 41 `node scripts/open-weight-llm/prod-compose.mjs`) mit `ERR_MODULE_NOT_FOUND`, weil `prod-compose.mjs` in Z. 7 `dotenv` importiert.

Ursache laut `package-lock.json`: `node_modules/dotenv` (16.6.1) ist nur als Dev-Abhängigkeit markiert (`"dev": true`). Die Produktionsversion 17.4.2 gehört zu `apps/backend` und liegt in `apps/backend/node_modules`, wo das Skript unter `scripts/` sie nicht findet.

Im Labor wurde ohne `--omit=dev` installiert ([`llm-start.sh`](llm-start.sh)).

## Vorschlag

Eine der beiden Varianten:

1. `dotenv` als Produktionsabhängigkeit in die Wurzel-`package.json` aufnehmen, oder
2. im Runbook (§6 und §14.2) `--omit=dev` streichen und das begründen.

Variante 1 hält die Installation schlank. In beiden Fällen ein Test oder CI-Schritt, der den Wrapper nach `npm ci --omit=dev` einmal startet (`--help` oder Trockenlauf).

**Kosten:** gering. **Risiko:** gering. **Rückweg:** Revert.

## Gültigkeitsgrenze

Stand `a19ca70f`, Runbook, `package.json` und Lockfile am Branch-Stand `e2e9c701` geprüft (dort unverändert); Ubuntu 24.04 mit Node.js 22 in der Labor-VM.

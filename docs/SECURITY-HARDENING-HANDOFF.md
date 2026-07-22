<!-- markdownlint-disable MD013 MD060 -->

# Handoff: Security-Härtung starten

**Zweck:** Briefing für einen **neuen** Cursor-Agent-Chat zur Umsetzung der Sicherheits-Härtung.  
**Stand:** 2026-07-22  
**Workspace:** `/Users/kqc/arsnova.eu`

---

## 1. Kontext (kurz)

| Punkt                         | Stand                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| Externes Security-Audit (Ist) | **~5/10** — mittlere Basis, mehrere dringende Befunde; kein Incident                     |
| Härtungsplan (Review)         | **~7/10** — freigabefähig nach Schärfung; **kein Ersatz** für Implementierung            |
| Source of Truth               | **[SECURITY-HARDENING-PLAN.md](SECURITY-HARDENING-PLAN.md)** — AKs **nicht abschwächen** |
| Ist-Kontrollen                | [SECURITY-OVERVIEW.md](SECURITY-OVERVIEW.md)                                             |

Der Plan konsolidiert Audit, UX-Follow-up und Hörsaal-/NAT-Nachtrag. **Dieses Handoff ersetzt den Plan nicht** — bei Konflikt gilt der Plan.

---

## 2. PR- und Branch-Status

| Item                                                                      | Status                                                                                      |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Plan-PR **[#124](https://github.com/kqc-real/arsnova.eu/pull/124)**       | **offen** (Branch `docs/security-hardening-plan`) — Plan + dieses Handoff                   |
| Security-Deps **[#121](https://github.com/kqc-real/arsnova.eu/pull/121)** | **gemerged** (2026-07-22) — Dependabot-Overrides ohne Astro 7; Story **0.9** danach möglich |

**Vor Code-Slices:** Plan (#124) mergen bzw. sicherstellen, dass `docs/SECURITY-HARDENING-PLAN.md` auf `main` liegt.

---

## 3. Leitprinzipien (nicht verhandelbar)

1. **Hörsaal-NAT:** Bis ~500 Geräte teilen eine öffentliche IP. **Keine engen IP-Limits** auf Teilnehmerpfaden (Join, Vote, Q&A, Blitzlicht, WebSocket).
2. **Proxy = lokaler Nginx** auf demselben Host — kein CDN/WAF. `TRUST_PROXY_HOPS=1`; IP-Fix für Logs/Host-Grenzen, **nicht** für Participant-Lockouts.
3. **UX-bewusst:** UX-neutrale Fixes zuerst; Tradeoffs (Image-Proxy, Yjs-Rotation, `accessProof`-Cutover, PDF-Queue) später mit Migration/Fortschritt.
4. **Erfolgsmaß:** keine offenen HIGH-Befunde + bestandene Security-/Lasttests (Plan §6.5) — **nicht** eine vage „7–8/10“-Note.
5. **Verboten u. a.:** enge Participant-IP-Locks; Soft-Cap als Saal-Hard-Lock; Client-ID als Auth; `npm audit fix --force`; CSP sofort enforce; kurze Yjs-TTLs. Details: Plan Abschnitt 7.

---

## 4. Empfohlenes KI-Modell

| Slice-Art    | Beispiele                                                                                                                                                     | Modell                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Kritisch** | PDF-SSRF/TOCTOU/DNS-Rebind + Chromium ohne Re-Fetch abgelehnter Srcs, `resolveClientIp`, Code-Lockout → Client-ID Soft-Cap, Yjs-Tokens, `accessProof`-Cutover | **GPT-5.6 Sol high / Extra High** (oder vergleichbar stark) — **nicht** Composer 2.5 Auto allein |
| **Hygiene**  | Node-Upgrade, Body-/Payload-Limits, einfaches Zod `.max()` für Fragen                                                                                         | Composer / Auto ok                                                                               |

Kritische Slices: starke Modelle für Design + Review; Hygiene kann leichter laufen.

---

## 5. Empfohlene erste Aufgabe

**Nachdem der Plan gemerged ist:** **W0 + W1 Security-Core** laut Plan umsetzen (eigene PRs pro Slice; Owner/Ticket/Deps/Rollback ausfüllen).

### Woche 0 — Sofort-Containment

| #    | Paket                                                     |
| ---- | --------------------------------------------------------- |
| W0.1 | Body-/Payload-Limits (Create/Upload/Export)               |
| W0.2 | PDF-Parallelität hart begrenzen (z. B. 1–2)               |
| W0.3 | Node-Bump starten (24 bevorzugt / sonst 22 + Termin)      |
| W0.4 | Monitoring-Schwellen (Create/PDF/WS/429)                  |
| W0.5 | Optional: SSRF fail-closed Interim (Platzhalter) bis W1.2 |

### Woche 1 — HIGH-Kern (UX-neutral)

| #    | Paket                                                                                                         | Modell-Hinweis |
| ---- | ------------------------------------------------------------------------------------------------------------- | -------------- |
| W1.1 | Node 24 (oder 22 + verbindlicher Node-24-Termin)                                                              | Hygiene        |
| W1.2 | PDF-SSRF-Kern (TOCTOU/Rebind/IP-Bind/Stream/MIME; abgelehnte Srcs ersetzen **oder** Chromium-Netz blockieren) | **Kritisch**   |
| W1.3 | Public Creates: Rate-Limits, Zod `.max()`, Payload, Upload-Cleanup                                            | gemischt       |
| W1.4 | `resolveClientIp` → nur `req.ip`                                                                              | **Kritisch**   |
| W1.5 | Session-Code-Lockout → Client-ID Soft-Cap (kein Hard-Lock)                                                    | **Kritisch**   |
| W1.6 | Grobe Limits Session-Create / Admin-Login                                                                     | Hygiene/mittel |

**Out-of-scope W1:** Image-Proxy-Produktisierung, PDF-Queue-UI, Yjs-Token-Rotation gebaut, `accessProof`-Cutover, CSP enforce, ZAP als PR-Gate.

Akzeptanzkriterien und Lasttest-AKs: **nur** Plan (§6, §6.5, Übergreifende AKs) — nicht abschwächen.

---

## 6. Verwandte Docs & Stories

| Thema               | Link                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| Härtungsplan (SoT)  | [SECURITY-HARDENING-PLAN.md](SECURITY-HARDENING-PLAN.md)                                       |
| Ist-Sicherheit      | [SECURITY-OVERVIEW.md](SECURITY-OVERVIEW.md)                                                   |
| Sync-Sicherheit     | Backlog **Story 1.6c**; [architecture/quiz-library-sync.md](architecture/quiz-library-sync.md) |
| Landing XSS / Astro | Backlog **Story 0.9** (Astro ≥ 7.1; nach #121)                                                 |
| Security-Deps       | PR [#121](https://github.com/kqc-real/arsnova.eu/pull/121) (gemerged)                          |
| Plan-PR             | PR [#124](https://github.com/kqc-real/arsnova.eu/pull/124)                                     |
| Env / Trust-Proxy   | [ENVIRONMENT.md](ENVIRONMENT.md)                                                               |
| Deploy / Nginx      | [deployment-debian-root-server.md](deployment-debian-root-server.md)                           |
| Last / 500 TN       | [implementation/LASTTEST-500-TEILNEHMENDE.md](implementation/LASTTEST-500-TEILNEHMENDE.md)     |
| Agent-Regeln        | Root `AGENT.md`, `.cursorrules`, `mem:core`                                                    |

---

## 7. Checkliste für den neuen Chat

- [ ] Plan gelesen; AKs und „Nicht tun“ (§7) verinnerlicht
- [ ] Bestätigen: #124 gemerged bzw. Plan auf aktuellem Branch verfügbar
- [ ] Ersten Slice wählen (empfohlen: W0.1/W0.2 parallel zu W1.2-Vorbereitung; oder W1.4/W1.5 wenn IP/Lockout zuerst)
- [ ] Kritische Slices mit starkem Modell; Feature-Branch + PR pro Slice
- [ ] Tests gemäß Plan-AKs; Classroom-NAT nicht durch enge IP-Limits brechen
- [ ] SECURITY-OVERVIEW / ENVIRONMENT bei relevanten Änderungen mitziehen

---

## 8. Paste-Start (für neuen Chat)

Siehe Block unten in der Agent-Antwort bzw. Kurzform:

> Lies `docs/SECURITY-HARDENING-HANDOFF.md` und `docs/SECURITY-HARDENING-PLAN.md`. Plane und setze **W0 + W1** gemäß Plan um. AKs nicht abschwächen. Hörsaal-NAT beachten.

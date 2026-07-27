<!-- markdownlint-disable MD013 MD060 -->

# Handoff: Security-Härtung final abnehmen

**Zweck:** Briefing für einen **neuen** Cursor-Agent-Chat zur operativen Finalabnahme der Sicherheits-Härtung.
**Stand:** 2026-07-27
**Workspace:** `/Users/kqc/arsnova.eu`

---

## 1. Kontext (kurz)

| Punkt                         | Stand                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| Externes Security-Audit (Ist) | Historischer Ausgangsstand **~5/10**; kein Incident                                      |
| Härtungsplan                  | W0–W3 technisch umgesetzt; W3.7-Betriebsabnahme und S6.5-Formalabnahme offen             |
| Source of Truth               | **[SECURITY-HARDENING-PLAN.md](SECURITY-HARDENING-PLAN.md)** — AKs **nicht abschwächen** |
| Ist-Kontrollen                | [SECURITY-OVERVIEW.md](SECURITY-OVERVIEW.md)                                             |

Der Plan konsolidiert Audit, UX-Follow-up und Hörsaal-/NAT-Nachtrag. **Dieses Handoff ersetzt den Plan nicht** — bei Konflikt gilt der Plan.

---

## 2. PR- und Branch-Status

| Item                                                                   | Status                                                                                       |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| W3.5 **[#150](https://github.com/kqc-real/arsnova.eu/pull/150)**       | **gemergt** — Astro 7.1.3, `astro check`, Landing-Smokes; Story 0.9 fertig                   |
| W3.6 **[#151](https://github.com/kqc-real/arsnova.eu/pull/151)**       | **gemergt** — verschlüsselte externe Backups und Restore-Nachweis                            |
| W3.7 **[#154](https://github.com/kqc-real/arsnova.eu/pull/154)**       | **gemergt** — Monitoring-Poller und Admin-Tab; operative Webhook-/Timer-Abnahme bleibt offen |
| Policy **[#160](https://github.com/kqc-real/arsnova.eu/pull/160)**     | **gemergt** — koordinierte Dependabot-Major-Policy                                           |
| Telemetrie **[#161](https://github.com/kqc-real/arsnova.eu/pull/161)** | **gemergt** — Trennung expliziter Codeeingaben von Poll-/Reconnect-Ursprüngen                |
| Blitzlicht **[#164](https://github.com/kqc-real/arsnova.eu/pull/164)** | **gemergt** — Standalone-Auflösung, Tombstone-TTL und Abbruch bei `NOT_FOUND`                |
| Dauerlast **[#165](https://github.com/kqc-real/arsnova.eu/pull/165)**  | **offen, lokal validiert** — manueller 10-Minuten-Demo-Classroom-Lauf; nach Merge verfügbar  |

Die technische Implementierung ist kein Ersatz für die noch ausstehenden Operatornachweise.

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

W3.7 auf dem Produktionshost operativ abnehmen und anschließend den
operatorgesteuerten S6.5-Zielhostlauf durchführen. PR #165 ist dafür ein
zusätzlicher lokaler Dauerlastnachweis, aber weder gemergt noch die formale
S6.5-Abnahme.

Verbindliche Abläufe:

- [W3.7-Monitoring-Abnahme](implementation/W3.7-MONITORING-ALARMS-ABNAHME.md)
- [Monitoring-Runbook](operations/MONITORING-RUNBOOK.md)
- [S6.5-Security-/Lasttest-Abnahme](implementation/S6.5-SECURITY-LOAD-ACCEPTANCE.md)
- [Performance-Inventar](PERFORMANCE-TESTING.md)

Akzeptanzkriterien und Lasttest-AKs: **nur** Plan (§6, §6.5,
Übergreifende AKs) — nicht abschwächen.

---

## 6. Verwandte Docs & Stories

| Thema               | Link                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| Härtungsplan (SoT)  | [SECURITY-HARDENING-PLAN.md](SECURITY-HARDENING-PLAN.md)                                       |
| Ist-Sicherheit      | [SECURITY-OVERVIEW.md](SECURITY-OVERVIEW.md)                                                   |
| Sync-Sicherheit     | Backlog **Story 1.6c**; [architecture/quiz-library-sync.md](architecture/quiz-library-sync.md) |
| Landing XSS / Astro | Backlog **Story 0.9** (fertig; Astro 7.1.3 über W3.5 / PR #150)                                |
| Security-Deps       | PR [#121](https://github.com/kqc-real/arsnova.eu/pull/121) (gemerged)                          |
| Plan-PR             | PR [#124](https://github.com/kqc-real/arsnova.eu/pull/124)                                     |
| Env / Trust-Proxy   | [ENVIRONMENT.md](ENVIRONMENT.md)                                                               |
| Deploy / Nginx      | [deployment-debian-root-server.md](deployment-debian-root-server.md)                           |
| Last / 500 TN       | [implementation/LASTTEST-500-TEILNEHMENDE.md](implementation/LASTTEST-500-TEILNEHMENDE.md)     |
| Agent-Regeln        | Root `AGENT.md`, `.cursorrules`, `mem:core`                                                    |

---

## 7. Checkliste für den neuen Chat

- [ ] Plan, W3.7-Abnahme und Monitoring-Runbook gelesen
- [ ] Synthetischen W3.7-Testalarm im vorgesehenen On-Call-Kanal empfangen
- [ ] Gesunden One-shot, drei Timerläufe und ggf. Dead-Man-Recovery belegen
- [ ] S6.5-Zielhostlauf mit echten Reports und Operatorfreigabe durchführen
- [ ] PR #165 bis zum Merge nur als „offen, lokal validiert“ behandeln
- [ ] Classroom-NAT nicht durch enge IP-Limits brechen

---

## 8. Paste-Start (für neuen Chat)

Siehe Block unten in der Agent-Antwort bzw. Kurzform:

> Lies `docs/SECURITY-HARDENING-HANDOFF.md`, `docs/SECURITY-HARDENING-PLAN.md`, das Monitoring-Runbook und die S6.5-Abnahme. Führe W3.7 operativ und S6.5 formal ab; AKs nicht abschwächen und Hörsaal-NAT beachten.

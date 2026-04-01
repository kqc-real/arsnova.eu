# Greenfield-Vorlesung: Story 1.7a (Markdown-Bilder, URL + Lightbox)

**Zielgruppe:** Lehrende (Fallstudie Software Engineering)  
**Umfang:** **3 × 45 Minuten** = **135 Minuten** Gesamtzeit (eine Unterrichtseinheit pro Block; Pausen extra).  
**Zielbild:** Studierende sehen **live**, wie mit **KI-Agenten** ein **abgegrenztes** Product-Feature aus dem [`Backlog.md`](../../Backlog.md) von Spezifikation bis lauffähigem UI umgesetzt wird — im **echten** Monorepo (`@arsnova/shared-types` wo nötig, Angular, ADR-0015, ADR-0008).

**Story:** [`Backlog.md` — Story 1.7a](../../Backlog.md) (Abschnitt Epic 1).  
**Architektur:** [ADR-0015: Markdown-Bilder, nur URL + Lightbox](../architecture/decisions/0015-markdown-images-url-only-and-lightbox.md).

**Abgrenzung Studierende:** Story **1.7a** ist für Studierende im Praktikum **kein** Pflicht-Ticket mehr, solange die Lehrperson sie in der Vorlesung als Greenfield durchzieht — siehe [`docs/praktikum/STUDENT-STORY-REIHENFOLGE.md`](../praktikum/STUDENT-STORY-REIHENFOLGE.md) Abschnitt 0.

---

## Leitlinien für die Zeitschiene (realistisch)

- **Vollständige Erfüllung** aller Akzeptanzkriterien in 135 Minuten ist **ambitioniert**; planbar ist ein **vertikaler Kern**: HTTPS-only Bilder, Lightbox, **mindestens zwei** Markdown-Kontexte, **Start** i18n für Dialog-Strings.
- **Rest** (alle Views, alle Sprachen, A11y-Feinschliff, Specs): **Hausaufgabe der Lehrperson** bis zur nächsten Sitzung oder explizit **nicht** Teil der Demo — transparent kommunizieren.
- **Branch:** Von Anfang an in einem **Feature-Branch** arbeiten; nach der Demo: PR, CI, Merge mit Betreuung — Vorbild für Studierende.

---

## Block 1 — 45 Min.: Vertrag, Pipeline, Sicherheit

| Minute (ca.) | Inhalt                                                                                                                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–10         | **Backlog:** Story 1.7a Akzeptanzkriterien gemeinsam lesen; „Was ist am Ende anders für Nutzer:innen?“                                                                                                      |
| 10–20        | **ADR-0015** (oder Entwurf): nur HTTPS, kein `data:`/`javascript:` für Bilder; Policy in einem Satz.                                                                                                        |
| 20–35        | **Codebasis:** Markdown-Rendering finden (z. B. `markdown-katex.util.ts`, Sanitize); **KI** zeigen: „Wo hängen Bilder im HTML?“ — **Diff** lesen, nicht blind übernehmen.                                   |
| 35–45        | Erste **Implementierung:** Renderer so anpassen, dass unsichere Bild-URLs **nicht** als `<img src>` enden bzw. `https` erzwungen wird — **sichtbares** Ergebnis im Browser (auch wenn Lightbox noch fehlt). |

**Mini-Input (optional eingebettet):** VS Code (Suche im Repo, Terminal `npm run dev`).

---

## Block 2 — 45 Min.: Lightbox-Komponente, erste Einbindung

| Minute (ca.) | Inhalt                                                                                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–10         | **Angular:** Standalone-Komponente oder Dialog (Material): Overlay, Bild zentriert, Schließen-Button.                                                          |
| 10–30        | **Event-Flow:** Klick/Tap auf `<img>` in **einer** Markdown-Ansicht (z. B. Quiz-Edit-Preview **oder** Session-Vote) öffnet Lightbox; **Signals** für UI-State. |
| 30–40        | **prefers-reduced-motion** / keine aufdringliche Animation (Kurzcheck).                                                                                        |
| 40–45        | **Demo:** Live-Frage mit `![…](https://…)` — Lightbox funktioniert.                                                                                            |

**Mini-Input:** Git (Status, Branch, Commit „feat: lightbox skeleton“).

---

## Block 3 — 45 Min.: Weitere Kontexte, i18n, Qualität

| Minute (ca.) | Inhalt                                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–15         | **Weitere Views:** Weitere **mindestens eine** der Pflicht-Ansichten aus dem Backlog anbinden (Vote, Present, Host — je nachdem was in Block 2 noch fehlt).                     |
| 15–30        | **i18n:** Schließen-Label und ggf. Dialog-Titel mit `$localize` / `@@…` — **alle fünf** XLF-Dateien anfassen oder „ein String als Muster + Rest als Hausaufgabe“ kommunizieren. |
| 20–35        | **A11y kurz:** Fokus ins Modal, Escape schließt, `aria-modal` (was der Backlog verlangt).                                                                                       |
| 35–45        | **Tests:** mindestens **ein** sinnvoller Unit-Test (Renderer oder Komponente); **CI** grün — oder als offenes Ziel für die nächste Woche.                                       |

**Mini-Input:** Monorepo (`libs/shared-types` nur wenn für die Story nötig; bei reinem Frontend ggf. entfallen).

---

## Nach der Vorlesung

- **MOTD / Epic 10** bleibt optional **zweites** Referenzbeispiel (fertiger Code: `motd`-Router, Admin) — siehe [`docs/features/motd.md`](../features/motd.md); **nicht** Ersatz für die 1.7a-Greenfield-Demo.
- **Studierende** starten mit **Ticket 1** in [`STUDENT-STORY-REIHENFOLGE.md`](../praktikum/STUDENT-STORY-REIHENFOLGE.md) (**5.4a**), nicht mit 1.7a.

---

**Stand:** 2026-04-01

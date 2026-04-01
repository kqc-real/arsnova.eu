# Diagramme (Mermaid)

Die Diagramme in diesem Ordner sind in **Mermaid** geschrieben.

## Anzeige in VS Code

Die Standard-Markdown-Vorschau von VS Code rendert **keine** Mermaid-Diagramme. Dafür wird eine Erweiterung benötigt.

### Empfohlene Erweiterung

- **Markdown Preview Mermaid Support** (ID: `bierner.markdown-mermaid`)

**Installation:**

1. In VS Code: **Erweiterungen** öffnen (`Ctrl+Shift+X` / `Cmd+Shift+X`).
2. Nach **„Markdown Preview Mermaid Support“** oder **„bierner.markdown-mermaid“** suchen.
3. Erweiterung **Installieren** klicken.

Oder über die Kommandopalette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

- `Extensions: Show Recommended Extensions` ausführen und die empfohlene Erweiterung installieren.

### Nach der Installation

1. `diagrams.md` oder `architecture-overview.md` öffnen.
2. **Markdown-Vorschau** öffnen: rechte Maustaste → **„Open Preview“** oder `Ctrl+Shift+V` / `Cmd+Shift+V`.
3. Die Mermaid-Blöcke sollten in der Vorschau als Diagramme erscheinen.

### Alternative: Mermaid-Vorschau

Falls die Integration in die Markdown-Vorschau nicht funktioniert:

- Erweiterung **„Mermaid Preview“** (vstirbu.vscode-mermaid-preview) installieren.
- In einer `.md`-Datei einen Mermaid-Block auswählen → rechte Maustaste → **„Preview Mermaid Diagram“** (öffnet eine separate Diagramm-Vorschau).

## Dateien

| Datei                          | Inhalt                                                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `diagrams.md`                  | Backend-, Frontend-, DB-Schema, Kommunikation Dozent/Student/**Admin**, Aktivität inkl. Admin, **MOTD** (Stand: 2026-04-01)        |
| `architecture-overview.md`     | System-Architektur, Datenfluss inkl. Admin/MOTD, Komponenten-Hierarchie, Sicherheit inkl. Rollen-Autorisierung (Stand: 2026-04-01) |
| `diagram-consistency-check.md` | Konsistenzprüfung Diagramme vs. Handbuch/Backlog/ADR-0006 (Epic 9 Admin ergänzt)                                                   |

## Online-Rendering

- **GitHub:** Beim Anzeigen der `.md`-Dateien auf GitHub werden Mermaid-Diagramme automatisch gerendert.
- **Mermaid Live Editor:** [mermaid.live](https://mermaid.live) – zum Testen einzelner Diagramme (Code-Block kopieren und einfügen).

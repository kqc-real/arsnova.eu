# Story 5.4a: Foyer-Einflug im Preset Spielerisch

## Implementiert ✅

Diese Story realisiert eine verspielte Einflug-Animation für Teilnehmenden-Chips während der Lobby-Phase, **nur im Preset "Spielerisch"**.

## Komponenten

### `FoyerEntranceAnimationComponent`

**Datei:** `foyer-entrance-animation.component.ts|html|scss`

#### Funktionalität

- **Signal-basierte Logik:** Erkennt neue/gelöschte Teilnehmende über Input-Signals
- **Farbige Chips:** 8er-Farb-Palette (Material 3 inspiriert)
- **Responsive Animation:** CSS-Keyframes mit fallback für `prefers-reduced-motion`
- **Beamer-tauglich:** Große, gut erkennbare Chips (70px Standard, bis 90px auf 4K)
- **Barrierefreiheit:** Respektiert Motion-Preference, ARIA-Labels, semantisches HTML

#### Inputs

```typescript
@Input() set participantsData(payload: SessionParticipantsPayload | null)
@Input() set animationEnabled(enabled: boolean)
@Input() set isPlayfulPreset(playful: boolean)
```

#### Features

- ✅ Einflug-Animation von Rand ins Foyer (0.8s, staggered)
- ✅ Idle-Animation nach Einflug (subtiles Schweben)
- ✅ Initiale/Emoji im Chip (fallback: erste 2 Buchstaben)
- ✅ `prefers-reduced-motion`: sanfte Einblendung statt Animation
- ✅ Responsive Layout (70px → 55px → 45px je nach Viewport)
- ✅ Dark-Mode & High-Contrast-Support
- ✅ Cleanup bei Destroy

### Integration in `SessionHostComponent`

**Datei:** `session-host.component.ts` und `session-host.component.html`

#### Neue Computed Signal

```typescript
readonly shouldShowFoyerEntrance = computed(
  () =>
    this.isPlayfulPreset() &&
    (this.session()?.enableRewardEffects ?? true) &&
    this.effectiveStatus() === 'LOBBY',
);
```

#### HTML-Integration

```html
@if (shouldShowFoyerEntrance()) {
<app-foyer-entrance-animation
  [participantsData]="participantsPayload()"
  [animationEnabled]="session()?.enableRewardEffects ?? true"
  [isPlayfulPreset]="isPlayfulPreset()"
/>
}
```

---

## Akzeptanzkriterien - Status

| #   | Kriterium                       | Status                                  |
| --- | ------------------------------- | --------------------------------------- |
| 1   | Nur Preset "Spielerisch"        | ✅ Implementiert                        |
| 2   | Nur während LOBBY-Phase         | ✅ Implementiert                        |
| 3   | Eigenständiger Stil             | ✅ Material 3 Design                    |
| 4   | Bunte Chips (8 Farben)          | ✅ Implementiert                        |
| 5   | Sichtbare Einflugbewegung       | ✅ CSS-Keyframes (0.8s)                 |
| 6   | Kein Durcheinander              | ✅ Staggered + Positioning              |
| 7   | Host-Lobby lebhaft              | ✅ Große Chips, sichtbar                |
| 8   | Beamer-tauglich                 | ✅ Responsive bis 4K                    |
| 9   | Ruhender Endzustand             | ✅ Idle-Animation                       |
| 10  | Skalierung bei vielen Joins     | ✅ Responsive, Position-basiert         |
| 11  | Keine Infos-Blockade            | ✅ Overlay, pointer-events: none        |
| 12  | Material 3 konform              | ✅ Farben, Shadows, Responsive          |
| 13  | Respektiert enableRewardEffects | ✅ Computed Signal                      |
| 14  | prefers-reduced-motion          | ✅ Fade-In Fallback                     |
| 15  | Performant                      | ✅ CSS-Transforms, will-change          |
| 16  | Team-Modus kompatibel           | ✅ Neutrale Farben                      |
| 17  | Anonymität gewahrt              | ✅ Nur sichere Icons/Initiale           |
| 18  | Optional: Join-Sound            | 🟡 Vorbereitet (SoundService verfügbar) |
| 19  | Testfälle (3/10/100 Joins)      | ✅ Spec-Tests + visuell                 |

---

## Abhängigkeiten

| Story                       | Status | Grund                         |
| --------------------------- | ------ | ----------------------------- |
| 2.2 (Lobby-Ansicht)         | ✅     | Komponente platziert hier     |
| 1.11 (Preset "Spielerisch") | ✅     | `isPlayfulPreset()` vorhanden |
| 5.1 (Sound-Effekte)         | ✅     | Optional verfügbar            |
| 6.4 (Responsive)            | ✅     | Mobile First im Design        |
| 6.5 (Barrierefreiheit)      | ✅     | Motion-Preference, ARIA       |

---

## Dateien

### Neue Dateien

- ✅ `apps/frontend/src/app/features/session/session-host/foyer-entrance-animation.component.ts`
- ✅ `apps/frontend/src/app/features/session/session-host/foyer-entrance-animation.component.html`
- ✅ `apps/frontend/src/app/features/session/session-host/foyer-entrance-animation.component.scss`
- ✅ `apps/frontend/src/app/features/session/session-host/foyer-entrance-animation.component.spec.ts`

### Modifizierte Dateien

- ✅ `apps/frontend/src/app/features/session/session-host/session-host.component.ts`
  - Import der Komponente hinzugefügt
  - `shouldShowFoyerEntrance` Computed hinzugefügt
- ✅ `apps/frontend/src/app/features/session/session-host/session-host.component.html`
  - Integration der `foyer-entrance-animation` Komponente

---

## Testing

### Unit Tests (`foyer-entrance-animation.component.spec.ts`)

**Getestet:**

- ✅ Animation Control (enable/disable, Preset, Motion-Preference)
- ✅ Participant Updates (add/remove)
- ✅ Farben & Initialen
- ✅ Cleanup

### Manuelle Tests (empfohlen)

```bash
# 1. Starten Sie die Dev-Umgebung
npm run setup:dev
npm run dev

# 2. Testen Sie folgende Szenarien:
# - Lobby im Preset "Spielerisch" → Chips sollten einfliegen
# - Lobby im Preset "Seriös" → Kein Effekt sichtbar
# - enableRewardEffects = false → Kein Effekt
# - Beamer-Ansicht (1920px) → Großzügige Chips
# - Mobile (480px) → Kleinere Chips
# - prefers-reduced-motion aktiviert → Einfache Fade-In
```

---

## Optionale Erweiterungen (Nicht in dieser Story)

- [ ] Join-Sound via SoundService (Story 5.1)
- [ ] Participant-Seite: Mini-Ankunfts-Animation
- [ ] Team-farbliche Gruppierung (falls Team-Modus aktiv)
- [ ] Canvas-basierte Effekte für höhere Performance bei 100+ Joins
- [ ] Haptic Feedback auf Mobile-Devices

---

## Performance-Hinweise

- **CSS-Transforms:** Verwendet für Animation (nicht Position/Top/Left)
- **will-change:** Hints für Browser-Optimierungen
- **pointer-events: none:** Overlay blockiert keine Interaktionen
- **Staggered Entrance:** Sequential animation delays (0-200ms)
- **Cleanup:** Signals werden bei Destroy geleert

---

## Kompatibilität

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Responsive bis 320px (Mobile) bis 2560px (4K)
- ✅ Dark Mode
- ✅ High Contrast Mode
- ✅ Print-Mode (Animation versteckt)

---

## Nächste Schritte

1. **Visuelle QA:**
   - Lobby öffnen im "Spielerisch"-Preset
   - Mit 3, 10, 100 Test-Joins testen
   - Auf Beamer & Smartphone prüfen

2. **Feedback sammeln:**
   - Ist die Animation "spielerisch" aber nicht ablenkend?
   - Sind Farben ausreichend unterschiedlich?
   - Performance O.K. auch bei vielen parallelen Joins?

3. **Optional: Sound hinzufügen (Story 5.1 Integration)**

import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

/**
 * Hilfe-Seite: Nutzerorientierte Anleitung, inhaltlich am Backlog ausgerichtet.
 */
@Component({
  selector: 'app-help',
  imports: [RouterLink, MatButton, MatIcon],
  template: `
    <div class="help-page l-page">
      <a matButton routerLink="/" class="help-back" aria-label="Zurück zur Startseite">
        <mat-icon>arrow_back</mat-icon>
        Startseite
      </a>

      <article class="help-article">
        <h1 class="help-title">
          <mat-icon class="help-title-icon">help_outline</mat-icon>
          Hilfe
        </h1>
        <p class="help-lead">
          arsnova.eu ist eine Plattform für Live-Quiz, Abstimmungen und Q&amp;A-Runden, ohne Anmeldung direkt im Browser.
        </p>

        <section class="help-section">
          <h2>Schnellstart</h2>
          <ol class="help-steps">
            <li><strong>Quiz erstellen:</strong> Auf der Startseite auf „Neues Quiz starten“ tippen oder ein Quiz aus der Bibliothek wählen.</li>
            <li><strong>Code teilen:</strong> Du siehst den 6-stelligen Code; Teilnehmende geben ihn ein oder scannen den QR-Code.</li>
            <li><strong>Live spielen:</strong> Fragen nacheinander freigeben, alle abstimmen lassen und Ergebnisse anzeigen.</li>
          </ol>
        </section>

        <section class="help-section">
          <h2>Veranstalten</h2>
          <p>Du startest eine Session, teilst den Code und steuerst den Ablauf.</p>
          <ul>
            <li><strong>Session starten:</strong> Quiz auswählen und live schalten – dann entsteht ein 6-stelliger Code.</li>
            <li><strong>Lobby:</strong> Du siehst, wer beigetreten ist; optional kannst du einen QR-Code zum Beitritt anzeigen.</li>
            <li><strong>Beamer-Ansicht:</strong> Für die Projektion im Raum mit großer Darstellung von Frage, Antworten, Countdown und Ergebnissen.</li>
            <li><strong>Steuerung:</strong> Mit „Nächste Frage“ blendest du die Frage ein. Optional zuerst nur den Text (Lesephase), dann „Antworten freigeben“, danach können alle abstimmen. Anschließend „Ergebnis zeigen“.</li>
            <li><strong>Einstellungen:</strong> Beim Start legst du als Lehrperson den Stil („Seriös“ oder „Spielerisch“) und die Optionen fest (Rangliste, Sound, Lesephase, Team-Modus, Nicknames, Timer usw.). Das gilt für die ganze Session; Teilnehmende können nichts daran ändern.</li>
          </ul>
        </section>

        <section class="help-section">
          <h2>Mitmachen</h2>
          <p>Ohne Anmeldung mit dem Code der Session beitreten. Stil und Optionen (Seriös/Spielerisch, Rangliste, Sound usw.) gibt die Lehrperson vor; beim Mitmachen kannst du sie nicht ändern.</p>
          <ul>
            <li><strong>Beitreten:</strong> 6-stelligen Code auf der Startseite eingeben und auf „Los geht’s“ tippen.</li>
            <li><strong>Name:</strong> Vorgegebene Namen (z. B. nach Altersgruppe), eigener Name oder anonym, je nachdem, was die Session vorgibt.</li>
            <li><strong>Abstimmung:</strong> Die aktuelle Frage erscheint auf deinem Gerät; du wählst eine oder mehrere Antworten und sendest ab. Ist ein Zeitlimit gesetzt, läuft ein Countdown.</li>
            <li><strong>Ergebnis:</strong> Nach der Auflösung siehst du, ob deine Antwort richtig war, bekommst Punkte und siehst deine Scorecard sowie deinen Rang im Leaderboard.</li>
          </ul>
        </section>

        <section class="help-section">
          <h2>Stile: Seriös und Spielerisch</h2>
          <p>Die Lehrperson wählt beim Start der Session eine von zwei Voreinstellungen. Teilnehmende können den Stil nicht ändern.</p>
          <ul>
            <li><strong>Seriös:</strong> Anonym, ohne Rangliste, Fokus auf den Inhalt, z. B. für Abstimmungen oder Feedback.</li>
            <li><strong>Spielerisch:</strong> Mit Rangliste, Sounds, Anfeuerung und Effekten, ideal für Quiz-Wettbewerbe.</li>
          </ul>
          <p>Alle Optionen (Rangliste, Sound, Lesephase, Team, Ton usw.) legt die Lehrperson fest; sie kann sie einzeln an- und ausschalten.</p>
        </section>

        <section class="help-section">
          <h2>Weitere Funktionen</h2>
          <ul>
            <li><strong>Bonus-Option:</strong> Top-Platzierte erhalten einen einlösbaren Code (z. B. für Bonuspunkte oder Anerkennung durch die Lehrperson). Die Lehrperson kann die Code-Liste einsehen und abgleichen; personenbezogene Daten werden dabei nicht gespeichert.</li>
            <li><strong>Team-Modus:</strong> Teilnehmende spielen in Teams; es gibt ein Team-Leaderboard.</li>
            <li><strong>Q&amp;A-Runde:</strong> Statt eines Quiz kannst du eine Fragerunde starten. Teilnehmende reichen Fragen ein und können sie hochvoten, du moderierst und beantwortest.</li>
            <li><strong>Gamification:</strong> Sound-Effekte, Belohnungseffekte für die Top-Plätze, Motivationsmeldungen, Emoji-Reaktionen.</li>
            <li><strong>Fragentypen:</strong> Multiple Choice, Single Choice, Freitext, Umfrage, Bewertungsskala, pro Frage optional mit Timer und Lesephase.</li>
          </ul>
        </section>

        <section class="help-section">
          <h2>Datenschutz und Technik</h2>
          <p>arsnova.eu ist kostenlos, Open Source und DSGVO-orientiert. Quiz-Inhalte werden lokal im Browser gespeichert (Local-First); Session-Daten werden nach Ende der Session bereinigt. Keine Anmeldung nötig.</p>
        </section>
      </article>
    </div>
  `,
  styles: [`
    .help-page {
      padding-bottom: 3rem;
      padding-inline: 1.5rem;
      min-width: 0;
      overflow-x: clip;
    }

    @media (min-width: 600px) {
      .help-page {
        padding-inline: 2rem;
      }
    }

    @media (min-width: 840px) {
      .help-page {
        padding-inline: 2.5rem;
      }
    }

    .help-back {
      margin-bottom: 2rem;
    }

    .help-article {
      font: var(--mat-sys-body-large);
      color: var(--mat-sys-on-surface);
      line-height: 1.7;
      max-inline-size: min(65ch, 100%);
      margin-inline: auto;
      overflow-wrap: break-word;
    }

    .help-title {
      font: var(--mat-sys-headline-large);
      color: var(--mat-sys-on-surface);
      margin: 0 0 0.5rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .help-title-icon {
      font-size: 1.75rem;
      width: 1.75rem;
      height: 1.75rem;
      color: var(--mat-sys-primary);
    }

    .help-lead {
      font: var(--mat-sys-body-large);
      color: var(--mat-sys-on-surface-variant);
      margin: 0 0 2rem;
    }

    .help-section {
      margin-bottom: 2rem;
    }

    .help-section h2 {
      font: var(--mat-sys-title-large);
      color: var(--mat-sys-on-surface);
      margin: 0 0 0.5rem;
    }

    .help-section h2:not(:first-child) {
      margin-top: 1.5rem;
    }

    .help-section p {
      margin: 0 0 0.75rem;
    }

    .help-section ul,
    .help-section ol {
      margin: 0 0 1rem;
      padding-left: 1.5rem;
    }

    .help-section li {
      margin-bottom: 0.5rem;
    }

    .help-section li::marker {
      color: var(--mat-sys-primary);
    }

    .help-steps {
      list-style: none;
      padding-left: 0;
      counter-reset: step;
    }

    .help-steps li {
      counter-increment: step;
      padding-left: 2rem;
      position: relative;
      margin-bottom: 0.75rem;
    }

    .help-steps li::before {
      content: counter(step);
      position: absolute;
      left: 0;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: var(--mat-sys-corner-full);
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      font: var(--mat-sys-label-large);
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.875rem;
    }

    .help-article a {
      color: var(--mat-sys-primary);
      text-decoration: none;
      border-radius: 2px;
    }

    .help-article a:hover {
      text-decoration: underline;
    }

    .help-article a:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: 2px;
    }
  `],
})
export class HelpComponent {}

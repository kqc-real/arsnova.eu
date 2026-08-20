import { describe, expect, it } from 'vitest';
import { localizeQaSummaryChromeLimitation } from './qa-summary-chrome-copy';

const CHROME_LIMITATIONS = [
  'Es gibt noch zu wenige sichtbare Fragen für eine Zusammenfassung.',
  'Es liegen keine Q&A-Quellen vor.',
  'Die Zusammenfassung hat zu lange gedauert.',
  'Die Zusammenfassung ist gerade nicht verfügbar.',
  'Die Zusammenfassung ist unsicher.',
  'Kein privater Inferenzserver konfiguriert.',
  'Öffentliche SaaS-LLM-Endpunkte sind nicht zulässig.',
  'Die Zusammenfassungsanfrage war ungültig.',
  'Die Modellantwort war zu groß.',
  'Die Modellantwort war ungültig.',
  'Aussagen ohne belegte Quelle wurden entfernt.',
  'Nur sichtbare Q&A-Fragen, keine Teilnehmendenbewertung.',
  'Modell nicht rechtzeitig; lokale Kurzfassung.',
  'Lokale Kurzfassung.',
  'Gemini hat zu lange gedauert.',
  'Gemini ist gerade nicht erreichbar.',
  'Gemini lieferte keinen Text.',
  'Gemini lieferte kein JSON-Objekt.',
  'Gemini lieferte keine gültige JSON-Antwort.',
  'GEMINI_API_KEY fehlt für den Gemini-Modus.',
  'Gemini hat den API-Key abgelehnt.',
  'Gemini ist überlastet (Rate-Limit).',
  'Gemini hat die Anfrage abgelehnt.',
] as const;

describe('localizeQaSummaryChromeLimitation', () => {
  it('lässt Modelltext unverändert', () => {
    expect(localizeQaSummaryChromeLimitation('Median: Formel und Berechnung sind unklar.')).toBe(
      'Median: Formel und Berechnung sind unklar.',
    );
  });

  it('hält bekannte Chrome-Hinweise als lokalisierten Text', () => {
    for (const text of CHROME_LIMITATIONS) {
      expect(localizeQaSummaryChromeLimitation(text).length).toBeGreaterThan(0);
      expect(localizeQaSummaryChromeLimitation(` ${text} `)).toBe(
        localizeQaSummaryChromeLimitation(text),
      );
    }
    expect(
      localizeQaSummaryChromeLimitation('Gemini-Modell nicht verfügbar. Aktuell: gemini-test.'),
    ).toBe('Gemini-Modell nicht verfügbar.');
  });
});

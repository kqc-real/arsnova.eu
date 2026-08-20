/** Canonical German chrome strings from the 8.9c summary backend/helper. */

export function localizeQaSummaryChromeLimitation(text: string): string {
  switch (text.trim()) {
    case 'Es gibt noch zu wenige sichtbare Fragen für eine Zusammenfassung.':
      return $localize`:@@sessionHost.moderationSummaryEmptySnapshot:Es gibt noch zu wenige sichtbare Fragen für eine Zusammenfassung.`;
    case 'Es liegen keine Q&A-Quellen vor.':
      return $localize`:@@sessionHost.moderationSummaryNoSources:Es liegen keine Q&A-Quellen vor.`;
    case 'Die Zusammenfassung hat zu lange gedauert.':
      return $localize`:@@sessionHost.moderationSummaryTimeout:Die Zusammenfassung hat zu lange gedauert.`;
    case 'Die Zusammenfassung ist gerade nicht verfügbar.':
      return $localize`:@@sessionHost.moderationSummaryFailed:Die Zusammenfassung ist gerade nicht verfügbar.`;
    case 'Die Zusammenfassung ist unsicher.':
      return $localize`:@@sessionHost.moderationSummaryUncertain:Die Zusammenfassung ist unsicher.`;
    case 'Kein privater Inferenzserver konfiguriert.':
      return $localize`:@@sessionHost.moderationSummaryUnconfigured:Kein privater Inferenzserver konfiguriert.`;
    case 'Öffentliche SaaS-LLM-Endpunkte sind nicht zulässig.':
      return $localize`:@@sessionHost.moderationSummarySaasBlocked:Öffentliche SaaS-LLM-Endpunkte sind nicht zulässig.`;
    case 'Die Zusammenfassungsanfrage war ungültig.':
      return $localize`:@@sessionHost.moderationSummaryInvalidRequest:Die Zusammenfassungsanfrage war ungültig.`;
    case 'Die Modellantwort war zu groß.':
      return $localize`:@@sessionHost.moderationSummaryModelTooLarge:Die Modellantwort war zu groß.`;
    case 'Die Modellantwort war ungültig.':
      return $localize`:@@sessionHost.moderationSummaryModelInvalid:Die Modellantwort war ungültig.`;
    case 'Aussagen ohne belegte Quelle wurden entfernt.':
      return $localize`:@@sessionHost.moderationSummaryDroppedUnsourced:Aussagen ohne belegte Quelle wurden entfernt.`;
    case 'Nur sichtbare Q&A-Fragen, keine Teilnehmendenbewertung.':
      return $localize`:@@sessionHost.moderationSummaryVisibleOnly:Nur sichtbare Q&A-Fragen, keine Teilnehmendenbewertung.`;
    case 'Modell nicht rechtzeitig; lokale Kurzfassung.':
      return $localize`:@@sessionHost.moderationSummaryExtractiveTimeout:Modell nicht rechtzeitig; lokale Kurzfassung.`;
    case 'Lokale Kurzfassung.':
      return $localize`:@@sessionHost.moderationSummaryExtractiveFallback:Lokale Kurzfassung.`;
    case 'Gemini hat zu lange gedauert.':
      return $localize`:@@sessionHost.moderationSummaryGeminiTimeout:Gemini hat zu lange gedauert.`;
    case 'Gemini ist gerade nicht erreichbar.':
      return $localize`:@@sessionHost.moderationSummaryGeminiUnavailable:Gemini ist gerade nicht erreichbar.`;
    case 'Gemini lieferte keinen Text.':
      return $localize`:@@sessionHost.moderationSummaryGeminiEmpty:Gemini lieferte keinen Text.`;
    case 'Gemini lieferte kein JSON-Objekt.':
      return $localize`:@@sessionHost.moderationSummaryGeminiInvalid:Gemini lieferte kein JSON-Objekt.`;
    case 'Gemini lieferte keine gültige JSON-Antwort.':
      return $localize`:@@sessionHost.moderationSummaryGeminiInvalidJson:Gemini lieferte keine gültige JSON-Antwort.`;
    case 'GEMINI_API_KEY fehlt für den Gemini-Modus.':
      return $localize`:@@sessionHost.moderationSummaryGeminiKeyMissing:GEMINI_API_KEY fehlt für den Gemini-Modus.`;
    case 'Gemini hat den API-Key abgelehnt.':
      return $localize`:@@sessionHost.moderationSummaryGeminiKeyRejected:Gemini hat den API-Key abgelehnt.`;
    case 'Gemini ist überlastet (Rate-Limit).':
      return $localize`:@@sessionHost.moderationSummaryGeminiRateLimit:Gemini ist überlastet (Rate-Limit).`;
    case 'Gemini hat die Anfrage abgelehnt.':
      return $localize`:@@sessionHost.moderationSummaryGeminiRejected:Gemini hat die Anfrage abgelehnt.`;
    default:
      if (text.startsWith('Gemini-Modell nicht verfügbar.')) {
        return $localize`:@@sessionHost.moderationSummaryGeminiModelMissing:Gemini-Modell nicht verfügbar.`;
      }
      return text;
  }
}

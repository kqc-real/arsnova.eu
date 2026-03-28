/** Route → Title/Description für SEO (alle Strings @@-IDs für extract-i18n). */
export interface SeoRoutePayload {
  title: string;
  description: string;
  noindex?: boolean;
}

export function resolveSeoForPath(pathRest: string): SeoRoutePayload {
  const r = pathRest.replace(/\/+$/, '') || '/';

  if (r === '/' || r === '') {
    return { title: seoTitleHome(), description: seoDescHome() };
  }
  if (r === '/quiz') {
    return { title: seoTitleQuizList(), description: seoDescQuizList() };
  }
  if (r === '/quiz/new') {
    return { title: seoTitleQuizNew(), description: seoDescQuizNew() };
  }
  if (/^\/quiz\/sync\//.test(r)) {
    return { title: seoTitleQuizSync(), description: seoDescQuizSync() };
  }
  if (/^\/quiz\/[^/]+\/preview$/.test(r)) {
    return { title: seoTitleQuizPreview(), description: seoDescQuizPreview() };
  }
  if (/^\/quiz\/[^/]+$/.test(r)) {
    return { title: seoTitleQuizEdit(), description: seoDescQuizEdit() };
  }
  if (r === '/help') {
    return { title: seoTitleHelp(), description: seoDescHelp() };
  }
  if (r === '/legal/imprint') {
    return { title: seoTitleImprint(), description: seoDescImprint() };
  }
  if (r === '/legal/privacy') {
    return { title: seoTitlePrivacy(), description: seoDescPrivacy() };
  }
  if (/^\/join\//.test(r)) {
    return { title: seoTitleJoin(), description: seoDescJoin() };
  }
  if (/^\/session\//.test(r)) {
    return { title: seoTitleSession(), description: seoDescSession() };
  }
  if (/^\/feedback\/[^/]+\/vote$/.test(r)) {
    return { title: seoTitleFeedbackVote(), description: seoDescFeedbackVote() };
  }
  if (/^\/feedback\//.test(r)) {
    return { title: seoTitleFeedbackHost(), description: seoDescFeedbackHost() };
  }
  if (r === '/admin') {
    return {
      title: seoTitleAdmin(),
      description: seoDescAdmin(),
      noindex: true,
    };
  }

  return { title: seoTitleHome(), description: seoDescHome() };
}

function seoTitleHome(): string {
  return $localize`:@@seo.titleHome:arsnova.eu | Die europäische Alternative zu Mentimeter & Kahoot`;
}

function seoDescHome(): string {
  return $localize`:@@seo.descHome:Interaktive Sessions, Quiz & Feedback – Made in Europe. Seit 2012 die DSGVO-konforme Lösung für Schule, Uni & Business. Jetzt arsnova.eu entdecken!`;
}

function seoTitleQuizList(): string {
  return $localize`:@@seo.titleQuizList:Meine Quizzes – arsnova.eu`;
}

function seoDescQuizList(): string {
  return $localize`:@@seo.descQuizList:Quiz-Sammlung anlegen, bearbeiten und für Live-Sessions nutzen – lokal oder synchronisiert zwischen Geräten.`;
}

function seoTitleQuizNew(): string {
  return $localize`:@@seo.titleQuizNew:Neues Quiz – arsnova.eu`;
}

function seoDescQuizNew(): string {
  return $localize`:@@seo.descQuizNew:Ein neues Quiz erstellen: Fragen, Antworten und Einstellungen für eure nächste Live-Session.`;
}

function seoTitleQuizEdit(): string {
  return $localize`:@@seo.titleQuizEdit:Quiz bearbeiten – arsnova.eu`;
}

function seoDescQuizEdit(): string {
  return $localize`:@@seo.descQuizEdit:Fragen und Metadaten eines Quizzes bearbeiten, Vorschau und Upload für die Session vorbereiten.`;
}

function seoTitleQuizPreview(): string {
  return $localize`:@@seo.titleQuizPreview:Quiz-Vorschau – arsnova.eu`;
}

function seoDescQuizPreview(): string {
  return $localize`:@@seo.descQuizPreview:Quiz so ansehen, wie Teilnehmende es in der Session sehen – vor dem Start testen.`;
}

function seoTitleQuizSync(): string {
  return $localize`:@@seo.titleQuizSync:Quiz-Bibliothek teilen – arsnova.eu`;
}

function seoDescQuizSync(): string {
  return $localize`:@@seo.descQuizSync:Bibliothek zwischen Geräten synchronisieren – gemeinsame Sync-ID und geteilter Zugriff.`;
}

function seoTitleHelp(): string {
  return $localize`:@@seo.titleHelp:Hilfe & Anleitung – arsnova.eu`;
}

function seoDescHelp(): string {
  return $localize`:@@seo.descHelp:Kurze Anleitungen zu Sessions, Quiz, Blitzlicht und den wichtigsten Abläufen auf arsnova.eu.`;
}

function seoTitleImprint(): string {
  return $localize`:@@seo.titleImprint:Impressum – arsnova.eu`;
}

function seoDescImprint(): string {
  return $localize`:@@seo.descImprint:Impressum und Anbieterkennzeichnung gemäß den gesetzlichen Pflichtangaben.`;
}

function seoTitlePrivacy(): string {
  return $localize`:@@seo.titlePrivacy:Datenschutz – arsnova.eu`;
}

function seoDescPrivacy(): string {
  return $localize`:@@seo.descPrivacy:Datenschutzerklärung: Verarbeitung personenbezogener Daten bei Nutzung von arsnova.eu.`;
}

function seoTitleJoin(): string {
  return $localize`:@@seo.titleJoin:Session beitreten – arsnova.eu`;
}

function seoDescJoin(): string {
  return $localize`:@@seo.descJoin:Mit Session-Code einer Live-Veranstaltung beitreten – Quiz, Q&A oder Blitzlicht.`;
}

function seoTitleSession(): string {
  return $localize`:@@seo.titleSession:Live-Session – arsnova.eu`;
}

function seoDescSession(): string {
  return $localize`:@@seo.descSession:Moderation oder Teilnahme an einer laufenden Session – Fragen, Abstimmung und Ergebnisse in Echtzeit.`;
}

function seoTitleFeedbackHost(): string {
  return $localize`:@@seo.titleFeedbackHost:Blitzlicht moderieren – arsnova.eu`;
}

function seoDescFeedbackHost(): string {
  return $localize`:@@seo.descFeedbackHost:Schnelle Rückmeldungen in der Veranstaltung einrichten und Ergebnisse live steuern.`;
}

function seoTitleFeedbackVote(): string {
  return $localize`:@@seo.titleFeedbackVote:Blitzlicht mitmachen – arsnova.eu`;
}

function seoDescFeedbackVote(): string {
  return $localize`:@@seo.descFeedbackVote:Kurz abstimmen oder Feedback geben – ohne Konto, datensparsam.`;
}

function seoTitleAdmin(): string {
  return $localize`:@@seo.titleAdmin:Administration – arsnova.eu`;
}

function seoDescAdmin(): string {
  return $localize`:@@seo.descAdmin:Interne Verwaltung (nur für Betreiber).`;
}

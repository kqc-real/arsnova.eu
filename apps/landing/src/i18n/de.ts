import type { Messages } from './types';

const de: Messages = {
  meta: {
    homeTitle: 'arsnova.eu | Live-Quiz, Schätzfragen und Q&A-Fragenwand',
    homeDescription:
      'Open-Source Audience Response für Bildung, Training und Organisationen: Live-Quiz, Selbsteinschätzung, Ergebnisbericht (PDF), numerische Schätzfragen, moderierbare Q&A-Fragenwand, Word Cloud und Feedback — barrierefrei nach WCAG 2.2 AA, kostenlos, self-hostbar und ohne Account startklar.',
    siteNameInfo: 'arsnova.eu – Informationen',
    ogLocale: 'de_DE',
  },
  nav: {
    ariaLabel: 'Hauptnavigation',
    workflow: 'Ablauf',
    estimate: 'Schätzfrage',
    qa: 'Q&A',
    qaMobile: 'Q&A-Fragenwand',
    features: 'Vorteile',
    accessibility: 'Barrierefreiheit',
    trust: 'Vertrauen',
    faq: 'FAQ',
    tryNow: 'Jetzt ausprobieren',
    menuOpen: 'Menü öffnen',
    menuClose: 'Menü schließen',
    menu: 'Menü',
    skipToContent: 'Zum Inhalt springen',
  },
  languageSwitcher: {
    label: 'Sprache',
    currentLanguage: 'Deutsch',
    chooseLanguage: 'Sprache wählen',
  },
  footer: {
    impressum: 'Impressum',
    privacy: 'Datenschutz',
    accessibility: 'Barrierefreiheit',
  },
  cta: {
    appOpen: 'App öffnen',
    quizCreate: 'Quiz erstellen',
    backToApp: 'Zurück zu arsnova.eu',
    tryLive: 'Jetzt live ausprobieren',
    howItWorks: 'So funktioniert’s',
    viewOpenSource: 'Open Source ansehen',
  },
  hero: {
    eyebrow: 'Audience Response für Bildung und Organisationen',
    titleLine1: 'Quizzen, schätzen,',
    titleLine2: 'Fragen moderieren',
    titleAccent1: 'live und kostenlos',
    titleAccent2: ' ohne Account.',
    lead: 'arsnova.eu bündelt Live-Quiz, numerische Schätzfragen, Selbsteinschätzung bei bewertbaren Fragen, Q&A-Fragenwand, Word-Cloud-Analyse und Blitzlicht-Feedback in einer Oberfläche für Schulen, Hochschulen, Weiterbildung, Workshops und Business. Open Source, self-hostbar und für DSGVO-orientierten Betrieb ausgelegt.',
    a11yLink: 'Barrierefrei nach WCAG 2.2 AA',
    a11ySuffix: '— Tastatur, Screenreader und individuell anpassbare Bearbeitungszeit.',
    cards: [
      { title: 'Sofort live', text: 'Session per Code oder QR teilen' },
      { title: 'Q&A mit Fragenwand', text: 'Moderation, Voting und Themen-Wortwolke' },
      {
        title: 'Selbsteinschätzung & Nachbereitung',
        text: 'Fehlkonzepte erkennen, Ergebnisbericht als PDF',
      },
      { title: 'Open Source & self-hostbar', text: 'Docker, Postgres, Redis und Admin-Audit' },
    ],
  },
  estimate: {
    eyebrow: 'Neu im Live-Quiz',
    title: 'Zahlen schätzen, diskutieren und die zweite Runde sichtbar vergleichen',
    lead: 'Die numerische Schätzfrage ist für Jahreszahlen, Größenordnungen, Messwerte und Wahrscheinlichkeiten gemacht. Lehrende legen Referenzwert, erlaubten Eingabebereich und Toleranz fest; Teilnehmende geben nur eine Zahl ab.',
    summary: [
      'Plausibilitätsband begrenzt erlaubte Eingaben.',
      'Toleranzband bewertet fachlich akzeptierte Schätzungen.',
      'Vor der Freigabe sieht niemand die Verteilung.',
      'Runde 1 und Runde 2 werden nach der Diskussion verglichen.',
    ],
    docsLink: 'Fachliche Doku zur Schätzfrage öffnen',
    demoAria: 'Beispielauswertung einer Schätzfrage zur Französischen Revolution',
    hostView: 'Host-Ansicht nach Freigabe',
    demoQuestion: 'Wann begann die Französische Revolution?',
    reference: 'Referenz 1789',
    toleranceBand: 'Toleranzband',
    toleranceValue: '1700 bis 1900',
    plausibilityBand: 'Plausibilitätsband',
    plausibilityValue: '1500 bis 2000',
    histogramNote:
      'Histogramm, Referenzlinie und Toleranzband erscheinen erst nach Ergebnisfreigabe. Vorher bleibt nur der neutrale Fortschritt sichtbar.',
    median: 'Median',
    inBand: 'im Band',
    round2: 'Runde 2',
    round2Value: '14 näher',
  },
  confidence: {
    eyebrow: 'Didaktische Auswertung',
    title: 'Richtig oder falsch — und wie sicher?',
    lead: 'Mit der Selbsteinschätzung erfassen Teilnehmende nach ihrer Antwort, wie sicher sie sind (1–5). Du erkennst nicht nur Trefferquote, sondern auch selbstsicher falsche Antworten — ein starker Hebel für formative Auswertung, gezielte Nachbesprechung und den Ergebnisbericht (PDF) nach Session-Ende.',
    summary: [
      'Kein eigener Fragetyp — optional an bewertbaren Quizfragen.',
      'Skala 1–5 nach der Antwort, ohne Einfluss auf Punkte.',
      'Host sieht nach Freigabe Korrektheit × Antwortsicherheit.',
      'Selbstsicher falsch markiert mögliche Fehlkonzepte.',
      'Nach Session-Ende: Ergebnisbericht (PDF) und Nachbesprechung.',
    ],
    docsConfidence: 'Doku Selbsteinschätzung',
    docsExport: 'Doku Ergebnisbericht (PDF)',
    demoAria: 'Beispielauswertung mit Selbsteinschätzung nach Ergebnisfreigabe',
    hostView: 'Host-Ansicht nach Freigabe',
    demoQuestion: 'Welche Struktur ist am stabilsten?',
    badge: 'Selbsteinschätzung',
    matrix: [
      { label: 'Richtig · niedrig', count: 3, tone: 'emerald' },
      { label: 'Richtig · mitte', count: 8, tone: 'emerald' },
      { label: 'Richtig · hoch', count: 11, tone: 'emerald' },
      { label: 'Falsch · niedrig', count: 2, tone: 'slate' },
      { label: 'Falsch · mitte', count: 4, tone: 'amber' },
      { label: 'Falsch · hoch', count: 2, tone: 'rose' },
    ],
    falseHighTitle: '2 selbstsicher falsche Antworten',
    falseHighText:
      'Option B wurde 2× mit hoher Antwortsicherheit gewählt — ein Signal für mögliche Fehlkonzepte in der Nachbesprechung.',
    consolidated: 'Gefestigt',
    misconceptionRisk: 'Fehlkonzept-Risiko',
    fragile: 'Fragil',
    afterSessionAria: 'Export nach Session-Ende',
    afterSession: 'Nach Session-Ende',
    debriefing: 'Nachbesprechung',
    resultsPdf: 'Ergebnisbericht (PDF)',
    exportNote:
      'Druckfertiger Bericht mit Lernstand, Heatmap und Fragentexten — in der Host-Ansicht und auf der Quizkarte. CSV für Excel bleibt unter „Mehr“ verfügbar.',
  },
  qaWall: {
    eyebrow: 'Live-Q&A als Moderationsfläche',
    title: 'Fragen sammeln, priorisieren und als Themenbild lesen',
    lead: 'Die Fragenwand ist kein Nebenchat. Sie ist ein eigener Live-Kanal für Lehrende und Vortragende: Beiträge moderieren, kollektive Prioritäten erkennen, kontroverse Punkte sichtbar machen und die wichtigsten Themen über eine gewichtete Q&A-Wortwolke in den Raum holen.',
    signals: [
      {
        label: 'Vorab-Moderation',
        text: 'Fragen erst freigeben, wenn sie in den didaktischen Moment passen.',
      },
      {
        label: 'Kollektives Voting',
        text: 'Up- und Downvotes zeigen Priorität, Reibung und Klärungsbedarf.',
      },
      {
        label: 'Themen-Wortwolke',
        text: 'Wörter und Phrasen werden nach Unterstützung, Zustimmung oder Kontroverse gewichtet.',
      },
      {
        label: 'Kompass-Ausblick',
        text: 'Deterministische Signale kommen zuerst; Q&A-NLP und Zusammenfassung bleiben optionale Ausbaustufen.',
      },
    ],
    docsLink: 'Q&A-Scoring und Kontroversität auf GitHub öffnen',
    demoAria: 'Beispiel einer Q&A-Fragenwand mit Moderation, Voting und Wortwolke',
    hostView: 'Host-Ansicht Q&A',
    demoTitle: 'Fragen zur Veranstaltung',
    moderationActive: 'Vorab-Moderation aktiv',
    sortMostSupported: 'Meist unterstützt',
    sortBest: 'Beste Fragen',
    sortControversial: 'Umstritten',
    questions: [
      {
        score: '+18',
        title: 'Wann ist eine Schätzung fachlich noch plausibel?',
        meta: '15 positiv · 3 negativ · beste Frage',
      },
      {
        score: '+4',
        title: 'Sollten wir Ergebnisse vor der Diskussion wirklich ausblenden?',
        meta: '9 positiv · 5 negativ · umstritten',
      },
      {
        score: '+11',
        title: 'Wie unterscheidet sich Q&A von Freitext im Quiz?',
        meta: '11 positiv · 0 negativ · meist unterstützt',
      },
    ],
    wordCloud: 'Q&A-Wortwolke',
    wordCloudHint: 'Gewichtet nach positiver Resonanz und Kontroverse.',
    frozenLive: 'Live eingefroren',
    terms: [
      { label: 'Toleranzband', className: 'text-3xl text-brand-200' },
      { label: 'Diskussion', className: 'text-2xl text-emerald-200' },
      { label: 'Q&A', className: 'text-4xl text-white' },
      { label: 'Plausibilität', className: 'text-xl text-amber-200' },
      { label: 'Kontroverse', className: 'text-2xl text-rose-200' },
      { label: 'Peer Instruction', className: 'text-lg text-slate-300' },
      { label: 'Moderation', className: 'text-3xl text-cyan-200' },
      { label: 'Klärungsbedarf', className: 'text-xl text-violet-200' },
    ],
    nextStep:
      'Nächster Schritt: deterministischer Moderationskompass, optional ergänzt durch asynchrone Q&A-NLP-Signale und quellengebundene Zusammenfassungen.',
  },
  workflow: {
    eyebrow: 'Für Unterricht, Training und Workshops',
    title: 'In wenigen Minuten von der Idee zur Live-Session',
    lead: 'Von der Frage bis zur laufenden Session führt der Ablauf bewusst ohne unnötige Zwischenschritte. Genau das macht den Einstieg für Lehrende, Trainer:innen und Moderator:innen schnell und verlässlich.',
    stepLabel: 'Schritt',
    steps: [
      {
        number: '01',
        title: 'Quiz vorbereiten',
        description:
          'Fragen direkt erstellen oder vorhandene Inhalte importieren. Markdown, KaTeX, Kurzantwort und numerische Schätzfragen sind direkt eingebaut.',
      },
      {
        number: '02',
        title: 'Session starten',
        description:
          'Ohne Konto loslegen: Session öffnen, Stil wählen, Code oder QR teilen und bei Bedarf Presenter-Ansicht nutzen.',
      },
      {
        number: '03',
        title: 'Live moderieren',
        description:
          'Teilnehmende stimmen ab, stellen Fragen und priorisieren gemeinsam. Host und Presenter zeigen Quiz, Q&A-Fragenwand, Wortwolke, Lesephase, Countdown, zweite Runde und Ergebnisansicht in einem Flow.',
      },
      {
        number: '04',
        title: 'Nachbereiten und exportieren',
        description:
          'Nach Session-Ende steht der Ergebnisbericht (PDF) bereit — mit Lernstand, Selbsteinschätzung und vollständigen Fragentexten. In der Quiz-Sammlung findest du Nachbesprechung und PDF für den letzten Durchlauf; CSV für Excel unter „Mehr“.',
      },
    ],
  },
  features: {
    eyebrow: 'Warum es sich anders anfühlt',
    title: 'Gebaut für Live-Interaktion statt nur für Abstimmungsfolien',
    lead: 'arsnova.eu verbindet schnellen Einstieg, didaktische Stärke und einen transparenten technischen Unterbau. So bleibt die Plattform im Alltag einfach, ohne in den Möglichkeiten klein zu werden.',
    items: [
      {
        title: 'Schnell im Einsatz',
        description:
          'Hosts starten ohne Account. Teilnehmende kommen per 6-stelligem Code oder QR direkt in die Session.',
        icon: 'single',
      },
      {
        title: 'Selbsteinschätzung im Live-Quiz',
        description:
          'Teilnehmende geben nach der Antwort an, wie sicher sie sind. Du erkennst selbstsicher falsche Antworten, priorisierst die Nachbesprechung und exportierst den Lernstand im Ergebnisbericht (PDF).',
        icon: 'confidence',
      },
      {
        title: 'Ergebnisbericht für die Nachbereitung',
        description:
          'Nach Session-Ende exportierst du einen druckfertigen PDF-Bericht mit Diagrammen, Fragentexten und Selbsteinschätzung. CSV für Excel bleibt optional unter „Mehr“.',
        icon: 'export',
      },
      {
        title: 'Didaktische Schätzfragen',
        description:
          'Jahreszahlen, Größenordnungen und Messwerte lassen sich mit Referenzwert, Toleranzband, Statistik und optionaler zweiter Runde schätzen.',
        icon: 'estimate',
      },
      {
        title: 'Mehr als ein Standard-Quiz',
        description:
          'MC/SC, Kurzantwort, Rating, Lesephase, Peer Instruction und Presenter-Flow unterstützen Lernen, Training und Live-Moderation.',
        icon: 'toggle',
      },
      {
        title: 'Fragenwand statt Nebenchat',
        description:
          'Q&A bietet Vorab-Moderation, Anheften, Archivieren, Up-/Downvoting sowie Sortierung nach Unterstützung, Qualität und Kontroverse.',
        icon: 'qa',
      },
      {
        title: 'Elaborierte Word Cloud',
        description:
          'Freitext und Q&A werden als Wörter und Phrasen verdichtet; die Fragenwand gewichtet nach Zustimmung, belastbarem Score oder Kontroverse.',
        icon: 'cloud',
      },
      {
        title: 'Für unterschiedliche Settings',
        description:
          'Presets, Team-Modus, anonymer Modus, Nicknames und Stilwahl helfen von Klasse und Seminar bis Workshop, Event und Meeting.',
        icon: 'bolt',
      },
      {
        title: 'Barrierefreiheit nach WCAG 2.2 AA',
        description:
          'Tastaturbedienung, Screenreader-Statusmeldungen, individuell anpassbare Bearbeitungszeit und PDF/UA-1-validierte Ergebnisberichte — damit mehr Lernende selbstständig an Live-Sessions teilnehmen können.',
        icon: 'a11y',
      },
      {
        title: 'Datenschutz und Kontrolle',
        description:
          'Local-first, Data-Stripping und self-hostbarer Betrieb geben dir mehr Kontrolle über Inhalte und Live-Daten.',
        icon: 'tools',
      },
      {
        title: 'Open Source mit Betriebspfad',
        description:
          'Docker, Postgres, Redis und Admin-Audit machen die Plattform auch für Hosting, Betrieb und Nachvollziehbarkeit belastbar.',
        icon: 'server',
      },
    ],
  },
  accessibility: {
    eyebrow: 'Barrierefreiheit',
    title: 'WCAG 2.2 AA — damit mehr Lernende selbstständig teilnehmen können',
    lead: 'Für Schulen, Hochschulen und Weiterbildung ist Barrierefreiheit oft ein entscheidendes Kriterium. arsnova.eu erfüllt die Web Content Accessibility Guidelines (WCAG) 2.2 auf Konformitätsstufe AA — mit Tastaturbedienung, Screenreader-Unterstützung, individuell anpassbarer Bearbeitungszeit und barrierefrei strukturierten PDF-Ergebnisberichten.',
    benefits: [
      {
        title: 'Bedienung mit Tastatur',
        description:
          'Du und deine Teilnehmenden bedienen die zentralen Abläufe ohne Maus. Sichtbare Fokusmarkierungen und ein Sprunglink zum Inhalt erleichtern die Navigation.',
      },
      {
        title: 'Screenreader-Unterstützung im Live-Betrieb',
        description:
          'Statusänderungen beim Beitritt zur Session, bei Abstimmungen und Phasenwechseln werden für Screenreader ausgegeben, sodass Nutzer:innen den Ablauf nachvollziehen können.',
      },
      {
        title: 'Individuell anpassbare Bearbeitungszeit',
        description:
          'Bei zeitlich begrenzten Fragen wählst du die Standardzeit, die zehnfache Bearbeitungszeit oder eine Teilnahme ohne Zeitlimit. So lässt sich ein Nachteilsausgleich direkt in der Live-Session umsetzen.',
      },
      {
        title: 'Barrierefrei strukturierter Ergebnisbericht',
        description:
          'Der druckfertige Bericht ist PDF/UA-1-validiert und enthält Dokumenttitel, Sprache und Tags — für die Nachbereitung und barrierefreie Weitergabe.',
      },
    ],
    statementLink: 'Erklärung zur Barrierefreiheit öffnen',
  },
  trust: {
    eyebrow: 'Vertrauen',
    title: 'Glaubwürdig, weil das Produkt nicht bei null anfängt',
    lead: 'arsnova.eu steht in der Tradition des ARSnova-Ökosystems und knüpft an wissenschaftliche, didaktische und praktische Erfahrungen aus vielen Jahren Bildungstechnologie an.',
    proofItems: [
      { value: 'Seit 2012', label: 'ARSnova-Tradition in Bildung und EdTech' },
      { value: 'WCAG 2.2 AA', label: 'Geprüfte Barrierefreiheit für Lehre und Institutionen' },
      {
        value: '5 UI-Sprachen',
        label: 'Deutsch, Englisch, Französisch, Spanisch, Italienisch',
      },
      { value: 'Open Source', label: 'Transparenter Code statt Black Box' },
    ],
    items: [
      {
        quote: 'Datenschutzkonformer Weg: keine personenbezogenen Daten dauerhaft auf dem Server.',
        source: 'DeLFI 2017',
        tag: 'Wissenschaft',
      },
      {
        quote:
          'UX-Evaluation im direkten Vergleich mit Kahoot! als empirischer Prüfpunkt des Designs.',
        source: 'fnm-austria',
        tag: 'Studie',
      },
      {
        quote:
          'Privacy-by-Design und technische Offenheit sind ein echter Differenzierungsfaktor für europäische EdTech-Kontexte.',
        source: 'Publikationsanalyse',
        tag: 'Architektur',
      },
      {
        quote: 'In realen Bildungssettings praktisch erprobt, nicht nur als Konzept beschrieben.',
        source: 'Nutzung in Lehr- und Trainingskontexten',
        tag: 'Praxis',
      },
    ],
    referencesPrefix:
      'Vollständige Referenzen und die zugrundeliegende Publikationssammlung liegen in',
    referencesLink: 'ARSnova-Recherche.pdf',
    referencesSuffix: 'auf GitHub.',
  },
  comparison: {
    eyebrow: 'Abgrenzung',
    title: 'Nicht nur ein Ersatz für Mentimeter oder Kahoot',
    lead: 'Im Mittelpunkt steht nicht nur Abstimmung, sondern der komplette Live-Flow: vorbereiten, moderieren, Ergebnisse sichtbar machen und dabei die Kontrolle über Inhalte und Betrieb behalten.',
    points: [
      {
        title: 'Weniger Einstiegshürden',
        description:
          'Keine getrennte Produktlogik für „Erstellen“ und „Beitreten“. Hosts starten ohne Account, Teilnehmende kommen per Code oder QR in die Session.',
      },
      {
        title: 'Mehr Interaktionsformate',
        description:
          'Neben Quiz auch numerische Schätzfragen, Lesephase, Peer Instruction, Blitzlicht, Q&A-Fragenwand und gewichtete Word Cloud in derselben Plattform statt nur Folien-Abstimmungen.',
      },
      {
        title: 'Mehr Kontrolle über Daten und Zugang',
        description:
          'Open Source, self-hostbar und local-first konzipiert — plus Barrierefreiheit nach WCAG 2.2 AA. Relevant für Schulen, Hochschulen und Organisationen mit Datenschutz- und Inklusionsanforderungen.',
      },
    ],
    comparePrefix: 'Den vollständigen Featurevergleich findest du weiterhin in der Doku:',
    compareLink: 'Vergleich auf GitHub öffnen',
  },
  faq: {
    eyebrow: 'FAQ',
    title: 'Häufige Fragen vor dem ersten Einsatz',
    answerLabel: 'Antwort',
    items: [
      {
        question: 'Brauchen Hosts oder Teilnehmende einen Account?',
        answer:
          'Nein. Eine Session kann ohne Konto gestartet werden. Teilnehmende treten per Code oder QR bei.',
      },
      {
        question: 'Wo liegen die Daten?',
        answer:
          'Quiz-Inhalte sind local-first konzipiert. Für Live-Sessions werden nur die technisch nötigen Sitzungsdaten verarbeitet; bei Self-Hosting liegt der Betrieb in deiner eigenen Infrastruktur.',
      },
      {
        question: 'Kann ich arsnova.eu selbst hosten?',
        answer:
          'Ja. Die Plattform ist Open Source und für den Betrieb mit Docker, PostgreSQL und Redis ausgelegt.',
      },
      {
        question: 'Was ist die Selbsteinschätzung im Quiz?',
        answer:
          'Eine optionale Zusatzabfrage nach bewertbaren Fragen: Teilnehmende geben auf einer Skala von 1–5 an, wie sicher sie bei ihrer Antwort sind. Punkte bleiben unverändert; in der Host-Auswertung siehst du Korrektheit × Antwortsicherheit und markierst selbstsicher falsche Antworten als Fehlkonzept-Signal. Nach Session-Ende fließt der Lernstand in Nachbesprechung und Ergebnisbericht (PDF) ein.',
      },
      {
        question: 'Kann ich Session-Ergebnisse exportieren?',
        answer:
          'Ja. Nach Session-Ende steht der Ergebnisbericht (PDF) als primäres Format bereit — inklusive Selbsteinschätzung, Prioritäten für die Nachbesprechung und vollständiger Fragentexte. In der Quiz-Sammlung findest du Nachbesprechung und PDF für den letzten Durchlauf. Tabellarische CSV-Daten sind unter „Mehr“ für Excel verfügbar.',
      },
      {
        question: 'Was ist an der numerischen Schätzfrage besonders?',
        answer:
          'Sie trennt erlaubte Eingaben vom fachlichen Toleranzband, zeigt während der Abstimmung keine Verteilung und kann nach einer Diskussion eine zweite Runde mit Statistik und Rundenvergleich auswerten.',
      },
      {
        question: 'Was kann die Q&A-Fragenwand?',
        answer:
          'Teilnehmende reichen Fragen ein und gewichten sie mit Up- und Downvotes. Hosts können vorab moderieren, Fragen anheften, archivieren oder entfernen und die Liste nach Unterstützung, belastbarer Zustimmung oder Kontroverse sortieren.',
      },
      {
        question: 'Was macht die Q&A-Wortwolke anders?',
        answer:
          'Sie verdichtet sichtbare Fragen zu Wörtern und Phrasen und übernimmt die aktive Sortierlogik. Dadurch zeigt sie nicht nur häufige Begriffe, sondern Themencluster aus unterstützten, robust bewerteten oder kontroversen Fragen.',
      },
      {
        question: 'Für wen ist die Plattform gedacht?',
        answer:
          'Für Live-Interaktion in Bildung und Organisationen: Schule, Hochschule, Weiterbildung, Training, Workshop, Event oder Meeting.',
      },
      {
        question: 'Ist arsnova.eu barrierefrei?',
        answer:
          'arsnova.eu erfüllt WCAG 2.2 AA. Zentrale Abläufe sind per Tastatur bedienbar, Screenreader geben Statusänderungen aus, bei zeitlich begrenzten Fragen ist die Bearbeitungszeit individuell anpassbar (Standardzeit, zehnfache Bearbeitungszeit oder ohne Zeitlimit), und der barrierefrei strukturierte Ergebnisbericht ist PDF/UA-1-validiert.',
        linkLabel: 'Erklärung zur Barrierefreiheit öffnen',
      },
    ],
  },
  ctaSection: {
    title: 'Bereit für die nächste Live-Session?',
    lead: 'Teste den Live-Flow direkt in der App oder wirf einen Blick auf den offenen Code, die Q&A-Logik, die Word-Cloud-Pipeline und den Betriebspfad hinter der Plattform.',
  },
  jsonLd: {
    websiteName: 'arsnova.eu – Informationen',
    webAppDescription:
      'Open-Source Audience Response für Bildung, Training und Organisationen: Live-Quiz, Selbsteinschätzung, Ergebnisbericht (PDF), numerische Schätzfragen, moderierbare Q&A-Fragenwand, Word Cloud und Feedback — barrierefrei nach WCAG 2.2 AA, kostenlos, self-hostbar und ohne Account startklar.',
    featureList: [
      'Live-Quiz und Abstimmungen',
      'Selbsteinschätzung bei bewertbaren Fragen',
      'Ergebnisbericht (PDF) und Nachbesprechung nach Session-Ende',
      'Numerische Schätzfragen mit zwei Runden und Statistik',
      'Q&A-Fragenwand mit Moderation, Up- und Downvoting',
      'Lobby, Presenter, QR/Code',
      'Fragetypen MC/SC/Kurzantwort/Freitext/Umfrage/Rating/Schätzfrage',
      'Markdown und KaTeX',
      'Lesephase und Peer Instruction',
      'Q&A- und Freitext-Word-Cloud mit Phrasen und Gewichtung',
      'Sortierung nach Unterstützung, belastbarer Zustimmung und Kontroverse',
      'Team-Modus und Presets',
      'Leaderboard, Streak, Bonus-Code',
      'Import/Export und Yjs-Sync',
      'KI-Import extern, Zod-validiert',
      'UI in fünf Sprachen',
      'Barrierefreiheit nach WCAG 2.2 AA',
      'Docker Self-Host und Admin-Audit',
      'Local-First und DSGVO-orientierter Betrieb',
    ],
  },
};

export default de;

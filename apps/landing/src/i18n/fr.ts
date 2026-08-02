import type { Messages } from './types';

const fr: Messages = {
  meta: {
    homeTitle: 'arsnova.eu | Quiz en direct, questions d’estimation numérique et mur de questions',
    homeDescription:
      'Plateforme open source de réponse interactive pour l’éducation, la formation et les organisations : quiz en direct, autoévaluation, rapport de résultats (PDF), questions d’estimation numérique, mur de questions modérable, nuage de mots et sondage express — conforme aux WCAG 2.2, niveau AA, gratuite, exploitable sur votre propre infrastructure et prête sans compte.',
    siteNameInfo: 'arsnova.eu – Informations',
    ogLocale: 'fr_FR',
  },
  nav: {
    ariaLabel: 'Navigation principale',
    workflow: 'Fonctionnement',
    features: 'Fonctionnalités',
    accessibility: 'Accessibilité',
    trust: 'Confiance',
    comparison: 'Comparatif',
    faq: 'FAQ',
    tryNow: 'Essayer maintenant',
    menuOpen: 'Ouvrir le menu',
    menuClose: 'Fermer le menu',
    menu: 'Menu',
    skipToContent: 'Aller au contenu',
  },
  languageSwitcher: {
    label: 'Langue',
    currentLanguage: 'Français',
    chooseLanguage: 'Choisir la langue',
  },
  footer: {
    impressum: 'Mentions légales',
    privacy: 'Confidentialité',
    accessibility: 'Accessibilité',
  },
  cta: {
    appOpen: 'Ouvrir l’application',
    quizCreate: 'Créer un quiz',
    backToApp: 'Retour à arsnova.eu',
    tryLive: 'Essayer en direct',
    howItWorks: 'Comment ça marche',
    viewOpenSource: 'Voir le code source',
  },
  hero: {
    eyebrow: 'Réponse interactive pour l’éducation et les organisations',
    titleLine1: 'Quizzer, estimer,',
    titleLine2: 'modérer les questions',
    titleAccent1: 'en direct et gratuitement',
    titleAccent2: ' sans compte.',
    lead: 'arsnova.eu réunit quiz en direct, questions d’estimation numérique, autoévaluation sur les questions notées, mur de questions, analyse en nuage de mots et sondage express dans une seule interface pour les écoles, les universités, la formation continue, les ateliers et le monde professionnel. Open source, exploitable sur votre propre infrastructure et conçu pour un fonctionnement dans le respect du RGPD.',
    a11yLink: 'Conforme aux WCAG 2.2, niveau AA',
    a11ySuffix: '— clavier, lecteur d’écran et temps de réponse ajustable individuellement.',
    cards: [
      { title: 'Prêt en quelques secondes', text: 'Partager une session par code ou QR' },
      { title: 'Q&A avec mur de questions', text: 'Modération, votes et nuage thématique' },
      {
        title: 'Autoévaluation et suivi',
        text: 'Repérer les idées fausses, exporter le rapport PDF',
      },
      {
        title: 'Open source et hébergeable chez vous',
        text: 'Docker, Postgres, Redis et journal d’administration',
      },
    ],
  },
  estimate: {
    eyebrow: 'Nouveau dans le quiz en direct',
    title: 'Estimer des nombres, discuter et comparer clairement le second tour',
    lead: 'La question d’estimation numérique est conçue pour les dates, ordres de grandeur, mesures et probabilités. Les animateurs fixent une valeur de référence, une plage de saisie et une tolérance ; les participants n’entrent qu’un nombre.',
    summary: [
      'La bande de plausibilité limite les saisies autorisées.',
      'La bande de tolérance évalue les estimations acceptables sur le fond.',
      'Personne ne voit la distribution avant la publication des résultats.',
      'Le tour 1 et le tour 2 sont comparés après la discussion.',
    ],
    docsLink: 'Ouvrir la documentation de la question d’estimation numérique',
    demoAria:
      'Exemple de résultats pour une question d’estimation numérique sur la Révolution française',
    hostView: 'Vue de l’animateur après publication',
    demoQuestion: 'Quand a commencé la Révolution française ?',
    reference: 'Référence 1789',
    toleranceBand: 'Bande de tolérance',
    toleranceValue: '1700 à 1900',
    plausibilityBand: 'Bande de plausibilité',
    plausibilityValue: '1500 à 2000',
    histogramNote:
      'L’histogramme, la ligne de référence et la bande de tolérance n’apparaissent qu’après publication des résultats. Avant cela, seul un indicateur neutre de progression reste visible.',
    median: 'Médiane',
    inBand: 'dans la bande',
    round2: 'Tour 2',
    round2Value: '14 réponses plus proches de la référence',
  },
  confidence: {
    eyebrow: 'Analyse pédagogique',
    title: 'Juste ou faux — et avec quel degré de confiance ?',
    lead: 'Avec l’autoévaluation, les participants indiquent après leur réponse à quel point ils sont sûrs (1–5). Tu vois non seulement le taux de réussite, mais aussi les réponses erronées associées à un degré de confiance élevé — un outil utile pour l’évaluation formative, le plan de bilan et le rapport de résultats (PDF) en fin de session.',
    summary: [
      'Pas un type de question à part — optionnel sur les questions notées.',
      'Échelle 1–5 après la réponse, sans effet sur les points.',
      'Après publication, l’animateur voit le croisement entre l’exactitude des réponses et le degré de confiance.',
      '« Erroné et sûr » signale d’éventuelles idées fausses.',
      'Après la session : rapport de résultats (PDF) et bilan.',
    ],
    docsConfidence: 'Doc autoévaluation',
    docsExport: 'Doc rapport de résultats (PDF)',
    demoAria: 'Exemple d’évaluation avec autoévaluation après publication',
    hostView: 'Vue de l’animateur après publication',
    demoQuestion: 'Quelle structure est la plus stable ?',
    badge: 'Autoévaluation',
    matrix: [
      { label: 'Réponse correcte · confiance faible', count: 3, tone: 'emerald' },
      { label: 'Réponse correcte · confiance moyenne', count: 8, tone: 'emerald' },
      { label: 'Réponse correcte · confiance élevée', count: 11, tone: 'emerald' },
      { label: 'Réponse incorrecte · confiance faible', count: 2, tone: 'slate' },
      { label: 'Réponse incorrecte · confiance moyenne', count: 4, tone: 'amber' },
      { label: 'Réponse incorrecte · confiance élevée', count: 2, tone: 'rose' },
    ],
    falseHighTitle: '2 réponses erronées associées à un degré de confiance élevé',
    falseHighText:
      'L’option B a été choisie 2× avec un degré de confiance élevé — un signal d’éventuelles idées fausses pour le bilan.',
    consolidated: 'Solide',
    misconceptionRisk: 'Risque d’idée fausse',
    fragile: 'Fragile',
    afterSessionAria: 'Export après la fin de session',
    afterSession: 'Après la fin de session',
    debriefing: 'Bilan',
    resultsPdf: 'Rapport de résultats (PDF)',
    exportNote:
      'Rapport prêt à imprimer avec état d’apprentissage, carte de chaleur et textes des questions — dans la vue de l’animateur et sur la carte quiz. Le CSV pour Excel reste disponible sous « Plus ».',
  },
  qaWall: {
    eyebrow: 'Q&A en direct comme espace de modération',
    title: 'Recueillir les questions, les prioriser et les lire comme carte thématique',
    lead: 'Le mur de questions n’est pas un chat secondaire. C’est un canal en direct dédié pour les enseignant·es et intervenant·es : modérer les contributions, repérer les priorités collectives, rendre visibles les points controversés et ramener les thèmes clés dans la salle via un nuage de mots Q&A pondéré.',
    signals: [
      {
        label: 'Pré-modération',
        text: 'Publier les questions uniquement lorsqu’elles sont pertinentes dans le contexte pédagogique.',
      },
      {
        label: 'Vote collectif',
        text: 'Les votes pour et contre indiquent les priorités, les désaccords et les besoins de clarification.',
      },
      {
        label: 'Nuage thématique',
        text: 'Mots et phrases sont pondérés selon le soutien, l’accord ou la controverse.',
      },
      {
        label: 'À venir : boussole de modération',
        text: 'Les signaux déterministes viennent d’abord ; l’analyse linguistique optionnelle et la synthèse restent des extensions.',
      },
    ],
    docsLink: 'Ouvrir la notation Q&A et la controverse sur GitHub',
    demoAria: 'Exemple de mur de questions avec modération, votes et nuage de mots',
    hostView: 'Vue Q&A de l’animateur',
    demoTitle: 'Questions sur l’événement',
    moderationActive: 'Pré-modération active',
    sortMostSupported: 'Les plus soutenues',
    sortBest: 'Meilleures questions',
    sortControversial: 'Controversées',
    questions: [
      {
        score: '+18',
        title: 'Quand une estimation reste-t-elle plausible sur le fond ?',
        meta: '15 pour · 3 contre · meilleure question',
      },
      {
        score: '+4',
        title: 'Faut-il vraiment masquer les résultats avant la discussion ?',
        meta: '9 pour · 5 contre · controversé',
      },
      {
        score: '+11',
        title: 'En quoi le Q&A diffère-t-il du texte libre dans le quiz ?',
        meta: '11 pour · 0 contre · surtout soutenu',
      },
    ],
    wordCloud: 'Nuage de mots Q&A',
    wordCloudHint: 'Pondéré selon le soutien positif et la controverse.',
    frozenLive: 'Mise à jour en direct en pause',
    terms: [
      { label: 'Bande de tolérance', className: 'text-3xl text-brand-200' },
      { label: 'Discussion', className: 'text-2xl text-emerald-200' },
      { label: 'Q&A', className: 'text-4xl text-white' },
      { label: 'Plausibilité', className: 'text-xl text-amber-200' },
      { label: 'Controverse', className: 'text-2xl text-rose-200' },
      { label: 'Peer Instruction', className: 'text-lg text-slate-300' },
      { label: 'Modération', className: 'text-3xl text-cyan-200' },
      { label: 'Besoin de clarification', className: 'text-xl text-violet-200' },
    ],
    nextStep:
      'Prochaine étape : une boussole de modération déterministe, éventuellement complétée par des signaux d’analyse linguistique asynchrones et des synthèses fondées sur les questions soumises.',
  },
  workflow: {
    eyebrow: 'Pour l’enseignement, la formation et les ateliers',
    title: 'De l’idée à la session en direct en quelques minutes',
    lead: 'De la question à la session en cours, le parcours évite volontairement les étapes inutiles. C’est ce qui rend le démarrage rapide et fiable pour les enseignant·es, formateur·rices et animateur·rices.',
    stepLabel: 'Étape',
    steps: [
      {
        number: '01',
        title: 'Préparer un quiz',
        description:
          'Créer des questions directement ou importer des contenus existants. Markdown, KaTeX, réponse courte et questions d’estimation numérique sont intégrés.',
      },
      {
        number: '02',
        title: 'Démarrer une session',
        description:
          'Commencer sans compte : ouvrir une session, choisir un style, partager un code ou un QR et utiliser la vue présentateur si besoin.',
      },
      {
        number: '03',
        title: 'Animer en direct',
        description:
          'Les participants votent, posent des questions et définissent ensemble les priorités. L’animateur et le présentateur affichent le quiz, le mur de questions, le nuage de mots, la phase de lecture, le compte à rebours, le second tour et les résultats dans un seul déroulement.',
      },
      {
        number: '04',
        title: 'Suivre et exporter',
        description:
          'Après la fin de session, le rapport de résultats (PDF) est prêt — avec état d’apprentissage, autoévaluation et textes complets des questions. Dans la collection de quiz, tu trouves bilan et PDF du dernier passage ; CSV pour Excel sous « Plus ».',
      },
    ],
  },
  features: {
    eyebrow: 'Ce qui distingue arsnova.eu',
    title: 'Conçu pour l’interaction en direct, pas seulement pour des sondages sur diapos',
    lead: 'arsnova.eu combine démarrage rapide, force pédagogique et socle technique transparent. La plateforme reste simple au quotidien sans restreindre les possibilités.',
    items: [
      {
        title: 'Prêt rapidement',
        description:
          'Les animateurs démarrent sans compte. Les participants rejoignent la session directement avec un code à 6 chiffres ou un QR.',
        icon: 'single',
      },
      {
        title: 'Autoévaluation dans le quiz en direct',
        description:
          'Les participants indiquent après la réponse à quel point ils sont sûrs. Tu repères les réponses erronées associées à un degré de confiance élevé, priorises le bilan et exportes l’état d’apprentissage dans le rapport de résultats (PDF).',
        icon: 'confidence',
      },
      {
        title: 'Rapport de résultats pour le suivi',
        description:
          'Après la fin de session, tu exportes un rapport PDF prêt à imprimer avec graphiques, textes des questions et autoévaluation. Le CSV pour Excel reste optionnel sous « Plus ».',
        icon: 'export',
      },
      {
        title: 'Questions d’estimation numérique pédagogiques',
        description:
          'Dates, ordres de grandeur et mesures peuvent être estimés avec valeur de référence, bande de tolérance, statistiques et second tour optionnel.',
        icon: 'estimate',
      },
      {
        title: 'Plus qu’un quiz standard',
        description:
          'QCM/QCU, réponses courtes, évaluations, phase de lecture, Peer Instruction et mode présentateur soutiennent l’apprentissage, la formation et l’animation en direct.',
        icon: 'toggle',
      },
      {
        title: 'Mur de questions plutôt qu’un chat secondaire',
        description:
          'Le Q&A offre pré-modération, épinglage, archivage, votes pour/contre et tri par soutien, qualité et controverse.',
        icon: 'qa',
      },
      {
        title: 'Nuage de mots expressif',
        description:
          'Texte libre et Q&A sont condensés en mots et phrases ; le mur pondère selon l’accord, une majorité claire ou la controverse.',
        icon: 'cloud',
      },
      {
        title: 'Pour des contextes variés',
        description:
          'Préréglages, mode équipe, mode anonyme, pseudonymes et choix de style aident de la classe et du séminaire à l’atelier, l’événement et la réunion.',
        icon: 'bolt',
      },
      {
        title: 'Conforme aux WCAG 2.2, niveau AA',
        description:
          'Navigation clavier, annonces lecteur d’écran, temps de réponse ajustable individuellement et rapports PDF/UA-1 — pour que davantage d’apprenant·es participent en autonomie aux sessions en direct.',
        icon: 'a11y',
      },
      {
        title: 'Confidentialité et contrôle',
        description:
          'Les contenus de quiz restent sur ton appareil, la suppression optionnelle des données et l’exploitation sur ta propre infrastructure te donnent plus de contrôle sur les contenus et les données en direct.',
        icon: 'tools',
      },
      {
        title: 'Open source avec déploiement et exploitation',
        description:
          'Docker, Postgres, Redis et journal d’administration rendent la plateforme fiable aussi pour l’hébergement, l’exploitation et la traçabilité.',
        icon: 'server',
      },
    ],
  },
  accessibility: {
    eyebrow: 'Accessibilité',
    title: 'WCAG 2.2 AA — pour que davantage d’apprenant·es participent en autonomie',
    lead: 'Pour les écoles, universités et la formation continue, l’accessibilité est souvent un critère décisif. arsnova.eu est conforme aux Web Content Accessibility Guidelines (WCAG) 2.2, niveau AA — avec navigation clavier, support lecteur d’écran, temps de réponse ajustable individuellement et rapports PDF structurés de façon accessible.',
    benefits: [
      {
        title: 'Utilisation au clavier',
        description:
          'Toi et tes participants utilisez les parcours centraux sans souris. Des indicateurs de focus visibles et un lien d’évitement vers le contenu facilitent la navigation.',
      },
      {
        title: 'Support lecteur d’écran en direct',
        description:
          'Les changements d’état à l’entrée en session, lors des votes et aux changements de phase sont annoncés aux lecteurs d’écran pour suivre le déroulement.',
      },
      {
        title: 'Temps de réponse ajustable individuellement',
        description:
          'Pour les questions chronométrées, tu choisis le temps standard, le temps décuplé ou une participation sans limite. Une compensation peut ainsi s’appliquer directement en session.',
      },
      {
        title: 'Rapport de résultats structuré de façon accessible',
        description:
          'Le rapport prêt à imprimer est validé PDF/UA-1 et contient titre, langue et balises — pour le suivi et un partage accessible.',
      },
    ],
    statementLink: 'Ouvrir la déclaration d’accessibilité',
  },
  trust: {
    eyebrow: 'Confiance',
    title: 'Bâti sur une expérience de longue date',
    lead: 'arsnova.eu s’inscrit dans la tradition de l’écosystème ARSnova et s’appuie sur des expériences scientifiques, pédagogiques et pratiques de nombreuses années de technologies éducatives.',
    proofItems: [
      {
        value: 'Depuis 2012',
        label: 'Tradition ARSnova dans l’éducation et les technologies éducatives',
      },
      {
        value: 'WCAG 2.2 AA',
        label: 'Accessibilité vérifiée pour l’enseignement et les institutions',
      },
      {
        value: '5 langues UI',
        label: 'Allemand, anglais, français, espagnol, italien',
      },
      { value: 'Open source', label: 'Code transparent plutôt que des systèmes opaques' },
    ],
    items: [
      {
        quote:
          'Voie respectueuse de la vie privée : pas de données personnelles stockées durablement sur le serveur.',
        source: 'DeLFI 2017',
        tag: 'Recherche',
      },
      {
        quote:
          'Évaluation UX en comparaison directe avec Kahoot! comme vérification empirique du design.',
        source: 'fnm-austria',
        tag: 'Étude',
      },
      {
        quote:
          'La protection des données dès la conception et l’ouverture technique sont un vrai facteur de différenciation pour les contextes européens de technologies éducatives.',
        source: 'Analyse de publications',
        tag: 'Architecture',
      },
      {
        quote: 'Éprouvé en conditions réelles d’enseignement, pas seulement décrit comme concept.',
        source: 'Usage en contextes d’enseignement et de formation',
        tag: 'Pratique',
      },
    ],
    referencesPrefix:
      'Les références complètes et la collection de publications sous-jacente se trouvent dans',
    referencesLink: 'ARSnova-Recherche.pdf',
    referencesSuffix: 'sur GitHub.',
  },
  comparison: {
    eyebrow: 'Positionnement',
    title: 'Pas seulement un substitut à Mentimeter ou Kahoot',
    lead: 'L’objectif n’est pas seulement de voter, mais de couvrir tout le déroulement en direct : préparer, animer, rendre les résultats visibles et garder le contrôle sur les contenus et l’exploitation.',
    points: [
      {
        title: 'Moins de freins à l’entrée',
        description:
          'Pas de logique produit séparée pour « créer » et « rejoindre ». Les animateurs démarrent sans compte, les participants entrent via code ou QR.',
      },
      {
        title: 'Plus de formats d’interaction',
        description:
          'Outre le quiz : questions d’estimation numérique, phase de lecture, Peer Instruction, sondage express, mur de questions et nuage de mots pondéré dans la même plateforme — pas seulement des sondages sur diapos.',
      },
      {
        title: 'Plus de contrôle sur les données et l’accès',
        description:
          'Open source, exploitable sur votre propre infrastructure et avec des contenus de quiz conservés localement — plus la conformité aux WCAG 2.2, niveau AA. Pertinent pour les écoles, universités et organisations avec des exigences de confidentialité et d’inclusion.',
      },
    ],
    comparePrefix: 'Tu trouveras toujours la comparaison complète des fonctions dans la doc :',
    compareLink: 'Ouvrir la comparaison sur GitHub',
  },
  faq: {
    eyebrow: 'FAQ',
    title: 'Questions fréquentes avant la première utilisation',
    answerLabel: 'Réponse',
    items: [
      {
        question: 'Les animateurs ou les participants ont-ils besoin d’un compte ?',
        answer:
          'Non. Une session peut démarrer sans compte. Les participants rejoignent via code ou QR.',
      },
      {
        question: 'Où sont les données ?',
        answer:
          'Les contenus de quiz restent sur ton appareil. Pour les sessions en direct, seules les données de session techniquement nécessaires sont traitées ; si tu héberges toi-même, l’exploitation reste dans ton infrastructure.',
      },
      {
        question: 'Puis-je héberger arsnova.eu moi-même ?',
        answer:
          'Oui. La plateforme est open source et conçue pour fonctionner avec Docker, PostgreSQL et Redis.',
      },
      {
        question: 'Qu’est-ce que l’autoévaluation dans le quiz ?',
        answer:
          'Une question complémentaire optionnelle après les questions notées : les participants indiquent sur une échelle de 1 à 5 à quel point ils sont sûrs de leur réponse. Les points restent inchangés ; l’animateur voit le croisement entre l’exactitude des réponses et le degré de confiance et marque les réponses erronées associées à un degré de confiance élevé comme signal d’idée fausse. Après la session, l’état d’apprentissage alimente le bilan et le rapport de résultats (PDF).',
      },
      {
        question: 'Puis-je exporter les résultats de session ?',
        answer:
          'Oui. Après la fin de session, le rapport de résultats (PDF) est le format principal — y compris autoévaluation, priorités de bilan et textes complets des questions. Dans la collection de quiz, tu trouves bilan et PDF du dernier passage. Les données CSV tabulaires sont disponibles sous « Plus » pour Excel.',
      },
      {
        question: 'Qu’a de particulier la question d’estimation numérique ?',
        answer:
          'Elle sépare les saisies autorisées de la bande de tolérance sur le fond, n’affiche aucune distribution pendant le vote et peut évaluer un second tour après discussion avec statistiques et comparaison des tours.',
      },
      {
        question: 'Que peut faire le mur de questions ?',
        answer:
          'Les participants soumettent des questions et les pondèrent avec des votes pour et contre. Les animateurs peuvent pré-modérer, épingler, archiver ou retirer des questions et trier la liste par soutien, majorité claire ou controverse.',
      },
      {
        question: 'En quoi le nuage de mots Q&A est-il différent ?',
        answer:
          'Il condense les questions visibles en mots et phrases et reprend la logique de tri active. Il montre ainsi non seulement des termes fréquents, mais des regroupements thématiques issus de questions soutenues, clairement bien notées ou controversées.',
      },
      {
        question: 'Pour qui est destinée la plateforme ?',
        answer:
          'Pour l’interaction en direct dans l’éducation et les organisations : école, université, formation continue, formation, atelier, événement ou réunion.',
      },
      {
        question: 'arsnova.eu est-il accessible ?',
        answer:
          'arsnova.eu est conforme aux WCAG 2.2, niveau AA. Les parcours centraux sont utilisables au clavier, les lecteurs d’écran annoncent les changements d’état, le temps de réponse des questions chronométrées est ajustable individuellement (temps standard, temps décuplé ou sans limite), et le rapport de résultats structuré de façon accessible est validé PDF/UA-1.',
        linkLabel: 'Ouvrir la déclaration d’accessibilité',
      },
    ],
  },
  ctaSection: {
    title: 'Prêt·e pour la prochaine session en direct ?',
    lead: 'Teste le déroulement en direct directement dans l’application, ou jette un œil au code source ouvert, à la logique Q&A, au traitement du nuage de mots et aux bases techniques pour le déploiement et l’exploitation.',
  },
  jsonLd: {
    websiteName: 'arsnova.eu – Informations',
    webAppDescription:
      'Plateforme open source de réponse interactive pour l’éducation, la formation et les organisations : quiz en direct, autoévaluation, rapport de résultats (PDF), questions d’estimation numérique, mur de questions modérable, nuage de mots et sondage express — conforme aux WCAG 2.2, niveau AA, gratuite, exploitable sur votre propre infrastructure et prête sans compte.',
    featureList: [
      'Quiz en direct et votes',
      'Autoévaluation sur les questions notées',
      'Rapport de résultats (PDF) et bilan après la session',
      'Questions d’estimation numérique avec deux tours et statistiques',
      'Mur de questions avec modération, votes pour et contre',
      'Salle d’attente, présentateur, QR/code',
      'Types de questions QCM/QCU/réponses courtes/texte libre/sondage/évaluation/estimation numérique',
      'Markdown et KaTeX',
      'Phase de lecture et Peer Instruction',
      'Nuage de mots Q&A et texte libre avec phrases et pondération',
      'Tri par soutien, majorité claire et controverse',
      'Mode équipe et préréglages',
      'Classement, série, code bonus',
      'Import/export et synchronisation Yjs',
      'Import IA externe, validé Zod',
      'Interface en cinq langues',
      'Conforme aux WCAG 2.2, niveau AA',
      'Exploitation Docker sur votre infrastructure et journal d’administration',
      'Contenus de quiz conservés localement et fonctionnement dans le respect du RGPD',
    ],
  },
};

export default fr;

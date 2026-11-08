import type { Messages } from './types';

const fr: Messages = {
  meta: {
    homeTitle: 'arsnova.eu | Quiz en direct, questions d’estimation numérique et mur de questions',
    homeDescription:
      'Quiz en direct, questions du public, nuages de mots et feedback express : crée et anime depuis un smartphone. arsnova.eu est gratuit, open source, utilisable sans compte et auto-hébergeable. Avec confiance dans la réponse, rapport PDF et conformité WCAG 2.2 AA.',
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
  themeSwitcher: {
    label: 'Apparence',
    system: 'Réglage du système',
    light: 'Clair',
    dark: 'Sombre',
    chooseAppearance: 'Choisir l’apparence',
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
    eyebrow: 'Faire participer le public dans l’enseignement et les organisations',
    titleLine1: 'Animer des quiz, sonder,',
    titleLine2: 'recueillir les questions',
    titleAccent1: 'en direct et gratuitement',
    titleAccent2: ' sans compte.',
    lead: 'Réunis quiz en direct, estimations numériques, confiance dans la réponse, questions du public, nuages de mots et feedback express dans une même session. arsnova.eu accompagne les cours, les formations, les ateliers et les réunions. Crée des questions de tous types et anime depuis un smartphone. La plateforme est open source, auto-hébergeable et conçue pour un fonctionnement respectueux du RGPD.',
    a11yLink: 'Conforme aux WCAG 2.2, niveau AA',
    a11ySuffix: '— clavier, lecteur d’écran et temps de réponse ajustable individuellement.',
    cards: [
      {
        title: 'Pensé pour le smartphone',
        text: 'Crée des questions de tous types et anime une session en direct depuis ton smartphone',
      },
      {
        title: 'Q&R avec mur de questions',
        text: 'Modération, votes, nuage de mots et boussole de modération',
      },
      {
        title: 'Autoévaluation et suivi',
        text: 'Repérer de possibles conceptions erronées et exporter le rapport PDF',
      },
      {
        title: 'Open source et auto-hébergeable',
        text: 'Docker, Postgres, Redis et journal d’administration',
      },
    ],
  },
  estimate: {
    eyebrow: 'Nouveau dans le quiz en direct',
    title: 'Estimer, discuter et comparer les deux tours',
    lead: 'Utilise les estimations numériques pour des dates, des ordres de grandeur, des mesures ou des probabilités. Définis une valeur de référence, une plage de saisie et une tolérance. Les participants saisissent simplement un nombre.',
    summary: [
      'La plage de saisie délimite les valeurs autorisées.',
      'La plage de tolérance définit les estimations considérées comme correctes.',
      'Personne ne voit la distribution avant la publication des résultats.',
      'Le tour 1 et le tour 2 sont comparés après la discussion.',
    ],
    docsLink: 'Ouvrir la documentation de la question d’estimation numérique',
    demoAria:
      'Exemple de résultats pour une question d’estimation numérique sur la Révolution française',
    hostView: 'Vue de l’animateur après publication',
    demoQuestion: 'En quelle année la Révolution française a-t-elle commencé ?',
    reference: 'Référence 1789',
    toleranceBand: 'Bande de tolérance',
    toleranceValue: '1700 à 1900',
    plausibilityBand: 'Valeurs autorisées',
    plausibilityValue: '1500 à 2000',
    histogramNote:
      'L’histogramme, la ligne de référence et la bande de tolérance n’apparaissent qu’après publication des résultats. Avant cela, seul un indicateur neutre de progression reste visible.',
    median: 'Médiane',
    inBand: 'dans la plage acceptée',
    round2: 'Tour 2',
    round2Value: '14 réponses plus proches de la référence',
  },
  confidence: {
    eyebrow: 'Analyse pédagogique',
    title: 'Réponse correcte ou incorrecte : avec quelle confiance ?',
    lead: 'Après avoir répondu, les participants peuvent indiquer leur confiance dans leur réponse sur une échelle de 1 à 5. Tu peux ainsi repérer les réponses incorrectes données avec une confiance élevée. Ces indices t’aident à préparer le débriefing et figurent dans le rapport PDF de fin de session.',
    summary: [
      'Une option pour les questions notées, sans créer un type de question supplémentaire.',
      'Une échelle de 1 à 5 après la réponse, sans effet sur les points.',
      'Après publication des résultats, la vue d’animation croise l’exactitude des réponses et le degré de confiance.',
      'Les réponses incorrectes données avec un degré de confiance élevé peuvent signaler des conceptions erronées.',
      'Après la session, retrouve ces informations dans le rapport PDF pour préparer le débriefing.',
    ],
    docsConfidence: 'Documentation sur la confiance dans la réponse',
    docsExport: 'Documentation du rapport PDF',
    demoAria: 'Exemple de résultats croisant réponses et confiance après publication',
    hostView: 'Vue de l’animateur après publication',
    demoQuestion: 'Quelle structure est la plus stable ?',
    badge: 'Confiance dans la réponse',
    matrix: [
      { label: 'Réponse correcte · confiance faible', count: 3, tone: 'emerald' },
      { label: 'Réponse correcte · confiance moyenne', count: 8, tone: 'emerald' },
      { label: 'Réponse correcte · confiance élevée', count: 11, tone: 'emerald' },
      { label: 'Réponse incorrecte · confiance faible', count: 2, tone: 'slate' },
      { label: 'Réponse incorrecte · confiance moyenne', count: 4, tone: 'amber' },
      { label: 'Réponse incorrecte · confiance élevée', count: 2, tone: 'rose' },
    ],
    falseHighTitle: '2 réponses incorrectes avec une confiance élevée',
    falseHighText:
      'L’option B a été choisie deux fois avec une confiance élevée. Cela peut indiquer une conception erronée à reprendre lors du débriefing.',
    consolidated: 'Connaissances consolidées',
    misconceptionRisk: 'Possible conception erronée',
    fragile: 'Fragile',
    afterSessionAria: 'Export après la fin de session',
    afterSession: 'Après la session',
    debriefing: 'Bilan',
    resultsPdf: 'Rapport de résultats (PDF)',
    exportNote:
      'Rapport prêt à imprimer avec niveau de compréhension, carte thermique et textes des questions — dans la vue de l’animateur et sur la carte du quiz. Le CSV pour Excel reste disponible sous « Plus ».',
  },
  qaWall: {
    eyebrow: 'Un espace Q&R en direct',
    title: 'Recueillir les questions, définir les priorités et repérer les thèmes',
    lead: 'L’espace Q&R est un canal dédié aux questions du public. Publie les contributions, repère les priorités et les sujets controversés, puis affiche les thèmes importants dans un nuage de mots pondéré.',
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
        text: 'La taille des mots et des groupes de mots dépend du mode de tri : solde des votes, forte adhésion ou controverse.',
      },
      {
        label: 'Boussole de modération',
        text: 'Une prochaine étape proposée à partir des questions, du nuage de mots, du quiz et du retour sur le rythme.',
      },
    ],
    docsLink: 'Comprendre le tri des questions et la mesure de controverse sur GitHub',
    demoAria: 'Exemple de mur de questions avec modération, votes et nuage de mots',
    hostView: 'Vue Q&R de l’animateur',
    demoTitle: 'Questions sur l’événement',
    moderationActive: 'Pré-modération active',
    sortMostSupported: 'Solde des votes',
    sortBest: 'Forte adhésion',
    sortControversial: 'Controversées',
    questions: [
      {
        score: '+18',
        title: 'Quand une estimation reste-t-elle plausible sur le fond ?',
        meta: '15 pour · 3 contre · forte adhésion',
      },
      {
        score: '+4',
        title: 'Faut-il vraiment masquer les résultats avant la discussion ?',
        meta: '9 pour · 5 contre · controversée',
      },
      {
        score: '+11',
        title: 'En quoi l’espace Q&R diffère-t-il du texte libre dans un quiz ?',
        meta: '11 pour · 0 contre · la plus soutenue',
      },
    ],
    wordCloud: 'Nuage de mots Q&R',
    wordCloudHint: 'La taille des termes reflète la pondération des questions.',
    frozenLive: 'Affichage figé',
    terms: [
      { label: 'Bande de tolérance', className: 'text-3xl text-landing-primary' },
      { label: 'Discussion', className: 'text-2xl text-landing-status-emerald' },
      { label: 'Q&R', className: 'text-4xl text-landing-fg' },
      { label: 'Plausibilité', className: 'text-xl text-landing-status-amber' },
      { label: 'Controverse', className: 'text-2xl text-landing-status-rose' },
      { label: 'Peer Instruction', className: 'text-lg text-landing-fg-muted' },
      { label: 'Modération', className: 'text-3xl text-landing-tertiary' },
      { label: 'Besoin de clarification', className: 'text-xl text-landing-status-violet' },
    ],
    nextStep:
      'Prochaine étape dans la boussole : discuter de la question controversée avec le groupe. Accède à la question d’un simple geste.',
  },
  compass: {
    eyebrow: 'Pendant la session',
    title: 'La boussole de modération t’aide à choisir la prochaine étape',
    lead: 'Pendant une session, la boussole propose une prochaine étape à partir des questions en attente, du nuage de mots, des résultats du quiz et du retour sur le rythme. Tu peux consulter les signaux et essayer l’action proposée avec le groupe.',
    summary: [
      'Ouvre « Boussole » depuis une vue en direct.',
      'En haut, « Prochaine étape » propose une action concrète.',
      'En dessous, retrouve les signaux sur le rythme, les questions controversées et les points à clarifier.',
      'Accède directement à la question, au nuage de mots ou aux résultats.',
      'C’est toi qui décides. La boussole ne pilote jamais la session toute seule.',
    ],
    docsLink: 'Comprendre le fonctionnement de la boussole',
    tryLink: 'L’essayer dans l’application',
    demoAria: 'Exemple de boussole de modération avec prochaine étape et signaux en direct',
    hostView: 'Vue de l’animateur',
    demoTitle: 'Boussole de modération',
    nextLabel: 'Prochaine étape',
    nextTitle: 'Discuter de la question controversée avec le groupe',
    nextText:
      'La question sur le masquage des résultats divise le groupe. Prends le temps de la clarifier avant de poursuivre.',
    cards: [
      {
        label: 'Questions controversées',
        text: 'Le groupe est partagé : la question reçoit de nombreux votes pour et contre.',
        tone: 'rose',
      },
      {
        label: 'Retour sur le rythme de l’exposé',
        text: 'Plusieurs personnes signalent un rythme trop rapide. Une courte pause peut aider.',
        tone: 'amber',
      },
      {
        label: 'À clarifier',
        text: 'Une question très soutenue attend encore ta réponse.',
        tone: 'violet',
      },
    ],
    sourcesLabel: 'Aller directement à',
    sources: ['Q&R', 'Nuage de mots', 'Quiz', 'Feedback express'],
    note: 'La boussole utilise uniquement les informations déjà accessibles dans la vue d’animation. Elle n’évalue pas les personnes.',
  },
  workflow: {
    eyebrow: 'Pour l’enseignement, la formation et les ateliers',
    title: 'De l’idée à la session en direct en quelques minutes',
    lead: 'Prépare tes contenus, invite le public et anime la session. Le parcours guide les enseignants, les formateurs et les équipes d’animation de la préparation à l’analyse des résultats.',
    stepLabel: 'Étape',
    steps: [
      {
        number: '01',
        title: 'Préparer un quiz',
        description:
          'Crée tes questions ou importe des contenus existants, entièrement sur smartphone et dans tous les formats. Utilise Markdown et KaTeX, des réponses courtes, des estimations numériques, des associations, des mises en ordre ou des classements par catégorie.',
      },
      {
        number: '02',
        title: 'Partager la collection',
        description:
          'La collection de quiz reste sur ton appareil, ce qui contribue à la protection des données. Si tu dois utiliser un ordinateur d’emprunt dans la salle, tu la récupères avec un lien de synchronisation plutôt qu’avec une clé USB. Tu peux donner le même lien à des collègues pour utiliser et modifier la collection ensemble. Tu crées le lien dans la collection de quiz ; tu colles le lien reçu sur la page d’accueil.',
      },
      {
        number: '03',
        title: 'Démarrer une session',
        description:
          'Démarre sans compte : ouvre une session, choisis un style et partage le code ou le code QR. Tu peux aussi connecter un téléphone ou une tablette et ouvrir la vue présentateur sur le projecteur.',
      },
      {
        number: '04',
        title: 'Animer en direct',
        description:
          'Pilote la session depuis ton smartphone en te déplaçant dans la salle. Les participants répondent, posent des questions et définissent ensemble les priorités. La boussole de modération propose une prochaine étape. La vue d’animation et la vue présentateur donnent accès au quiz, à l’espace Q&R, au feedback express, au nuage de mots, à la phase de lecture, au compte à rebours, au second tour et aux résultats.',
      },
      {
        number: '05',
        title: 'Analyser et exporter',
        description:
          'Après la session, consulte le rapport PDF avec le niveau de maîtrise, la confiance dans les réponses et les textes complets des questions. Le débriefing et le rapport de la dernière session restent accessibles depuis la collection de quiz. L’export CSV pour Excel se trouve sous « Plus ».',
      },
    ],
  },
  pairing: {
    eyebrow: 'Ce qui nous distingue',
    title: 'Piloter la présentation depuis un téléphone ou une tablette',
    lead: 'Connecte un téléphone ou une tablette pour piloter la session en te déplaçant dans la salle. Scanne le code QR et confirme la connexion sur l’ordinateur. L’appareil connecté reçoit uniquement les commandes de la session en cours, sans compte supplémentaire.',
    whyTitle: 'Les possibilités de l’appareil connecté',
    summary: [
      'Déplace-toi librement dans la salle tout en pilotant la présentation.',
      'Retrouve les commandes de la session : questions, résultats, Q&R, feedback express et fin de session. Le pilotage va au-delà du défilement des diapositives.',
      'Sans compte sur le téléphone : confie les commandes à une personne qui t’assiste sans partager de mot de passe.',
      'Aucun identifiant à partager : le code QR s’affiche sur l’ordinateur, où tu confirmes la connexion. Le téléphone reçoit uniquement les droits de pilotage de cette session.',
      'La collection de quiz reste sur l’ordinateur. L’appareil connecté ne permet pas de modifier ou de supprimer les quiz.',
    ],
    laptopLabel: 'Ordinateur et projecteur',
    laptopText:
      'L’ordinateur et le projecteur affichent la présentation. C’est ici que tu confirmes la connexion. La collection de quiz reste ici.',
    phoneLabel: 'Téléphone ou tablette',
    phoneText:
      'Pilote la session en cours depuis la salle, sans connexion supplémentaire à un compte.',
    demoAria: 'L’ordinateur affiche la présentation ; le téléphone pilote la session',
  },
  features: {
    eyebrow: 'Ce qui distingue arsnova.eu',
    title: 'Tout pour faire participer le public en direct',
    lead: 'Démarre sans compte et dispose d’outils pour préparer, animer et analyser les échanges. Le code source ouvert permet aussi d’examiner le fonctionnement de la plateforme.',
    items: [
      {
        title: 'Créer et animer depuis un smartphone',
        description:
          'Crée des questions de tous types sur smartphone et pilote le quiz, les Q&R, le feedback express et les résultats depuis la même interface. Tu peux animer sans ordinateur ou connecter un appareil à la présentation projetée.',
        icon: 'phone',
      },
      {
        title: 'Présenter depuis n’importe où dans la salle',
        description:
          'Connecte un téléphone ou une tablette pour piloter les questions, les résultats, les Q&R, le feedback express et la fin de session. Le code QR s’affiche sur l’ordinateur, où tu confirmes la connexion. La collection de quiz reste sur l’ordinateur. Tu peux confier l’appareil connecté à une autre personne sans partager de mot de passe.',
        icon: 'presenter',
      },
      {
        title: 'Démarrer en quelques instants',
        description:
          'Les animateurs démarrent sans compte. Les participants rejoignent la session directement avec un code à six caractères ou un QR.',
        icon: 'single',
      },
      {
        title: 'Autoévaluation dans le quiz en direct',
        description:
          'Les participants indiquent leur confiance après leur réponse. Repère les réponses incorrectes données avec une confiance élevée, prépare le débriefing et retrouve le niveau de maîtrise dans le rapport PDF.',
        icon: 'confidence',
      },
      {
        title: 'Rapport de résultats pour le suivi',
        description:
          'Après la session, tu exportes un rapport PDF prêt à imprimer avec graphiques, textes des questions et autoévaluation. Le CSV pour Excel reste optionnel sous « Plus ».',
        icon: 'export',
      },
      {
        title: 'Estimer des valeurs numériques',
        description:
          'Dates, ordres de grandeur et mesures peuvent être estimés avec valeur de référence, bande de tolérance, statistiques et second tour optionnel.',
        icon: 'estimate',
      },
      {
        title: 'Plus qu’un quiz standard',
        description:
          'QCM/QCU, réponses courtes, évaluations, association, mise en ordre, classement, phase de lecture, Peer Instruction et mode présentateur soutiennent l’apprentissage et l’animation en direct.',
        icon: 'toggle',
      },
      {
        title: 'Un espace dédié aux questions du public',
        description:
          'L’espace Q&R propose la pré-modération, l’épinglage, l’archivage, les votes positifs et négatifs et le tri par solde des votes, forte adhésion ou controverse.',
        icon: 'qa',
      },
      {
        title: 'Faire ressortir les thèmes dans un nuage de mots',
        description:
          'Les réponses libres et les questions Q&R sont regroupées en mots et groupes de mots. Pour les Q&R, la pondération suit le mode de tri : solde des votes, forte adhésion ou controverse.',
        icon: 'cloud',
      },
      {
        title: 'Boussole de modération en session',
        description:
          'Consulte les signaux sur le rythme, une question controversée ou un résultat du quiz à reprendre. Ouvre « Boussole » pour voir l’action proposée et décider de la suite.',
        icon: 'compass',
      },
      {
        title: 'Pour des contextes variés',
        description:
          'Préréglages, mode équipe, mode anonyme, pseudonymes et choix de style s’adaptent à différents contextes : classes, séminaires, ateliers, événements et réunions.',
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
          'Les contenus de quiz restent sur ton appareil. La suppression optionnelle des données et l’exploitation sur ta propre infrastructure te donnent plus de contrôle sur les contenus et les données en direct.',
        icon: 'tools',
      },
      {
        title: 'Open source, du déploiement à l’exploitation',
        description:
          'Docker, Postgres, Redis et journal d’administration rendent la plateforme fiable aussi pour l’hébergement, l’exploitation et la traçabilité.',
        icon: 'server',
      },
    ],
  },
  leaderboard: {
    eyebrow: 'Style Ludique',
    title: 'Un classement qui donne du rythme à la session',
    lead: 'Pseudonymes d’animaux, points et bonnes réponses : le classement affiche les résultats sans noms réels. Le style Ludique apporte une présentation sombre et lisible aux résultats en direct.',
    points: [
      'Des pseudonymes à la place des noms réels',
      'Points et bonnes réponses d’un seul coup d’œil',
      'Le même aspect en mode clair et sombre',
    ],
    demoAria: 'Exemple de classement en direct avec le style Ludique',
    boardTitle: 'Classement',
    winnerLabel: 'En tête',
    winnerMeta: 'Avec {score} points',
    rankCol: 'Rang',
    nicknameCol: 'Pseudonyme',
    pointsCol: 'Points',
    correctCol: 'Bonnes réponses',
    names: [
      'Chat corail',
      'Perroquet coloré',
      'Ours brun',
      'Souris vert olive',
      'Cygne bleu clair',
      'Dragon rouge',
      'Papillon rose',
      'Ours brun 2',
      'Dragon rouge 8',
      'Girafe bleu ciel',
    ],
  },
  structuredQuestionTypes: {
    eyebrow: 'Formats de questions structurées',
    title: 'Associer, ordonner et classer — des interactions complètes et analysables',
    lead: 'Trois formats permettent d’explorer de manière interactive les relations, les enchaînements et les distinctions entre notions — et tu les crées entièrement sur smartphone. Les solutions restent cachées pendant le vote ; elles apparaissent avec les erreurs fréquentes après la révélation.',
    interactionLabel: 'Interaction',
    exampleLabel: 'Exemple pédagogique',
    resultLabel: 'Résultats',
    scoringNote:
      'Les trois formats sont notés. Une réponse obtient actuellement tous les points ou aucun ; aucun crédit partiel n’est attribué.',
    revealNote:
      'Pendant un tour actif, les bonnes associations, l’ordre attendu et les catégories cibles restent cachés. La solution modèle et les répartitions détaillées apparaissent après la révélation.',
    items: [
      {
        id: 'matching',
        title: 'Associer',
        description:
          'Associer un à un des termes, des définitions ou des exemples. Les résultats font apparaître les confusions les plus fréquentes.',
        interaction:
          'Chaque terme reçoit une seule cible, chaque cible n’est utilisée qu’une fois et toutes les associations doivent être complétées.',
        example: 'Associer des dates historiques aux événements correspondants.',
        result: 'Paires correctes, taux de réussite et cibles souvent confondues.',
        symbol: 'A↔B',
      },
      {
        id: 'ordering',
        title: 'Ordonner',
        description:
          'Remettre dans le bon ordre des étapes, des événements ou des phases d’un processus. Les résultats montrent les positions qui ont suscité des hésitations.',
        interaction:
          'Remets tous les éléments dans l’ordre avec les commandes de déplacement visibles ou le clavier. Le glisser-déposer n’est pas obligatoire.',
        example: 'Ordonner les étapes d’un processus biologique.',
        result: 'Ordre correct, répartition par position et inversions fréquentes.',
        symbol: '1→3',
      },
      {
        id: 'categorisation',
        title: 'Classer',
        description:
          'Classer des termes ou des exemples dans les catégories appropriées. Les résultats font apparaître les distinctions bien comprises et les erreurs de classement fréquentes.',
        interaction:
          'Chaque élément reçoit exactement une catégorie et tous les éléments doivent être classés.',
        example: 'Classer des œuvres littéraires par période.',
        result: 'Catégories correctes, répartition des réponses et erreurs fréquentes.',
        symbol: '▦',
      },
    ],
  },
  accessibility: {
    eyebrow: 'Accessibilité',
    title: 'WCAG 2.2 AA — pour que davantage d’apprenant·es participent en autonomie',
    lead: 'arsnova.eu est conforme aux Règles pour l’accessibilité des contenus web (WCAG) 2.2, niveau AA. Navigation au clavier, lecteurs d’écran, temps de réponse personnel et rapports PDF structurés facilitent la participation dans l’enseignement et la formation.',
    benefits: [
      {
        title: 'Utilisation au clavier',
        description:
          'Toi et tes participants utilisez les parcours centraux sans souris. Des indicateurs de focus visibles et un lien d’évitement vers le contenu facilitent la navigation.',
      },
      {
        title: 'Prise en charge des lecteurs d’écran en direct',
        description:
          'Les lecteurs d’écran annoncent les changements importants lors de l’entrée dans une session, de l’envoi d’une réponse et du passage à une nouvelle phase.',
      },
      {
        title: 'Temps de réponse ajustable individuellement',
        description:
          'Pour les questions chronométrées, tu choisis le temps standard, le temps décuplé ou une participation sans limite. Ces options permettent d’adapter le temps de réponse aux besoins de chacun.',
      },
      {
        title: 'Rapport de résultats structuré de façon accessible',
        description:
          'Le rapport prêt à imprimer est validé PDF/UA-1 et contient un titre, une langue et des balises de structure — pour le suivi et un partage accessible.',
      },
    ],
    statementLink: 'Ouvrir la déclaration d’accessibilité',
  },
  trust: {
    eyebrow: 'Confiance',
    title: 'Une longue expérience de l’interaction en direct',
    lead: 'arsnova.eu s’inscrit dans l’écosystème ARSnova et s’appuie sur de nombreuses années de recherche, de pratique pédagogique et de développement dans les technologies éducatives.',
    proofItems: [
      {
        value: 'Depuis 2012',
        label: 'ARSnova au service de l’enseignement et des technologies éducatives',
      },
      {
        value: 'WCAG 2.2 AA',
        label: 'Accessibilité vérifiée pour l’enseignement et les institutions',
      },
      {
        value: '5 langues d’interface',
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
    title: 'Comparer arsnova.eu avec Mentimeter et Kahoot!',
    lead: 'L’objectif n’est pas seulement de voter, mais de couvrir tout le déroulement en direct : préparer sur le téléphone, animer n’importe où dans la salle, rendre les résultats visibles et garder le contrôle sur les contenus et l’exploitation.',
    points: [
      {
        title: 'Créer et animer depuis un smartphone',
        description:
          'Crée des questions de tous types et pilote le quiz, les Q&R, le feedback express et les résultats depuis un smartphone. Tu peux aussi utiliser un ordinateur et un projecteur. Toutes les commandes restent disponibles sur téléphone.',
      },
      {
        title: 'Animer en se déplaçant dans la salle',
        description:
          'D’autres outils proposent une télécommande avec une connexion séparée ou limitée au défilement des diapositives. Ici, scanne le code QR et confirme la connexion sur l’ordinateur. Le téléphone pilote les questions, les résultats, les Q&R, le feedback express et la fin de session, sans compte propre. La collection de quiz reste sur l’ordinateur.',
      },
      {
        title: 'Un accès simple pour tous',
        description:
          'La création et la participation sont accessibles sans compte. Lance une session et invite les participants à la rejoindre avec un code ou un code QR.',
      },
      {
        title: 'Plus de formats d’interaction',
        description:
          'Outre le quiz : association, mise en ordre, classement, estimation numérique, phase de lecture, Peer Instruction, feedback express, mur de questions, nuage de mots pondéré et boussole de modération sur la même plateforme.',
      },
      {
        title: 'Plus de contrôle sur les données et l’accès',
        description:
          'Open source, exploitable sur ta propre infrastructure et avec des contenus de quiz conservés localement — plus la conformité aux WCAG 2.2, niveau AA. Pertinent pour les écoles, universités et organisations avec des exigences de confidentialité et d’inclusion.',
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
          'Non. Une session peut démarrer sans compte. Les participants rejoignent la session à l’aide d’un code ou d’un code QR.',
      },
      {
        question: 'Puis-je créer un quiz et animer une session entièrement depuis un smartphone ?',
        answer:
          'Oui. Crée des questions de tous types sur smartphone : réponse unique, réponses multiples, réponse courte, estimation numérique, association, mise en ordre et classement par catégorie. Utilise la même vue d’animation pour piloter le quiz, les Q&R, le feedback express et les résultats. Tu peux aussi connecter un second appareil : la présentation reste sur l’ordinateur et le téléphone pilote la session, sans compte supplémentaire.',
      },
      {
        question: 'Puis-je piloter la session depuis mon téléphone ?',
        answer:
          'Oui. Au lancement de la présentation, scanne le code QR affiché sur l’ordinateur, puis confirme la connexion sur celui-ci. Sans compte supplémentaire, le téléphone permet de piloter les questions, les résultats, les Q&R, le feedback express et la fin de session. La collection de quiz reste sur l’ordinateur. Tu peux confier le téléphone à une personne qui t’assiste sans partager de mot de passe.',
      },
      {
        question: 'Où sont les données ?',
        answer:
          'Les contenus de quiz restent sur ton appareil. Pour les sessions en direct, seules les données de session techniquement nécessaires sont traitées ; si tu héberges toi-même, l’exploitation reste dans ton infrastructure.',
      },
      {
        question:
          'Puis-je utiliser la collection de quiz sur un autre appareil ou avec des collègues ?',
        answer:
          'Oui. La collection reste volontairement sur ton appareil — un choix important pour le respect du RGPD. Si tu dois utiliser un ordinateur d’emprunt dans la salle, tu la récupères avec un lien de synchronisation plutôt qu’avec une clé USB. Tu peux donner le même lien à des collègues pour utiliser et modifier la collection ensemble. Tu crées le lien dans la collection de quiz ; tu colles le lien reçu sur la page d’accueil.',
      },
      {
        question: 'Puis-je héberger arsnova.eu moi-même ?',
        answer:
          'Oui. La plateforme est open source et conçue pour fonctionner avec Docker, PostgreSQL et Redis.',
      },
      {
        question: 'À quoi sert la confiance dans la réponse ?',
        answer:
          'Pour les questions notées, tu peux demander aux participants d’indiquer leur confiance dans leur réponse sur une échelle de 1 à 5. Cela ne change pas les points. Le croisement entre l’exactitude des réponses et la confiance aide à repérer de possibles conceptions erronées, notamment lorsqu’une réponse incorrecte est donnée avec une confiance élevée. Ces informations alimentent le débriefing et le rapport PDF après la session.',
      },
      {
        question: 'Puis-je exporter les résultats de session ?',
        answer:
          'Oui. Après la session, exporte le rapport PDF avec la confiance dans les réponses, les points à reprendre lors du débriefing et les textes complets des questions. Le débriefing et le rapport de la dernière session sont accessibles depuis la collection de quiz. L’export CSV pour Excel se trouve sous « Plus ».',
      },
      {
        question: 'Qu’a de particulier la question d’estimation numérique ?',
        answer:
          'Elle distingue les valeurs autorisées à la saisie de la plage considérée comme correcte. Les résultats restent masqués pendant le vote. Après une discussion, un second tour permet de comparer les estimations à l’aide de statistiques.',
      },
      {
        question: 'Que peut faire le mur de questions ?',
        answer:
          'Les participants posent des questions et votent pour ou contre celles des autres. La modération peut publier, épingler, archiver ou supprimer les questions et les trier par solde des votes, forte adhésion ou controverse.',
      },
      {
        question: 'En quoi le nuage de mots Q&R est-il différent ?',
        answer:
          'Il regroupe les questions visibles en mots et groupes de mots, avec la pondération du mode de tri actif. Il met ainsi en évidence les thèmes issus des questions soutenues, suscitant une forte adhésion ou controversées.',
      },
      {
        question: 'Que fait la boussole de modération ?',
        answer:
          'Pendant la session, elle propose une prochaine étape à partir des questions en attente, du nuage de mots, des résultats du quiz et du retour sur le rythme. L’action apparaît sous « Prochaine étape », suivie des signaux qui la motivent. Accède à la source pour décider de la suite. La boussole ne lance aucune action automatiquement.',
      },
      {
        question: 'À qui s’adresse la plateforme ?',
        answer:
          'La plateforme s’adresse à toute personne qui souhaite faire participer un public dans un cours, un séminaire, une formation, un atelier, un événement ou une réunion.',
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
    lead: 'Essaie les formats en direct et la boussole de modération dans l’application. Tu peux aussi consulter le code source, le fonctionnement des Q&R et des nuages de mots, ainsi que la documentation de déploiement et d’exploitation.',
  },
  jsonLd: {
    websiteName: 'arsnova.eu – Informations',
    webAppDescription:
      'Plateforme gratuite et open source pour faire participer le public : quiz en direct, estimations numériques, questions-réponses, nuages de mots et feedback express. Création et animation depuis un smartphone, confiance dans la réponse, rapports PDF, conformité WCAG 2.2 AA, sans compte et auto-hébergeable.',
    featureList: [
      'Quiz en direct et votes',
      'Autoévaluation sur les questions notées',
      'Rapport de résultats (PDF) et bilan après la session',
      'Questions d’estimation numérique avec deux tours et statistiques',
      'Mur de questions avec modération, votes pour et contre',
      'Boussole de modération avec prochaine étape à partir des signaux en direct',
      'Salle d’attente, présentateur, QR/code',
      'Création de quiz et animation depuis un smartphone, avec tous les types de questions',
      'Pilotage de la session en direct depuis un téléphone ou une tablette',
      'Types de questions QCM/QCU/réponses courtes/texte libre/sondage/évaluation/estimation numérique/association/mise en ordre/classement',
      'Markdown et KaTeX',
      'Phase de lecture et Peer Instruction',
      'Nuages de mots issus des Q&R et des réponses libres, avec groupes de mots et pondération',
      'Tri par solde des votes, forte adhésion et controverse',
      'Mode équipe et préréglages',
      'Classement, séries de bonnes réponses et codes bonus',
      'Import/export et synchronisation Yjs',
      'Import de quiz créés avec une IA externe et vérification du format',
      'Interface en cinq langues',
      'Conforme aux WCAG 2.2, niveau AA',
      'Exploitation Docker sur ton infrastructure et journal d’administration',
      'Contenus de quiz conservés localement et fonctionnement dans le respect du RGPD',
    ],
  },
};

export default fr;

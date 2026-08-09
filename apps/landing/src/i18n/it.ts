import type { Messages } from './types';

const it: Messages = {
  meta: {
    homeTitle: 'arsnova.eu | Quiz in diretta, domande di stima numerica e bacheca delle domande',
    homeDescription:
      'Piattaforma open source di risposta interattiva per istruzione, formazione e organizzazioni: quiz in diretta con abbinamento, ordinamento e classificazione, autovalutazione, rapporto dei risultati (PDF), domande di stima numerica, bacheca delle domande moderabile, nuvola di parole e sondaggio rapido — conforme alle WCAG 2.2, livello AA, gratuita, eseguibile sulla propria infrastruttura e pronta senza account.',
    siteNameInfo: 'arsnova.eu – Informazioni',
    ogLocale: 'it_IT',
  },
  nav: {
    ariaLabel: 'Navigazione principale',
    workflow: 'Come funziona',
    features: 'Funzionalità',
    accessibility: 'Accessibilità',
    trust: 'Fiducia',
    comparison: 'Confronto',
    faq: 'FAQ',
    tryNow: 'Provalo ora',
    menuOpen: 'Apri menu',
    menuClose: 'Chiudi menu',
    menu: 'Menu',
    skipToContent: 'Vai al contenuto',
  },
  languageSwitcher: {
    label: 'Lingua',
    currentLanguage: 'Italiano',
    chooseLanguage: 'Scegli la lingua',
  },
  themeSwitcher: {
    label: 'Aspetto',
    system: 'Impostazione di sistema',
    light: 'Chiaro',
    dark: 'Scuro',
    chooseAppearance: 'Scegli l’aspetto',
  },
  footer: {
    impressum: 'Note legali',
    privacy: 'Privacy',
    accessibility: 'Accessibilità',
  },
  cta: {
    appOpen: 'Apri l’app',
    quizCreate: 'Crea un quiz',
    backToApp: 'Torna ad arsnova.eu',
    tryLive: 'Provalo in diretta ora',
    howItWorks: 'Come funziona',
    viewOpenSource: 'Consulta il codice sorgente',
  },
  hero: {
    eyebrow: 'Risposta interattiva per istruzione e organizzazioni',
    titleLine1: 'Quiz, stime,',
    titleLine2: 'moderazione delle domande',
    titleAccent1: 'in diretta e gratis',
    titleAccent2: ' senza account.',
    lead: 'arsnova.eu unisce quiz in diretta, domande di stima numerica, autovalutazione sulle domande valutate, bacheca delle domande, analisi a nuvola di parole e sondaggio rapido in un’unica interfaccia per scuole, università, formazione continua, workshop e imprese. Open source, eseguibile sulla propria infrastruttura e pensato per un funzionamento nel rispetto del GDPR.',
    a11yLink: 'Conforme alle WCAG 2.2, livello AA',
    a11ySuffix: '— tastiera, screen reader e tempo di risposta regolabile individualmente.',
    cards: [
      { title: 'In diretta subito', text: 'Condividi la sessione con codice o QR' },
      {
        title: 'Q&A con bacheca delle domande',
        text: 'Moderazione, voti e nuvola di parole tematica',
      },
      {
        title: 'Autovalutazione e analisi successiva',
        text: 'Individua i fraintendimenti, esporta il rapporto PDF',
      },
      {
        title: 'Open source ed eseguibile in autonomia',
        text: 'Docker, Postgres, Redis e registro di amministrazione',
      },
    ],
  },
  estimate: {
    eyebrow: 'Novità nel quiz in diretta',
    title: 'Stimare numeri, discutere e confrontare chiaramente il secondo turno',
    lead: 'La domanda di stima numerica è pensata per date, ordini di grandezza, misure e probabilità. Chi conduce imposta un valore di riferimento, un intervallo di immissione e una tolleranza; i partecipanti inseriscono solo un numero.',
    summary: [
      'La fascia di plausibilità limita le immissioni ammesse.',
      'La fascia di tolleranza valuta le stime accettabili sul piano disciplinare.',
      'Prima della pubblicazione nessuno vede la distribuzione.',
      'Turno 1 e turno 2 vengono confrontati dopo la discussione.',
    ],
    docsLink: 'Apri la documentazione della domanda di stima numerica',
    demoAria: 'Esempio di risultati per una domanda di stima numerica sulla Rivoluzione francese',
    hostView: 'Vista di chi conduce dopo la pubblicazione',
    demoQuestion: 'Quando iniziò la Rivoluzione francese?',
    reference: 'Riferimento 1789',
    toleranceBand: 'Fascia di tolleranza',
    toleranceValue: '1700–1900',
    plausibilityBand: 'Fascia di plausibilità',
    plausibilityValue: '1500–2000',
    histogramNote:
      'Istogramma, linea di riferimento e fascia di tolleranza compaiono solo dopo la pubblicazione dei risultati. Prima resta visibile solo un indicatore neutro di avanzamento.',
    median: 'Mediana',
    inBand: 'nella fascia',
    round2: 'Turno 2',
    round2Value: '14 risposte più vicine al valore di riferimento',
  },
  confidence: {
    eyebrow: 'Analisi didattica',
    title: 'Giusto o sbagliato — e quanto sicuri?',
    lead: 'Con l’autovalutazione i partecipanti indicano dopo la risposta quanto sono sicuri (1–5). Vedi non solo il tasso di risposte corrette, ma anche le risposte sbagliate con alta sicurezza — uno strumento utile per la valutazione formativa, il piano per la discussione dei risultati e il rapporto dei risultati (PDF) a fine sessione.',
    summary: [
      'Non è un tipo di domanda a sé — opzionale sulle domande valutate.',
      'Scala 1–5 dopo la risposta, senza effetto sui punti.',
      'Dopo la pubblicazione chi conduce vede correttezza × grado di sicurezza.',
      '«Sbagliato e sicuro» segnala possibili fraintendimenti.',
      'Dopo la sessione: rapporto dei risultati (PDF) e discussione dei risultati.',
    ],
    docsConfidence: 'Doc autovalutazione',
    docsExport: 'Doc rapporto dei risultati (PDF)',
    demoAria: 'Esempio di valutazione con autovalutazione dopo la pubblicazione',
    hostView: 'Vista di chi conduce dopo la pubblicazione',
    demoQuestion: 'Quale struttura è la più stabile?',
    badge: 'Autovalutazione',
    matrix: [
      { label: 'Corretta · sicurezza bassa', count: 3, tone: 'emerald' },
      { label: 'Corretta · sicurezza media', count: 8, tone: 'emerald' },
      { label: 'Corretta · sicurezza alta', count: 11, tone: 'emerald' },
      { label: 'Errata · sicurezza bassa', count: 2, tone: 'slate' },
      { label: 'Errata · sicurezza media', count: 4, tone: 'amber' },
      { label: 'Errata · sicurezza alta', count: 2, tone: 'rose' },
    ],
    falseHighTitle: '2 risposte sbagliate con alta sicurezza',
    falseHighText:
      'L’opzione B è stata scelta 2× con alto grado di sicurezza — un segnale di possibili fraintendimenti nella discussione dei risultati.',
    consolidated: 'Solido',
    misconceptionRisk: 'Rischio di fraintendimento',
    fragile: 'Fragile',
    afterSessionAria: 'Esportazione a fine sessione',
    afterSession: 'A fine sessione',
    debriefing: 'Discussione dei risultati',
    resultsPdf: 'Rapporto dei risultati (PDF)',
    exportNote:
      'Rapporto pronto per la stampa con stato di apprendimento, mappa di calore e testi delle domande — nella vista di chi conduce e sulla scheda quiz. Il CSV per Excel resta disponibile sotto «Altro».',
  },
  qaWall: {
    eyebrow: 'Q&A in diretta come spazio di moderazione',
    title: 'Raccogliere domande, ordinarle per priorità e leggerle come mappa tematica',
    lead: 'La bacheca delle domande non è una chat secondaria. È un canale in diretta dedicato per docenti e relatori: moderare i contributi, rilevare le priorità collettive, rendere visibili i punti controversi e portare i temi chiave in sala tramite una nuvola di parole Q&A pesata.',
    signals: [
      {
        label: 'Pre-moderazione',
        text: 'Pubblica le domande solo quando sono rilevanti nel contesto didattico.',
      },
      {
        label: 'Voto collettivo',
        text: 'I voti a favore e contro mostrano le priorità, i punti di disaccordo e le esigenze di chiarimento.',
      },
      {
        label: 'Nuvola di parole tematica',
        text: 'Parole e frasi sono pesate in base al sostegno, al consenso o alla controversia.',
      },
      {
        label: 'In arrivo: bussola di moderazione',
        text: 'Prima arrivano i segnali deterministici; l’analisi linguistica opzionale e la sintesi restano estensioni.',
      },
    ],
    docsLink: 'Apri la valutazione Q&A e la controversia su GitHub',
    demoAria: 'Esempio di bacheca delle domande con moderazione, voti e nuvola di parole',
    hostView: 'Vista Q&A di chi conduce',
    demoTitle: 'Domande sull’evento',
    moderationActive: 'Pre-moderazione attiva',
    sortMostSupported: 'Più sostenute',
    sortBest: 'Migliori domande',
    sortControversial: 'Controverse',
    questions: [
      {
        score: '+18',
        title: 'Quando una stima è ancora plausibile sul piano disciplinare?',
        meta: '15 positivi · 3 negativi · migliore domanda',
      },
      {
        score: '+4',
        title: 'Dobbiamo davvero nascondere i risultati prima della discussione?',
        meta: '9 positivi · 5 negativi · controversa',
      },
      {
        score: '+11',
        title: 'In cosa il Q&A differisce dal testo libero nel quiz?',
        meta: '11 positivi · 0 negativi · soprattutto sostenuta',
      },
    ],
    wordCloud: 'Nuvola di parole Q&A',
    wordCloudHint: 'Pesata in base al sostegno positivo e alla controversia.',
    frozenLive: 'Aggiornamenti in diretta in pausa',
    terms: [
      { label: 'Fascia di tolleranza', className: 'text-3xl text-landing-primary' },
      { label: 'Discussione', className: 'text-2xl text-landing-status-emerald' },
      { label: 'Q&A', className: 'text-4xl text-landing-fg' },
      { label: 'Plausibilità', className: 'text-xl text-landing-status-amber' },
      { label: 'Controversia', className: 'text-2xl text-landing-status-rose' },
      { label: 'Peer Instruction', className: 'text-lg text-landing-fg-muted' },
      { label: 'Moderazione', className: 'text-3xl text-landing-tertiary' },
      { label: 'Bisogno di chiarimento', className: 'text-xl text-landing-status-violet' },
    ],
    nextStep:
      'Prossimo passo: una bussola di moderazione deterministica, opzionalmente integrata da segnali di analisi linguistica asincroni e sintesi fondate sulle domande inviate.',
  },
  workflow: {
    eyebrow: 'Per didattica, formazione e workshop',
    title: 'Dall’idea alla sessione in diretta in pochi minuti',
    lead: 'Dalla domanda alla sessione in corso, il percorso evita di proposito passaggi inutili. È questo che rende l’avvio rapido e affidabile per docenti, formatori e moderatori.',
    stepLabel: 'Passo',
    steps: [
      {
        number: '01',
        title: 'Prepara un quiz',
        description:
          'Crea domande direttamente o importa contenuti esistenti. Markdown, KaTeX, risposta breve, stima numerica, abbinamento, ordinamento e classificazione sono integrati.',
      },
      {
        number: '02',
        title: 'Avvia una sessione',
        description:
          'Parti senza account: apri una sessione, scegli uno stile, condividi codice o QR e usa la vista presentatore se serve.',
      },
      {
        number: '03',
        title: 'Modera in diretta',
        description:
          'I partecipanti votano, pongono domande e definiscono insieme le priorità. Chi conduce e il presentatore mostrano il quiz, la bacheca delle domande, la nuvola di parole, la fase di lettura, il conto alla rovescia, il secondo turno e i risultati in un unico percorso.',
      },
      {
        number: '04',
        title: 'Analisi successiva ed esportazione',
        description:
          'A fine sessione il rapporto dei risultati (PDF) è pronto — con stato di apprendimento, autovalutazione e testi completi delle domande. Nella raccolta quiz trovi discussione dei risultati e PDF dell’ultima esecuzione; CSV per Excel sotto «Altro».',
      },
    ],
  },
  features: {
    eyebrow: 'Cosa distingue arsnova.eu',
    title: 'Pensato per l’interazione in diretta, non solo per sondaggi su slide',
    lead: 'arsnova.eu unisce avvio rapido, solidità didattica e una base tecnica trasparente. La piattaforma resta semplice nel quotidiano senza ridurre le possibilità.',
    items: [
      {
        title: 'Pronto in poco tempo',
        description:
          'Chi conduce parte senza account. I partecipanti entrano nella sessione direttamente con un codice a 6 cifre o un QR.',
        icon: 'single',
      },
      {
        title: 'Autovalutazione nel quiz in diretta',
        description:
          'I partecipanti indicano dopo la risposta quanto sono sicuri. Individui risposte sbagliate con alta sicurezza, dai priorità alla discussione dei risultati ed esporti lo stato di apprendimento nel rapporto dei risultati (PDF).',
        icon: 'confidence',
      },
      {
        title: 'Rapporto dei risultati per l’analisi successiva',
        description:
          'A fine sessione esporti un rapporto PDF pronto per la stampa con diagrammi, testi delle domande e autovalutazione. Il CSV per Excel resta opzionale sotto «Altro».',
        icon: 'export',
      },
      {
        title: 'Domande di stima numerica didattiche',
        description:
          'Date, ordini di grandezza e misure si possono stimare con valore di riferimento, fascia di tolleranza, statistica e secondo turno opzionale.',
        icon: 'estimate',
      },
      {
        title: 'Più di un quiz standard',
        description:
          'MC/SC, risposte brevi, valutazioni, abbinamento, ordinamento, classificazione, fase di lettura, Peer Instruction e modalità presentatore supportano apprendimento e moderazione in diretta.',
        icon: 'toggle',
      },
      {
        title: 'Bacheca delle domande invece di una chat secondaria',
        description:
          'Il Q&A offre pre-moderazione, fissaggio, archiviazione, voti a favore/contro e ordinamento per sostegno, qualità e controversia.',
        icon: 'qa',
      },
      {
        title: 'Nuvola di parole espressiva',
        description:
          'Testo libero e Q&A vengono condensati in parole e frasi; la bacheca pesa in base al consenso, a una maggioranza chiara o alla controversia.',
        icon: 'cloud',
      },
      {
        title: 'Per contesti diversi',
        description:
          'Impostazioni predefinite, modalità a squadre, modalità anonima, pseudonimi e scelta dello stile si adattano a contesti che vanno dalla classe e dal seminario al workshop, all’evento e alla riunione.',
        icon: 'bolt',
      },
      {
        title: 'Conforme alle WCAG 2.2, livello AA',
        description:
          'Uso da tastiera, annunci screen reader, tempo di risposta regolabile individualmente e rapporti PDF/UA-1 — così più persone possono partecipare in autonomia alle sessioni in diretta.',
        icon: 'a11y',
      },
      {
        title: 'Privacy e controllo',
        description:
          'I contenuti del quiz restano sul tuo dispositivo, la rimozione opzionale dei dati e la gestione sulla propria infrastruttura ti danno più controllo su contenuti e dati in diretta.',
        icon: 'tools',
      },
      {
        title: 'Open source con distribuzione e gestione',
        description:
          'Docker, Postgres, Redis e registro di amministrazione rendono la piattaforma affidabile anche per distribuzione, gestione operativa e tracciabilità.',
        icon: 'server',
      },
    ],
  },
  structuredQuestionTypes: {
    eyebrow: 'Tipi di domanda strutturati',
    title: 'Abbinare, ordinare e classificare con interazioni complete e risultati utili',
    lead: 'Tre formati trasformano relazioni, sequenze e confini concettuali in attività interattive. Le soluzioni restano nascoste durante la votazione e compaiono con gli errori frequenti solo dopo la rivelazione.',
    interactionLabel: 'Interazione',
    exampleLabel: 'Esempio didattico',
    resultLabel: 'Risultati',
    scoringNote:
      'Tutti e tre i formati assegnano un punteggio. Attualmente una risposta riceve tutti i punti oppure nessun punto; non sono previsti punteggi parziali.',
    revealNote:
      'Durante un turno attivo restano nascosti gli abbinamenti corretti, la sequenza prevista e le categorie di destinazione. La soluzione e le distribuzioni dettagliate compaiono dopo la rivelazione.',
    items: [
      {
        id: 'matching',
        title: 'Abbinare',
        description:
          'Abbinare uno a uno termini, definizioni o esempi. I risultati mettono in evidenza gli abbinamenti confusi più spesso.',
        interaction:
          'Ogni termine riceve una sola destinazione, ogni destinazione viene usata una volta e tutti gli abbinamenti devono essere completati.',
        example: 'Abbinare date storiche agli eventi corrispondenti.',
        result: 'Coppie corrette, tassi di successo e destinazioni confuse più spesso.',
        symbol: 'A↔B',
      },
      {
        id: 'ordering',
        title: 'Ordinare',
        description:
          'Disporre nella sequenza corretta passaggi, eventi o fasi di un processo. I risultati mostrano le posizioni che hanno creato maggiore incertezza.',
        interaction:
          'Tutti gli elementi formano una sequenza lineare completa con comandi di spostamento visibili e tastiera, senza richiedere il trascinamento.',
        example: 'Ordinare le fasi di un processo biologico.',
        result: 'Sequenza corretta, distribuzione per posizione e scambi frequenti.',
        symbol: '1→3',
      },
      {
        id: 'categorisation',
        title: 'Classificare',
        description:
          'Assegnare termini o esempi alle categorie appropriate. I risultati evidenziano le distinzioni comprese e gli errori di classificazione più frequenti.',
        interaction:
          'Ogni elemento riceve esattamente una categoria e tutti gli elementi devono essere classificati.',
        example: 'Classificare opere letterarie per periodo.',
        result: 'Classificazione corretta, distribuzione per categoria ed errori frequenti.',
        symbol: '▦',
      },
    ],
  },
  accessibility: {
    eyebrow: 'Accessibilità',
    title: 'WCAG 2.2 AA — così più persone possono partecipare in autonomia',
    lead: 'Per scuole, università e formazione continua l’accessibilità è spesso un criterio decisivo. arsnova.eu è conforme alle Web Content Accessibility Guidelines (WCAG) 2.2, livello AA — con uso da tastiera, supporto screen reader, tempo di risposta regolabile individualmente e rapporti PDF strutturati in modo accessibile.',
    benefits: [
      {
        title: 'Uso da tastiera',
        description:
          'Tu e i tuoi partecipanti usate i flussi centrali senza mouse. Indicatori di focus visibili e un link per saltare al contenuto facilitano la navigazione.',
      },
      {
        title: 'Supporto screen reader in diretta',
        description:
          'I cambiamenti di stato all’ingresso in sessione, durante le votazioni e ai cambi di fase vengono annunciati agli screen reader, così si può seguire il flusso.',
      },
      {
        title: 'Tempo di risposta regolabile individualmente',
        description:
          'Per le domande a tempo scegli tempo standard, tempo decuplicato o partecipazione senza limite. Così un’agevolazione si applica direttamente nella sessione in diretta.',
      },
      {
        title: 'Rapporto dei risultati strutturato in modo accessibile',
        description:
          'Il rapporto pronto per la stampa è validato PDF/UA-1 e include titolo, lingua e tag — per l’analisi successiva e la condivisione accessibile.',
      },
    ],
    statementLink: 'Apri la dichiarazione di accessibilità',
  },
  trust: {
    eyebrow: 'Fiducia',
    title: 'Costruito su un’esperienza consolidata',
    lead: 'arsnova.eu si inserisce nella tradizione dell’ecosistema ARSnova e si basa su esperienze scientifiche, didattiche e pratiche di molti anni di tecnologie educative.',
    proofItems: [
      { value: 'Dal 2012', label: 'Tradizione ARSnova in istruzione e tecnologie educative' },
      { value: 'WCAG 2.2 AA', label: 'Accessibilità verificata per didattica e istituzioni' },
      {
        value: '5 lingue UI',
        label: 'Tedesco, inglese, francese, spagnolo, italiano',
      },
      { value: 'Open source', label: 'Codice trasparente invece di sistemi opachi' },
    ],
    items: [
      {
        quote:
          'Percorso rispettoso della privacy: nessun dato personale memorizzato in modo permanente sul server.',
        source: 'DeLFI 2017',
        tag: 'Ricerca',
      },
      {
        quote: 'Valutazione UX a confronto diretto con Kahoot! come verifica empirica del design.',
        source: 'fnm-austria',
        tag: 'Studio',
      },
      {
        quote:
          'La protezione dei dati fin dalla progettazione e l’apertura tecnica sono un vero fattore distintivo per i contesti europei di tecnologie educative.',
        source: 'Analisi delle pubblicazioni',
        tag: 'Architettura',
      },
      {
        quote: 'Sperimentato in contesti educativi reali, non solo descritto come concetto.',
        source: 'Uso in contesti di insegnamento e formazione',
        tag: 'Pratica',
      },
    ],
    referencesPrefix: 'I riferimenti completi e la raccolta di pubblicazioni di base sono in',
    referencesLink: 'ARSnova-Recherche.pdf',
    referencesSuffix: 'su GitHub.',
  },
  comparison: {
    eyebrow: 'Differenziazione',
    title: 'Non solo un sostituto di Mentimeter o Kahoot',
    lead: 'L’obiettivo non è solo votare, ma coprire l’intero percorso in diretta: preparare, moderare, rendere visibili i risultati e mantenere il controllo su contenuti e gestione.',
    points: [
      {
        title: 'Meno barriere d’ingresso',
        description:
          'Nessuna logica di prodotto separata per «creare» e «entrare». Chi conduce parte senza account, i partecipanti entrano con codice o QR.',
      },
      {
        title: 'Più formati di interazione',
        description:
          'Oltre al quiz: abbinamento, ordinamento, classificazione, stima numerica, fase di lettura, Peer Instruction, sondaggio rapido, bacheca delle domande e nuvola di parole pesata in un’unica piattaforma.',
      },
      {
        title: 'Più controllo su dati e accesso',
        description:
          'Open source, eseguibile sulla propria infrastruttura e con contenuti del quiz conservati in locale — più conformità alle WCAG 2.2, livello AA. Rilevante per scuole, università e organizzazioni con requisiti di privacy e inclusione.',
      },
    ],
    comparePrefix: 'Il confronto completo delle funzioni resta nella documentazione:',
    compareLink: 'Apri il confronto su GitHub',
  },
  faq: {
    eyebrow: 'FAQ',
    title: 'Domande frequenti prima del primo utilizzo',
    answerLabel: 'Risposta',
    items: [
      {
        question: 'Chi conduce o i partecipanti hanno bisogno di un account?',
        answer:
          'No. Una sessione può partire senza account. I partecipanti entrano con codice o QR.',
      },
      {
        question: 'Dove sono i dati?',
        answer:
          'I contenuti del quiz restano sul tuo dispositivo. Per le sessioni in diretta vengono elaborati solo i dati di sessione tecnicamente necessari; con gestione sulla propria infrastruttura il controllo resta a te.',
      },
      {
        question: 'Posso eseguire arsnova.eu sulla mia infrastruttura?',
        answer:
          'Sì. La piattaforma è open source e progettata per funzionare con Docker, PostgreSQL e Redis.',
      },
      {
        question: 'Cos’è l’autovalutazione nel quiz?',
        answer:
          'Una domanda aggiuntiva opzionale dopo le domande valutate: i partecipanti indicano su una scala da 1 a 5 quanto sono sicuri della risposta. I punti restano invariati; nella valutazione di chi conduce vedi correttezza × grado di sicurezza e segni le risposte sbagliate con alta sicurezza come segnale di fraintendimento. A fine sessione lo stato di apprendimento confluisce nella discussione dei risultati e nel rapporto dei risultati (PDF).',
      },
      {
        question: 'Posso esportare i risultati della sessione?',
        answer:
          'Sì. A fine sessione il rapporto dei risultati (PDF) è il formato principale — con autovalutazione, priorità per la discussione dei risultati e testi completi delle domande. Nella raccolta quiz trovi discussione dei risultati e PDF dell’ultima esecuzione. I dati CSV tabellari sono disponibili sotto «Altro» per Excel.',
      },
      {
        question: 'Cosa ha di speciale la domanda di stima numerica?',
        answer:
          'Separa le immissioni ammesse dalla fascia di tolleranza disciplinare, non mostra la distribuzione durante il voto e può valutare un secondo turno dopo la discussione con statistica e confronto dei turni.',
      },
      {
        question: 'Cosa può fare la bacheca delle domande?',
        answer:
          'I partecipanti inviano domande e le pesano con voti a favore e contro. Chi conduce può pre-moderare, fissare, archiviare o rimuovere domande e ordinare l’elenco per sostegno, maggioranza chiara o controversia.',
      },
      {
        question: 'Cosa rende diversa la nuvola di parole Q&A?',
        answer:
          'Condensa le domande visibili in parole e frasi e segue la logica di ordinamento attiva. Così mostra non solo termini frequenti, ma raggruppamenti tematici da domande sostenute, chiaramente ben valutate o controverse.',
      },
      {
        question: 'Per chi è pensata la piattaforma?',
        answer:
          'Per l’interazione in diretta in istruzione e organizzazioni: scuola, università, formazione continua, formazione, workshop, evento o riunione.',
      },
      {
        question: 'arsnova.eu è accessibile?',
        answer:
          'arsnova.eu è conforme alle WCAG 2.2, livello AA. I flussi centrali sono usabili da tastiera, gli screen reader annunciano i cambiamenti di stato, il tempo di risposta delle domande a tempo è regolabile individualmente (tempo standard, tempo decuplicato o senza limite), e il rapporto dei risultati strutturato in modo accessibile è validato PDF/UA-1.',
        linkLabel: 'Apri la dichiarazione di accessibilità',
      },
    ],
  },
  ctaSection: {
    title: 'Pronto per la prossima sessione in diretta?',
    lead: 'Prova il percorso in diretta direttamente nell’app, oppure dai un’occhiata al codice sorgente aperto, alla logica Q&A, all’elaborazione della nuvola di parole e alle basi tecniche per distribuzione e gestione della piattaforma.',
  },
  jsonLd: {
    websiteName: 'arsnova.eu – Informazioni',
    webAppDescription:
      'Piattaforma open source di risposta interattiva per istruzione, formazione e organizzazioni: quiz in diretta con abbinamento, ordinamento e classificazione, autovalutazione, rapporto dei risultati (PDF), domande di stima numerica, bacheca delle domande moderabile, nuvola di parole e sondaggio rapido — conforme alle WCAG 2.2, livello AA, gratuita, eseguibile sulla propria infrastruttura e pronta senza account.',
    featureList: [
      'Quiz in diretta e votazioni',
      'Autovalutazione sulle domande valutate',
      'Rapporto dei risultati (PDF) e discussione dei risultati a fine sessione',
      'Domande di stima numerica con due turni e statistica',
      'Bacheca delle domande con moderazione, voti a favore e contro',
      'Sala d’attesa, presentatore, QR/codice',
      'Tipi di domanda MC/SC/risposte brevi/testo libero/sondaggio/valutazione/stima numerica/abbinamento/ordinamento/classificazione',
      'Markdown e KaTeX',
      'Fase di lettura e Peer Instruction',
      'Nuvola di parole Q&A e testo libero con frasi e pesatura',
      'Ordinamento per sostegno, maggioranza chiara e controversia',
      'Modalità a squadre e impostazioni predefinite',
      'Classifica, serie, codice bonus',
      'Importazione/esportazione e sincronizzazione Yjs',
      'Import IA esterno, validato Zod',
      'Interfaccia in cinque lingue',
      'Conforme alle WCAG 2.2, livello AA',
      'Esecuzione Docker sulla propria infrastruttura e registro di amministrazione',
      'Contenuti del quiz conservati in locale e funzionamento nel rispetto del GDPR',
    ],
  },
};

export default it;

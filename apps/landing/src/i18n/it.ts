import type { Messages } from './types';

const it: Messages = {
  meta: {
    homeTitle: 'arsnova.eu | Quiz, Q&A e nuvole di parole in diretta',
    homeDescription:
      'Crea e conduci quiz, Q&A, nuvole di parole e sondaggi rapidi dal telefono. Gratis, open source, installabile sui tuoi server e senza account. WCAG 2.2 AA.',
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
    eyebrow: 'Partecipazione del pubblico per istruzione e organizzazioni',
    titleLine1: 'Crea quiz, raccogli domande,',
    titleLine2: 'ascolta il tuo pubblico',
    titleAccent1: 'in diretta e gratis',
    titleAccent2: ' senza account.',
    lead: 'Combina quiz in diretta, stime numeriche, sicurezza nella risposta, domande del pubblico, nuvole di parole e sondaggi rapidi in una sessione. Crea tutti i tipi di domanda e conduci dal telefono una lezione, un workshop, un’attività formativa o una riunione. arsnova.eu è open source, si può installare sui propri server ed è progettato tenendo conto dei requisiti del GDPR.',
    a11yLink: 'Conforme alle WCAG 2.2, livello AA',
    a11ySuffix: ': tastiera, screen reader e tempo di risposta regolabile.',
    cards: [
      {
        title: 'Crea e conduci dal telefono',
        text: 'Crea tutti i tipi di domanda e conduci una sessione in diretta dal telefono',
      },
      {
        title: 'Q&A con bacheca delle domande',
        text: 'Moderazione, voti, nuvola di parole e bussola di moderazione',
      },
      {
        title: 'Sicurezza nella risposta e approfondimento',
        text: 'Individua possibili concezioni errate ed esporta un rapporto sui risultati in PDF',
      },
      {
        title: 'Open source e installabile sui tuoi server',
        text: 'Docker, PostgreSQL, Redis e registro delle attività di amministrazione',
      },
    ],
  },
  estimate: {
    eyebrow: 'Novità nel quiz in diretta',
    title: 'Stima, discuti e confronta due turni',
    lead: 'Usa le stime numeriche per date, ordini di grandezza, misure e probabilità. Imposta un valore di riferimento, un intervallo di inserimento e una tolleranza. I partecipanti devono solo inserire un numero.',
    summary: [
      'L’intervallo di inserimento determina quali valori si possono inserire.',
      'L’intervallo di tolleranza determina quali stime sono considerate corrette.',
      'La distribuzione delle risposte resta nascosta finché non vengono mostrati i risultati.',
      'Turno 1 e turno 2 vengono confrontati dopo la discussione.',
    ],
    docsLink: 'Apri la documentazione della domanda di stima numerica',
    demoAria: 'Esempio di risultati per una domanda di stima numerica sulla Rivoluzione francese',
    hostView: 'Vista di conduzione dopo la visualizzazione dei risultati',
    demoQuestion: 'Quando iniziò la Rivoluzione francese?',
    reference: 'Riferimento 1789',
    toleranceBand: 'Fascia di tolleranza',
    toleranceValue: '1700–1900',
    plausibilityBand: 'Intervallo di inserimento ammesso',
    plausibilityValue: '1500–2000',
    histogramNote:
      'L’istogramma, la linea di riferimento e l’intervallo di tolleranza compaiono dopo la visualizzazione dei risultati. Fino ad allora viene mostrato solo l’avanzamento della partecipazione.',
    median: 'Mediana',
    inBand: 'entro la tolleranza',
    round2: 'Turno 2',
    round2Value: '14 risposte più vicine al valore di riferimento',
  },
  confidence: {
    eyebrow: 'Analisi didattica',
    title: 'Risposta corretta o errata, e con quale sicurezza?',
    lead: 'Dopo aver risposto a una domanda con punteggio, i partecipanti possono indicare la propria sicurezza da 1 a 5. Puoi così individuare risposte errate date con alta sicurezza, che possono indicare una concezione errata. Usa questi segnali per preparare la discussione e ritrovali nel rapporto PDF al termine della sessione.',
    summary: [
      'Un’impostazione facoltativa per le domande con punteggio, non un tipo di domanda separato.',
      'Una scala da 1 a 5 dopo la risposta, senza effetto sui punti.',
      'Dopo aver mostrato i risultati, chi conduce può confrontare correttezza e sicurezza.',
      'Le risposte errate date con alta sicurezza possono indicare possibili concezioni errate.',
      'Al termine della sessione, usa il rapporto PDF per preparare la discussione dei risultati.',
    ],
    docsConfidence: 'Documentazione sulla sicurezza nella risposta',
    docsExport: 'Documentazione del rapporto sui risultati in PDF',
    demoAria:
      'Esempio di correttezza e sicurezza nella risposta dopo la visualizzazione dei risultati',
    hostView: 'Vista di conduzione dopo la visualizzazione dei risultati',
    demoQuestion: 'Quale struttura è la più stabile?',
    badge: 'Sicurezza nella risposta',
    matrix: [
      { label: 'Corretta · sicurezza bassa', count: 3, tone: 'emerald' },
      { label: 'Corretta · sicurezza media', count: 8, tone: 'emerald' },
      { label: 'Corretta · sicurezza alta', count: 11, tone: 'emerald' },
      { label: 'Errata · sicurezza bassa', count: 2, tone: 'slate' },
      { label: 'Errata · sicurezza media', count: 4, tone: 'amber' },
      { label: 'Errata · sicurezza alta', count: 2, tone: 'rose' },
    ],
    falseHighTitle: '2 risposte errate con alta sicurezza',
    falseHighText:
      'L’opzione B è stata scelta due volte con alta sicurezza. Può indicare una concezione errata da riprendere nella discussione.',
    consolidated: 'Consolidate',
    misconceptionRisk: 'Possibile concezione errata',
    fragile: 'Non ancora consolidate',
    afterSessionAria: 'Esportazione a fine sessione',
    afterSession: 'A fine sessione',
    debriefing: 'Discussione dei risultati',
    resultsPdf: 'Rapporto sui risultati (PDF)',
    exportNote:
      'Rapporto pronto per la stampa con comprensione, sicurezza nella risposta, mappa di calore e testi completi delle domande. Aprilo dalla vista di conduzione o dalla scheda del quiz. L’esportazione CSV per fogli di calcolo si trova in «Altro».',
  },
  qaWall: {
    eyebrow: 'Uno spazio per le domande del pubblico',
    title: 'Raccogli domande, stabilisci le priorità e individua i temi ricorrenti',
    lead: 'Usa Q&A per pubblicare le domande del pubblico, individuare le priorità e affrontare i disaccordi. Una nuvola di parole ponderata aiuta a portare i temi ricorrenti nella discussione.',
    signals: [
      {
        label: 'Pre-moderazione',
        text: 'Verifica le domande prima di pubblicarle per i partecipanti.',
      },
      {
        label: 'Voto collettivo',
        text: 'I voti a favore e contro mostrano le priorità, i punti di disaccordo e le esigenze di chiarimento.',
      },
      {
        label: 'Nuvola di parole tematica',
        text: 'Parole ed espressioni sono ponderate in base all’ordinamento scelto: saldo dei voti, consenso solido o controversia.',
      },
      {
        label: 'Bussola di moderazione',
        text: 'Un prossimo passo suggerito in base a domande, nuvole di parole, risultati e feedback sul ritmo.',
      },
    ],
    docsLink: 'Leggi come funzionano l’ordinamento Q&A e la controversia su GitHub',
    demoAria: 'Esempio di bacheca delle domande con moderazione, voti e nuvola di parole',
    hostView: 'Vista di conduzione Q&A',
    demoTitle: 'Domande sull’evento',
    moderationActive: 'Pre-moderazione attiva',
    sortMostSupported: 'Saldo dei voti',
    sortBest: 'Consenso solido',
    sortControversial: 'Controversia',
    questions: [
      {
        score: '+18',
        title: 'Quando una stima rientra in un intervallo accettabile?',
        meta: '15 favorevoli · 3 contrari · consenso solido',
      },
      {
        score: '+4',
        title: 'Dobbiamo davvero nascondere i risultati prima della discussione?',
        meta: '9 positivi · 5 negativi · controversa',
      },
      {
        score: '+11',
        title: 'In cosa il Q&A differisce dal testo libero nel quiz?',
        meta: '11 positivi · 0 negativi · la più sostenuta',
      },
    ],
    wordCloud: 'Nuvola di parole Q&A',
    wordCloudHint: 'La dimensione dei termini riflette la ponderazione delle domande.',
    frozenLive: 'Visualizzazione in pausa',
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
      'Prossimo passo nella bussola: discutere la domanda controversa con il gruppo. Aprila con un tocco.',
  },
  compass: {
    eyebrow: 'Ora, in sessione',
    title: 'La bussola di moderazione ti aiuta a scegliere il prossimo passo',
    lead: 'Durante la sessione, la bussola suggerisce un prossimo passo in base a domande senza risposta, nuvole di parole, risultati del quiz e feedback sul ritmo. Esamina i segnali, apri la fonte e decidi come proseguire.',
    summary: [
      'Tocca «Bussola» in qualsiasi vista in diretta.',
      '«Prossimo passo» propone un’azione concreta nella parte superiore.',
      'Sotto trovi feedback sul ritmo, domande controverse e punti da chiarire.',
      'Apri direttamente la domanda, la nuvola di parole o i risultati.',
      'Decidi tu. La bussola non conduce mai la sessione da sola.',
    ],
    docsLink: 'Come funziona la bussola',
    tryLink: 'Provala nell’app',
    demoAria: 'Esempio della bussola di moderazione con prossimo passo e segnali in diretta',
    hostView: 'Vista di conduzione',
    demoTitle: 'Bussola di moderazione',
    nextLabel: 'Prossimo passo',
    nextTitle: 'Discutere la domanda controversa con il gruppo',
    nextText:
      'La domanda sui risultati nascosti divide il gruppo. Chiariscila prima di proseguire.',
    cards: [
      {
        label: 'Domande controverse',
        text: 'Il gruppo è diviso: ci sono molti voti favorevoli e contrari.',
        tone: 'rose',
      },
      {
        label: 'Feedback sul ritmo della presentazione',
        text: 'Diverse persone segnalano un ritmo troppo veloce. Valuta una breve pausa.',
        tone: 'amber',
      },
      {
        label: 'Da chiarire',
        text: 'Una domanda molto sostenuta aspetta ancora la tua risposta.',
        tone: 'violet',
      },
    ],
    sourcesLabel: 'Vai direttamente a',
    sources: ['Q&A', 'Nuvola di parole', 'Quiz', 'Sondaggio rapido'],
    note: 'La bussola usa solo informazioni già disponibili a chi conduce la sessione. Non valuta i singoli partecipanti.',
  },
  workflow: {
    eyebrow: 'Per didattica, formazione e workshop',
    title: 'Dall’idea alla sessione in diretta in pochi minuti',
    lead: 'Prepara i contenuti, invita i partecipanti e conduci la sessione. Il percorso va dalla creazione delle domande all’esame dei risultati.',
    stepLabel: 'Passo',
    steps: [
      {
        number: '01',
        title: 'Prepara un quiz',
        description:
          'Crea domande o importa contenuti dal telefono, in tutti i formati. Usa Markdown, KaTeX, risposte brevi, stime numeriche, abbinamento, ordinamento e classificazione.',
      },
      {
        number: '02',
        title: 'Condividi la raccolta',
        description:
          'La raccolta di quiz resta sul tuo dispositivo, contribuendo a proteggere i dati. Aprila su un computer in prestito con un link di sincronizzazione invece di portare una chiavetta USB. Condividi il link con altre persone per usarla e modificarla insieme. Crea il link nella raccolta e incolla quelli ricevuti nella pagina iniziale.',
      },
      {
        number: '03',
        title: 'Avvia una sessione',
        description:
          'Inizia senza account: apri una sessione, scegli uno stile e condividi il codice di sessione o il codice QR. Puoi anche collegare un telefono o un tablet e aprire la vista presentazione su un proiettore.',
      },
      {
        number: '04',
        title: 'Conduci in diretta',
        description:
          'Controlla la sessione dal telefono mentre ti muovi nella sala. I partecipanti rispondono, pongono domande e aiutano a stabilire le priorità. La bussola di moderazione suggerisce un prossimo passo. Le viste di conduzione e presentazione riuniscono quiz, Q&A, sondaggi rapidi, nuvole di parole, fasi di lettura, conti alla rovescia, seconde votazioni e risultati.',
      },
      {
        number: '05',
        title: 'Esamina ed esporta',
        description:
          'Al termine della sessione, apri il rapporto PDF con comprensione, sicurezza nella risposta e testi completi delle domande. L’analisi e il rapporto dell’ultima sessione restano disponibili nella raccolta. L’esportazione CSV per fogli di calcolo si trova in «Altro».',
      },
    ],
  },
  pairing: {
    eyebrow: 'Cosa ci distingue',
    title: 'Controlla la presentazione dal telefono o dal tablet',
    lead: 'Collega un telefono o un tablet per controllare la sessione mentre ti muovi nella sala. Scansiona il codice QR e conferma il collegamento sul computer. Il dispositivo collegato riceve i comandi per la sessione corrente senza richiedere un altro account.',
    whyTitle: 'Che cosa può fare il dispositivo collegato',
    summary: [
      'Muoviti nella sala mantenendo il controllo della presentazione.',
      'Controlla domande, risultati, Q&A, sondaggi rapidi e la fine della sessione, oltre ad avanzare le diapositive.',
      'Senza account sul telefono: puoi passarlo a chi ti aiuta, senza condividere password.',
      'Nessuna credenziale da condividere: mostra il QR e conferma il collegamento sul computer. Il telefono riceve i comandi solo per questa sessione.',
      'La raccolta resta sul computer. Il dispositivo collegato non può modificare né eliminare quiz.',
    ],
    laptopLabel: 'Laptop e proiettore',
    laptopText:
      'Il computer e il proiettore mostrano la presentazione. Conferma qui il collegamento. La raccolta resta su questo computer.',
    phoneLabel: 'Telefono o tablet',
    phoneText: 'Controlla la sessione corrente mentre ti muovi nella sala, senza un altro account.',
    demoAria: 'Il laptop mostra la presentazione; il telefono controlla la sessione',
  },
  features: {
    eyebrow: 'Cosa distingue arsnova.eu',
    title: 'Tutto il necessario per la partecipazione del pubblico in diretta',
    lead: 'Inizia senza account e prepara, conduci ed esamina le sessioni in diretta. Il codice aperto permette di verificare come funziona la piattaforma.',
    items: [
      {
        title: 'Crea e conduci dal telefono',
        description:
          'Crea tutti i tipi di domanda dal telefono e controlla quiz, Q&A, sondaggi rapidi e risultati dalla stessa vista di conduzione. Conduci la sessione senza computer o collega un dispositivo per controllare una presentazione proiettata.',
        icon: 'phone',
      },
      {
        title: 'Presenta da qualsiasi punto della sala',
        description:
          'Collega un telefono o un tablet per controllare domande, risultati, Q&A, sondaggi rapidi e la fine della sessione. Scansiona il QR e conferma sul computer. La raccolta resta sul computer, così puoi affidare i comandi senza condividere password.',
        icon: 'presenter',
      },
      {
        title: 'Pronto in poco tempo',
        description:
          'Avvia una sessione senza account. I partecipanti entrano direttamente con un codice di 6 caratteri o un codice QR.',
        icon: 'single',
      },
      {
        title: 'Sicurezza nella risposta durante il quiz',
        description:
          'I partecipanti indicano quanto sono sicuri della risposta. Le risposte errate date con alta sicurezza possono indicare possibili concezioni errate. Usa questi segnali per preparare la discussione e ritrovarli nel rapporto PDF.',
        icon: 'confidence',
      },
      {
        title: 'Rapporto sui risultati per la discussione',
        description:
          'Al termine della sessione, esporta un rapporto PDF pronto per la stampa con grafici, testi delle domande e sicurezza nella risposta. L’esportazione CSV per fogli di calcolo resta disponibile in «Altro».',
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
          'Risposta singola e multipla, risposte brevi, valutazioni, abbinamento, ordinamento, classificazione, fase di lettura, Peer Instruction e presentazione per sostenere apprendimento e moderazione in diretta.',
        icon: 'toggle',
      },
      {
        title: 'Uno spazio per le domande del pubblico',
        description:
          'Q&A permette di verificare prima di pubblicare, mettere in evidenza, archiviare, votare a favore o contro e ordinare per saldo dei voti, consenso solido o controversia.',
        icon: 'qa',
      },
      {
        title: 'Nuvole di parole che mostrano i temi ricorrenti',
        description:
          'Riassumi testo libero e domande Q&A in parole ed espressioni. In Q&A, la dimensione dipende dalla ponderazione scelta: saldo dei voti, consenso solido o controversia.',
        icon: 'cloud',
      },
      {
        title: 'Bussola di moderazione in sessione',
        description:
          'Ricevi un suggerimento in base a feedback sul ritmo, domande controverse o risultati da discutere. Apri «Bussola», esamina i segnali e decidi il prossimo passo.',
        icon: 'compass',
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
          'Uso da tastiera, annunci degli screen reader, tempo di risposta regolabile individualmente e rapporti PDF/UA-1 — così più persone possono partecipare in autonomia alle sessioni in diretta.',
        icon: 'a11y',
      },
      {
        title: 'Privacy e controllo',
        description:
          'I quiz vengono salvati sul tuo dispositivo. Le opzioni di cancellazione dei dati e l’installazione sui tuoi server ti danno più controllo sui contenuti e sui dati delle sessioni.',
        icon: 'tools',
      },
      {
        title: 'Open source con distribuzione e gestione',
        description:
          'Docker, PostgreSQL, Redis e un registro delle attività di amministrazione permettono di ospitare e gestire la piattaforma e consultare le azioni amministrative.',
        icon: 'server',
      },
    ],
  },
  leaderboard: {
    eyebrow: 'Stile Giocoso',
    title: 'Una classifica che coinvolge il gruppo',
    lead: 'Nickname di animali, punti e risposte corrette: una classifica senza nomi reali. Lo stile Giocoso presenta i risultati in diretta con un aspetto scuro e leggibile.',
    points: [
      'Nickname di animali al posto dei nomi reali',
      'Punti e risposte corrette a colpo d’occhio',
      'Lo stesso aspetto in chiaro e in scuro',
    ],
    demoAria: 'Esempio di classifica in diretta nello stile Giocoso',
    boardTitle: 'Classifica',
    winnerLabel: 'In testa',
    winnerMeta: 'Con {score} punti',
    rankCol: 'Posizione',
    nicknameCol: 'Soprannome',
    pointsCol: 'Punti',
    correctCol: 'Corretto',
    names: [
      'Gatto corallo',
      'Pappagallo colorato',
      'Orso bruno',
      'Topo verde oliva',
      'Cigno azzurro',
      'Drago rosso',
      'Farfalla rosa',
      'Orso bruno 2',
      'Drago rosso 8',
      'Giraffa celeste',
    ],
  },
  structuredQuestionTypes: {
    eyebrow: 'Tipi di domanda strutturati',
    title: 'Abbina, ordina e classifica, con risultati da esaminare',
    lead: 'Esplora relazioni, sequenze e categorie con domande interattive che puoi creare interamente dal telefono. Le soluzioni restano nascoste durante la votazione. Dopo aver mostrato i risultati puoi esaminare le risposte corrette e gli errori frequenti.',
    interactionLabel: 'Interazione',
    exampleLabel: 'Esempio didattico',
    resultLabel: 'Risultati',
    scoringNote:
      'Tutti e tre i formati assegnano un punteggio. Attualmente una risposta riceve tutti i punti oppure nessun punto; non sono previsti punteggi parziali.',
    revealNote:
      'Durante la votazione restano nascosti gli abbinamenti corretti, l’ordine corretto e le categorie di destinazione. La soluzione e le distribuzioni dettagliate compaiono dopo la visualizzazione dei risultati.',
    items: [
      {
        id: 'matching',
        title: 'Abbinamento',
        description:
          'Abbinare uno a uno termini, definizioni o esempi. I risultati mettono in evidenza gli abbinamenti confusi più spesso.',
        interaction:
          'Abbina ogni elemento a sinistra a uno a destra. Ogni elemento viene usato una volta e tutti gli abbinamenti devono essere completati.',
        example: 'Abbinare date storiche agli eventi corrispondenti.',
        result: 'Abbinamenti corretti, tassi di risposte corrette e abbinamenti errati frequenti.',
        symbol: 'A↔B',
      },
      {
        id: 'ordering',
        title: 'Ordinamento',
        description:
          'Disporre nella sequenza corretta passaggi, eventi o fasi di un processo. I risultati mostrano le posizioni che hanno creato maggiore incertezza.',
        interaction:
          'Ordina tutti gli elementi con i comandi visibili o con la tastiera. Non è necessario trascinare.',
        example: 'Ordinare le fasi di un processo biologico.',
        result: 'Sequenza corretta, distribuzione per posizione e scambi frequenti.',
        symbol: '1→3',
      },
      {
        id: 'categorisation',
        title: 'Classificazione',
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
    lead: 'Per scuole, università e formazione continua l’accessibilità è spesso un criterio decisivo. arsnova.eu è conforme alle Web Content Accessibility Guidelines (WCAG) 2.2, livello AA — con uso della tastiera, supporto screen reader, tempo di risposta regolabile individualmente e rapporti PDF strutturati in modo accessibile.',
    benefits: [
      {
        title: 'Uso da tastiera',
        description:
          'I percorsi principali si possono usare senza mouse. Gli indicatori di focus visibili e un link per saltare al contenuto facilitano la navigazione.',
      },
      {
        title: 'Supporto screen reader in diretta',
        description:
          'Gli screen reader annunciano i cambiamenti importanti all’ingresso in sessione, all’invio delle risposte e al passaggio a un’altra fase.',
      },
      {
        title: 'Tempo di risposta regolabile individualmente',
        description:
          'Nelle domande con timer, scegli il tempo standard, «Tempo ×10» o «Senza scadenza». Queste opzioni permettono di adattare il tempo di risposta alle esigenze individuali durante la sessione.',
      },
      {
        title: 'Rapporto sui risultati con struttura accessibile',
        description:
          'Il rapporto pronto per la stampa è validato secondo PDF/UA-1 e include titolo, lingua e tag strutturali per l’approfondimento e la condivisione accessibile.',
      },
    ],
    statementLink: 'Apri la dichiarazione di accessibilità',
  },
  trust: {
    eyebrow: 'Fiducia',
    title: 'Costruito su un’esperienza consolidata',
    lead: 'arsnova.eu fa parte dell’ecosistema ARSnova e si basa su anni di ricerca, pratica didattica e sviluppo di tecnologie educative.',
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
    title: 'Confronta arsnova.eu con Mentimeter e Kahoot!',
    lead: 'Prepara i contenuti dal telefono, conduci la sessione mentre ti muovi nella sala, mostra i risultati e mantieni il controllo su contenuti e gestione.',
    points: [
      {
        title: 'Crea e conduci dal telefono',
        description:
          'Crea tutti i tipi di domanda dal telefono e controlla quiz, Q&A, sondaggi rapidi e risultati dalla stessa vista. Puoi usare un computer e un proiettore se ti servono.',
      },
      {
        title: 'Controllo della sessione mentre ti muovi nella sala',
        description:
          'Scansiona il QR e conferma il collegamento sul computer. Il telefono controlla domande, risultati, Q&A, sondaggi rapidi e la fine della sessione senza un altro account. La raccolta resta sul computer.',
      },
      {
        title: 'Meno barriere d’ingresso',
        description:
          'Puoi avviare una sessione senza account. I partecipanti entrano con il codice di sessione o il codice QR.',
      },
      {
        title: 'Più formati di interazione',
        description:
          'Oltre al quiz: abbinamento, ordinamento, classificazione, stima numerica, fase di lettura, Peer Instruction, sondaggio rapido, bacheca delle domande, nuvola di parole pesata e bussola di moderazione in un’unica piattaforma.',
      },
      {
        title: 'Più controllo su dati e accesso',
        description:
          'Codice aperto, installazione sui tuoi server e salvataggio locale dei quiz, insieme all’accessibilità secondo WCAG 2.2 AA. Opzioni utili per le istituzioni con requisiti di privacy e inclusione.',
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
        question: 'Serve un account per condurre una sessione o partecipare?',
        answer:
          'No. Una sessione può partire senza account. I partecipanti entrano con codice o QR.',
      },
      {
        question: 'Posso creare un quiz e condurre una sessione per intero dal telefono?',
        answer:
          'Sì. Crea tutti i tipi di domanda dal telefono: risposta singola e multipla, risposta breve, stima numerica, abbinamento, ordinamento e classificazione. La stessa vista di conduzione controlla quiz, Q&A, sondaggi rapidi e risultati. Puoi anche collegare un altro dispositivo per controllare dal telefono una presentazione proiettata, senza un altro account.',
      },
      {
        question: 'Posso controllare la sessione dal telefono?',
        answer:
          'Sì. All’avvio della presentazione, mostra il QR sul computer e conferma lì il collegamento. Il telefono non richiede un account e riceve i comandi solo per la sessione corrente. Non può modificare né eliminare quiz. Puoi affidarlo a chi ti aiuta senza condividere password.',
      },
      {
        question: 'Dove sono i dati?',
        answer:
          'I contenuti del quiz restano sul tuo dispositivo. Per le sessioni in diretta vengono elaborati solo i dati di sessione tecnicamente necessari; con gestione sulla propria infrastruttura il controllo resta a te.',
      },
      {
        question: 'Posso usare la raccolta di quiz su un altro dispositivo o con altre persone?',
        answer:
          'Sì. Crea un link di sincronizzazione nella raccolta e incollalo nella pagina iniziale dell’altro dispositivo. Puoi così aprire la raccolta su un computer in prestito invece di portare una chiavetta USB. Condividi lo stesso link con altre persone per usare e modificare insieme la raccolta.',
      },
      {
        question: 'Posso eseguire arsnova.eu sulla mia infrastruttura?',
        answer:
          'Sì. La piattaforma è open source e progettata per funzionare con Docker, PostgreSQL e Redis.',
      },
      {
        question: 'Che cos’è la sicurezza nella risposta?',
        answer:
          'È un’impostazione facoltativa per le domande con punteggio. Dopo aver risposto, i partecipanti indicano la propria sicurezza da 1 a 5. Non influisce sui punti. Dopo aver mostrato i risultati, puoi confrontare correttezza e sicurezza. Una risposta errata data con alta sicurezza può indicare una concezione errata. Questi dati compaiono anche nel rapporto PDF.',
      },
      {
        question: 'Posso esportare i risultati della sessione?',
        answer:
          'Sì. Al termine della sessione, apri il rapporto sui risultati in PDF con sicurezza nella risposta, priorità per la discussione e testi completi delle domande. Il rapporto dell’ultima sessione resta disponibile nella raccolta. I dati CSV per fogli di calcolo si trovano in «Altro».',
      },
      {
        question: 'Cosa ha di speciale la domanda di stima numerica?',
        answer:
          'L’intervallo di inserimento determina i valori ammessi e quello di tolleranza determina quali risposte sono corrette. La distribuzione resta nascosta durante la votazione. Dopo una discussione puoi svolgere un secondo turno e confrontare le statistiche dei due turni.',
      },
      {
        question: 'Cosa può fare la bacheca delle domande?',
        answer:
          'I partecipanti inviano domande e votano a favore o contro. Chi conduce può verificare prima di pubblicare, mettere in evidenza, archiviare o eliminare domande e ordinarle per saldo dei voti, consenso solido o controversia.',
      },
      {
        question: 'Cosa rende diversa la nuvola di parole Q&A?',
        answer:
          'Riassume le domande visibili in parole ed espressioni. La dimensione segue la ponderazione dell’ordinamento attivo: saldo dei voti, consenso solido o controversia. Aiuta a individuare i temi ricorrenti e non valuta la correttezza delle domande.',
      },
      {
        question: 'Cosa fa la bussola di moderazione?',
        answer:
          'Durante la sessione, suggerisce un prossimo passo in base a domande senza risposta, nuvole di parole, risultati e feedback sul ritmo. «Prossimo passo» compare in alto e i segnali sotto. Apri la fonte e decidi come proseguire. La bussola non avvia azioni da sola.',
      },
      {
        question: 'Per chi è pensata la piattaforma?',
        answer:
          'Per sessioni partecipative a scuola, all’università, nella formazione continua, nei workshop, negli eventi e nelle riunioni.',
      },
      {
        question: 'arsnova.eu è accessibile?',
        answer:
          'arsnova.eu è conforme alle WCAG 2.2, livello AA. I percorsi principali si possono usare da tastiera e gli screen reader annunciano i cambiamenti importanti. Nelle domande con timer il tempo di risposta è regolabile: standard, «Tempo ×10» o «Senza scadenza». È disponibile una versione del rapporto PDF validata secondo PDF/UA-1.',
        linkLabel: 'Apri la dichiarazione di accessibilità',
      },
    ],
  },
  ctaSection: {
    title: 'Pronto per la prossima sessione in diretta?',
    lead: 'Prova una sessione in diretta e la bussola di moderazione, oppure consulta il codice sorgente e la documentazione delle funzioni e dell’installazione.',
  },
  jsonLd: {
    websiteName: 'arsnova.eu – Informazioni',
    webAppDescription:
      'Quiz, Q&A, nuvole di parole e sondaggi rapidi in diretta per istruzione e organizzazioni. Crea tutti i tipi di domanda e conduci dal telefono. Include sicurezza nella risposta e rapporti PDF. Gratis, open source, installabile sui tuoi server e senza account. WCAG 2.2 AA.',
    featureList: [
      'Quiz in diretta e votazioni',
      'Sicurezza nella risposta per le domande con punteggio',
      'Rapporto sui risultati in PDF e discussione al termine della sessione',
      'Domande di stima numerica con due turni e statistica',
      'Bacheca delle domande con moderazione, voti a favore e contro',
      'Bussola di moderazione con prossimo passo dai segnali in diretta',
      'Sala d’attesa, presentatore, QR/codice',
      'Creazione di tutti i tipi di domanda e controllo della sessione dal telefono',
      'Controllo della sessione da un telefono o un tablet collegato',
      'Risposta singola e multipla, risposta breve, testo libero, sondaggio, valutazione, stima numerica, abbinamento, ordinamento e classificazione',
      'Markdown e KaTeX',
      'Fase di lettura e Peer Instruction',
      'Nuvole di parole da Q&A e testo libero, con espressioni e ponderazione',
      'Ordinamento per saldo dei voti, consenso solido e controversia',
      'Modalità a squadre e impostazioni predefinite',
      'Classifica, serie di risposte corrette e codici bonus',
      'Importazione/esportazione e sincronizzazione Yjs',
      'Importazione di contenuti generati con IA esterna, validati con Zod',
      'Interfaccia in cinque lingue',
      'Conforme alle WCAG 2.2, livello AA',
      'Esecuzione Docker sulla propria infrastruttura e registro di amministrazione',
      'Contenuti del quiz conservati in locale e funzionamento nel rispetto del GDPR',
    ],
  },
};

export default it;

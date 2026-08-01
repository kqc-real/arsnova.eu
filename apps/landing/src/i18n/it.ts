import type { Messages } from './types';

const it: Messages = {
  meta: {
    homeTitle: 'arsnova.eu | Quiz live, stime numeriche e bacheca Q&A',
    homeDescription:
      'Audience response open source per istruzione, formazione e organizzazioni: quiz live, autovalutazione, rapporto dei risultati (PDF), stime numeriche, bacheca Q&A moderabile, word cloud e feedback — accessibile WCAG 2.2 AA, gratuito, self-hostabile e pronto senza account.',
    siteNameInfo: 'arsnova.eu – Informazioni',
    ogLocale: 'it_IT',
  },
  nav: {
    ariaLabel: 'Navigazione principale',
    workflow: 'Flusso',
    estimate: 'Stima',
    qa: 'Q&A',
    qaMobile: 'Bacheca delle domande',
    features: 'Vantaggi',
    accessibility: 'Accessibilità',
    trust: 'Fiducia',
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
  footer: {
    impressum: 'Note legali',
    privacy: 'Privacy',
    accessibility: 'Accessibilità',
  },
  cta: {
    appOpen: 'Apri l’app',
    quizCreate: 'Crea un quiz',
    backToApp: 'Torna ad arsnova.eu',
    tryLive: 'Provalo live ora',
    howItWorks: 'Come funziona',
    viewOpenSource: 'Vedi l’open source',
  },
  hero: {
    eyebrow: 'Audience response per istruzione e organizzazioni',
    titleLine1: 'Quiz, stime,',
    titleLine2: 'moderazione delle domande',
    titleAccent1: 'live e gratis',
    titleAccent2: ' senza account.',
    lead: 'arsnova.eu unisce quiz live, stime numeriche, autovalutazione sulle domande valutate, bacheca Q&A, analisi word cloud e sondaggio rapido in un’unica interfaccia per scuole, università, formazione continua, workshop e business. Open source, self-hostabile e pensato per un funzionamento orientato al GDPR.',
    a11yLink: 'Accessibile secondo WCAG 2.2 AA',
    a11ySuffix: '— tastiera, screen reader e tempo di risposta regolabile individualmente.',
    cards: [
      { title: 'Live subito', text: 'Condividi la sessione con codice o QR' },
      { title: 'Q&A con bacheca', text: 'Moderazione, voti e word cloud tematica' },
      {
        title: 'Autovalutazione e follow-up',
        text: 'Individua i fraintendimenti, esporta il rapporto PDF',
      },
      { title: 'Open source e self-hostabile', text: 'Docker, Postgres, Redis e audit admin' },
    ],
  },
  estimate: {
    eyebrow: 'Novità nel quiz live',
    title: 'Stimare numeri, discutere e confrontare chiaramente il secondo round',
    lead: 'La domanda di stima numerica è pensata per date, ordini di grandezza, misure e probabilità. Chi conduce imposta valore di riferimento, intervallo di input e tolleranza; i partecipanti inseriscono solo un numero.',
    summary: [
      'La fascia di plausibilità limita gli input ammessi.',
      'La fascia di tolleranza valuta le stime accettabili sul piano disciplinare.',
      'Prima della pubblicazione nessuno vede la distribuzione.',
      'Round 1 e round 2 vengono confrontati dopo la discussione.',
    ],
    docsLink: 'Apri la documentazione della stima',
    demoAria: 'Esempio di risultati per una stima sulla Rivoluzione francese',
    hostView: 'Vista host dopo la pubblicazione',
    demoQuestion: 'Quando iniziò la Rivoluzione francese?',
    reference: 'Riferimento 1789',
    toleranceBand: 'Fascia di tolleranza',
    toleranceValue: '1700–1900',
    plausibilityBand: 'Fascia di plausibilità',
    plausibilityValue: '1500–2000',
    histogramNote:
      'Istogramma, linea di riferimento e fascia di tolleranza compaiono solo dopo la pubblicazione dei risultati. Prima resta visibile solo il progresso neutrale.',
    median: 'Mediana',
    inBand: 'nella fascia',
    round2: 'Round 2',
    round2Value: '14 più vicini',
  },
  confidence: {
    eyebrow: 'Valutazione didattica',
    title: 'Giusto o sbagliato — e quanto sicuri?',
    lead: 'Con l’autovalutazione i partecipanti indicano dopo la risposta quanto sono sicuri (1–5). Vedi non solo il tasso di risposte corrette, ma anche le risposte sbagliate con alta sicurezza — una leva forte per la valutazione formativa, il piano per la discussione dei risultati e il rapporto dei risultati (PDF) a fine sessione.',
    summary: [
      'Non è un tipo di domanda a sé — opzionale sulle domande valutate.',
      'Scala 1–5 dopo la risposta, senza effetto sui punti.',
      'Dopo la pubblicazione l’host vede correttezza × grado di sicurezza.',
      '«Sbagliato e sicuro» segnala possibili fraintendimenti.',
      'Dopo la sessione: rapporto dei risultati (PDF) e discussione dei risultati.',
    ],
    docsConfidence: 'Doc autovalutazione',
    docsExport: 'Doc rapporto dei risultati (PDF)',
    demoAria: 'Esempio di valutazione con autovalutazione dopo la pubblicazione',
    hostView: 'Vista host dopo la pubblicazione',
    demoQuestion: 'Quale struttura è la più stabile?',
    badge: 'Autovalutazione',
    matrix: [
      { label: 'Corretto · basso', count: 3, tone: 'emerald' },
      { label: 'Corretto · medio', count: 8, tone: 'emerald' },
      { label: 'Corretto · alto', count: 11, tone: 'emerald' },
      { label: 'Sbagliato · basso', count: 2, tone: 'slate' },
      { label: 'Sbagliato · medio', count: 4, tone: 'amber' },
      { label: 'Sbagliato · alto', count: 2, tone: 'rose' },
    ],
    falseHighTitle: '2 risposte sbagliate con alta sicurezza',
    falseHighText:
      'L’opzione B è stata scelta 2× con alto grado di sicurezza — un segnale di possibili fraintendimenti nella discussione dei risultati.',
    consolidated: 'Solido',
    misconceptionRisk: 'Rischio di fraintendimento',
    fragile: 'Fragile',
    afterSessionAria: 'Export a fine sessione',
    afterSession: 'A fine sessione',
    debriefing: 'Discussione dei risultati',
    resultsPdf: 'Rapporto dei risultati (PDF)',
    exportNote:
      'Report pronto per la stampa con stato di apprendimento, heatmap e testi delle domande — nella vista host e sulla scheda quiz. Il CSV per Excel resta disponibile sotto «Altro».',
  },
  qaWall: {
    eyebrow: 'Q&A live come superficie di moderazione',
    title: 'Raccogliere domande, prioritizzarle e leggerle come mappa tematica',
    lead: 'La bacheca delle domande non è una chat secondaria. È un canale live dedicato per docenti e relatori: moderare i contributi, rilevare le priorità collettive, rendere visibili i punti controversi e portare i temi chiave in sala tramite una word cloud Q&A pesata.',
    signals: [
      {
        label: 'Pre-moderazione',
        text: 'Pubblica le domande solo quando si adattano al momento didattico.',
      },
      {
        label: 'Voto collettivo',
        text: 'Upvote e downvote mostrano priorità, attrito e bisogno di chiarimento.',
      },
      {
        label: 'Word cloud tematica',
        text: 'Parole e frasi sono pesate per supporto, accordo o controversia.',
      },
      {
        label: 'Prospettiva bussola',
        text: 'Prima arrivano i segnali deterministici; NLP Q&A e sintesi restano estensioni opzionali.',
      },
    ],
    docsLink: 'Apri scoring Q&A e controversia su GitHub',
    demoAria: 'Esempio di bacheca Q&A con moderazione, voti e word cloud',
    hostView: 'Vista host Q&A',
    demoTitle: 'Domande sull’evento',
    moderationActive: 'Pre-moderazione attiva',
    sortMostSupported: 'Più supportate',
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
        meta: '11 positivi · 0 negativi · soprattutto supportata',
      },
    ],
    wordCloud: 'Word cloud Q&A',
    wordCloudHint: 'Pesata per risonanza positiva e controversia.',
    frozenLive: 'Congelata live',
    terms: [
      { label: 'Fascia di tolleranza', className: 'text-3xl text-brand-200' },
      { label: 'Discussione', className: 'text-2xl text-emerald-200' },
      { label: 'Q&A', className: 'text-4xl text-white' },
      { label: 'Plausibilità', className: 'text-xl text-amber-200' },
      { label: 'Controversia', className: 'text-2xl text-rose-200' },
      { label: 'Peer Instruction', className: 'text-lg text-slate-300' },
      { label: 'Moderazione', className: 'text-3xl text-cyan-200' },
      { label: 'Bisogno di chiarimento', className: 'text-xl text-violet-200' },
    ],
    nextStep:
      'Prossimo passo: una bussola di moderazione deterministica, opzionalmente integrata da segnali NLP Q&A asincroni e sintesi legate alle fonti.',
  },
  workflow: {
    eyebrow: 'Per didattica, formazione e workshop',
    title: 'Dall’idea alla sessione live in pochi minuti',
    lead: 'Dalla domanda alla sessione in corso, il flusso evita di proposito passaggi inutili. È questo che rende l’avvio rapido e affidabile per docenti, trainer e moderatori.',
    stepLabel: 'Passo',
    steps: [
      {
        number: '01',
        title: 'Prepara un quiz',
        description:
          'Crea domande direttamente o importa contenuti esistenti. Markdown, KaTeX, risposta breve e stime numeriche sono integrati.',
      },
      {
        number: '02',
        title: 'Avvia una sessione',
        description:
          'Parti senza account: apri una sessione, scegli uno stile, condividi codice o QR e usa la vista presenter se serve.',
      },
      {
        number: '03',
        title: 'Modera live',
        description:
          'I partecipanti votano, pongono domande e prioritizzano insieme. Host e presenter mostrano quiz, bacheca Q&A, word cloud, fase di lettura, countdown, secondo round e risultati in un unico flusso.',
      },
      {
        number: '04',
        title: 'Follow-up ed export',
        description:
          'A fine sessione il rapporto dei risultati (PDF) è pronto — con stato di apprendimento, autovalutazione e testi completi delle domande. Nella raccolta quiz trovi discussione dei risultati e PDF dell’ultima esecuzione; CSV per Excel sotto «Altro».',
      },
    ],
  },
  features: {
    eyebrow: 'Perché si sente diverso',
    title: 'Pensato per l’interazione live, non solo per sondaggi su slide',
    lead: 'arsnova.eu unisce avvio rapido, solidità didattica e una base tecnica trasparente. La piattaforma resta semplice nel quotidiano senza ridurre le possibilità.',
    items: [
      {
        title: 'Pronto in poco tempo',
        description:
          'Gli host partono senza account. I partecipanti entrano nella sessione direttamente con un codice a 6 cifre o un QR.',
        icon: 'single',
      },
      {
        title: 'Autovalutazione nel quiz live',
        description:
          'I partecipanti indicano dopo la risposta quanto sono sicuri. Individui risposte sbagliate con alta sicurezza, prioritizzi la discussione dei risultati ed esporti lo stato di apprendimento nel rapporto dei risultati (PDF).',
        icon: 'confidence',
      },
      {
        title: 'Rapporto dei risultati per il follow-up',
        description:
          'A fine sessione esporti un report PDF pronto per la stampa con diagrammi, testi delle domande e autovalutazione. Il CSV per Excel resta opzionale sotto «Altro».',
        icon: 'export',
      },
      {
        title: 'Stime didattiche',
        description:
          'Date, ordini di grandezza e misure si possono stimare con valore di riferimento, fascia di tolleranza, statistica e secondo round opzionale.',
        icon: 'estimate',
      },
      {
        title: 'Più di un quiz standard',
        description:
          'MC/SC, risposta breve, rating, fase di lettura, Peer Instruction e flusso presenter supportano apprendimento, formazione e moderazione live.',
        icon: 'toggle',
      },
      {
        title: 'Bacheca invece di una chat secondaria',
        description:
          'Il Q&A offre pre-moderazione, fissaggio, archiviazione, up/downvote e ordinamento per supporto, qualità e controversia.',
        icon: 'qa',
      },
      {
        title: 'Word cloud elaborata',
        description:
          'Testo libero e Q&A vengono condensati in parole e frasi; la bacheca pesa per accordo, score robusto o controversia.',
        icon: 'cloud',
      },
      {
        title: 'Per contesti diversi',
        description:
          'Preset, modalità team, modalità anonima, nickname e scelta dello stile aiutano dalla classe e dal seminario al workshop, evento e meeting.',
        icon: 'bolt',
      },
      {
        title: 'Accessibilità secondo WCAG 2.2 AA',
        description:
          'Uso da tastiera, annunci screen reader, tempo di risposta regolabile individualmente e rapporti PDF/UA-1 — così più persone possono partecipare in autonomia alle sessioni live.',
        icon: 'a11y',
      },
      {
        title: 'Privacy e controllo',
        description:
          'Local-first, data-stripping e gestione self-hostabile ti danno più controllo su contenuti e dati live.',
        icon: 'tools',
      },
      {
        title: 'Open source con percorso operativo',
        description:
          'Docker, Postgres, Redis e audit admin rendono la piattaforma affidabile anche per hosting, esercizio e tracciabilità.',
        icon: 'server',
      },
    ],
  },
  accessibility: {
    eyebrow: 'Accessibilità',
    title: 'WCAG 2.2 AA — così più persone possono partecipare in autonomia',
    lead: 'Per scuole, università e formazione continua l’accessibilità è spesso un criterio decisivo. arsnova.eu soddisfa le Web Content Accessibility Guidelines (WCAG) 2.2 al livello AA — con uso da tastiera, supporto screen reader, tempo di risposta regolabile individualmente e rapporti PDF strutturati in modo accessibile.',
    benefits: [
      {
        title: 'Uso da tastiera',
        description:
          'Tu e i tuoi partecipanti usate i flussi centrali senza mouse. Indicatori di focus visibili e un link salta-contenuto facilitano la navigazione.',
      },
      {
        title: 'Supporto screen reader in live',
        description:
          'I cambiamenti di stato all’ingresso in sessione, durante le votazioni e ai cambi di fase vengono annunciati agli screen reader, così si può seguire il flusso.',
      },
      {
        title: 'Tempo di risposta regolabile individualmente',
        description:
          'Per le domande a tempo scegli tempo standard, tempo decuplicato o partecipazione senza limite. Così un’agevolazione si applica direttamente nella sessione live.',
      },
      {
        title: 'Rapporto dei risultati strutturato in modo accessibile',
        description:
          'Il report pronto per la stampa è validato PDF/UA-1 e include titolo, lingua e tag — per il follow-up e la condivisione accessibile.',
      },
    ],
    statementLink: 'Apri la dichiarazione di accessibilità',
  },
  trust: {
    eyebrow: 'Fiducia',
    title: 'Credibile perché il prodotto non parte da zero',
    lead: 'arsnova.eu si inserisce nella tradizione dell’ecosistema ARSnova e si basa su esperienze scientifiche, didattiche e pratiche di molti anni di tecnologie educative.',
    proofItems: [
      { value: 'Dal 2012', label: 'Tradizione ARSnova in istruzione ed edtech' },
      { value: 'WCAG 2.2 AA', label: 'Accessibilità verificata per didattica e istituzioni' },
      {
        value: '5 lingue UI',
        label: 'Tedesco, inglese, francese, spagnolo, italiano',
      },
      { value: 'Open source', label: 'Codice trasparente invece di una black box' },
    ],
    items: [
      {
        quote:
          'Percorso privacy-friendly: nessun dato personale memorizzato in modo permanente sul server.',
        source: 'DeLFI 2017',
        tag: 'Ricerca',
      },
      {
        quote:
          'Valutazione UX a confronto diretto con Kahoot! come checkpoint empirico del design.',
        source: 'fnm-austria',
        tag: 'Studio',
      },
      {
        quote:
          'Privacy by design e apertura tecnica sono un vero fattore distintivo per i contesti edtech europei.',
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
    lead: 'Al centro non c’è solo il voto, ma l’intero flusso live: preparare, moderare, rendere visibili i risultati e mantenere il controllo su contenuti e gestione.',
    points: [
      {
        title: 'Meno barriere d’ingresso',
        description:
          'Nessuna logica di prodotto separata per «creare» e «entrare». Gli host partono senza account, i partecipanti entrano con codice o QR.',
      },
      {
        title: 'Più formati di interazione',
        description:
          'Oltre al quiz: stime numeriche, fase di lettura, Peer Instruction, sondaggio rapido, bacheca Q&A e word cloud pesata nella stessa piattaforma — non solo sondaggi su slide.',
      },
      {
        title: 'Più controllo su dati e accesso',
        description:
          'Open source, self-hostabile e local-first — più accessibilità WCAG 2.2 AA. Rilevante per scuole, università e organizzazioni con requisiti di privacy e inclusione.',
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
        question: 'Host o partecipanti hanno bisogno di un account?',
        answer:
          'No. Una sessione può partire senza account. I partecipanti entrano con codice o QR.',
      },
      {
        question: 'Dove sono i dati?',
        answer:
          'I contenuti del quiz sono pensati local-first. Per le sessioni live vengono elaborati solo i dati di sessione tecnicamente necessari; con self-hosting la gestione resta nella tua infrastruttura.',
      },
      {
        question: 'Posso fare self-hosting di arsnova.eu?',
        answer:
          'Sì. La piattaforma è open source e progettata per funzionare con Docker, PostgreSQL e Redis.',
      },
      {
        question: 'Cos’è l’autovalutazione nel quiz?',
        answer:
          'Una domanda aggiuntiva opzionale dopo le domande valutate: i partecipanti indicano su una scala da 1 a 5 quanto sono sicuri della risposta. I punti restano invariati; nella valutazione host vedi correttezza × grado di sicurezza e segni le risposte sbagliate con alta sicurezza come segnale di fraintendimento. A fine sessione lo stato di apprendimento confluisce nella discussione dei risultati e nel rapporto dei risultati (PDF).',
      },
      {
        question: 'Posso esportare i risultati della sessione?',
        answer:
          'Sì. A fine sessione il rapporto dei risultati (PDF) è il formato principale — con autovalutazione, priorità per la discussione dei risultati e testi completi delle domande. Nella raccolta quiz trovi discussione dei risultati e PDF dell’ultima esecuzione. I dati CSV tabellari sono disponibili sotto «Altro» per Excel.',
      },
      {
        question: 'Cosa ha di speciale la stima numerica?',
        answer:
          'Separa gli input ammessi dalla fascia di tolleranza disciplinare, non mostra la distribuzione durante il voto e può valutare un secondo round dopo la discussione con statistica e confronto dei round.',
      },
      {
        question: 'Cosa può fare la bacheca Q&A?',
        answer:
          'I partecipanti inviano domande e le pesano con upvote e downvote. Gli host possono pre-moderare, fissare, archiviare o rimuovere domande e ordinare l’elenco per supporto, accordo robusto o controversia.',
      },
      {
        question: 'Cosa rende diversa la word cloud Q&A?',
        answer:
          'Condensa le domande visibili in parole e frasi e segue la logica di ordinamento attiva. Così mostra non solo termini frequenti, ma cluster tematici da domande supportate, valutate in modo robusto o controverse.',
      },
      {
        question: 'Per chi è pensata la piattaforma?',
        answer:
          'Per l’interazione live in istruzione e organizzazioni: scuola, università, formazione continua, training, workshop, evento o meeting.',
      },
      {
        question: 'arsnova.eu è accessibile?',
        answer:
          'arsnova.eu soddisfa WCAG 2.2 AA. I flussi centrali sono usabili da tastiera, gli screen reader annunciano i cambiamenti di stato, il tempo di risposta delle domande a tempo è regolabile individualmente (tempo standard, tempo decuplicato o senza limite), e il rapporto dei risultati strutturato in modo accessibile è validato PDF/UA-1.',
        linkLabel: 'Apri la dichiarazione di accessibilità',
      },
    ],
  },
  ctaSection: {
    title: 'Pronto per la prossima sessione live?',
    lead: 'Prova il flusso live direttamente nell’app, oppure dai un’occhiata al codice aperto, alla logica Q&A, alla pipeline della word cloud e al percorso operativo dietro la piattaforma.',
  },
  jsonLd: {
    websiteName: 'arsnova.eu – Informazioni',
    webAppDescription:
      'Audience response open source per istruzione, formazione e organizzazioni: quiz live, autovalutazione, rapporto dei risultati (PDF), stime numeriche, bacheca Q&A moderabile, word cloud e feedback — accessibile WCAG 2.2 AA, gratuito, self-hostabile e pronto senza account.',
    featureList: [
      'Quiz live e votazioni',
      'Autovalutazione sulle domande valutate',
      'Rapporto dei risultati (PDF) e discussione dei risultati a fine sessione',
      'Stime numeriche con due round e statistica',
      'Bacheca Q&A con moderazione, upvote e downvote',
      'Lobby, presenter, QR/codice',
      'Tipi di domanda MC/SC/risposta breve/testo libero/sondaggio/rating/stima',
      'Markdown e KaTeX',
      'Fase di lettura e Peer Instruction',
      'Word cloud Q&A e testo libero con frasi e pesatura',
      'Ordinamento per supporto, accordo robusto e controversia',
      'Modalità team e preset',
      'Classifica, streak, codice bonus',
      'Import/export e sync Yjs',
      'Import IA esterno, validato Zod',
      'Interfaccia in cinque lingue',
      'Accessibilità secondo WCAG 2.2 AA',
      'Self-host Docker e audit admin',
      'Local-first e funzionamento orientato al GDPR',
    ],
  },
};

export default it;

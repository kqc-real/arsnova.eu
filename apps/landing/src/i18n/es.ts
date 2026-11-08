import type { Messages } from './types';

const es: Messages = {
  meta: {
    homeTitle: 'arsnova.eu | Cuestionarios, Q&A y nubes de palabras en directo',
    homeDescription:
      'Crea y dirige cuestionarios, Q&A, nubes de palabras y sondeos rápidos desde el móvil. Gratis, de código abierto, autoalojable y sin cuenta. WCAG 2.2 AA.',
    siteNameInfo: 'arsnova.eu – Información',
    ogLocale: 'es_ES',
  },
  nav: {
    ariaLabel: 'Navegación principal',
    workflow: 'Cómo funciona',
    features: 'Funciones',
    accessibility: 'Accesibilidad',
    trust: 'Confianza',
    comparison: 'Comparativa',
    faq: 'FAQ',
    tryNow: 'Probar ahora',
    menuOpen: 'Abrir menú',
    menuClose: 'Cerrar menú',
    menu: 'Menú',
    skipToContent: 'Ir al contenido',
  },
  languageSwitcher: {
    label: 'Idioma',
    currentLanguage: 'Español',
    chooseLanguage: 'Elegir idioma',
  },
  themeSwitcher: {
    label: 'Apariencia',
    system: 'Configuración del sistema',
    light: 'Claro',
    dark: 'Oscuro',
    chooseAppearance: 'Elegir la apariencia',
  },
  footer: {
    impressum: 'Aviso legal',
    privacy: 'Privacidad',
    accessibility: 'Accesibilidad',
  },
  cta: {
    appOpen: 'Abrir la aplicación',
    quizCreate: 'Crear un cuestionario',
    backToApp: 'Volver a arsnova.eu',
    tryLive: 'Probarlo en directo ahora',
    howItWorks: 'Cómo funciona',
    viewOpenSource: 'Ver el código fuente',
  },
  hero: {
    eyebrow: 'Participación del público para educación y organizaciones',
    titleLine1: 'Crea cuestionarios, recoge preguntas,',
    titleLine2: 'escucha a tu público',
    titleAccent1: 'en directo y gratis',
    titleAccent2: ' sin cuenta.',
    lead: 'Combina cuestionarios en directo, estimaciones numéricas, seguridad en la respuesta, preguntas del público, nubes de palabras y sondeos rápidos en una sesión. Crea todos los tipos de pregunta y dirige desde el móvil una clase, un taller, una formación o una reunión. arsnova.eu es de código abierto, se puede alojar en tus propios servidores y está diseñado teniendo en cuenta los requisitos del RGPD.',
    a11yLink: 'Cumple las WCAG 2.2, nivel AA',
    a11ySuffix: ': teclado, lectores de pantalla y tiempo de respuesta ajustable.',
    cards: [
      {
        title: 'Crea y dirige desde el móvil',
        text: 'Crea todos los tipos de pregunta y dirige una sesión en directo desde el móvil',
      },
      {
        title: 'Q&A con muro de preguntas',
        text: 'Moderación, votos, nube de palabras y brújula de moderación',
      },
      {
        title: 'Seguridad en la respuesta y seguimiento',
        text: 'Detecta posibles concepciones erróneas y exporta un informe de resultados en PDF',
      },
      {
        title: 'Código abierto y autoalojable',
        text: 'Docker, PostgreSQL, Redis y registro de actividad de administración',
      },
    ],
  },
  estimate: {
    eyebrow: 'Nuevo en el cuestionario en directo',
    title: 'Estima, debate y compara dos rondas',
    lead: 'Usa estimaciones numéricas para fechas, órdenes de magnitud, medidas y probabilidades. Fija un valor de referencia, un intervalo de entrada y una tolerancia. Los participantes solo tienen que introducir un número.',
    summary: [
      'El intervalo de entrada determina qué valores se pueden introducir.',
      'El intervalo de tolerancia determina qué estimaciones cuentan como correctas.',
      'La distribución de respuestas permanece oculta hasta que se muestran los resultados.',
      'La ronda 1 y la ronda 2 se comparan después del debate.',
    ],
    docsLink: 'Abrir la documentación de la pregunta de estimación numérica',
    demoAria:
      'Ejemplo de resultados de una pregunta de estimación numérica sobre la Revolución francesa',
    hostView: 'Vista de moderación tras mostrar los resultados',
    demoQuestion: '¿Cuándo comenzó la Revolución francesa?',
    reference: 'Referencia 1789',
    toleranceBand: 'Banda de tolerancia',
    toleranceValue: '1700 a 1900',
    plausibilityBand: 'Intervalo de entrada permitido',
    plausibilityValue: '1500 a 2000',
    histogramNote:
      'El histograma, la línea de referencia y el intervalo de tolerancia aparecen después de mostrar los resultados. Hasta entonces solo se muestra el progreso de participación.',
    median: 'Mediana',
    inBand: 'dentro de la tolerancia',
    round2: 'Ronda 2',
    round2Value: '14 respuestas más próximas al valor de referencia',
  },
  confidence: {
    eyebrow: 'Análisis didáctico',
    title: '¿Respuesta correcta o incorrecta, y con qué seguridad?',
    lead: 'Después de responder a una pregunta puntuable, los participantes pueden indicar su seguridad del 1 al 5. Así puedes detectar respuestas incorrectas con alta seguridad, que pueden indicar una concepción errónea. Usa estas señales para preparar la puesta en común y revísalas en el informe PDF al finalizar la sesión.',
    summary: [
      'Ajuste opcional para preguntas puntuables, no un tipo de pregunta independiente.',
      'Escala del 1 al 5 después de responder, sin efecto en los puntos.',
      'Tras mostrar los resultados, quien dirige la sesión puede comparar el acierto con la seguridad.',
      'Las respuestas incorrectas con alta seguridad pueden indicar posibles concepciones erróneas.',
      'Al terminar la sesión, usa el informe PDF para preparar la puesta en común.',
    ],
    docsConfidence: 'Documentación de seguridad en la respuesta',
    docsExport: 'Documentación del informe de resultados en PDF',
    demoAria: 'Ejemplo de acierto y seguridad en la respuesta tras mostrar los resultados',
    hostView: 'Vista de moderación tras mostrar los resultados',
    demoQuestion: '¿Qué estructura es la más estable?',
    badge: 'Seguridad en la respuesta',
    matrix: [
      { label: 'Correcta · seguridad baja', count: 3, tone: 'emerald' },
      { label: 'Correcta · seguridad media', count: 8, tone: 'emerald' },
      { label: 'Correcta · seguridad alta', count: 11, tone: 'emerald' },
      { label: 'Incorrecta · seguridad baja', count: 2, tone: 'slate' },
      { label: 'Incorrecta · seguridad media', count: 4, tone: 'amber' },
      { label: 'Incorrecta · seguridad alta', count: 2, tone: 'rose' },
    ],
    falseHighTitle: '2 respuestas incorrectas con alta seguridad',
    falseHighText:
      'La opción B se seleccionó dos veces con alta seguridad. Puede indicar una concepción errónea que conviene retomar en la puesta en común.',
    consolidated: 'Consolidado',
    misconceptionRisk: 'Posible concepción errónea',
    fragile: 'Aún no consolidado',
    afterSessionAria: 'Exportación al terminar la sesión',
    afterSession: 'Al terminar la sesión',
    debriefing: 'Puesta en común',
    resultsPdf: 'Informe de resultados (PDF)',
    exportNote:
      'Informe listo para imprimir con comprensión, seguridad en la respuesta, mapa de calor y textos completos de las preguntas. Ábrelo desde la vista de moderación o la tarjeta del cuestionario. La exportación CSV para hojas de cálculo está en «Más».',
  },
  qaWall: {
    eyebrow: 'Un espacio para las preguntas del público',
    title: 'Recoge preguntas, establece prioridades y detecta temas recurrentes',
    lead: 'Usa Q&A para publicar las preguntas del público, identificar prioridades y abordar desacuerdos. Una nube de palabras ponderada ayuda a llevar los temas recurrentes al debate.',
    signals: [
      {
        label: 'Premoderación',
        text: 'Revisa las preguntas antes de publicarlas para los participantes.',
      },
      {
        label: 'Voto colectivo',
        text: 'Los votos a favor y en contra indican las prioridades, los puntos de desacuerdo y las necesidades de aclaración.',
      },
      {
        label: 'Nube temática',
        text: 'Las palabras y expresiones se ponderan según la ordenación elegida: saldo de votos, apoyo claro o controversia.',
      },
      {
        label: 'Brújula de moderación',
        text: 'Un siguiente paso sugerido a partir de las preguntas, las nubes de palabras, los resultados y las opiniones sobre el ritmo.',
      },
    ],
    docsLink: 'Leer sobre la ordenación de Q&A y la controversia en GitHub',
    demoAria: 'Ejemplo de muro de preguntas con moderación, votos y nube de palabras',
    hostView: 'Vista de moderación de Q&A',
    demoTitle: 'Preguntas sobre el evento',
    moderationActive: 'Premoderación activa',
    sortMostSupported: 'Saldo de votos',
    sortBest: 'Apoyo claro',
    sortControversial: 'Controversia',
    questions: [
      {
        score: '+18',
        title: '¿Cuándo está una estimación dentro de un intervalo aceptable?',
        meta: '15 a favor · 3 en contra · apoyo claro',
      },
      {
        score: '+4',
        title: '¿Debemos ocultar realmente los resultados antes del debate?',
        meta: '9 a favor · 5 en contra · controvertida',
      },
      {
        score: '+11',
        title: '¿En qué se diferencia el Q&A del texto libre en el cuestionario?',
        meta: '11 a favor · 0 en contra · mayormente apoyada',
      },
    ],
    wordCloud: 'Nube de palabras Q&A',
    wordCloudHint: 'El tamaño de los términos refleja la ponderación de las preguntas.',
    frozenLive: 'Visualización en pausa',
    terms: [
      { label: 'Banda de tolerancia', className: 'text-3xl text-landing-primary' },
      { label: 'Debate', className: 'text-2xl text-landing-status-emerald' },
      { label: 'Q&A', className: 'text-4xl text-landing-fg' },
      { label: 'Plausibilidad', className: 'text-xl text-landing-status-amber' },
      { label: 'Controversia', className: 'text-2xl text-landing-status-rose' },
      { label: 'Peer Instruction', className: 'text-lg text-landing-fg-muted' },
      { label: 'Moderación', className: 'text-3xl text-landing-tertiary' },
      { label: 'Necesidad de aclaración', className: 'text-xl text-landing-status-violet' },
    ],
    nextStep:
      'Siguiente paso en la brújula: comentar la pregunta controvertida con el grupo. Ábrela con un toque.',
  },
  compass: {
    eyebrow: 'Ya en la sesión en directo',
    title: 'La brújula de moderación te ayuda a elegir el siguiente paso',
    lead: 'Durante la sesión, la brújula sugiere un siguiente paso a partir de preguntas sin responder, nubes de palabras, resultados del cuestionario y opiniones sobre el ritmo. Revisa las señales, abre la fuente y decide cómo continuar.',
    summary: [
      'Toca «Brújula» en cualquier vista en directo.',
      '«Siguiente paso» propone una acción concreta en la parte superior.',
      'Debajo aparecen opiniones sobre el ritmo, preguntas controvertidas y puntos por aclarar.',
      'Abre directamente la pregunta, la nube de palabras o los resultados.',
      'Tú decides. La brújula no dirige la sesión por su cuenta.',
    ],
    docsLink: 'Cómo funciona la brújula',
    tryLink: 'Pruébala en la aplicación',
    demoAria: 'Ejemplo de la brújula de moderación con el siguiente paso y señales en directo',
    hostView: 'Vista de moderación',
    demoTitle: 'Brújula de moderación',
    nextLabel: 'Siguiente paso',
    nextTitle: 'Comentar la pregunta controvertida con el grupo',
    nextText:
      'La pregunta sobre ocultar los resultados divide al grupo. Aclárala antes de continuar.',
    cards: [
      {
        label: 'Preguntas controvertidas',
        text: 'El grupo está dividido: hay muchos votos a favor y en contra.',
        tone: 'rose',
      },
      {
        label: 'Feedback sobre el ritmo de la exposición',
        text: 'Varias personas indican que el ritmo es demasiado rápido. Conviene hacer una breve pausa.',
        tone: 'amber',
      },
      {
        label: 'Por aclarar',
        text: 'Una pregunta muy apoyada sigue esperando tu respuesta.',
        tone: 'violet',
      },
    ],
    sourcesLabel: 'Saltar directamente a',
    sources: ['Q&A', 'Nube de palabras', 'Cuestionario', 'Sondeo rápido'],
    note: 'La brújula solo utiliza información ya disponible para quien dirige la sesión. No evalúa a participantes individuales.',
  },
  workflow: {
    eyebrow: 'Para docencia, formación y talleres',
    title: 'De la idea a la sesión en directo en pocos minutos',
    lead: 'Prepara el contenido, invita a los participantes y dirige la sesión. El recorrido abarca desde la creación de preguntas hasta el análisis de los resultados.',
    stepLabel: 'Paso',
    steps: [
      {
        number: '01',
        title: 'Preparar un cuestionario',
        description:
          'Crea preguntas o importa contenido desde el móvil, en todos los formatos. Usa Markdown, KaTeX, respuestas cortas, estimaciones numéricas, emparejamiento, ordenación y clasificación.',
      },
      {
        number: '02',
        title: 'Compartir la biblioteca',
        description:
          'La biblioteca de cuestionarios permanece en tu dispositivo, lo que ayuda a proteger tus datos. Usa un enlace de sincronización para abrirla en un ordenador prestado en lugar de llevar una memoria USB. Comparte el enlace con otras personas para usarla y editarla conjuntamente. Crea el enlace en la biblioteca y pega los recibidos en la página de inicio.',
      },
      {
        number: '03',
        title: 'Iniciar una sesión',
        description:
          'Empieza sin cuenta: abre una sesión, elige un estilo y comparte el código de sesión o el código QR. También puedes conectar un móvil o una tableta y abrir la vista de presentación en un proyector.',
      },
      {
        number: '04',
        title: 'Dirigir en directo',
        description:
          'Controla la sesión desde el móvil mientras te mueves por la sala. Los participantes responden, hacen preguntas y ayudan a establecer prioridades. La brújula de moderación sugiere un siguiente paso. Las vistas de moderación y presentación reúnen cuestionarios, Q&A, sondeos rápidos, nubes de palabras, fases de lectura, cuentas atrás, segundas votaciones y resultados.',
      },
      {
        number: '05',
        title: 'Revisar y exportar',
        description:
          'Al terminar la sesión, abre el informe PDF con comprensión, seguridad en la respuesta y textos completos de las preguntas. El análisis y el informe de la última sesión siguen disponibles en la biblioteca. La exportación CSV para hojas de cálculo está en «Más».',
      },
    ],
  },
  pairing: {
    eyebrow: 'Lo que nos distingue',
    title: 'Controla la presentación desde el móvil o la tableta',
    lead: 'Conecta un móvil o una tableta para controlar la sesión mientras te mueves por la sala. Escanea el código QR y confirma la conexión en el ordenador. El dispositivo conectado recibe controles para la sesión actual sin necesitar otra cuenta.',
    whyTitle: 'Qué puede hacer el dispositivo conectado',
    summary: [
      'Muévete por la sala sin perder el control de la presentación.',
      'Controla preguntas, resultados, Q&A, sondeos rápidos y el final de la sesión, además del avance de diapositivas.',
      'Sin cuenta en el teléfono: puedes dárselo a una persona de apoyo sin compartir contraseñas.',
      'Sin compartir credenciales: muestra el QR y confirma la conexión en el ordenador. El móvil recibe controles solo para esta sesión.',
      'La biblioteca permanece en el ordenador. El dispositivo conectado no puede editar ni eliminar cuestionarios.',
    ],
    laptopLabel: 'Portátil y proyector',
    laptopText:
      'El ordenador y el proyector muestran la presentación. Confirma aquí la conexión. La biblioteca permanece en este ordenador.',
    phoneLabel: 'Teléfono o tableta',
    phoneText: 'Controla la sesión actual mientras te mueves por la sala, sin otra cuenta.',
    demoAria: 'El portátil muestra la presentación; el teléfono controla la sesión',
  },
  features: {
    eyebrow: 'Lo que distingue a arsnova.eu',
    title: 'Todo lo necesario para la participación del público en directo',
    lead: 'Empieza sin cuenta y prepara, dirige y analiza sesiones en directo. El código abierto permite comprobar cómo funciona la plataforma.',
    items: [
      {
        title: 'Crea y dirige desde el móvil',
        description:
          'Crea todos los tipos de pregunta desde el móvil y controla cuestionarios, Q&A, sondeos rápidos y resultados en la misma vista de moderación. Dirige la sesión sin ordenador o conecta un dispositivo para controlar una presentación proyectada.',
        icon: 'phone',
      },
      {
        title: 'Presenta desde cualquier punto de la sala',
        description:
          'Conecta un móvil o una tableta para controlar preguntas, resultados, Q&A, sondeos rápidos y el final de la sesión. Escanea el QR y confirma la conexión en el ordenador. La biblioteca permanece en el ordenador, de modo que puedes ceder los controles sin compartir contraseñas.',
        icon: 'presenter',
      },
      {
        title: 'Listo en poco tiempo',
        description:
          'Inicia una sesión sin cuenta. Los participantes entran directamente con un código de 6 caracteres o un código QR.',
        icon: 'single',
      },
      {
        title: 'Seguridad en la respuesta durante el cuestionario',
        description:
          'Los participantes indican cuánta seguridad tienen en su respuesta. Las respuestas incorrectas con alta seguridad pueden indicar posibles concepciones erróneas. Usa estas señales para preparar la puesta en común y consultarlas en el informe PDF.',
        icon: 'confidence',
      },
      {
        title: 'Informe de resultados para la puesta en común',
        description:
          'Al terminar la sesión, exporta un informe PDF listo para imprimir con gráficos, textos de preguntas y seguridad en la respuesta. La exportación CSV para hojas de cálculo sigue disponible en «Más».',
        icon: 'export',
      },
      {
        title: 'Preguntas de estimación numérica didácticas',
        description:
          'Fechas, órdenes de magnitud y medidas se pueden estimar con valor de referencia, banda de tolerancia, estadística y una segunda ronda opcional.',
        icon: 'estimate',
      },
      {
        title: 'Más que un cuestionario estándar',
        description:
          'Respuesta única y múltiple, respuestas cortas, valoraciones, emparejamiento, ordenación, clasificación, fase de lectura, Peer Instruction y presentación para apoyar el aprendizaje y la moderación en directo.',
        icon: 'toggle',
      },
      {
        title: 'Un espacio para las preguntas del público',
        description:
          'Q&A permite revisar antes de publicar, fijar, archivar, votar a favor o en contra y ordenar por saldo de votos, apoyo claro o controversia.',
        icon: 'qa',
      },
      {
        title: 'Nubes de palabras que muestran temas recurrentes',
        description:
          'Resume texto libre y preguntas de Q&A en palabras y expresiones. En Q&A, el tamaño depende de la ponderación elegida: saldo de votos, apoyo claro o controversia.',
        icon: 'cloud',
      },
      {
        title: 'Brújula de moderación en la sesión',
        description:
          'Recibe una sugerencia a partir de las opiniones sobre el ritmo, preguntas controvertidas o resultados que conviene comentar. Abre «Brújula», revisa las señales y decide el siguiente paso.',
        icon: 'compass',
      },
      {
        title: 'Para distintos contextos',
        description:
          'Ajustes previos, modo equipo, modo anónimo, apodos y elección de estilo se adaptan a distintos contextos, desde clases y seminarios hasta talleres, eventos y reuniones.',
        icon: 'bolt',
      },
      {
        title: 'Cumple las WCAG 2.2, nivel AA',
        description:
          'Uso con teclado, anuncios de lector de pantalla, tiempo de respuesta ajustable individualmente e informes PDF/UA-1 — para que más personas puedan participar de forma autónoma en sesiones en directo.',
        icon: 'a11y',
      },
      {
        title: 'Privacidad y control',
        description:
          'Los cuestionarios se guardan en tu dispositivo. Las opciones de eliminación de datos y el alojamiento en tus propios servidores te dan más control sobre los contenidos y los datos de las sesiones.',
        icon: 'tools',
      },
      {
        title: 'Código abierto con despliegue y gestión operativa',
        description:
          'Docker, PostgreSQL, Redis y un registro de actividad de administración permiten alojar y gestionar la plataforma y consultar las acciones administrativas.',
        icon: 'server',
      },
    ],
  },
  leaderboard: {
    eyebrow: 'Ajuste Lúdico',
    title: 'Una clasificación que anima al grupo a participar',
    lead: 'Apodos de animales, puntos y respuestas correctas: una clasificación sin nombres reales. El estilo Lúdico presenta los resultados en directo con una apariencia oscura y clara de leer.',
    points: [
      'Apodos de animales en lugar de nombres reales',
      'Puntos y respuestas correctas de un vistazo',
      'El mismo aspecto en claro y en oscuro',
    ],
    demoAria: 'Ejemplo de clasificación en directo con el ajuste Lúdico',
    boardTitle: 'Clasificación',
    winnerLabel: 'Va en cabeza',
    winnerMeta: 'Con {score} puntos',
    rankCol: 'Puesto',
    nicknameCol: 'Apodo',
    pointsCol: 'Puntos',
    correctCol: 'Correcto',
    names: [
      'Gato coral',
      'Loro colorido',
      'Oso pardo',
      'Ratón verde oliva',
      'Cisne azul claro',
      'Dragón rojo',
      'Mariposa rosa',
      'Oso pardo 2',
      'Dragón rojo 8',
      'Jirafa celeste',
    ],
  },
  structuredQuestionTypes: {
    eyebrow: 'Tipos de pregunta estructurados',
    title: 'Empareja, ordena y clasifica, con resultados que puedes analizar',
    lead: 'Explora relaciones, secuencias y categorías con preguntas interactivas que puedes crear íntegramente desde el móvil. Las soluciones permanecen ocultas durante la votación. Después de mostrar los resultados puedes revisar las respuestas correctas y los errores frecuentes.',
    interactionLabel: 'Interacción',
    exampleLabel: 'Ejemplo didáctico',
    resultLabel: 'Resultados',
    scoringNote:
      'Los tres formatos se puntúan. Actualmente, una respuesta recibe todos los puntos o ninguno; no hay puntuación parcial.',
    revealNote:
      'Durante la votación permanecen ocultos los pares correctos, el orden correcto y las categorías de destino. La solución y las distribuciones detalladas aparecen después de mostrar los resultados.',
    items: [
      {
        id: 'matching',
        title: 'Emparejamiento',
        description:
          'Relacionar uno a uno términos, definiciones o ejemplos. Los resultados muestran las confusiones más frecuentes.',
        interaction:
          'Empareja cada elemento de la izquierda con uno de la derecha. Cada elemento se usa una vez y hay que completar todos los pares.',
        example: 'Relacionar fechas históricas con sus acontecimientos.',
        result: 'Pares correctos, tasas de acierto y emparejamientos erróneos frecuentes.',
        symbol: 'A↔B',
      },
      {
        id: 'ordering',
        title: 'Ordenación',
        description:
          'Colocar pasos, acontecimientos o fases de un proceso en el orden correcto. Los resultados muestran qué posiciones generaron más dudas.',
        interaction:
          'Ordena todos los elementos con los controles visibles o con el teclado. No hace falta arrastrar y soltar.',
        example: 'Ordenar las fases de un proceso biológico.',
        result: 'Secuencia correcta, distribución por posición e intercambios frecuentes.',
        symbol: '1→3',
      },
      {
        id: 'categorisation',
        title: 'Clasificación',
        description:
          'Asignar términos o ejemplos a las categorías correspondientes. Los resultados muestran las distinciones bien comprendidas y los errores de clasificación más frecuentes.',
        interaction:
          'Cada elemento recibe exactamente una categoría y todos los elementos deben estar clasificados.',
        example: 'Clasificar obras literarias por época.',
        result: 'Clasificación correcta, distribución por categoría y errores frecuentes.',
        symbol: '▦',
      },
    ],
  },
  accessibility: {
    eyebrow: 'Accesibilidad',
    title: 'WCAG 2.2 AA — para que más personas puedan participar de forma autónoma',
    lead: 'Para escuelas, universidades y formación continua, la accesibilidad suele ser un criterio decisivo. arsnova.eu cumple las Web Content Accessibility Guidelines (WCAG) 2.2 en el nivel AA — con uso de teclado, compatibilidad con lectores de pantalla, tiempo de respuesta ajustable individualmente e informes PDF estructurados de forma accesible.',
    benefits: [
      {
        title: 'Uso con teclado',
        description:
          'Los recorridos principales se pueden usar sin ratón. Los indicadores de foco visibles y un enlace para saltar al contenido facilitan la navegación.',
      },
      {
        title: 'Compatibilidad con lectores de pantalla en directo',
        description:
          'Los lectores de pantalla anuncian cambios importantes al entrar en una sesión, enviar respuestas y pasar a otra fase.',
      },
      {
        title: 'Tiempo de respuesta ajustable individualmente',
        description:
          'En preguntas con temporizador, elige el tiempo estándar, «Tiempo ×10» o «Sin plazo». Estas opciones permiten adaptar el tiempo de respuesta a las necesidades individuales durante la sesión.',
      },
      {
        title: 'Informe de resultados con estructura accesible',
        description:
          'El informe listo para imprimir está validado según PDF/UA-1 e incluye título, idioma y etiquetas estructurales para el seguimiento y la difusión accesible.',
      },
    ],
    statementLink: 'Abrir la declaración de accesibilidad',
  },
  trust: {
    eyebrow: 'Confianza',
    title: 'Construido sobre una base consolidada',
    lead: 'arsnova.eu forma parte del ecosistema ARSnova y se apoya en años de investigación, práctica docente y desarrollo de tecnología educativa.',
    proofItems: [
      { value: 'Desde 2012', label: 'Tradición ARSnova en educación y tecnología educativa' },
      { value: 'WCAG 2.2 AA', label: 'Accesibilidad verificada para docencia e instituciones' },
      {
        value: '5 idiomas de UI',
        label: 'Alemán, inglés, francés, español, italiano',
      },
      { value: 'Código abierto', label: 'Código transparente en lugar de sistemas opacos' },
    ],
    items: [
      {
        quote:
          'Camino respetuoso con la privacidad: sin datos personales almacenados de forma permanente en el servidor.',
        source: 'DeLFI 2017',
        tag: 'Investigación',
      },
      {
        quote:
          'Evaluación UX en comparación directa con Kahoot! como verificación empírica del diseño.',
        source: 'fnm-austria',
        tag: 'Estudio',
      },
      {
        quote:
          'La privacidad desde el diseño y la apertura técnica son un verdadero factor diferencial para contextos europeos de tecnología educativa.',
        source: 'Análisis de publicaciones',
        tag: 'Arquitectura',
      },
      {
        quote: 'Probado en entornos educativos reales, no solo descrito como concepto.',
        source: 'Uso en contextos de docencia y formación',
        tag: 'Práctica',
      },
    ],
    referencesPrefix: 'Las referencias completas y la biblioteca de publicaciones de base están en',
    referencesLink: 'ARSnova-Recherche.pdf',
    referencesSuffix: 'en GitHub.',
  },
  comparison: {
    eyebrow: 'Diferenciación',
    title: 'Compara arsnova.eu con Mentimeter y Kahoot!',
    lead: 'Prepara contenidos desde el móvil, dirige la sesión mientras te mueves por la sala, muestra los resultados y mantén el control sobre contenidos y funcionamiento.',
    points: [
      {
        title: 'Crear y dirigir desde el móvil',
        description:
          'Crea todos los tipos de pregunta en el móvil y controla cuestionarios, Q&A, sondeos rápidos y resultados en la misma vista. Puedes usar un ordenador y un proyector si lo necesitas.',
      },
      {
        title: 'Control de la sesión mientras te mueves por la sala',
        description:
          'Escanea el QR y confirma la conexión en el ordenador. El móvil controla preguntas, resultados, Q&A, sondeos rápidos y el final de la sesión sin otra cuenta. La biblioteca permanece en el ordenador.',
      },
      {
        title: 'Menos barreras de entrada',
        description:
          'Puedes iniciar una sesión sin cuenta. Los participantes entran con el código de sesión o el código QR.',
      },
      {
        title: 'Más formatos de interacción',
        description:
          'Además del cuestionario: relacionar, ordenar, clasificar, estimación numérica, fase de lectura, Peer Instruction, sondeo rápido, muro de preguntas, nube de palabras ponderada y brújula de moderación en una sola plataforma.',
      },
      {
        title: 'Más control sobre datos y acceso',
        description:
          'Código abierto, instalación en tus propios servidores y almacenamiento local de cuestionarios, junto con accesibilidad según WCAG 2.2 AA. Opciones relevantes para instituciones con requisitos de privacidad e inclusión.',
      },
    ],
    comparePrefix: 'La comparación completa de funciones sigue en la documentación:',
    compareLink: 'Abrir la comparación en GitHub',
  },
  faq: {
    eyebrow: 'FAQ',
    title: 'Preguntas frecuentes antes del primer uso',
    answerLabel: 'Respuesta',
    items: [
      {
        question: '¿Hace falta una cuenta para dirigir una sesión o participar?',
        answer:
          'No. Una sesión puede iniciarse sin cuenta. Los participantes entran con código o QR.',
      },
      {
        question: '¿Puedo crear un cuestionario y dirigir una sesión por completo desde el móvil?',
        answer:
          'Sí. Crea todos los tipos de pregunta desde el móvil: respuesta única y múltiple, respuesta corta, estimación numérica, emparejamiento, ordenación y clasificación. La misma vista de moderación controla cuestionarios, Q&A, sondeos rápidos y resultados. También puedes conectar otro dispositivo para controlar desde el móvil una presentación proyectada, sin otra cuenta.',
      },
      {
        question: '¿Puedo controlar la sesión desde el teléfono?',
        answer:
          'Sí. Al iniciar la presentación, muestra el QR en el ordenador y confirma allí la conexión. El móvil no necesita cuenta y recibe controles solo para la sesión actual. No puede editar ni eliminar cuestionarios. Puedes cederlo a una persona de apoyo sin compartir contraseñas.',
      },
      {
        question: '¿Dónde están los datos?',
        answer:
          'Los contenidos del cuestionario permanecen en tu dispositivo. En sesiones en directo solo se procesan los datos de sesión técnicamente necesarios; con autoalojamiento, la operación permanece en tu infraestructura.',
      },
      {
        question:
          '¿Puedo usar la biblioteca de cuestionarios en otro dispositivo o con otras personas?',
        answer:
          'Sí. Crea un enlace de sincronización en la biblioteca y pégalo en la página de inicio del otro dispositivo. Así puedes abrir la biblioteca en un ordenador prestado en lugar de llevar una memoria USB. Comparte el mismo enlace con otras personas para usar y editar la biblioteca conjuntamente.',
      },
      {
        question: '¿Puedo autoalojar arsnova.eu?',
        answer:
          'Sí. La plataforma es de código abierto y está diseñada para funcionar con Docker, PostgreSQL y Redis.',
      },
      {
        question: '¿Qué es la seguridad en la respuesta?',
        answer:
          'Es un ajuste opcional para las preguntas puntuables. Después de responder, los participantes indican su seguridad del 1 al 5. No afecta a los puntos. Al mostrar los resultados, puedes comparar el acierto con la seguridad. Una respuesta incorrecta con alta seguridad puede indicar una concepción errónea. Estos datos también aparecen en el informe PDF.',
      },
      {
        question: '¿Puedo exportar los resultados de la sesión?',
        answer:
          'Sí. Al terminar la sesión, abre el informe de resultados en PDF con seguridad en la respuesta, prioridades para la puesta en común y textos completos de las preguntas. El informe de la última sesión sigue disponible en la biblioteca. Los datos en CSV para hojas de cálculo están en «Más».',
      },
      {
        question: '¿Qué tiene de especial la pregunta de estimación numérica?',
        answer:
          'El intervalo de entrada determina los valores permitidos y el de tolerancia determina qué respuestas son correctas. La distribución permanece oculta durante la votación. Después de un debate puedes realizar una segunda ronda y comparar las estadísticas de ambas.',
      },
      {
        question: '¿Qué puede hacer el muro de preguntas?',
        answer:
          'Los participantes envían preguntas y votan a favor o en contra. Quien dirige la sesión puede revisar antes de publicar, fijar, archivar o eliminar preguntas y ordenarlas por saldo de votos, apoyo claro o controversia.',
      },
      {
        question: '¿En qué se diferencia la nube de palabras Q&A?',
        answer:
          'Resume las preguntas visibles en palabras y expresiones. Su tamaño sigue la ponderación de la ordenación activa: saldo de votos, apoyo claro o controversia. Esto ayuda a identificar temas recurrentes; no evalúa la exactitud de las preguntas.',
      },
      {
        question: '¿Qué hace la brújula de moderación?',
        answer:
          'Durante la sesión, sugiere un siguiente paso a partir de preguntas sin responder, nubes de palabras, resultados y opiniones sobre el ritmo. «Siguiente paso» aparece arriba y las señales, debajo. Abre la fuente y decide cómo continuar. La brújula no inicia acciones por su cuenta.',
      },
      {
        question: '¿Para quién está pensada la plataforma?',
        answer:
          'Para sesiones participativas en escuelas, universidades, formación continua, talleres, eventos y reuniones.',
      },
      {
        question: '¿Es accesible arsnova.eu?',
        answer:
          'arsnova.eu cumple las WCAG 2.2, nivel AA. Los recorridos principales se pueden usar con teclado y los lectores de pantalla anuncian cambios importantes. En preguntas con temporizador, el tiempo de respuesta es ajustable: estándar, «Tiempo ×10» o «Sin plazo». Hay una versión del informe PDF validada según PDF/UA-1.',
        linkLabel: 'Abrir la declaración de accesibilidad',
      },
    ],
  },
  ctaSection: {
    title: '¿Listo para la próxima sesión en directo?',
    lead: 'Prueba una sesión en directo y la brújula de moderación, o consulta el código fuente y la documentación de las funciones y del alojamiento.',
  },
  jsonLd: {
    websiteName: 'arsnova.eu – Información',
    webAppDescription:
      'Cuestionarios, Q&A, nubes de palabras y sondeos rápidos en directo para educación y organizaciones. Crea todos los tipos de pregunta y dirige desde el móvil. Incluye seguridad en la respuesta e informes PDF. Gratis, de código abierto, autoalojable y sin cuenta. WCAG 2.2 AA.',
    featureList: [
      'Cuestionario en directo y votaciones',
      'Seguridad en la respuesta para preguntas puntuables',
      'Informe de resultados en PDF y puesta en común al terminar la sesión',
      'Preguntas de estimación numérica con dos rondas y estadística',
      'Muro de preguntas con moderación, votos a favor y en contra',
      'Brújula de moderación con el siguiente paso a partir de señales en directo',
      'Sala de espera, presentador, QR/código',
      'Creación de todos los tipos de pregunta y control de la sesión desde el móvil',
      'Control de la sesión desde un móvil o una tableta conectados',
      'Respuesta única y múltiple, respuesta corta, texto libre, encuesta, valoración, estimación numérica, emparejamiento, ordenación y clasificación',
      'Markdown y KaTeX',
      'Fase de lectura y Peer Instruction',
      'Nubes de palabras de Q&A y texto libre, con expresiones y ponderación',
      'Ordenación por saldo de votos, apoyo claro y controversia',
      'Modo equipo y ajustes previos',
      'Clasificación, rachas y códigos de bonificación',
      'Importación/exportación y sincronización Yjs',
      'Importación de contenido generado con IA externa, validado con Zod',
      'Interfaz en cinco idiomas',
      'Cumple las WCAG 2.2, nivel AA',
      'Ejecución Docker en tu infraestructura y registro de administración',
      'Contenidos del cuestionario conservados en el dispositivo y funcionamiento respetuoso con el RGPD',
    ],
  },
};

export default es;

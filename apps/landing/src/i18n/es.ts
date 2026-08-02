import type { Messages } from './types';

const es: Messages = {
  meta: {
    homeTitle:
      'arsnova.eu | Cuestionario en directo, preguntas de estimación numérica y muro de preguntas',
    homeDescription:
      'Plataforma de respuesta interactiva de código abierto para educación, formación y organizaciones: cuestionario en directo, autoevaluación, informe de resultados (PDF), preguntas de estimación numérica, muro de preguntas moderable, nube de palabras y sondeo rápido — cumple las WCAG 2.2, nivel AA, gratuita, ejecutable en tu propia infraestructura y lista sin cuenta.',
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
    eyebrow: 'Respuesta interactiva para educación y organizaciones',
    titleLine1: 'Cuestionarios, estimaciones,',
    titleLine2: 'moderación de preguntas',
    titleAccent1: 'en directo y gratis',
    titleAccent2: ' sin cuenta.',
    lead: 'arsnova.eu reúne cuestionarios en directo, preguntas de estimación numérica, autoevaluación en preguntas puntuables, muro de preguntas, análisis de nube de palabras y sondeo rápido en una sola interfaz para escuelas, universidades, formación continua, talleres y empresas. Código abierto, ejecutable en tu propia infraestructura y pensado para un funcionamiento respetuoso con el RGPD.',
    a11yLink: 'Cumple las WCAG 2.2, nivel AA',
    a11ySuffix: '— teclado, lector de pantalla y tiempo de respuesta ajustable individualmente.',
    cards: [
      { title: 'En directo al instante', text: 'Comparte la sesión con código o QR' },
      { title: 'Q&A con muro de preguntas', text: 'Moderación, votos y nube temática' },
      {
        title: 'Autoevaluación y análisis posterior',
        text: 'Detecta conceptos erróneos, exporta el informe PDF',
      },
      {
        title: 'Código abierto y autoalojable',
        text: 'Docker, Postgres, Redis y registro de administración',
      },
    ],
  },
  estimate: {
    eyebrow: 'Nuevo en el cuestionario en directo',
    title: 'Estimar cifras, debatir y comparar con claridad la segunda ronda',
    lead: 'La pregunta de estimación numérica está pensada para fechas, órdenes de magnitud, medidas y probabilidades. El anfitrión fija un valor de referencia, un rango de entrada y una tolerancia; los participantes solo introducen un número.',
    summary: [
      'La banda de plausibilidad limita las entradas permitidas.',
      'La banda de tolerancia valora las estimaciones aceptables desde el punto de vista de la materia.',
      'Nadie ve la distribución antes de publicar los resultados.',
      'La ronda 1 y la ronda 2 se comparan después del debate.',
    ],
    docsLink: 'Abrir la documentación de la pregunta de estimación numérica',
    demoAria:
      'Ejemplo de resultados de una pregunta de estimación numérica sobre la Revolución Francesa',
    hostView: 'Vista de anfitrión tras publicar',
    demoQuestion: '¿Cuándo comenzó la Revolución Francesa?',
    reference: 'Referencia 1789',
    toleranceBand: 'Banda de tolerancia',
    toleranceValue: '1700 a 1900',
    plausibilityBand: 'Banda de plausibilidad',
    plausibilityValue: '1500 a 2000',
    histogramNote:
      'El histograma, la línea de referencia y la banda de tolerancia aparecen solo tras publicar los resultados. Hasta entonces solo queda visible un indicador neutro de progreso.',
    median: 'Mediana',
    inBand: 'en la banda',
    round2: 'Ronda 2',
    round2Value: '14 respuestas más próximas al valor de referencia',
  },
  confidence: {
    eyebrow: 'Análisis didáctico',
    title: '¿Correcto o incorrecto — y con qué grado de seguridad?',
    lead: 'Con la autoevaluación, los participantes indican tras responder cuán seguros están (1–5). Ves no solo la tasa de aciertos, sino también respuestas incorrectas con alta seguridad — un recurso útil para la evaluación formativa, el plan para la puesta en común y el informe de resultados (PDF) al terminar la sesión.',
    summary: [
      'No es un tipo de pregunta propio — opcional en preguntas puntuables.',
      'Escala 1–5 tras la respuesta, sin efecto en los puntos.',
      'Tras publicar, el anfitrión ve corrección × grado de seguridad.',
      '«Incorrecto y seguro» marca posibles conceptos erróneos.',
      'Tras la sesión: informe de resultados (PDF) y puesta en común.',
    ],
    docsConfidence: 'Doc autoevaluación',
    docsExport: 'Doc informe de resultados (PDF)',
    demoAria: 'Ejemplo de evaluación con autoevaluación tras publicar resultados',
    hostView: 'Vista de anfitrión tras publicar',
    demoQuestion: '¿Qué estructura es la más estable?',
    badge: 'Autoevaluación',
    matrix: [
      { label: 'Correcta · confianza baja', count: 3, tone: 'emerald' },
      { label: 'Correcta · confianza media', count: 8, tone: 'emerald' },
      { label: 'Correcta · confianza alta', count: 11, tone: 'emerald' },
      { label: 'Incorrecta · confianza baja', count: 2, tone: 'slate' },
      { label: 'Incorrecta · confianza media', count: 4, tone: 'amber' },
      { label: 'Incorrecta · confianza alta', count: 2, tone: 'rose' },
    ],
    falseHighTitle: '2 respuestas incorrectas con alta seguridad',
    falseHighText:
      'La opción B se eligió 2× con alto grado de seguridad — una señal de posibles conceptos erróneos en la puesta en común.',
    consolidated: 'Sólido',
    misconceptionRisk: 'Riesgo de concepto erróneo',
    fragile: 'Frágil',
    afterSessionAria: 'Exportación al terminar la sesión',
    afterSession: 'Al terminar la sesión',
    debriefing: 'Puesta en común',
    resultsPdf: 'Informe de resultados (PDF)',
    exportNote:
      'Informe listo para imprimir con estado de aprendizaje, mapa de calor y textos de las preguntas — en la vista de anfitrión y en la tarjeta del cuestionario. El CSV para Excel sigue disponible en «Más».',
  },
  qaWall: {
    eyebrow: 'Q&A en directo como espacio de moderación',
    title: 'Recoger preguntas, priorizarlas y leerlas como mapa temático',
    lead: 'El muro de preguntas no es un chat secundario. Es un canal en directo propio para docentes y ponentes: moderar aportaciones, detectar prioridades colectivas, hacer visibles los puntos controvertidos y llevar los temas clave a la sala mediante una nube de palabras Q&A ponderada.',
    signals: [
      {
        label: 'Premoderación',
        text: 'Publica las preguntas solo cuando son relevantes en el contexto didáctico.',
      },
      {
        label: 'Voto colectivo',
        text: 'Los votos a favor y en contra indican las prioridades, los puntos de desacuerdo y las necesidades de aclaración.',
      },
      {
        label: 'Nube temática',
        text: 'Palabras y frases se ponderan según apoyo, acuerdo o controversia.',
      },
      {
        label: 'Próximamente: brújula de moderación',
        text: 'Primero llegan las señales deterministas; el análisis lingüístico opcional y el resumen siguen siendo extensiones.',
      },
    ],
    docsLink: 'Abrir la valoración Q&A y la controversia en GitHub',
    demoAria: 'Ejemplo de muro de preguntas con moderación, votos y nube de palabras',
    hostView: 'Vista Q&A del anfitrión',
    demoTitle: 'Preguntas sobre el evento',
    moderationActive: 'Premoderación activa',
    sortMostSupported: 'Más apoyadas',
    sortBest: 'Mejores preguntas',
    sortControversial: 'Controvertidas',
    questions: [
      {
        score: '+18',
        title:
          '¿Cuándo sigue siendo plausible una estimación desde el punto de vista de la materia?',
        meta: '15 a favor · 3 en contra · mejor pregunta',
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
    wordCloudHint: 'Ponderada por el apoyo positivo y la controversia.',
    frozenLive: 'Actualizaciones en directo en pausa',
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
      'Siguiente paso: una brújula de moderación determinista, opcionalmente complementada con señales de análisis lingüístico asíncronas y resúmenes basados en las preguntas enviadas.',
  },
  workflow: {
    eyebrow: 'Para docencia, formación y talleres',
    title: 'De la idea a la sesión en directo en pocos minutos',
    lead: 'De la pregunta a la sesión en curso, el recorrido evita a propósito pasos innecesarios. Eso hace que el arranque sea rápido y fiable para docentes, formadores y moderadores.',
    stepLabel: 'Paso',
    steps: [
      {
        number: '01',
        title: 'Preparar un cuestionario',
        description:
          'Crea preguntas directamente o importa contenidos existentes. Markdown, KaTeX, respuesta corta y preguntas de estimación numérica están integrados.',
      },
      {
        number: '02',
        title: 'Iniciar una sesión',
        description:
          'Empieza sin cuenta: abre una sesión, elige un estilo, comparte código o QR y usa la vista del presentador si lo necesitas.',
      },
      {
        number: '03',
        title: 'Moderar en directo',
        description:
          'Los participantes votan, formulan preguntas y priorizan juntos. El anfitrión y el presentador muestran el cuestionario, el muro de preguntas, la nube de palabras, la fase de lectura, la cuenta atrás, la segunda ronda y los resultados en un solo recorrido.',
      },
      {
        number: '04',
        title: 'Análisis posterior y exportación',
        description:
          'Al terminar la sesión, el informe de resultados (PDF) está listo — con estado de aprendizaje, autoevaluación y textos completos de las preguntas. En la colección de cuestionarios encuentras puesta en común y PDF de la última ejecución; CSV para Excel en «Más».',
      },
    ],
  },
  features: {
    eyebrow: 'Lo que distingue a arsnova.eu',
    title: 'Hecho para la interacción en directo, no solo para encuestas en diapositivas',
    lead: 'arsnova.eu combina un arranque rápido, solidez didáctica y una base técnica transparente. La plataforma se mantiene sencilla en el día a día sin reducir las posibilidades.',
    items: [
      {
        title: 'Listo en poco tiempo',
        description:
          'Los anfitriones empiezan sin cuenta. Los participantes entran en la sesión directamente con un código de 6 dígitos o un QR.',
        icon: 'single',
      },
      {
        title: 'Autoevaluación en el cuestionario en directo',
        description:
          'Los participantes indican tras responder cuán seguros están. Detectas respuestas incorrectas con alta seguridad, priorizas la puesta en común y exportas el estado de aprendizaje en el informe de resultados (PDF).',
        icon: 'confidence',
      },
      {
        title: 'Informe de resultados para el análisis posterior',
        description:
          'Al terminar la sesión exportas un informe PDF listo para imprimir con gráficos, textos de preguntas y autoevaluación. El CSV para Excel sigue siendo opcional en «Más».',
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
          'MC/SC, respuestas cortas, valoraciones, fase de lectura, Peer Instruction y modo de presentación apoyan el aprendizaje, la formación y la moderación en directo.',
        icon: 'toggle',
      },
      {
        title: 'Muro de preguntas en lugar de un chat secundario',
        description:
          'El Q&A permite premoderar, fijar, archivar, votar a favor o en contra y ordenar por apoyo, calidad y controversia.',
        icon: 'qa',
      },
      {
        title: 'Nube de palabras expresiva',
        description:
          'Texto libre y Q&A se condensan en palabras y frases; el muro pondera por acuerdo, mayoría clara o controversia.',
        icon: 'cloud',
      },
      {
        title: 'Para distintos contextos',
        description:
          'Ajustes previos, modo equipo, modo anónimo, apodos y elección de estilo ayudan desde clase y seminario hasta taller, evento y reunión.',
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
          'Los contenidos del cuestionario permanecen en tu dispositivo, la eliminación opcional de datos y la explotación en tu propia infraestructura te dan más control sobre contenidos y datos en directo.',
        icon: 'tools',
      },
      {
        title: 'Código abierto con despliegue y operación',
        description:
          'Docker, Postgres, Redis y registro de administración hacen la plataforma fiable también para alojamiento, operación y trazabilidad.',
        icon: 'server',
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
          'Tú y tus participantes usáis los recorridos centrales sin ratón. Indicadores de foco visibles y un enlace de salto al contenido facilitan la navegación.',
      },
      {
        title: 'Compatibilidad con lectores de pantalla en directo',
        description:
          'Los cambios de estado al unirse a la sesión, en las votaciones y en los cambios de fase se anuncian a los lectores de pantalla para seguir el recorrido.',
      },
      {
        title: 'Tiempo de respuesta ajustable individualmente',
        description:
          'En preguntas con tiempo eliges el tiempo estándar, el tiempo multiplicado por diez o participar sin límite. Así se puede aplicar un ajuste razonable directamente en la sesión en directo.',
      },
      {
        title: 'Informe de resultados estructurado de forma accesible',
        description:
          'El informe listo para imprimir está validado PDF/UA-1 e incluye título, idioma y etiquetas — para el análisis posterior y el intercambio accesible.',
      },
    ],
    statementLink: 'Abrir la declaración de accesibilidad',
  },
  trust: {
    eyebrow: 'Confianza',
    title: 'Construido sobre una base consolidada',
    lead: 'arsnova.eu continúa la tradición del ecosistema ARSnova y se apoya en experiencias científicas, didácticas y prácticas de muchos años de tecnología educativa.',
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
    referencesPrefix: 'Las referencias completas y la colección de publicaciones de base están en',
    referencesLink: 'ARSnova-Recherche.pdf',
    referencesSuffix: 'en GitHub.',
  },
  comparison: {
    eyebrow: 'Diferenciación',
    title: 'No solo un sustituto de Mentimeter o Kahoot',
    lead: 'El objetivo no es únicamente votar, sino cubrir todo el proceso en directo: preparar, moderar, hacer visibles los resultados y mantener el control sobre contenidos y operación.',
    points: [
      {
        title: 'Menos barreras de entrada',
        description:
          'Sin lógica de producto separada para «crear» y «unirse». Los anfitriones empiezan sin cuenta; los participantes entran con código o QR.',
      },
      {
        title: 'Más formatos de interacción',
        description:
          'Además del cuestionario: preguntas de estimación numérica, fase de lectura, Peer Instruction, sondeo rápido, muro de preguntas y nube de palabras ponderada en la misma plataforma — no solo encuestas en diapositivas.',
      },
      {
        title: 'Más control sobre datos y acceso',
        description:
          'Código abierto, ejecutable en tu propia infraestructura y con contenidos del cuestionario conservados en el dispositivo — más cumplimiento de las WCAG 2.2, nivel AA. Relevante para escuelas, universidades y organizaciones con requisitos de privacidad e inclusión.',
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
        question: '¿Necesitan cuenta anfitriones o participantes?',
        answer:
          'No. Una sesión puede iniciarse sin cuenta. Los participantes entran con código o QR.',
      },
      {
        question: '¿Dónde están los datos?',
        answer:
          'Los contenidos del cuestionario permanecen en tu dispositivo. En sesiones en directo solo se procesan los datos de sesión técnicamente necesarios; con autoalojamiento, la operación permanece en tu infraestructura.',
      },
      {
        question: '¿Puedo autoalojar arsnova.eu?',
        answer:
          'Sí. La plataforma es de código abierto y está diseñada para funcionar con Docker, PostgreSQL y Redis.',
      },
      {
        question: '¿Qué es la autoevaluación en el cuestionario?',
        answer:
          'Una pregunta adicional opcional tras las preguntas puntuables: los participantes indican en una escala de 1 a 5 cuán seguros están de su respuesta. Los puntos no cambian; en la evaluación del anfitrión ves corrección × grado de seguridad y marcas las respuestas incorrectas con alta seguridad como señal de concepto erróneo. Al terminar la sesión, el estado de aprendizaje pasa a la puesta en común y al informe de resultados (PDF).',
      },
      {
        question: '¿Puedo exportar los resultados de la sesión?',
        answer:
          'Sí. Al terminar la sesión, el informe de resultados (PDF) es el formato principal — con autoevaluación, prioridades para la puesta en común y textos completos de las preguntas. En la colección de cuestionarios encuentras puesta en común y PDF de la última ejecución. Los datos CSV tabulares están disponibles en «Más» para Excel.',
      },
      {
        question: '¿Qué tiene de especial la pregunta de estimación numérica?',
        answer:
          'Separa las entradas permitidas de la banda de tolerancia de la materia, no muestra la distribución durante la votación y puede evaluar una segunda ronda tras el debate con estadística y comparación de rondas.',
      },
      {
        question: '¿Qué puede hacer el muro de preguntas?',
        answer:
          'Los participantes envían preguntas y las ponderan con votos a favor y en contra. Los anfitriones pueden premoderar, fijar, archivar o eliminar preguntas y ordenar la lista por apoyo, mayoría clara o controversia.',
      },
      {
        question: '¿En qué se diferencia la nube de palabras Q&A?',
        answer:
          'Condensa las preguntas visibles en palabras y frases y sigue la lógica de ordenación activa. Así muestra no solo términos frecuentes, sino agrupaciones temáticas de preguntas apoyadas, claramente bien valoradas o controvertidas.',
      },
      {
        question: '¿Para quién está pensada la plataforma?',
        answer:
          'Para la interacción en directo en educación y organizaciones: escuela, universidad, formación continua, formación, taller, evento o reunión.',
      },
      {
        question: '¿Es accesible arsnova.eu?',
        answer:
          'arsnova.eu cumple las WCAG 2.2, nivel AA. Los recorridos centrales se pueden usar con teclado, los lectores de pantalla anuncian cambios de estado, el tiempo de respuesta en preguntas con tiempo es ajustable individualmente (tiempo estándar, tiempo ×10 o sin límite), y el informe de resultados estructurado de forma accesible está validado PDF/UA-1.',
        linkLabel: 'Abrir la declaración de accesibilidad',
      },
    ],
  },
  ctaSection: {
    title: '¿Listo para la próxima sesión en directo?',
    lead: 'Prueba el recorrido en directo directamente en la aplicación, o echa un vistazo al código fuente abierto, a la lógica Q&A, al procesamiento de la nube de palabras y a la infraestructura de despliegue y operación de la plataforma.',
  },
  jsonLd: {
    websiteName: 'arsnova.eu – Información',
    webAppDescription:
      'Plataforma de respuesta interactiva de código abierto para educación, formación y organizaciones: cuestionario en directo, autoevaluación, informe de resultados (PDF), preguntas de estimación numérica, muro de preguntas moderable, nube de palabras y sondeo rápido — cumple las WCAG 2.2, nivel AA, gratuita, ejecutable en tu propia infraestructura y lista sin cuenta.',
    featureList: [
      'Cuestionario en directo y votaciones',
      'Autoevaluación en preguntas puntuables',
      'Informe de resultados (PDF) y puesta en común al terminar la sesión',
      'Preguntas de estimación numérica con dos rondas y estadística',
      'Muro de preguntas con moderación, votos a favor y en contra',
      'Sala de espera, presentador, QR/código',
      'Tipos de pregunta MC/SC/respuestas cortas/texto libre/encuesta/valoración/estimación numérica',
      'Markdown y KaTeX',
      'Fase de lectura y Peer Instruction',
      'Nube de palabras Q&A y texto libre con frases y ponderación',
      'Ordenación por apoyo, mayoría clara y controversia',
      'Modo equipo y ajustes previos',
      'Clasificación, racha, código bonus',
      'Importación/exportación y sincronización Yjs',
      'Importación IA externa, validada con Zod',
      'Interfaz en cinco idiomas',
      'Cumple las WCAG 2.2, nivel AA',
      'Ejecución Docker en tu infraestructura y registro de administración',
      'Contenidos del cuestionario conservados en el dispositivo y funcionamiento respetuoso con el RGPD',
    ],
  },
};

export default es;

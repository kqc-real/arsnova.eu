/**
 * Wendet übersetzte Texte auf die Demo-Quiz-JSON an (Vorlage: quiz-demo-showcase.de.json).
 * Aufruf: node scripts/apply-demo-quiz-locale-strings.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demoDir = path.join(__dirname, '../src/assets/demo');
const basePath = path.join(demoDir, 'quiz-demo-showcase.de.json');
const base = JSON.parse(fs.readFileSync(basePath, 'utf8'));

const LOCALES = {
  en: {
    name: 'All question formats – high school demo quiz',
    description:
      '![Peer Instruction: nine concept questions and two voting rounds](assets/demo/9_konzeptfragen_panorama.svg)\n\n**Purpose:** This quiz shows that arsnova.eu supports **two voting rounds**—first vote, then discuss, then vote again. That is central to modern teaching approaches like Peer Instruction.\n\n**What is Peer Instruction?** An evidence-based teaching method (Eric Mazur, Harvard): the host poses a conceptual question with plausible distractors. Everyone answers alone first; neighbors then compare reasoning and vote again—misconceptions surface and get clarified together.\n\n**What is Markdown?** Formatting with your keyboard, no mouse needed. You type e.g. `**bold**` → **bold**, `*italic*` → *italic*, `` `code` `` → `code`. Headings with `#`, lists with `-` or `*`. In this quiz you will see Markdown in questions and answers.\n\n**What is KaTeX?** Mathematical notation like in textbooks. Wrap formulas in dollar signs: x^2 → $x^2$, one half in braces → $\\frac{1}{2}$, f\'(x) → $f\'(x)$. Perfect for math, physics, and chemistry—no installation required, it just works in arsnova.eu.\n\nThis quiz uses every arsnova.eu question format. Items are grouped by subject.\n\n| # | Subject | Format | Topic | Misconceptions / note |\n|---|---------|--------|-------|------------------------|\n| 1 | Math | Single choice | Sign change of $f\'$ and extrema | Minimum vs maximum; inflection ($f\'\'$ confused); zero ($f=0$ vs $f\'=0$) |\n| 2 | Math | Single choice | Stochastic independence | Gambler\'s fallacy; hot-hand |\n| 3 | Math | Single choice | Definite integral ≠ geometric area | Positive area; sum vs. net balance; mean value |\n| 4 | Math | Rating | Vector geometry (intersections) | Self-assessment |\n| 5 | Physics | Single choice | Newton 3 – action = reaction | Lighter vehicle feels more force; heavier exerts more; forces "cancel out" |\n| 6 | Physics | Free text | Satellite in orbit | Reasoning |\n| 7 | Biology | Single choice | Selection vs Lamarckism | Directed mutation; gradual adaptation; habituation |\n| 8 | Biology | Multiple choice | Dihybrid cross (Mendel) | All F2 are heterozygous; genes are linked |\n| 9 | Chemistry | Multiple choice | Le Chatelier (equilibrium) | A catalyst shifts the equilibrium |\n| 10 | — | Survey | Final exam prep | Study strategies |\n| 11 | — | Free text | Least certain question | Reflection |\n| 12 | — | Rating | Rate this demo quiz | Overall rating |',
    questions: [
      {
        text: '### Math: Analysis – Function and derivative\n\nThe derivative $f\'(x)$ **changes sign from positive to negative** at $x_0$.\n\nWhat is true for $f$ at that point?',
        answers: [
          { text: 'The function $f$ has a local maximum there.', isCorrect: true },
          { text: 'The function $f$ has a local minimum there.', isCorrect: false },
          { text: 'The function $f$ has an inflection point there.', isCorrect: false },
          { text: 'The function $f$ has a root there.', isCorrect: false },
        ],
      },
      {
        text: '### Math: Probability – Independent events\n\nA fair coin has come up **heads** five times in a row.\n\nWhat is the probability that the sixth toss is **tails**?',
        answers: [
          {
            text: 'Exactly 50%, because each toss is independent of the previous ones.',
            isCorrect: true,
          },
          {
            text: 'More than 50%, because tails is "due" after five heads.',
            isCorrect: false,
          },
          {
            text: 'Less than 50%, because the run of heads will probably continue.',
            isCorrect: false,
          },
          {
            text: 'It cannot be calculated because the coin might be unfair.',
            isCorrect: false,
          },
        ],
      },
      {
        text: '### Math: Analysis – Definite integral\n\nThe function $f(x) = x^2 - 4$ has zeros at $x = -2$ and $x = 2$\u2060. Between the zeros the graph lies **entirely below** the $x$-axis.\n\nWhat does $\\int_{-2}^{2} f(x)\\,\\mathrm{d}x$ compute?',
        answers: [
          {
            text: 'The signed area between the graph and the $x$-axis.',
            isCorrect: true,
          },
          {
            text: 'The absolute geometric area between the graph and the $x$-axis.',
            isCorrect: false,
          },
          {
            text: 'The total area above and below the axis.',
            isCorrect: false,
          },
          {
            text: 'The mean of all function values on $[-2, 2]$.',
            isCorrect: false,
          },
        ],
      },
      {
        text: '### Math: Self-assessment – Vector geometry\n\nIn analytic geometry you describe lines and planes with vector equations, e.g.:\n\n$$\\vec{r} = \\vec{a} + t \\cdot \\vec{u} + s \\cdot \\vec{v}$$\n\nHow confident do you feel about solving for **intersections** of lines and planes?',
        ratingLabelMin: 'Very unsure',
        ratingLabelMax: 'I can explain it',
      },
      {
        text: '### Physics: Forces in a collision\n\nA heavy truck collides head-on with a light car.\n\nHow do the forces **during the impact** on the two vehicles compare?',
        answers: [
          {
            text: 'The force exerted on the car equals the force on the truck.',
            isCorrect: true,
          },
          {
            text: 'The force on the car is greater than the force on the truck.',
            isCorrect: false,
          },
          {
            text: 'The force on the truck is greater than the force on the car.',
            isCorrect: false,
          },
          {
            text: 'The forces on the two vehicles cancel each other out completely.',
            isCorrect: false,
          },
        ],
      },
      {
        text: '### Physics: Satellite in orbit\n\nA satellite orbits Earth on a stable circular path without losing altitude.\n\nExplain in your own words why the satellite doesn\'t crash into Earth despite gravity.\n\n> Hint: Think about how speed and gravity interact.',
      },
      {
        text: '### Biology: Antibiotic resistance\n\nHospitals increasingly see antibiotic-resistant bacterial strains.\n\nWhich explanation correctly describes how resistance arises?',
        answers: [
          {
            text: 'Resistant bacteria multiply faster because the antibiotic kills off the competing strains.',
            isCorrect: true,
          },
          {
            text: 'The antibiotic causes targeted mutations that lead to resistance.',
            isCorrect: false,
          },
          {
            text: 'The bacteria gradually adapt their metabolism to the antibiotic.',
            isCorrect: false,
          },
          {
            text: 'The strongest bacteria build tolerance through habituation.',
            isCorrect: false,
          },
        ],
      },
      {
        text: '### Biology: Mendelian genetics\n\nIn a dihybrid cross, two individuals heterozygous for both genes are crossed ($\\text{AaBb} \\times \\text{AaBb}$)\u2060.\n\nWhich statements about the **F2 generation** are correct?\n\n*Select all that apply.*',
        answers: [
          {
            text: 'The phenotypic ratio in F2 is 9 : 3 : 3 : 1.',
            isCorrect: true,
          },
          {
            text: 'F2 shows trait combinations absent in the parents.',
            isCorrect: true,
          },
          {
            text: 'All F2 are heterozygous for both genes.',
            isCorrect: false,
          },
          {
            text: 'The alleles of both genes are always inherited as a linked unit.',
            isCorrect: false,
          },
        ],
      },
      {
        text: '### Chemistry: Chemical equilibrium\n\nAmmonia synthesis is exothermic:\n\n$$\\mathrm{N_2 + 3\\,H_2 \\rightleftharpoons 2\\,NH_3} \\quad \\Delta H < 0$$\n\nWhich measures shift the equilibrium **toward the products**?\n\n*Select all that apply.*',
        answers: [
          { text: 'Increasing the total pressure in the reactor', isCorrect: true },
          { text: 'Lowering the reaction temperature', isCorrect: true },
          { text: 'Adding a suitable catalyst', isCorrect: false },
          { text: 'Continuously removing ammonia from the system', isCorrect: true },
        ],
      },
      {
        text: '### Survey: Final exam preparation\n\nWhich **study strategy** do you use most often when preparing for final exams?',
        answers: [
          { text: 'Doing practice exams', isCorrect: false },
          { text: 'Making study guides', isCorrect: false },
          { text: 'Studying with a group', isCorrect: false },
          { text: 'Watching explainer videos and tutorials', isCorrect: false },
          { text: 'Using flashcards', isCorrect: false },
        ],
      },
      {
        text: '### Reflection\n\nWhich question in this quiz made you feel the **least certain**—and why?\n\nUse your answer as a starting point for your next study session.',
      },
      {
        text: '### Overall rating\n\nHow do you rate this **demo quiz** overall?\n\nConsider:\n1. Clarity of the questions\n2. Variety of formats\n3. Appropriate difficulty',
        ratingLabelMin: 'Needs improvement',
        ratingLabelMax: 'Excellent',
      },
    ],
  },
  fr: {
    name: 'Tous les formats de questions – Quiz de démonstration (lycée)',
    description:
      '![Peer Instruction : neuf questions conceptuelles et deux tours de vote](assets/demo/9_konzeptfragen_panorama.svg)\n\n**Objectif :** Ce quiz montre qu\'arsnova.eu prend en charge **deux tours de vote** : on vote, on en discute, puis on revote. C\'est central pour des méthodes comme l\'*apprentissage par les pairs* (Peer Instruction).\n\n**Qu\'est-ce que l\'apprentissage par les pairs ?** Une méthode basée sur des preuves (Eric Mazur, Harvard) : l\'enseignant·e pose une question conceptuelle avec des distracteurs plausibles. Chacun·e répond individuellement, puis compare son raisonnement avec son/sa voisin·e avant de revoter — les idées reçues émergent et sont clarifiées ensemble.\n\n**Qu\'est-ce que Markdown ?** Du formatage au clavier, sans utiliser la souris. Par ex. `**gras**` → **gras**, `*italique*` → *italique*, `` `code` `` → `code`. Titres avec `#`, listes avec `-` ou `*`. Dans ce quiz, le Markdown apparaît dans les questions et réponses.\n\n**Qu\'est-ce que KaTeX ?** Des formules comme dans les manuels. Entourez les formules de signes dollar : x^2 → $x^2$, une fraction → $\\frac{1}{2}$, f\'(x) → $f\'(x)$. Idéal pour les maths, la physique et la chimie — aucune installation requise, tout fonctionne directement dans arsnova.eu.\n\nCe quiz utilise tous les formats de questions d\'arsnova.eu. Les items sont regroupés par matière.\n\n| # | Matière | Format | Thème | Idées reçues / remarque |\n|---|---------|--------|-------|---------------------------|\n| 1 | Maths | Choix unique | Changement de signe de $f\'$ et extrema | Min. au lieu du max. ; point d\'inflexion ($f\'\'$ confondu) ; zéro ($f=0$ vs $f\'=0$) |\n| 2 | Maths | Choix unique | Événements indépendants | Illusion du joueur ; effet « main chaude » |\n| 3 | Maths | Choix unique | Intégrale définie ≠ aire géométrique | Aire positive ; somme vs bilan ; valeur moyenne |\n| 4 | Maths | Échelle | Géométrie vectorielle (intersections) | Auto-évaluation |\n| 5 | Physique | Choix unique | Newton 3 – action = réaction | Le plus léger « reçoit » plus ; le plus lourd « pousse » plus ; les forces s\'annulent |\n| 6 | Physique | Texte libre | Satellite en orbite | Raisonnement |\n| 7 | Biologie | Choix unique | Sélection vs lamarckisme | Mutation dirigée ; adaptation progressive ; accoutumance |\n| 8 | Biologie | Choix multiples | Croisement dihybride (Mendel) | Toute la F2 hétérozygote ; gènes liés |\n| 9 | Chimie | Choix multiples | Le Chatelier (équilibre) | Un catalyseur déplace l\'équilibre |\n| 10 | — | Sondage | Préparation aux examens | Stratégies de révision |\n| 11 | — | Texte libre | Question la plus incertaine | Réflexion |\n| 12 | — | Échelle | Évaluer ce quiz démo | Appréciation globale |',
    questions: [
      {
        text: '### Maths : Analyse – Fonction et dérivée\n\nLa dérivée $f\'(x)$ **change de signe de positif à négatif** en $x_0$.\n\nQue peut-on affirmer sur $f$ en ce point ?',
        answers: [
          { text: 'La fonction $f$ y admet un maximum local.', isCorrect: true },
          { text: 'La fonction $f$ y admet un minimum local.', isCorrect: false },
          { text: 'La fonction $f$ y admet un point d’inflexion.', isCorrect: false },
          { text: 'La fonction $f$ y admet un zéro.', isCorrect: false },
        ],
      },
      {
        text: '### Maths : Probabilités – Événements indépendants\n\nUne pièce équilibrée est tombée sur **pile** cinq fois de suite.\n\nQuelle est la probabilité que le sixième lancer soit **face** ?',
        answers: [
          {
            text: 'Exactement 50 %, car chaque lancer est indépendant des précédents.',
            isCorrect: true,
          },
          {
            text: 'Plus de 50 %, car face est censé sortir après cinq piles.',
            isCorrect: false,
          },
          {
            text: 'Moins de 50 %, car la série de piles va probablement continuer.',
            isCorrect: false,
          },
          {
            text: 'On ne peut pas le calculer, la pièce est peut-être truquée.',
            isCorrect: false,
          },
        ],
      },
      {
        text: '### Maths : Analyse – Intégrale définie\n\nLa fonction $f(x) = x^2 - 4$ s’annule en $x = -2$ et $x = 2$\u2060. Entre ces zéros, le graphe est **entièrement sous** l’axe des $x$.\n\nQue calcule $\\int_{-2}^{2} f(x)\\,\\mathrm{d}x$ ?',
        answers: [
          {
            text: 'L’aire algébrique entre le graphe et l’axe des $x$.',
            isCorrect: true,
          },
          {
            text: 'La valeur absolue de l\'aire géométrique entre le graphe et l’axe des $x$.',
            isCorrect: false,
          },
          {
            text: 'La somme totale des aires au-dessus et en dessous de l’axe.',
            isCorrect: false,
          },
          {
            text: 'La moyenne de toutes les valeurs de $f$ sur $[-2, 2]$.',
            isCorrect: false,
          },
        ],
      },
      {
        text: '### Maths : Auto-évaluation – Géométrie vectorielle\n\nEn géométrie analytique, on décrit droites et plans par des équations vectorielles, p. ex. :\n\n$$\\vec{r} = \\vec{a} + t \\cdot \\vec{u} + s \\cdot \\vec{v}$$\n\nÀ quel point maîtrises-tu le calcul d\'**intersections** de droites et de plans ?',
        ratingLabelMin: 'Très peu sûr·e',
        ratingLabelMax: 'Je saurais l\'expliquer',
      },
      {
        text: '### Physique : Forces lors d’un choc\n\nUn camion lourd percute de face une voiture légère.\n\nComment se comportent les forces **pendant le choc** sur les deux véhicules ?',
        answers: [
          {
            text: 'La force exercée sur la voiture est égale à celle exercée sur le camion.',
            isCorrect: true,
          },
          {
            text: 'La force sur la voiture est plus grande que celle sur le camion.',
            isCorrect: false,
          },
          {
            text: 'La force sur le camion est plus grande que celle sur la voiture.',
            isCorrect: false,
          },
          {
            text: 'Les forces sur les deux véhicules s’annulent complètement.',
            isCorrect: false,
          },
        ],
      },
      {
        text: '### Physique : Satellite en orbite\n\nUn satellite tourne autour de la Terre sur une orbite circulaire stable sans perdre d’altitude.\n\nExplique avec tes mots pourquoi le satellite ne s\'écrase pas sur la Terre malgré la gravité.\n\n> Indice : pense à l’interaction entre vitesse et gravité.',
      },
      {
        text: '### Biologie : Résistance aux antibiotiques\n\nOn observe de plus en plus de souches bactériennes résistantes dans les hôpitaux.\n\nQuelle explication décrit correctement l’apparition de la résistance ?',
        answers: [
          {
            text: 'Les bactéries résistantes se multiplient davantage car l’antibiotique élimine les souches concurrentes.',
            isCorrect: true,
          },
          {
            text: 'L’antibiotique provoque des mutations ciblées menant à la résistance.',
            isCorrect: false,
          },
          {
            text: 'Les bactéries adaptent progressivement leur métabolisme à l’antibiotique.',
            isCorrect: false,
          },
          {
            text: 'Les bactéries les plus fortes développent une tolérance par habitude.',
            isCorrect: false,
          },
        ],
      },
      {
        text: '### Biologie : Génétique mendélienne\n\nDans un croisement dihybride, on croise deux individus hétérozygotes pour les deux gènes ($\\text{AaBb} \\times \\text{AaBb}$)\u2060.\n\nQuelles affirmations sur la **génération F2** sont correctes ?\n\n*Plusieurs réponses possibles.*',
        answers: [
          {
            text: 'Le rapport phénotypique en F2 est 9 : 3 : 3 : 1.',
            isCorrect: true,
          },
          {
            text: 'En F2 apparaissent des combinaisons de traits absentes chez les parents.',
            isCorrect: true,
          },
          {
            text: 'Tous les individus de la F2 sont hétérozygotes pour les deux gènes.',
            isCorrect: false,
          },
          {
            text: 'Les allèles des deux gènes sont toujours transmis comme une unité liée.',
            isCorrect: false,
          },
        ],
      },
      {
        text: '### Chimie : Équilibre chimique\n\nLa synthèse de l’ammoniac est exothermique :\n\n$$\\mathrm{N_2 + 3\\,H_2 \\rightleftharpoons 2\\,NH_3} \\quad \\Delta H < 0$$\n\nQuelles mesures déplacent l’équilibre **vers les produits** ?\n\n*Plusieurs réponses possibles.*',
        answers: [
          { text: 'Augmenter la pression totale dans le réacteur', isCorrect: true },
          { text: 'Baisser la température de réaction', isCorrect: true },
          { text: 'Ajouter un catalyseur adapté', isCorrect: false },
          { text: 'Retirer continuellement l’ammoniac du système', isCorrect: true },
        ],
      },
      {
        text: '### Sondage : Préparation aux examens\n\nQuelle **stratégie de révision** utilises-tu le plus souvent pour préparer les examens finaux ?',
        answers: [
          { text: 'Faire des annales d\'examens', isCorrect: false },
          { text: 'Faire des fiches de révision', isCorrect: false },
          { text: 'Réviser en groupe', isCorrect: false },
          { text: 'Regarder des vidéos explicatives et tutoriels', isCorrect: false },
          { text: 'Utiliser des flashcards', isCorrect: false },
        ],
      },
      {
        text: '### Réflexion\n\nQuelle question de ce quiz t\'a paru la **moins claire** — et pourquoi ?\n\nUtilise ta réponse comme point de départ pour ta prochaine séance de révision.',
      },
      {
        text: '### Appréciation globale\n\nComment évalues-tu ce **quiz de démo** dans l’ensemble ?\n\nTiens compte de :\n1. La clarté des questions\n2. La variété des formats\n3. Un niveau de difficulté adapté',
        ratingLabelMin: 'À améliorer',
        ratingLabelMax: 'Excellent',
      },
    ],
  },
  es: {
    name: "Todos los formatos de pregunta – cuestionario demo (bachillerato)",
    description:
      '![Peer Instruction: nueve preguntas conceptuales y dos rondas de votación](assets/demo/9_konzeptfragen_panorama.svg)\n\n**Intención:** Este cuestionario muestra que arsnova.eu admite **dos rondas de votación**: primero votar, luego discutir y volver a votar. Es central en métodos como la *Peer Instruction*.\n\n**¿Qué es Peer Instruction?** Un método basado en evidencia (Eric Mazur, Harvard): el profesor plantea una pregunta conceptual con distractores plausibles. Primero cada persona responde sola; luego los vecinos comparan argumentos y votan de nuevo; así salen a la luz los malentendidos.\n\n**¿Qué es Markdown?** Formato con el teclado, sin clics. Por ejemplo `**negrita**` → **negrita**, `*cursiva*` → *cursiva*, `` `código` `` → `código`. Títulos con `#`, listas con `-` o `*`. En este cuestionario verás Markdown en preguntas y respuestas.\n\n**¿Qué es KaTeX?** Fórmulas como en los libros de texto. Rodea la fórmula con signos de dólar: x^2 → $x^2$, una fracción → $\\frac{1}{2}$, f\'(x) → $f\'(x)$. Ideal para mates, física y química; sin instalación, directamente en arsnova.eu.\n\nEste cuestionario usa todos los formatos de arsnova.eu. Las preguntas van agrupadas por materia.\n\n| # | Materia | Formato | Tema | Ideas erróneas / nota |\n|---|---------|---------|------|------------------------|\n| 1 | Mates | Opción única | Cambio de signo de $f\'$ y extremos | Mínimo en vez de máximo; punto de inflexión ($f\'\'$ confundido); raíz ($f=0$ vs $f\'=0$) |\n| 2 | Mates | Opción única | Independencia estocástica | Falacia del jugador; «mano caliente» |\n| 3 | Mates | Opción única | Integral definida ≠ área geométrica | Área positiva; suma vs balance; valor medio |\n| 4 | Mates | Valoración | Geometría vectorial (posiciones) | Autoevaluación |\n| 5 | Física | Opción única | Newton 3 – acción = reacción | Al más ligero «le afecta más»; el más pesado «empuja más»; las fuerzas se anulan |\n| 6 | Física | Texto libre | Satélite en órbita | Razonamiento |\n| 7 | Biología | Opción única | Selección vs lamarckismo | Mutación dirigida; adaptación gradual; habituación |\n| 8 | Biología | Opción múltiple | Cruce dihíbrido (Mendel) | Toda la F2 heterocigota; genes ligados |\n| 9 | Química | Opción múltiple | Le Chatelier (equilibrio) | El catalizador desplaza el equilibrio |\n| 10 | — | Encuesta | Preparación de selectividad / exámenes finales | Estrategias de estudio |\n| 11 | — | Texto libre | Pregunta con más dudas | Reflexión |\n| 12 | — | Valoración | Valorar este demo | Valoración global |',
    questions: [
      {
        text: "### Mates: Análisis – Función y derivada\n\nLa derivada $f'(x)$ **cambia de signo de positivo a negativo** en $x_0$.\n\n¿Qué ocurre con $f$ en ese punto?",
        answers: [
          { text: "La función $f$ tiene allí un máximo local.", isCorrect: true },
          { text: "La función $f$ tiene allí un mínimo local.", isCorrect: false },
          { text: "La función $f$ tiene allí un punto de inflexión.", isCorrect: false },
          { text: "La función $f$ tiene allí una raíz.", isCorrect: false },
        ],
      },
      {
        text: "### Mates: Probabilidad – Sucesos independientes\n\nUna moneda justa ha salido **cara** cinco veces seguidas.\n\n¿Cuál es la probabilidad de que en el sexto lanzamiento salga **cruz**?",
        answers: [
          { text: "Exactamente 50 %, porque cada lanzamiento es independiente de los anteriores.", isCorrect: true },
          { text: "Más del 50 %, porque tras cinco caras la cruz está «atrasada».", isCorrect: false },
          { text: "Menos del 50 %, porque lo más probable es que siga la racha de caras.", isCorrect: false },
          { text: "No se puede calcular porque la moneda podría estar trucada.", isCorrect: false },
        ],
      },
      {
        text: "### Mates: Análisis – Integral definida\n\nLa función $f(x) = x^2 - 4$ tiene ceros en $x = -2$ y $x = 2$⁠. Entre los ceros, la gráfica queda **por completo debajo** del eje $x$.\n\n¿Qué representa $\\int_{-2}^{2} f(x)\\,\\mathrm{d}x$?",
        answers: [
          { text: "El área con signo entre la gráfica y el eje $x$.", isCorrect: true },
          { text: "El área geométrica entre la gráfica y el eje $x$ como valor positivo.", isCorrect: false },
          { text: "La suma de todas las áreas parciales por encima y por debajo del eje.", isCorrect: false },
          { text: "La media de todos los valores de $f$ en $[-2, 2]$.", isCorrect: false },
        ],
      },
      {
        text: "### Mates: Autoevaluación – Geometría vectorial\n\nEn geometría analítica se describen rectas y planos con ecuaciones vectoriales, p. ej.:\n\n$$\\vec{r} = \\vec{a} + t \\cdot \\vec{u} + s \\cdot \\vec{v}$$\n\n¿Qué tan seguro te sientes con las **posiciones relativas** de rectas y planos?",
        ratingLabelMin: "Muy inseguro",
        ratingLabelMax: "Puedo explicarlo",
      },
      {
        text: "### Física: Fuerzas en un choque\n\nUn camión pesado choca de frente con un coche ligero.\n\n¿Cómo se comparan las fuerzas **durante el impacto** sobre los dos vehículos?",
        answers: [
          { text: "La fuerza sobre el coche es igual en magnitud a la fuerza sobre el camión.", isCorrect: true },
          { text: "La fuerza sobre el coche es mayor que la del camión.", isCorrect: false },
          { text: "La fuerza sobre el camión es mayor que la del coche.", isCorrect: false },
          { text: "Las fuerzas sobre ambos vehículos se anulan por completo.", isCorrect: false },
        ],
      },
      {
        text: "### Física: Satélite en órbita\n\nUn satélite orbita la Tierra en una trayectoria circular estable sin perder altitud.\n\nExplica con tus palabras por qué el satélite no cae a la Tierra a pesar de la gravedad.\n\n> Pista: piensa en la relación entre velocidad y gravedad.",
      },
      {
        text: "### Biología: Resistencia a antibióticos\n\nEn los hospitales aparecen cada vez más cepas bacterianas resistentes.\n\n¿Qué explicación describe correctamente el origen de la resistencia?",
        answers: [
          { text: "Las bacterias resistentes se multiplican más porque el antibiótico mata al resto.", isCorrect: true },
          { text: "El antibiótico provoca mutaciones dirigidas que llevan a la resistencia.", isCorrect: false },
          { text: "Las bacterias adaptan poco a poco su metabolismo al antibiótico.", isCorrect: false },
          { text: "Las bacterias más fuertes desarrollan tolerancia por costumbre.", isCorrect: false },
        ],
      },
      {
        text: "### Biología: Genética mendeliana\n\nEn un cruce dihíbrido se cruzan dos individuos heterocigotos para ambos genes ($\\text{AaBb} \\times \\text{AaBb}$)⁠.\n\n¿Qué afirmaciones sobre la **generación F2** son correctas?\n\n*Varias respuestas correctas.*",
        answers: [
          { text: "La proporción fenotípica en F2 es 9 : 3 : 3 : 1.", isCorrect: true },
          { text: "En F2 aparecen combinaciones de rasgos que faltan en los padres.", isCorrect: true },
          { text: "Todos los descendientes F2 son heterocigotos para ambos genes.", isCorrect: false },
          { text: "Los alelos de ambos genes siempre se heredan como una unidad ligada.", isCorrect: false },
        ],
      },
      {
        text: "### Química: Equilibrio químico\n\nLa síntesis de amoníaco es exotérmica:\n\n$$\\mathrm{N_2 + 3\\,H_2 \\rightleftharpoons 2\\,NH_3} \\quad \\Delta H < 0$$\n\n¿Qué medidas desplazan el equilibrio **hacia los productos**?\n\n*Varias respuestas correctas.*",
        answers: [
          { text: "Aumentar la presión total en el reactor", isCorrect: true },
          { text: "Bajar la temperatura de reacción", isCorrect: true },
          { text: "Añadir un catalizador adecuado", isCorrect: false },
          { text: "Retirar continuamente el amoníaco del sistema", isCorrect: true },
        ],
      },
      {
        text: "### Encuesta: Preparación de exámenes finales\n\n¿Qué **estrategia de estudio** usas con más frecuencia para preparar los exámenes finales?",
        answers: [
          { text: "Hacer exámenes de convocatorias anteriores", isCorrect: false },
          { text: "Hacer resúmenes y fichas", isCorrect: false },
          { text: "Practicar en grupo de estudio", isCorrect: false },
          { text: "Ver vídeos explicativos y tutoriales", isCorrect: false },
          { text: "Usar tarjetas y repetición espaciada", isCorrect: false },
        ],
      },
      {
        text: "### Reflexión\n\n¿En qué pregunta de este cuestionario te sentiste **más inseguro** — y por qué?\n\nUsa tu respuesta como punto de partida para tu próxima sesión de estudio.",
      },
      {
        text: "### Valoración global\n\n¿Cómo valoras este **cuestionario demo** en conjunto?\n\nTen en cuenta:\n1. Claridad de las preguntas\n2. Variedad de formatos\n3. Dificultad adecuada",
        ratingLabelMin: "Mejorable",
        ratingLabelMax: "Excelente",
      },
    ],

  },
  it: {
    name: "Tutti i formati di domanda – quiz dimostrativo (liceo / secondaria)",
    description:
      '![Peer Instruction: nove domande concettuali e due turni di voto](assets/demo/9_konzeptfragen_panorama.svg)\n\n**Scopo:** Questo quiz mostra che arsnova.eu supporta **due turni di voto**: prima si vota, poi si discute, poi si vota di nuovo. È centrale in metodologie come la *Peer Instruction*.\n\n**Che cos’è la Peer Instruction?** Un metodo basato su evidenze (Eric Mazur, Harvard): l’insegnante pone una domanda concettuale con distrattori plausibili. Prima ognuno risponde da solo; poi i vicini confrontano le motivazioni e rivotano — così emergono e si chiariscono i malintesi.\n\n**Che cos’è Markdown?** Formattazione da tastiera, senza clic. Es. `**grassetto**` → **grassetto**, `*corsivo*` → *corsivo*, `` `codice` `` → `codice`. Titoli con `#`, elenchi con `-` o `*`. In questo quiz trovi Markdown in domande e risposte.\n\n**Che cos’è KaTeX?** Formule come sui libri di testo. Racchiudi la formula tra dollari: x^2 → $x^2$, una frazione → $\\frac{1}{2}$, f\'(x) → $f\'(x)$. Ideale per matematica, fisica, chimica — senza installazione, direttamente in arsnova.eu.\n\nQuesto quiz usa tutti i formati di domanda di arsnova.eu. Le domande sono raggruppate per materia.\n\n| # | Materia | Formato | Tema | Idee sbagliate / nota |\n|---|---------|---------|------|------------------------|\n| 1 | Matematica | Scelta singola | Cambio di segno di $f\'$ ed estremi | Minimo invece del massimo; flesso ($f\'\'$ confuso); radice ($f=0$ vs $f\'=0$) |\n| 2 | Matematica | Scelta singola | Indipendenza stocastica | Fallacia del giocatore; «mano calda» |\n| 3 | Matematica | Scelta singola | Integrale definito ≠ area geometrica | Area positiva; somma vs bilancio; valor medio |\n| 4 | Matematica | Valutazione | Geometria vettoriale (mutue posizioni) | Autovalutazione |\n| 5 | Fisica | Scelta singola | Newton 3 – azione = reazione | Sul più leggero «agisce di più»; il più pesante «spinge di più»; le forze si annullano |\n| 6 | Fisica | Testo libero | Satellite in orbita | Argomentazione |\n| 7 | Biologia | Scelta singola | Selezione vs lamarckismo | Mutazione diretta; adattamento graduale; assuefazione |\n| 8 | Biologia | Scelta multipla | Incrocio diibrido (Mendel) | Tutta la F2 eterozigote; geni accoppiati |\n| 9 | Chimica | Scelta multipla | Le Chatelier (equilibrio) | Il catalizzatore sposta l’equilibrio |\n| 10 | — | Sondaggio | Preparazione alla maturità / esami finali | Strategie di studio |\n| 11 | — | Testo libero | Domanda con più incertezza | Riflessione |\n| 12 | — | Valutazione | Valuta questo quiz dimostrativo | Giudizio complessivo |',
    questions: [
      {
        text: "### Matematica: Analisi – Funzione e derivata\n\nLa derivata $f'(x)$ **cambia segno da positivo a negativo** in $x_0$.\n\nCosa vale per $f$ in quel punto?",
        answers: [
          { text: "La funzione $f$ ha lì un massimo locale.", isCorrect: true },
          { text: "La funzione $f$ ha lì un minimo locale.", isCorrect: false },
          { text: "La funzione $f$ ha lì un punto di flesso.", isCorrect: false },
          { text: "La funzione $f$ ha lì uno zero.", isCorrect: false },
        ],
      },
      {
        text: "### Matematica: Probabilità – Eventi indipendenti\n\nCon una moneta equa è uscito **testa** cinque volte di seguito.\n\nQual è la probabilità che al sesto lancio esca **croce**?",
        answers: [
          { text: "Esattamente il 50%, perché ogni lancio è indipendente dai precedenti.", isCorrect: true },
          { text: "Più del 50%, perché dopo cinque teste la croce è «in ritardo».", isCorrect: false },
          { text: "Meno del 50%, perché è probabile che continui la serie di teste.", isCorrect: false },
          { text: "Non si può calcolare perché la moneta potrebbe essere truccata.", isCorrect: false },
        ],
      },
      {
        text: "### Matematica: Analisi – Integrale definito\n\nLa funzione $f(x) = x^2 - 4$ ha zeri in $x = -2$ e $x = 2$⁠. Tra gli zeri il grafico sta **completamente sotto** l’asse $x$.\n\nCosa rappresenta $\\int_{-2}^{2} f(x)\\,\\mathrm{d}x$?",
        answers: [
          { text: "L’area con segno tra il grafico e l’asse $x$.", isCorrect: true },
          { text: "L’area geometrica tra il grafico e l’asse $x$ come valore positivo.", isCorrect: false },
          { text: "La somma di tutte le aree parziali sopra e sotto l’asse.", isCorrect: false },
          { text: "La media di tutti i valori di $f$ su $[-2, 2]$.", isCorrect: false },
        ],
      },
      {
        text: "### Matematica: Autovalutazione – Geometria vettoriale\n\nNella geometria analitica descrivi rette e piani con equazioni vettoriali, ad es.:\n\n$$\\vec{r} = \\vec{a} + t \\cdot \\vec{u} + s \\cdot \\vec{v}$$\n\nQuanto ti senti sicuro sui compiti sulle **mutue posizioni** di rette e piani?",
        ratingLabelMin: "Molto insicuro",
        ratingLabelMax: "So spiegarlo",
      },
      {
        text: "### Fisica: Forze nell’urto\n\nUn camion pesante urta frontalmente una piccola auto.\n\nCome si comportano le forze **durante l’urto** sui due veicoli?",
        answers: [
          { text: "La forza sull’auto ha la stessa intensità della forza sul camion.", isCorrect: true },
          { text: "La forza sull’auto è maggiore di quella sul camion.", isCorrect: false },
          { text: "La forza sul camion è maggiore di quella sull’auto.", isCorrect: false },
          { text: "Le forze sui due veicoli si annullano completamente.", isCorrect: false },
        ],
      },
      {
        text: "### Fisica: Satellite in orbita\n\nUn satellite orbita intorno alla Terra su un’orbita circolare stabile senza perdere quota.\n\nSpiega con parole tue perché il satellite non precipita sulla Terra nonostante la gravità.\n\n> Suggerimento: pensa all’interazione tra velocità e gravità.",
      },
      {
        text: "### Biologia: Resistenza agli antibiotici\n\nNegli ospedali compaiono sempre più ceppi batterici resistenti.\n\nQuale spiegazione descrive correttamente l’origine della resistenza?",
        answers: [
          { text: "I batteri resistenti si moltiplicano di più perché l’antibiotico uccide gli altri.", isCorrect: true },
          { text: "L’antibiotico provoca mutazioni mirate che portano alla resistenza.", isCorrect: false },
          { text: "I batteri adattano gradualmente il metabolismo all’antibiotico.", isCorrect: false },
          { text: "I batteri più forti sviluppano tolleranza per abitudine.", isCorrect: false },
        ],
      },
      {
        text: "### Biologia: Genetica mendeliana\n\nIn un incrocio diibrido si incrociano due individui eterozigoti per entrambi i geni ($\\text{AaBb} \\times \\text{AaBb}$)⁠.\n\nQuali affermazioni sulla **generazione F2** sono corrette?\n\n*Più risposte corrette.*",
        answers: [
          { text: "Il rapporto fenotipico in F2 è 9 : 3 : 3 : 1.", isCorrect: true },
          { text: "In F2 compaiono combinazioni di caratteri assenti nei genitori.", isCorrect: true },
          { text: "Tutti i discendenti F2 sono eterozigoti per entrambi i geni.", isCorrect: false },
          { text: "Gli alleli di entrambi i geni sono sempre ereditati come unità accoppiata.", isCorrect: false },
        ],
      },
      {
        text: "### Chimica: Equilibrio chimico\n\nLa sintesi dell’ammoniaca è esotermica:\n\n$$\\mathrm{N_2 + 3\\,H_2 \\rightleftharpoons 2\\,NH_3} \\quad \\Delta H < 0$$\n\nQuali misure spostano l’equilibrio **verso i prodotti**?\n\n*Più risposte corrette.*",
        answers: [
          { text: "Aumentare la pressione totale nel reattore", isCorrect: true },
          { text: "Abbassare la temperatura di reazione", isCorrect: true },
          { text: "Aggiungere un catalizzatore adatto", isCorrect: false },
          { text: "Rimuovere continuamente l’ammoniaca dal sistema", isCorrect: true },
        ],
      },
      {
        text: "### Sondaggio: Preparazione agli esami finali\n\nQuale **strategia di studio** usi più spesso per preparare gli esami finali?",
        answers: [
          { text: "Svolgere tracce d’esame degli anni precedenti", isCorrect: false },
          { text: "Scrivere riassunti e schede", isCorrect: false },
          { text: "Esercitarsi in gruppo di studio", isCorrect: false },
          { text: "Guardare video lezioni e tutorial", isCorrect: false },
          { text: "Usare flashcard e ripetizione spaziata", isCorrect: false },
        ],
      },
      {
        text: "### Riflessione\n\nPer quale domanda di questo quiz ti sei sentito **più incerto** — e perché?\n\nUsa la tua risposta come punto di partenza per la prossima sessione di studio.",
      },
      {
        text: "### Valutazione complessiva\n\nCome valuti questo **quiz dimostrativo** nel complesso?\n\nConsidera:\n1. Chiarezza delle domande\n2. Varietà dei formati\n3. Difficoltà adeguata",
        ratingLabelMin: "Da migliorare",
        ratingLabelMax: "Eccellente",
      },
    ],

  },
};

function applyLocale(locale, patch) {
  const out = structuredClone(base);
  out.quiz.name = patch.name;
  out.quiz.description = patch.description;
  for (let i = 0; i < patch.questions.length; i++) {
    const pq = patch.questions[i];
    const q = out.quiz.questions[i];
    if (!q) throw new Error(`Missing question index ${i} for ${locale}`);
    q.text = pq.text;
    if (pq.ratingLabelMin !== undefined) q.ratingLabelMin = pq.ratingLabelMin;
    if (pq.ratingLabelMax !== undefined) q.ratingLabelMax = pq.ratingLabelMax;
    if (pq.answers && pq.answers.length) {
      for (let j = 0; j < pq.answers.length; j++) {
        if (!q.answers[j]) throw new Error(`Missing answer ${j} q${i} ${locale}`);
        q.answers[j].text = pq.answers[j].text;
      }
    }
  }
  const outPath = path.join(demoDir, `quiz-demo-showcase.${locale}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
}

for (const loc of ['en', 'fr', 'es', 'it']) {
  applyLocale(loc, LOCALES[loc]);
}

console.log('Wrote quiz-demo-showcase.{en,fr,es,it}.json');

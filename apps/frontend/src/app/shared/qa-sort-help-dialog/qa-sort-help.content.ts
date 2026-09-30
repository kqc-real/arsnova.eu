/** Locale-keyed help copy for Q&A sort modes BEST / CONTROVERSIAL (source: Desktop MDs). */

export type QaSortHelpKind = 'BEST' | 'CONTROVERSIAL';

export type QaSortHelpLocale = 'de' | 'en' | 'fr' | 'es' | 'it';

export function resolveQaSortHelpLocale(localeId: string): QaSortHelpLocale {
  const base = (localeId ?? 'de').toLowerCase().split(/[-_]/)[0] ?? 'de';
  if (base === 'en' || base === 'fr' || base === 'es' || base === 'it') {
    return base;
  }
  return 'de';
}

export interface QaSortHelpCopy {
  title: string;
  markdown: string;
}

const BEST_SCORE_FORMULA = String.raw`$$
\operatorname{BestScore}=
\frac{
\hat{p}+\frac{z^{2}}{2N}
-z\sqrt{\frac{\hat{p}(1-\hat{p})}{N}+\frac{z^{2}}{4N^{2}}}
}{
1+\frac{z^{2}}{N}
}
$$`;

const CONTROVERSY_SCORE_FORMULA = String.raw`$$
\operatorname{ControversyScore}=
\min\left(1,\frac{2\cdot\min(p,n)}{p+n+T}\right)
$$`;

const CONTROVERSY_LABEL_FORMULA = String.raw`$$
\operatorname{ControversyScore}>0{,}5
\qquad\text{und}\qquad
p+n\ge T
$$`;

const CONTROVERSY_LABEL_FORMULA_EN = String.raw`$$
\operatorname{ControversyScore}>0.5
\qquad\text{and}\qquad
p+n\ge T
$$`;

const CONTROVERSY_LABEL_FORMULA_FR = String.raw`$$
\operatorname{ControversyScore}>0{,}5
\qquad\text{et}\qquad
p+n\ge T
$$`;

const CONTROVERSY_LABEL_FORMULA_ES = String.raw`$$
\operatorname{ControversyScore}>0{,}5
\qquad\text{y}\qquad
p+n\ge T
$$`;

const CONTROVERSY_LABEL_FORMULA_IT = String.raw`$$
\operatorname{ControversyScore}>0{,}5
\qquad\text{e}\qquad
p+n\ge T
$$`;

export const QA_SORT_HELP_COPY: Record<QaSortHelpKind, Record<QaSortHelpLocale, QaSortHelpCopy>> = {
  BEST: {
    de: {
      title: 'Beste Fragen',
      markdown: `
Diese Sortierung bevorzugt Fragen, die viel Zustimmung erhalten haben und deren Bewertung durch genügend Stimmen gestützt wird. Eine einzelne positive Stimme reicht deshalb nicht automatisch für den ersten Platz.

#### Formel

Es gilt:

- \\(p\\): Anzahl der Dafür-Stimmen
- \\(n\\): Anzahl der Dagegen-Stimmen
- \\(N=p+n\\): Gesamtzahl der Stimmen
- \\(\\hat{p}=p/N\\): Anteil der Dafür-Stimmen
- \\(z=1{,}96\\): Wert für ein Konfidenzniveau von 95 %

Für \\(N>0\\) wird die untere Grenze des Wilson-Konfidenzintervalls berechnet:

${BEST_SCORE_FORMULA}

Wenn noch keine Stimme abgegeben wurde, ist der Wert 0.

#### Einfach erklärt

Der Wert betrachtet nicht nur den Anteil der Zustimmung, sondern auch, wie verlässlich dieser Anteil bereits ist. Bei wenigen Stimmen wird das Ergebnis vorsichtiger bewertet. Deshalb steht eine Frage mit 10 Dafür- und 0 Dagegen-Stimmen vor einer Frage mit 2 Dafür- und 0 Dagegen-Stimmen, obwohl beide 100 % Zustimmung haben.

| Stimmen | Zustimmung | Wert ungefähr |
| --- | ---: | ---: |
| 2 dafür, 0 dagegen | 100 % | 0,34 |
| 10 dafür, 0 dagegen | 100 % | 0,72 |
| 8 dafür, 2 dagegen | 80 % | 0,49 |

Bei gleichem Wert entscheiden nacheinander die Anzahl der Dafür-Stimmen, der weitere Stimmenwert und schließlich der Erstellungszeitpunkt. Hervorgehobene Fragen werden unabhängig davon zuerst angezeigt.
`.trim(),
    },
    en: {
      title: 'Best questions',
      markdown: `
This ranking favours questions with strong positive support backed by a meaningful number of votes. A single positive vote is therefore not enough to place a question at the top automatically.

#### Formula

Let:

- \\(p\\): number of votes in favour
- \\(n\\): number of votes against
- \\(N=p+n\\): total number of votes
- \\(\\hat{p}=p/N\\): proportion of votes in favour
- \\(z=1.96\\): value for a 95% confidence level

For \\(N>0\\), the lower bound of the Wilson confidence interval is used:

${BEST_SCORE_FORMULA}

The score is 0 when no votes have been cast.

#### In plain language

The score considers both the level of support and how reliable that result is. Results based on only a few votes receive a larger confidence adjustment. A question with 10 votes in favour and none against therefore ranks above a question with 2 votes in favour and none against, even though both have 100% support.

| Votes | Support | Approximate score |
| --- | ---: | ---: |
| 2 in favour, 0 against | 100% | 0.34 |
| 10 in favour, 0 against | 100% | 0.72 |
| 8 in favour, 2 against | 80% | 0.49 |

If scores are equal, ties are resolved by the number of votes in favour, the additional vote value and finally the creation time. Highlighted questions are shown first regardless of this score.
`.trim(),
    },
    fr: {
      title: 'Meilleures questions',
      markdown: `
Ce classement privilégie les questions qui recueillent une forte adhésion, confirmée par un nombre suffisant de votes. Une seule voix favorable ne suffit donc pas automatiquement pour placer une question en tête.

#### Formule

On note :

- \\(p\\) : nombre de votes favorables
- \\(n\\) : nombre de votes défavorables
- \\(N=p+n\\) : nombre total de votes
- \\(\\hat{p}=p/N\\) : proportion de votes favorables
- \\(z=1{,}96\\) : valeur correspondant à un niveau de confiance de 95 %

Pour \\(N>0\\), le système utilise la borne inférieure de l’intervalle de confiance de Wilson :

${BEST_SCORE_FORMULA}

En l’absence de vote, la valeur est égale à 0.

#### En termes simples

Le score tient compte à la fois du niveau d’adhésion et de la fiabilité du résultat. Une proportion calculée sur très peu de votes est évaluée avec davantage de prudence. Une question ayant reçu 10 votes favorables et aucun vote défavorable est donc classée avant une question ayant reçu 2 votes favorables et aucun vote défavorable, même si toutes deux obtiennent 100 % d’adhésion.

| Votes | Adhésion | Score approximatif |
| --- | ---: | ---: |
| 2 favorables, 0 défavorable | 100 % | 0,34 |
| 10 favorables, 0 défavorable | 100 % | 0,72 |
| 8 favorables, 2 défavorables | 80 % | 0,49 |

En cas d’égalité, le nombre de votes favorables, la valeur de vote complémentaire puis la date de création départagent les questions. Les questions mises en avant sont affichées en premier, indépendamment de ce score.
`.trim(),
    },
    es: {
      title: 'Mejores preguntas',
      markdown: `
Esta ordenación da prioridad a las preguntas que cuentan con un amplio respaldo positivo sustentado por un número suficiente de votos. Por tanto, un único voto favorable no basta para situar automáticamente una pregunta en primer lugar.

#### Fórmula

Se utilizan las siguientes variables:

- \\(p\\): número de votos a favor
- \\(n\\): número de votos en contra
- \\(N=p+n\\): número total de votos
- \\(\\hat{p}=p/N\\): proporción de votos a favor
- \\(z=1{,}96\\): valor correspondiente a un nivel de confianza del 95 %

Para \\(N>0\\), se calcula el límite inferior del intervalo de confianza de Wilson:

${BEST_SCORE_FORMULA}

Si todavía no se ha emitido ningún voto, el valor es 0.

#### Explicación sencilla

La puntuación tiene en cuenta tanto el nivel de apoyo como la fiabilidad del resultado. Cuando hay pocos votos, el resultado se valora con mayor cautela. Por eso, una pregunta con 10 votos a favor y ninguno en contra aparece antes que otra con 2 votos a favor y ninguno en contra, aunque ambas tengan un 100 % de apoyo.

| Votos | Apoyo | Puntuación aproximada |
| --- | ---: | ---: |
| 2 a favor, 0 en contra | 100 % | 0,34 |
| 10 a favor, 0 en contra | 100 % | 0,72 |
| 8 a favor, 2 en contra | 80 % | 0,49 |

En caso de empate, se comparan sucesivamente el número de votos a favor, el valor adicional de los votos y, por último, la fecha de creación. Las preguntas destacadas se muestran primero con independencia de esta puntuación.
`.trim(),
    },
    it: {
      title: 'Domande migliori',
      markdown: `
Questo ordinamento privilegia le domande che ricevono un ampio consenso positivo, sostenuto da un numero sufficiente di voti. Un solo voto favorevole, quindi, non basta per portare automaticamente una domanda al primo posto.

#### Formula

Si utilizzano le seguenti variabili:

- \\(p\\): numero di voti favorevoli
- \\(n\\): numero di voti contrari
- \\(N=p+n\\): numero totale di voti
- \\(\\hat{p}=p/N\\): quota di voti favorevoli
- \\(z=1{,}96\\): valore corrispondente a un livello di confidenza del 95%

Per \\(N>0\\) viene calcolato il limite inferiore dell’intervallo di confidenza di Wilson:

${BEST_SCORE_FORMULA}

Se non è stato espresso alcun voto, il valore è 0.

#### In parole semplici

Il punteggio considera sia il livello di consenso sia l’affidabilità del risultato. Quando i voti sono pochi, il risultato viene valutato con maggiore prudenza. Per questo una domanda con 10 voti favorevoli e nessun voto contrario viene classificata prima di una domanda con 2 voti favorevoli e nessun voto contrario, anche se entrambe hanno il 100% di consenso.

| Voti | Consenso | Punteggio approssimativo |
| --- | ---: | ---: |
| 2 favorevoli, 0 contrari | 100% | 0,34 |
| 10 favorevoli, 0 contrari | 100% | 0,72 |
| 8 favorevoli, 2 contrari | 80% | 0,49 |

In caso di parità vengono confrontati, nell’ordine, il numero di voti favorevoli, il valore di voto aggiuntivo e infine la data di creazione. Le domande in evidenza vengono mostrate per prime indipendentemente da questo punteggio.
`.trim(),
    },
  },
  CONTROVERSIAL: {
    de: {
      title: 'Umstrittene Fragen',
      markdown: `
Diese Sortierung bevorzugt Fragen, bei denen sich Dafür- und Dagegen-Stimmen möglichst gleichmäßig verteilen. Eine zusätzliche Schwelle verhindert, dass sehr wenige Stimmen bereits als aussagekräftiger Konflikt erscheinen.

#### Formel

Zusätzlich gilt:

- \\(P\\): Anzahl der Teilnehmenden in der Session
- \\(T=\\max(1; \\lceil 0{,}1\\cdot P\\rceil)\\): Schwelle in Höhe von 10 % der Teilnehmenden, mindestens jedoch 1

${CONTROVERSY_SCORE_FORMULA}

Eine Frage wird ausdrücklich als **umstritten** gekennzeichnet, wenn beide Bedingungen erfüllt sind:

${CONTROVERSY_LABEL_FORMULA}

#### Einfach erklärt

Je ausgeglichener Zustimmung und Ablehnung sind, desto höher ist der Wert. Ein einseitiges Ergebnis ist nicht umstritten. Bei 100 Teilnehmenden beträgt die Schwelle \\(T=10\\).

| Stimmen | Berechnung | Wert ungefähr |
| --- | --- | ---: |
| 10 dafür, 10 dagegen | \\(20/(20+10)\\) | 0,67 |
| 18 dafür, 2 dagegen | \\(4/(20+10)\\) | 0,13 |
| 2 dafür, 2 dagegen | \\(4/(4+10)\\) | 0,29 |
| 10 dafür, 0 dagegen | \\(0/(10+10)\\) | 0,00 |

Die erste Frage gilt in diesem Beispiel als umstritten. Die Frage mit 2 zu 2 Stimmen ist zwar ausgeglichen, hat aber noch zu wenige Stimmen für eine belastbare Kennzeichnung.
`.trim(),
    },
    en: {
      title: 'Controversial questions',
      markdown: `
This ranking favours questions where votes in favour and against are distributed as evenly as possible. An additional threshold prevents a very small number of votes from appearing to represent a meaningful disagreement.

#### Formula

Additionally, let:

- \\(P\\): number of participants in the session
- \\(T=\\max(1, \\lceil 0.1\\cdot P\\rceil)\\): a threshold equal to 10% of participants, with a minimum of 1

${CONTROVERSY_SCORE_FORMULA}

A question is explicitly labelled **controversial** only when both conditions are met:

${CONTROVERSY_LABEL_FORMULA_EN}

#### In plain language

The more evenly support and opposition are split, the higher the score. A one-sided result is not controversial. With 100 participants, the threshold is \\(T=10\\).

| Votes | Calculation | Approximate score |
| --- | --- | ---: |
| 10 in favour, 10 against | \\(20/(20+10)\\) | 0.67 |
| 18 in favour, 2 against | \\(4/(20+10)\\) | 0.13 |
| 2 in favour, 2 against | \\(4/(4+10)\\) | 0.29 |
| 10 in favour, 0 against | \\(0/(10+10)\\) | 0.00 |

In this example, the first question qualifies as controversial. The 2–2 result is evenly split, but there are not yet enough votes for a reliable label.
`.trim(),
    },
    fr: {
      title: 'Questions controversées',
      markdown: `
Ce classement privilégie les questions pour lesquelles les votes favorables et défavorables sont répartis de la manière la plus équilibrée possible. Un seuil supplémentaire évite qu’un très petit nombre de votes soit interprété comme un désaccord significatif.

#### Formule

On note également :

- \\(P\\) : nombre de participants à la session
- \\(T=\\max(1; \\lceil 0{,}1\\cdot P\\rceil)\\) : seuil correspondant à 10 % des participants, avec un minimum de 1

${CONTROVERSY_SCORE_FORMULA}

Une question est explicitement signalée comme **controversée** uniquement si les deux conditions suivantes sont remplies :

${CONTROVERSY_LABEL_FORMULA_FR}

#### En termes simples

Plus les avis favorables et défavorables sont équilibrés, plus le score est élevé. Un résultat très nettement orienté dans un seul sens n’est pas controversé. Pour 100 participants, le seuil est \\(T=10\\).

| Votes | Calcul | Score approximatif |
| --- | --- | ---: |
| 10 favorables, 10 défavorables | \\(20/(20+10)\\) | 0,67 |
| 18 favorables, 2 défavorables | \\(4/(20+10)\\) | 0,13 |
| 2 favorables, 2 défavorables | \\(4/(4+10)\\) | 0,29 |
| 10 favorables, 0 défavorable | \\(0/(10+10)\\) | 0,00 |

Dans cet exemple, la première question est considérée comme controversée. Le résultat 2 contre 2 est équilibré, mais le nombre de votes reste insuffisant pour attribuer ce qualificatif de manière fiable.
`.trim(),
    },
    es: {
      title: 'Preguntas controvertidas',
      markdown: `
Esta ordenación da prioridad a las preguntas cuyos votos a favor y en contra están repartidos de la forma más equilibrada posible. Un umbral adicional evita que un número muy reducido de votos se interprete como un desacuerdo significativo.

#### Fórmula

Además:

- \\(P\\): número de participantes en la sesión
- \\(T=\\max(1; \\lceil 0{,}1\\cdot P\\rceil)\\): umbral equivalente al 10 % de los participantes, con un mínimo de 1

${CONTROVERSY_SCORE_FORMULA}

Una pregunta se marca expresamente como **controvertida** únicamente cuando se cumplen ambas condiciones:

${CONTROVERSY_LABEL_FORMULA_ES}

#### Explicación sencilla

Cuanto más equilibrados estén el apoyo y el rechazo, mayor será la puntuación. Un resultado claramente inclinado hacia un lado no se considera controvertido. Con 100 participantes, el umbral es \\(T=10\\).

| Votos | Cálculo | Puntuación aproximada |
| --- | --- | ---: |
| 10 a favor, 10 en contra | \\(20/(20+10)\\) | 0,67 |
| 18 a favor, 2 en contra | \\(4/(20+10)\\) | 0,13 |
| 2 a favor, 2 en contra | \\(4/(4+10)\\) | 0,29 |
| 10 a favor, 0 en contra | \\(0/(10+10)\\) | 0,00 |

En este ejemplo, la primera pregunta se considera controvertida. El resultado de 2 votos frente a 2 está equilibrado, pero todavía no hay votos suficientes para aplicar la etiqueta con fiabilidad.
`.trim(),
    },
    it: {
      title: 'Domande controverse',
      markdown: `
Questo ordinamento privilegia le domande per le quali i voti favorevoli e contrari sono distribuiti nel modo più equilibrato possibile. Una soglia aggiuntiva evita che un numero molto ridotto di voti venga interpretato come un disaccordo significativo.

#### Formula

Inoltre:

- \\(P\\): numero di partecipanti alla sessione
- \\(T=\\max(1; \\lceil 0{,}1\\cdot P\\rceil)\\): soglia pari al 10% dei partecipanti, con un minimo di 1

${CONTROVERSY_SCORE_FORMULA}

Una domanda viene contrassegnata esplicitamente come **controversa** solo quando sono soddisfatte entrambe le condizioni:

${CONTROVERSY_LABEL_FORMULA_IT}

#### In parole semplici

Più i voti favorevoli e contrari sono equilibrati, più alto è il punteggio. Un risultato chiaramente unilaterale non è controverso. Con 100 partecipanti, la soglia è \\(T=10\\).

| Voti | Calcolo | Punteggio approssimativo |
| --- | --- | ---: |
| 10 favorevoli, 10 contrari | \\(20/(20+10)\\) | 0,67 |
| 18 favorevoli, 2 contrari | \\(4/(20+10)\\) | 0,13 |
| 2 favorevoli, 2 contrari | \\(4/(4+10)\\) | 0,29 |
| 10 favorevoli, 0 contrari | \\(0/(10+10)\\) | 0,00 |

In questo esempio la prima domanda è considerata controversa. Il risultato 2 a 2 è equilibrato, ma i voti non sono ancora sufficienti per attribuire l’etichetta in modo affidabile.
`.trim(),
    },
  },
};

import { QA_CONTROVERSY_DAMPING, QA_CONTROVERSY_MIN_VOTES } from '@arsnova/shared-types';

/** Locale-keyed help copy for Q&A sort modes BEST / CONTROVERSIAL. */

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
\frac{2\cdot\min(p,n)}{p+n+${QA_CONTROVERSY_DAMPING}}
$$`;

const CONTROVERSY_LABEL_FORMULA = String.raw`$$
\operatorname{ControversyScore}>0{,}5
\qquad\text{und}\qquad
p+n\ge ${QA_CONTROVERSY_MIN_VOTES}
$$`;

const CONTROVERSY_LABEL_FORMULA_EN = String.raw`$$
\operatorname{ControversyScore}>0.5
\qquad\text{and}\qquad
p+n\ge ${QA_CONTROVERSY_MIN_VOTES}
$$`;

const CONTROVERSY_LABEL_FORMULA_FR = String.raw`$$
\operatorname{ControversyScore}>0{,}5
\qquad\text{et}\qquad
p+n\ge ${QA_CONTROVERSY_MIN_VOTES}
$$`;

const CONTROVERSY_LABEL_FORMULA_ES = String.raw`$$
\operatorname{ControversyScore}>0{,}5
\qquad\text{y}\qquad
p+n\ge ${QA_CONTROVERSY_MIN_VOTES}
$$`;

const CONTROVERSY_LABEL_FORMULA_IT = String.raw`$$
\operatorname{ControversyScore}>0{,}5
\qquad\text{e}\qquad
p+n\ge ${QA_CONTROVERSY_MIN_VOTES}
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
      title: 'Strong support',
      markdown: `
This ranking favors questions with strong positive support backed by a meaningful number of votes. A single positive vote does not automatically put a question at the top. This score does not measure the factual accuracy of a question.

#### Formula

Let:

- \\(p\\): number of votes in favor
- \\(n\\): number of votes against
- \\(N=p+n\\): total number of votes
- \\(\\hat{p}=p/N\\): proportion of votes in favor
- \\(z=1.96\\): value for a 95% confidence level

For \\(N>0\\), the lower bound of the Wilson confidence interval is used:

${BEST_SCORE_FORMULA}

The score is 0 when no votes have been cast.

#### In plain language

The score considers both the level of support and how reliable that result is. Results based on only a few votes receive a larger confidence adjustment. A question with 10 votes in favor and none against therefore ranks above a question with 2 votes in favor and none against, even though both have 100% support.

| Votes | Support | Approximate score |
| --- | ---: | ---: |
| 2 in favor, 0 against | 100% | 0.34 |
| 10 in favor, 0 against | 100% | 0.72 |
| 8 in favor, 2 against | 80% | 0.49 |

If scores are equal, ties are resolved by the number of votes in favor, the net vote count, and finally the creation time. Pinned questions are shown first regardless of this score.
`.trim(),
    },
    fr: {
      title: 'Forte adhésion',
      markdown: `
Ce classement privilégie les questions qui recueillent une forte adhésion, appuyée par un nombre suffisant de votes. Un seul vote favorable ne suffit donc pas automatiquement à placer une question en tête. Ce score ne mesure pas l’exactitude du contenu de la question.

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
      title: 'Apoyo claro',
      markdown: `
Esta ordenación da prioridad a las preguntas que cuentan con un amplio respaldo positivo sustentado por un número suficiente de votos. Por tanto, un único voto favorable no basta para situar automáticamente una pregunta en primer lugar. Esta puntuación no mide la exactitud del contenido.

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

En caso de empate, se comparan sucesivamente el número de votos a favor, el saldo de votos y, por último, la fecha de creación. Las preguntas fijadas se muestran primero con independencia de esta puntuación.
`.trim(),
    },
    it: {
      title: 'Consenso solido',
      markdown: `
Questo ordinamento privilegia le domande che ricevono un ampio consenso positivo, sostenuto da un numero sufficiente di voti. Un solo voto favorevole, quindi, non basta per portare automaticamente una domanda al primo posto. Il punteggio non misura la correttezza del contenuto.

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

In caso di parità vengono confrontati, nell’ordine, il numero di voti favorevoli, il saldo dei voti e infine la data di creazione. Le domande in evidenza vengono mostrate per prime indipendentemente da questo punteggio.
`.trim(),
    },
  },
  CONTROVERSIAL: {
    de: {
      title: 'Kontroverse',
      markdown: `
Es zählen die abgegebenen Stimmen pro Frage. Je gleichmäßiger sie sich auf Dafür und Dagegen verteilen, desto höher ist der Score.

#### Formel

- \\(p\\) · Dafür-Stimmen
- \\(n\\) · Dagegen-Stimmen

Der feste Zuschlag von ${QA_CONTROVERSY_DAMPING} im Nenner dämpft den Score bei wenigen Stimmen.

${CONTROVERSY_SCORE_FORMULA}

Eine Frage erhält das Label »Umstritten«, wenn der Score über 0,5 liegt und mindestens ${QA_CONTROVERSY_MIN_VOTES} Stimmen abgegeben wurden.

${CONTROVERSY_LABEL_FORMULA}

Unterhalb dieser Stimmenzahl zeigt die Frage »Zu wenige Stimmen«.

| Stimmen | Wert ungefähr |
| --- | ---: |
| 10 dafür, 10 dagegen | 0,83 |
| 18 dafür, 2 dagegen | 0,17 |
| 2 dafür, 2 dagegen | 0,50 |
| 10 dafür, 0 dagegen | 0,00 |

Die Frage mit 10 zu 10 Stimmen gilt als umstritten. Die Frage mit 2 zu 2 Stimmen ist ebenso ausgeglichen, hat aber zu wenige Stimmen für diese Kennzeichnung.
`.trim(),
    },
    en: {
      title: 'Controversy',
      markdown: `
The score uses the votes cast on each question. The more evenly votes are split for and against, the higher the score.

#### Formula

- \\(p\\) · votes in favor
- \\(n\\) · votes against

Adding a fixed ${QA_CONTROVERSY_DAMPING} to the denominator reduces the score when few votes have been cast.

${CONTROVERSY_SCORE_FORMULA}

A question is marked “Controversial” when its score exceeds 0.5 and at least ${QA_CONTROVERSY_MIN_VOTES} votes have been cast.

${CONTROVERSY_LABEL_FORMULA_EN}

Below this vote count, the question is marked “Too few votes”.

| Votes | Approximate score |
| --- | ---: |
| 10 in favor, 10 against | 0.83 |
| 18 in favor, 2 against | 0.17 |
| 2 in favor, 2 against | 0.50 |
| 10 in favor, 0 against | 0.00 |

The 10–10 question is marked controversial. The 2–2 question is just as evenly split, but has too few votes for that label.
`.trim(),
    },
    fr: {
      title: 'Controverse',
      markdown: `
Le score repose sur les votes exprimés pour chaque question. Plus les votes favorables et défavorables sont équilibrés, plus le score est élevé.

#### Formule

- \\(p\\) · votes favorables
- \\(n\\) · votes défavorables

L’ajout fixe de ${QA_CONTROVERSY_DAMPING} au dénominateur réduit le score lorsque peu de votes ont été exprimés.

${CONTROVERSY_SCORE_FORMULA}

Une question est signalée comme controversée si son score dépasse 0,5 et qu’elle a reçu au moins ${QA_CONTROVERSY_MIN_VOTES} votes.

${CONTROVERSY_LABEL_FORMULA_FR}

En dessous de ce nombre, la question est signalée comme ayant reçu trop peu de votes.

| Votes | Score approximatif |
| --- | ---: |
| 10 pour, 10 contre | 0,83 |
| 18 pour, 2 contre | 0,17 |
| 2 pour, 2 contre | 0,50 |
| 10 pour, 0 contre | 0,00 |

La question qui a reçu 10 votes pour et 10 contre est signalée comme controversée. Celle qui a reçu 2 votes pour et 2 contre est tout aussi équilibrée, mais elle a reçu trop peu de votes pour cette mention.
`.trim(),
    },
    es: {
      title: 'Controversia',
      markdown: `
La puntuación se basa en los votos emitidos en cada pregunta. Cuanto más equilibrados estén los votos a favor y en contra, mayor será la puntuación.

#### Fórmula

- \\(p\\) · votos a favor
- \\(n\\) · votos en contra

Sumar ${QA_CONTROVERSY_DAMPING} al denominador reduce la puntuación cuando se han emitido pocos votos.

${CONTROVERSY_SCORE_FORMULA}

Una pregunta se marca como controvertida si su puntuación supera 0,5 y ha recibido al menos ${QA_CONTROVERSY_MIN_VOTES} votos.

${CONTROVERSY_LABEL_FORMULA_ES}

Por debajo de esa cifra se indica que la pregunta tiene muy pocos votos.

| Votos | Puntuación aproximada |
| --- | ---: |
| 10 a favor, 10 en contra | 0,83 |
| 18 a favor, 2 en contra | 0,17 |
| 2 a favor, 2 en contra | 0,50 |
| 10 a favor, 0 en contra | 0,00 |

La pregunta con 10 votos a favor y 10 en contra se marca como controvertida. La de 2 votos a favor y 2 en contra está igual de equilibrada, pero tiene muy pocos votos para recibir esa etiqueta.
`.trim(),
    },
    it: {
      title: 'Controversia',
      markdown: `
Il punteggio si basa sui voti espressi per ogni domanda. Più i voti favorevoli e contrari sono equilibrati, più alto è il punteggio.

#### Formula

- \\(p\\) · voti favorevoli
- \\(n\\) · voti contrari

Aggiungere ${QA_CONTROVERSY_DAMPING} al denominatore riduce il punteggio quando sono stati espressi pochi voti.

${CONTROVERSY_SCORE_FORMULA}

Una domanda viene contrassegnata come controversa se il punteggio supera 0,5 e ha ricevuto almeno ${QA_CONTROVERSY_MIN_VOTES} voti.

${CONTROVERSY_LABEL_FORMULA_IT}

Sotto questa soglia viene indicato che la domanda ha ricevuto troppo pochi voti.

| Voti | Punteggio approssimativo |
| --- | ---: |
| 10 a favore, 10 contro | 0,83 |
| 18 a favore, 2 contro | 0,17 |
| 2 a favore, 2 contro | 0,50 |
| 10 a favore, 0 contro | 0,00 |

La domanda con 10 voti a favore e 10 contrari è contrassegnata come controversa. Quella con 2 voti a favore e 2 contrari è altrettanto equilibrata, ma ha ricevuto troppo pochi voti per questa etichetta.
`.trim(),
    },
  },
};

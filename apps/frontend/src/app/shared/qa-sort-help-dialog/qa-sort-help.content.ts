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

const NIST_WILSON_URL =
  'https://www.itl.nist.gov/div898/software/dataplot/refman1/auxillar/propconf.htm';

function wilsonLowerBoundFormula(label: string): string {
  return String.raw`$$
\text{${label}}=
\frac{
\hat{p}+\frac{z^{2}}{2N}
-z\sqrt{\frac{\hat{p}(1-\hat{p})}{N}+\frac{z^{2}}{4N^{2}}}
}{
1+\frac{z^{2}}{N}
}
$$`;
}

const REDDIT_CONTROVERSY_URL =
  'https://github.com/reddit-archive/reddit/blob/master/r2/r2/lib/db/_sorts.pyx';

const CONTROVERSY_SCORE_FORMULA = String.raw`$$
S=
\frac{2\cdot\min(p,n)}{p+n+${QA_CONTROVERSY_DAMPING}}
$$`;

const CONTROVERSY_LABEL_FORMULA = String.raw`$$
S>0{,}5
\qquad\text{und}\qquad
p+n\ge ${QA_CONTROVERSY_MIN_VOTES}
$$`;

const CONTROVERSY_LABEL_FORMULA_EN = String.raw`$$
S>0.5
\qquad\text{and}\qquad
p+n\ge ${QA_CONTROVERSY_MIN_VOTES}
$$`;

const CONTROVERSY_LABEL_FORMULA_FR = String.raw`$$
S>0{,}5
\qquad\text{et}\qquad
p+n\ge ${QA_CONTROVERSY_MIN_VOTES}
$$`;

const CONTROVERSY_LABEL_FORMULA_ES = String.raw`$$
S>0{,}5
\qquad\text{y}\qquad
p+n\ge ${QA_CONTROVERSY_MIN_VOTES}
$$`;

const CONTROVERSY_LABEL_FORMULA_IT = String.raw`$$
S>0{,}5
\qquad\text{e}\qquad
p+n\ge ${QA_CONTROVERSY_MIN_VOTES}
$$`;

export const QA_SORT_HELP_COPY: Record<QaSortHelpKind, Record<QaSortHelpLocale, QaSortHelpCopy>> = {
  BEST: {
    de: {
      title: 'Klare Zustimmung',
      markdown: `
Die Sortierung beruht auf den abgegebenen Stimmen. Sie berücksichtigt den Dafür-Anteil und die Stimmenzahl. Die Karte zeigt beides, zum Beispiel »100 % dafür · 1 Stimme«.

#### Formel

Es gilt:

- \\(p\\): Anzahl der Dafür-Stimmen
- \\(n\\): Anzahl der Dagegen-Stimmen
- \\(N=p+n\\): Gesamtzahl der Stimmen
- \\(\\hat{p}=p/N\\): Anteil der Dafür-Stimmen
- \\(z=1{,}96\\): Wert für ein Konfidenzniveau von 95 %

Für \\(N>0\\) wird die untere Grenze des Wilson-Konfidenzintervalls berechnet:

${wilsonLowerBoundFormula('Wilson-Untergrenze')}

Wenn noch keine Stimme abgegeben wurde, ist der Wert 0.

[NIST-Dokumentation zum Wilson-Intervall](${NIST_WILSON_URL}) (Englisch)

#### Einfach erklärt

Der Wert betrachtet nicht nur den Anteil der Zustimmung, sondern auch, wie verlässlich dieser Anteil bereits ist. Bei wenigen Stimmen wird das Ergebnis vorsichtiger bewertet. Deshalb steht eine Frage mit 10 Dafür- und 0 Dagegen-Stimmen vor einer Frage mit 2 Dafür- und 0 Dagegen-Stimmen, obwohl beide 100 % Zustimmung haben.

| Stimmen | Dafür-Anteil | Wilson-Untergrenze (ca.) |
| --- | ---: | ---: |
| 1 dafür, 0 dagegen | 100 % | 0,21 |
| 2 dafür, 0 dagegen | 100 % | 0,34 |
| 10 dafür, 0 dagegen | 100 % | 0,72 |
| 8 dafür, 2 dagegen | 80 % | 0,49 |

Bei gleichem Wert entscheiden nacheinander die Anzahl der Dafür-Stimmen, der weitere Stimmenwert und schließlich der Erstellungszeitpunkt. Hervorgehobene Fragen werden unabhängig davon zuerst angezeigt.
`.trim(),
    },
    en: {
      title: 'Strong support',
      markdown: `
The ranking is based on the votes cast. It considers the share in favor and the total number of votes. The card shows both, for example “100% in favor · 1 vote”.

#### Formula

Let:

- \\(p\\): number of votes in favor
- \\(n\\): number of votes against
- \\(N=p+n\\): total number of votes
- \\(\\hat{p}=p/N\\): proportion of votes in favor
- \\(z=1.96\\): value for a 95% confidence level

For \\(N>0\\), the lower bound of the Wilson confidence interval is used:

${wilsonLowerBoundFormula('Wilson lower bound')}

The score is 0 when no votes have been cast.

[NIST documentation on the Wilson interval](${NIST_WILSON_URL})

#### In plain language

The score considers both the level of support and how reliable that result is. Results based on only a few votes receive a larger confidence adjustment. A question with 10 votes in favor and none against therefore ranks above a question with 2 votes in favor and none against, even though both have 100% support.

| Votes | Share in favor | Wilson lower bound (approx.) |
| --- | ---: | ---: |
| 1 in favor, 0 against | 100% | 0.21 |
| 2 in favor, 0 against | 100% | 0.34 |
| 10 in favor, 0 against | 100% | 0.72 |
| 8 in favor, 2 against | 80% | 0.49 |

If scores are equal, ties are resolved by the number of votes in favor, the net vote count, and finally the creation time. Pinned questions are shown first regardless of this score.
`.trim(),
    },
    fr: {
      title: 'Forte adhésion',
      markdown: `
Le classement repose sur les votes exprimés. Il tient compte de la part de votes favorables et du nombre total de votes. La carte indique les deux, par exemple « 100 % pour · 1 vote ».

#### Formule

On note :

- \\(p\\) : nombre de votes favorables
- \\(n\\) : nombre de votes défavorables
- \\(N=p+n\\) : nombre total de votes
- \\(\\hat{p}=p/N\\) : proportion de votes favorables
- \\(z=1{,}96\\) : valeur correspondant à un niveau de confiance de 95 %

Pour \\(N>0\\), le système utilise la borne inférieure de l’intervalle de confiance de Wilson :

${wilsonLowerBoundFormula('Borne inférieure de Wilson')}

En l’absence de vote, la valeur est égale à 0.

[Documentation du NIST sur l’intervalle de Wilson](${NIST_WILSON_URL}) (en anglais)

#### En termes simples

Le score tient compte à la fois du niveau d’adhésion et de la fiabilité du résultat. Une proportion calculée sur très peu de votes est évaluée avec davantage de prudence. Une question ayant reçu 10 votes favorables et aucun vote défavorable est donc classée avant une question ayant reçu 2 votes favorables et aucun vote défavorable, même si toutes deux obtiennent 100 % d’adhésion.

| Votes | Part de votes favorables | Borne inférieure de Wilson (env.) |
| --- | ---: | ---: |
| 1 favorable, 0 défavorable | 100 % | 0,21 |
| 2 favorables, 0 défavorable | 100 % | 0,34 |
| 10 favorables, 0 défavorable | 100 % | 0,72 |
| 8 favorables, 2 défavorables | 80 % | 0,49 |

En cas d’égalité, le nombre de votes favorables, la valeur de vote complémentaire puis la date de création départagent les questions. Les questions mises en avant sont affichées en premier, indépendamment de ce score.
`.trim(),
    },
    es: {
      title: 'Apoyo claro',
      markdown: `
La clasificación se basa en los votos emitidos. Tiene en cuenta la proporción de votos a favor y el número total de votos. La tarjeta muestra ambos datos, por ejemplo «100 % a favor · 1 voto».

#### Fórmula

Se utilizan las siguientes variables:

- \\(p\\): número de votos a favor
- \\(n\\): número de votos en contra
- \\(N=p+n\\): número total de votos
- \\(\\hat{p}=p/N\\): proporción de votos a favor
- \\(z=1{,}96\\): valor correspondiente a un nivel de confianza del 95 %

Para \\(N>0\\), se calcula el límite inferior del intervalo de confianza de Wilson:

${wilsonLowerBoundFormula('Límite inferior de Wilson')}

Si todavía no se ha emitido ningún voto, el valor es 0.

[Documentación del NIST sobre el intervalo de Wilson](${NIST_WILSON_URL}) (en inglés)

#### Explicación sencilla

La puntuación tiene en cuenta tanto el nivel de apoyo como la fiabilidad del resultado. Cuando hay pocos votos, el resultado se valora con mayor cautela. Por eso, una pregunta con 10 votos a favor y ninguno en contra aparece antes que otra con 2 votos a favor y ninguno en contra, aunque ambas tengan un 100 % de apoyo.

| Votos | Proporción a favor | Límite inferior de Wilson (aprox.) |
| --- | ---: | ---: |
| 1 a favor, 0 en contra | 100 % | 0,21 |
| 2 a favor, 0 en contra | 100 % | 0,34 |
| 10 a favor, 0 en contra | 100 % | 0,72 |
| 8 a favor, 2 en contra | 80 % | 0,49 |

En caso de empate, se comparan sucesivamente el número de votos a favor, el saldo de votos y, por último, la fecha de creación. Las preguntas fijadas se muestran primero con independencia de esta puntuación.
`.trim(),
    },
    it: {
      title: 'Consenso solido',
      markdown: `
L’ordinamento si basa sui voti espressi. Tiene conto della quota di voti favorevoli e del numero totale di voti. La scheda mostra entrambi i dati, per esempio «100% a favore · 1 voto».

#### Formula

Si utilizzano le seguenti variabili:

- \\(p\\): numero di voti favorevoli
- \\(n\\): numero di voti contrari
- \\(N=p+n\\): numero totale di voti
- \\(\\hat{p}=p/N\\): quota di voti favorevoli
- \\(z=1{,}96\\): valore corrispondente a un livello di confidenza del 95%

Per \\(N>0\\) viene calcolato il limite inferiore dell’intervallo di confidenza di Wilson:

${wilsonLowerBoundFormula('Limite inferiore di Wilson')}

Se non è stato espresso alcun voto, il valore è 0.

[Documentazione del NIST sull’intervallo di Wilson](${NIST_WILSON_URL}) (in inglese)

#### In parole semplici

Il punteggio considera sia il livello di consenso sia l’affidabilità del risultato. Quando i voti sono pochi, il risultato viene valutato con maggiore prudenza. Per questo una domanda con 10 voti favorevoli e nessun voto contrario viene classificata prima di una domanda con 2 voti favorevoli e nessun voto contrario, anche se entrambe hanno il 100% di consenso.

| Voti | Quota a favore | Limite inferiore di Wilson (circa) |
| --- | ---: | ---: |
| 1 favorevole, 0 contrari | 100% | 0,21 |
| 2 favorevoli, 0 contrari | 100% | 0,34 |
| 10 favorevoli, 0 contrari | 100% | 0,72 |
| 8 favorevoli, 2 contrari | 80% | 0,49 |

In caso di parità vengono confrontati, nell’ordine, il numero di voti favorevoli, il saldo dei voti e infine la data di creazione. Le domande in evidenza vengono mostrate per prime indipendentemente da questo punteggio.
`.trim(),
    },
  },
  CONTROVERSIAL: {
    de: {
      title: 'Geteilte Stimmen',
      markdown: `
Die Sortierung beruht auf den abgegebenen Stimmen. Bei gleicher Stimmenzahl ergibt eine gleichmäßigere Verteilung auf Dafür und Dagegen einen höheren Sortierwert. Sind beide Seiten vertreten, steigt der Wert bei gleichem Verhältnis mit der Stimmenzahl. Deshalb liegt 2:2 mit 0,50 unter 60:30 mit rund 0,64.

#### Formel

- \\(p\\) · Dafür-Stimmen
- \\(n\\) · Dagegen-Stimmen

Der feste Zuschlag von ${QA_CONTROVERSY_DAMPING} im Nenner dämpft den Score bei wenigen Stimmen.

${CONTROVERSY_SCORE_FORMULA}

Die Formel gibt einer ausgeglichenen Verteilung auch bei weniger abgegebenen Stimmen Gewicht. Bei arsnova.eu steht eine Frage mit 4 Dafür- und 4 Dagegen-Stimmen (4:4) vor einer mit 60:30. Die [historische Reddit-Formel zum Modus »Controversial«](${REDDIT_CONTROVERSY_URL}) setzt 60:30 nach oben, weil dort die höhere Stimmenzahl stärker zählt.

Eine Frage erhält die Kennzeichnung »Geteilte Stimmen«, wenn der Sortierwert über 0,5 liegt und mindestens ${QA_CONTROVERSY_MIN_VOTES} Stimmen abgegeben wurden.

${CONTROVERSY_LABEL_FORMULA}

Unterhalb dieser Stimmenzahl zeigt die Frage »Zu wenige Stimmen«.

| Stimmen | Sortierwert (ca.) |
| --- | ---: |
| 10 dafür, 10 dagegen | 0,83 |
| 18 dafür, 2 dagegen | 0,17 |
| 2 dafür, 2 dagegen | 0,50 |
| 10 dafür, 0 dagegen | 0,00 |

Die Frage mit 10 zu 10 Stimmen erhält die Kennzeichnung »Geteilte Stimmen«. Die Frage mit 2 zu 2 Stimmen ist ebenso ausgeglichen und hat noch zu wenige Stimmen für diese Kennzeichnung.
`.trim(),
    },
    en: {
      title: 'Split votes',
      markdown: `
The ranking is based on the votes cast. With the same number of votes, a more even split between votes for and against gives a higher score. If both sides receive votes and the split stays the same, the score rises with the number of votes. That is why 2:2 scores 0.50, below 60:30 at about 0.64.

#### Formula

- \\(p\\) · votes in favor
- \\(n\\) · votes against

Adding a fixed ${QA_CONTROVERSY_DAMPING} to the denominator reduces the score when few votes have been cast.

${CONTROVERSY_SCORE_FORMULA}

This formula gives more weight to a balanced split, even with fewer votes. On arsnova.eu, a question with 4 votes in favor and 4 against (4:4) ranks ahead of one with 60:30. The [historical Reddit formula for the “Controversial” sort](${REDDIT_CONTROVERSY_URL}) puts 60:30 first because it gives more weight to the higher vote count.

A question is marked “Split votes” when its ranking score exceeds 0.5 and at least ${QA_CONTROVERSY_MIN_VOTES} votes have been cast.

${CONTROVERSY_LABEL_FORMULA_EN}

Below this vote count, the question is marked “Too few votes”.

| Votes | Ranking score (approx.) |
| --- | ---: |
| 10 in favor, 10 against | 0.83 |
| 18 in favor, 2 against | 0.17 |
| 2 in favor, 2 against | 0.50 |
| 10 in favor, 0 against | 0.00 |

The 10–10 question is marked “Split votes”. The 2–2 question is just as evenly split and has too few votes for the label.
`.trim(),
    },
    fr: {
      title: 'Votes partagés',
      markdown: `
Le classement repose sur les votes exprimés. À nombre de votes égal, une répartition plus équilibrée entre les votes pour et contre donne un score plus élevé. Si les deux côtés ont reçu des votes, le score augmente avec leur nombre à répartition égale. Ainsi, 2:2 donne un score de 0,50, contre environ 0,64 pour 60:30.

#### Formule

- \\(p\\) · votes favorables
- \\(n\\) · votes défavorables

L’ajout fixe de ${QA_CONTROVERSY_DAMPING} au dénominateur réduit le score lorsque peu de votes ont été exprimés.

${CONTROVERSY_SCORE_FORMULA}

La formule donne du poids à une répartition équilibrée, même avec moins de votes. Sur arsnova.eu, une question avec 4 votes pour et 4 contre (4:4) passe devant une question qui a reçu 60 votes pour et 30 contre (60:30). La [formule historique du tri « Controversial » de Reddit](${REDDIT_CONTROVERSY_URL}) place 60:30 en tête, car elle donne plus de poids au nombre de votes.

Une question porte la mention « Votes partagés » si son score de classement dépasse 0,5 et qu’elle a reçu au moins ${QA_CONTROVERSY_MIN_VOTES} votes.

${CONTROVERSY_LABEL_FORMULA_FR}

En dessous de ce nombre, la question est signalée comme ayant reçu trop peu de votes.

| Votes | Score de classement (env.) |
| --- | ---: |
| 10 pour, 10 contre | 0,83 |
| 18 pour, 2 contre | 0,17 |
| 2 pour, 2 contre | 0,50 |
| 10 pour, 0 contre | 0,00 |

La question qui a reçu 10 votes pour et 10 contre porte la mention « Votes partagés ». Les votes sont aussi équilibrés avec 2 pour et 2 contre et restent trop peu nombreux pour cette mention.
`.trim(),
    },
    es: {
      title: 'Votos divididos',
      markdown: `
La clasificación se basa en los votos emitidos. Con el mismo número de votos, un reparto más equilibrado entre votos a favor y en contra da una puntuación más alta. Cuando el reparto es el mismo y hay votos en ambos sentidos, la puntuación aumenta con el número de votos. Por eso, 2:2 obtiene 0,50 y queda por debajo de 60:30, con aproximadamente 0,64.

#### Fórmula

- \\(p\\) · votos a favor
- \\(n\\) · votos en contra

Sumar ${QA_CONTROVERSY_DAMPING} al denominador reduce la puntuación cuando se han emitido pocos votos.

${CONTROVERSY_SCORE_FORMULA}

La fórmula da peso a un reparto equilibrado incluso cuando se han emitido menos votos. En arsnova.eu, una pregunta con 4 votos a favor y 4 en contra (4:4) aparece antes que una con 60:30. La [fórmula histórica del orden «Controversial» de Reddit](${REDDIT_CONTROVERSY_URL}) sitúa 60:30 primero porque da más peso al número de votos.

Una pregunta se marca como «Votos divididos» si el valor de ordenación supera 0,5 y ha recibido al menos ${QA_CONTROVERSY_MIN_VOTES} votos.

${CONTROVERSY_LABEL_FORMULA_ES}

Por debajo de esa cifra se indica que la pregunta tiene muy pocos votos.

| Votos | Valor de ordenación (aprox.) |
| --- | ---: |
| 10 a favor, 10 en contra | 0,83 |
| 18 a favor, 2 en contra | 0,17 |
| 2 a favor, 2 en contra | 0,50 |
| 10 a favor, 0 en contra | 0,00 |

La pregunta con 10 votos a favor y 10 en contra recibe la etiqueta «Votos divididos». Los votos están igual de equilibrados con 2 a favor y 2 en contra y son demasiado pocos para esa etiqueta.
`.trim(),
    },
    it: {
      title: 'Voti divisi',
      markdown: `
L’ordinamento si basa sui voti espressi. A parità di numero di voti, una distribuzione più equilibrata tra favorevoli e contrari dà un punteggio più alto. Se ci sono voti da entrambe le parti, a parità di proporzione il punteggio aumenta con il numero di voti. Per questo 2:2 ottiene 0,50, meno di 60:30, che ottiene circa 0,64.

#### Formula

- \\(p\\) · voti favorevoli
- \\(n\\) · voti contrari

Aggiungere ${QA_CONTROVERSY_DAMPING} al denominatore riduce il punteggio quando sono stati espressi pochi voti.

${CONTROVERSY_SCORE_FORMULA}

La formula dà peso a una distribuzione equilibrata anche quando i voti sono meno numerosi. Su arsnova.eu, una domanda con 4 voti a favore e 4 contrari (4:4) precede una con 60:30. La [formula storica dell’ordinamento «Controversial» di Reddit](${REDDIT_CONTROVERSY_URL}) mette 60:30 al primo posto perché dà più peso al numero di voti.

Una domanda riceve l’etichetta «Voti divisi» se il punteggio di ordinamento supera 0,5 e sono stati espressi almeno ${QA_CONTROVERSY_MIN_VOTES} voti.

${CONTROVERSY_LABEL_FORMULA_IT}

Sotto questa soglia viene indicato che la domanda ha ricevuto troppo pochi voti.

| Voti | Punteggio di ordinamento (circa) |
| --- | ---: |
| 10 a favore, 10 contro | 0,83 |
| 18 a favore, 2 contro | 0,17 |
| 2 a favore, 2 contro | 0,50 |
| 10 a favore, 0 contro | 0,00 |

La domanda con 10 voti a favore e 10 contrari riceve l’etichetta «Voti divisi». La distribuzione di 2 voti a favore e 2 contrari è altrettanto equilibrata e ha troppo pochi voti per l’etichetta.
`.trim(),
    },
  },
};

/**
 * Lokales Q&A-Markdown-Korpus für Editor-/Wortwolken-Tests.
 * Deckt erlaubte MD/KaTeX-Features: Emphasis, Listen, Tabellen, Zitate, Code,
 * Links, HTTPS-Bilder, Emojis, sub/sup, Hardbreaks und alle vier Formelbegrenzer.
 */

const TOPICS = [
  'Regression',
  'Hypothesentest',
  'Bayes',
  'Overfitting',
  'Kreuzvalidierung',
  'Gradientenabstieg',
  'Regularisierung',
  'Wahrscheinlichkeitsraum',
  'Konfidenzintervall',
  'Bias-Varianz-Tradeoff',
  'Features',
  'Embeddings',
  'Transformer',
  'Attention',
  'Backpropagation',
  'Likelihood',
  'Prior',
  'Posterior',
  'Entropy',
  'Informationsgewinn',
] as const;

const IMAGE_URLS = [
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/320px-Cat03.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png',
  'https://picsum.photos/seed/arsnova-qa/320/180',
] as const;

const LINK_URLS = [
  'https://de.wikipedia.org/wiki/Lineare_Regression',
  'https://en.wikipedia.org/wiki/Bayes%27_theorem',
  'https://example.org/statistik?x=$1',
  'https://www.khanacademy.org/math/statistics-probability',
] as const;

function topic(index: number): string {
  return TOPICS[index % TOPICS.length]!;
}

function image(index: number): string {
  return IMAGE_URLS[index % IMAGE_URLS.length]!;
}

function link(index: number): string {
  return LINK_URLS[index % LINK_URLS.length]!;
}

/** Deterministische Markdown-Fragen mit gemischten Editor-Features. */
export function buildMarkdownQaQuestionTexts(count: number): string[] {
  return Array.from({ length: count }, (_, index) => renderTemplate(index));
}

function renderTemplate(index: number): string {
  const t = topic(index);
  const n = index + 1;
  const variant = index % 12;

  switch (variant) {
    case 0:
      return [
        `## Frage ${n}: **${t}** und *Überanpassung*`,
        '',
        `Warum gilt $x^{2}$ hier und nicht $$\\frac{a}{b}$$?`,
        '',
        `Siehe auch [Literatur](${link(index)}) und ![Diagramm](${image(index)}).`,
      ].join('\n');
    case 1:
      return [
        `### ${t} mit Listen`,
        '',
        `- **Stark** hervorgehobener Punkt`,
        `- *Kursiv* plus ~~gestrichen~~`,
        `- Inline-Code \`model.fit()\` und Formel \\(\\alpha + \\beta\\)`,
        '',
        `Display: \\[ E = mc^{2} \\]`,
      ].join('\n');
    case 2:
      return [
        `> Zitat zu **${t}**: „Ohne Daten keine Aussage.“`,
        '',
        `Bitte erkläre H<sub>0</sub> vs. H<sup>1</sup> und den Term $\\hat{\\theta}$.`,
        '',
        `Emoji-Check :smile: und :thinking: zur Stimmung.`,
      ].join('\n');
    case 3:
      return [
        `Tabelle zu Frage ${n} (${t}):`,
        '',
        '| Metrik | Wert |',
        '| --- | --- |',
        `| Accuracy | $0.${(index % 9) + 1}$ |`,
        `| Loss | $$\\mathcal{L}$$ |`,
        '',
        `Mehr Kontext: [Wiki](${link(index + 1)}).`,
      ].join('\n');
    case 4:
      return [
        `Code und Formel – Frage ${n}`,
        '',
        '```python',
        'print("$nicht_formel")',
        `y = model.predict(X)  # ${t}`,
        '```',
        '',
        `Danach echter Text und $\\nabla f(x)$ sowie ![Alt](${image(index)}).`,
      ].join('\n');
    case 5:
      return [
        `Hardbreak-Test ${n} zu *${t}*  `,
        `zweite Zeile mit \\(u_{i}\\) und **fett**.`,
        '',
        `Preis-Beispiel \\$5 ist kein Math; echter Block $$\\sum_{i=1}^{n} i$$.`,
      ].join('\n');
    case 6:
      return [
        `Nummerierte Liste ${n}`,
        '',
        `1. Starte mit **${t}**`,
        `2. Prüfe [Quelle](${link(index)})`,
        `3. Visualisiere ![Plot](${image(index)})`,
        '',
        `Abschlussfrage mit $\\mathbb{E}[X]$ und ~~obsolete Idee~~.`,
      ].join('\n');
    case 7:
      return [
        `Gemischte Inline-Features zu ${t}`,
        '',
        `Text mit \`code\`, *em*, **strong**, <sub>tief</sub>, <sup>hoch</sup>,`,
        `Autolink https://example.org/path/${n} und Formeln $a_{ij}$ / \\(\\sigma\\).`,
      ].join('\n');
    case 8:
      return [
        `### Lange Frage ${n} über ${t}`,
        '',
        `Kann jemand die Schritte erklären? Zuerst \\[\\int_{0}^{1} x^{2}\\,dx\\],`,
        `dann die Interpretation in Worten und ein Link zur [Vertiefung](${link(index)}).`,
        '',
        `> Hinweis: Bilder wie ![Beispiel](${image(index)}) helfen in der Diskussion.`,
      ].join('\n');
    case 9:
      return [
        `**Kurz:** Ist ${t} hier richtig modelliert?`,
        '',
        `- $p(y\\mid x)$`,
        `- $$\\log L(\\theta)$$`,
        `- \\(\\ell(\\theta)\\)`,
        `- \\[\\arg\\max_\\theta L(\\theta)\\]`,
      ].join('\n');
    case 10:
      return [
        `Referenzstil und Bild ${n}`,
        '',
        `Siehe [Hintergrund][ref] zu *${t}* und ![Skizze](${image(index)}).`,
        '',
        `[ref]: ${link(index)} "Quelle"`,
        '',
        `Zusatz: \`\`\`js\nconsole.log('ok $x$');\n\`\`\``,
      ].join('\n');
    default:
      return [
        `Alles-in-einem ${n}: **${t}**`,
        '',
        `1. *Theorie* mit $f'(x)$`,
        `2. Praxis in \`notebook.ipynb\``,
        `3. Bild ![viz](${image(index)})`,
        `4. Link [docs](${link(index)})`,
        '',
        `> Blockzitat mit ~~Altlast~~ und :rocket:`,
        '',
        `| A | B |`,
        `| --- | --- |`,
        `| \\(\\mu\\) | $$\\Sigma$$ |`,
        '',
        `Schlussfrage zu H<sub>a</sub>?`,
      ].join('\n');
  }
}

export const MARKDOWN_QA_SEED_ITEM_COUNT = 200;
export const MARKDOWN_QA_SEED_PARTICIPANT_COUNT = 80;

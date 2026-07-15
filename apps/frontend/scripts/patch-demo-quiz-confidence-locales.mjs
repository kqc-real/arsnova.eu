#!/usr/bin/env node
/**
 * Aktualisiert Demo-Quiz-Beschreibungen und Antworttexte auf Selbsteinschätzung-Terminologie.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demoDir = path.join(__dirname, '../src/assets/demo');

/** @type {Record<string, Array<[string, string]>>} */
const REPLACEMENTS = {
  en: [
    [
      'ask for **confidence** (1–5) after gradable answers and spot **high-confidence wrong** answers in the host view',
      'ask for **self-assessment** (1–5) after gradable answers and spot **wrong answers with high answer confidence** in the host view',
    ],
    [
      'Gauge confidence anonymously before exam prep',
      'Gauge self-assessment anonymously before exam prep',
    ],
    ['confidence rating', 'self-assessment'],
  ],
  fr: [
    [
      'demander le **niveau de confiance** (1–5) après les réponses notées et repérer les réponses **fausses mais très sûres** dans la vue hôte',
      "demander l'**autoévaluation** (1–5) après les réponses notées et repérer les réponses **fausses avec forte certitude de réponse** dans la vue hôte",
    ],
    [
      'Sonder anonymement le niveau de confiance avant une révision',
      'Sonder anonymement l’autoévaluation avant une révision',
    ],
  ],
  es: [
    [
      'preguntar el **grado de confianza** (1–5) tras respuestas evaluables y detectar respuestas **incorrectas con mucha seguridad** en la vista del anfitrión',
      'preguntar la **autoevaluación** (1–5) tras respuestas evaluables y detectar respuestas **incorrectas con alta seguridad de respuesta** en la vista del anfitrión',
    ],
    [
      'Medir de forma anónima la confianza antes de repasar para un examen',
      'Medir de forma anónima la autoevaluación antes de repasar para un examen',
    ],
    ['valoración breve de confianza', 'breve autoevaluación'],
  ],
  it: [
    [
      'chiedere il **grado di sicurezza** (1–5) dopo risposte valutabili e individuare risposte **sbagliate ma molto sicure** nella vista host',
      "chiedere l'**autovalutazione** (1–5) dopo risposte valutabili e individuare risposte **sbagliate con alta sicurezza di risposta** nella vista host",
    ],
    [
      'Rilevare in modo anonimo il livello di sicurezza prima del ripasso',
      'Rilevare in modo anonimo l’autovalutazione prima del ripasso',
    ],
  ],
};

function applyReplacements(text, pairs) {
  let result = text;
  for (const [from, to] of pairs) {
    result = result.split(from).join(to);
  }
  return result;
}

function patchFile(locale) {
  const filePath = path.join(demoDir, `quiz-demo-showcase.${locale}.json`);
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const pairs = REPLACEMENTS[locale];
  if (!pairs) return;

  payload.quiz.description = applyReplacements(payload.quiz.description, pairs);
  for (const question of payload.quiz.questions ?? []) {
    if (typeof question.text === 'string') {
      question.text = applyReplacements(question.text, pairs);
    }
    for (const answer of question.answers ?? []) {
      if (typeof answer.text === 'string') {
        answer.text = applyReplacements(answer.text, pairs);
      }
    }
  }

  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

for (const locale of Object.keys(REPLACEMENTS)) {
  patchFile(locale);
}

console.log('patched demo quiz confidence locales');

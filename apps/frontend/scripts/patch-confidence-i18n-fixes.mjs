#!/usr/bin/env node
/**
 * Gezielte Korrekturen für Confidence-i18n (trans-unit-ID-basiert).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localeDir = path.join(__dirname, '../src/locale');

/** @type {Record<string, { source?: string, targets?: Record<string, string> }>} */
const PATCHES = {
  'sessionHost.confidenceSectionLead': {
    source:
      ' Richtig oder falsch — und wie sicher? Besonders wichtig: falsch trotz hoher Antwortsicherheit. ',
    targets: {
      en: ' Right or wrong—and how confident? Especially important: wrong despite high answer confidence. ',
      fr: ' Juste ou faux — et avec quelle assurance ? Surtout : faux malgré une forte certitude de réponse. ',
      es: ' ¿Correcto o incorrecto — y con qué seguridad? Especialmente importante: incorrecto pese a alta seguridad de respuesta. ',
      it: ' Giusto o sbagliato — e quanto sei sicuro? Soprattutto: sbagliato nonostante alta sicurezza di risposta. ',
    },
  },
  'sessionHost.confidenceWrongOptionsTitle': {
    source: ' Häufig falsch mit hoher Antwortsicherheit ',
    targets: {
      en: ' Often wrong with high answer confidence ',
      fr: ' Souvent faux avec forte certitude de réponse ',
      es: ' A menudo incorrecto con alta seguridad de respuesta ',
      it: ' Spesso sbagliato con alta sicurezza di risposta ',
    },
  },
  'sessionVote.confidenceRequired': {
    source: 'Gib deine Selbsteinschätzung an, bevor du absendest.',
    targets: {
      en: 'Enter your self-assessment before submitting.',
      fr: 'Indique ton autoévaluation avant d’envoyer.',
      es: 'Indica tu autoevaluación antes de enviar.',
      it: 'Indica la tua autovalutazione prima di inviare.',
    },
  },
  'sessionVote.confidenceAriaWithLabels': {
    targets: {
      en: 'Self-assessment from 1 to 5, low: <x id="low" equiv-text="low"/>, high: <x id="high" equiv-text="high"/>',
      fr: 'Autoévaluation de 1 à 5, bas : <x id="low" equiv-text="low"/>, haut : <x id="high" equiv-text="high"/>',
      es: 'Autoevaluación de 1 a 5, baja: <x id="low" equiv-text="low"/>, alta: <x id="high" equiv-text="high"/>',
      it: 'Autovalutazione da 1 a 5, bassa: <x id="low" equiv-text="low"/>, alta: <x id="high" equiv-text="high"/>',
    },
  },
  'sessionVote.confidenceAriaWithLow': {
    targets: {
      en: 'Self-assessment from 1 to 5, low: <x id="low" equiv-text="low"/>',
      fr: 'Autoévaluation de 1 à 5, bas : <x id="low" equiv-text="low"/>',
      es: 'Autoevaluación de 1 a 5, baja: <x id="low" equiv-text="low"/>',
      it: 'Autovalutazione da 1 a 5, bassa: <x id="low" equiv-text="low"/>',
    },
  },
  'sessionVote.confidenceAriaWithHigh': {
    targets: {
      en: 'Self-assessment from 1 to 5, high: <x id="high" equiv-text="high"/>',
      fr: 'Autoévaluation de 1 à 5, haut : <x id="high" equiv-text="high"/>',
      es: 'Autoevaluación de 1 a 5, alta: <x id="high" equiv-text="high"/>',
      it: 'Autovalutazione da 1 a 5, alta: <x id="high" equiv-text="high"/>',
    },
  },
  'sessionVote.confidenceValueAria': {
    targets: {
      en: 'Self-assessment <x id="value" equiv-text="value"/>',
      fr: 'Autoévaluation <x id="value" equiv-text="value"/>',
      es: 'Autoevaluación <x id="value" equiv-text="value"/>',
      it: 'Autovalutazione <x id="value" equiv-text="value"/>',
    },
  },
  'sessionVote.confidenceHeading': {
    targets: {
      fr: 'À quel point es-tu sûr de cette réponse ?',
    },
  },
  'sessionHost.exportConfidenceCrossTab': {
    targets: {
      en: 'Correct+high <x id="correctHigh" equiv-text="crossTab.correctHigh"/> · Wrong+high <x id="incorrectHigh" equiv-text="crossTab.incorrectHigh"/>',
      fr: 'Juste+élevé <x id="correctHigh" equiv-text="crossTab.correctHigh"/> · Faux+élevé <x id="incorrectHigh" equiv-text="crossTab.incorrectHigh"/>',
      es: 'Correcto+alto <x id="correctHigh" equiv-text="crossTab.correctHigh"/> · Incorrecto+alto <x id="incorrectHigh" equiv-text="crossTab.incorrectHigh"/>',
      it: 'Corretto+alto <x id="correctHigh" equiv-text="crossTab.correctHigh"/> · Sbagliato+alto <x id="incorrectHigh" equiv-text="crossTab.incorrectHigh"/>',
    },
  },
  'sessionHost.exportConfidenceSummaryHeader': {
    targets: {
      en: 'Valid answers;Evaluated questions;Questions hidden for privacy reasons;Solid;Misconception risk;Fragile;Identified knowledge gap;Undecided',
      fr: 'Réponses valides;Questions évaluées;Questions masquées pour confidentialité;Consolidé;Risque de fausse conception;Fragile;Lacune détectée;Indécis',
    },
  },
  'sessionHost.confidenceCrossTabIncorrect': {
    targets: {
      en: 'Incorrect',
      es: 'Incorrecto',
      it: 'Sbagliato',
    },
  },
  'quizList.lastSessionAnalysisIncorrect': {
    targets: {
      es: 'incorrecto en total',
    },
  },
  'sessionHost.finishedConfidenceIncorrectOverall': {
    targets: {
      es: 'incorrecto en total',
    },
  },
  'quizEdit.confidencePreviewAria': {
    targets: {
      en: 'Five-level scale from 1 to 5',
      fr: 'Échelle à cinq niveaux de 1 à 5',
      es: 'Escala de cinco niveles de 1 a 5',
      it: 'Scala a cinque livelli da 1 a 5',
    },
  },
  'quizEdit.confidencePreviewAriaWithLow': {
    targets: {
      en: 'Five-level scale from 1 to 5, low: <x id="low" equiv-text="low"/>',
      fr: 'Échelle à cinq niveaux de 1 à 5, bas : <x id="low" equiv-text="low"/>',
      es: 'Escala de cinco niveles de 1 a 5, baja: <x id="low" equiv-text="low"/>',
      it: 'Scala a cinque livelli da 1 a 5, bassa: <x id="low" equiv-text="low"/>',
    },
  },
  'quizEdit.confidenceQuestionListHint': {
    targets: {
      en: 'Self-assessment is collected after the answer',
    },
  },
  'sessionHost.confidenceTierLowWithLabel': {
    targets: {
      en: 'Low · <x id="label" equiv-text="q.confidenceLabelLow"/>',
      fr: 'Faible · <x id="label" equiv-text="q.confidenceLabelLow"/>',
      es: 'Bajo · <x id="label" equiv-text="q.confidenceLabelLow"/>',
      it: 'Basso · <x id="label" equiv-text="q.confidenceLabelLow"/>',
    },
  },
  'sessionHost.confidenceTierHighWithLabel': {
    targets: {
      en: 'High · <x id="label" equiv-text="q.confidenceLabelHigh"/>',
      fr: 'Élevé · <x id="label" equiv-text="q.confidenceLabelHigh"/>',
      es: 'Alto · <x id="label" equiv-text="q.confidenceLabelHigh"/>',
      it: 'Alto · <x id="label" equiv-text="q.confidenceLabelHigh"/>',
    },
  },
  'quizList.lastSessionAnalysisMastery': {
    targets: {
      fr: 'Connaissances consolidées',
    },
  },
  'quizList.lastSessionAnalysisFragile': {
    targets: {
      fr: 'Connaissances fragiles',
    },
  },
  'sessionHost.finishedConfidenceMastery': {
    targets: {
      fr: 'Connaissances consolidées',
    },
  },
  'sessionHost.finishedConfidenceFragile': {
    targets: {
      fr: 'Connaissances fragiles',
    },
  },
  'quizList.lastSessionAnalysisPriority': {
    targets: {
      en: 'Debrief recommended:',
    },
  },
  'sessionHost.finishedConfidencePriority': {
    targets: {
      en: 'Debrief recommended:',
    },
  },
};

function patchTransUnit(content, unitId, patch, locale) {
  const unitRegex = new RegExp(
    `(<trans-unit id="${unitId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>[\\s\\S]*?<\\/trans-unit>)`,
    'g',
  );

  return content.replace(unitRegex, (unit) => {
    let updated = unit;
    if (patch.source) {
      updated = updated.replace(/<source>[\s\S]*?<\/source>/, `<source>${patch.source}</source>`);
    }
    const targetText = locale ? patch.targets?.[locale] : undefined;
    if (targetText) {
      if (updated.includes('<target>')) {
        updated = updated.replace(/<target>[\s\S]*?<\/target>/, `<target>${targetText}</target>`);
      } else {
        updated = updated.replace(
          /<\/source>/,
          `</source>\n        <target>${targetText}</target>`,
        );
      }
    }
    return updated;
  });
}

function patchFile(filePath, locale) {
  let content = fs.readFileSync(filePath, 'utf8');
  for (const [unitId, patch] of Object.entries(PATCHES)) {
    content = patchTransUnit(content, unitId, patch, locale);
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

patchFile(path.join(localeDir, 'messages.xlf'));
for (const locale of ['en', 'fr', 'es', 'it']) {
  patchFile(path.join(localeDir, `messages.${locale}.xlf`), locale);
}

console.log('patched confidence i18n fixes');

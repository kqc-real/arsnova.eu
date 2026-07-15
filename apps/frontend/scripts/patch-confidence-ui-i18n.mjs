#!/usr/bin/env node
/**
 * Ersetzt confidence-bezogene UI-Texte von Sicherheit/Sicherheitsgrad/Konfidenz
 * auf Selbsteinschätzung in messages*.xlf.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localeDir = path.join(__dirname, '../src/locale');

const SOURCE_REPLACEMENTS = [
  ['Niedrige Selbsteinschätzung (optional)', 'Niedrige Antwortsicherheit'],
  ['Hohe Selbsteinschätzung (optional)', 'Hohe Antwortsicherheit'],
  ['Lernstand und Sicherheit', 'Lernstand und Selbsteinschätzung'],
  [
    'Die Verbindung aus Korrektheit und Sicherheit zeigt gefestigtes Wissen, Wissenslücken und mögliche Fehlkonzepte.',
    'Die Verbindung aus Korrektheit und Selbsteinschätzung zeigt gefestigtes Wissen, Wissenslücken und mögliche Fehlkonzepte.',
  ],
  ['Antworten mit Sicherheitsgrad:', 'Antworten mit Selbsteinschätzung:'],
  ['falsch + hohe Selbsteinschätzung', 'falsch + hohe Antwortsicherheit'],
  [' Sicherheit der Antworten ', ' Selbsteinschätzung '],
  ['Sicherheit der Antworten', 'Selbsteinschätzung'],
  [
    ' Richtig oder falsch — und wie sicher? Besonders wichtig: falsch trotz hoher Sicherheit. ',
    ' Richtig oder falsch — und wie sicher? Besonders wichtig: falsch trotz hoher Selbsteinschätzung. ',
  ],
  [
    'Richtig oder falsch — und wie sicher? Besonders wichtig: falsch trotz hoher Sicherheit.',
    'Richtig oder falsch — und wie sicher? Besonders wichtig: falsch trotz hoher Selbsteinschätzung.',
  ],
  ['Korrektheit und Sicherheit', 'Korrektheit und Selbsteinschätzung'],
  [' Häufig falsch mit hoher Sicherheit ', ' Häufig falsch mit hoher Selbsteinschätzung '],
  ['Häufig falsch mit hoher Sicherheit', 'Häufig falsch mit hoher Selbsteinschätzung'],
  ['Dein Sicherheitsgrad:', 'Deine Selbsteinschätzung:'],
  ['Sicherheitsgrad:', 'Selbsteinschätzung:'],
  ['Sicherheitsgrad von 1 bis 5', 'Selbsteinschätzung von 1 bis 5'],
  ['Sicherheitsgrad ', 'Selbsteinschätzung '],
  [
    'Gib deinen Sicherheitsgrad an, bevor du absendest.',
    'Gib deine Selbsteinschätzung an, bevor du absendest.',
  ],
  ['Konfidenz n;', 'Selbsteinschätzung n;'],
  ['Einzelne Konfidenzwerte', 'Einzelne Selbsteinschätzungen'],
];

const TARGETS = {
  en: new Map([
    ['Niedrige Antwortsicherheit', 'Low answer confidence'],
    ['Hohe Antwortsicherheit', 'High answer confidence'],
    ['Lernstand und Selbsteinschätzung', 'Learning status and self-assessment'],
    [
      'Die Verbindung aus Korrektheit und Selbsteinschätzung zeigt gefestigtes Wissen, Wissenslücken und mögliche Fehlkonzepte.',
      'The link between correctness and self-assessment shows solid knowledge, knowledge gaps, and possible misconceptions.',
    ],
    ['Antworten mit Selbsteinschätzung:', 'Answers with self-assessment:'],
    ['falsch + hohe Antwortsicherheit', 'wrong + high answer confidence'],
    ['Selbsteinschätzung', 'Self-assessment'],
    [
      ' Richtig oder falsch — und wie sicher? Besonders wichtig: falsch trotz hoher Selbsteinschätzung. ',
      ' Right or wrong—and how confident? Especially important: wrong despite high self-assessment. ',
    ],
    ['Korrektheit und Selbsteinschätzung', 'Correctness and self-assessment'],
    [' Häufig falsch mit hoher Selbsteinschätzung ', ' Often wrong with high self-assessment '],
    ['Deine Selbsteinschätzung:', 'Your self-assessment:'],
    ['Selbsteinschätzung:', 'Self-assessment:'],
    ['Selbsteinschätzung von 1 bis 5', 'Self-assessment from 1 to 5'],
    ['Selbsteinschätzung ', 'Self-assessment '],
    [
      'Gib deine Selbsteinschätzung an, bevor du absendest.',
      'Give your self-assessment before submitting.',
    ],
    [
      ' Aggregierte Auswertung des zuletzt beendeten Live-Durchlaufs. Einzelne Selbsteinschätzungen und Nicknames werden nicht angezeigt.',
      'Aggregated analysis of the latest completed live session. Individual self-assessments and nicknames are not shown.',
    ],
    [
      ' Aggregierte Auswertung des zuletzt beendeten Live-Durchlaufs. Einzelne Selbsteinschätzungen und Nicknames werden nicht angezeigt. ',
      ' Aggregated analysis of the latest completed live session. Individual self-assessments and nicknames are not shown. ',
    ],
    [
      ' Für diesen Durchlauf liegt keine auswertbare Selbsteinschätzungs-Zusammenfassung vor.',
      'No self-assessment summary can be evaluated for this session.',
    ],
    [
      'Frage Nr.;Fragentext;Typ;Teilnehmende;Ø Punkte;Selbsteinschätzung n;Gefestigt;Fehlkonzept-Risiko;Fragil;Erkannte Wissenslücke;Unentschieden;Stärkstes Signal;Details',
      'Question no.;Question text;Type;Participants;Avg. points;Self-assessment n;Solid;Misconception risk;Fragile;Detected gap;Undecided;Strongest signal;Details',
    ],
  ]),
  fr: new Map([
    ['Niedrige Antwortsicherheit', 'Faible certitude de réponse'],
    ['Hohe Antwortsicherheit', 'Forte certitude de réponse'],
    ['Lernstand und Selbsteinschätzung', "Niveau d'apprentissage et autoévaluation"],
    [
      'Die Verbindung aus Korrektheit und Selbsteinschätzung zeigt gefestigtes Wissen, Wissenslücken und mögliche Fehlkonzepte.',
      'Le lien entre justesse et autoévaluation montre les acquis solides, les lacunes et les possibles fausses conceptions.',
    ],
    ['Antworten mit Selbsteinschätzung:', 'Réponses avec autoévaluation :'],
    ['falsch + hohe Antwortsicherheit', 'faux + forte certitude de réponse'],
    ['Selbsteinschätzung', 'Autoévaluation'],
    [
      ' Richtig oder falsch — und wie sicher? Besonders wichtig: falsch trotz hoher Selbsteinschätzung. ',
      ' Juste ou faux — et avec quelle assurance ? Surtout : faux malgré une autoévaluation élevée. ',
    ],
    ['Korrektheit und Selbsteinschätzung', 'Justesse et autoévaluation'],
    [' Häufig falsch mit hoher Selbsteinschätzung ', ' Souvent faux avec autoévaluation élevée '],
    ['Deine Selbsteinschätzung:', 'Ton autoévaluation :'],
    ['Selbsteinschätzung:', 'Autoévaluation :'],
    ['Selbsteinschätzung von 1 bis 5', 'Autoévaluation de 1 à 5'],
    ['Selbsteinschätzung ', 'Autoévaluation '],
    [
      'Gib deine Selbsteinschätzung an, bevor du absendest.',
      'Indique ton autoévaluation avant d’envoyer.',
    ],
    [
      ' Aggregierte Auswertung des zuletzt beendeten Live-Durchlaufs. Einzelne Selbsteinschätzungen und Nicknames werden nicht angezeigt.',
      'Analyse agrégée du dernier live terminé. Les autoévaluations individuelles et les pseudonymes ne sont pas affichés.',
    ],
    [
      ' Aggregierte Auswertung des zuletzt beendeten Live-Durchlaufs. Einzelne Selbsteinschätzungen und Nicknames werden nicht angezeigt. ',
      ' Analyse agrégée du dernier live terminé. Les autoévaluations individuelles et les pseudonymes ne sont pas affichés. ',
    ],
    [
      ' Für diesen Durchlauf liegt keine auswertbare Selbsteinschätzungs-Zusammenfassung vor.',
      'Aucune synthèse d’autoévaluation exploitable n’est disponible pour cette session.',
    ],
    [
      'Frage Nr.;Fragentext;Typ;Teilnehmende;Ø Punkte;Selbsteinschätzung n;Gefestigt;Fehlkonzept-Risiko;Fragil;Erkannte Wissenslücke;Unentschieden;Stärkstes Signal;Details',
      'N° question;Texte;Type;Participants;Ø points;Autoévaluation n;Consolidé;Risque de fausse conception;Fragile;Lacune détectée;Indécis;Signal le plus fort;Détails',
    ],
  ]),
  es: new Map([
    ['Niedrige Antwortsicherheit', 'Baja seguridad de respuesta'],
    ['Hohe Antwortsicherheit', 'Alta seguridad de respuesta'],
    ['Lernstand und Selbsteinschätzung', 'Nivel de aprendizaje y autoevaluación'],
    [
      'Die Verbindung aus Korrektheit und Selbsteinschätzung zeigt gefestigtes Wissen, Wissenslücken und mögliche Fehlkonzepte.',
      'La relación entre corrección y autoevaluación muestra conocimiento consolidado, lagunas y posibles conceptos erróneos.',
    ],
    ['Antworten mit Selbsteinschätzung:', 'Respuestas con autoevaluación:'],
    ['falsch + hohe Antwortsicherheit', 'incorrecto + alta seguridad de respuesta'],
    ['Selbsteinschätzung', 'Autoevaluación'],
    [
      ' Richtig oder falsch — und wie sicher? Besonders wichtig: falsch trotz hoher Selbsteinschätzung. ',
      ' ¿Correcto o incorrecto — y con qué seguridad? Especialmente importante: incorrecto pese a autoevaluación alta. ',
    ],
    ['Korrektheit und Selbsteinschätzung', 'Corrección y autoevaluación'],
    [
      ' Häufig falsch mit hoher Selbsteinschätzung ',
      ' A menudo incorrecto con autoevaluación alta ',
    ],
    ['Deine Selbsteinschätzung:', 'Tu autoevaluación:'],
    ['Selbsteinschätzung:', 'Autoevaluación:'],
    ['Selbsteinschätzung von 1 bis 5', 'Autoevaluación de 1 a 5'],
    ['Selbsteinschätzung ', 'Autoevaluación '],
    [
      'Gib deine Selbsteinschätzung an, bevor du absendest.',
      'Indica tu autoevaluación antes de enviar.',
    ],
    [
      ' Aggregierte Auswertung des zuletzt beendeten Live-Durchlaufs. Einzelne Selbsteinschätzungen und Nicknames werden nicht angezeigt.',
      'Análisis agregado de la última sesión en directo finalizada. No se muestran autoevaluaciones individuales ni apodos.',
    ],
    [
      ' Aggregierte Auswertung des zuletzt beendeten Live-Durchlaufs. Einzelne Selbsteinschätzungen und Nicknames werden nicht angezeigt. ',
      ' Análisis agregado de la última sesión en directo finalizada. No se muestran autoevaluaciones individuales ni apodos. ',
    ],
    [
      ' Für diesen Durchlauf liegt keine auswertbare Selbsteinschätzungs-Zusammenfassung vor.',
      'No hay un resumen de autoevaluación evaluable para esta sesión.',
    ],
    [
      'Frage Nr.;Fragentext;Typ;Teilnehmende;Ø Punkte;Selbsteinschätzung n;Gefestigt;Fehlkonzept-Risiko;Fragil;Erkannte Wissenslücke;Unentschieden;Stärkstes Signal;Details',
      'N.º pregunta;Texto;Tipo;Participantes;Ø puntos;Autoevaluación n;Consolidado;Riesgo de concepto erróneo;Frágil;Laguna detectada;Indeciso;Señal más fuerte;Detalles',
    ],
  ]),
  it: new Map([
    ['Niedrige Antwortsicherheit', 'Bassa sicurezza di risposta'],
    ['Hohe Antwortsicherheit', 'Alta sicurezza di risposta'],
    ['Lernstand und Selbsteinschätzung', 'Livello di apprendimento e autovalutazione'],
    [
      'Die Verbindung aus Korrektheit und Selbsteinschätzung zeigt gefestigtes Wissen, Wissenslücken und mögliche Fehlkonzepte.',
      'Il legame tra correttezza e autovalutazione mostra conoscenze consolidate, lacune e possibili misconcezioni.',
    ],
    ['Antworten mit Selbsteinschätzung:', 'Risposte con autovalutazione:'],
    ['falsch + hohe Antwortsicherheit', 'sbagliato + alta sicurezza di risposta'],
    ['Selbsteinschätzung', 'Autovalutazione'],
    [
      ' Richtig oder falsch — und wie sicher? Besonders wichtig: falsch trotz hoher Selbsteinschätzung. ',
      ' Giusto o sbagliato — e quanto sei sicuro? Soprattutto: sbagliato nonostante autovalutazione alta. ',
    ],
    ['Korrektheit und Selbsteinschätzung', 'Correttezza e autovalutazione'],
    [' Häufig falsch mit hoher Selbsteinschätzung ', ' Spesso sbagliato con autovalutazione alta '],
    ['Deine Selbsteinschätzung:', 'La tua autovalutazione:'],
    ['Selbsteinschätzung:', 'Autovalutazione:'],
    ['Selbsteinschätzung von 1 bis 5', 'Autovalutazione da 1 a 5'],
    ['Selbsteinschätzung ', 'Autovalutazione '],
    [
      'Gib deine Selbsteinschätzung an, bevor du absendest.',
      'Indica la tua autovalutazione prima di inviare.',
    ],
    [
      ' Aggregierte Auswertung des zuletzt beendeten Live-Durchlaufs. Einzelne Selbsteinschätzungen und Nicknames werden nicht angezeigt.',
      'Analisi aggregata dell’ultima sessione live conclusa. Autovalutazioni individuali e pseudonimi non vengono mostrati.',
    ],
    [
      ' Aggregierte Auswertung des zuletzt beendeten Live-Durchlaufs. Einzelne Selbsteinschätzungen und Nicknames werden nicht angezeigt. ',
      ' Analisi aggregata dell’ultima sessione live conclusa. Autovalutazioni individuali e pseudonimi non vengono mostrati. ',
    ],
    [
      ' Für diesen Durchlauf liegt keine auswertbare Selbsteinschätzungs-Zusammenfassung vor.',
      'Non è disponibile un riepilogo di autovalutazione valutabile per questa sessione.',
    ],
    [
      'Frage Nr.;Fragentext;Typ;Teilnehmende;Ø Punkte;Selbsteinschätzung n;Gefestigt;Fehlkonzept-Risiko;Fragil;Erkannte Wissenslücke;Unentschieden;Stärkstes Signal;Details',
      'N. domanda;Testo;Tipo;Partecipanti;Ø punti;Autovalutazione n;Consolidato;Rischio misconcezione;Fragile;Lacuna rilevata;Indeciso;Segnale più forte;Dettagli',
    ],
  ]),
};

function applySourceReplacements(text) {
  let result = text;
  for (const [from, to] of SOURCE_REPLACEMENTS) {
    result = result.split(from).join(to);
  }
  return result;
}

function decodeXml(text) {
  return text
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}

function encodeXml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function patchTarget(sourceText, locale) {
  const map = TARGETS[locale];
  if (!map) return null;
  const decoded = decodeXml(sourceText.trim());
  if (map.has(decoded)) return map.get(decoded);
  if (map.has(sourceText.trim())) return map.get(sourceText.trim());
  if (map.has(` ${decoded} `)) return map.get(` ${decoded} `);
  return null;
}

function patchFile(filePath, locale) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = applySourceReplacements(content);

  if (locale) {
    content = content.replace(/<trans-unit\b[^>]*>([\s\S]*?)<\/trans-unit>/g, (unit, inner) => {
      const sourceMatch = inner.match(/<source>([\s\S]*?)<\/source>/);
      if (!sourceMatch) return unit;
      const newTarget = patchTarget(sourceMatch[1], locale);
      if (!newTarget) return unit;
      if (inner.includes('<target>')) {
        return unit.replace(
          /<target>[\s\S]*?<\/target>/,
          `<target>${encodeXml(newTarget)}</target>`,
        );
      }
      return unit.replace(
        /<\/source>/,
        `</source>\n        <target>${encodeXml(newTarget)}</target>`,
      );
    });
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

patchFile(path.join(localeDir, 'messages.xlf'));
for (const locale of ['en', 'fr', 'es', 'it']) {
  patchFile(path.join(localeDir, `messages.${locale}.xlf`), locale);
}

console.log('patched confidence UI i18n');

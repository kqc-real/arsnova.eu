import { createHash } from 'node:crypto';
import { request } from 'node:http';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const samples = {
  de: 'Die Lernenden lesen mehrere Beispiele.',
  en: 'Learners read several examples.',
  fr: 'Les étudiantes lisaient plusieurs exemples.',
  es: 'Las estudiantes leían varios ejemplos.',
  it: 'Le studentesse andavano a leggere diversi esempi.',
};

function post(socketPath, path, payload) {
  const body = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = request(
      {
        socketPath,
        path,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        signal: AbortSignal.timeout(8_000),
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        let data = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => (data += chunk));
        response.on('error', reject);
        response.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error('Ungültige JSON-Antwort'));
          }
        });
      },
    );
    req.on('error', reject);
    req.end(body);
  });
}

async function checkNormalization(socket, locale, item) {
  const result = await post(socket, '/normalize', { locale, texts: [item] });
  const tokens = result?.items?.[0]?.tokens;
  if (
    result?.locale !== locale ||
    !result.modelId ||
    result.items?.[0]?.id !== item.id ||
    !Array.isArray(tokens) ||
    !tokens.some((token) => typeof token?.lemma === 'string' && token.lemma) ||
    (locale === 'it' &&
      !tokens.some((token) => token.text === 'andavano' && token.lemma === 'andare'))
  ) {
    throw new Error('Keine gültigen Lemmata');
  }
  return result.modelId;
}

async function checkEncoder(socket, locale, item) {
  const snapshotHash = createHash('sha256').update(item.text).digest('hex');
  const result = await post(socket, '/embed', { locale, snapshotHash, items: [item] });
  const vector = result?.items?.[0]?.embedding;
  if (
    !result?.modelId ||
    result.items?.[0]?.id !== item.id ||
    !Array.isArray(vector) ||
    vector.length < 2 ||
    !vector.every(Number.isFinite)
  ) {
    throw new Error('Kein gültiger Encoder-Vektor');
  }
  return result.modelId;
}

export async function checkTextAnalysis({
  spacySocket = '/run/spacy/nlp.sock',
  encoderSocket = '/run/wordcloud-encoder/encoder.sock',
} = {}) {
  const results = [];
  for (const [locale, text] of Object.entries(samples)) {
    const item = { id: 'readiness', text };
    const nlp = await checkNormalization(spacySocket, locale, item).catch((error) => {
      throw new Error(`${locale} spaCy: ${error.message}`);
    });
    const encoder = await checkEncoder(encoderSocket, locale, item).catch((error) => {
      throw new Error(`${locale} Encoder: ${error.message}`);
    });
    results.push({ locale, nlp, encoder });
  }
  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(await checkTextAnalysis()));
  } catch (error) {
    console.error('Textanalyse-Readiness fehlgeschlagen: ' + error.message);
    process.exitCode = 1;
  }
}

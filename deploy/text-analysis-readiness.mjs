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

function callSidecar(socketPath, path, payload) {
  const body = payload === undefined ? undefined : JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = request(
      {
        socketPath,
        path,
        method: body === undefined ? 'GET' : 'POST',
        headers:
          body === undefined
            ? undefined
            : {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
              },
        signal: AbortSignal.timeout(8_000),
      },
      (response) => {
        const expectedStatus = body === undefined ? 204 : 200;
        if (response.statusCode !== expectedStatus) {
          response.resume();
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        if (body === undefined) {
          response.resume();
          resolve();
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
  const result = await callSidecar(socket, '/normalize', { locale, texts: [item] });
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
  const result = await callSidecar(socket, '/embed', { locale, snapshotHash, items: [item] });
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

export async function checkTextAnalysisHealth({
  spacySocket = '/run/spacy/nlp.sock',
  encoderSocket = '/run/wordcloud-encoder/encoder.sock',
} = {}) {
  for (const [service, socket] of [
    ['spaCy', spacySocket],
    ['Encoder', encoderSocket],
  ]) {
    await callSidecar(socket, '/health').catch((error) => {
      throw new Error(`${service}: ${error.message}`);
    });
  }
}

if (process.argv[1] === '-' || process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === '--health-only') {
      await checkTextAnalysisHealth();
      console.log('spaCy und Encoder sind über ihre Sockets erreichbar.');
    } else {
      console.log(JSON.stringify(await checkTextAnalysis()));
    }
  } catch (error) {
    console.error('Textanalyse-Readiness fehlgeschlagen: ' + error.message);
    process.exitCode = 1;
  }
}

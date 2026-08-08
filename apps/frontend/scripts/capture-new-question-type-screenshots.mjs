#!/usr/bin/env node
import { mkdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEMO_QUIZ_JSON = join(__dirname, '../src/assets/demo/quiz-demo-showcase.de.json');
const ARTIFACT_DIR = '/Users/kqc/.gemini/antigravity/brain/1c7d9548-2a9e-418c-8eda-05246c0783b3';
const BASE_URL = 'http://localhost:4200';
const TRPC_URL = 'http://localhost:3000/trpc';

async function main() {
  await mkdir(ARTIFACT_DIR, { recursive: true });

  const rawJson = await readFile(DEMO_QUIZ_JSON, 'utf8');
  const uploadPayload = JSON.parse(rawJson).quiz;

  const publicTrpc = createTRPCProxyClient({
    links: [httpBatchLink({ url: TRPC_URL })],
  });

  const uploadResult = await publicTrpc.quiz.upload.mutate({
    ...uploadPayload,
    historyScopeId: 'de500000-0000-4000-a000-000000000001',
  });

  const sessionResult = await publicTrpc.session.create.mutate({
    quizId: uploadResult.quizId,
  });

  const code = sessionResult.code.toUpperCase();
  const hostToken = sessionResult.hostToken;
  console.log(`Session created: ${code}`);

  const hostTrpc = createTRPCProxyClient({
    links: [
      httpBatchLink({
        url: TRPC_URL,
        headers: { 'x-host-token': hostToken },
      }),
    ],
  });

  // Join 5 participants
  const participants = await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      publicTrpc.session.join.mutate({
        code,
        nickname: `Schueler_${i + 1}`,
        anonymousClientId: globalThis.crypto.randomUUID(),
      }),
    ),
  );

  const browser = await chromium.launch({ headless: true });
  const contextHost = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const contextVote = await browser.newContext({ viewport: { width: 480, height: 1000 } });

  const hostPage = await contextHost.newPage();
  const votePage = await contextVote.newPage();

  // Set host token in sessionStorage
  await hostPage.goto(`${BASE_URL}/de/session/${code}/host`);
  await hostPage.evaluate(
    ({ code, token }) => {
      sessionStorage.setItem(`arsnova-host-token:${code}`, token);
    },
    { code, token: hostToken },
  );
  await hostPage.goto(`${BASE_URL}/de/session/${code}/host`);
  await hostPage.waitForTimeout(2000);

  // Set participant ID in localStorage
  const p0 = participants[0];
  await votePage.goto(`${BASE_URL}/de/session/${code}/vote`);
  await votePage.evaluate(
    ({ code, pid }) => {
      localStorage.setItem(`arsnova-participant-${code}`, pid);
    },
    { code, pid: p0.participantId },
  );
  await votePage.goto(`${BASE_URL}/de/session/${code}/vote`);
  await votePage.waitForTimeout(2000);

  const targetTypes = ['ORDERING', 'MATCHING', 'CATEGORIZATION'];

  for (let i = 0; i < uploadPayload.questions.length; i++) {
    await hostTrpc.session.nextQuestion
      .mutate({ code })
      .catch((e) => console.log(`next error: ${e.message}`));
    await hostTrpc.session.revealAnswers.mutate({ code }).catch(() => {});

    const qStudent = await publicTrpc.session.getCurrentQuestionForStudent
      .query({ code })
      .catch(() => null);
    if (!qStudent) break;

    console.log(
      `Question ${i + 1}/${uploadPayload.questions.length}: order=${qStudent.order}, type=${qStudent.type}`,
    );

    if (targetTypes.includes(qStudent.type)) {
      const typeName = qStudent.type.toLowerCase();
      const origQ = uploadPayload.questions.find((q) => q.order === qStudent.order);

      // 1. Submit votes from all 5 participants
      for (let pIdx = 0; pIdx < participants.length; pIdx++) {
        const pObj = participants[pIdx];
        const pTrpc = createTRPCProxyClient({
          links: [
            httpBatchLink({
              url: TRPC_URL,
              headers: { 'x-participant-token': pObj.rejoinToken },
            }),
          ],
        });

        let voteInput = {
          sessionId: pObj.id,
          participantId: pObj.participantId,
          questionId: qStudent.id,
          confidenceValue: 4,
        };

        if (qStudent.type === 'ORDERING') {
          voteInput.orderingSequence = origQ.orderingItems.map((item) => item.text);
        } else if (qStudent.type === 'MATCHING') {
          voteInput.matchingSelections = origQ.matchingPairs.map((p) => ({
            left: p.left,
            right: p.right,
          }));
        } else if (qStudent.type === 'CATEGORIZATION') {
          voteInput.categorizationSelections = origQ.categorizationItems.map((item) => ({
            text: item.text,
            categoryId: item.correctCategoryId,
          }));
        }

        await pTrpc.vote.submit
          .mutate(voteInput)
          .catch((err) => console.error(`Vote submit error: ${err.message}`));
      }

      // 2. Capture Vote Page
      await votePage.goto(`${BASE_URL}/de/session/${code}/vote`);
      await votePage.waitForTimeout(2500);
      const votePath = join(ARTIFACT_DIR, `${typeName}_vote.png`);
      await votePage.screenshot({ path: votePath, fullPage: true });
      console.log(`Saved Vote View: ${votePath}`);

      // 3. Host reveals results (Ergebnisse auflösen)
      await hostTrpc.session.revealResults.mutate({ code }).catch(() => {});

      // 4. Capture Host Page (Beamer Results breakdown view)
      await hostPage.goto(`${BASE_URL}/de/session/${code}/host`);
      await hostPage.waitForTimeout(3000);
      const hostResultsPath = join(ARTIFACT_DIR, `${typeName}_host.png`);
      await hostPage.screenshot({ path: hostResultsPath, fullPage: true });
      console.log(`Saved Host Results View: ${hostResultsPath}`);
    } else {
      // Transition out of ACTIVE status so nextQuestion works on next loop iteration
      await hostTrpc.session.revealResults.mutate({ code }).catch(() => {});
    }
  }

  await browser.close();
  console.log('Results screenshots completed successfully!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

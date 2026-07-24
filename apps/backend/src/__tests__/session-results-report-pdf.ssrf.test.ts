import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import type { SessionExportDTO } from '@arsnova/shared-types';
import { buildSessionResultsPdf } from '../lib/session-results-report-pdf';

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          ),
      ),
  );
});

describe('buildSessionResultsPdf SSRF', { timeout: 60_000 }, () => {
  it('kontaktiert ein abgelehntes Loopback-Bild auch über Chromium nie', async () => {
    let beaconHits = 0;
    const server = createServer((_request, response) => {
      beaconHits += 1;
      response.writeHead(200, { 'content-type': 'image/png' });
      response.end(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    const imageUrl = `http://127.0.0.1:${port}/beacon.png`;
    const data: SessionExportDTO = {
      sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      sessionCode: 'ABC123',
      quizName: 'SSRF Regression',
      finishedAt: '2026-07-24T10:00:00.000Z',
      participantCount: 1,
      teamMode: false,
      questions: [
        {
          questionOrder: 0,
          questionTextShort: 'Bild',
          questionTextFull: `![intern](${imageUrl})`,
          type: 'SINGLE_CHOICE',
          participantCount: 1,
          optionDistribution: [{ text: 'A', count: 1, percentage: 100, isCorrect: true }],
        },
      ],
    };

    const pdf = await buildSessionResultsPdf(data);

    expect(pdf.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect(beaconHits).toBe(0);
  });
});

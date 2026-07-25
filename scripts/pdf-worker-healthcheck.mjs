import { request } from 'node:http';

const socketPath = process.env.PDF_WORKER_SOCKET_PATH || '/run/pdf-worker/render.sock';

const status = await new Promise((resolve, reject) => {
  const healthRequest = request({ socketPath, path: '/health', method: 'GET' }, (response) => {
    response.resume();
    response.once('end', () => resolve(response.statusCode ?? 0));
  });
  healthRequest.setTimeout(2_000, () => healthRequest.destroy(new Error('health timeout')));
  healthRequest.once('error', reject);
  healthRequest.end();
});

if (status !== 204) {
  throw new Error(`PDF-Worker-Healthcheck lieferte Status ${status}`);
}

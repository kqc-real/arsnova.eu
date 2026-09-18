import type { HostRecoveryCardDTO } from '@arsnova/shared-types';

export type HostRecoveryCardCopyLabels = {
  downloadHeading: string;
  supportIdLabel: string;
  recoveryCodeLabel: string;
  recoveryPageLabel: string;
  downloadUsage: string;
  downloadRotationNotice: string;
  downloadStatePending?: string;
};

export type HostRecoveryCardHtmlLabels = HostRecoveryCardCopyLabels & {
  downloadIntro: string;
  supportIdHint: string;
  recoveryCodeHint: string;
  downloadHowTo: string;
  cardWarning: string;
  supportContactLink: string;
  supportContactHref: string;
};

export function buildHostRecoveryCardPlainText(
  card: HostRecoveryCardDTO,
  recoveryUrl: string,
  labels: HostRecoveryCardCopyLabels,
): string {
  const lines = [
    labels.downloadHeading,
    `${labels.supportIdLabel}: ${card.supportId}`,
    `${labels.recoveryCodeLabel}: ${card.recoveryCode}`,
    `${labels.recoveryPageLabel}: ${recoveryUrl}`,
    '',
    labels.downloadUsage,
    labels.downloadRotationNotice,
  ];
  if (labels.downloadStatePending) {
    lines.push(labels.downloadStatePending);
  }
  return lines.join('\n');
}

export function escapeHostRecoveryHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function buildHostRecoveryCardHtml(params: {
  card: HostRecoveryCardDTO;
  recoveryUrl: string;
  lang: string;
  labels: HostRecoveryCardHtmlLabels;
}): string {
  const { card, recoveryUrl, lang, labels } = params;
  const recoveryLink = `<a class="usage-link" href="${escapeHostRecoveryHtml(recoveryUrl)}">${escapeHostRecoveryHtml(recoveryUrl)}</a>`;
  const usageHtml = escapeHostRecoveryHtml(labels.downloadUsage).replaceAll(
    escapeHostRecoveryHtml(recoveryUrl),
    recoveryLink,
  );
  const supportHref = escapeHostRecoveryHtml(labels.supportContactHref);
  const supportLink = `<a class="usage-link" href="${supportHref}">${escapeHostRecoveryHtml(labels.supportContactLink)}</a>`;
  const pending = labels.downloadStatePending
    ? `<p class="pending">${escapeHostRecoveryHtml(labels.downloadStatePending)}</p>`
    : '';
  return `<!DOCTYPE html>
<html lang="${escapeHostRecoveryHtml(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHostRecoveryHtml(labels.downloadHeading)}</title>
  <style>
    :root { color-scheme: light dark; }
    body {
      margin: 0;
      padding: 1.5rem 1rem 2rem;
      font-family: system-ui, sans-serif;
      line-height: 1.5;
      background: #f4f6f8;
      color: #1a1c1e;
    }
    .card {
      max-width: 40rem;
      margin: 0 auto;
      padding: 1.5rem 1.35rem 1.4rem;
      border: 1px solid #c3c6cf;
      border-radius: 1.25rem;
      background: #fff;
      box-shadow: 0 8px 24px rgb(26 28 30 / 8%);
    }
    h1 {
      margin: 0 0 0.35rem;
      font-size: 1.35rem;
      line-height: 1.3;
    }
    .brand {
      margin: 0 0 0.75rem;
      color: #43474e;
      font-size: 0.95rem;
    }
    .intro, .pending {
      margin: 0 0 0.75rem;
      color: #43474e;
      font-size: 0.95rem;
    }
    dl { margin: 0; display: grid; gap: 0.75rem; }
    .field {
      margin: 0;
      padding: 0.85rem 0.95rem;
      border: 1px solid #c3c6cf;
      border-radius: 0.85rem;
      background: #f8f9fb;
    }
    .field--secret {
      border-color: #ba1a1a;
      background: #fff2f1;
    }
    dt {
      margin: 0;
      color: #43474e;
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    dd {
      margin: 0.2rem 0 0;
      overflow-wrap: anywhere;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 1.05rem;
      font-weight: 600;
      user-select: all;
    }
    .hint {
      margin: 0.35rem 0 0;
      color: #43474e;
      font-family: system-ui, sans-serif;
      font-size: 0.9rem;
      font-weight: 400;
    }
    h2 {
      margin: 1.25rem 0 0.35rem;
      font-size: 1rem;
    }
    .usage, .warn {
      margin: 0;
    }
    .usage-link {
      overflow-wrap: anywhere;
      color: #0b57d0;
    }
    .warn {
      margin-top: 1rem;
      padding: 0.75rem 0.85rem;
      border-radius: 0.75rem;
      background: #e8f2ff;
    }
    @media (prefers-color-scheme: dark) {
      body { background: #111318; color: #e2e2e6; }
      .card { background: #1b1f24; border-color: #43474e; box-shadow: none; }
      .brand, .intro, .pending, dt, .hint { color: #c3c6cf; }
      .field { background: #111318; border-color: #43474e; }
      .field--secret { background: #3f1113; border-color: #ffb4ab; }
      .warn { background: #1d3248; }
      .usage-link { color: #a8c7fa; }
    }
    @media print {
      body { padding: 0; background: #fff; }
      .card { box-shadow: none; }
    }
  </style>
</head>
<body>
  <article class="card">
    <h1>${escapeHostRecoveryHtml(labels.downloadHeading)}</h1>
    <p class="brand">arsnova.eu</p>
    <p class="intro">${escapeHostRecoveryHtml(labels.downloadIntro)}</p>
    ${pending}
    <dl>
      <div class="field">
        <dt>${escapeHostRecoveryHtml(labels.recoveryPageLabel)}</dt>
        <dd><a class="usage-link" href="${escapeHostRecoveryHtml(recoveryUrl)}">${escapeHostRecoveryHtml(recoveryUrl)}</a></dd>
      </div>
      <div class="field">
        <dt>${escapeHostRecoveryHtml(labels.supportIdLabel)}</dt>
        <dd>${escapeHostRecoveryHtml(card.supportId)}</dd>
        <p class="hint">${escapeHostRecoveryHtml(labels.supportIdHint)}</p>
      </div>
      <div class="field field--secret">
        <dt>${escapeHostRecoveryHtml(labels.recoveryCodeLabel)}</dt>
        <dd>${escapeHostRecoveryHtml(card.recoveryCode)}</dd>
        <p class="hint">${escapeHostRecoveryHtml(labels.recoveryCodeHint)}</p>
      </div>
    </dl>
    <h2>${escapeHostRecoveryHtml(labels.downloadHowTo)}</h2>
    <p class="usage">${usageHtml}</p>
    <p class="warn">${escapeHostRecoveryHtml(labels.cardWarning)} ${supportLink}</p>
    <p class="warn">${escapeHostRecoveryHtml(labels.downloadRotationNotice)}</p>
  </article>
</body>
</html>
`;
}

import { writeFileSync } from 'node:fs';
// Host-Token für den 1B-Treiber: Host-Tokens laufen nach 15 min ab (hostAuth.ts), ein Lauf mit
// zehn Aufträgen dauert länger. Wie das Frontend stellt der Treiber über
// session.issueHostAccessToken mit der Browser-Capability ein neues aus, sobald das alte
// maxAlterMs alt ist.
export function hostZugang({ start, erneuern, jetztMs, maxAlterMs }) {
  let token = start;
  let seit = jetztMs();
  return async () => {
    if (jetztMs() - seit >= maxAlterMs) {
      token = await erneuern();
      seit = jetztMs();
    }
    return token;
  };
}

// Host-Zugang für die Clip-Aufnahme (--zugang-datei im Treiber): nur Code, Token und
// Browser-Capability, Modus 0600, nie überschreiben. Die Datei bleibt im Laborordner.
export function zugangSchreiben(pfad, { code, hostToken, hostBrowserCapability }) {
  writeFileSync(pfad, `${JSON.stringify({ code, hostToken, hostBrowserCapability })}\n`, {
    mode: 0o600,
    flag: 'wx',
  });
}

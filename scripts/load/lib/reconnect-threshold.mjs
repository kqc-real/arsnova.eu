export function parseReconnectLimitMs(value, fallback = 30_000) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error('Reconnect-Limit muss eine ganze Zahl >= 1 ms sein.');
  }
  return parsed;
}

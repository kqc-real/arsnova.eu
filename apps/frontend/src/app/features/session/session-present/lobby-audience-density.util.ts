/** Ab dieser Mitgliederzahl werden Namen in der Presenter-Lobby gekürzt. */
export const LOBBY_AUDIENCE_CROWD_COUNT = 12;
/** Ab dieser Mitgliederzahl bleiben nur Icon/Sequenz sichtbar, damit niemand scrollen muss. */
export const LOBBY_AUDIENCE_PACKED_COUNT = 24;

export function lobbyAudienceIsCrowd(count: number): boolean {
  return count > LOBBY_AUDIENCE_CROWD_COUNT;
}

export function lobbyAudienceIsPacked(count: number): boolean {
  return count > LOBBY_AUDIENCE_PACKED_COUNT;
}

/** Packed-Raster bleibt hochkant: weniger Icons pro Zeile, groessere Zellen. */
const LOBBY_PACKED_COL_SQRT_DIVISOR = 1.45;
const LOBBY_PACKED_COL_MAX = 14;

/**
 * Spaltenzahl, mit der eine Badge-Fläche ohne Scroll in den Viewport passt.
 * Wenige Personen: breitere Karten mit Namen. Viele: hochkantes Icon-Raster.
 */
export function lobbyFitColumnCount(count: number): number {
  const n = Math.max(0, Math.floor(count));
  if (n <= 1) {
    return 1;
  }
  if (n <= 6) {
    return 2;
  }
  if (n <= LOBBY_AUDIENCE_CROWD_COUNT) {
    return 3;
  }
  if (n <= LOBBY_AUDIENCE_PACKED_COUNT) {
    return 4;
  }
  return Math.min(
    LOBBY_PACKED_COL_MAX,
    Math.max(4, Math.ceil(Math.sqrt(n) / LOBBY_PACKED_COL_SQRT_DIVISOR)),
  );
}

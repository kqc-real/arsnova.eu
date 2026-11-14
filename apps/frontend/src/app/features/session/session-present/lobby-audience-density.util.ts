/** Ab dieser Mitgliederzahl werden Namen in der Presenter-Lobby gekürzt. */
export const LOBBY_AUDIENCE_CROWD_COUNT = 12;
/** Ab dieser Mitgliederzahl bleiben nur Icon/Sequenz sichtbar, damit niemand scrollen muss. */
export const LOBBY_AUDIENCE_PACKED_COUNT = 24;
/** Obergrenze für einzelne Pseudonyme in der Presenter-Lobby. */
export const LOBBY_AUDIENCE_MAX_INDIVIDUALS = 50;

export function lobbyAudienceIsCrowd(count: number): boolean {
  return count > LOBBY_AUDIENCE_CROWD_COUNT;
}

export function lobbyAudienceIsPacked(count: number): boolean {
  return count > LOBBY_AUDIENCE_PACKED_COUNT;
}

/** Wählt das Raster mit den größten quadratischen Zellen. */
export function lobbyAnimalGridColumnCount(
  count: number,
  width: number,
  height: number,
  columnGap: number,
  rowGap: number,
): number {
  let bestColumns = 1;
  let bestSize = 0;
  for (let columns = 1; columns <= count; columns += 1) {
    const rows = Math.ceil(count / columns);
    const cellWidth = (width - (columns - 1) * columnGap) / columns;
    const cellHeight = (height - (rows - 1) * rowGap) / rows;
    const size = Math.min(cellWidth, cellHeight);
    if (size > bestSize) {
      bestSize = size;
      bestColumns = columns;
    }
  }
  return bestColumns;
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

/** Wählt die Spalten und die gemeinsame Schriftgröße für einzeilige Namen. */
export function lobbyTextGridLayout(
  count: number,
  width: number,
  height: number,
  columnGap: number,
  rowGap: number,
  longestLineWidth: number,
  minimumFontSize: number,
): { columns: number; fontSize: number; minColumnWidth: number } {
  const minColumnWidth = Math.ceil((longestLineWidth * minimumFontSize) / 0.8);
  let best = { columns: 1, fontSize: 0 };
  let bestFitsRows = false;
  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns);
    const columnWidth = (width - (columns - 1) * columnGap) / columns;
    if (columns > 1 && columnWidth < minColumnWidth) break;
    const rowHeight = (height - (rows - 1) * rowGap) / rows;
    const fitsRows = rowHeight >= 2.65 * minimumFontSize;
    const fontSize = Math.min((columnWidth * 0.8) / longestLineWidth, (rowHeight * 0.85) / 1.2);
    if ((fitsRows && !bestFitsRows) || (fitsRows === bestFitsRows && fontSize > best.fontSize)) {
      best = { columns, fontSize };
      bestFitsRows = fitsRows;
    }
  }
  return {
    columns: best.columns,
    fontSize: Math.max(minimumFontSize, best.fontSize),
    minColumnWidth,
  };
}

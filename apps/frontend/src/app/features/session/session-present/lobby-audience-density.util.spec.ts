import { describe, expect, it } from 'vitest';
import {
  LOBBY_AUDIENCE_CROWD_COUNT,
  LOBBY_AUDIENCE_PACKED_COUNT,
  lobbyAnimalGridColumnCount,
  lobbyAudienceIsCrowd,
  lobbyAudienceIsPacked,
  lobbyFitColumnCount,
  lobbyTextGridLayout,
} from './lobby-audience-density.util';

describe('lobbyTextGridLayout', () => {
  it('uses the team width, group size and the widths of the names', () => {
    const single = lobbyTextGridLayout(1, 840, 540, 6, 6, 10, 16);
    const audience = lobbyTextGridLayout(8, 840, 340, 6, 6, 10, 16);
    const team = lobbyTextGridLayout(8, 240, 540, 6, 6, 10, 16);
    expect(single.fontSize).toBeGreaterThan(audience.fontSize);
    expect(audience.columns).toBeGreaterThan(team.columns);
    expect(audience.fontSize).toBeGreaterThan(team.fontSize);
    expect(lobbyTextGridLayout(8, 240, 540, 6, 6, 4, 16).fontSize).toBeGreaterThan(team.fontSize);
  });

  it('keeps a readable minimum when the grid needs to scroll', () => {
    expect(lobbyTextGridLayout(50, 100, 150, 6, 6, 10, 20)).toEqual({
      columns: 1,
      fontSize: 20,
      minColumnWidth: 250,
    });
  });
});

describe('lobbyAnimalGridColumnCount', () => {
  it('passt 13 Tiere an die verfügbare Fläche eines Teams an', () => {
    expect(lobbyAnimalGridColumnCount(13, 158, 840, 3, 3)).toBe(2);
    expect(lobbyAnimalGridColumnCount(13, 370, 265, 3, 3)).toBe(5);
    expect(lobbyAnimalGridColumnCount(13, 40, 250, 3, 3)).toBe(2);
  });

  it('nutzt bei einem Tier die ganze Rasterfläche und verteilt 50 Tiere nach Seitenverhältnis', () => {
    expect(lobbyAnimalGridColumnCount(1, 800, 1000, 2, 2)).toBe(1);
    expect(lobbyAnimalGridColumnCount(50, 800, 1000, 2, 2)).toBe(7);
    expect(lobbyAnimalGridColumnCount(50, 1000, 800, 2, 2)).toBe(8);
  });
});

describe('lobbyFitColumnCount', () => {
  it('haelt wenige Namen in breiten Spalten', () => {
    expect(lobbyFitColumnCount(0)).toBe(1);
    expect(lobbyFitColumnCount(1)).toBe(1);
    expect(lobbyFitColumnCount(2)).toBe(2);
    expect(lobbyFitColumnCount(6)).toBe(2);
    expect(lobbyFitColumnCount(LOBBY_AUDIENCE_CROWD_COUNT)).toBe(3);
  });

  it('verdichtet grosse Gruppen auf ein hochkantes Icon-Raster', () => {
    expect(lobbyFitColumnCount(LOBBY_AUDIENCE_PACKED_COUNT)).toBe(4);
    expect(lobbyFitColumnCount(25)).toBe(4);
    expect(lobbyFitColumnCount(50)).toBe(5);
    expect(lobbyFitColumnCount(51)).toBe(5);
    expect(lobbyFitColumnCount(100)).toBe(7);
    expect(lobbyFitColumnCount(250)).toBe(11);
    expect(lobbyFitColumnCount(500)).toBe(14);
  });
});

describe('lobbyAudience density flags', () => {
  it('schlaegt Crowd und Packed erst nach den Schwellen an', () => {
    expect(lobbyAudienceIsCrowd(LOBBY_AUDIENCE_CROWD_COUNT)).toBe(false);
    expect(lobbyAudienceIsCrowd(LOBBY_AUDIENCE_CROWD_COUNT + 1)).toBe(true);
    expect(lobbyAudienceIsPacked(LOBBY_AUDIENCE_PACKED_COUNT)).toBe(false);
    expect(lobbyAudienceIsPacked(LOBBY_AUDIENCE_PACKED_COUNT + 1)).toBe(true);
  });
});

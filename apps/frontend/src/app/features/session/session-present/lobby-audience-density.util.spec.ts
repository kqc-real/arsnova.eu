import { describe, expect, it } from 'vitest';
import {
  LOBBY_AUDIENCE_CROWD_COUNT,
  LOBBY_AUDIENCE_PACKED_COUNT,
  lobbyAudienceIsCrowd,
  lobbyAudienceIsPacked,
  lobbyFitColumnCount,
} from './lobby-audience-density.util';

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

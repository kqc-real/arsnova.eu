/**
 * Öffentliche Klassenform für Specs.
 * Ein direkter Schnitt `Klasse & { privatesFeld }` wird zu `never`, sobald das
 * Feld in der Klasse privat ist. Die gemappte Form übernimmt nur `keyof`-Member.
 */
export type SpecAccess<T, Extra extends object = Record<never, never>> = {
  [K in keyof T]: T[K];
} & Extra;

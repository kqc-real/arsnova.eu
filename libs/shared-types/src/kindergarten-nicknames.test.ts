import { describe, expect, it } from 'vitest';
import { getLegacyKindergartenAnimal } from './kindergarten-nicknames.js';

describe('getLegacyKindergartenAnimal', () => {
  it.each([
    ['Roter Drache', { animalId: 0, name: 'Drache' }],
    ['Green frog', { animalId: 1, name: 'Frog' }],
    ['Cygne bleu clair', { animalId: 14, name: 'Cygne' }],
  ])('normalisiert den früheren Picker-Namen %s', (legacyName, expected) => {
    expect(getLegacyKindergartenAnimal(legacyName)).toEqual(expected);
  });

  it('akzeptiert weder aktuelle Namen noch unbekannte Freitexte als Legacy-Namen', () => {
    expect(getLegacyKindergartenAnimal('Drache')).toBeUndefined();
    expect(getLegacyKindergartenAnimal('Nicht aus dem Picker')).toBeUndefined();
  });

  it('normalisiert auch umbenannte Motive auf den aktuellen sichtbaren Namen', () => {
    expect(getLegacyKindergartenAnimal('Bernsteinfarbener Langhals')).toEqual({
      animalId: 95,
      name: 'Sauropode',
    });
  });
});

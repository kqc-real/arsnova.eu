import { describe, expect, it } from 'vitest';
import { getLegacyKindergartenAnimal } from './kindergarten-nicknames.js';
import { LEGACY_KINDERGARTEN_NICKNAMES } from './legacy-kindergarten-nicknames.js';

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

  it.each([
    ['Chameau de Bactriane couleur d', { animalId: 90, name: 'Chameau de Bactriane' }],
    ['Dinosaurio ámbar de cuello lar', { animalId: 95, name: 'Saurópodo' }],
    ['Pollito plateado saliendo del', { animalId: 101, name: 'Pollito en el cascarón' }],
    ['Dinosauro ambrato dal collo lu', { animalId: 95, name: 'Sauropode' }],
    ['Pulcino argentato che si schiu', { animalId: 101, name: 'Pulcino nell’uovo' }],
  ])('normalisiert den vom Vorgänger-Client gekürzten Namen %s', (legacyName, expected) => {
    expect(getLegacyKindergartenAnimal(legacyName)).toEqual(expected);
  });

  it('enthält keine mehrdeutigen 30-Zeichen-Aliasse', () => {
    const animalIdsByAlias = new Map<string, Set<number>>();
    for (const names of Object.values(LEGACY_KINDERGARTEN_NICKNAMES)) {
      for (const [animalId, name] of names.entries()) {
        const alias = name.trim().slice(0, 30).trim();
        const ids = animalIdsByAlias.get(alias) ?? new Set<number>();
        ids.add(animalId);
        animalIdsByAlias.set(alias, ids);
      }
    }

    expect([...animalIdsByAlias].filter(([, animalIds]) => animalIds.size > 1)).toEqual([]);
  });
});

import { resolveAssetUrlFromBase } from '../core/locale-from-path';

export function animalIconUrl(emoji: string): string {
  const codepoints = Array.from(emoji, (character) => character.codePointAt(0)!.toString(16))
    .filter((codepoint) => codepoint !== 'fe0f')
    .join('_');
  return resolveAssetUrlFromBase(`assets/presenter-animals/emoji_u${codepoints}.svg`);
}

/**
 * Archiv-MOTD: erste ATX-Überschrift (# …) als Titel, Rest als Rumpf-Markdown.
 * Ohne führende Überschrift bleibt der gesamte Text im Rumpf, Titel ist null.
 */
export function splitMotdArchiveFirstAtxHeading(markdown: string): {
  title: string | null;
  bodyMarkdown: string;
} {
  const trimmed = markdown.replace(/^\uFEFF/, '').trimStart();
  const m = trimmed.match(/^#{1,6}\s+(.+?)\s*(?:\n|$)/);
  if (!m) {
    return { title: null, bodyMarkdown: markdown };
  }
  const title = (m[1] ?? '').trim();
  const rest = trimmed.slice(m[0].length).trimStart();
  return { title: title.length > 0 ? title : null, bodyMarkdown: rest };
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** Element text with CDATA unwrapped and entities decoded. */
export function xmlText(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
      if (body.startsWith('#x') || body.startsWith('#X')) {
        return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
      }
      if (body.startsWith('#')) return String.fromCodePoint(Number(body.slice(1)));
      return ENTITIES[body.toLowerCase()] ?? whole;
    })
    .trim();
}

/** A numeric attribute of an opening tag; null when absent or not a number. */
export function xmlNumberAttribute(tag: string, name: string): number | null {
  const found = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`).exec(tag);
  const value = found ? Number(found[1]) : Number.NaN;
  return Number.isFinite(value) ? value : null;
}

/** A text attribute of an opening tag. */
export function xmlAttribute(tag: string, name: string): string | undefined {
  const found = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`).exec(tag);
  return found?.[1] === undefined ? undefined : xmlText(found[1]);
}

/** The inside of the first `<tag>` (any namespace prefix) in `inner`. */
export function xmlChild(inner: string, tag: string): string | undefined {
  return new RegExp(`<(?:[\\w.-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${tag}>`, 'i').exec(
    inner
  )?.[1];
}

/** The first `<tag>` in `inner` read as a finite number. */
export function xmlNumber(inner: string, tag: string): number | undefined {
  const raw = xmlChild(inner, tag);
  if (raw === undefined) return undefined;
  const value = Number(xmlText(raw));
  return Number.isFinite(value) ? value : undefined;
}

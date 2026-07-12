export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const TOKEN_RE = /\{\{\s*(\w+)\s*\}\}/g;

/**
 * Interpolate {{token}} placeholders; unknown tokens are stripped. Values are
 * HTML-escaped by default — pass escape:false only for content rendered as-is
 * (e.g. campaign bodies where the mentor authors the full HTML).
 */
export function interpolate(
  template: string,
  fields: Record<string, string>,
  { escape = true }: { escape?: boolean } = {},
): string {
  return template.replace(TOKEN_RE, (_m, key: string) => {
    const value = fields[key] ?? '';
    return escape ? escapeHtml(value) : value;
  });
}

/** Distinct {{token}} names used in a template body/subject. */
export function extractTokens(template: string): string[] {
  const tokens = new Set<string>();
  for (const match of template.matchAll(TOKEN_RE)) tokens.add(match[1]);
  return [...tokens];
}

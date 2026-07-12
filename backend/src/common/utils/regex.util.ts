/** Escape a user-supplied string for safe use inside a $regex query. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

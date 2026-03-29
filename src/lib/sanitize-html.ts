/**
 * RESERVO.AI — HTML escape utility
 *
 * Escapes HTML special characters to prevent XSS when rendering
 * user-generated content outside of React's JSX escaping
 * (e.g., dangerouslySetInnerHTML, raw HTML strings).
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

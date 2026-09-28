/**
 * Escapa texto para meterlo en HTML. Las páginas de error del login muestran
 * parámetros de la URL (`?error=`) y respuestas de GitLab: sin esto, un enlace
 * manipulado ejecutaría código en el panel de quien lo abra.
 */
export function escaparHtml(texto: string): string {
  return String(texto).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

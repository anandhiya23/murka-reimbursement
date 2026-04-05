/**
 * Normalize date strings to DD/MM/YYYY format.
 * Handles both "YYYY-MM-DD" (HTML date input) and "DD/MM/YYYY" (legacy data).
 */
export function formatDate(raw: string): string {
  if (!raw) return "-";
  // Already DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
  // YYYY-MM-DD → DD/MM/YYYY
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return raw;
}

/**
 * Format an ISO datetime string as a locale date in Jakarta timezone.
 * Used for created_at / submitted_at timestamps.
 */
export function formatSubmittedDate(isoString: string): string {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleDateString("en-GB", {
    timeZone: "Asia/Jakarta",
  });
}

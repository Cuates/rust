/**
 * Converts a total number of seconds into a human-readable duration string.
 * @example formatDuration(3661) → "1h 1m 1s"
 */
export function formatDuration(totalSeconds: number, milliseconds: number = 0): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);

  parts.push(`${milliseconds}ms`);

  return parts.join(' ');
}

/**
 * Formats a byte count into a human-readable size string.
 * @example formatBytes(1536) → "1.5 KB"
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Safely extracts the base file name from a full path string.
 * Works with both Windows (`\`) and POSIX (`/`) separators.
 */
export function baseName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

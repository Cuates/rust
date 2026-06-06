import type { DirStats } from '../types';

export function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function buildTooltip(stats: DirStats) {
  if (!stats.exists) return 'Issue: Directory was deleted or renamed before processing';
  if (stats.files.length === 0) return '0 media files, 0 B';

  let tooltip = '';
  for (const file of stats.files) {
    tooltip += `${file.name} (${formatBytes(file.size_bytes)})\n`;
  }
  tooltip += `\nTotal: ${stats.file_count} media files, ${formatBytes(stats.total_size_bytes)}`;
  return tooltip;
}

export function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const ms_ = ms % 1000;
  return [h && `${h}h`, m && `${m}m`, s && `${s}s`, `${ms_}ms`]
    .filter(Boolean).join(' ');
}

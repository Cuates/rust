export function getLogClass(line: string) {
  const lower = line.toLowerCase();
  if (lower.includes('[error]') || line.includes('❌') || lower.startsWith('error'))
    return 'log-error';
  if (line.includes('⚠️')) return 'log-warning';
  if (line.includes('✅') || lower.includes('success')) return 'log-success';
  if (lower.includes('[info]')) return 'log-info';
  return '';
}

import { describe, it, expect } from 'vitest';
import { formatDuration, formatBytes, baseName } from '$lib/utils/formatters';

describe('formatDuration', () => {
  it('returns 0ms for 0 seconds', () => {
    expect(formatDuration(0)).toBe('0ms');
  });

  it('formats seconds only', () => {
    expect(formatDuration(45)).toBe('45s 0ms');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(90)).toBe('1m 30s 0ms');
  });

  it('formats hours, minutes, seconds', () => {
    expect(formatDuration(3661)).toBe('1h 1m 1s 0ms');
  });

  it('formats exactly 1 hour', () => {
    expect(formatDuration(3600)).toBe('1h 0ms');
  });

  it('includes milliseconds when provided', () => {
    expect(formatDuration(1, 350)).toBe('1s 350ms');
  });
});

describe('formatBytes', () => {
  it('formats 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes', () => {
    expect(formatBytes(512)).toBe('512.0 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MB');
  });
});

describe('baseName', () => {
  it('extracts base name from POSIX path', () => {
    expect(baseName('/home/user/movies/video.mkv')).toBe('video.mkv');
  });

  it('extracts base name from Windows path', () => {
    expect(baseName('C:\\Users\\user\\Movies\\video.mkv')).toBe('video.mkv');
  });

  it('returns the original string for a plain name', () => {
    expect(baseName('video.mkv')).toBe('video.mkv');
  });

  it('handles empty strings and slash-only strings gracefully', () => {
    expect(baseName('')).toBe('');
    expect(baseName('///')).toBe('///');
    expect(baseName('\\\\')).toBe('\\\\');
  });
});

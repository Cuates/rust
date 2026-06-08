import { describe, it, expect } from 'vitest';
import { formatBytes, formatDuration, buildTooltip } from './formatters';

describe('formatters', () => {
  describe('formatBytes', () => {
    it('formats 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('formats KB', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
    });

    it('formats MB', () => {
      expect(formatBytes(1048576)).toBe('1 MB');
    });

    it('formats GB', () => {
      expect(formatBytes(1073741824)).toBe('1 GB');
    });
  });

  describe('formatDuration', () => {
    it('formats milliseconds correctly', () => {
      expect(formatDuration(0)).toBe('0ms');
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(1500)).toBe('1s 500ms');
      expect(formatDuration(61500)).toBe('1m 1s 500ms');
      expect(formatDuration(3661500)).toBe('1h 1m 1s 500ms');
    });
  });

  describe('buildTooltip', () => {
    it('handles non-existent directory', () => {
      expect(buildTooltip({ exists: false, files: [], file_count: 0, total_size_bytes: 0 })).toBe(
        'Issue: Directory was deleted or renamed before processing'
      );
    });

    it('handles empty directory', () => {
      expect(buildTooltip({ exists: true, files: [], file_count: 0, total_size_bytes: 0 })).toBe(
        '0 media files, 0 B'
      );
    });

    it('builds tooltip with files', () => {
      const stats = {
        exists: true,
        file_count: 2,
        total_size_bytes: 3072, // 3 KB
        files: [
          { name: 'video1.mkv', size_bytes: 1024 },
          { name: 'video2.mkv', size_bytes: 2048 }
        ]
      };

      const tooltip = buildTooltip(stats);
      expect(tooltip).toContain('video1.mkv (1 KB)');
      expect(tooltip).toContain('video2.mkv (2 KB)');
      expect(tooltip).toContain('Total: 2 media files, 3 KB');
    });
  });
});

import { describe, it, expect } from 'vitest';
import { getLogClass } from './logClassifier';

describe('logClassifier', () => {
  describe('getLogClass', () => {
    it('identifies errors', () => {
      expect(getLogClass('[ERROR] failed')).toBe('log-error');
      expect(getLogClass('error processing')).toBe('log-error');
      expect(getLogClass('❌ failed')).toBe('log-error');
    });

    it('identifies warnings', () => {
      expect(getLogClass('⚠️ retrying')).toBe('log-warning');
    });

    it('identifies success', () => {
      expect(getLogClass('✅ Done')).toBe('log-success');
      expect(getLogClass('Successfully finished')).toBe('log-success');
    });

    it('identifies info', () => {
      expect(getLogClass('[INFO] Processing...')).toBe('log-info');
    });

    it('returns empty for unknown', () => {
      expect(getLogClass('frame=123 fps=30')).toBe('');
    });
  });
});
